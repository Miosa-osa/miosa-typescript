/**
 * ApiKeys resource — programmatic API key management.
 *
 * The plaintext key is returned ONLY at create time. Store it immediately;
 * the server only keeps a hash.
 */

import { randomUUID } from "node:crypto";

import type { HttpClient } from "../http.js";

// ── Branded IDs ──────────────────────────────────────────────────────────────

export type ApiKeyId = string & { readonly __brand: "ApiKeyId" };

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface ApiKeyData {
  id: ApiKeyId;
  tenant_id: string;
  name: string;
  prefix?: string;
  scopes?: string[];
  expires_at?: string | null;
  last_used_at?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

export interface ApiKeyCreateResult extends ApiKeyData {
  /** One-time plaintext key. Store immediately. */
  token?: string;
  key?: string;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface ApiKeyListParams {
  limit?: number;
  cursor?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface ApiKeyCreateParams {
  name: string;
  scopes?: string[];
  expires_at?: string;
  expiresAt?: string;
  idempotencyKey?: string;
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
  candidateKeys: string[] = ["data", "keys", "api_keys", "items"],
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

export class ApiKeys {
  constructor(private readonly http: HttpClient) {}

  async list(params: ApiKeyListParams = {}): Promise<ApiKeyData[]> {
    const query = stripUndefined({ ...params }) as Record<
      string,
      string | number | boolean | undefined
    >;
    const data = await this.http.get<unknown>("/api-keys", query);
    return listItems<ApiKeyData>(data);
  }

  async create(params: ApiKeyCreateParams): Promise<ApiKeyCreateResult> {
    const { idempotencyKey: ikey, expiresAt, ...rest } = params;
    const body = stripUndefined({
      ...rest,
      expires_at: expiresAt ?? rest.expires_at,
    });
    const data = await this.http.request<unknown>("/api-keys", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey(ikey) },
    });
    return unwrap<ApiKeyCreateResult>(data);
  }

  /** POST /api/v1/api-keys/scoped — L2 delegation token bound to one external user. */
  async createScoped(params: {
    externalUserId: string;
    scopes: string[];
    expiresAt?: string;
  }): Promise<ApiKeyCreateResult> {
    const body = stripUndefined({
      external_user_id: params.externalUserId,
      scopes: params.scopes,
      expires_at: params.expiresAt,
    });
    return unwrap<ApiKeyCreateResult>(
      await this.http.post<unknown>("/api-keys/scoped", body),
    );
  }

  async delete(keyId: string): Promise<void> {
    await this.http.delete<unknown>(`/api-keys/${keyId}`);
  }
}
