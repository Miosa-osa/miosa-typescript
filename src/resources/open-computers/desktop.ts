import { HttpClient } from "../../http.js";
import type { HostId, WsTicket } from "./types.js";

/**
 * Desktop resource — issue WebSocket tickets for KasmVNC desktop streaming on
 * a remote OpenComputers host.
 *
 * The ticket is consumed by a WebSocket upgrade at the URL in `ws_url`. Connect
 * a KasmVNC-compatible client (or an iframe pointing at the VNC web client) to
 * drive the desktop.
 *
 * ```ts
 * const { ws_url } = await client.openComputers.desktop.ticket(hostId);
 * // Open ws_url in an iframe or VNC client
 * ```
 */
export class Desktop {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Issue a short-lived WebSocket ticket for a desktop streaming session.
   *
   * The ticket expires quickly — open the WebSocket immediately after receiving it.
   */
  async ticket(hostId: HostId | string): Promise<WsTicket> {
    return this.http.post<WsTicket>(
      `/opencomputers/hosts/${hostId}/desktop/ticket`,
    );
  }
}
