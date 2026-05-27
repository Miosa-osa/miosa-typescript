/**
 * Workspace Invites — email invite flow for workspace access.
 *
 * Sending an invite to an email that already belongs to a tenant member
 * short-circuits to directly adding that user (returns `type: "added"`).
 * Accepting a workspace invite for an unknown email auto-creates both a
 * `tenant_members` and a `workspace_members` row atomically.
 *
 * Public endpoints (no auth):
 *   GET  /workspace-invites/:token
 *
 * Authenticated endpoints:
 *   POST   /workspaces/:id/invites
 *   GET    /workspaces/:id/invites
 *   DELETE /workspaces/:id/invites/:invite_id
 *   POST   /workspace-invites/:token/accept
 */

import type { HttpClient } from "../http.js";
import type {
  WorkspaceMemberRecord,
  WorkspaceRole,
} from "./workspace-members.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  tenant_id: string;
  email: string;
  role: WorkspaceRole;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  inserted_at: string;
}

export interface WorkspaceInvitePreview {
  workspace_name: string;
  tenant_name: string;
  role: WorkspaceRole;
  email: string;
  expires_at: string;
  expired: boolean;
  revoked: boolean;
  accepted: boolean;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface CreateWorkspaceInviteParams {
  email: string;
  role?: WorkspaceRole;
}

// ── Response shapes ───────────────────────────────────────────────────────────

/** Returned when the email was unknown — an invite was created. */
export interface WorkspaceInviteCreatedResponse {
  data: WorkspaceInvite;
  type: "invited";
}

/** Returned when the email already had a tenant_members row — added directly. */
export interface WorkspaceMemberAddedResponse {
  data: WorkspaceMemberRecord;
  type: "added";
}

export type CreateWorkspaceInviteResponse =
  | WorkspaceInviteCreatedResponse
  | WorkspaceMemberAddedResponse;

export interface WorkspaceInviteListResponse {
  data: WorkspaceInvite[];
  total: number;
}

export interface WorkspaceInviteRevokeResponse {
  invite_id: string;
  revoked: boolean;
}

export interface WorkspaceInvitePreviewResponse {
  data: WorkspaceInvitePreview;
}

export interface AcceptWorkspaceInviteResponse {
  accepted: boolean;
  workspace_id: string;
  tenant_id: string;
  role: WorkspaceRole;
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class WorkspaceInvites {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a workspace invite or add a member directly.
   *
   * If `email` already maps to a tenant member the user is added directly and
   * `type === "added"` is returned with a `WorkspaceMemberRecord`. Otherwise
   * an invite row is created and `type === "invited"` is returned.
   *
   * `POST /workspaces/:id/invites`
   */
  async create(
    workspaceId: string,
    params: CreateWorkspaceInviteParams,
  ): Promise<CreateWorkspaceInviteResponse> {
    return this.http.post<CreateWorkspaceInviteResponse>(
      `/workspaces/${workspaceId}/invites`,
      params,
    );
  }

  /**
   * List all pending (non-expired, non-accepted, non-revoked) workspace invites.
   *
   * `GET /workspaces/:id/invites`
   */
  async list(workspaceId: string): Promise<WorkspaceInvite[]> {
    const res = await this.http.get<WorkspaceInviteListResponse>(
      `/workspaces/${workspaceId}/invites`,
    );
    return res.data ?? [];
  }

  /**
   * Revoke a pending workspace invite.
   *
   * Already-revoked invites are idempotent (returns `revoked: true`). An invite
   * that was legitimately accepted throws `409 ALREADY_ACCEPTED`.
   *
   * `DELETE /workspaces/:id/invites/:invite_id`
   */
  async revoke(
    workspaceId: string,
    inviteId: string,
  ): Promise<WorkspaceInviteRevokeResponse> {
    return this.http.delete<WorkspaceInviteRevokeResponse>(
      `/workspaces/${workspaceId}/invites/${inviteId}`,
    );
  }

  /**
   * Preview a workspace invite by token (no auth required).
   *
   * Use this to render the invite landing page before prompting the user to
   * log in or sign up. Returns `null` when the token is unknown or revoked.
   *
   * `GET /workspace-invites/:token`
   */
  async preview(token: string): Promise<WorkspaceInvitePreview | null> {
    try {
      const res = await this.http.get<WorkspaceInvitePreviewResponse>(
        `/workspace-invites/${token}`,
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Accept a workspace invite on behalf of the authenticated user.
   *
   * The caller's JWT email must match the invite email (case-insensitive).
   *
   * Error codes:
   * - `INVALID_TOKEN` (404) — token not found.
   * - `EXPIRED` (410) — invite TTL elapsed.
   * - `REVOKED` (409) — invite was revoked.
   * - `ALREADY_ACCEPTED` (409) — already used.
   * - `EMAIL_MISMATCH` (422) — JWT email differs from invite email.
   *
   * `POST /workspace-invites/:token/accept`
   */
  async accept(token: string): Promise<AcceptWorkspaceInviteResponse> {
    return this.http.post<AcceptWorkspaceInviteResponse>(
      `/workspace-invites/${token}/accept`,
      {},
    );
  }
}
