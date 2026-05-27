import { HttpClient } from "../../http.js";
import type {
  HostCreateParams,
  HostData,
  HostEvent,
  HostId,
  HostListResponse,
  HostUpdateParams,
} from "./types.js";

/**
 * Hosts resource — manage BYOC (Bring Your Own Computer) hosts registered
 * under your tenant.
 *
 * ```ts
 * const host = await client.openComputers.hosts.create({ name: "my-mac" });
 * console.log(host.host_key); // store this — shown only once
 * ```
 */
export class Hosts {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  private base(): string {
    return "/opencomputers/hosts";
  }

  /**
   * List all hosts registered for the tenant.
   */
  async list(): Promise<HostListResponse> {
    return this.http.get<HostListResponse>(this.base());
  }

  /**
   * Register a new host. The returned `host_key` is shown **once** — store it
   * immediately and install it on the target machine.
   */
  async create(params: HostCreateParams): Promise<HostData> {
    return this.http.post<HostData>(this.base(), params);
  }

  /**
   * Fetch a single host by ID.
   */
  async get(id: HostId | string): Promise<HostData> {
    return this.http.get<HostData>(`${this.base()}/${id}`);
  }

  /**
   * Update host metadata (name / labels).
   */
  async update(
    id: HostId | string,
    params: HostUpdateParams,
  ): Promise<HostData> {
    return this.http.patch<HostData>(`${this.base()}/${id}`, params);
  }

  /**
   * Revoke a host. Permanently removes the registration; the host key is
   * invalidated and the host will disconnect on next heartbeat.
   */
  async revoke(id: HostId | string): Promise<void> {
    return this.http.delete<void>(`${this.base()}/${id}`);
  }

  /**
   * Stream host state-change events (connect / disconnect / error) as an
   * `AsyncIterable`.
   *
   * ```ts
   * for await (const event of client.openComputers.hosts.events()) {
   *   console.log(event.type, event.host_id);
   *   if (shouldStop) break;
   * }
   * ```
   */
  events(): AsyncIterableIterator<HostEvent> {
    return this.http.stream<HostEvent>("/opencomputers/hosts/events");
  }
}
