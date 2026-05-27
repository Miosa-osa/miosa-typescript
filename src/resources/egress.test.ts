import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../http.js";
import { EgressAudit, SandboxAudit } from "./egressAudit.js";
import { EgressNetwork, SandboxNetwork } from "./egressNetwork.js";
import { EgressSecrets, OAuthFlow, SandboxSecrets } from "./egressSecrets.js";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();
const mockRequest = vi.fn();
const mockStream = vi.fn();
const mockGetBinary = vi.fn();

function makeHttp(): HttpClient {
  const http = {} as HttpClient;
  http.get = mockGet;
  http.post = mockPost;
  http.patch = mockPatch;
  http.delete = mockDelete;
  http.request = mockRequest;
  http.stream = mockStream;
  http.getBinary = mockGetBinary;
  return http;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── client.secrets ──────────────────────────────────────────────────────────

describe("EgressSecrets", () => {
  it("set() POSTs to /egress/secrets with the right body", async () => {
    mockPost.mockResolvedValue({
      data: { id: "sec_1", name: "OPENAI_API_KEY" },
    });

    const client = new EgressSecrets(makeHttp());
    const secret = await client.set({
      name: "OPENAI_API_KEY",
      value: "sk-abc123",
      type: "api_key",
      scope: "user",
      exposeAsEnv: "OPENAI_API_KEY",
    });

    expect(mockPost).toHaveBeenCalledWith("/egress/secrets", {
      name: "OPENAI_API_KEY",
      value: "sk-abc123",
      type: "api_key",
      scope: "user",
      expose_as_env: "OPENAI_API_KEY",
    });
    expect(secret.id).toBe("sec_1");
  });

  it("list({ scope: 'user' }) GETs /egress/secrets?scope=user", async () => {
    mockGet.mockResolvedValue({ data: [{ id: "sec_1" }, { id: "sec_2" }] });

    const result = await new EgressSecrets(makeHttp()).list({ scope: "user" });

    expect(mockGet).toHaveBeenCalledWith("/egress/secrets", { scope: "user" });
    expect(result).toHaveLength(2);
  });

  it("get() calls /egress/secrets/:id", async () => {
    mockGet.mockResolvedValue({ data: { id: "sec_1" } });
    await new EgressSecrets(makeHttp()).get("sec_1");
    expect(mockGet).toHaveBeenCalledWith("/egress/secrets/sec_1");
  });

  it("rotate() PATCHes /egress/secrets/:id with new value", async () => {
    mockPatch.mockResolvedValue({ data: { id: "sec_1" } });
    await new EgressSecrets(makeHttp()).rotate("sec_1", {
      newValue: "sk-new",
      expiresAt: "2027-01-01T00:00:00Z",
    });
    expect(mockPatch).toHaveBeenCalledWith("/egress/secrets/sec_1", {
      value: "sk-new",
      expires_at: "2027-01-01T00:00:00Z",
    });
  });

  it("delete() DELETEs /egress/secrets/:id", async () => {
    mockDelete.mockResolvedValue(undefined);
    await new EgressSecrets(makeHttp()).delete("sec_1");
    expect(mockDelete).toHaveBeenCalledWith("/egress/secrets/sec_1");
  });

  it("connect() returns an OAuthFlow with authorizeUrl + state", async () => {
    mockPost.mockResolvedValue({
      data: {
        authorize_url: "https://github.com/login/oauth/authorize?state=xyz",
        state: "xyz",
      },
    });

    const flow = await new EgressSecrets(makeHttp()).connect({
      provider: "github",
      exposeAsEnv: "GITHUB_TOKEN",
    });

    expect(mockPost).toHaveBeenCalledWith("/egress/oauth/start", {
      provider: "github",
      expose_as_env: "GITHUB_TOKEN",
    });
    expect(flow).toBeInstanceOf(OAuthFlow);
    expect(flow.authorizeUrl).toBe(
      "https://github.com/login/oauth/authorize?state=xyz",
    );
    expect(flow.state).toBe("xyz");
  });

  it("OAuthFlow.waitForCompletion polls /egress/oauth/status", async () => {
    mockPost.mockResolvedValue({
      data: { authorize_url: "https://example.com", state: "xyz" },
    });
    mockGet.mockResolvedValueOnce({
      data: { status: "completed", secret_id: "sec_new" },
    });

    const flow = await new EgressSecrets(makeHttp()).connect({
      provider: "github",
    });
    const result = await flow.waitForCompletion({
      timeoutSec: 2,
      pollIntervalMs: 1,
    });

    expect(mockGet).toHaveBeenCalledWith("/egress/oauth/status", {
      state: "xyz",
    });
    expect(result.status).toBe("completed");
  });

  it("createBinding() POSTs to /egress/bindings", async () => {
    mockPost.mockResolvedValue({ data: { id: "bnd_1" } });
    await new EgressSecrets(makeHttp()).createBinding({
      secretId: "sec_1",
      resourceId: "sbx_1",
      resourceType: "sandbox",
      exposeAsEnv: "OPENAI_API_KEY",
    });
    expect(mockPost).toHaveBeenCalledWith("/egress/bindings", {
      secret_id: "sec_1",
      resource_id: "sbx_1",
      resource_type: "sandbox",
      expose_as_env: "OPENAI_API_KEY",
    });
  });

  it("providers() GETs /egress/oauth/providers", async () => {
    mockGet.mockResolvedValue({
      data: [{ name: "github" }, { name: "slack" }],
    });
    const out = await new EgressSecrets(makeHttp()).providers();
    expect(mockGet).toHaveBeenCalledWith("/egress/oauth/providers");
    expect(out).toHaveLength(2);
  });
});

// ─── client.network ──────────────────────────────────────────────────────────

describe("EgressNetwork", () => {
  it("allow() POSTs to /egress/allowlist with effect=allow", async () => {
    mockPost.mockResolvedValue({ data: { id: "rul_1" } });
    await new EgressNetwork(makeHttp()).allow("api.openai.com", {
      methods: ["GET", "POST"],
      pathGlob: "/v1/*",
    });
    expect(mockPost).toHaveBeenCalledWith("/egress/allowlist", {
      host: "api.openai.com",
      effect: "allow",
      methods: ["GET", "POST"],
      path_glob: "/v1/*",
    });
  });

  it("deny() POSTs with effect=deny", async () => {
    mockPost.mockResolvedValue({ data: { id: "rul_2" } });
    await new EgressNetwork(makeHttp()).deny("169.254.169.254");
    expect(mockPost).toHaveBeenCalledWith("/egress/allowlist", {
      host: "169.254.169.254",
      effect: "deny",
    });
  });

  it("lockdown() PATCHes /egress/policies with mode=enforce", async () => {
    mockPatch.mockResolvedValue({ data: {} });
    await new EgressNetwork(makeHttp()).lockdown();
    expect(mockPatch).toHaveBeenCalledWith("/egress/policies", {
      mode: "enforce",
    });
  });

  it("observe() PATCHes /egress/policies with mode=audit_only", async () => {
    mockPatch.mockResolvedValue({ data: {} });
    await new EgressNetwork(makeHttp()).observe();
    expect(mockPatch).toHaveBeenCalledWith("/egress/policies", {
      mode: "audit_only",
    });
  });

  it("suggestions() GETs /egress/audit/suggestions with resource_id", async () => {
    mockGet.mockResolvedValue({ data: [] });
    await new EgressNetwork(makeHttp()).suggestions({
      resourceId: "sbx_1",
      since: "1d",
    });
    expect(mockGet).toHaveBeenCalledWith("/egress/audit/suggestions", {
      resource_id: "sbx_1",
      since: "1d",
    });
  });

  it("policies() GETs /egress/policies", async () => {
    mockGet.mockResolvedValue({ data: [{ id: "pol_1" }] });
    const out = await new EgressNetwork(makeHttp()).policies();
    expect(mockGet).toHaveBeenCalledWith("/egress/policies", {});
    expect(out).toHaveLength(1);
  });

  it("removeRule() DELETEs /egress/allowlist/:id", async () => {
    mockDelete.mockResolvedValue(undefined);
    await new EgressNetwork(makeHttp()).removeRule("rul_1");
    expect(mockDelete).toHaveBeenCalledWith("/egress/allowlist/rul_1");
  });
});

// ─── client.audit ────────────────────────────────────────────────────────────

describe("EgressAudit", () => {
  it("list() GETs /egress/audit", async () => {
    mockGet.mockResolvedValue({
      data: [
        { id: "evt_1", host: "api.openai.com" },
        { id: "evt_2", host: "github.com" },
      ],
    });
    const out = await new EgressAudit(makeHttp()).list();
    expect(mockGet).toHaveBeenCalledWith("/egress/audit", {});
    expect(out).toHaveLength(2);
  });

  it("list() passes filters as query params", async () => {
    mockGet.mockResolvedValue({ data: [] });
    await new EgressAudit(makeHttp()).list({
      resourceId: "sbx_1",
      host: "api.openai.com",
      action: "denied",
      limit: 50,
    });
    expect(mockGet).toHaveBeenCalledWith("/egress/audit", {
      resource_id: "sbx_1",
      host: "api.openai.com",
      action: "denied",
      limit: 50,
    });
  });

  it("get() returns a single event", async () => {
    mockGet.mockResolvedValue({ data: { id: "evt_1" } });
    const out = await new EgressAudit(makeHttp()).get("evt_1");
    expect(mockGet).toHaveBeenCalledWith("/egress/audit/evt_1");
    expect(out.id).toBe("evt_1");
  });
});

// ─── sandbox.* scoped namespaces ─────────────────────────────────────────────

describe("Sandbox-scoped egress", () => {
  it("sandbox.secrets.set() injects resource_id + resource_type", async () => {
    mockPost.mockResolvedValue({ data: { id: "sec_1" } });
    await new SandboxSecrets(makeHttp(), "sbx_abc").set({
      name: "OPENAI_API_KEY",
      value: "sk-abc",
    });
    expect(mockPost).toHaveBeenCalledWith("/egress/secrets", {
      name: "OPENAI_API_KEY",
      value: "sk-abc",
      type: "api_key",
      scope: "user",
      resource_id: "sbx_abc",
      resource_type: "sandbox",
    });
  });

  it("sandbox.audit.list() includes resource_id in query params", async () => {
    mockGet.mockResolvedValue({ data: [] });
    await new SandboxAudit(makeHttp(), "sbx_abc").list();
    expect(mockGet).toHaveBeenCalledWith("/egress/audit", {
      resource_id: "sbx_abc",
      resource_type: "sandbox",
    });
  });

  it("sandbox.network.allow() scopes the rule to the sandbox", async () => {
    mockPost.mockResolvedValue({ data: { id: "rul_1" } });
    await new SandboxNetwork(makeHttp(), "sbx_abc").allow("api.openai.com");
    expect(mockPost).toHaveBeenCalledWith("/egress/allowlist", {
      host: "api.openai.com",
      effect: "allow",
      resource_id: "sbx_abc",
      resource_type: "sandbox",
    });
  });

  it("sandbox.network.lockdown() scopes the policy patch", async () => {
    mockPatch.mockResolvedValue({ data: {} });
    await new SandboxNetwork(makeHttp(), "sbx_abc").lockdown();
    expect(mockPatch).toHaveBeenCalledWith("/egress/policies", {
      mode: "enforce",
      resource_id: "sbx_abc",
      resource_type: "sandbox",
    });
  });
});
