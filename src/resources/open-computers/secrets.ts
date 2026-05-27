import { HttpClient } from "../../http.js";
import type {
  HostId,
  SecretCreateParams,
  SecretData,
  SecretId,
  SecretUpdateParams,
} from "./types.js";

/**
 * Secrets resource — manage encrypted per-host (and per-tenant) env vars.
 *
 * Secrets are injected into exec sessions and PTY sessions on the host.
 * The value is encrypted at rest; `reveal()` decrypts it for one-time display.
 *
 * ```ts
 * // Tenant-wide secret (shared across all hosts)
 * await client.openComputers.secrets.createForTenant({ name: "OPENAI_KEY", value: "sk-..." });
 *
 * // Host-specific secret
 * const secret = await client.openComputers.secrets.createForHost(hostId, {
 *   name: "DB_PASSWORD", value: "hunter2",
 * });
 * ```
 */
export class Secrets {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  // ── Tenant-scoped secrets ────────────────────────────────────────────────────

  /**
   * List all tenant-scoped secrets.
   */
  async listForTenant(): Promise<SecretData[]> {
    const result = await this.http.get<{ data: SecretData[] }>(
      "/opencomputers/secrets",
    );
    return result.data;
  }

  /**
   * Create a tenant-scoped secret (available to all hosts).
   */
  async createForTenant(params: SecretCreateParams): Promise<SecretData> {
    return this.http.post<SecretData>("/opencomputers/secrets", params);
  }

  // ── Host-scoped secrets ──────────────────────────────────────────────────────

  /**
   * List secrets scoped to a specific host.
   */
  async listForHost(hostId: HostId | string): Promise<SecretData[]> {
    const result = await this.http.get<{ data: SecretData[] }>(
      `/opencomputers/hosts/${hostId}/secrets`,
    );
    return result.data;
  }

  /**
   * Create a secret scoped to a specific host.
   */
  async createForHost(
    hostId: HostId | string,
    params: SecretCreateParams,
  ): Promise<SecretData> {
    return this.http.post<SecretData>(
      `/opencomputers/hosts/${hostId}/secrets`,
      params,
    );
  }

  /**
   * Update a host-scoped secret (rotate value or update description).
   */
  async updateForHost(
    hostId: HostId | string,
    secretId: SecretId | string,
    params: SecretUpdateParams,
  ): Promise<SecretData> {
    return this.http.patch<SecretData>(
      `/opencomputers/hosts/${hostId}/secrets/${secretId}`,
      params,
    );
  }

  /**
   * Delete a host-scoped secret.
   */
  async deleteForHost(
    hostId: HostId | string,
    secretId: SecretId | string,
  ): Promise<void> {
    return this.http.delete<void>(
      `/opencomputers/hosts/${hostId}/secrets/${secretId}`,
    );
  }

  /**
   * Reveal (decrypt and return) the plaintext value of a secret.
   * Use sparingly — each call is audit-logged.
   */
  async reveal(
    hostId: HostId | string,
    secretId: SecretId | string,
  ): Promise<{ value: string }> {
    return this.http.post<{ value: string }>(
      `/opencomputers/hosts/${hostId}/secrets/${secretId}/reveal`,
    );
  }
}
