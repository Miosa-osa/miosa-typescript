import { HttpClient } from "../../http.js";
import type { HostId, WsTicket } from "./types.js";

/**
 * Terminal resource — issue WebSocket tickets for interactive PTY sessions on
 * a remote OpenComputers host.
 *
 * The ticket is consumed by a WebSocket upgrade at the URL in `ws_url`. Use
 * xterm.js or any raw WebSocket client to drive the terminal.
 *
 * ```ts
 * const { ws_url } = await client.openComputers.terminal.ticket(hostId);
 * const ws = new WebSocket(ws_url);
 * ```
 */
export class Terminal {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Issue a short-lived WebSocket ticket for a terminal session.
   *
   * The ticket expires quickly — open the WebSocket immediately after receiving it.
   */
  async ticket(hostId: HostId | string): Promise<WsTicket> {
    return this.http.post<WsTicket>(
      `/opencomputers/hosts/${hostId}/terminal/ticket`,
    );
  }
}
