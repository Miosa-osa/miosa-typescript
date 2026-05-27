/**
 * Phase 6 governance resources — policy, members, workspaces, bulk ops,
 * billing, impersonation, and scoped API keys.
 */

import type { HttpClient } from "../http.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PolicyDoc = Record<string, unknown>;

export interface BulkJobResponse {
  queued: number;
  job_id: string;
  [key: string]: unknown;
}

export interface BulkJobStatus {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  processed?: number;
  errors?: unknown[];
  [key: string]: unknown;
}

export interface MemberRecord {
  id: string;
  email?: string;
  role: string;
  [key: string]: unknown;
}

export interface Invoice {
  id: string;
  amount: number;
  [key: string]: unknown;
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  [key: string]: unknown;
}

// ── Effective policy typed accessors ─────────────────────────────────────────

export interface EffectivePolicyField<T = unknown> {
  value: T;
  source: "user" | "workspace" | "tenant" | "platform";
}

export interface EffectiveLifecycle {
  default_idle_timeout_sec?: EffectivePolicyField<number>;
  default_timeout_sec?: EffectivePolicyField<number>;
  default_always_on?: EffectivePolicyField<boolean>;
  [key: string]: EffectivePolicyField | undefined;
}

export interface EffectiveQuotas {
  max_sandboxes?: EffectivePolicyField<number>;
  max_concurrent_sandboxes?: EffectivePolicyField<number>;
  max_computers?: EffectivePolicyField<number>;
  [key: string]: EffectivePolicyField | undefined;
}

export interface EffectivePolicyDoc {
  lifecycle: Record<string, EffectivePolicyField>;
  quotas: Record<string, EffectivePolicyField>;
  sizing?: Record<string, EffectivePolicyField>;
  features?: Record<string, EffectivePolicyField>;
  egress?: Record<string, EffectivePolicyField>;
  [key: string]: Record<string, EffectivePolicyField> | undefined;
}

// ── Policy sub-resources ──────────────────────────────────────────────────────

export class TenantPolicy {
  constructor(private readonly http: HttpClient) {}

  async get(): Promise<PolicyDoc> {
    const r = await this.http.get<{ data?: PolicyDoc }>("/tenant/policy");
    return (r as { data?: PolicyDoc }).data ?? (r as PolicyDoc);
  }

  async set(policy: PolicyDoc): Promise<PolicyDoc> {
    const r = await this.http.put<{ data?: PolicyDoc }>(
      "/tenant/policy",
      policy,
    );
    return (r as { data?: PolicyDoc }).data ?? (r as PolicyDoc);
  }

  async delete(): Promise<void> {
    await this.http.delete<unknown>("/tenant/policy");
  }
}

export class WorkspacePolicyResource {
  constructor(
    private readonly http: HttpClient,
    private readonly workspaceId: string,
  ) {}

  async get(): Promise<PolicyDoc> {
    const r = await this.http.get<{ data?: PolicyDoc }>(
      `/workspaces/${this.workspaceId}/policy`,
    );
    return (r as { data?: PolicyDoc }).data ?? (r as PolicyDoc);
  }

  async set(policy: PolicyDoc): Promise<PolicyDoc> {
    const r = await this.http.put<{ data?: PolicyDoc }>(
      `/workspaces/${this.workspaceId}/policy`,
      policy,
    );
    return (r as { data?: PolicyDoc }).data ?? (r as PolicyDoc);
  }

  async delete(): Promise<void> {
    await this.http.delete<unknown>(`/workspaces/${this.workspaceId}/policy`);
  }
}

export class ExternalUserPolicyResource {
  constructor(
    private readonly http: HttpClient,
    private readonly userId: string,
  ) {}

  async get(): Promise<PolicyDoc> {
    const r = await this.http.get<{ data?: PolicyDoc }>(
      `/external-users/${this.userId}/policy`,
    );
    return (r as { data?: PolicyDoc }).data ?? (r as PolicyDoc);
  }

  async set(policy: PolicyDoc): Promise<PolicyDoc> {
    const r = await this.http.put<{ data?: PolicyDoc }>(
      `/external-users/${this.userId}/policy`,
      policy,
    );
    return (r as { data?: PolicyDoc }).data ?? (r as PolicyDoc);
  }

  async delete(): Promise<void> {
    await this.http.delete<unknown>(`/external-users/${this.userId}/policy`);
  }

  async effective(): Promise<EffectivePolicyDoc> {
    const r = await this.http.get<unknown>(
      `/external-users/${this.userId}/effective-policy`,
    );
    const data =
      (r as { data?: EffectivePolicyDoc }).data ?? (r as EffectivePolicyDoc);
    return data as EffectivePolicyDoc;
  }
}

// ── ExternalUsers proxy ───────────────────────────────────────────────────────

export class ExternalUserProxy {
  readonly policy: ExternalUserPolicyResource;

  constructor(http: HttpClient, userId: string) {
    this.policy = new ExternalUserPolicyResource(http, userId);
  }
}

export class ExternalUsers {
  constructor(private readonly http: HttpClient) {}

  call(externalUserId: string): ExternalUserProxy {
    return new ExternalUserProxy(this.http, externalUserId);
  }
}

// ── Tenant members ─────────────────────────────────────────────────────────────

export class TenantMembersResource {
  constructor(private readonly http: HttpClient) {}

  async list(): Promise<MemberRecord[]> {
    const r = await this.http.get<{ data?: MemberRecord[] }>("/tenant/members");
    return (r as { data?: MemberRecord[] }).data ?? (r as MemberRecord[]) ?? [];
  }

  async invite(email: string, role: string): Promise<MemberRecord> {
    const r = await this.http.post<{ data?: MemberRecord }>("/tenant/members", {
      email,
      role,
    });
    return (r as { data?: MemberRecord }).data ?? (r as MemberRecord);
  }

  async updateRole(memberId: string, role: string): Promise<MemberRecord> {
    const r = await this.http.patch<{ data?: MemberRecord }>(
      `/tenant/members/${memberId}/role`,
      { role },
    );
    return (r as { data?: MemberRecord }).data ?? (r as MemberRecord);
  }

  async remove(memberId: string): Promise<void> {
    await this.http.delete<unknown>(`/tenant/members/${memberId}`);
  }

  async transferOwnership(
    newOwnerUserId: string,
  ): Promise<Record<string, unknown>> {
    const r = await this.http.post<{ data?: Record<string, unknown> }>(
      "/tenant/transfer-ownership",
      { new_owner_user_id: newOwnerUserId },
    );
    return (
      (r as { data?: Record<string, unknown> }).data ??
      (r as Record<string, unknown>)
    );
  }
}

// ── Tenant events ─────────────────────────────────────────────────────────────

export interface AdminStreamEvent {
  _event_type?: string;
  [key: string]: unknown;
}

export class TenantEventStreamResource {
  constructor(private readonly http: HttpClient) {}

  stream(options?: {
    types?: string[];
    scope?: string;
  }): AsyncIterableIterator<AdminStreamEvent> {
    const params = new URLSearchParams();
    if (options?.types?.length) params.set("types", options.types.join(","));
    if (options?.scope) params.set("scope", options.scope);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return this.http.stream<AdminStreamEvent>(`/tenant/events/stream${qs}`);
  }
}

// ── GovernanceTenant ──────────────────────────────────────────────────────────

export class GovernanceTenant {
  readonly policy: TenantPolicy;
  readonly members: TenantMembersResource;
  readonly events: TenantEventStreamResource;

  constructor(http: HttpClient) {
    this.policy = new TenantPolicy(http);
    this.members = new TenantMembersResource(http);
    this.events = new TenantEventStreamResource(http);
  }

  async current(): Promise<Record<string, unknown>> {
    return (await this.policy["http" as never]) as never;
  }
}

// ── Workspace sub-resources ────────────────────────────────────────────────────

export class WorkspaceMembersResource {
  constructor(
    private readonly http: HttpClient,
    private readonly workspaceId: string,
  ) {}

  async list(): Promise<MemberRecord[]> {
    const r = await this.http.get<{ data?: MemberRecord[] }>(
      `/workspaces/${this.workspaceId}/members`,
    );
    return (r as { data?: MemberRecord[] }).data ?? (r as MemberRecord[]) ?? [];
  }

  async invite(email: string, role: string): Promise<MemberRecord> {
    const r = await this.http.post<{ data?: MemberRecord }>(
      `/workspaces/${this.workspaceId}/members`,
      { email, role },
    );
    return (r as { data?: MemberRecord }).data ?? (r as MemberRecord);
  }

  async updateRole(memberId: string, role: string): Promise<MemberRecord> {
    const r = await this.http.patch<{ data?: MemberRecord }>(
      `/workspaces/${this.workspaceId}/members/${memberId}/role`,
      { role },
    );
    return (r as { data?: MemberRecord }).data ?? (r as MemberRecord);
  }

  async remove(memberId: string): Promise<void> {
    await this.http.delete<unknown>(
      `/workspaces/${this.workspaceId}/members/${memberId}`,
    );
  }
}

export class WorkspaceProxy {
  readonly policy: WorkspacePolicyResource;
  readonly members: WorkspaceMembersResource;

  constructor(
    private readonly http: HttpClient,
    private readonly workspaceId: string,
  ) {
    this.policy = new WorkspacePolicyResource(http, workspaceId);
    this.members = new WorkspaceMembersResource(http, workspaceId);
  }

  async transfer(
    resourceIds: string[],
    targetWorkspaceId: string,
  ): Promise<Record<string, unknown>> {
    const r = await this.http.post<{ data?: Record<string, unknown> }>(
      `/workspaces/${this.workspaceId}/transfer`,
      { resource_ids: resourceIds, target_workspace_id: targetWorkspaceId },
    );
    return (
      (r as { data?: Record<string, unknown> }).data ??
      (r as Record<string, unknown>)
    );
  }
}

// ── GovernanceWorkspaces ──────────────────────────────────────────────────────

export class GovernanceWorkspaces {
  constructor(private readonly http: HttpClient) {}

  /** client.workspaces("ws_id") → proxy with .policy, .members, .transfer() */
  workspace(workspaceId: string): WorkspaceProxy {
    return new WorkspaceProxy(this.http, workspaceId);
  }

  async list(): Promise<Record<string, unknown>[]> {
    const r = await this.http.get<{ data?: Record<string, unknown>[] }>(
      "/workspaces",
    );
    const items =
      (r as { data?: Record<string, unknown>[] }).data ??
      (r as Record<string, unknown>[]);
    return Array.isArray(items) ? items : [];
  }

  async create(
    name: string,
    opts?: { description?: string; metadata?: Record<string, unknown> },
  ): Promise<Record<string, unknown>> {
    const r = await this.http.post<{ data?: Record<string, unknown> }>(
      "/workspaces",
      { name, ...opts },
    );
    return (
      (r as { data?: Record<string, unknown> }).data ??
      (r as Record<string, unknown>)
    );
  }

  async get(workspaceId: string): Promise<Record<string, unknown>> {
    const r = await this.http.get<{ data?: Record<string, unknown> }>(
      `/workspaces/${workspaceId}`,
    );
    return (
      (r as { data?: Record<string, unknown> }).data ??
      (r as Record<string, unknown>)
    );
  }

  async update(
    workspaceId: string,
    fields: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const r = await this.http.patch<{ data?: Record<string, unknown> }>(
      `/workspaces/${workspaceId}`,
      fields,
    );
    return (
      (r as { data?: Record<string, unknown> }).data ??
      (r as Record<string, unknown>)
    );
  }

  async delete(workspaceId: string): Promise<void> {
    await this.http.delete<unknown>(`/workspaces/${workspaceId}`);
  }
}

// ── Bulk ops ──────────────────────────────────────────────────────────────────

function bulkBody(opts: {
  ids?: string[];
  filter?: Record<string, unknown>;
}): Record<string, unknown> {
  if (opts.ids !== undefined) return { ids: opts.ids };
  if (opts.filter !== undefined) return { filter: opts.filter };
  throw new Error("Provide either ids or filter");
}

export class BulkSandboxesResource {
  constructor(private readonly http: HttpClient) {}

  async pause(opts: {
    ids?: string[];
    filter?: Record<string, unknown>;
  }): Promise<BulkJobResponse> {
    return this.http.post<BulkJobResponse>(
      "/bulk/sandboxes/pause",
      bulkBody(opts),
    );
  }

  async resume(opts: {
    ids?: string[];
    filter?: Record<string, unknown>;
  }): Promise<BulkJobResponse> {
    return this.http.post<BulkJobResponse>(
      "/bulk/sandboxes/resume",
      bulkBody(opts),
    );
  }

  async destroy(opts: {
    ids?: string[];
    filter?: Record<string, unknown>;
  }): Promise<BulkJobResponse> {
    return this.http.post<BulkJobResponse>(
      "/bulk/sandboxes/destroy",
      bulkBody(opts),
    );
  }
}

export class BulkPolicyResource {
  constructor(private readonly http: HttpClient) {}

  async apply(opts: {
    tier: string;
    idsOrFilter: string[] | Record<string, unknown>;
    policy: PolicyDoc;
  }): Promise<BulkJobResponse> {
    const body: Record<string, unknown> = {
      tier: opts.tier,
      policy: opts.policy,
    };
    if (Array.isArray(opts.idsOrFilter)) {
      body["ids"] = opts.idsOrFilter;
    } else {
      body["filter"] = opts.idsOrFilter;
    }
    return this.http.post<BulkJobResponse>("/bulk/policy/apply", body);
  }
}

export class BulkJobsResource {
  constructor(private readonly http: HttpClient) {}

  async get(jobId: string): Promise<BulkJobStatus> {
    const r = await this.http.get<{ data?: BulkJobStatus }>(
      `/bulk/jobs/${jobId}`,
    );
    return (r as { data?: BulkJobStatus }).data ?? (r as BulkJobStatus);
  }
}

export class BulkResource {
  readonly sandboxes: BulkSandboxesResource;
  readonly policy: BulkPolicyResource;
  readonly jobs: BulkJobsResource;

  constructor(http: HttpClient) {
    this.sandboxes = new BulkSandboxesResource(http);
    this.policy = new BulkPolicyResource(http);
    this.jobs = new BulkJobsResource(http);
  }
}

// ── Billing ───────────────────────────────────────────────────────────────────

export class BillingInvoicesResource {
  constructor(private readonly http: HttpClient) {}

  async list(opts?: { limit?: number; cursor?: string }): Promise<Invoice[]> {
    const params = new URLSearchParams();
    if (opts?.limit !== undefined) params.set("limit", String(opts.limit));
    if (opts?.cursor) params.set("cursor", opts.cursor);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const r = await this.http.get<{ data?: Invoice[] }>(
      `/billing/invoices${qs}`,
    );
    return (r as { data?: Invoice[] }).data ?? (r as Invoice[]) ?? [];
  }

  async get(invoiceId: string): Promise<Invoice> {
    const r = await this.http.get<{ data?: Invoice }>(
      `/billing/invoices/${invoiceId}`,
    );
    return (r as { data?: Invoice }).data ?? (r as Invoice);
  }
}

export class BillingResource {
  readonly invoices: BillingInvoicesResource;

  constructor(private readonly http: HttpClient) {
    this.invoices = new BillingInvoicesResource(http);
  }

  async paymentMethods(): Promise<PaymentMethod[]> {
    const r = await this.http.get<{ data?: PaymentMethod[] }>(
      "/billing/payment-methods",
    );
    return (
      (r as { data?: PaymentMethod[] }).data ?? (r as PaymentMethod[]) ?? []
    );
  }

  async upcoming(): Promise<Record<string, unknown>> {
    const r = await this.http.get<{ data?: Record<string, unknown> }>(
      "/billing/upcoming",
    );
    return (
      (r as { data?: Record<string, unknown> }).data ??
      (r as Record<string, unknown>)
    );
  }
}
