import { describe, expect, it, vi } from "vitest";
import { AgentRuntimeProfiles } from "./agent-runtime-profiles.js";
import type { HttpClient } from "../http.js";

describe("AgentRuntimeProfiles", () => {
  it("creates and normalizes runtime profiles", async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        id: "arp_123",
        tenant_id: "tenant_1",
        workspace_id: "workspace_1",
        project_id: "project_1",
        name: "Claude builder",
        runtime: "claude-code",
        applies_to: { sandboxes: true },
        is_default: true,
      },
    });
    const http = { post } as unknown as HttpClient;

    const result = await new AgentRuntimeProfiles(http).create({
      workspaceId: "workspace_1",
      projectId: "project_1",
      name: "Claude builder",
      runtime: "claude-code",
      appliesTo: { sandboxes: true },
      isDefault: true,
    });

    expect(post).toHaveBeenCalledWith("/agent-runtime-profiles", {
      workspace_id: "workspace_1",
      project_id: "project_1",
      name: "Claude builder",
      runtime: "claude-code",
      applies_to: { sandboxes: true },
      is_default: true,
    });
    expect(result.workspaceId).toBe("workspace_1");
    expect(result.projectId).toBe("project_1");
    expect(result.appliesTo).toEqual({ sandboxes: true });
    expect(result.isDefault).toBe(true);
  });

  it("preserves managed connector bindings for white-label runtime profiles", async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        id: "arp_clinic",
        workspace_id: "clinic_workspace",
        name: "ClinicIQ Claude Code",
        runtime: "claude-code",
        connectors: [
          {
            uid: "refero",
            type: "mcp",
            managed: true,
            server_url: "https://api.refero.design/mcp",
          },
        ],
        env: {
          ANTHROPIC_API_KEY: "miosa-managed:anthropic/cliniciq",
        },
        metadata: {
          model: "claude-opus-4.8",
          white_label_client: "cliniciq",
        },
      },
    });
    const http = { post } as unknown as HttpClient;

    const result = await new AgentRuntimeProfiles(http).create({
      workspaceId: "clinic_workspace",
      name: "ClinicIQ Claude Code",
      runtime: "claude-code",
      connectors: [
        {
          uid: "refero",
          type: "mcp",
          managed: true,
          serverUrl: "https://api.refero.design/mcp",
        },
      ],
      env: {
        ANTHROPIC_API_KEY: "miosa-managed:anthropic/cliniciq",
      },
      metadata: {
        model: "claude-opus-4.8",
        white_label_client: "cliniciq",
      },
    });

    expect(post).toHaveBeenCalledWith("/agent-runtime-profiles", {
      workspace_id: "clinic_workspace",
      name: "ClinicIQ Claude Code",
      runtime: "claude-code",
      connectors: [
        {
          uid: "refero",
          type: "mcp",
          managed: true,
          serverUrl: "https://api.refero.design/mcp",
        },
      ],
      env: {
        ANTHROPIC_API_KEY: "miosa-managed:anthropic/cliniciq",
      },
      metadata: {
        model: "claude-opus-4.8",
        white_label_client: "cliniciq",
      },
    });
    expect(result.connectors?.[0]).toMatchObject({
      uid: "refero",
      managed: true,
    });
  });

  it("lists runtime profiles by workspace", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [{ id: "arp_123", name: "OSA", runtime: "osa" }],
    });
    const http = { get } as unknown as HttpClient;

    const result = await new AgentRuntimeProfiles(http).list({
      workspaceId: "workspace_1",
      projectId: "project_1",
    });

    expect(get).toHaveBeenCalledWith("/agent-runtime-profiles", {
      workspace_id: "workspace_1",
      project_id: "project_1",
    });
    expect(result[0]?.runtime).toBe("osa");
  });
});
