/**
 * Egress audit log — paginated query + live tail.
 *
 * Backed by:
 *   GET    /api/v1/egress/audit
 *   GET    /api/v1/egress/audit/:id
 *
 * `client.audit.tail()` long-polls the REST endpoint and yields new
 * events as they arrive. The sandbox-scoped variant
 * (`sandbox.audit.tail()`) upgrades to a live SSE connection backed by
 * `GET /sandboxes/:id/audit/stream` so the tail latency is
 * sub-second.
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface EgressAuditEvent {
  id: string;
  action?: string;
  effect?: string;
  host?: string;
  method?: string;
  path?: string;
  status_code?: number;
  actor_id?: string;
  resource_id?: string;
  resource_type?: string;
  policy_id?: string;
  rule_id?: string;
  external_user_id?: string;
  external_workspace_id?: string;
  metadata?: Record<string, unknown>;
  inserted_at?: string;
  timestamp?: string;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface AuditListParams {
  resourceId?: string;
  resource_id?: string;
  resourceType?: string;
  resource_type?: string;
  host?: string;
  action?: string;
  since?: string;
  until?: string;
  limit?: number;
  cursor?: string;
  externalUserId?: string;
  external_user_id?: string;
  externalWorkspaceId?: string;
  external_workspace_id?: string;
}

export interface AuditTailParams extends AuditListParams {
  pollIntervalMs?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface WireEnvelope<T> {
  data?: T;
  event?: T;
  items?: T;
}

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["data", "event", "items"]) {
      if (k in p) return p[k] as T;
    }
  }
  return payload as T;
}

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["data", "events", "audit", "items"]) {
      if (Array.isArray(p[k])) return p[k] as T[];
    }
  }
  return [];
}

function stripUndefined(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  );
}

function pickFirst<T>(...values: Array<T | undefined>): T | undefined {
  for (const v of values) if (v !== undefined) return v;
  return undefined;
}

function listQuery(
  params: AuditListParams,
): Record<string, string | number | boolean | undefined> {
  return stripUndefined({
    resource_id: pickFirst(params.resourceId, params.resource_id),
    resource_type: pickFirst(params.resourceType, params.resource_type),
    host: params.host,
    action: params.action,
    since: params.since,
    until: params.until,
    limit: params.limit,
    cursor: params.cursor,
    external_user_id: pickFirst(params.externalUserId, params.external_user_id),
    external_workspace_id: pickFirst(
      params.externalWorkspaceId,
      params.external_workspace_id,
    ),
  }) as Record<string, string | number | boolean | undefined>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class EgressAudit {
  constructor(protected readonly http: HttpClient) {}

  /** List audit events with optional filters. */
  async list(params: AuditListParams = {}): Promise<EgressAuditEvent[]> {
    const data = await this.http.get<unknown>(
      "/egress/audit",
      listQuery(params),
    );
    return unwrapList<EgressAuditEvent>(data);
  }

  /** Get a single audit event by id. */
  async get(id: string): Promise<EgressAuditEvent> {
    const data = await this.http.get<WireEnvelope<EgressAuditEvent>>(
      `/egress/audit/${id}`,
    );
    return unwrap<EgressAuditEvent>(data);
  }

  /**
   * Long-poll the audit endpoint and yield new events as they appear.
   *
   * Tenant-wide `client.audit.tail()` is REST-based long polling. A
   * live WebSocket / SSE tail is only available for the sandbox-scoped
   * variant — see {@link SandboxAudit.tail}.
   */
  async *tail(
    params: AuditTailParams = {},
  ): AsyncIterableIterator<EgressAuditEvent> {
    const pollMs = params.pollIntervalMs ?? 2000;
    let since: string | undefined = params.since;
    const seen = new Set<string>();
    while (true) {
      const queryParams: AuditListParams = { ...params };
      if (since !== undefined) queryParams.since = since;
      const data = await this.http.get<unknown>(
        "/egress/audit",
        listQuery(queryParams),
      );
      const events = unwrapList<EgressAuditEvent>(data);
      for (const event of events) {
        if (event.id && seen.has(event.id)) continue;
        if (event.id) seen.add(event.id);
        yield event;
        const ts = event.inserted_at ?? event.timestamp;
        if (typeof ts === "string") since = ts;
      }
      await sleep(pollMs);
    }
  }
}

// ── Resource-scoped wrappers ─────────────────────────────────────────────────

/**
 * Sandbox-bound view of {@link EgressAudit}. `list()` pre-scopes
 * `resource_id` + `resource_type="sandbox"`. `tail()` upgrades to the
 * per-sandbox SSE stream for sub-second tail latency.
 */
export class SandboxAudit {
  protected readonly resourceType: string = "sandbox";
  private readonly delegate: EgressAudit;

  constructor(
    protected readonly http: HttpClient,
    protected readonly resourceId: string,
  ) {
    this.delegate = new EgressAudit(http);
  }

  list(params: AuditListParams = {}): Promise<EgressAuditEvent[]> {
    return this.delegate.list({
      ...params,
      resource_id: params.resourceId ?? params.resource_id ?? this.resourceId,
      resource_type:
        params.resourceType ?? params.resource_type ?? this.resourceType,
    });
  }

  get(id: string): Promise<EgressAuditEvent> {
    return this.delegate.get(id);
  }

  /** SSE tail of the sandbox-scoped audit stream. */
  async *tail(
    params: AuditTailParams = {},
  ): AsyncIterableIterator<EgressAuditEvent> {
    const streamPath =
      this.resourceType === "sandbox"
        ? `/sandboxes/${this.resourceId}/audit/stream`
        : `/computers/${this.resourceId}/audit/stream`;
    try {
      const stream = this.http.stream<EgressAuditEvent>(streamPath, {
        method: "GET",
      });
      for await (const event of stream) {
        yield event;
      }
    } catch {
      // SSE endpoint unavailable — fall back to long-poll on the
      // tenant-wide endpoint with this resource pre-filtered.
      yield* this.delegate.tail({
        ...params,
        resource_id: this.resourceId,
        resource_type: this.resourceType,
      });
    }
  }
}

/** Computer-bound audit — same surface, `resource_type="computer"`. */
export class ComputerAudit extends SandboxAudit {
  protected readonly resourceType: string = "computer";
}
