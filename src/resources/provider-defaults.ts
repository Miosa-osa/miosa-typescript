/**
 * ProviderDefaults — admin LLM provider routing config.
 *
 * Routes:
 *   GET  /admin/provider-defaults
 *   PUT  /admin/provider-defaults
 *   GET  /admin/tenants/:id/provider-config
 *   PUT  /admin/tenants/:id/provider-config
 *   DELETE /admin/tenants/:id/provider-config
 *
 * Requires admin credential (msk_a_* / msk_p_* or admin JWT).
 */

import type { HttpClient } from "../http.js";

function unwrap(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["data", "defaults", "provider_defaults", "config"]) {
      if (k in d) return d[k] as Record<string, unknown>;
    }
  }
  return data as Record<string, unknown>;
}

export class ProviderDefaults {
  constructor(private readonly http: HttpClient) {}

  /** Get the current fleet-wide provider defaults. */
  async list(): Promise<Record<string, unknown>> {
    return unwrap(await this.http.get<unknown>("/admin/provider-defaults"));
  }

  /** Return the defaults entry for a single provider, or {} if missing. */
  async get(provider: string): Promise<Record<string, unknown>> {
    const data = await this.list();
    const providers =
      (data.providers as Record<string, unknown> | undefined) ?? data;
    if (
      typeof providers === "object" &&
      providers !== null &&
      provider in providers
    ) {
      return providers[provider] as Record<string, unknown>;
    }
    return {};
  }

  /** Replace the fleet-wide defaults (PUT /admin/provider-defaults). */
  async update(
    opts: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const body = Object.fromEntries(
      Object.entries(opts).filter(([, v]) => v !== undefined),
    );
    return unwrap(
      await this.http.put<unknown>("/admin/provider-defaults", body),
    );
  }

  // ── Per-tenant overrides ────────────────────────────────────────────────

  async getTenant(tenantId: string): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.get<unknown>(
        `/admin/tenants/${tenantId}/provider-config`,
      ),
    );
  }

  async setTenant(
    tenantId: string,
    opts: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const body = Object.fromEntries(
      Object.entries(opts).filter(([, v]) => v !== undefined),
    );
    return unwrap(
      await this.http.put<unknown>(
        `/admin/tenants/${tenantId}/provider-config`,
        body,
      ),
    );
  }

  async resetTenant(tenantId: string): Promise<void> {
    await this.http.delete(`/admin/tenants/${tenantId}/provider-config`);
  }
}
