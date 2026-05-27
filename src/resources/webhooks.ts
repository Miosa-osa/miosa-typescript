/**
 * Webhooks resource — tenant outgoing event delivery.
 */

import { randomUUID } from "node:crypto";

import type { HttpClient } from "../http.js";

// ── Branded IDs ──────────────────────────────────────────────────────────────

export type WebhookId = string & { readonly __brand: "WebhookId" };
export type WebhookDeliveryId = string & {
  readonly __brand: "WebhookDeliveryId";
};

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface WebhookData {
  id: WebhookId;
  tenant_id: string;
  url: string;
  events: string[];
  state?: string;
  secret?: string | null;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface WebhookDeliveryData {
  id: WebhookDeliveryId;
  webhook_id: WebhookId;
  event?: string;
  state?: string;
  response_status?: number | null;
  attempt_count?: number;
  next_retry_at?: string | null;
  delivered_at?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface WebhookListParams {
  limit?: number;
  cursor?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface WebhookCreateParams {
  url: string;
  events: string[];
  secret?: string;
  enabled?: boolean;
  idempotencyKey?: string;
  [key: string]: unknown;
}

export interface WebhookUpdateParams {
  url?: string;
  events?: string[];
  secret?: string;
  enabled?: boolean;
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
  candidateKeys: string[] = ["data", "webhooks", "deliveries", "items"],
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

export class Webhooks {
  constructor(private readonly http: HttpClient) {}

  async list(params: WebhookListParams = {}): Promise<WebhookData[]> {
    const query = stripUndefined({ ...params }) as Record<
      string,
      string | number | boolean | undefined
    >;
    const data = await this.http.get<unknown>("/webhooks", query);
    return listItems<WebhookData>(data);
  }

  async get(webhookId: string): Promise<WebhookData> {
    const data = await this.http.get<unknown>(`/webhooks/${webhookId}`);
    return unwrap<WebhookData>(data);
  }

  async create(params: WebhookCreateParams): Promise<WebhookData> {
    const { idempotencyKey: ikey, ...rest } = params;
    const body = stripUndefined(rest as Record<string, unknown>);
    const data = await this.http.request<unknown>("/webhooks", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey(ikey) },
    });
    return unwrap<WebhookData>(data);
  }

  async update(
    webhookId: string,
    params: WebhookUpdateParams,
  ): Promise<WebhookData> {
    const body = stripUndefined(params as Record<string, unknown>);
    const data = await this.http.patch<unknown>(`/webhooks/${webhookId}`, body);
    return unwrap<WebhookData>(data);
  }

  async delete(webhookId: string): Promise<void> {
    await this.http.delete<unknown>(`/webhooks/${webhookId}`);
  }

  async test(
    webhookId: string,
    opts: { idempotencyKey?: string } = {},
  ): Promise<Record<string, unknown>> {
    const data = await this.http.request<unknown>(
      `/webhooks/${webhookId}/test`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey(opts.idempotencyKey) },
      },
    );
    return unwrap<Record<string, unknown>>(data);
  }

  async deliveries(webhookId: string): Promise<WebhookDeliveryData[]> {
    const data = await this.http.get<unknown>(
      `/webhooks/${webhookId}/deliveries`,
    );
    return listItems<WebhookDeliveryData>(data, [
      "data",
      "deliveries",
      "items",
    ]);
  }
}
