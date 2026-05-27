import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MiosaError } from "../errors.js";
import { HttpClient } from "../http.js";
import { Sandbox, Sandboxes } from "./sandboxes.js";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();
const mockRequest = vi.fn();
const mockGetBinary = vi.fn();
const mockStream = vi.fn();

function makeHttp(): HttpClient {
  const http = {} as HttpClient;
  http.get = mockGet;
  http.post = mockPost;
  http.delete = mockDelete;
  http.request = mockRequest;
  http.getBinary = mockGetBinary;
  http.stream = mockStream;
  return http;
}

function sandboxData(overrides: Record<string, unknown> = {}) {
  return {
    id: "sbx_123",
    state: "running",
    ready: true,
    template_id: "miosa-sandbox",
    cpu_count: 1,
    memory_mb: 1024,
    timeout_sec: 300,
    metadata: {},
    created_at: "2026-05-13T00:00:00Z",
    started_at: "2026-05-13T00:00:01Z",
    destroyed_at: null,
    total_runtime_sec: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Sandboxes", () => {
  it("create() calls native /sandboxes with template_id", async () => {
    mockRequest.mockResolvedValue({ data: sandboxData() });

    const client = new Sandboxes(makeHttp());
    const sandbox = await client.create({
      templateId: "nextjs",
      cpuCount: 2,
      memoryMb: 2048,
      idempotencyKey: "idem-1",
    });

    expect(mockRequest).toHaveBeenCalledWith("/sandboxes", {
      method: "POST",
      body: {
        template_id: "nextjs",
        cpu_count: 2,
        memory_mb: 2048,
      },
      headers: { "Idempotency-Key": "idem-1" },
    });
    expect(sandbox).toBeInstanceOf(Sandbox);
    expect(sandbox.id).toBe("sbx_123");
  });

  it("create() defaults to miosa-sandbox", async () => {
    mockRequest.mockResolvedValue(sandboxData());

    await new Sandboxes(makeHttp()).create();

    expect(mockRequest).toHaveBeenCalledWith("/sandboxes", {
      method: "POST",
      body: { template_id: "miosa-sandbox" },
    });
  });

  it("list() calls native /sandboxes and maps sandbox handles", async () => {
    mockGet.mockResolvedValue({ data: [sandboxData()] });

    const result = await new Sandboxes(makeHttp()).list({
      state: "running",
      tags: ["agent", "preview"],
    });

    expect(mockGet).toHaveBeenCalledWith("/sandboxes", {
      state: "running",
      tags: "agent,preview",
    });
    expect(result[0]).toBeInstanceOf(Sandbox);
  });

  it("get() and connect() call native /sandboxes/:id", async () => {
    mockGet.mockResolvedValue(sandboxData());

    const client = new Sandboxes(makeHttp());
    await client.get("sbx_123");
    await client.connect("sbx_123");

    expect(mockGet).toHaveBeenNthCalledWith(1, "/sandboxes/sbx_123");
    expect(mockGet).toHaveBeenNthCalledWith(2, "/sandboxes/sbx_123");
  });

  it("delete() calls native /sandboxes/:id", async () => {
    mockDelete.mockResolvedValue(undefined);

    await new Sandboxes(makeHttp()).delete("sbx_123");

    expect(mockDelete).toHaveBeenCalledWith("/sandboxes/sbx_123");
  });

  it("gets and validates the public BuildSpec contract", async () => {
    mockGet.mockResolvedValue({ version: "2026-05-13" });
    mockPost.mockResolvedValue({
      valid: true,
      build_spec: { from: "node:22-bookworm" },
    });

    const client = new Sandboxes(makeHttp());
    const schema = await client.getBuildSpecSchema();
    const validation = await client.validateBuildSpec({
      from: "node:22-bookworm",
      startCmd: "pnpm dev --host 0.0.0.0 --port 3000",
    });

    expect(mockGet).toHaveBeenCalledWith("/sandbox-templates/build-spec");
    expect(mockPost).toHaveBeenCalledWith("/sandbox-templates/validate", {
      build_spec: {
        from: "node:22-bookworm",
        startCmd: "pnpm dev --host 0.0.0.0 --port 3000",
      },
    });
    expect(schema.version).toBe("2026-05-13");
    expect(validation.valid).toBe(true);
  });

  it("creates templates and queued template builds", async () => {
    mockPost
      .mockResolvedValueOnce({
        data: {
          id: "tpl_123",
          name: "Agent Web App",
          slug: "agent-web-app",
          built_in: false,
          status: "draft",
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: "build_123",
          sandbox_template_id: "tpl_123",
          source_type: "build_spec",
          state: "queued",
        },
      });

    const client = new Sandboxes(makeHttp());
    const template = await client.createTemplate({
      name: "Agent Web App",
      slug: "agent-web-app",
      buildSpec: { from: "node:22-bookworm" },
    });
    const build = await client.createTemplateBuild(template.id);

    expect(mockPost).toHaveBeenNthCalledWith(1, "/sandbox-templates", {
      name: "Agent Web App",
      slug: "agent-web-app",
      build_spec: { from: "node:22-bookworm" },
    });
    expect(mockPost).toHaveBeenNthCalledWith(
      2,
      "/sandbox-templates/tpl_123/builds",
      {},
    );
    expect(template.id).toBe("tpl_123");
    expect(build.state).toBe("queued");
  });

  it("lists and gets template builds", async () => {
    mockGet
      .mockResolvedValueOnce({
        data: [
          {
            id: "build_123",
            sandbox_template_id: "tpl_123",
            source_type: "build_spec",
            state: "queued",
          },
        ],
      })
      .mockResolvedValueOnce({
        data: {
          id: "build_123",
          sandbox_template_id: "tpl_123",
          source_type: "build_spec",
          state: "queued",
        },
      });

    const client = new Sandboxes(makeHttp());
    const builds = await client.listTemplateBuilds("tpl_123");
    const build = await client.getTemplateBuild("build_123");

    expect(mockGet).toHaveBeenNthCalledWith(
      1,
      "/sandbox-templates/tpl_123/builds",
    );
    expect(mockGet).toHaveBeenNthCalledWith(
      2,
      "/sandbox-template-builds/build_123",
    );
    expect(builds[0]?.id).toBe("build_123");
    expect(build.id).toBe("build_123");
  });
});

describe("Sandbox handle", () => {
  it("exec() posts to native /sandboxes/:id/exec", async () => {
    mockPost.mockResolvedValue({
      data: { stdout: "ok\n", stderr: "", exit_code: 0, duration_ms: 12 },
    });

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    const result = await sandbox.exec("echo ok", {
      workingDir: "/workspace",
      timeoutSec: 5,
    });

    expect(mockPost).toHaveBeenCalledWith("/sandboxes/sbx_123/exec", {
      command: "echo ok",
      cwd: "/workspace",
      timeout: 5,
    });
    expect(result.stdout).toBe("ok\n");
    expect(result.exitCode).toBe(0);
    expect(result.exit_code).toBe(0);
  });

  it("commands.run() delegates to exec()", async () => {
    mockPost.mockResolvedValue({
      data: { stdout: "ok", stderr: "", exit_code: 0 },
    });

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    await sandbox.commands.run("echo ok");

    expect(mockPost).toHaveBeenCalledWith("/sandboxes/sbx_123/exec", {
      command: "echo ok",
    });
  });

  it("exec.run() keeps callable exec parity", async () => {
    mockPost.mockResolvedValue({
      data: { stdout: "ok", stderr: "", exit_code: 0 },
    });

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    await sandbox.exec.run("echo ok");
    await sandbox.exec("echo ok");

    expect(mockPost).toHaveBeenNthCalledWith(1, "/sandboxes/sbx_123/exec", {
      command: "echo ok",
    });
    expect(mockPost).toHaveBeenNthCalledWith(2, "/sandboxes/sbx_123/exec", {
      command: "echo ok",
    });
  });

  it("exec.stream() opens native sandbox exec SSE", () => {
    const iter = (async function* () {})();
    mockStream.mockReturnValue(iter);

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    const stream = sandbox.exec.stream("pnpm test", {
      cwd: "/workspace",
      timeout: 30,
    });

    expect(stream).toBe(iter);
    expect(mockStream).toHaveBeenCalledWith("/sandboxes/sbx_123/exec/stream", {
      method: "POST",
      body: {
        command: "pnpm test",
        cwd: "/workspace",
        timeout: 30,
      },
    });
  });

  it("files.write() writes through native sandbox file API", async () => {
    mockPost.mockResolvedValue({});

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    await sandbox.files.write("/workspace/app.txt", "hello");

    expect(mockPost).toHaveBeenCalledWith("/sandboxes/sbx_123/files", {
      path: "/workspace/app.txt",
      content: "aGVsbG8=",
    });
  });

  it("files.list() and files.stat() use native sandbox file endpoints", async () => {
    mockGet.mockResolvedValue({ data: { path: "/workspace", entries: [] } });
    mockPost.mockResolvedValue({
      data: { path: "/workspace/app.txt", size: 5 },
    });

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    const files = await sandbox.files.list("/workspace");
    const stat = await sandbox.files.stat("/workspace/app.txt");

    expect(mockGet).toHaveBeenCalledWith("/sandboxes/sbx_123/files", {
      path: "/workspace",
    });
    expect(mockPost).toHaveBeenCalledWith("/sandboxes/sbx_123/files/stat", {
      path: "/workspace/app.txt",
    });
    expect(files.entries).toEqual([]);
    expect(stat.size).toBe(5);
  });

  it("preview.expose() returns native sandbox preview URL", async () => {
    mockPost.mockResolvedValue({
      data: { url: "https://5173-sbx.sandbox.miosa.app" },
    });

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    const url = await sandbox.preview.expose(5173);

    expect(mockPost).toHaveBeenCalledWith("/sandboxes/sbx_123/expose", {
      port: 5173,
    });
    expect(url).toBe("https://5173-sbx.sandbox.miosa.app");
  });

  it("logs get/stream use native sandbox log endpoints", async () => {
    const iter = (async function* () {})();
    mockGet.mockResolvedValue({ data: { lines: ["ok"] } });
    mockStream.mockReturnValue(iter);

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    const logs = await sandbox.logs.get(100);
    const stream = sandbox.logs.stream();

    expect(mockGet).toHaveBeenCalledWith("/sandboxes/sbx_123/logs", {
      lines: 100,
    });
    expect(mockStream).toHaveBeenCalledWith("/sandboxes/sbx_123/logs/stream");
    expect(logs).toEqual({ lines: ["ok"] });
    expect(stream).toBe(iter);
  });

  it("snapshots create/list/restore/delete use native sandbox snapshot endpoints", async () => {
    mockPost
      .mockResolvedValueOnce({ data: { id: "snap_1", sandbox_id: "sbx_123" } })
      .mockResolvedValueOnce({ data: sandboxData({ id: "sbx_restored" }) });
    mockGet.mockResolvedValue({
      data: [{ id: "snap_1", sandbox_id: "sbx_123" }],
    });
    mockDelete.mockResolvedValue(undefined);

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    const created = await sandbox.snapshots.create("checkpoint");
    const snapshots = await sandbox.snapshots.list();
    const restored = await sandbox.snapshots.restore("snap_1");
    await sandbox.snapshots.delete("snap_1");

    expect(mockPost).toHaveBeenNthCalledWith(
      1,
      "/sandboxes/sbx_123/snapshots",
      {
        comment: "checkpoint",
      },
    );
    expect(mockGet).toHaveBeenCalledWith("/sandboxes/sbx_123/snapshots");
    expect(mockPost).toHaveBeenNthCalledWith(
      2,
      "/sandboxes/sbx_123/restore/snap_1",
      {},
    );
    expect(mockDelete).toHaveBeenCalledWith(
      "/sandboxes/sbx_123/snapshots/snap_1",
    );
    expect(created.id).toBe("snap_1");
    expect(snapshots[0]?.id).toBe("snap_1");
    expect(restored.id).toBe("sbx_restored");
  });

  it("pause/resume/deploy use native sandbox lifecycle endpoints", async () => {
    mockPost
      .mockResolvedValueOnce({ data: sandboxData({ state: "paused" }) })
      .mockResolvedValueOnce({ data: sandboxData({ state: "running" }) })
      .mockResolvedValueOnce({
        data: { deployment_id: "dep_1", url: "https://app.miosa.app" },
      });

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    await sandbox.pause();
    await sandbox.resume();
    const deployment = await sandbox.deploy({
      name: "site",
      sourcePath: "/workspace/dist",
      customDomain: "example.com",
    });

    expect(mockPost).toHaveBeenNthCalledWith(1, "/sandboxes/sbx_123/pause", {});
    expect(mockPost).toHaveBeenNthCalledWith(
      2,
      "/sandboxes/sbx_123/resume",
      {},
    );
    expect(mockPost).toHaveBeenNthCalledWith(3, "/sandboxes/sbx_123/deploy", {
      name: "site",
      path: "/workspace/dist",
      custom_domain: "example.com",
    });
    expect(deployment.deployment_id).toBe("dep_1");
  });

  it("throws before operations when not running", async () => {
    const sandbox = new Sandbox(
      makeHttp(),
      sandboxData({ state: "provisioning" }),
    );

    await expect(sandbox.exec("echo no")).rejects.toBeInstanceOf(MiosaError);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("keeps the canonical sandbox surface off /computers", async () => {
    const paths: string[] = [];
    const iter = (async function* () {})();
    const http = {
      request: vi.fn(async (path: string) => {
        paths.push(path);
        return { data: sandboxData() };
      }),
      get: vi.fn(async (path: string) => {
        paths.push(path);
        if (path.endsWith("/files"))
          return { data: { path: "/workspace", entries: [] } };
        if (path.endsWith("/logs")) return { data: { lines: [] } };
        if (path.endsWith("/snapshots")) return { data: [] };
        if (path === "/sandbox-templates") return { data: [] };
        if (path.startsWith("/sandbox-templates/"))
          return { id: "miosa-sandbox" };
        return { data: sandboxData() };
      }),
      post: vi.fn(async (path: string) => {
        paths.push(path);
        if (path.endsWith("/exec")) {
          return { data: { stdout: "ok\n", stderr: "", exit_code: 0 } };
        }
        if (path.endsWith("/expose"))
          return { data: { url: "https://sbx.sandbox.miosa.app" } };
        if (path.endsWith("/artifacts")) return { data: { artifacts: {} } };
        if (path.endsWith("/files/stat"))
          return { data: { path: "/workspace/app.txt", size: 2 } };
        if (path.endsWith("/snapshots")) return { data: { id: "snap_1" } };
        if (path.includes("/restore/"))
          return { data: sandboxData({ id: "sbx_restored" }) };
        if (path.endsWith("/deploy"))
          return { data: { deployment_id: "dep_1" } };
        return { data: sandboxData() };
      }),
      delete: vi.fn(async (path: string) => {
        paths.push(path);
      }),
      getBinary: vi.fn(async (path: string) => {
        paths.push(path);
        return new TextEncoder().encode("ok");
      }),
      stream: vi.fn((path: string) => {
        paths.push(path);
        return iter;
      }),
    } as unknown as HttpClient;

    const client = new Sandboxes(http);
    await client.create();
    await client.list();
    await client.get("sbx_123");
    await client.connect("sbx_123");
    await client.delete("sbx_123");
    await client.listTemplates();
    await client.getTemplate("miosa-sandbox");

    const sandbox = new Sandbox(http, sandboxData());
    await sandbox.commands.run("echo ok");
    sandbox.commands.stream("echo ok");
    await sandbox.exec.run("echo ok");
    sandbox.exec.stream("echo ok");
    await sandbox.files.write("/workspace/app.txt", "ok");
    await sandbox.files.readText("/workspace/app.txt");
    await sandbox.files.list("/workspace");
    await sandbox.files.stat("/workspace/app.txt");
    await sandbox.preview.expose(5173);
    await sandbox.artifacts.list();
    await sandbox.logs.get(10);
    sandbox.logs.stream();
    await sandbox.snapshots.create("checkpoint");
    await sandbox.snapshots.list();
    await sandbox.snapshots.restore("snap_1");
    await sandbox.snapshots.delete("snap_1");
    await sandbox.pause();
    await sandbox.resume();
    await sandbox.deploy({ name: "site", sourcePath: "/workspace/dist" });

    expect(paths).not.toEqual(
      expect.arrayContaining([expect.stringContaining("/computers")]),
    );
  });
});

// ─── waitUntilReady() ──────────────────────────────────────────────────────

function makeHttpForStream(): HttpClient {
  const http = makeHttp();
  // Public properties used by the SSE fetch fallback. Cast through unknown to
  // assign readonly fields on the mocked instance.
  (http as unknown as { baseUrl: string }).baseUrl =
    "https://api.miosa.test/api/v1";
  (http as unknown as { apiKey: string }).apiKey = "msk_u_test";
  return http;
}

function sseResponse(body: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

describe("Sandbox.waitUntilReady", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns true when SSE emits event: ready", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse(
          ': keepalive\n\nevent: ready\ndata: {"ready_at":"2026-05-18T00:00:00Z"}\n\n',
        ),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const sandbox = new Sandbox(makeHttpForStream(), sandboxData());
    const result = await sandbox.waitUntilReady({ timeout: 5 });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.miosa.test/api/v1/sandboxes/sbx_123/readiness/stream",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer msk_u_test",
          Accept: "text/event-stream",
        }),
      }),
    );
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("returns false when SSE emits event: timeout", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        sseResponse('event: timeout\ndata: {"reason":"not_ready"}\n\n'),
      ) as unknown as typeof fetch;

    const sandbox = new Sandbox(makeHttpForStream(), sandboxData());
    const result = await sandbox.waitUntilReady({ timeout: 5 });

    expect(result).toBe(false);
  });

  it("falls back to polling when SSE returns 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('{"error":"not implemented"}', {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    // First poll: not ready. Second poll: ready.
    mockGet
      .mockResolvedValueOnce({ data: { ready: false } })
      .mockResolvedValueOnce({ data: { ready: true } });

    const sandbox = new Sandbox(makeHttpForStream(), sandboxData());
    const result = await sandbox.waitUntilReady({ timeout: 2 });

    expect(result).toBe(true);
    expect(mockGet).toHaveBeenCalledWith("/sandboxes/sbx_123/readiness");
    expect(mockGet.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("stream:false skips SSE and only polls", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    mockGet.mockResolvedValue({ data: { ready: true } });

    const sandbox = new Sandbox(makeHttpForStream(), sandboxData());
    const result = await sandbox.waitUntilReady({ timeout: 2, stream: false });

    expect(result).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith("/sandboxes/sbx_123/readiness");
  });
});
