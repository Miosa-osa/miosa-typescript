import type { HttpClient } from "../http.js";

// ─── Custom Domains ───────────────────────────────────────────────────────────

export type CustomDomainStatus =
  | "pending"
  | "verified"
  | "active"
  | "failed"
  | "removed";

export interface CustomDomainData {
  id: string;
  computer_id: string;
  tenant_id: string;
  fqdn: string;
  status: CustomDomainStatus;
  /** The CNAME target the user must point their DNS record at. */
  verification_target: string;
  /** Human-readable DNS setup instructions. */
  instructions: string;
  verified_at: string | null;
  tls_issued_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomDomainRegisterParams {
  fqdn: string;
}

// ─── CustomDomains resource ──────────────────────────────────────────────────

/**
 * Custom domain management for a Computer.
 *
 * Accessed via `computer.domains`.
 *
 * ## Workflow
 * ```ts
 * // 1. Register the domain
 * const domain = await computer.domains.register("app.example.com");
 * console.log(domain.instructions);
 * // => "Add a CNAME record: app.example.com → <slug>.sandbox.miosa.ai"
 *
 * // 2. Add the CNAME in your DNS registrar, then...
 *
 * // 3. Verify ownership
 * const verified = await computer.domains.verify(domain.id);
 * // Caddy auto-issues a TLS certificate after this point.
 * ```
 */
export class CustomDomains {
  private readonly http: HttpClient;
  private readonly computerId: string;

  constructor(http: HttpClient, computerId: string) {
    this.http = http;
    this.computerId = computerId;
  }

  private base(): string {
    return `/computers/${this.computerId}/domains`;
  }

  /**
   * Register a custom FQDN for this computer.
   *
   * Returns the domain record with `verification_target` and `instructions`
   * showing which CNAME record to add. The domain starts in `pending` status.
   *
   * @param fqdn - The fully-qualified domain name to register
   *   (e.g. `"app.example.com"`). Must be lowercase RFC 1123, ≤ 253 chars,
   *   and must NOT end with `miosa.ai`.
   */
  async register(fqdn: string): Promise<CustomDomainData> {
    const resp = await this.http.post<{ data: CustomDomainData }>(this.base(), {
      fqdn,
    });
    return resp.data;
  }

  /**
   * List all custom domains registered for this computer.
   */
  async list(): Promise<CustomDomainData[]> {
    const resp = await this.http.get<{ data: CustomDomainData[] }>(this.base());
    return resp.data;
  }

  /**
   * Verify DNS ownership of a registered domain.
   *
   * The control plane resolves the domain's CNAME and confirms it points to
   * the expected `verification_target`. On success the domain transitions to
   * `verified` status and Caddy will auto-issue a TLS certificate on the next
   * inbound request.
   *
   * @param id - The custom domain record id (from `register()` or `list()`).
   * @throws `ApiError` with code `CNAME_MISMATCH` if the CNAME doesn't match.
   * @throws `ApiError` with code `DNS_LOOKUP_FAILED` if DNS is unreachable.
   */
  async verify(id: string): Promise<CustomDomainData> {
    const resp = await this.http.post<{ data: CustomDomainData }>(
      `${this.base()}/${id}/verify`,
    );
    return resp.data;
  }

  /**
   * Delete a custom domain mapping.
   *
   * The domain is immediately removed from the routing cache and Caddy will
   * stop serving it on the next cert renewal cycle.
   *
   * @param id - The custom domain record id.
   */
  async delete(id: string): Promise<void> {
    await this.http.delete<{ id: string; deleted: boolean }>(
      `${this.base()}/${id}`,
    );
  }
}
