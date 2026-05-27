/**
 * HealthChecks resource — uptime monitoring.
 */

import { randomUUID } from "node:crypto";

import type { HttpClient } from "../http.js";

// ── Branded IDs ──────────────────────────────────────────────────────────────

export type HealthCheckId = string & { readonly __brand: "HealthCheckId" };

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface HealthCheckData {
  id: HealthCheckId;
  tenant_id: string;
  name: string;
  url: string;
  state?: string;
  interval_sec?: number;
  timeout_sec?: number;
  method?: string;
  expected_status?: number | null;
  last_checked_at?: string | null;
  last_status?: "up" | "down" | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface HealthCheckListParams {
  limit?: number;
  cursor?: string;
  state?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface HealthCheckCreateParams {
  name: string;
  url: string;
  interval_sec?: number;
  intervalSec?: number;
  timeout_sec?: number;
  timeoutSec?: number;
  method?: string;
  expected_status?: number;
  expectedStatus?: number;
  idempotencyKey?: string;
  [key: string]: unknown;
}

export interface HealthCheckUpdateParams {
  name?: string;
  url?: string;
  interval_sec?: number;
  intervalSec?: number;
  timeout_sec?: number;
  timeoutSec?: number;
  method?: string;
  expected_status?: number;
  expectedStatus?: number;
  [key: string]: unknown;
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
  candidateKeys: string[] = ["data", "health_checks", "items"],
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

export class HealthChecks {
  constructor(private readonly http: HttpClient) {}

  async list(params: HealthCheckListParams = {}): Promise<HealthCheckData[]> {
    const query = stripUndefined({ ...params }) as Record<
      string,
      string | number | boolean | undefined
    >;
    const data = await this.http.get<unknown>("/health-checks", query);
    return listItems<HealthCheckData>(data);
  }

  async get(checkId: string): Promise<HealthCheckData> {
    const data = await this.http.get<unknown>(`/health-checks/${checkId}`);
    return unwrap<HealthCheckData>(data);
  }

  async create(params: HealthCheckCreateParams): Promise<HealthCheckData> {
    const {
      idempotencyKey: ikey,
      intervalSec,
      timeoutSec,
      expectedStatus,
      ...rest
    } = params;
    const body = stripUndefined({
      ...rest,
      interval_sec: intervalSec ?? rest.interval_sec,
      timeout_sec: timeoutSec ?? rest.timeout_sec,
      expected_status: expectedStatus ?? rest.expected_status,
    });
    const data = await this.http.request<unknown>("/health-checks", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey(ikey) },
    });
    return unwrap<HealthCheckData>(data);
  }

  async update(
    checkId: string,
    params: HealthCheckUpdateParams,
  ): Promise<HealthCheckData> {
    const { intervalSec, timeoutSec, expectedStatus, ...rest } = params;
    const body = stripUndefined({
      ...rest,
      interval_sec: intervalSec ?? rest.interval_sec,
      timeout_sec: timeoutSec ?? rest.timeout_sec,
      expected_status: expectedStatus ?? rest.expected_status,
    });
    const data = await this.http.patch<unknown>(
      `/health-checks/${checkId}`,
      body,
    );
    return unwrap<HealthCheckData>(data);
  }

  async delete(checkId: string): Promise<void> {
    await this.http.delete<unknown>(`/health-checks/${checkId}`);
  }
}
