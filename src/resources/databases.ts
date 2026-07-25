/**
 * Databases resource — managed Postgres / databases.
 */

import { randomUUID } from "node:crypto";

import type { HttpClient } from "../http.js";

// ── Branded IDs ──────────────────────────────────────────────────────────────

export type DatabaseId = string & { readonly __brand: "DatabaseId" };

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface DatabaseData {
  id: DatabaseId;
  tenant_id: string;
  environment_id?: string | null;
  name: string;
  state?: string;
  engine?: string;
  engine_version?: string;
  version?: string;
  cpu_count?: number;
  memory_mb?: number;
  storage_mb?: number;
  host?: string | null;
  port?: number | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface DatabaseCredentials {
  url?: string;
  host?: string;
  port?: number;
  user?: string;
  username?: string;
  password?: string;
  database?: string;
  [key: string]: unknown;
}

export interface DatabaseLogsResult {
  lines?: string[];
  logs?: string[];
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface DatabaseListParams {
  limit?: number;
  cursor?: string;
  state?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface DatabaseCreateParams {
  name: string;
  engine?: string;
  engine_version?: string;
  cpu_count?: number;
  memory_mb?: number;
  storage_mb?: number;
  external_workspace_id?: string;
  external_user_id?: string;
  external_project_id?: string;
  metadata?: Record<string, unknown>;
  /** @deprecated use engine_version. */
  version?: string;
  /** @deprecated use cpu_count/memory_mb/storage_mb. */
  size?: string;
  region?: string;
  workspace_id?: string;
  project_id?: string;
  environment_id?: string;
  idempotencyKey?: string;
  idempotency_key?: string;
  [key: string]: unknown;
}

export interface DatabaseLogsParams {
  lines?: number;
  since?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in (payload as object)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function listItems<T>(
  payload: unknown,
  candidateKeys: string[] = ["data", "databases", "items"],
): T[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  if (Array.isArray(p.data)) return p.data as T[];
  for (const key of candidateKeys) {
    if (Array.isArray(p[key])) return p[key] as T[];
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

function idempotencyKey(key?: string): string {
  return key ?? randomUUID();
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class Databases {
  constructor(private readonly http: HttpClient) {}

  async list(params: DatabaseListParams = {}): Promise<DatabaseData[]> {
    const query = stripUndefined({ ...params }) as Record<
      string,
      string | number | boolean | undefined
    >;
    const data = await this.http.get<unknown>("/databases", query);
    return listItems<DatabaseData>(data);
  }

  async get(databaseId: string): Promise<DatabaseData> {
    const data = await this.http.get<unknown>(`/databases/${databaseId}`);
    return unwrap<DatabaseData>(data);
  }

  async create(params: DatabaseCreateParams): Promise<DatabaseData> {
    const {
      idempotencyKey: camelIdempotencyKey,
      idempotency_key: snakeIdempotencyKey,
      version,
      engine_version,
      size: _deprecatedSize,
      ...rest
    } = params;

    const body = stripUndefined({
      ...rest,
      engine_version: engine_version ?? version,
    } as Record<string, unknown>);

    const data = await this.http.request<unknown>("/databases", {
      method: "POST",
      body,
      headers: {
        "Idempotency-Key": idempotencyKey(
          camelIdempotencyKey ?? snakeIdempotencyKey,
        ),
      },
    });
    return unwrap<DatabaseData>(data);
  }

  async delete(databaseId: string): Promise<void> {
    await this.http.delete<unknown>(`/databases/${databaseId}`);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(databaseId: string): Promise<DatabaseData> {
    const data = await this.http.post<unknown>(
      `/databases/${databaseId}/start`,
    );
    return unwrap<DatabaseData>(data);
  }

  async stop(databaseId: string): Promise<DatabaseData> {
    const data = await this.http.post<unknown>(`/databases/${databaseId}/stop`);
    return unwrap<DatabaseData>(data);
  }

  async restart(databaseId: string): Promise<DatabaseData> {
    const data = await this.http.post<unknown>(
      `/databases/${databaseId}/restart`,
    );
    return unwrap<DatabaseData>(data);
  }

  // ── Credentials + logs ────────────────────────────────────────────────────

  async credentials(databaseId: string): Promise<DatabaseCredentials> {
    const data = await this.http.get<unknown>(
      `/databases/${databaseId}/credentials`,
    );
    return unwrap<DatabaseCredentials>(data);
  }

  async logs(
    databaseId: string,
    params: DatabaseLogsParams = {},
  ): Promise<DatabaseLogsResult> {
    const query = stripUndefined({
      lines: params.lines,
      since: params.since,
    }) as Record<string, string | number | boolean | undefined>;
    const data = await this.http.get<unknown>(
      `/databases/${databaseId}/logs`,
      query,
    );
    return data as DatabaseLogsResult;
  }

  streamLogs(databaseId: string): AsyncIterableIterator<unknown> {
    return this.http.stream<unknown>(`/databases/${databaseId}/logs/stream`);
  }
}
