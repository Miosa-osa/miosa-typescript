import { HttpClient } from "../../http.js";
import type {
  ClusterCreateParams,
  ClusterData,
  ClusterEvent,
  ClusterId,
  ClusterListResponse,
} from "./types.js";

/**
 * Clusters resource — manage multi-host LLM inference clusters (exo / MLX
 * Distributed). Hosts must be Apple Silicon.
 *
 * Once a cluster is active it exposes an OpenAI-compatible endpoint at:
 *   `POST /inference/{slug}/v1/chat/completions`
 *
 * Point any OpenAI client at `https://api.miosa.ai/inference/{slug}/v1` with
 * your `msk_*` Bearer token.
 *
 * ```ts
 * const cluster = await client.openComputers.clusters.create({
 *   name: "llama-cluster",
 *   model: "llama3:70b",
 *   host_ids: [hostA.id, hostB.id],
 * });
 * console.log(cluster.inference_url); // OpenAI-compatible base URL
 * ```
 */
export class Clusters {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  private base(): string {
    return "/opencomputers/clusters";
  }

  /**
   * List all inference clusters for the tenant.
   */
  async list(): Promise<ClusterListResponse> {
    return this.http.get<ClusterListResponse>(this.base());
  }

  /**
   * Create and provision a new inference cluster.
   */
  async create(params: ClusterCreateParams): Promise<ClusterData> {
    return this.http.post<ClusterData>(this.base(), params);
  }

  /**
   * Fetch a single cluster.
   */
  async get(id: ClusterId | string): Promise<ClusterData> {
    return this.http.get<ClusterData>(`${this.base()}/${id}`);
  }

  /**
   * Start a stopped cluster.
   */
  async start(id: ClusterId | string): Promise<ClusterData> {
    return this.http.post<ClusterData>(`${this.base()}/${id}/start`);
  }

  /**
   * Stop a running cluster (preserves configuration).
   */
  async stop(id: ClusterId | string): Promise<ClusterData> {
    return this.http.post<ClusterData>(`${this.base()}/${id}/stop`);
  }

  /**
   * Permanently delete a cluster.
   */
  async delete(id: ClusterId | string): Promise<void> {
    return this.http.delete<void>(`${this.base()}/${id}`);
  }

  /**
   * Stream cluster provisioning / health events.
   */
  events(id: ClusterId | string): AsyncIterableIterator<ClusterEvent> {
    return this.http.stream<ClusterEvent>(`${this.base()}/${id}/events`);
  }
}
