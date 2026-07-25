import type { HttpClient } from "../http.js";
import { OrgInvites } from "./org-invites.js";

export type OrganizationRole = "owner" | "admin" | "member";

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  role?: OrganizationRole;
  owner_user_id?: string | null;
  plan_id?: string | null;
  plan?: Record<string, unknown> | null;
  plan_name?: string | null;
  credit_balance?: number;
  settings?: Record<string, unknown>;
  branding?: Record<string, unknown> | null;
  inserted_at?: string;
  updated_at?: string;
}

export interface OrganizationMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: OrganizationRole;
  status: "invited" | "active" | string;
  invited_at?: string | null;
  joined_at?: string | null;
  created_at?: string;
  user_name?: string | null;
  user_email?: string | null;
  user_avatar_url?: string | null;
}

export interface OrganizationSwitchResult {
  tenant: OrganizationSummary;
  token: string;
  refresh_token: string;
}

export interface OrganizationMemberList {
  members: OrganizationMember[];
  total: number;
}

export interface OrganizationMemberRemoved {
  tenant_id: string;
  user_id: string;
  removed: boolean;
}

export class OrganizationMembers {
  constructor(private readonly http: HttpClient) {}

  async list(organizationId: string): Promise<OrganizationMemberList> {
    return this.http.get<OrganizationMemberList>(
      `/tenants/${encodeURIComponent(organizationId)}/members`,
    );
  }

  async add(
    organizationId: string,
    userId: string,
    role: OrganizationRole = "member",
  ): Promise<OrganizationMember> {
    return this.http.post<OrganizationMember>(
      `/tenants/${encodeURIComponent(organizationId)}/members`,
      { user_id: userId, role },
    );
  }

  async remove(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMemberRemoved> {
    return this.http.delete<OrganizationMemberRemoved>(
      `/tenants/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}`,
    );
  }
}

export class Organizations {
  readonly members: OrganizationMembers;
  readonly invites: OrgInvites;

  constructor(private readonly http: HttpClient) {
    this.members = new OrganizationMembers(http);
    this.invites = new OrgInvites(http);
  }

  async list(): Promise<OrganizationSummary[]> {
    const response = await this.http.get<{ data: OrganizationSummary[] }>(
      "/platform/tenants",
    );
    return response.data ?? [];
  }

  async current(): Promise<OrganizationSummary> {
    return this.http.get<OrganizationSummary>("/platform/tenants/current");
  }

  /** Requires a user JWT. API keys are pinned to their organization. */
  async switch(idOrSlug: string): Promise<OrganizationSwitchResult> {
    return this.http.post<OrganizationSwitchResult>(
      `/platform/tenants/${encodeURIComponent(idOrSlug)}/switch`,
      {},
    );
  }
}
