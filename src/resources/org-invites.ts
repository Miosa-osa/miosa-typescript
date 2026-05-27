/**
 * Org Invites — email invite flow for org (tenant) membership.
 *
 * Public endpoints (no auth):
 *   GET  /invites/:token
 *
 * Authenticated endpoints (admin/owner role required for create/list/revoke):
 *   POST   /tenants/:id/invites
 *   GET    /tenants/:id/invites
 *   DELETE /tenants/:id/invites/:invite_id
 *   POST   /invites/:token/accept
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export type OrgRole = "owner" | "admin" | "member";

export interface OrgInvite {
  id: string;
  tenant_id: string;
  email: string;
  role: OrgRole;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface OrgInviteCreated {
  invite_id: string;
  email: string;
  role: OrgRole;
  expires_at: string;
  /**
   * Full URL for the invite landing page. On white-label tenants this uses
   * the tenant's custom domain.
   */
  invite_url: string;
}

export interface OrgInvitePreview {
  email: string;
  tenant_name: string;
  role: OrgRole;
  expires_at: string;
  expired: boolean;
  accepted: boolean;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string | null;
  plan_id: string | null;
  plan_name: string | null;
  settings: Record<string, unknown>;
  inserted_at: string;
  updated_at: string;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface CreateOrgInviteParams {
  email: string;
  role?: OrgRole;
}

// ── Response shapes ───────────────────────────────────────────────────────────

export interface OrgInviteCreatedResponse {
  data: OrgInviteCreated;
}

export interface OrgInviteListResponse {
  data: OrgInvite[];
  total: number;
}

export interface OrgInviteRevokeResponse {
  invite_id: string;
  revoked: boolean;
}

export interface OrgInvitePreviewResponse {
  data: OrgInvitePreview;
}

export interface AcceptOrgInviteResponse {
  accepted: boolean;
  tenant_id: string;
  tenant: TenantSummary | null;
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class OrgInvites {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create an org invite and dispatch the invite email.
   *
   * The invite URL in the response is host-aware: on white-label tenants it
   * uses the custom domain so the recipient lands on the branded experience.
   * Requires `admin` or `owner` role in the tenant.
   *
   * `POST /tenants/:id/invites`
   */
  async create(
    tenantId: string,
    params: CreateOrgInviteParams,
  ): Promise<OrgInviteCreated> {
    const res = await this.http.post<OrgInviteCreatedResponse>(
      `/tenants/${tenantId}/invites`,
      params,
    );
    return res.data;
  }

  /**
   * List all pending (non-expired, non-accepted, non-revoked) org invites.
   *
   * Requires `admin` or `owner` role.
   *
   * `GET /tenants/:id/invites`
   */
  async list(tenantId: string): Promise<OrgInvite[]> {
    const res = await this.http.get<OrgInviteListResponse>(
      `/tenants/${tenantId}/invites`,
    );
    return res.data ?? [];
  }

  /**
   * Revoke a pending org invite.
   *
   * Returns `409` when the invite was already legitimately accepted.
   * Requires `admin` or `owner` role.
   *
   * `DELETE /tenants/:id/invites/:invite_id`
   */
  async revoke(
    tenantId: string,
    inviteId: string,
  ): Promise<OrgInviteRevokeResponse> {
    return this.http.delete<OrgInviteRevokeResponse>(
      `/tenants/${tenantId}/invites/${inviteId}`,
    );
  }

  /**
   * Preview an org invite by token (no auth required).
   *
   * Returns `null` when the token is unknown or has been revoked.
   *
   * `GET /invites/:token`
   */
  async preview(token: string): Promise<OrgInvitePreview | null> {
    try {
      const res = await this.http.get<OrgInvitePreviewResponse>(
        `/invites/${token}`,
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Accept an org invite on behalf of the authenticated user.
   *
   * The caller's JWT email must match the invite email (case-insensitive).
   * On success inserts a `tenant_members` row.
   *
   * Error responses:
   * - `400` — invalid or expired token.
   * - `422 EMAIL_MISMATCH` — JWT email does not match the invite email.
   *
   * `POST /invites/:token/accept`
   */
  async accept(token: string): Promise<AcceptOrgInviteResponse> {
    return this.http.post<AcceptOrgInviteResponse>(
      `/invites/${token}/accept`,
      {},
    );
  }
}
