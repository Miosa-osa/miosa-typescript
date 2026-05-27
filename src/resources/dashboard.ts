/**
 * Dashboard — aggregated platform overview.
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface DashboardSummary {
  computers?: unknown;
  sandboxes?: unknown;
  credits?: unknown;
  [key: string]: unknown;
}

export interface OverviewData {
  status?: string;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["data", "dashboard", "overview", "items"]) {
      if (k in p) return p[k] as T;
    }
  }
  return payload as T;
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class Dashboard {
  constructor(private readonly http: HttpClient) {}

  /** Aggregated user dashboard payload. */
  async summary(): Promise<DashboardSummary> {
    const data = await this.http.get<unknown>("/dashboard");
    return unwrap<DashboardSummary>(data);
  }

  /** Status / health overview (public endpoint). */
  async overview(): Promise<OverviewData> {
    const data = await this.http.get<unknown>("/overview");
    return unwrap<OverviewData>(data);
  }
}
