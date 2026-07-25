import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../http.js";
import { DockerDeploy } from "./docker-deploy.js";

const mockGet = vi.fn();
const mockPost = vi.fn();

function makeHttp(): HttpClient {
  const http = {} as HttpClient;
  http.get = mockGet;
  http.post = mockPost;
  return http;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DockerDeploy", () => {
  it("lists App Engine hosts by workspace", async () => {
    mockGet.mockResolvedValue({
      data: [
        {
          id: "ddh_123",
          tenant_id: "ten_123",
          workspace_id: "ws_123",
          status: "bootstrapping",
          appliance_status: "starting",
          size: "medium",
          region: "us",
        },
      ],
    });

    const hosts = await new DockerDeploy(makeHttp()).listHosts({
      workspaceId: "ws_123",
    });

    expect(mockGet).toHaveBeenCalledWith("/docker-deploy/hosts", {
      workspace_id: "ws_123",
    });
    expect(hosts[0]?.id).toBe("ddh_123");
  });

  it("ensures a workspace App Engine host", async () => {
    mockPost.mockResolvedValue({
      host: {
        id: "ddh_123",
        tenant_id: "ten_123",
        workspace_id: "ws_123",
        status: "pending",
        appliance_status: "not_installed",
        size: "medium",
        region: "us",
      },
      queued: true,
    });

    const result = await new DockerDeploy(makeHttp()).ensureHost({
      workspaceId: "ws_123",
    });

    expect(mockPost).toHaveBeenCalledWith("/docker-deploy/hosts/ensure", {
      workspace_id: "ws_123",
    });
    expect(result.queued).toBe(true);
    expect(result.host.status).toBe("pending");
  });

  it("lists App Engine templates", async () => {
    mockGet.mockResolvedValue({
      data: [
        {
          id: "nextjs-app",
          name: "Next.js app",
          description: "App router starter",
        },
      ],
    });

    const templates = await new DockerDeploy(makeHttp()).listTemplates();

    expect(mockGet).toHaveBeenCalledWith("/docker-deploy/templates");
    expect(templates[0]?.id).toBe("nextjs-app");
  });

  it("gets a App Engine template", async () => {
    mockGet.mockResolvedValue({
      template: {
        id: "compose-full-stack",
        name: "Compose full stack",
      },
    });

    const template = await new DockerDeploy(makeHttp()).getTemplate("compose-full-stack");

    expect(mockGet).toHaveBeenCalledWith(
      "/docker-deploy/templates/compose-full-stack",
    );
    expect(template.id).toBe("compose-full-stack");
  });
});
