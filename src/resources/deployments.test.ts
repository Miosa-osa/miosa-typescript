import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../http.js";
import { Deployments } from "./deployments.js";

const mockRequest = vi.fn();
const mockGet = vi.fn();

function makeHttp(): HttpClient {
  const http = {} as HttpClient;
  http.get = mockGet;
  http.request = mockRequest;
  return http;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Deployments", () => {
  it("preserves durable URL, ownership, and App Engine proof fields", async () => {
    mockGet.mockResolvedValue({ data: {
      id: "dep_123", tenant_id: "ten_123", workspace_id: "ws_1", project_id: "prj_1",
      name: "App", slug: "app", state: "running", deployment_product: "docker_deploy",
      public_url: "https://app.panther.example", auto_subdomain: "https://app.panther.miosa.app",
      docker_deploy_app: { id: "dda_1", deployment_id: "dep_123", deployment_version_id: "ver_1", app_id: "app_1", container_id: "ctr_1", status: "running", deployed_at: "2026-07-14T00:00:00Z" },
    } });
    const deployment = await new Deployments(makeHttp()).get("dep_123");
    expect(deployment.workspace_id).toBe("ws_1");
    expect(deployment.public_url).toBe("https://app.panther.example");
    expect(deployment.auto_subdomain).toBe("https://app.panther.miosa.app");
    expect(deployment.docker_deploy_app?.deployment_version_id).toBe("ver_1");
  });

  it("createDockerDeploy() marks the deployment for App Engine", async () => {
    mockRequest.mockResolvedValue({
      data: {
        id: "dep_123",
        tenant_id: "ten_123",
        name: "Clinic Intake",
        slug: "clinic-intake",
        state: "pending",
        deployment_product: "docker_deploy",
        docker_deploy_host_id: "ddh_123",
        metadata: { deployment_product: "docker_deploy", client: "clinic-iq" },
      },
    });

    const deployment = await new Deployments(makeHttp()).createDockerDeploy({
      name: "Clinic Intake",
      repoUrl: "https://github.com/clinic-iq/intake",
      externalWorkspaceId: "dr-smith",
      externalProjectId: "lead-magnet",
      metadata: { client: "clinic-iq" },
      idempotencyKey: "idem-123",
    });

    expect(mockRequest).toHaveBeenCalledWith("/deployments", {
      method: "POST",
      body: {
        name: "Clinic Intake",
        repo_url: "https://github.com/clinic-iq/intake",
        metadata: { client: "clinic-iq", deployment_product: "docker_deploy" },
        external_workspace_id: "dr-smith",
        external_project_id: "lead-magnet",
      },
      headers: { "Idempotency-Key": "idem-123" },
    });
    expect(deployment.deployment_product).toBe("docker_deploy");
    expect(deployment.docker_deploy_host_id).toBe("ddh_123");
  });

  it("promotes one exact immutable release with a reusable idempotency key", async () => {
    mockRequest.mockResolvedValue({
      data: {
        id: "dep_123",
        tenant_id: "ten_123",
        name: "App",
        slug: "app",
        state: "running",
        active_version_id: "ver_123",
        active_release_id: "rel_123",
        running_artifact_sha256: "abc123",
      },
    });

    const deployment = await new Deployments(makeHttp())
      .releases("dep_123")
      .promote("rel_123", "app-idem-123");

    expect(mockRequest).toHaveBeenCalledWith(
      "/deployments/dep_123/releases/rel_123/promote",
      {
        method: "POST",
        body: {},
        headers: { "Idempotency-Key": "app-idem-123" },
      },
    );
    expect(deployment.active_release_id).toBe("rel_123");
    expect(deployment.running_artifact_sha256).toBe("abc123");
  });

  it("prove() passes only when App Engine has app truth and a ready host", async () => {
    mockGet.mockImplementation(async (path: string) => {
      if (path === "/deployments/dep_123") {
        return {
          data: {
            id: "dep_123",
            tenant_id: "ten_123",
            name: "Clinic Intake",
            slug: "clinic-intake",
            state: "running",
            deployment_product: "docker_deploy",
            docker_deploy_host_id: "ddh_123",
            public_url: "https://clinic.example.com",
            metadata: {
              deployment_product: "docker_deploy",
              runtime: { ip: "172.16.0.1", port: 20000 },
            },
            docker_deploy_app: {
              app_id: "dokploy_app_123",
              container_id: "container_123",
              status: "running",
              runtime_ip: "172.16.0.2",
              runtime_port: 24001,
              public_url: "https://clinic.example.com",
            },
          },
        };
      }
      if (path === "/docker-deploy/hosts/ddh_123") {
        return {
          data: {
            id: "ddh_123",
            status: "active",
            appliance_status: "healthy",
          },
        };
      }
      throw new Error(`unexpected path ${path}`);
    });

    const result = await new Deployments(makeHttp()).prove("dep_123", {
      probe: false,
    });

    expect(result.ok).toBe(true);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "docker_deploy_app_row", ok: true }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "docker_deploy_container_route", ok: true }),
    );
    expect(result.public_url).toBe("https://clinic.example.com");
  });

  it("prove() fails App Engine metadata-only deployments", async () => {
    mockGet.mockImplementation(async (path: string) => {
      if (path === "/deployments/dep_123") {
        return {
          data: {
            id: "dep_123",
            tenant_id: "ten_123",
            name: "Clinic Intake",
            slug: "clinic-intake",
            state: "running",
            deployment_product: "docker_deploy",
            docker_deploy_host_id: "ddh_123",
            public_url: "https://clinic.example.com",
            metadata: {
              deployment_product: "docker_deploy",
              runtime: { ip: "172.16.0.1", port: 20000 },
            },
            docker_deploy_app: null,
          },
        };
      }
      if (path === "/docker-deploy/hosts/ddh_123") {
        return {
          data: {
            id: "ddh_123",
            status: "active",
            appliance_status: "healthy",
          },
        };
      }
      throw new Error(`unexpected path ${path}`);
    });

    const result = await new Deployments(makeHttp()).prove("dep_123", {
      probe: false,
    });

    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "docker_deploy_app_row", ok: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "docker_deploy_container_route", ok: false }),
    );
    expect(result.next_actions.length).toBeGreaterThan(0);
  });
});
