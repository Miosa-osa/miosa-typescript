/**
 * CronJobs resource — scheduled work.
 */

import { randomUUID } from "node:crypto";

import type { HttpClient } from "../http.js";

// ── Branded IDs ──────────────────────────────────────────────────────────────

export type CronJobId = string & { readonly __brand: "CronJobId" };
export type CronJobExecutionId = string & {
  readonly __brand: "CronJobExecutionId";
};

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface CronJobData {
  id: CronJobId;
  tenant_id: string;
  name: string;
  schedule: string;
  state?: string;
  paused?: boolean;
  last_run_at?: string | null;
  next_run_at?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface CronJobExecutionData {
  id: CronJobExecutionId;
  cron_job_id: CronJobId;
  state?: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  exit_code?: number | null;
  error?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface CronJobListParams {
  limit?: number;
  cursor?: string;
  state?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface CronJobCreateParams {
  name: string;
  schedule: string;
  idempotencyKey?: string;
  [key: string]: unknown;
}

export interface CronJobUpdateParams {
  name?: string;
  schedule?: string;
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
  candidateKeys: string[] = ["data", "cron_jobs", "executions", "items"],
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

export class CronJobs {
  constructor(private readonly http: HttpClient) {}

  async list(params: CronJobListParams = {}): Promise<CronJobData[]> {
    const query = stripUndefined({ ...params }) as Record<
      string,
      string | number | boolean | undefined
    >;
    const data = await this.http.get<unknown>("/cron-jobs", query);
    return listItems<CronJobData>(data);
  }

  async get(jobId: string): Promise<CronJobData> {
    const data = await this.http.get<unknown>(`/cron-jobs/${jobId}`);
    return unwrap<CronJobData>(data);
  }

  async create(params: CronJobCreateParams): Promise<CronJobData> {
    const { idempotencyKey: ikey, ...rest } = params;
    const body = stripUndefined(rest as Record<string, unknown>);
    const data = await this.http.request<unknown>("/cron-jobs", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey(ikey) },
    });
    return unwrap<CronJobData>(data);
  }

  async update(
    jobId: string,
    params: CronJobUpdateParams,
  ): Promise<CronJobData> {
    const body = stripUndefined(params as Record<string, unknown>);
    const data = await this.http.patch<unknown>(`/cron-jobs/${jobId}`, body);
    return unwrap<CronJobData>(data);
  }

  async delete(jobId: string): Promise<void> {
    await this.http.delete<unknown>(`/cron-jobs/${jobId}`);
  }

  // ── Control ────────────────────────────────────────────────────────────────

  async pause(jobId: string): Promise<CronJobData> {
    const data = await this.http.post<unknown>(`/cron-jobs/${jobId}/pause`);
    return unwrap<CronJobData>(data);
  }

  async resume(jobId: string): Promise<CronJobData> {
    const data = await this.http.post<unknown>(`/cron-jobs/${jobId}/resume`);
    return unwrap<CronJobData>(data);
  }

  async runNow(
    jobId: string,
    opts: { idempotencyKey?: string } = {},
  ): Promise<CronJobData> {
    const data = await this.http.request<unknown>(
      `/cron-jobs/${jobId}/run-now`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey(opts.idempotencyKey) },
      },
    );
    return unwrap<CronJobData>(data);
  }

  // ── Execution history ──────────────────────────────────────────────────────

  async listExecutions(jobId: string): Promise<CronJobExecutionData[]> {
    const data = await this.http.get<unknown>(`/cron-jobs/${jobId}/executions`);
    return listItems<CronJobExecutionData>(data, [
      "data",
      "executions",
      "items",
    ]);
  }

  async getExecution(
    jobId: string,
    executionId: string,
  ): Promise<CronJobExecutionData> {
    const data = await this.http.get<unknown>(
      `/cron-jobs/${jobId}/executions/${executionId}`,
    );
    return unwrap<CronJobExecutionData>(data);
  }
}
