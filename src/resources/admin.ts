import type { HttpClient } from "../http.js";

type Json = Record<string, unknown>;
type Query = Record<string, string | number | boolean | undefined>;

function withDefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out as Partial<T>;
}

export interface ListAdminUsersParams {
  limit?: number;
  cursor?: string;
  q?: string;
  status?: "active" | "suspended" | "deleted";
}

export interface ListAdminTenantsParams {
  limit?: number;
  cursor?: string;
  q?: string;
}

export interface ListAdminComputersParams {
  limit?: number;
  cursor?: string;
  status?:
    | "creating"
    | "provisioning"
    | "running"
    | "stopped"
    | "paused"
    | "error";
  tenantId?: string;
}

export interface ListAdminApiKeysParams {
  limit?: number;
  cursor?: string;
  tenantId?: string;
  status?: "active" | "revoked" | "expired";
}

export interface CreateAdminApiKeyParams {
  name: string;
  tenantId: string;
  userId: string;
  keyType?: "user" | "admin" | "platform";
  purpose?: "api" | "optimal";
  rateLimitRpm?: number;
  expiresAt?: string;
  allowedIps?: string[];
}

export interface BulkUserActionParams {
  userIds: string[];
  action: "suspend" | "unsuspend" | "delete" | "tag" | "notify";
  params?: Json;
}

/**
 * Admin surface — `/api/v1/admin/*` endpoints.
 *
 * Requires a `msk_a_*` or `msk_p_*` API key, or an admin JWT. Calls from
 * a user-role credential return 403 Forbidden.
 */
export class Admin {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** Escape hatch — call any admin endpoint by method + path. */
  async request<T = Json>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    body?: unknown,
    query?: Query,
  ): Promise<T> {
    const fullPath = query
      ? (() => {
          const qs = new URLSearchParams();
          for (const [k, v] of Object.entries(query)) {
            if (v !== undefined) qs.set(k, String(v));
          }
          const s = qs.toString();
          return s ? `${path}?${s}` : path;
        })()
      : path;
    // Route via the low-level method helpers so retries/backoff still apply.
    switch (method) {
      case "GET":
        return this.http.get<T>(fullPath);
      case "POST":
        return this.http.post<T>(fullPath, body);
      case "PUT":
        return this.http.put<T>(fullPath, body);
      case "PATCH":
        return this.http.patch<T>(fullPath, body);
      case "DELETE":
        return this.http.delete<T>(fullPath, body);
    }
  }

  // ── Overview ────────────────────────────────────────────────

  dashboard(): Promise<Json> {
    return this.http.get("/admin/dashboard");
  }
  stats(): Promise<Json> {
    return this.http.get("/admin/stats");
  }
  auditLog(params?: { limit?: number; cursor?: string }): Promise<Json> {
    return this.http.get("/admin/audit-log", {
      limit: params?.limit,
      cursor: params?.cursor,
    });
  }
  detailedHealth(): Promise<Json> {
    return this.http.get("/admin/health/detailed");
  }

  // ── Credits ─────────────────────────────────────────────────

  grantCredits(params: {
    tenantId: string;
    amount: number;
    description: string;
    expiresAt?: string;
  }): Promise<Json> {
    return this.http.post(
      "/admin/credits/grant",
      withDefined({
        tenant_id: params.tenantId,
        amount: params.amount,
        description: params.description,
        expires_at: params.expiresAt,
      }),
    );
  }
  deductCredits(params: {
    tenantId: string;
    amount: number;
    description: string;
  }): Promise<Json> {
    return this.http.post("/admin/credits/deduct", {
      tenant_id: params.tenantId,
      amount: params.amount,
      description: params.description,
    });
  }
  refundCredits(params: {
    tenantId: string;
    amount: number;
    description: string;
    transactionId?: string;
  }): Promise<Json> {
    return this.http.post(
      "/admin/credits/refund",
      withDefined({
        tenant_id: params.tenantId,
        amount: params.amount,
        description: params.description,
        transaction_id: params.transactionId,
      }),
    );
  }
  tenantBalance(tenantId: string): Promise<Json> {
    return this.http.get(`/admin/credits/${tenantId}/balance`);
  }
  tenantCreditHistory(
    tenantId: string,
    params?: { limit?: number; cursor?: string },
  ): Promise<Json> {
    return this.http.get(`/admin/credits/${tenantId}/history`, {
      limit: params?.limit,
      cursor: params?.cursor,
    });
  }

  // ── Users ───────────────────────────────────────────────────

  listUsers(params?: ListAdminUsersParams): Promise<Json> {
    return this.http.get("/admin/users", {
      limit: params?.limit,
      cursor: params?.cursor,
      q: params?.q,
      status: params?.status,
    });
  }
  getUser(userId: string): Promise<Json> {
    return this.http.get(`/admin/users/${userId}`);
  }
  updateUser(userId: string, attrs: Json): Promise<Json> {
    return this.http.put(`/admin/users/${userId}`, attrs);
  }
  deleteUser(userId: string): Promise<Json> {
    return this.http.delete(`/admin/users/${userId}`);
  }
  changeUserRole(
    userId: string,
    role: "user" | "admin" | "owner" | "super_admin",
  ): Promise<Json> {
    return this.http.post(`/admin/users/${userId}/role`, { role });
  }
  forceLogout(userId: string): Promise<Json> {
    return this.http.post(`/admin/users/${userId}/force-logout`);
  }
  suspendUser(userId: string, reason?: string): Promise<Json> {
    return this.http.post(
      `/admin/users/${userId}/suspend`,
      reason ? { reason } : undefined,
    );
  }
  unsuspendUser(userId: string): Promise<Json> {
    return this.http.post(`/admin/users/${userId}/unsuspend`);
  }
  banUser(userId: string, reason: string, expiresAt?: string): Promise<Json> {
    return this.http.post(
      `/admin/users/${userId}/ban`,
      withDefined({ reason, expires_at: expiresAt }),
    );
  }
  unbanUser(userId: string): Promise<Json> {
    return this.http.post(`/admin/users/${userId}/unban`);
  }
  bulkUserAction(params: BulkUserActionParams): Promise<Json> {
    return this.http.post(
      "/admin/users/bulk",
      withDefined({
        user_ids: params.userIds,
        action: params.action,
        params: params.params,
      }),
    );
  }

  // ── Tenants ─────────────────────────────────────────────────

  listTenants(params?: ListAdminTenantsParams): Promise<Json> {
    return this.http.get("/admin/tenants", {
      limit: params?.limit,
      cursor: params?.cursor,
      q: params?.q,
    });
  }
  tenantDetail(tenantId: string): Promise<Json> {
    return this.http.get(`/admin/tenants/${tenantId}/detail`);
  }
  suspendTenant(tenantId: string, reason?: string): Promise<Json> {
    return this.http.post(
      `/admin/tenants/${tenantId}/suspend`,
      reason ? { reason } : undefined,
    );
  }
  unsuspendTenant(tenantId: string): Promise<Json> {
    return this.http.post(`/admin/tenants/${tenantId}/unsuspend`);
  }
  changeTenantPlan(
    tenantId: string,
    plan: "free" | "starter" | "pro" | "scale",
    prorate = true,
  ): Promise<Json> {
    return this.http.post(`/admin/tenants/${tenantId}/plan`, { plan, prorate });
  }
  deleteTenant(tenantId: string): Promise<Json> {
    return this.http.delete(`/admin/tenants/${tenantId}`);
  }

  // ── Computers ───────────────────────────────────────────────

  listComputers(params?: ListAdminComputersParams): Promise<Json> {
    return this.http.get("/admin/computers", {
      limit: params?.limit,
      cursor: params?.cursor,
      status: params?.status,
      tenant_id: params?.tenantId,
    });
  }
  deleteComputer(computerId: string): Promise<Json> {
    return this.http.delete(`/admin/computers/${computerId}`);
  }
  suspendComputer(computerId: string): Promise<Json> {
    return this.http.post(`/admin/computers/${computerId}/suspend`);
  }
  resumeComputer(computerId: string): Promise<Json> {
    return this.http.post(`/admin/computers/${computerId}/resume`);
  }
  restartComputer(computerId: string): Promise<Json> {
    return this.http.post(`/admin/computers/${computerId}/restart`);
  }
  purgeStaleComputers(): Promise<Json> {
    return this.http.post("/admin/computers/purge-stale");
  }

  // ── API Keys ────────────────────────────────────────────────

  listApiKeys(params?: ListAdminApiKeysParams): Promise<Json> {
    return this.http.get("/admin/api-keys", {
      limit: params?.limit,
      cursor: params?.cursor,
      tenant_id: params?.tenantId,
      status: params?.status,
    });
  }
  createApiKey(params: CreateAdminApiKeyParams): Promise<Json> {
    return this.http.post(
      "/admin/api-keys",
      withDefined({
        name: params.name,
        tenant_id: params.tenantId,
        user_id: params.userId,
        key_type: params.keyType ?? "user",
        purpose: params.purpose ?? "api",
        rate_limit_rpm: params.rateLimitRpm,
        expires_at: params.expiresAt,
        allowed_ips: params.allowedIps,
      }),
    );
  }
  apiKeyStats(): Promise<Json> {
    return this.http.get("/admin/api-keys/stats");
  }
  bulkRevokeApiKeys(keyIds: string[]): Promise<Json> {
    return this.http.post("/admin/api-keys/bulk-revoke", { key_ids: keyIds });
  }
  revokeApiKey(keyId: string): Promise<Json> {
    return this.http.delete(`/admin/api-keys/${keyId}`);
  }

  // ── Optimal ─────────────────────────────────────────────────

  optimalStatus(): Promise<Json> {
    return this.http.get("/admin/optimal/status");
  }
  listOptimalModels(): Promise<Json> {
    return this.http.get("/admin/optimal/models");
  }
  switchOptimalModel(modelId: string): Promise<Json> {
    return this.http.post("/admin/optimal/models/switch", {
      model_id: modelId,
    });
  }

  /** POST /api/v1/admin/impersonate — returns {token, expires_at}. */
  impersonate(
    externalUserId: string,
    options: { ttlSec?: number } = {},
  ): Promise<{ token: string; expires_at: string }> {
    return this.http.post("/admin/impersonate", {
      external_user_id: externalUserId,
      ttl_sec: options.ttlSec ?? 3600,
    });
  }
}
