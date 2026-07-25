import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../http.js";
import { Devices } from "./devices.js";

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

describe("Devices", () => {
  it("lists unified devices with optional filters", async () => {
    mockGet.mockResolvedValue({
      data: [{ id: "sbx_123", kind: "sandbox", ready: true }],
    });

    const out = await new Devices(makeHttp()).list({
      kind: "sandbox",
      workspaceId: "ws_123",
      projectId: "prj_123",
    });

    expect(mockGet).toHaveBeenCalledWith("/devices", {
      kind: "sandbox",
      workspace_id: "ws_123",
      project_id: "prj_123",
    });
    expect(out[0]?.id).toBe("sbx_123");
  });

  it("shows device capabilities and executes commands", async () => {
    mockGet.mockResolvedValueOnce({
      data: { id: "comp_123", capabilities: { browser: true } },
    });
    mockPost.mockResolvedValueOnce({
      data: { exit_code: 0, stdout: "ok\n" },
    });

    const devices = new Devices(makeHttp());
    const caps = await devices.capabilities("comp_123");
    const result = await devices.exec("comp_123", {
      command: "printf ok",
      timeoutMs: 30_000,
      cwd: "/workspace",
      env: { NODE_ENV: "test" },
    });

    expect(mockGet).toHaveBeenCalledWith("/devices/comp_123/capabilities");
    expect(mockPost).toHaveBeenCalledWith("/devices/comp_123/exec", {
      command: "printf ok",
      timeout_ms: 30_000,
      cwd: "/workspace",
      env: { NODE_ENV: "test" },
    });
    expect(caps.capabilities?.browser).toBe(true);
    expect(result.stdout).toBe("ok\n");
  });

  it("reads, writes, lists files, and exposes ports", async () => {
    mockGet
      .mockResolvedValueOnce({ data: [{ path: "/workspace/out.html", type: "file" }] })
      .mockResolvedValueOnce({
        data: { path: "/workspace/out.html", encoding: "base64", content: "PGgxPk9LPC9oMT4=" },
      });
    mockPost
      .mockResolvedValueOnce({ data: { path: "/workspace/out.html", size: 11 } })
      .mockResolvedValueOnce({
        data: { port: 3000, url: "https://3000-sbx.sandbox.miosa.ai" },
      });

    const devices = new Devices(makeHttp());
    const files = await devices.listFiles("sbx_123", { path: "/workspace" });
    const read = await devices.readFile("sbx_123", { path: "/workspace/out.html" });
    const write = await devices.writeFile("sbx_123", {
      path: "/workspace/out.html",
      contentBase64: "PGgxPk9LPC9oMT4=",
    });
    const exposed = await devices.expose("sbx_123", { port: 3000 });

    expect(mockGet).toHaveBeenNthCalledWith(1, "/devices/sbx_123/files", {
      path: "/workspace",
    });
    expect(mockGet).toHaveBeenNthCalledWith(2, "/devices/sbx_123/files/read", {
      path: "/workspace/out.html",
    });
    expect(mockPost).toHaveBeenNthCalledWith(1, "/devices/sbx_123/files/write", {
      path: "/workspace/out.html",
      content_base64: "PGgxPk9LPC9oMT4=",
    });
    expect(mockPost).toHaveBeenNthCalledWith(2, "/devices/sbx_123/expose", {
      port: 3000,
    });
    expect(files[0]?.path).toBe("/workspace/out.html");
    expect(read.encoding).toBe("base64");
    expect(write.size).toBe(11);
    expect(exposed.url).toContain("sandbox.miosa.ai");
  });

  it("manages lifecycle for a device", async () => {
    mockPost
      .mockResolvedValueOnce({ data: { id: "sbx_123", state: "paused" } })
      .mockResolvedValueOnce({ data: { id: "sbx_123", state: "stopped" } })
      .mockResolvedValueOnce({ data: { id: "sbx_123", state: "running" } })
      .mockResolvedValueOnce({ data: { id: "sbx_123", timeout_sec: 7200 } });
    mockDelete.mockResolvedValueOnce({ data: { id: "sbx_123", state: "destroyed" } });

    const devices = new Devices(makeHttp());
    await devices.pause("sbx_123");
    await devices.stop("sbx_123");
    await devices.resume("sbx_123");
    const extended = await devices.extend("sbx_123", { timeoutSec: 7200 });
    const destroyed = await devices.destroy("sbx_123");

    expect(mockPost).toHaveBeenNthCalledWith(1, "/devices/sbx_123/pause", {});
    expect(mockPost).toHaveBeenNthCalledWith(2, "/devices/sbx_123/stop", {});
    expect(mockPost).toHaveBeenNthCalledWith(3, "/devices/sbx_123/resume", {});
    expect(mockPost).toHaveBeenNthCalledWith(4, "/devices/sbx_123/extend", {
      timeout_sec: 7200,
    });
    expect(mockDelete).toHaveBeenCalledWith("/devices/sbx_123");
    expect(extended.timeout_sec).toBe(7200);
    expect(destroyed.state).toBe("destroyed");
  });

  it("bootstraps a runtime manifest and probe", async () => {
    mockPost
      .mockResolvedValueOnce({ data: { path: "/workspace/.miosa/runtime-bootstrap.json" } })
      .mockResolvedValueOnce({ data: { exit_code: 0, stdout: "runtime available\n" } });

    const result = await new Devices(makeHttp()).bootstrap("sbx_123", {
      runtime: "claude-code",
      connectors: ["anthropic/workspace-claude"],
      env: { ANTHROPIC_API_KEY: "miosa-tok-placeholder" },
      mcp: [{ name: "refero", url: "https://api.refero.design/mcp" }],
    });

    expect(mockPost).toHaveBeenNthCalledWith(1, "/devices/sbx_123/files/write", {
      path: "/workspace/.miosa/runtime-bootstrap.json",
      content: expect.stringContaining('"runtime": "claude-code"'),
    });
    expect(mockPost).toHaveBeenNthCalledWith(2, "/devices/sbx_123/exec", {
      command: expect.stringContaining("runtime available"),
      cwd: "/workspace",
      timeout_ms: 60_000,
    });
    expect(result).toMatchObject({
      device_id: "sbx_123",
      ok: true,
      runtime: "claude-code",
      manifest_path: "/workspace/.miosa/runtime-bootstrap.json",
    });
  });

  it("bootstraps managed MCP connector bindings for Claude Code", async () => {
    mockPost
      .mockResolvedValueOnce({ data: { path: "/workspace/.miosa/runtime-bootstrap.json" } })
      .mockResolvedValueOnce({ data: { exit_code: 0, stdout: "runtime available\n" } });

    await new Devices(makeHttp()).bootstrap("comp_123", {
      runtime: "claude-code",
      cwd: "/workspace",
      connectors: [
        {
          uid: "refero",
          type: "mcp",
          managed: true,
          serverUrl: "https://api.refero.design/mcp",
        },
        "anthropic/cliniciq",
      ],
      env: {
        ANTHROPIC_API_KEY: "miosa-managed:anthropic/cliniciq",
      },
    });

    const writeBody = mockPost.mock.calls[0]?.[1] as { content: string };
    const manifest = JSON.parse(writeBody.content) as {
      connectors: Array<Record<string, unknown> | string>;
      env: Record<string, string>;
    };

    expect(manifest.connectors).toEqual([
      {
        uid: "refero",
        type: "mcp",
        managed: true,
        serverUrl: "https://api.refero.design/mcp",
      },
      "anthropic/cliniciq",
    ]);
    expect(manifest.env.ANTHROPIC_API_KEY).toBe(
      "miosa-managed:anthropic/cliniciq",
    );
  });

  it("returns browser connection details", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        kind: "computer_browser",
        desktop_url: "https://desktop.example.test",
        ws_url: "wss://desktop.example.test/vnc/websockify",
      },
    });

    const result = await new Devices(makeHttp()).browser("comp_123");

    expect(mockGet).toHaveBeenCalledWith("/devices/comp_123/browser");
    expect(result.kind).toBe("computer_browser");
    expect(result.desktop_url).toContain("desktop");
  });
});
