/**
 * Egress network — policies, allowlist, suggestions.
 *
 * Backed by:
 *   GET    /api/v1/egress/policies
 *   POST   /api/v1/egress/policies
 *   PATCH  /api/v1/egress/policies/:id   (or no id for tenant default)
 *
 *   GET    /api/v1/egress/allowlist
 *   POST   /api/v1/egress/allowlist
 *   DELETE /api/v1/egress/allowlist/:id
 *
 *   GET    /api/v1/egress/audit/suggestions
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export type EgressPolicyMode = "enforce" | "audit_only";
export type EgressRuleEffect = "allow" | "deny";

export interface EgressAllowlistRule {
  id: string;
  host: string;
  effect: EgressRuleEffect | string;
  methods?: string[];
  path_glob?: string | null;
  policy_id?: string | null;
  resource_id?: string | null;
  resource_type?: string | null;
  note?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

export interface EgressPolicyData {
  id: string;
  name?: string;
  mode: EgressPolicyMode | string;
  default_effect: EgressRuleEffect | string;
  description?: string | null;
  resource_id?: string | null;
  resource_type?: string | null;
  rules?: EgressAllowlistRule[];
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface EgressSuggestion {
  host: string;
  methods?: string[];
  path_glob?: string | null;
  count?: number;
  first_seen?: string;
  last_seen?: string;
  resource_id?: string | null;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface AllowParams {
  methods?: string[];
  pathGlob?: string;
  path_glob?: string;
  policyId?: string;
  policy_id?: string;
  resourceId?: string;
  resource_id?: string;
  resourceType?: string;
  resource_type?: string;
  note?: string;
}

export interface PolicyCreateParams {
  name: string;
  mode?: EgressPolicyMode | string;
  defaultEffect?: EgressRuleEffect | string;
  default_effect?: EgressRuleEffect | string;
  resourceId?: string;
  resource_id?: string;
  resourceType?: string;
  resource_type?: string;
  description?: string;
}

export interface PolicyUpdateParams {
  mode?: EgressPolicyMode | string;
  defaultEffect?: EgressRuleEffect | string;
  default_effect?: EgressRuleEffect | string;
  name?: string;
  description?: string;
}

export interface ModeParams {
  policyId?: string;
  policy_id?: string;
  resourceId?: string;
  resource_id?: string;
  resourceType?: string;
  resource_type?: string;
}

export interface SuggestionsParams {
  resourceId?: string;
  resource_id?: string;
  resourceType?: string;
  resource_type?: string;
  since?: string;
}

export interface PolicyListParams {
  resourceId?: string;
  resource_id?: string;
  resourceType?: string;
  resource_type?: string;
}

export interface RulesListParams {
  policyId?: string;
  policy_id?: string;
  resourceId?: string;
  resource_id?: string;
  resourceType?: string;
  resource_type?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface WireEnvelope<T> {
  data?: T;
  policy?: T;
  rule?: T;
  items?: T;
}

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["data", "policy", "rule", "items"]) {
      if (k in p) return p[k] as T;
    }
  }
  return payload as T;
}

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of [
      "data",
      "policies",
      "rules",
      "allowlist",
      "suggestions",
      "items",
    ]) {
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

function ruleBody(
  host: string,
  params: AllowParams,
  effect: EgressRuleEffect,
): Record<string, unknown> {
  return stripUndefined({
    host,
    effect,
    methods: params.methods,
    path_glob: pickFirst(params.pathGlob, params.path_glob),
    policy_id: pickFirst(params.policyId, params.policy_id),
    resource_id: pickFirst(params.resourceId, params.resource_id),
    resource_type: pickFirst(params.resourceType, params.resource_type),
    note: params.note,
  });
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class EgressNetwork {
  constructor(protected readonly http: HttpClient) {}

  // ── allowlist ─────────────────────────────────────────────────────────────

  /** Add an `allow` rule for `host` to the allowlist. */
  async allow(
    host: string,
    params: AllowParams = {},
  ): Promise<EgressAllowlistRule> {
    const data = await this.http.post<WireEnvelope<EgressAllowlistRule>>(
      "/egress/allowlist",
      ruleBody(host, params, "allow"),
    );
    return unwrap<EgressAllowlistRule>(data);
  }

  /** Add a `deny` rule for `host` to the allowlist. */
  async deny(
    host: string,
    params: AllowParams = {},
  ): Promise<EgressAllowlistRule> {
    const data = await this.http.post<WireEnvelope<EgressAllowlistRule>>(
      "/egress/allowlist",
      ruleBody(host, params, "deny"),
    );
    return unwrap<EgressAllowlistRule>(data);
  }

  /** List allowlist rules. */
  async rules(params: RulesListParams = {}): Promise<EgressAllowlistRule[]> {
    const query = stripUndefined({
      policy_id: pickFirst(params.policyId, params.policy_id),
      resource_id: pickFirst(params.resourceId, params.resource_id),
      resource_type: pickFirst(params.resourceType, params.resource_type),
    }) as Record<string, string | number | boolean | undefined>;
    const data = await this.http.get<unknown>("/egress/allowlist", query);
    return unwrapList<EgressAllowlistRule>(data);
  }

  /** Delete an allowlist rule by id. */
  async removeRule(ruleId: string): Promise<void> {
    await this.http.delete<unknown>(`/egress/allowlist/${ruleId}`);
  }

  // ── policies ──────────────────────────────────────────────────────────────

  /** List egress policies. */
  async policies(params: PolicyListParams = {}): Promise<EgressPolicyData[]> {
    const query = stripUndefined({
      resource_id: pickFirst(params.resourceId, params.resource_id),
      resource_type: pickFirst(params.resourceType, params.resource_type),
    }) as Record<string, string | number | boolean | undefined>;
    const data = await this.http.get<unknown>("/egress/policies", query);
    return unwrapList<EgressPolicyData>(data);
  }

  /** Create an egress policy. */
  async createPolicy(params: PolicyCreateParams): Promise<EgressPolicyData> {
    const body = stripUndefined({
      name: params.name,
      mode: params.mode ?? "enforce",
      default_effect: pickFirst(
        params.defaultEffect,
        params.default_effect,
        "deny" as EgressRuleEffect,
      ),
      resource_id: pickFirst(params.resourceId, params.resource_id),
      resource_type: pickFirst(params.resourceType, params.resource_type),
      description: params.description,
    });
    const data = await this.http.post<WireEnvelope<EgressPolicyData>>(
      "/egress/policies",
      body,
    );
    return unwrap<EgressPolicyData>(data);
  }

  /** Update an egress policy by id. */
  async updatePolicy(
    policyId: string,
    params: PolicyUpdateParams,
  ): Promise<EgressPolicyData> {
    const body = stripUndefined({
      mode: params.mode,
      default_effect: pickFirst(params.defaultEffect, params.default_effect),
      name: params.name,
      description: params.description,
    });
    const data = await this.http.patch<WireEnvelope<EgressPolicyData>>(
      `/egress/policies/${policyId}`,
      body,
    );
    return unwrap<EgressPolicyData>(data);
  }

  // ── mode helpers ──────────────────────────────────────────────────────────

  /** Set the policy to `mode="enforce"` — denied egress is blocked. */
  async lockdown(params: ModeParams = {}): Promise<EgressPolicyData> {
    return this.setMode("enforce", params);
  }

  /** Set the policy to `mode="audit_only"` — log but do not block. */
  async observe(params: ModeParams = {}): Promise<EgressPolicyData> {
    return this.setMode("audit_only", params);
  }

  private async setMode(
    mode: EgressPolicyMode,
    params: ModeParams,
  ): Promise<EgressPolicyData> {
    const policyId = pickFirst(params.policyId, params.policy_id);
    const resourceId = pickFirst(params.resourceId, params.resource_id);
    const resourceType = pickFirst(params.resourceType, params.resource_type);

    if (policyId) {
      return this.updatePolicy(policyId, { mode });
    }

    const body =
      resourceId !== undefined && resourceType !== undefined
        ? stripUndefined({
            mode,
            resource_id: resourceId,
            resource_type: resourceType,
          })
        : { mode };
    const data = await this.http.patch<WireEnvelope<EgressPolicyData>>(
      "/egress/policies",
      body,
    );
    return unwrap<EgressPolicyData>(data);
  }

  // ── suggestions ───────────────────────────────────────────────────────────

  /** AI-generated allowlist suggestions from recent denied egress. */
  async suggestions(
    params: SuggestionsParams = {},
  ): Promise<EgressSuggestion[]> {
    const query = stripUndefined({
      resource_id: pickFirst(params.resourceId, params.resource_id),
      resource_type: pickFirst(params.resourceType, params.resource_type),
      since: params.since ?? "7d",
    }) as Record<string, string | number | boolean | undefined>;
    const data = await this.http.get<unknown>(
      "/egress/audit/suggestions",
      query,
    );
    return unwrapList<EgressSuggestion>(data);
  }
}

// ── Resource-scoped wrappers ─────────────────────────────────────────────────

/**
 * Sandbox-bound view of {@link EgressNetwork}. Pre-scopes
 * `resource_id` + `resource_type="sandbox"` on every call.
 */
export class SandboxNetwork {
  protected readonly resourceType: string = "sandbox";
  private readonly delegate: EgressNetwork;

  constructor(
    http: HttpClient,
    protected readonly resourceId: string,
  ) {
    this.delegate = new EgressNetwork(http);
  }

  private resolvedResourceId(params: {
    resourceId?: string;
    resource_id?: string;
  }): string {
    return params.resourceId ?? params.resource_id ?? this.resourceId;
  }

  private resolvedResourceType(params: {
    resourceType?: string;
    resource_type?: string;
  }): string {
    return params.resourceType ?? params.resource_type ?? this.resourceType;
  }

  allow(host: string, params: AllowParams = {}): Promise<EgressAllowlistRule> {
    return this.delegate.allow(host, {
      ...params,
      resource_id: this.resolvedResourceId(params),
      resource_type: this.resolvedResourceType(params),
    });
  }

  deny(host: string, params: AllowParams = {}): Promise<EgressAllowlistRule> {
    return this.delegate.deny(host, {
      ...params,
      resource_id: this.resolvedResourceId(params),
      resource_type: this.resolvedResourceType(params),
    });
  }

  rules(params: RulesListParams = {}): Promise<EgressAllowlistRule[]> {
    return this.delegate.rules({
      ...params,
      resource_id: this.resolvedResourceId(params),
      resource_type: this.resolvedResourceType(params),
    });
  }

  removeRule(ruleId: string): Promise<void> {
    return this.delegate.removeRule(ruleId);
  }

  lockdown(params: { policyId?: string } = {}): Promise<EgressPolicyData> {
    const body: ModeParams = {
      resource_id: this.resourceId,
      resource_type: this.resourceType,
    };
    if (params.policyId !== undefined) body.policyId = params.policyId;
    return this.delegate.lockdown(body);
  }

  observe(params: { policyId?: string } = {}): Promise<EgressPolicyData> {
    const body: ModeParams = {
      resource_id: this.resourceId,
      resource_type: this.resourceType,
    };
    if (params.policyId !== undefined) body.policyId = params.policyId;
    return this.delegate.observe(body);
  }

  suggestions(params: { since?: string } = {}): Promise<EgressSuggestion[]> {
    const body: SuggestionsParams = {
      resource_id: this.resourceId,
      resource_type: this.resourceType,
    };
    if (params.since !== undefined) body.since = params.since;
    return this.delegate.suggestions(body);
  }

  policies(): Promise<EgressPolicyData[]> {
    return this.delegate.policies({
      resource_id: this.resourceId,
      resource_type: this.resourceType,
    });
  }
}

/** Computer-bound network — same surface, `resource_type="computer"`. */
export class ComputerNetwork extends SandboxNetwork {
  protected readonly resourceType: string = "computer";
}
