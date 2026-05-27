/**
 * FlatCustomDomains resource — tenant-scoped custom domains at /custom-domains.
 *
 * The per-computer and per-deployment domain APIs live on those resources;
 * this is the flat tenant-level list view for white-label platforms managing
 * many domains across all resources.
 */

import { randomUUID } from "node:crypto";

import type { HttpClient } from "../http.js";

// ── Branded IDs ──────────────────────────────────────────────────────────────

export type CustomDomainId = string & { readonly __brand: "CustomDomainId" };

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface CustomDomainData {
  id: CustomDomainId;
  tenant_id: string;
  domain: string;
  state?: string;
  resource_type?: string | null;
  resource_id?: string | null;
  verified?: boolean;
  verification_token?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface CustomDomainListParams {
  limit?: number;
  cursor?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface CustomDomainCreateParams {
  domain: string;
  resource_type?: string;
  resourceType?: string;
  resource_id?: string;
  resourceId?: string;
  redirect_policy?: "none" | "www_to_apex" | "apex_to_www";
  redirectPolicy?: "none" | "www_to_apex" | "apex_to_www";
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
  candidateKeys: string[] = ["data", "domains", "items"],
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

export class FlatCustomDomains {
  constructor(private readonly http: HttpClient) {}

  async list(params: CustomDomainListParams = {}): Promise<CustomDomainData[]> {
    const query = stripUndefined({ ...params }) as Record<
      string,
      string | number | boolean | undefined
    >;
    const data = await this.http.get<unknown>("/custom-domains", query);
    return listItems<CustomDomainData>(data);
  }

  async create(params: CustomDomainCreateParams): Promise<CustomDomainData> {
    const {
      idempotencyKey: ikey,
      resourceType,
      resourceId,
      redirectPolicy,
      ...rest
    } = params;
    const body = stripUndefined({
      ...rest,
      resource_type: resourceType ?? rest.resource_type,
      resource_id: resourceId ?? rest.resource_id,
      redirect_policy: redirectPolicy ?? rest.redirect_policy,
    });
    const data = await this.http.request<unknown>("/custom-domains", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey(ikey) },
    });
    return unwrap<CustomDomainData>(data);
  }

  async delete(domainId: string): Promise<void> {
    await this.http.delete<unknown>(`/custom-domains/${domainId}`);
  }
}
