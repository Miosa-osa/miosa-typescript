/**
 * Usage — per-session metering, summary, and reports.
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface UsageSummary {
  period_start?: string;
  period_end?: string;
  total_credits?: number;
  [key: string]: unknown;
}

export interface UsageSession {
  id?: string;
  computer_id?: string;
  started_at?: string;
  ended_at?: string;
  credits_used?: number;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface UsageSessionsParams {
  computer_id?: string;
  limit?: number;
  cursor?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface UsageReportParams extends UsageSessionsParams {
  period_start?: string;
  period_end?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["data", "usage", "sessions", "summary", "items"]) {
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

export class Usage {
  constructor(private readonly http: HttpClient) {}

  /** Get the current period usage summary. */
  async current(): Promise<UsageSummary> {
    const data = await this.http.get<unknown>("/usage/summary");
    return unwrap<UsageSummary>(data);
  }

  /** List per-session metering events. */
  async sessions(params: UsageSessionsParams = {}): Promise<UsageSession[]> {
    const query = stripUndefined(params as Record<string, unknown>);
    const data = await this.http.get<unknown>("/usage/sessions", query);
    const result = unwrap<UsageSession[] | unknown>(data);
    if (Array.isArray(result)) return result;
    return [];
  }

  /** Get a usage report for a period. */
  async report(params: UsageReportParams = {}): Promise<UsageSummary> {
    const query = stripUndefined(params as Record<string, unknown>);
    const data = await this.http.get<unknown>("/usage/summary", query);
    return unwrap<UsageSummary>(data);
  }
}
