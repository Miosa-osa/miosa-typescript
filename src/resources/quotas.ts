/**
 * Quotas — per-external_user_id resource limits.
 * Corresponds to: GET/PUT/DELETE /api/v1/quotas/external/{external_user_id}
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface QuotaData {
  external_user_id: string;
  max_sandboxes?: number | null;
  max_concurrent?: number | null;
  max_storage_gb?: number | null;
  max_credit_cents?: number | null;
  usage?: {
    sandbox_count?: number;
    concurrent_count?: number;
    storage_gb?: number;
    credit_cents?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface QuotaSetParams {
  max_sandboxes?: number;
  max_concurrent?: number;
  max_storage_gb?: number;
  max_credit_cents?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in (payload as object)) {
    return (payload as { data: T }).data;
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

export class Quotas {
  constructor(private readonly http: HttpClient) {}

  /** GET /api/v1/quotas/external/{external_user_id} — current limits + usage. */
  async get(externalUserId: string): Promise<QuotaData> {
    return unwrap(
      await this.http.get<unknown>(`/quotas/external/${externalUserId}`),
    );
  }

  /** PUT /api/v1/quotas/external/{external_user_id} — set per-user limits. */
  async set(
    externalUserId: string,
    params: QuotaSetParams,
  ): Promise<QuotaData> {
    const body = stripUndefined(params as Record<string, unknown>);
    return unwrap(
      await this.http.put<unknown>(`/quotas/external/${externalUserId}`, body),
    );
  }

  /** DELETE /api/v1/quotas/external/{external_user_id} — revert to tenant default. */
  async delete(externalUserId: string): Promise<void> {
    await this.http.delete<unknown>(`/quotas/external/${externalUserId}`);
  }
}
