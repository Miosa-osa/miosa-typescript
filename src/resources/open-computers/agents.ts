import { HttpClient } from "../../http.js";
import type {
  AgentDispatchParams,
  AgentEvent,
  AgentSessionListResponse,
  HostId,
  OcAgentSessionData,
} from "./types.js";

/**
 * Agents resource — dispatch Optimal AI agent sessions that execute on a
 * remote OpenComputers host via the OSA/WS tunnel.
 *
 * ```ts
 * const session = await client.openComputers.agents.dispatch(hostId, {
 *   task: "Run the test suite and report failures",
 * });
 *
 * for await (const event of client.openComputers.agents.events(hostId, session.id)) {
 *   console.log(event.type, event.data);
 *   if (event.type === "session_completed" || event.type === "done") break;
 * }
 * ```
 */
export class Agents {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  private base(hostId: string): string {
    return `/opencomputers/hosts/${hostId}/agent`;
  }

  private unwrapSession(payload: unknown): OcAgentSessionData {
    const value =
      payload && typeof payload === "object" && "session" in payload
        ? (payload as { session: unknown }).session
        : payload && typeof payload === "object" && "data" in payload
          ? (payload as { data: unknown }).data
          : payload;

    const session = value as OcAgentSessionData;
    if (!session.id && session.session_id) {
      return { ...session, id: session.session_id };
    }
    return session;
  }

  private unwrapList(payload: unknown): AgentSessionListResponse {
    if (payload && typeof payload === "object" && "sessions" in payload) {
      return { data: (payload as { sessions: OcAgentSessionData[] }).sessions };
    }
    if (Array.isArray(payload)) {
      return { data: payload as OcAgentSessionData[] };
    }
    return payload as AgentSessionListResponse;
  }

  /**
   * Dispatch a new agent session on the host.
   */
  async dispatch(
    hostId: HostId | string,
    params: AgentDispatchParams,
  ): Promise<OcAgentSessionData> {
    const payload = await this.http.post<unknown>(`${this.base(hostId)}/dispatch`, params);
    return this.unwrapSession(payload);
  }

  /**
   * List all agent sessions for a host.
   */
  async list(hostId: HostId | string): Promise<AgentSessionListResponse> {
    const payload = await this.http.get<unknown>(`${this.base(hostId)}/sessions`);
    return this.unwrapList(payload);
  }

  /**
   * Fetch the current state of a specific agent session.
   */
  async get(
    hostId: HostId | string,
    sessionId: string,
  ): Promise<OcAgentSessionData> {
    const payload = await this.http.get<unknown>(`${this.base(hostId)}/sessions/${sessionId}`);
    return this.unwrapSession(payload);
  }

  /**
   * Stream live events from an agent session.
   *
   * Yields `AgentEvent` objects. Break on `type === "done"` or
   * `type === "session_completed"`.
   */
  events(
    hostId: HostId | string,
    sessionId: string,
  ): AsyncIterableIterator<AgentEvent> {
    return this.http.stream<AgentEvent>(
      `${this.base(hostId)}/sessions/${sessionId}/events`,
    );
  }

  /**
   * Cancel a running or pending agent session.
   */
  async cancel(hostId: HostId | string, sessionId: string): Promise<void> {
    return this.http.delete<void>(`${this.base(hostId)}/sessions/${sessionId}`);
  }
}
