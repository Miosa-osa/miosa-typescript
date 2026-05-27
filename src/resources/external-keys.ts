/**
 * External keys — BYOK encrypted per-user provider keys.
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface ExternalKeyData {
  provider?: string;
  masked_key?: string;
  created_at?: string;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface ExternalKeyCreateParams {
  provider: string;
  key: string;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["data", "external_keys", "items"]) {
      if (k in p) return p[k] as T;
    }
  }
  return payload as T;
}

function stripUndefined(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  );
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class ExternalKeys {
  constructor(private readonly http: HttpClient) {}

  /** List configured external keys. */
  async list(): Promise<ExternalKeyData[]> {
    const data = await this.http.get<unknown>("/external-keys");
    const result = unwrap<ExternalKeyData[] | unknown>(data);
    if (Array.isArray(result)) return result;
    return [];
  }

  /** Create / register an external provider key. */
  async create(params: ExternalKeyCreateParams): Promise<ExternalKeyData> {
    const body = stripUndefined(params as Record<string, unknown>);
    const data = await this.http.post<unknown>("/external-keys", body);
    return unwrap<ExternalKeyData>(data);
  }

  /** Resolve (preview) the stored key for a provider. */
  async resolve(provider: string): Promise<ExternalKeyData> {
    const data = await this.http.get<unknown>(
      `/external-keys/${provider}/resolve`,
    );
    return unwrap<ExternalKeyData>(data);
  }

  /**
   * Delete the stored key for a provider.
   * Keys are addressed by provider name, not by id.
   */
  async delete(provider: string): Promise<void> {
    await this.http.delete<unknown>(`/external-keys/${provider}`);
  }
}
