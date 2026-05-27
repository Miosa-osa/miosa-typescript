import { HttpClient } from "../http.js";
import type { NetworkPolicyData, NetworkPolicySetParams } from "../types.js";

/**
 * Manage egress network policy for a computer.
 *
 * A policy is a list of rules evaluated top-to-bottom, with a `default_effect`
 * applied when no rule matches.
 *
 * Example — block IMDS and allow everything else:
 * ```ts
 * await computer.networkPolicy.set({
 *   default_effect: "allow",
 *   rules: [
 *     { effect: "deny", destination: "169.254.169.254/32" },
 *     { effect: "deny", destination: "metadata.google.internal" },
 *   ],
 * });
 * ```
 *
 * Example — allowlist mode (deny all by default, allow only example.com):
 * ```ts
 * await computer.networkPolicy.set({
 *   default_effect: "deny",
 *   rules: [
 *     { effect: "allow", destination: "example.com", ports: "443", protocol: "tcp" },
 *   ],
 * });
 * ```
 */
export class NetworkPolicy {
  private readonly http: HttpClient;
  private readonly computerId: string;

  constructor(http: HttpClient, computerId: string) {
    this.http = http;
    this.computerId = computerId;
  }

  /**
   * Get the current network policy.
   * Returns an empty allow-all policy if none is set.
   */
  async get(): Promise<NetworkPolicyData> {
    const response = await this.http.get<{ data: NetworkPolicyData }>(
      `/computers/${this.computerId}/network-policy`,
    );
    return response.data;
  }

  /**
   * Set (create or replace) the network policy.
   * Triggers immediate nftables update on the host — running VMs pick up
   * the new rules without a restart.
   */
  async set(params: NetworkPolicySetParams): Promise<NetworkPolicyData> {
    const response = await this.http.put<{ data: NetworkPolicyData }>(
      `/computers/${this.computerId}/network-policy`,
      params,
    );
    return response.data;
  }

  /**
   * Reset to the default policy (allow all egress).
   * Idempotent — safe to call even if no policy was set.
   */
  async reset(): Promise<void> {
    await this.http.delete<unknown>(
      `/computers/${this.computerId}/network-policy`,
    );
  }
}
