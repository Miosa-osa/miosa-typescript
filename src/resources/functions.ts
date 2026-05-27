/**
 * Functions resource — serverless edge functions.
 */

import { randomUUID } from "node:crypto";

import type { HttpClient } from "../http.js";

// ── Branded IDs ──────────────────────────────────────────────────────────────

export type FunctionId = string & { readonly __brand: "FunctionId" };

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface FunctionData {
  id: FunctionId;
  tenant_id: string;
  name: string;
  state?: string;
  runtime?: string | null;
  handler?: string | null;
  memory_mb?: number | null;
  timeout_sec?: number | null;
  env?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface FunctionListParams {
  limit?: number;
  cursor?: string;
  state?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface FunctionCreateParams {
  name: string;
  runtime?: string;
  handler?: string;
  memory_mb?: number;
  memoryMb?: number;
  timeout_sec?: number;
  timeoutSec?: number;
  env?: Record<string, string>;
  idempotencyKey?: string;
  [key: string]: unknown;
}

export interface FunctionUpdateParams {
  name?: string;
  runtime?: string;
  handler?: string;
  memory_mb?: number;
  memoryMb?: number;
  timeout_sec?: number;
  timeoutSec?: number;
  env?: Record<string, string>;
  [key: string]: unknown;
}

export interface FunctionInvokeParams {
  payload?: Record<string, unknown>;
  headers?: Record<string, string>;
  idempotencyKey?: string;
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
  candidateKeys: string[] = ["data", "functions", "items"],
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

export class Functions {
  constructor(private readonly http: HttpClient) {}

  async list(params: FunctionListParams = {}): Promise<FunctionData[]> {
    const query = stripUndefined({ ...params }) as Record<
      string,
      string | number | boolean | undefined
    >;
    const data = await this.http.get<unknown>("/functions", query);
    return listItems<FunctionData>(data);
  }

  async get(functionId: string): Promise<FunctionData> {
    const data = await this.http.get<unknown>(`/functions/${functionId}`);
    return unwrap<FunctionData>(data);
  }

  async create(params: FunctionCreateParams): Promise<FunctionData> {
    const { idempotencyKey: ikey, memoryMb, timeoutSec, ...rest } = params;
    const body = stripUndefined({
      ...rest,
      memory_mb: memoryMb ?? rest.memory_mb,
      timeout_sec: timeoutSec ?? rest.timeout_sec,
    });
    const data = await this.http.request<unknown>("/functions", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey(ikey) },
    });
    return unwrap<FunctionData>(data);
  }

  async update(
    functionId: string,
    params: FunctionUpdateParams,
  ): Promise<FunctionData> {
    const { memoryMb, timeoutSec, ...rest } = params;
    const body = stripUndefined({
      ...rest,
      memory_mb: memoryMb ?? rest.memory_mb,
      timeout_sec: timeoutSec ?? rest.timeout_sec,
    });
    const data = await this.http.patch<unknown>(
      `/functions/${functionId}`,
      body,
    );
    return unwrap<FunctionData>(data);
  }

  async delete(functionId: string): Promise<void> {
    await this.http.delete<unknown>(`/functions/${functionId}`);
  }

  async invoke(
    functionId: string,
    params: FunctionInvokeParams = {},
  ): Promise<Record<string, unknown>> {
    const { payload = {}, headers, idempotencyKey: ikey } = params;
    const data = await this.http.request<unknown>(
      `/functions/${functionId}/invoke`,
      {
        method: "POST",
        body: payload,
        headers: {
          "Idempotency-Key": idempotencyKey(ikey),
          ...headers,
        },
      },
    );
    return (data ?? {}) as Record<string, unknown>;
  }
}
