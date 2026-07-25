import { describe, expect, it, vi } from "vitest";
import { RuntimeEnv } from "./runtime-env.js";
import type { HttpClient } from "../http.js";

describe("RuntimeEnv", () => {
  it("sets and normalizes inherited runtime env vars", async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        id: "env_123",
        tenant_id: "tenant_1",
        workspace_id: "workspace_1",
        project_id: "project_1",
        scope: "project",
        target: "deployment",
        name: "ANTHROPIC_API_KEY",
        preview: "sk-ant...1234",
        enabled: true,
      },
    });
    const http = { post } as unknown as HttpClient;

    const result = await new RuntimeEnv(http).set({
      scope: "project",
      workspaceId: "workspace_1",
      projectId: "project_1",
      target: "deployment",
      name: "ANTHROPIC_API_KEY",
      value: "sk-ant-test",
      metadata: { provider: "anthropic" },
    });

    expect(post).toHaveBeenCalledWith("/runtime-env", {
      scope: "project",
      workspace_id: "workspace_1",
      project_id: "project_1",
      target: "deployment",
      name: "ANTHROPIC_API_KEY",
      value: "sk-ant-test",
      metadata: { provider: "anthropic" },
    });
    expect(result.workspaceId).toBe("workspace_1");
    expect(result.projectId).toBe("project_1");
    expect(result.preview).toBe("sk-ant...1234");
  });

  it("lists, gets, and deletes inherited runtime env vars", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            id: "env_123",
            scope: "workspace",
            workspace_id: "workspace_1",
            target: "computer",
            name: "OPENAI_API_KEY",
            preview: "sk...7890",
          },
        ],
      })
      .mockResolvedValueOnce({
        data: {
          id: "env_123",
          scope: "workspace",
          workspace_id: "workspace_1",
          target: "computer",
          name: "OPENAI_API_KEY",
        },
      });
    const del = vi.fn().mockResolvedValue(undefined);
    const http = { get, delete: del } as unknown as HttpClient;

    const runtimeEnv = new RuntimeEnv(http);
    const listed = await runtimeEnv.list({
      scope: "workspace",
      workspaceId: "workspace_1",
      target: "computer",
    });
    const fetched = await runtimeEnv.get("env_123");
    await runtimeEnv.delete("env_123");

    expect(get).toHaveBeenNthCalledWith(1, "/runtime-env", {
      scope: "workspace",
      workspace_id: "workspace_1",
      project_id: undefined,
      target: "computer",
    });
    expect(get).toHaveBeenNthCalledWith(2, "/runtime-env/env_123");
    expect(del).toHaveBeenCalledWith("/runtime-env/env_123");
    expect(listed[0]?.workspaceId).toBe("workspace_1");
    expect(fetched.id).toBe("env_123");
  });
});
