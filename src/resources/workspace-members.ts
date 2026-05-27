/**
 * Workspace Members — per-workspace user roster.
 *
 * Endpoints:
 *   GET    /workspaces/:id/members
 *   POST   /workspaces/:id/members
 *   PATCH  /workspaces/:id/members/:user_id
 *   DELETE /workspaces/:id/members/:user_id
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

/** Role a user can hold within a workspace. */
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

/**
 * Workspace member as returned by `list` — includes denormalised user fields
 * for display.
 */
export interface WorkspaceMember {
  user_id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  role: WorkspaceRole;
  joined_at: string | null;
  added_by: string | null;
}

/** Raw workspace_members row returned after add/update operations. */
export interface WorkspaceMemberRecord {
  user_id: string;
  workspace_id: string;
  role: WorkspaceRole;
  joined_at: string | null;
  added_by: string | null;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface AddWorkspaceMemberParams {
  /** UUID of the tenant user to add. Must already be an org member. */
  user_id: string;
  /** Role to assign; defaults to `"member"`. */
  role?: WorkspaceRole;
}

export interface UpdateWorkspaceMemberRoleParams {
  role: WorkspaceRole;
}

// ── Response envelopes ───────────────────────────────────────────────────────

export interface WorkspaceMemberListResponse {
  data: WorkspaceMember[];
}

export interface WorkspaceMemberRecordResponse {
  data: WorkspaceMemberRecord;
}

export interface WorkspaceMemberDeleteResponse {
  deleted: boolean;
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class WorkspaceMembers {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all members of a workspace.
   *
   * `GET /workspaces/:id/members`
   */
  async list(workspaceId: string): Promise<WorkspaceMember[]> {
    const res = await this.http.get<WorkspaceMemberListResponse>(
      `/workspaces/${workspaceId}/members`,
    );
    return res.data ?? (res as unknown as WorkspaceMember[]);
  }

  /**
   * Add an existing tenant user to a workspace.
   *
   * The `user_id` must already hold a `tenant_members` row for the parent org.
   * Use {@link WorkspaceInvites.create} to invite someone who is not yet an org
   * member.
   *
   * `POST /workspaces/:id/members`
   *
   * @throws `MiosaError` with code `NOT_TENANT_MEMBER` if the user is not an
   *   org member.
   */
  async add(
    workspaceId: string,
    params: AddWorkspaceMemberParams,
  ): Promise<WorkspaceMemberRecord> {
    const res = await this.http.post<WorkspaceMemberRecordResponse>(
      `/workspaces/${workspaceId}/members`,
      params,
    );
    return res.data ?? (res as unknown as WorkspaceMemberRecord);
  }

  /**
   * Change a workspace member's role.
   *
   * `PATCH /workspaces/:id/members/:user_id`
   */
  async updateRole(
    workspaceId: string,
    userId: string,
    params: UpdateWorkspaceMemberRoleParams,
  ): Promise<WorkspaceMemberRecord> {
    const res = await this.http.patch<WorkspaceMemberRecordResponse>(
      `/workspaces/${workspaceId}/members/${userId}`,
      params,
    );
    return res.data ?? (res as unknown as WorkspaceMemberRecord);
  }

  /**
   * Remove a user from a workspace.
   *
   * The last `owner` of a workspace cannot be removed. Promote another member
   * to `owner` first using {@link updateRole}.
   *
   * `DELETE /workspaces/:id/members/:user_id`
   *
   * @throws `MiosaError` with code `LAST_OWNER` if the target is the sole owner.
   */
  async remove(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMemberDeleteResponse> {
    return this.http.delete<WorkspaceMemberDeleteResponse>(
      `/workspaces/${workspaceId}/members/${userId}`,
    );
  }
}
