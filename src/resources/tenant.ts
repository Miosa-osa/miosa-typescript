/**
 * Tenant — current tenant info and plan/usage.
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface TenantPlan {
  id?: string;
  name?: string;
  limits?: Record<string, unknown>;
  usage?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PreviewDomainData {
  preview_domain?: string | null;
  default_domain?: string;
  status?: string;
  dns_status?: string;
  cname_target?: string | null;
  dns_instructions?: unknown;
  [key: string]: unknown;
}

export interface TenantBrandingUpdateParams {
  product_name?: string;
  logo_url?: string;
  support_url?: string;
  support_email?: string;
  primary_color?: string;
  background_color?: string;
  [key: string]: unknown;
}

export type BrandingData = TenantBrandingUpdateParams;

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["data", "tenant", "branding", "items"]) {
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

export class PreviewDomain {
  constructor(private readonly http: HttpClient) {}

  /** Get the tenant's white-label preview domain settings. */
  async get(): Promise<PreviewDomainData> {
    const data = await this.http.get<unknown>("/tenant/preview-domain");
    return unwrap<PreviewDomainData>(data);
  }

  /** Set the tenant's white-label preview domain. */
  async set(domain: string): Promise<PreviewDomainData> {
    const data = await this.http.put<unknown>("/tenant/preview-domain", {
      preview_domain: domain,
    });
    return unwrap<PreviewDomainData>(data);
  }

  /** Re-run DNS verification for the configured preview domain. */
  async verify(): Promise<PreviewDomainData> {
    const data = await this.http.post<unknown>(
      "/tenant/preview-domain/verify",
      {},
    );
    return unwrap<PreviewDomainData>(data);
  }

  /** Remove the tenant's custom preview domain. */
  async delete(): Promise<void> {
    await this.http.delete<unknown>("/tenant/preview-domain");
  }
}

export class Branding {
  constructor(private readonly http: HttpClient) {}

  /** Get tenant branding used by white-label hosted surfaces. */
  async get(): Promise<BrandingData> {
    const data = await this.http.get<unknown>("/tenant/branding");
    return unwrap<BrandingData>(data);
  }

  /** Update tenant branding used by white-label hosted surfaces. */
  async set(params: TenantBrandingUpdateParams): Promise<BrandingData> {
    const data = await this.http.put<unknown>("/tenant/branding", {
      branding: stripUndefined(params),
    });
    return unwrap<BrandingData>(data);
  }

  /** Reset tenant branding to platform defaults. */
  async delete(): Promise<void> {
    await this.http.delete<unknown>("/tenant/branding");
  }
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class Tenant {
  readonly preview_domain: PreviewDomain;
  readonly branding: Branding;
  /** camelCase alias for SDK consumers that avoid snake_case properties. */
  readonly previewDomain: PreviewDomain;

  constructor(private readonly http: HttpClient) {
    this.preview_domain = new PreviewDomain(http);
    this.previewDomain = this.preview_domain;
    this.branding = new Branding(http);
  }

  /** Get the current tenant's plan, limits, and live usage counters. */
  async current(): Promise<TenantPlan> {
    const data = await this.http.get<unknown>("/tenant/plan");
    return unwrap<TenantPlan>(data);
  }

  /** Convenience alias for `tenant.branding.get()`. */
  async getBranding(): Promise<BrandingData> {
    return this.branding.get();
  }

  /** Convenience alias for `tenant.branding.set(...)`. */
  async setBranding(
    params: TenantBrandingUpdateParams,
  ): Promise<BrandingData> {
    return this.branding.set(params);
  }

  /** Convenience alias for `tenant.branding.delete()`. */
  async deleteBranding(): Promise<void> {
    await this.branding.delete();
  }
}
