import { HttpClient } from "../../http.js";
import type {
  HostId,
  OcWorkspaceCreateParams,
  OcWorkspaceData,
  OcWorkspaceEvent,
  OcWorkspaceListResponse,
  OcWorkspaceUpdateParams,
  WorkspaceId,
  WsTicket,
} from "./types.js";

/**
 * Workspaces resource — git-backed development environments on a remote host.
 *
 * A workspace clones a repository, installs dependencies, and gives you a
 * ready-to-use terminal scoped to the project root.
 *
 * ```ts
 * const ws = await client.openComputers.workspaces.create(hostId, {
 *   name: "my-project",
 *   repo_url: "https://github.com/acme/backend",
 *   branch: "main",
 * });
 * const { ws_url } = await client.openComputers.workspaces.openTerminal(hostId, ws.id);
 * ```
 */
export class OcWorkspaces {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  private base(hostId: string): string {
    return `/opencomputers/hosts/${hostId}/workspaces`;
  }

  /**
   * List all workspaces across all hosts for the tenant.
   */
  async listAll(): Promise<OcWorkspaceListResponse> {
    return this.http.get<OcWorkspaceListResponse>("/opencomputers/workspaces");
  }

  /**
   * List workspaces on a specific host.
   */
  async list(hostId: HostId | string): Promise<OcWorkspaceListResponse> {
    return this.http.get<OcWorkspaceListResponse>(this.base(hostId));
  }

  /**
   * Create a new workspace on a host.
   */
  async create(
    hostId: HostId | string,
    params: OcWorkspaceCreateParams,
  ): Promise<OcWorkspaceData> {
    return this.http.post<OcWorkspaceData>(this.base(hostId), params);
  }

  /**
   * Fetch a single workspace.
   */
  async get(
    hostId: HostId | string,
    workspaceId: WorkspaceId | string,
  ): Promise<OcWorkspaceData> {
    return this.http.get<OcWorkspaceData>(
      `${this.base(hostId)}/${workspaceId}`,
    );
  }

  /**
   * Update workspace metadata (name, branch).
   */
  async update(
    hostId: HostId | string,
    workspaceId: WorkspaceId | string,
    params: OcWorkspaceUpdateParams,
  ): Promise<OcWorkspaceData> {
    return this.http.patch<OcWorkspaceData>(
      `${this.base(hostId)}/${workspaceId}`,
      params,
    );
  }

  /**
   * Delete a workspace.
   */
  async delete(
    hostId: HostId | string,
    workspaceId: WorkspaceId | string,
  ): Promise<void> {
    return this.http.delete<void>(`${this.base(hostId)}/${workspaceId}`);
  }

  /**
   * Pull the latest changes from the remote repository.
   */
  async pull(
    hostId: HostId | string,
    workspaceId: WorkspaceId | string,
  ): Promise<OcWorkspaceData> {
    return this.http.post<OcWorkspaceData>(
      `${this.base(hostId)}/${workspaceId}/pull`,
    );
  }

  /**
   * Open a terminal session scoped to the workspace root directory.
   * Returns a short-lived WebSocket ticket.
   */
  async openTerminal(
    hostId: HostId | string,
    workspaceId: WorkspaceId | string,
  ): Promise<WsTicket> {
    return this.http.post<WsTicket>(
      `${this.base(hostId)}/${workspaceId}/open-terminal`,
    );
  }

  /**
   * Stream workspace setup / clone / install events.
   */
  events(
    hostId: HostId | string,
    workspaceId: WorkspaceId | string,
  ): AsyncIterableIterator<OcWorkspaceEvent> {
    return this.http.stream<OcWorkspaceEvent>(
      `${this.base(hostId)}/${workspaceId}/events`,
    );
  }
}
