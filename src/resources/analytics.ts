/**
 * Analytics — overview + timeseries (admin scope).
 */

import type { HttpClient } from "../http.js";

// ── Request payloads ─────────────────────────────────────────────────────────

export interface AnalyticsFilters {
  [key: string]: string | number | boolean | undefined;
}

export interface TimeseriesParams extends AnalyticsFilters {
  metric?: string;
  period?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["data", "analytics", "series", "items"]) {
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

export class Analytics {
  constructor(private readonly http: HttpClient) {}

  /** Get the platform analytics overview. */
  async overview(
    filters: AnalyticsFilters = {},
  ): Promise<Record<string, unknown>> {
    const query = stripUndefined(filters as Record<string, unknown>);
    const data = await this.http.get<unknown>("/analytics/overview", query);
    return unwrap<Record<string, unknown>>(data);
  }

  /** Get a timeseries for a metric over a period. */
  async timeseries(
    params: TimeseriesParams = {},
  ): Promise<Record<string, unknown>> {
    const query = stripUndefined(params as Record<string, unknown>);
    const data = await this.http.get<unknown>("/analytics/timeseries", query);
    return unwrap<Record<string, unknown>>(data);
  }
}
