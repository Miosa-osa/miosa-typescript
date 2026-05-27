/**
 * Tenant — current tenant info and plan/usage.
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface TenantPlan {
  id?: string;
  name?: string;
  limits?: Record<string, unknown>;
  usage?: Record<string, unknown>;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["data", "tenant", "items"]) {
      if (k in p) return p[k] as T;
    }
  }
  return payload as T;
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class Tenant {
  constructor(private readonly http: HttpClient) {}

  /** Get the current tenant's plan, limits, and live usage counters. */
  async current(): Promise<TenantPlan> {
    const data = await this.http.get<unknown>("/tenant/plan");
    return unwrap<TenantPlan>(data);
  }
}
