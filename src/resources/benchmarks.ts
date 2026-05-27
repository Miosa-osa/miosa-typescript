/**
 * Benchmarks — admin-triggered platform benchmark runs.
 *
 * Routes: /admin/benchmarks/*
 * Requires admin credential (msk_a_* / msk_p_* or admin JWT).
 * Available kinds: cold_boot, fleet_routing, concurrent_create, full_e2e.
 */

import type { HttpClient } from "../http.js";

export interface BenchmarkCreateParams {
  kind: string;
  [key: string]: unknown;
}

export interface BenchmarkCompareParams {
  left_id: string;
  right_id: string;
  [key: string]: unknown;
}

function unwrap(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["data", "benchmarks", "samples", "items"]) {
      if (k in d) return d[k] as Record<string, unknown>;
    }
  }
  return data as Record<string, unknown>;
}

function unwrapList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["data", "benchmarks", "samples", "items"]) {
      if (Array.isArray(d[k])) return d[k] as Record<string, unknown>[];
    }
  }
  return [];
}

export class Benchmarks {
  constructor(private readonly http: HttpClient) {}

  async list(
    filters: Record<string, string | number | boolean | undefined> = {},
  ): Promise<Record<string, unknown>[]> {
    const query = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined),
    ) as Record<string, string | number | boolean | undefined>;
    const data = await this.http.get<unknown>("/admin/benchmarks", query);
    return unwrapList(data);
  }

  async get(benchmarkId: string): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.get<unknown>(`/admin/benchmarks/${benchmarkId}`),
    );
  }

  /** Start a new benchmark run — pass kind and run-specific options. */
  async create(
    params: BenchmarkCreateParams,
  ): Promise<Record<string, unknown>> {
    const body = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined),
    );
    return unwrap(await this.http.post<unknown>("/admin/benchmarks", body));
  }

  async cancel(benchmarkId: string): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.post<unknown>(`/admin/benchmarks/${benchmarkId}/cancel`),
    );
  }

  /** Return per-iteration timing samples for a benchmark run. */
  async samples(
    benchmarkId: string,
    filters: Record<string, string | number | boolean | undefined> = {},
  ): Promise<Record<string, unknown>[]> {
    const query = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined),
    ) as Record<string, string | number | boolean | undefined>;
    const data = await this.http.get<unknown>(
      `/admin/benchmarks/${benchmarkId}/samples`,
      query,
    );
    return unwrapList(data);
  }

  /** Compare two benchmark runs. */
  async compare(
    params: BenchmarkCompareParams,
  ): Promise<Record<string, unknown>> {
    const body = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined),
    );
    return unwrap(
      await this.http.post<unknown>("/admin/benchmarks/compare", body),
    );
  }
}
