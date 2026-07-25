import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../http.js";
import {
  ComputerConnectors,
  Connectors,
  DeploymentConnectors,
  SandboxConnectors,
} from "./connectors.js";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

function makeHttp(): HttpClient {
  return {
    get: mockGet,
    post: mockPost,
    delete: mockDelete,
  } as unknown as HttpClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Connectors", () => {
  it("lists Connect provider connectors", async () => {
    mockGet.mockResolvedValue({
      data: [{ uid: "anthropic/workspace-claude" }],
    });

    const out = await new Connectors(makeHttp()).list({
      scope: "workspace",
      workspaceId: "ws_123",
      externalWorkspaceId: "clinic-workspace",
    });

    expect(mockGet).toHaveBeenCalledWith("/connect/connectors", {
      scope: "workspace",
      workspace_id: "ws_123",
      external_workspace_id: "clinic-workspace",
    });
    expect(out[0]?.uid).toBe("anthropic/workspace-claude");
  });

  it("creates an API-key connector with canonical credential payload", async () => {
    mockPost.mockResolvedValue({
      data: { uid: "anthropic/workspace-claude" },
    });

    await new Connectors(makeHttp()).create("anthropic", {
      name: "workspace-claude",
      type: "api-key",
      value: "sk-ant-test",
      scope: "workspace",
      workspaceId: "ws_123",
      externalProjectId: "clinic-project",
    });

    expect(mockPost).toHaveBeenCalledWith("/connect/connectors", {
      name: "workspace-claude",
      type: "api_key",
      scope: "workspace",
      provider: "anthropic",
      uid: "anthropic/workspace-claude",
      workspace_id: "ws_123",
      external_project_id: "clinic-project",
      credential: {
        field: "api_key",
        value: "sk-ant-test",
      },
    });
  });

  it("requests a runtime token with Vercel-style subject and scopes", async () => {
    mockPost.mockResolvedValue({
      token: "provider-token",
      connector: { uid: "github/acme" },
    });

    const out = await new Connectors(makeHttp()).getToken("github/acme", {
      subject: { type: "app" },
      installationId: "inst_123",
      projectId: "prj_123",
      environment: "production",
      resourceType: "sandbox",
      resourceId: "sbx_123",
      scopes: ["repo:read"],
      externalWorkspaceId: "clinic-workspace",
      externalUserId: "clinic-user",
      externalProjectId: "clinic-project",
    });

    expect(mockPost).toHaveBeenCalledWith("/connect/token/github%2Facme", {
      subject: { type: "app" },
      installation_id: "inst_123",
      project_id: "prj_123",
      environment: "production",
      resource_type: "sandbox",
      resource_id: "sbx_123",
      scopes: ["repo:read"],
      external_user_id: "clinic-user",
      external_workspace_id: "clinic-workspace",
      external_project_id: "clinic-project",
    });
    expect(out.token).toBe("provider-token");
  });

  it("manages installations and project links", async () => {
    mockGet
      .mockResolvedValueOnce({ data: [{ id: "inst_row", installation_id: "default" }] })
      .mockResolvedValueOnce({ data: [{ id: "link_123" }] });
    mockPost.mockResolvedValue({ data: { id: "link_123", allowed_scopes: ["repo:read"] } });
    mockDelete.mockResolvedValue(undefined);

    const connectors = new Connectors(makeHttp());
    const installations = await connectors.installations({ workspaceId: "ws_123" });
    const link = await connectors.createProjectLink({
      connector: "github/workspace",
      installationId: "inst_row",
      projectId: "prj_123",
      environment: "production",
      allowedScopes: ["repo:read"],
      mode: "token-api",
      externalProjectId: "clinic-project",
    });
    const links = await connectors.projectLinks({ projectId: "prj_123" });
    await connectors.deleteProjectLink("link_123");

    expect(mockGet).toHaveBeenNthCalledWith(1, "/connect/installations", {
      workspace_id: "ws_123",
    });
    expect(mockPost).toHaveBeenCalledWith("/connect/project-links", {
      connector: "github/workspace",
      installation_id: "inst_row",
      project_id: "prj_123",
      environment: "production",
      allowed_scopes: ["repo:read"],
      mode: "token_api",
      external_project_id: "clinic-project",
    });
    expect(mockGet).toHaveBeenNthCalledWith(2, "/connect/project-links", {
      project_id: "prj_123",
    });
    expect(mockDelete).toHaveBeenCalledWith("/connect/project-links/link_123");
    expect(installations[0]?.installation_id).toBe("default");
    expect(link.allowed_scopes).toEqual(["repo:read"]);
    expect(links[0]?.id).toBe("link_123");
  });

  it("lists and starts OAuth provider authorization", async () => {
    mockGet.mockResolvedValue({
      data: [{ provider: "github", scopes: ["repo"] }],
    });
    mockPost.mockResolvedValue({
      data: { authorize_url: "https://github.com/login/oauth/authorize", state: "st_123" },
    });

    const connectors = new Connectors(makeHttp());
    const providers = await connectors.oauthProviders();
    const start = await connectors.startOauth({
      provider: "github",
      exposeAsEnv: true,
      ownerUserId: "user_123",
      externalUserId: "clinic-user",
    });

    expect(mockGet).toHaveBeenCalledWith("/connect/oauth/providers");
    expect(mockPost).toHaveBeenCalledWith("/connect/oauth/start", {
      provider: "github",
      expose_as_env: true,
      owner_user_id: "user_123",
      external_user_id: "clinic-user",
    });
    expect(providers[0]?.provider).toBe("github");
    expect(start.state).toBe("st_123");
  });

  it("manages inbound connector triggers", async () => {
    mockGet.mockResolvedValue({
      data: [{ id: "trg_123", destination_path: "/api/connect/slack" }],
    });
    mockPost.mockResolvedValue({
      data: {
        id: "trg_123",
        event_types: ["app_mention"],
        provider_adapter: "slack",
        webhook_token: "mct_secret",
        webhook_signing_secret: "mcs_secret",
      },
    });
    mockDelete.mockResolvedValue(undefined);

    const connectors = new Connectors(makeHttp());
    const created = await connectors.createTrigger({
      connector: "slack/workspace",
      projectId: "prj_123",
      environment: "production",
      destinationPath: "/api/connect/slack",
      eventTypes: ["app_mention"],
      providerAdapter: "slack",
      externalProjectId: "clinic-project",
    });
    const triggers = await connectors.triggers({ projectId: "prj_123" });
    await connectors.deleteTrigger("trg_123");

    expect(mockPost).toHaveBeenCalledWith("/connect/triggers", {
      connector: "slack/workspace",
      project_id: "prj_123",
      environment: "production",
      destination_path: "/api/connect/slack",
      event_types: ["app_mention"],
      provider_adapter: "slack",
      external_project_id: "clinic-project",
    });
    expect(mockGet).toHaveBeenCalledWith("/connect/triggers", {
      project_id: "prj_123",
    });
    expect(mockDelete).toHaveBeenCalledWith("/connect/triggers/trg_123");
    expect(created.id).toBe("trg_123");
    expect(created.webhook_token).toBe("mct_secret");
    expect(created.webhook_signing_secret).toBe("mcs_secret");
    expect(triggers[0]?.destination_path).toBe("/api/connect/slack");
  });

  it("lists inbound connector trigger deliveries", async () => {
    mockGet
      .mockResolvedValueOnce({
        data: [{ id: "del_123", state: "delivered", event_type: "app_mention" }],
      })
      .mockResolvedValueOnce({
        data: [{ id: "del_123", trigger_id: "trg_123" }],
      });

    const connectors = new Connectors(makeHttp());
    const deliveries = await connectors.triggerDeliveries({
      triggerId: "trg_123",
      eventType: "app_mention",
    });
    const history = await connectors.triggerDeliveryHistory("trg_123");

    expect(mockGet).toHaveBeenNthCalledWith(1, "/connect/trigger-deliveries", {
      trigger_id: "trg_123",
      event_type: "app_mention",
    });
    expect(mockGet).toHaveBeenNthCalledWith(
      2,
      "/connect/triggers/trg_123/deliveries",
    );
    expect(deliveries[0]?.state).toBe("delivered");
    expect(history[0]?.trigger_id).toBe("trg_123");
  });

  it("manages inherited connector defaults", async () => {
    mockGet
      .mockResolvedValueOnce({
        data: [{ id: "def_123", default_scope: "project", target: "agent" }],
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "def_123",
            default_scope: "project",
            target: "agent",
            applicability: { matched_scope: "project" },
          },
        ],
      });
    mockPost.mockResolvedValue({
      data: { id: "def_123", default_scope: "project", target: "agent" },
    });
    mockDelete.mockResolvedValue(undefined);

    const connectors = new Connectors(makeHttp());
    const defaults = await connectors.defaults({
      projectId: "prj_123",
      defaultScope: "project",
      target: "agent",
    });
    const applicable = await connectors.applicableDefaults({
      workspaceId: "ws_123",
      projectId: "prj_123",
      environment: "development",
      target: "agent",
      resourceType: "sandbox",
      resourceId: "sbx_123",
      externalProjectId: "clinic-project",
    });
    const created = await connectors.createDefault({
      connector: "anthropic/workspace",
      projectId: "prj_123",
      defaultScope: "project",
      target: "agent",
      allowedScopes: ["messages:create"],
      mode: "brokered-env",
      externalProjectId: "clinic-project",
    });
    const materialized = await connectors.materializeDefaults({
      workspaceId: "ws_123",
      projectId: "prj_123",
      environment: "development",
      target: "agent",
      resourceType: "sandbox",
      resourceId: "sbx_123",
      externalProjectId: "clinic-project",
    });
    await connectors.deleteDefault("def_123");

    expect(mockGet).toHaveBeenCalledWith("/connect/defaults", {
      project_id: "prj_123",
      default_scope: "project",
      target: "agent",
    });
    expect(mockGet).toHaveBeenNthCalledWith(2, "/connect/defaults/applicable", {
      workspace_id: "ws_123",
      project_id: "prj_123",
      environment: "development",
      target: "agent",
      resource_type: "sandbox",
      resource_id: "sbx_123",
      external_project_id: "clinic-project",
    });
    expect(mockPost).toHaveBeenCalledWith("/connect/defaults", {
      connector: "anthropic/workspace",
      project_id: "prj_123",
      allowed_scopes: ["messages:create"],
      mode: "brokered_env",
      default_scope: "project",
      target: "agent",
      external_project_id: "clinic-project",
    });
    expect(mockPost).toHaveBeenNthCalledWith(2, "/connect/defaults/materialize", {
      workspace_id: "ws_123",
      project_id: "prj_123",
      environment: "development",
      target: "agent",
      resource_type: "sandbox",
      resource_id: "sbx_123",
      external_project_id: "clinic-project",
    });
    expect(mockDelete).toHaveBeenCalledWith("/connect/defaults/def_123");
    expect(defaults[0]?.target).toBe("agent");
    expect(applicable[0]?.metadata).toBeUndefined();
    expect(created.default_scope).toBe("project");
    expect(materialized.id).toBe("def_123");
  });
});

describe("SandboxConnectors", () => {
  it("attaches a connector as brokered env", async () => {
    mockPost.mockResolvedValue({
      data: { id: "bnd_123", expose_as_env: "ANTHROPIC_API_KEY" },
    });

    await new SandboxConnectors(makeHttp(), "sbx_123").attach({
      connector: "anthropic/workspace-claude",
      env: "ANTHROPIC_API_KEY",
      mode: "brokered-env",
      externalWorkspaceId: "clinic-workspace",
    });

    expect(mockPost).toHaveBeenCalledWith("/sandboxes/sbx_123/connectors", {
      connector: "anthropic/workspace-claude",
      env_name: "ANTHROPIC_API_KEY",
      mode: "brokered_env",
      external_workspace_id: "clinic-workspace",
    });
  });

  it("syncs, preflights, lists, and detaches sandbox connector bindings", async () => {
    mockGet.mockResolvedValue({ data: [{ id: "bnd_123" }] });
    mockPost
      .mockResolvedValueOnce({ data: { synced: true } })
      .mockResolvedValueOnce({ data: { status: { bound: true } } });
    mockDelete.mockResolvedValue(undefined);

    const connectors = new SandboxConnectors(makeHttp(), "sbx_123");
    const list = await connectors.list();
    const sync = await connectors.sync();
    const preflight = await connectors.preflight({
      connector: "anthropic/workspace-claude",
    });
    await connectors.detach("anthropic/workspace-claude");

    expect(mockGet).toHaveBeenCalledWith("/sandboxes/sbx_123/connectors");
    expect(mockPost).toHaveBeenNthCalledWith(
      1,
      "/sandboxes/sbx_123/connectors/sync",
      {},
    );
    expect(mockPost).toHaveBeenNthCalledWith(
      2,
      "/sandboxes/sbx_123/connectors/preflight",
      { connector: "anthropic/workspace-claude" },
    );
    expect(mockDelete).toHaveBeenCalledWith(
      "/sandboxes/sbx_123/connectors/anthropic%2Fworkspace-claude",
    );
    expect(list).toHaveLength(1);
    expect(sync.synced).toBe(true);
    expect(preflight.status?.bound).toBe(true);
  });
});

describe("ComputerConnectors", () => {
  it("uses the computer connector binding routes", async () => {
    mockGet.mockResolvedValue({ data: [{ id: "bnd_123" }] });
    mockPost
      .mockResolvedValueOnce({ data: { id: "bnd_123", expose_as_env: "ANTHROPIC_API_KEY" } })
      .mockResolvedValueOnce({ data: { status: "materialized" } })
      .mockResolvedValueOnce({ data: { status: { bound: true } } });
    mockDelete.mockResolvedValue(undefined);

    const connectors = new ComputerConnectors(makeHttp(), "cmp_123");
    const list = await connectors.list();
    const binding = await connectors.attach({
      connector: "anthropic/computer",
      env: "ANTHROPIC_API_KEY",
      mode: "brokered-env",
    });
    const sync = await connectors.sync();
    const preflight = await connectors.preflight({
      connector: "anthropic/computer",
    });
    await connectors.detach("anthropic/computer");

    expect(mockGet).toHaveBeenCalledWith("/computers/cmp_123/connectors");
    expect(mockPost).toHaveBeenNthCalledWith(1, "/computers/cmp_123/connectors", {
      connector: "anthropic/computer",
      env_name: "ANTHROPIC_API_KEY",
      mode: "brokered_env",
    });
    expect(mockPost).toHaveBeenNthCalledWith(2, "/computers/cmp_123/connectors/sync", {});
    expect(mockPost).toHaveBeenNthCalledWith(
      3,
      "/computers/cmp_123/connectors/preflight",
      { connector: "anthropic/computer" },
    );
    expect(mockDelete).toHaveBeenCalledWith(
      "/computers/cmp_123/connectors/anthropic%2Fcomputer",
    );
    expect(list).toHaveLength(1);
    expect(binding.expose_as_env).toBe("ANTHROPIC_API_KEY");
    expect(sync.status).toBe("materialized");
    expect(preflight.status?.bound).toBe(true);
  });
});

describe("DeploymentConnectors", () => {
  it("uses the deployment connector binding routes", async () => {
    mockGet.mockResolvedValue({ data: [{ id: "bnd_123" }] });
    mockPost
      .mockResolvedValueOnce({
        data: {
          id: "bnd_123",
          expose_as_env: "ANTHROPIC_API_KEY",
          sync: { requires_redeploy: true },
        },
      })
      .mockResolvedValueOnce({ data: { status: "materialized_on_next_boot" } })
      .mockResolvedValueOnce({ data: { status: { bound: true } } });
    mockDelete.mockResolvedValue(undefined);

    const connectors = new DeploymentConnectors(makeHttp(), "dep_123");
    const list = await connectors.list();
    const binding = await connectors.attach({
      connector: "anthropic/deployment",
      env: "ANTHROPIC_API_KEY",
      mode: "brokered-env",
    });
    const sync = await connectors.sync();
    const preflight = await connectors.preflight({
      connector: "anthropic/deployment",
    });
    await connectors.detach("anthropic/deployment");

    expect(mockGet).toHaveBeenCalledWith("/deployments/dep_123/connectors");
    expect(mockPost).toHaveBeenNthCalledWith(1, "/deployments/dep_123/connectors", {
      connector: "anthropic/deployment",
      env_name: "ANTHROPIC_API_KEY",
      mode: "brokered_env",
    });
    expect(mockPost).toHaveBeenNthCalledWith(2, "/deployments/dep_123/connectors/sync", {});
    expect(mockPost).toHaveBeenNthCalledWith(
      3,
      "/deployments/dep_123/connectors/preflight",
      { connector: "anthropic/deployment" },
    );
    expect(mockDelete).toHaveBeenCalledWith(
      "/deployments/dep_123/connectors/anthropic%2Fdeployment",
    );
    expect(list).toHaveLength(1);
    expect(binding.sync?.requires_redeploy).toBe(true);
    expect(sync.status).toBe("materialized_on_next_boot");
    expect(preflight.status?.bound).toBe(true);
  });
});
