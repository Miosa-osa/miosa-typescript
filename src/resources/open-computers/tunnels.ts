import { HttpClient } from "../../http.js";
import type {
  HostId,
  TunnelCreateParams,
  TunnelData,
  TunnelId,
  TunnelListResponse,
  TunnelUpdateParams,
} from "./types.js";

/**
 * Tunnels resource — expose ports on a remote host as publicly reachable URLs.
 *
 * The public proxy is served at `/t/:slug/*path`. The `auth_mode` field on each
 * tunnel controls whether the URL is open to the internet or requires
 * tenant credentials / a password.
 *
 * ```ts
 * const tunnel = await client.openComputers.tunnels.create(hostId, {
 *   target_port: 8080,
 *   auth_mode: "public",
 * });
 * console.log(tunnel.public_url); // https://api.miosa.ai/t/<slug>
 * ```
 */
export class Tunnels {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  private base(hostId: string): string {
    return `/opencomputers/hosts/${hostId}/tunnels`;
  }

  /**
   * List all tunnels for a host.
   */
  async list(hostId: HostId | string): Promise<TunnelListResponse> {
    return this.http.get<TunnelListResponse>(this.base(hostId));
  }

  /**
   * Create a new tunnel that forwards traffic to `target_port` on the host.
   */
  async create(
    hostId: HostId | string,
    params: TunnelCreateParams,
  ): Promise<TunnelData> {
    return this.http.post<TunnelData>(this.base(hostId), params);
  }

  /**
   * Fetch a single tunnel.
   */
  async get(
    hostId: HostId | string,
    tunnelId: TunnelId | string,
  ): Promise<TunnelData> {
    return this.http.get<TunnelData>(`${this.base(hostId)}/${tunnelId}`);
  }

  /**
   * Update a tunnel (target port, auth mode, or enabled state).
   */
  async update(
    hostId: HostId | string,
    tunnelId: TunnelId | string,
    params: TunnelUpdateParams,
  ): Promise<TunnelData> {
    return this.http.patch<TunnelData>(
      `${this.base(hostId)}/${tunnelId}`,
      params,
    );
  }

  /**
   * Delete a tunnel. The public URL immediately becomes unreachable.
   */
  async delete(
    hostId: HostId | string,
    tunnelId: TunnelId | string,
  ): Promise<void> {
    return this.http.delete<void>(`${this.base(hostId)}/${tunnelId}`);
  }
}
