/**
 * Settings — tenant config, branding, BYOK provider keys.
 */

import type { HttpClient } from "../http.js";

// ── Request payloads ─────────────────────────────────────────────────────────

export interface SettingsUpdateParams {
  [key: string]: unknown;
}

export interface BrandingUpdateParams {
  logo_url?: string;
  primary_color?: string;
  wordmark?: string;
  [key: string]: unknown;
}

export interface ProviderKeyUpsertParams {
  key: string;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of [
      "data",
      "settings",
      "branding",
      "provider_keys",
      "items",
    ]) {
      if (k in p) return p[k] as T;
    }
  }
  return payload as T;
}

function listItems<T>(payload: unknown): T[] {
  const result = unwrap<T[] | unknown>(payload);
  if (Array.isArray(result)) return result;
  return [];
}

function stripUndefined(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  );
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class Settings {
  constructor(private readonly http: HttpClient) {}

  /** Get the current tenant settings. */
  async get(): Promise<Record<string, unknown>> {
    const data = await this.http.get<unknown>("/settings");
    return unwrap<Record<string, unknown>>(data);
  }

  /** Update tenant settings. */
  async update(params: SettingsUpdateParams): Promise<Record<string, unknown>> {
    const body = stripUndefined(params as Record<string, unknown>);
    const data = await this.http.put<unknown>("/settings", body);
    return unwrap<Record<string, unknown>>(data);
  }

  // ── Branding ──────────────────────────────────────────────────────────────

  /** Get tenant branding (logo, colors, custom wordmark). */
  async getBranding(): Promise<Record<string, unknown>> {
    const data = await this.http.get<unknown>("/settings/branding");
    return unwrap<Record<string, unknown>>(data);
  }

  /** Update tenant branding. */
  async updateBranding(
    params: BrandingUpdateParams,
  ): Promise<Record<string, unknown>> {
    const body = stripUndefined(params as Record<string, unknown>);
    const data = await this.http.put<unknown>("/settings/branding", body);
    return unwrap<Record<string, unknown>>(data);
  }

  // ── Read-only reference data ───────────────────────────────────────────────

  /** Get tenant-scoped compute pricing. */
  async computePricing(): Promise<unknown> {
    const data = await this.http.get<unknown>("/settings/compute-pricing");
    return unwrap(data);
  }

  /** Get tenant-scoped GPU pricing. */
  async gpuPricing(): Promise<unknown> {
    const data = await this.http.get<unknown>("/settings/gpu-pricing");
    return unwrap(data);
  }

  /** List models available to this tenant. */
  async availableModels(): Promise<unknown> {
    const data = await this.http.get<unknown>("/settings/available-models");
    return unwrap(data);
  }

  /** List regions enabled for this tenant. */
  async regions(): Promise<unknown> {
    const data = await this.http.get<unknown>("/settings/regions");
    return unwrap(data);
  }

  // ── BYOK provider keys ────────────────────────────────────────────────────

  /** List tenant-level BYOK provider keys (Anthropic, OpenAI, etc.). */
  async listProviderKeys(): Promise<Record<string, unknown>[]> {
    const data = await this.http.get<unknown>("/settings/provider-keys");
    return listItems<Record<string, unknown>>(data);
  }

  /** Create or update a BYOK provider key. */
  async upsertProviderKey(
    provider: string,
    params: ProviderKeyUpsertParams,
  ): Promise<Record<string, unknown>> {
    const body = stripUndefined(params as Record<string, unknown>);
    const data = await this.http.put<unknown>(
      `/settings/provider-keys/${provider}`,
      body,
    );
    return unwrap<Record<string, unknown>>(data);
  }

  /** Delete a BYOK provider key. */
  async deleteProviderKey(provider: string): Promise<void> {
    await this.http.delete<unknown>(`/settings/provider-keys/${provider}`);
  }
}
