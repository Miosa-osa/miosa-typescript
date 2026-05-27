import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../http.js";
import {
  BillingResource,
  BulkResource,
  ExternalUsers,
  GovernanceTenant,
  GovernanceWorkspaces,
} from "./governance.js";
import { ApiKeys } from "./api-keys.js";
import { Admin } from "./admin.js";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();
const mockStream = vi.fn();
const mockRequest = vi.fn();

function makeHttp(): HttpClient {
  return {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    patch: mockPatch,
    delete: mockDelete,
    request: mockRequest,
    stream: mockStream,
  } as unknown as HttpClient;
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ── GovernanceTenant.policy ───────────────────────────────────────────────────

describe("GovernanceTenant.policy", () => {
  it("get calls GET /tenant/policy and unwraps data", async () => {
    mockGet.mockResolvedValue({ data: { quotas: { max_sandboxes: 10 } } });
    const t = new GovernanceTenant(makeHttp());
    const result = await t.policy.get();
    expect(mockGet).toHaveBeenCalledWith("/tenant/policy");
    expect((result as Record<string, unknown>).quotas).toBeDefined();
  });

  it("set calls PUT /tenant/policy with body", async () => {
    mockPut.mockResolvedValue({ data: { quotas: { max_sandboxes: 5 } } });
    const t = new GovernanceTenant(makeHttp());
    await t.policy.set({ quotas: { max_sandboxes: 5 } });
    expect(mockPut).toHaveBeenCalledWith("/tenant/policy", {
      quotas: { max_sandboxes: 5 },
    });
  });

  it("delete calls DELETE /tenant/policy", async () => {
    mockDelete.mockResolvedValue(null);
    const t = new GovernanceTenant(makeHttp());
    await t.policy.delete();
    expect(mockDelete).toHaveBeenCalledWith("/tenant/policy");
  });
});

// ── GovernanceTenant.members ──────────────────────────────────────────────────

describe("GovernanceTenant.members", () => {
  it("list returns members array", async () => {
    mockGet.mockResolvedValue({
      data: [{ id: "m1", email: "a@b.com", role: "admin" }],
    });
    const t = new GovernanceTenant(makeHttp());
    const members = await t.members.list();
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe("admin");
  });

  it("invite posts email and role", async () => {
    mockPost.mockResolvedValue({ data: { id: "m2", role: "developer" } });
    const t = new GovernanceTenant(makeHttp());
    const result = await t.members.invite("x@y.com", "developer");
    expect(mockPost).toHaveBeenCalledWith("/tenant/members", {
      email: "x@y.com",
      role: "developer",
    });
    expect(result.role).toBe("developer");
  });

  it("updateRole patches member role", async () => {
    mockPatch.mockResolvedValue({ data: { id: "m1", role: "admin" } });
    const t = new GovernanceTenant(makeHttp());
    await t.members.updateRole("m1", "admin");
    expect(mockPatch).toHaveBeenCalledWith("/tenant/members/m1/role", {
      role: "admin",
    });
  });

  it("remove deletes member", async () => {
    mockDelete.mockResolvedValue(null);
    const t = new GovernanceTenant(makeHttp());
    await t.members.remove("m1");
    expect(mockDelete).toHaveBeenCalledWith("/tenant/members/m1");
  });

  it("transferOwnership posts new_owner_user_id", async () => {
    mockPost.mockResolvedValue({ data: { transferred: true } });
    const t = new GovernanceTenant(makeHttp());
    await t.members.transferOwnership("user_new");
    expect(mockPost).toHaveBeenCalledWith("/tenant/transfer-ownership", {
      new_owner_user_id: "user_new",
    });
  });
});

// ── GovernanceWorkspaces ──────────────────────────────────────────────────────

describe("GovernanceWorkspaces", () => {
  it("list returns workspace array", async () => {
    mockGet.mockResolvedValue({ data: [{ id: "ws_1", name: "alpha" }] });
    const gw = new GovernanceWorkspaces(makeHttp());
    const items = await gw.list();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("ws_1");
  });

  it("create posts name", async () => {
    mockPost.mockResolvedValue({ data: { id: "ws_2", name: "beta" } });
    const gw = new GovernanceWorkspaces(makeHttp());
    await gw.create("beta");
    expect(mockPost).toHaveBeenCalledWith("/workspaces", { name: "beta" });
  });

  it("workspace(id).policy.get calls correct path", async () => {
    mockGet.mockResolvedValue({ data: { quotas: {} } });
    const gw = new GovernanceWorkspaces(makeHttp());
    await gw.workspace("ws_1").policy.get();
    expect(mockGet).toHaveBeenCalledWith("/workspaces/ws_1/policy");
  });

  it("workspace(id).policy.set calls PUT", async () => {
    mockPut.mockResolvedValue({ data: {} });
    const gw = new GovernanceWorkspaces(makeHttp());
    await gw.workspace("ws_1").policy.set({ quotas: { max_sandboxes: 3 } });
    expect(mockPut).toHaveBeenCalledWith("/workspaces/ws_1/policy", {
      quotas: { max_sandboxes: 3 },
    });
  });

  it("workspace(id).members.list calls correct path", async () => {
    mockGet.mockResolvedValue({ data: [{ id: "m1", role: "developer" }] });
    const gw = new GovernanceWorkspaces(makeHttp());
    const members = await gw.workspace("ws_1").members.list();
    expect(mockGet).toHaveBeenCalledWith("/workspaces/ws_1/members");
    expect(members[0].role).toBe("developer");
  });

  it("workspace(id).members.invite posts correctly", async () => {
    mockPost.mockResolvedValue({ data: { id: "m2" } });
    const gw = new GovernanceWorkspaces(makeHttp());
    await gw.workspace("ws_1").members.invite("bob@acme.com", "viewer");
    expect(mockPost).toHaveBeenCalledWith("/workspaces/ws_1/members", {
      email: "bob@acme.com",
      role: "viewer",
    });
  });

  it("workspace(id).transfer posts resource_ids and target", async () => {
    mockPost.mockResolvedValue({ data: { transferred: 2 } });
    const gw = new GovernanceWorkspaces(makeHttp());
    await gw.workspace("ws_1").transfer(["sbx_1", "sbx_2"], "ws_2");
    expect(mockPost).toHaveBeenCalledWith("/workspaces/ws_1/transfer", {
      resource_ids: ["sbx_1", "sbx_2"],
      target_workspace_id: "ws_2",
    });
  });
});

// ── ExternalUsers.policy ──────────────────────────────────────────────────────

describe("ExternalUsers.policy", () => {
  it("get calls correct path", async () => {
    mockGet.mockResolvedValue({ data: { lifecycle: {} } });
    const eu = new ExternalUsers(makeHttp());
    await eu.call("alice").policy.get();
    expect(mockGet).toHaveBeenCalledWith("/external-users/alice/policy");
  });

  it("effective returns typed EffectivePolicyDoc with source fields", async () => {
    mockGet.mockResolvedValue({
      lifecycle: {
        default_idle_timeout_sec: { value: 600, source: "user" },
        default_timeout_sec: { value: 86400, source: "tenant" },
      },
      quotas: {
        max_sandboxes: { value: 5, source: "workspace" },
      },
    });
    const eu = new ExternalUsers(makeHttp());
    const eff = await eu.call("alice").policy.effective();
    expect(eff.lifecycle["default_idle_timeout_sec"]?.value).toBe(600);
    expect(eff.lifecycle["default_idle_timeout_sec"]?.source).toBe("user");
    expect(eff.quotas["max_sandboxes"]?.value).toBe(5);
    expect(eff.quotas["max_sandboxes"]?.source).toBe("workspace");
  });
});

// ── BulkResource ──────────────────────────────────────────────────────────────

describe("BulkResource", () => {
  it("sandboxes.pause posts ids", async () => {
    mockPost.mockResolvedValue({ queued: 3, job_id: "job_1" });
    const bulk = new BulkResource(makeHttp());
    const result = await bulk.sandboxes.pause({
      ids: ["sbx_1", "sbx_2", "sbx_3"],
    });
    expect(mockPost).toHaveBeenCalledWith("/bulk/sandboxes/pause", {
      ids: ["sbx_1", "sbx_2", "sbx_3"],
    });
    expect(result.job_id).toBe("job_1");
  });

  it("sandboxes.destroy posts filter", async () => {
    mockPost.mockResolvedValue({ queued: 5, job_id: "job_2" });
    const bulk = new BulkResource(makeHttp());
    const result = await bulk.sandboxes.destroy({ filter: { state: "idle" } });
    expect(mockPost).toHaveBeenCalledWith("/bulk/sandboxes/destroy", {
      filter: { state: "idle" },
    });
    expect(result.queued).toBe(5);
  });

  it("policy.apply posts tier + ids + policy", async () => {
    mockPost.mockResolvedValue({ queued: 10, job_id: "job_3" });
    const bulk = new BulkResource(makeHttp());
    await bulk.policy.apply({
      tier: "external_user",
      idsOrFilter: ["u1", "u2"],
      policy: { quotas: { max_sandboxes: 3 } },
    });
    expect(mockPost).toHaveBeenCalledWith("/bulk/policy/apply", {
      tier: "external_user",
      ids: ["u1", "u2"],
      policy: { quotas: { max_sandboxes: 3 } },
    });
  });

  it("jobs.get returns job status", async () => {
    mockGet.mockResolvedValue({
      data: { id: "job_1", status: "completed", processed: 3 },
    });
    const bulk = new BulkResource(makeHttp());
    const job = await bulk.jobs.get("job_1");
    expect(job.status).toBe("completed");
    expect(job.processed).toBe(3);
  });
});

// ── BillingResource ───────────────────────────────────────────────────────────

describe("BillingResource", () => {
  it("invoices.list returns array", async () => {
    mockGet.mockResolvedValue({
      data: [{ id: "inv_1", amount: 5000 }],
    });
    const billing = new BillingResource(makeHttp());
    const invoices = await billing.invoices.list();
    expect(invoices[0].id).toBe("inv_1");
  });

  it("invoices.get returns single invoice", async () => {
    mockGet.mockResolvedValue({
      data: { id: "inv_1", amount: 5000, line_items: [] },
    });
    const billing = new BillingResource(makeHttp());
    const inv = await billing.invoices.get("inv_1");
    expect(inv.id).toBe("inv_1");
  });

  it("paymentMethods returns list", async () => {
    mockGet.mockResolvedValue({
      data: [{ id: "pm_1", brand: "visa", last4: "4242" }],
    });
    const billing = new BillingResource(makeHttp());
    const methods = await billing.paymentMethods();
    expect(methods[0].brand).toBe("visa");
  });

  it("upcoming returns preview", async () => {
    mockGet.mockResolvedValue({
      data: { amount: 1200, period_end: "2026-06-01" },
    });
    const billing = new BillingResource(makeHttp());
    const upcoming = await billing.upcoming();
    expect((upcoming as Record<string, unknown>).amount).toBe(1200);
  });
});

// ── ApiKeys.createScoped ──────────────────────────────────────────────────────

describe("ApiKeys.createScoped", () => {
  it("posts to /api-keys/scoped with correct body", async () => {
    mockPost.mockResolvedValue({
      data: { id: "key_1", token: "msk_l2_abc" },
    });
    const keys = new ApiKeys(makeHttp());
    const result = await keys.createScoped({
      externalUserId: "alice-42",
      scopes: ["sandboxes:read", "sandboxes:exec"],
      expiresAt: "2026-12-31T00:00:00Z",
    });
    expect(mockPost).toHaveBeenCalledWith("/api-keys/scoped", {
      external_user_id: "alice-42",
      scopes: ["sandboxes:read", "sandboxes:exec"],
      expires_at: "2026-12-31T00:00:00Z",
    });
    expect(result.token).toBe("msk_l2_abc");
  });

  it("omits expires_at when not provided", async () => {
    mockPost.mockResolvedValue({ data: { id: "key_2" } });
    const keys = new ApiKeys(makeHttp());
    await keys.createScoped({
      externalUserId: "bob",
      scopes: ["sandboxes:read"],
    });
    const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body["expires_at"]).toBeUndefined();
  });
});

// ── Admin.impersonate ─────────────────────────────────────────────────────────

describe("Admin.impersonate", () => {
  it("posts to /admin/impersonate with external_user_id and ttl_sec", async () => {
    mockPost.mockResolvedValue({
      token: "msi_abc",
      expires_at: "2026-06-01T00:00:00Z",
    });
    const admin = new Admin(makeHttp());
    const result = await admin.impersonate("alice-42", { ttlSec: 1800 });
    expect(mockPost).toHaveBeenCalledWith("/admin/impersonate", {
      external_user_id: "alice-42",
      ttl_sec: 1800,
    });
    expect(result.token).toBe("msi_abc");
  });

  it("defaults ttl_sec to 3600", async () => {
    mockPost.mockResolvedValue({ token: "msi_xyz" });
    const admin = new Admin(makeHttp());
    await admin.impersonate("bob");
    const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body["ttl_sec"]).toBe(3600);
  });
});
