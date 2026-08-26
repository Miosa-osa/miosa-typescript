import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MiosaError, NotFoundError } from "../errors.js";
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
    size: "small",
    resource_contract: {
      id: "sandbox/small@v1",
      version: "v1",
      product: "sandbox",
      size: "small",
      vcpus: 2,
      memory_mb: 4096,
      disk_size_mb: 10240,
    },
    image_id: "miosa-sandbox-prod-1",
    cpu_count: 2,
    memory_mb: 4096,
    disk_size_mb: 10240,
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
    mockRequest.mockResolvedValue({
      data: sandboxData({
        external_workspace_id: "workspace_1",
        external_user_id: "user_1",
        external_project_id: "project_1",
      }),
    });

    const client = new Sandboxes(makeHttp());
    const sandbox = await client.create({
      templateId: "nextjs",
      idempotencyKey: "idem-1",
      workspaceId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    });

    expect(mockRequest).toHaveBeenCalledWith("/sandboxes", {
      method: "POST",
      body: {
        template_id: "nextjs",
        workspace_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      },
      headers: { "Idempotency-Key": "idem-1" },
    });
    expect(sandbox).toBeInstanceOf(Sandbox);
    expect(sandbox.id).toBe("sbx_123");
    expect(sandbox.data).toMatchObject({
      external_workspace_id: "workspace_1",
      external_user_id: "user_1",
      external_project_id: "project_1",
    });
  });

  it("create() defaults to miosa-sandbox", async () => {
    mockRequest.mockResolvedValue(sandboxData());

    await new Sandboxes(makeHttp()).create();

    expect(mockRequest).toHaveBeenCalledWith("/sandboxes", {
      method: "POST",
      body: { template_id: "miosa-sandbox" },
    });
  });

  it("create() sends canonical workspace and project ownership", async () => {
    mockRequest.mockResolvedValue(sandboxData());

    await new Sandboxes(makeHttp()).create({
      workspaceSlug: "clinic-iq",
      workspaceName: "Clinic IQ",
      projectSlug: "agent-runtime",
      projectName: "Agent Runtime",
    });

    expect(mockRequest).toHaveBeenCalledWith("/sandboxes", {
      method: "POST",
      body: {
        template_id: "miosa-sandbox",
        workspace_slug: "clinic-iq",
        workspace_name: "Clinic IQ",
        project_slug: "agent-runtime",
        project_name: "Agent Runtime",
      },
    });
  });

  it("create() resolves exact resources to their named contract", async () => {
    mockRequest.mockResolvedValue(sandboxData());

    await new Sandboxes(makeHttp()).create({
      cpuCount: 4,
      memoryMb: 8192,
      diskSizeMb: 20480,
    });

    expect(mockRequest).toHaveBeenCalledWith("/sandboxes", {
      method: "POST",
      body: {
        template_id: "miosa-sandbox",
        size: "medium",
        cpu_count: 4,
        memory_mb: 8192,
        disk_size_mb: 20480,
      },
    });
  });

  it("create() rejects incomplete or unsupported exact resources", async () => {
    const sandboxes = new Sandboxes(makeHttp());

    await expect(
      sandboxes.create({ cpuCount: 2, memoryMb: 4096 }),
    ).rejects.toThrow("require cpuCount, memoryMb, and diskSizeMb together");
    await expect(
      sandboxes.create({
        cpuCount: 3,
        memoryMb: 4096,
        diskSizeMb: 10240,
      }),
    ).rejects.toThrow("must exactly match a named size contract");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("create() maps agent runtime profile controls", async () => {
    mockRequest.mockResolvedValue(sandboxData());

    await new Sandboxes(makeHttp()).create({
      agentRuntimeProfileId: "profile_123",
      skipRuntimeProfile: false,
    });

    expect(mockRequest).toHaveBeenCalledWith("/sandboxes", {
      method: "POST",
      body: {
        template_id: "miosa-sandbox",
        agent_runtime_profile_id: "profile_123",
        skip_agent_runtime_profile: false,
      },
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

  it("fork() sends only canonical public fields", async () => {
    mockRequest.mockResolvedValue({ data: sandboxData({ id: "sbx_fork" }) });
    const sandbox = new Sandbox(makeHttp(), sandboxData());

    await sandbox.fork({
      timeoutSec: 1200,
      templateId: "node-22",
      idempotencyKey: "fork-idem-1",
    });

    expect(mockRequest).toHaveBeenCalledWith("/sandboxes/sbx_123/fork", {
      method: "POST",
      body: { timeout_sec: 1200, template_id: "node-22" },
      headers: { "Idempotency-Key": "fork-idem-1" },
    });
  });

  it("fork() preserves the deprecated name and metadata compatibility shape", async () => {
    mockRequest.mockResolvedValue({ data: sandboxData({ id: "sbx_fork" }) });
    const sandbox = new Sandbox(makeHttp(), sandboxData());

    await sandbox.fork({
      name: "legacy-fork",
      metadata: { source: "legacy" },
    });

    expect(mockRequest).toHaveBeenCalledWith("/sandboxes/sbx_123/fork", {
      method: "POST",
      body: {
        name: "legacy-fork",
        metadata: { source: "legacy" },
      },
    });
  });

  it("getByName() URL-encodes the stable sandbox name", async () => {
    mockGet.mockResolvedValue({ data: sandboxData({ id: "sbx_named" }) });

    const sandbox = await new Sandboxes(makeHttp()).getByName(
      "customer builder",
    );

    expect(mockGet).toHaveBeenCalledWith(
      "/sandboxes/by-name/customer%20builder",
    );
    expect(sandbox.id).toBe("sbx_named");
  });

  it("getOrCreate() resumes an existing paused sandbox by name", async () => {
    mockGet.mockResolvedValueOnce({
      data: sandboxData({ state: "paused", name: "agent-builder" }),
    });
    mockPost.mockResolvedValueOnce({
      data: sandboxData({ state: "running", name: "agent-builder" }),
    });

    const sandbox = await new Sandboxes(makeHttp()).getOrCreate({
      name: "agent-builder",
    });

    expect(mockGet).toHaveBeenCalledWith("/sandboxes/by-name/agent-builder");
    expect(mockPost).toHaveBeenCalledWith("/sandboxes/sbx_123/resume", {});
    expect(sandbox.state).toBe("running");
  });

  it("createAgentWorkspace() creates a missing named sandbox with persistent agent defaults", async () => {
    mockGet.mockRejectedValueOnce(new NotFoundError("missing"));
    mockRequest.mockResolvedValueOnce({
      data: sandboxData({ name: "agent-builder" }),
    });

    const sandbox = await new Sandboxes(makeHttp()).createAgentWorkspace({
      name: "agent-builder",
      externalWorkspaceId: "clinic-123",
      externalUserId: "dr-smith",
      waitUntilReady: false,
    });

    expect(mockRequest).toHaveBeenCalledWith("/sandboxes", {
      method: "POST",
      body: {
        template_id: "miosa-sandbox",
        persistent: true,
        timeout_sec: 86_400,
        idle_timeout_sec: 1800,
        metadata: {
          miosa_workspace_kind: "agent_workspace",
          miosa_persistent: true,
          snapshot_expiration_sec: 2_592_000,
          keep_last_snapshots: 1,
        },
        name: "agent-builder",
        external_workspace_id: "clinic-123",
        external_user_id: "dr-smith",
      },
    });
    expect(sandbox.id).toBe("sbx_123");
  });

  it("create() maps explicit persistence policy into lifecycle defaults and metadata", async () => {
    mockRequest.mockResolvedValueOnce({
      data: sandboxData({ name: "persistent-builder" }),
    });

    await new Sandboxes(makeHttp()).create({
      name: "persistent-builder",
      persistent: true,
      snapshotExpirationDays: 14,
      keepLastSnapshots: { count: 2, expirationSec: 60 * 60 * 24 * 30 },
    });

    expect(mockRequest).toHaveBeenCalledWith("/sandboxes", {
      method: "POST",
      body: {
        template_id: "miosa-sandbox",
        persistent: true,
        timeout_sec: 86_400,
        idle_timeout_sec: 1_800,
        metadata: {
          miosa_persistent: true,
          snapshot_expiration_sec: 1_209_600,
          keep_last_snapshots: { count: 2, expirationSec: 2_592_000 },
        },
        name: "persistent-builder",
      },
    });
  });

  it("extend() calls the sandbox timeout endpoint", async () => {
    mockPost.mockResolvedValueOnce({
      data: sandboxData({ timeout_sec: 86_400 }),
    });

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    await sandbox.extend(86_400);

    expect(mockPost).toHaveBeenCalledWith("/sandboxes/sbx_123/extend", {
      timeout_sec: 86_400,
    });
    expect(sandbox.data.timeout_sec).toBe(86_400);
  });

  it("run() dispatches a default Claude Code Run into the sandbox", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        id: "run_1",
        target_kind: "sandbox",
        target_id: "sbx_123",
        runner: "claude-code",
        instruction: "create a hello world server",
        status: "succeeded",
      },
    });

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    const run = await sandbox.run("create a hello world server");

    expect(mockPost).toHaveBeenCalledWith("/runs", {
      instruction: "create a hello world server",
      target_kind: "sandbox",
      target_id: "sbx_123",
      runtime_id: "sbx_123",
      sandbox_id: "sbx_123",
      runner: "claude-code",
      cwd: "/workspace",
      wait: true,
    });
    expect(run.runner).toBe("claude-code");
  });

  it("run() can dispatch Codex with env and wait disabled", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        id: "run_2",
        target_kind: "sandbox",
        target_id: "sbx_123",
        runner: "codex",
        instruction: "edit files",
        status: "running",
      },
    });

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    await sandbox.run("edit files", {
      runner: "codex",
      env: { CODEX_API_KEY: "redacted" },
      cwd: "/workspace/repo",
      wait: false,
    });

    expect(mockPost).toHaveBeenCalledWith("/runs", {
      instruction: "edit files",
      target_kind: "sandbox",
      target_id: "sbx_123",
      runtime_id: "sbx_123",
      sandbox_id: "sbx_123",
      runner: "codex",
      cwd: "/workspace/repo",
      wait: false,
      env: { CODEX_API_KEY: "redacted" },
    });
  });

  it("prompt() passes advanced Claude and Codex runtime options", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        id: "run_3",
        target_kind: "sandbox",
        target_id: "sbx_123",
        provider: "claude",
        prompt: "continue",
        status: "running",
      },
    });

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    await sandbox.prompt("continue", {
      outputFormat: "stream-json",
      resumeSessionId: "sess_123",
      json: true,
      outputSchema: "/workspace/schema.json",
      image: "/workspace/mockup.png",
    });

    expect(mockPost).toHaveBeenCalledWith("/agent-runs", {
      prompt: "continue",
      target_kind: "sandbox",
      target_id: "sbx_123",
      sandbox_id: "sbx_123",
      provider: "claude",
      cwd: "/workspace",
      wait: true,
      output_format: "stream-json",
      resume_session_id: "sess_123",
      json: true,
      output_schema: "/workspace/schema.json",
      image: "/workspace/mockup.png",
    });
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

  it("createExport() creates a portable sandbox export descriptor", async () => {
    mockPost.mockResolvedValue({
      data: {
        id: "exp_123",
        sandbox_id: "sbx_123",
        status: "ready",
        files: [
          {
            path: "/workspace/dist/index.html",
            filename: "index.html",
            download_url: "https://api.miosa.test/download",
          },
        ],
        archive_download_url: "https://api.miosa.test/archive",
        created_at: "2026-06-14T00:00:00Z",
      },
    });

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    const result = await sandbox.createExport({
      paths: ["/workspace/dist/index.html"],
      label: "build",
    });

    expect(mockPost).toHaveBeenCalledWith("/sandboxes/sbx_123/exports", {
      paths: ["/workspace/dist/index.html"],
      label: "build",
    });
    expect(result.sandboxId).toBe("sbx_123");
    expect(result.archiveDownloadUrl).toBe("https://api.miosa.test/archive");
    expect(result.files[0]?.downloadUrl).toBe(
      "https://api.miosa.test/download",
    );
  });

  it("downloadExport() downloads one file or archive as binary", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    mockGetBinary.mockResolvedValue(bytes);

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    const result = await sandbox.downloadExport([
      "/workspace/dist/index.html",
      "/workspace/dist/app.js",
    ]);

    expect(result).toBe(bytes);
    expect(mockGetBinary).toHaveBeenCalledWith(
      "/sandboxes/sbx_123/exports/download?paths%5B%5D=%2Fworkspace%2Fdist%2Findex.html&paths%5B%5D=%2Fworkspace%2Fdist%2Fapp.js",
    );
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
      data: { url: "https://5173-sbx.sandbox.miosa.ai" },
    });

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    const url = await sandbox.preview.expose(5173);

    expect(mockPost).toHaveBeenCalledWith("/sandboxes/sbx_123/expose", {
      port: 5173,
    });
    expect(url).toBe("https://5173-sbx.sandbox.miosa.ai");
  });

  it("preview.exposeInfo() returns the sandbox URL contract", async () => {
    mockPost.mockResolvedValue({
      data: {
        url: "https://5173-sbx.sandbox.miosa.ai",
        url_class: "temporary_preview",
        stable_for_embedding: false,
        recommended_next_action: "create_alias_or_publish",
      },
    });

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    const info = await sandbox.preview.exposeInfo(5173);

    expect(info).toMatchObject({
      url: "https://5173-sbx.sandbox.miosa.ai",
      url_class: "temporary_preview",
      stable_for_embedding: false,
      recommended_next_action: "create_alias_or_publish",
    });
  });

  it("getHost() and getUrl() use the canonical preview resolver", async () => {
    mockPost.mockResolvedValue({
      data: { url: "https://5173-sbx.sandbox.miosa.ai" },
    });

    const sandbox = new Sandbox(makeHttp(), sandboxData());

    await expect(sandbox.getHost(5173)).resolves.toBe(
      "5173-sbx.sandbox.miosa.ai",
    );
    await expect(sandbox.getUrl(5173, "admin")).resolves.toBe(
      "https://5173-sbx.sandbox.miosa.ai/admin",
    );
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

  it("metrics get uses native sandbox metrics endpoint", async () => {
    mockGet.mockResolvedValue({
      data: {
        resource_type: "sandbox",
        current: { cpu_count: 2, memory_mb: 4096 },
      },
    });

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    const metrics = await sandbox.getMetrics("24h");
    const resourceMetrics = await sandbox.metricsResource.get("24h");

    expect(mockGet).toHaveBeenNthCalledWith(1, "/sandboxes/sbx_123/metrics", {
      window: "24h",
    });
    expect(mockGet).toHaveBeenNthCalledWith(2, "/sandboxes/sbx_123/metrics", {
      window: "24h",
    });
    expect(metrics.current).toEqual({ cpu_count: 2, memory_mb: 4096 });
    expect(resourceMetrics.current).toEqual({ cpu_count: 2, memory_mb: 4096 });
  });

  it("pause/resume/deploy use native sandbox lifecycle endpoints", async () => {
    mockPost
      .mockResolvedValueOnce({ data: sandboxData({ state: "paused" }) })
      .mockResolvedValueOnce({ data: sandboxData({ state: "running" }) });
    mockRequest.mockResolvedValueOnce({
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
    expect(mockRequest).toHaveBeenCalledWith("/sandboxes/sbx_123/deploy", {
      method: "POST",
      body: {
        name: "site",
        output_path: "/workspace/dist",
        custom_domain: "example.com",
      },
    });
    expect(deployment.deployment_id).toBe("dep_1");
  });

  it("deployDocker marks sandbox deployment for App Engine", async () => {
    mockRequest.mockResolvedValueOnce({
      data: {
        deployment_id: "dep_2",
        deployment_product: "docker_deploy",
        data: { deployment: { docker_deploy_host_id: "ddh_123" } },
      },
    });

    const sandbox = new Sandbox(makeHttp(), sandboxData());
    const deployment = await sandbox.deployDocker({
      name: "docker-site",
      port: 3000,
    });

    expect(mockRequest).toHaveBeenCalledWith("/sandboxes/sbx_123/deploy", {
      method: "POST",
      body: {
        name: "docker-site",
        port: 3000,
        deployment_type: "docker_deploy",
      },
    });
    expect(deployment.deployment_product).toBe("docker_deploy");
  });

  it("deploySnapshot publishes an isolated approved snapshot and cleans it up", async () => {
    mockRequest
      .mockResolvedValueOnce({ data: sandboxData({ id: "sbx_release_1" }) })
      .mockResolvedValueOnce({ data: { deployment_id: "dep_release_1" } });
    mockDelete.mockResolvedValueOnce({
      data: sandboxData({ id: "sbx_release_1", state: "destroyed" }),
    });
    const sandbox = new Sandbox(makeHttp(), sandboxData());

    const deployment = await sandbox.deploySnapshot("snap_approved_1", {
      name: "approved-site",
    });

    expect(mockRequest).toHaveBeenNthCalledWith(1, "/sandboxes/sbx_123/fork", {
      method: "POST",
      body: {
        snapshot_id: "snap_approved_1",
        name: "release-snap_approve",
        metadata: {
          release_source_sandbox_id: "sbx_123",
          snapshot_id: "snap_approved_1",
        },
      },
    });
    expect(mockRequest).toHaveBeenNthCalledWith(
      2,
      "/sandboxes/sbx_release_1/deploy",
      { method: "POST", body: { name: "approved-site" } },
    );
    expect(mockDelete).toHaveBeenCalledWith("/sandboxes/sbx_release_1");
    expect(deployment.source_snapshot_id).toBe("snap_approved_1");
  });

  it("deploySnapshot reports cleanup failures without masking the deployment", async () => {
    mockRequest
      .mockResolvedValueOnce({ data: sandboxData({ id: "sbx_release_1" }) })
      .mockResolvedValueOnce({ data: { deployment_id: "dep_release_1" } });
    mockDelete.mockRejectedValueOnce(new Error("cleanup unavailable"));
    const sandbox = new Sandbox(makeHttp(), sandboxData());

    const deployment = await sandbox.deploySnapshot("snap_approved_1", {
      name: "approved-site",
    });

    expect(deployment.deployment_id).toBe("dep_release_1");
    expect(deployment.release_sandbox_id).toBe("sbx_release_1");
    expect(deployment.release_cleanup_error).toBe("cleanup unavailable");
  });

  it("deploySnapshot keeps provenance when the deploy returns no content", async () => {
    mockRequest
      .mockResolvedValueOnce({ data: sandboxData({ id: "sbx_release_1" }) })
      .mockResolvedValueOnce(undefined);
    mockDelete.mockResolvedValueOnce({
      data: sandboxData({ id: "sbx_release_1", state: "destroyed" }),
    });
    const sandbox = new Sandbox(makeHttp(), sandboxData());

    const deployment = await sandbox.deploySnapshot("snap_approved_1");

    expect(deployment).toEqual({
      source_snapshot_id: "snap_approved_1",
      release_sandbox_id: "sbx_release_1",
    });
    expect(mockDelete).toHaveBeenCalledWith("/sandboxes/sbx_release_1");
  });

  it("deploySnapshot surfaces the orphaned release sandbox when deploy and cleanup both fail", async () => {
    mockRequest
      .mockResolvedValueOnce({ data: sandboxData({ id: "sbx_release_1" }) })
      .mockRejectedValueOnce(
        new MiosaError("deploy rejected", 500, "DEPLOY_FAILED"),
      );
    mockDelete.mockRejectedValueOnce(new Error("cleanup unavailable"));
    const sandbox = new Sandbox(makeHttp(), sandboxData());

    const error = await sandbox
      .deploySnapshot("snap_approved_1")
      .catch((thrown: unknown) => thrown as Record<string, unknown>);

    expect(error).toBeInstanceOf(MiosaError);
    expect((error as Error).message).toBe("deploy rejected");
    expect(error.release_sandbox_id).toBe("sbx_release_1");
    expect(error.release_cleanup_error).toBe("cleanup unavailable");
  });

  it("throws before operations when not running", async () => {
    const sandbox = new Sandbox(
      makeHttp(),
      sandboxData({ state: "provisioning" }),
    );

    await expect(sandbox.exec("echo no")).rejects.toBeInstanceOf(MiosaError);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("allows command and file operations on paused persistent sandboxes", async () => {
    mockPost.mockResolvedValueOnce({
      data: { stdout: "ok\n", stderr: "", exit_code: 0 },
    });
    mockGetBinary.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));

    const sandbox = new Sandbox(
      makeHttp(),
      sandboxData({ state: "paused", persistent: true }),
    );

    const result = await sandbox.exec("echo ok");
    const bytes = await sandbox.download("/workspace/out.pdf");

    expect(result.stdout).toBe("ok\n");
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(mockPost).toHaveBeenCalledWith("/sandboxes/sbx_123/exec", {
      command: "echo ok",
    });
    expect(mockGetBinary).toHaveBeenCalledWith(
      "/sandboxes/sbx_123/files/workspace/out.pdf",
    );
  });

  it("rejects command operations on paused non-persistent sandboxes", async () => {
    const sandbox = new Sandbox(makeHttp(), sandboxData({ state: "paused" }));

    await expect(sandbox.exec("echo ok")).rejects.toMatchObject({
      code: "SANDBOX_NOT_RUNNING",
    });
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
          return { data: { url: "https://sbx.sandbox.miosa.ai" } };
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
