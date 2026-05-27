/**
 * Audit log — admin-scoped event history.
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface AuditLogEvent {
  id?: string;
  action?: string;
  actor_id?: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  inserted_at?: string;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface AuditLogListParams {
  action?: string;
  actor_id?: string;
  resource_type?: string;
  limit?: number;
  cursor?: string;
  [key: string]: string | number | boolean | undefined;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["data", "audit_log", "events", "items"]) {
      if (k in p) return p[k] as T;
    }
  }
  return payload as T;
}

function stripUndefined(
  input: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  ) as Record<string, string | number | boolean | undefined>;
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class AuditLog {
  constructor(private readonly http: HttpClient) {}

  /** List audit-log events with optional filters. */
  async list(params: AuditLogListParams = {}): Promise<AuditLogEvent[]> {
    const query = stripUndefined(params as Record<string, unknown>);
    const data = await this.http.get<unknown>("/audit-log", query);
    const result = unwrap<AuditLogEvent[] | unknown>(data);
    if (Array.isArray(result)) return result;
    return [];
  }
}
