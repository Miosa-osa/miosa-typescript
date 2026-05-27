import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "../../http.js";
import { OpenComputers } from "./index.js";

// ── Shared mock setup ────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();
const mockStream = vi.fn();

function makeHttp(): HttpClient {
  const http = {} as HttpClient;
  http.get = mockGet;
  http.post = mockPost;
  http.patch = mockPatch;
  http.delete = mockDelete;
  http.stream = mockStream;
  http.getBinary = vi.fn();
  http.postFormData = vi.fn();
  return http;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Hosts ────────────────────────────────────────────────────────────────────

describe("OpenComputers.hosts", () => {
  const hostData = {
    id: "host_abc",
    name: "my-mac",
    region: null,
    status: "online",
    tenant_id: "t_1",
    labels: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  it("list() calls GET /opencomputers/hosts", async () => {
    mockGet.mockResolvedValue({
      data: [hostData],
      meta: { total: 1, page: 1, per_page: 20 },
    });
    const oc = new OpenComputers(makeHttp());
    const result = await oc.hosts.list();
    expect(mockGet).toHaveBeenCalledWith("/opencomputers/hosts");
    expect(result.data).toHaveLength(1);
  });

  it("create() calls POST /opencomputers/hosts with host_key in response", async () => {
    const created = { ...hostData, host_key: "hk_secret" };
    mockPost.mockResolvedValue(created);
    const oc = new OpenComputers(makeHttp());
    const result = await oc.hosts.create({ name: "my-mac" });
    expect(mockPost).toHaveBeenCalledWith("/opencomputers/hosts", {
      name: "my-mac",
    });
    expect(result.host_key).toBe("hk_secret");
  });

  it("get() calls GET /opencomputers/hosts/:id", async () => {
    mockGet.mockResolvedValue(hostData);
    const oc = new OpenComputers(makeHttp());
    await oc.hosts.get("host_abc");
    expect(mockGet).toHaveBeenCalledWith("/opencomputers/hosts/host_abc");
  });

  it("update() calls PATCH /opencomputers/hosts/:id", async () => {
    mockPatch.mockResolvedValue({ ...hostData, name: "renamed" });
    const oc = new OpenComputers(makeHttp());
    await oc.hosts.update("host_abc", { name: "renamed" });
    expect(mockPatch).toHaveBeenCalledWith("/opencomputers/hosts/host_abc", {
      name: "renamed",
    });
  });

  it("revoke() calls DELETE /opencomputers/hosts/:id", async () => {
    mockDelete.mockResolvedValue(undefined);
    const oc = new OpenComputers(makeHttp());
    await oc.hosts.revoke("host_abc");
    expect(mockDelete).toHaveBeenCalledWith("/opencomputers/hosts/host_abc");
  });

  it("events() returns an AsyncIterable from stream()", () => {
    async function* fakeStream() {
      yield {
        type: "host_connected",
        host_id: "host_abc",
        data: null,
        timestamp: "t",
      };
    }
    mockStream.mockReturnValue(fakeStream());
    const oc = new OpenComputers(makeHttp());
    const iter = oc.hosts.events();
    expect(mockStream).toHaveBeenCalledWith("/opencomputers/hosts/events");
    expect(typeof iter[Symbol.asyncIterator]).toBe("function");
  });
});

// ── Jobs ─────────────────────────────────────────────────────────────────────

describe("OpenComputers.jobs", () => {
  const jobData = {
    id: "job_1",
    host_id: "host_abc",
    status: "completed",
    command: "npm test",
    args: [],
    env: [],
    cwd: null,
    exit_code: 0,
    stdout: "ok",
    stderr: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    completed_at: "2026-01-01T00:00:01Z",
  };

  it("run() calls POST /opencomputers/hosts/:id/exec", async () => {
    mockPost.mockResolvedValue(jobData);
    const oc = new OpenComputers(makeHttp());
    const result = await oc.jobs.run("host_abc", { command: "npm test" });
    expect(mockPost).toHaveBeenCalledWith(
      "/opencomputers/hosts/host_abc/exec",
      { command: "npm test" },
    );
    expect(result.id).toBe("job_1");
  });

  it("list() calls GET /opencomputers/hosts/:id/exec", async () => {
    mockGet.mockResolvedValue({
      data: [jobData],
      meta: { total: 1, page: 1, per_page: 20 },
    });
    const oc = new OpenComputers(makeHttp());
    await oc.jobs.list("host_abc");
    expect(mockGet).toHaveBeenCalledWith("/opencomputers/hosts/host_abc/exec");
  });

  it("get() calls GET /opencomputers/hosts/:id/exec/:job_id", async () => {
    mockGet.mockResolvedValue(jobData);
    const oc = new OpenComputers(makeHttp());
    await oc.jobs.get("host_abc", "job_1");
    expect(mockGet).toHaveBeenCalledWith(
      "/opencomputers/hosts/host_abc/exec/job_1",
    );
  });

  it("stream() returns an AsyncIterable", () => {
    async function* fakeStream() {
      yield { type: "stdout", job_id: "job_1", data: "ok\n", timestamp: "t" };
      yield { type: "done", job_id: "job_1", data: null, timestamp: "t" };
    }
    mockStream.mockReturnValue(fakeStream());
    const oc = new OpenComputers(makeHttp());
    const iter = oc.jobs.stream("host_abc", "job_1");
    expect(mockStream).toHaveBeenCalledWith(
      "/opencomputers/hosts/host_abc/exec/job_1/stream",
    );
    expect(typeof iter[Symbol.asyncIterator]).toBe("function");
  });

  it("cancel() calls DELETE /opencomputers/hosts/:id/exec/:job_id", async () => {
    mockDelete.mockResolvedValue(undefined);
    const oc = new OpenComputers(makeHttp());
    await oc.jobs.cancel("host_abc", "job_1");
    expect(mockDelete).toHaveBeenCalledWith(
      "/opencomputers/hosts/host_abc/exec/job_1",
    );
  });
});

// ── Error paths ───────────────────────────────────────────────────────────────

describe("OpenComputers error paths", () => {
  it("propagates 401 from hosts.list()", async () => {
    const { AuthError } = await import("../../errors.js");
    mockGet.mockRejectedValue(new AuthError("Unauthorized", "UNAUTHORIZED"));
    const oc = new OpenComputers(makeHttp());
    await expect(oc.hosts.list()).rejects.toBeInstanceOf(AuthError);
  });

  it("propagates 404 from hosts.get()", async () => {
    const { NotFoundError } = await import("../../errors.js");
    mockGet.mockRejectedValue(new NotFoundError("Host not found", "NOT_FOUND"));
    const oc = new OpenComputers(makeHttp());
    await expect(oc.hosts.get("nonexistent")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("propagates 402 from jobs.run() when credits exhausted", async () => {
    const { InsufficientCreditsError } = await import("../../errors.js");
    mockPost.mockRejectedValue(
      new InsufficientCreditsError(
        "Insufficient credits",
        "INSUFFICIENT_CREDITS",
      ),
    );
    const oc = new OpenComputers(makeHttp());
    await expect(
      oc.jobs.run("host_abc", { command: "npm test" }),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);
  });
});

// ── Tunnels ───────────────────────────────────────────────────────────────────

describe("OpenComputers.tunnels", () => {
  const tunnelData = {
    id: "tun_1",
    host_id: "host_abc",
    slug: "abc123",
    target_port: 3000,
    auth_mode: "public",
    public_url: "https://api.miosa.ai/t/abc123",
    enabled: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  it("create() calls POST /opencomputers/hosts/:id/tunnels", async () => {
    mockPost.mockResolvedValue(tunnelData);
    const oc = new OpenComputers(makeHttp());
    const result = await oc.tunnels.create("host_abc", { target_port: 3000 });
    expect(mockPost).toHaveBeenCalledWith(
      "/opencomputers/hosts/host_abc/tunnels",
      { target_port: 3000 },
    );
    expect(result.public_url).toContain("abc123");
  });

  it("delete() calls DELETE /opencomputers/hosts/:id/tunnels/:tid", async () => {
    mockDelete.mockResolvedValue(undefined);
    const oc = new OpenComputers(makeHttp());
    await oc.tunnels.delete("host_abc", "tun_1");
    expect(mockDelete).toHaveBeenCalledWith(
      "/opencomputers/hosts/host_abc/tunnels/tun_1",
    );
  });
});

// ── Agents ────────────────────────────────────────────────────────────────────

describe("OpenComputers.agents", () => {
  const sessionData = {
    id: "sess_1",
    host_id: "host_abc",
    task: "run tests",
    model_id: null,
    status: "pending",
    max_turns: 20,
    turns_used: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    completed_at: null,
    error: null,
  };

  it("dispatch() calls POST /opencomputers/hosts/:id/agent/dispatch", async () => {
    mockPost.mockResolvedValue(sessionData);
    const oc = new OpenComputers(makeHttp());
    const result = await oc.agents.dispatch("host_abc", { task: "run tests" });
    expect(mockPost).toHaveBeenCalledWith(
      "/opencomputers/hosts/host_abc/agent/dispatch",
      { task: "run tests" },
    );
    expect(result.id).toBe("sess_1");
  });

  it("cancel() calls DELETE /opencomputers/hosts/:id/agent/sessions/:id", async () => {
    mockDelete.mockResolvedValue(undefined);
    const oc = new OpenComputers(makeHttp());
    await oc.agents.cancel("host_abc", "sess_1");
    expect(mockDelete).toHaveBeenCalledWith(
      "/opencomputers/hosts/host_abc/agent/sessions/sess_1",
    );
  });
});
