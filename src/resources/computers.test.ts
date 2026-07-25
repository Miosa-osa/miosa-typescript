import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "../http.js";
import { Computer } from "./computer.js";
import { Computers } from "./computers.js";
import { Desktop } from "./desktop.js";

const mockPost = vi.fn();
const mockGet = vi.fn();

function makeHttp(): HttpClient {
  const http = {} as HttpClient;
  http.post = mockPost;
  http.get = mockGet;
  return http;
}

function computerData(overrides: Record<string, unknown> = {}) {
  return {
    id: "comp_123",
    name: "builder",
    slug: "builder",
    status: "provisioning",
    template_type: "miosa-desktop",
    size: "small",
    tenant_id: "tenant_123",
    ip_address: null,
    metadata: {},
    visibility: "public",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Computers", () => {
  it("create() normalizes agent runtime profile controls", async () => {
    mockPost.mockResolvedValue(computerData());

    const computers = new Computers(makeHttp());
    await computers.create({
      name: "builder",
      agentRuntimeProfileId: "profile_123",
      skipRuntimeProfile: false,
    });

    expect(mockPost).toHaveBeenCalledWith("/computers", {
      template_type: "miosa-desktop",
      size: "small",
      name: "builder",
      agent_runtime_profile_id: "profile_123",
      skip_agent_runtime_profile: false,
    });
  });

  it("create() normalizes legacy xlarge size input to xl", async () => {
    mockPost.mockResolvedValue(computerData({ size: "xl" }));

    const computers = new Computers(makeHttp());
    await computers.create({
      name: "builder",
      size: "xlarge",
    });

    expect(mockPost).toHaveBeenCalledWith("/computers", {
      template_type: "miosa-desktop",
      size: "xl",
      name: "builder",
      agent_runtime_profile_id: undefined,
      skip_agent_runtime_profile: undefined,
    });
  });

  it("viewerPassword() calls the external viewer password status endpoint", async () => {
    mockGet.mockResolvedValue({ password_set: true });

    const computers = new Computers(makeHttp());
    await expect(computers.viewerPassword("comp_123")).resolves.toEqual({
      password_set: true,
    });

    expect(mockGet).toHaveBeenCalledWith("/computers/comp_123/viewer-password");
  });

  it("rotateViewerPassword() calls the external viewer password rotation endpoint", async () => {
    mockPost.mockResolvedValue({
      password_set: true,
      viewer_password: "xxxx-yyyy-zzzz-wwww",
    });

    const computers = new Computers(makeHttp());
    await expect(computers.rotateViewerPassword("comp_123")).resolves.toEqual({
      password_set: true,
      viewer_password: "xxxx-yyyy-zzzz-wwww",
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/computers/comp_123/viewer-password/rotate",
    );
  });

  it("computer.run() dispatches a default Claude Code Run into the computer", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        id: "run_1",
        target_kind: "computer",
        target_id: "comp_123",
        runner: "claude-code",
        instruction: "open terminal and list files",
        status: "succeeded",
      },
    });

    const computer = new Computer(makeHttp(), computerData({ status: "running" }));
    const run = await computer.run("open terminal and list files");

    expect(mockPost).toHaveBeenCalledWith("/runs", {
      instruction: "open terminal and list files",
      target_kind: "computer",
      target_id: "comp_123",
      runtime_id: "comp_123",
      computer_id: "comp_123",
      runner: "claude-code",
      cwd: "/workspace",
      wait: true,
    });
    expect(run.target_kind).toBe("computer");
  });

  it("computer.prompt() passes advanced agent runtime options", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        id: "run_2",
        target_kind: "computer",
        target_id: "comp_123",
        provider: "codex",
        prompt: "inspect screenshot",
        status: "running",
      },
    });

    const computer = new Computer(makeHttp(), computerData({ status: "running" }));
    await computer.prompt("inspect screenshot", {
      provider: "codex",
      json: true,
      outputSchema: "/workspace/schema.json",
      image: "/workspace/screenshot.png",
      env: { CODEX_API_KEY: "redacted" },
    });

    expect(mockPost).toHaveBeenCalledWith("/agent-runs", {
      prompt: "inspect screenshot",
      target_kind: "computer",
      target_id: "comp_123",
      computer_id: "comp_123",
      provider: "codex",
      cwd: "/workspace",
      wait: true,
      json: true,
      output_schema: "/workspace/schema.json",
      image: "/workspace/screenshot.png",
      env: { CODEX_API_KEY: "redacted" },
    });
  });

  it("computer.embed() uses the passwordless authenticated desktop endpoint", async () => {
    mockGet.mockResolvedValueOnce({
      embed_url: "https://builder.computer.miosa.ai/viewer?auth=tok_123",
      auth: { password_required: false },
    });

    const computer = new Computer(makeHttp(), computerData({ status: "running" }));
    const result = await computer.embed();

    expect(mockGet).toHaveBeenCalledWith("/computers/comp_123/embed");
    expect(result).toMatchObject({
      embed_url: "https://builder.computer.miosa.ai/viewer?auth=tok_123",
      auth: { password_required: false },
    });
  });

  it("exposes simple desktop pointer aliases", async () => {
    mockPost.mockResolvedValue({ ok: true });

    const computer = new Computer(makeHttp(), computerData({ status: "running" }));
    await computer.middleClick(50, 60);
    await computer.moveMouse(70, 80);

    expect(mockPost).toHaveBeenNthCalledWith(
      1,
      "/computers/comp_123/desktop/click",
      { x: 50, y: 60, button: "middle" },
    );
    expect(mockPost).toHaveBeenNthCalledWith(
      2,
      "/computers/comp_123/desktop/move",
      { x: 70, y: 80 },
    );
  });

  it("exposes raw desktop pointer aliases", async () => {
    mockPost.mockResolvedValue({ ok: true });

    const desktop = new Desktop(makeHttp(), "comp_123");
    await desktop.leftClick(10, 20);
    await desktop.rightClick(30, 40);
    await desktop.middleClick(50, 60);

    expect(mockPost).toHaveBeenNthCalledWith(
      1,
      "/computers/comp_123/desktop/click",
      { x: 10, y: 20, button: "left" },
    );
    expect(mockPost).toHaveBeenNthCalledWith(
      2,
      "/computers/comp_123/desktop/click",
      { x: 30, y: 40, button: "right" },
    );
    expect(mockPost).toHaveBeenNthCalledWith(
      3,
      "/computers/comp_123/desktop/click",
      { x: 50, y: 60, button: "middle" },
    );
  });

  it("exposes simple desktop keyboard aliases", async () => {
    mockPost.mockResolvedValue({ ok: true });

    const computer = new Computer(makeHttp(), computerData({ status: "running" }));
    await computer.write("hello");
    await computer.press("Enter");

    expect(mockPost).toHaveBeenNthCalledWith(
      1,
      "/computers/comp_123/desktop/type",
      { text: "hello" },
    );
    expect(mockPost).toHaveBeenNthCalledWith(
      2,
      "/computers/comp_123/desktop/key",
      { key: "Enter" },
    );
  });
});
