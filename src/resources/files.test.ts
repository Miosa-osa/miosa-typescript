import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "../http.js";
import type { DirEntry, FileStat } from "../types.js";
import { Files } from "./files.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve(body),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      body: null,
    }),
  );
}

function makeFiles(computerId = "computer-123"): Files {
  const http = new HttpClient({
    baseUrl: "https://api.miosa.ai/api/v1",
    apiKey: "msk_test_key",
    timeout: 5_000,
    maxRetries: 0,
  });
  return new Files(http, computerId);
}

// ── stat ───────────────────────────────────────────────────────────────────────

describe("Files.stat", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("should POST to /computers/:id/files/stat with path", async () => {
    const mockStat: FileStat = {
      path: "/home/user/main.py",
      size: 42,
      mode: 0o100644,
      is_dir: false,
      is_symlink: false,
      modified_at: "2026-01-01T00:00:00Z",
    };
    mockFetch(200, { data: mockStat });

    const files = makeFiles();
    const result = await files.stat("/home/user/main.py");

    expect(result).toEqual(mockStat);

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/computers/computer-123/files/stat");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      path: "/home/user/main.py",
    });
  });

  it("should unwrap data envelope from response", async () => {
    const stat: FileStat = {
      path: "/tmp/x",
      size: 0,
      mode: 0o40755,
      is_dir: true,
      is_symlink: false,
      modified_at: "2026-01-01T00:00:00Z",
    };
    mockFetch(200, { data: stat });
    const result = await makeFiles().stat("/tmp/x");
    expect(result.is_dir).toBe(true);
    expect(result.size).toBe(0);
  });

  it("should include symlink_target when present", async () => {
    const stat: FileStat = {
      path: "/home/user/link",
      size: 10,
      mode: 0o120777,
      is_dir: false,
      is_symlink: true,
      symlink_target: "/home/user/real.txt",
      modified_at: "2026-01-01T00:00:00Z",
    };
    mockFetch(200, { data: stat });
    const result = await makeFiles().stat("/home/user/link");
    expect(result.is_symlink).toBe(true);
    expect(result.symlink_target).toBe("/home/user/real.txt");
  });
});

// ── mkdir ──────────────────────────────────────────────────────────────────────

describe("Files.mkdir", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("should POST to /computers/:id/files/mkdir with defaults", async () => {
    mockFetch(201, { data: { status: "created", path: "/home/user/project" } });

    await makeFiles().mkdir("/home/user/project");

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/computers/computer-123/files/mkdir");
    const body = JSON.parse(init.body as string);
    expect(body.path).toBe("/home/user/project");
    expect(body.recursive).toBe(true); // default
    expect(body.mode).toBe("0755"); // default
  });

  it("should send correct mode when integer is passed", async () => {
    mockFetch(201, { data: { status: "created" } });

    await makeFiles().mkdir("/tmp/test", { mode: 0o700 });

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body.mode).toBe("0700");
  });

  it("should respect recursive:false", async () => {
    mockFetch(201, { data: { status: "created" } });

    await makeFiles().mkdir("/tmp/strict", { recursive: false });

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body.recursive).toBe(false);
  });
});

// ── rename ─────────────────────────────────────────────────────────────────────

describe("Files.rename", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("should POST to /computers/:id/files/rename with from and to", async () => {
    mockFetch(200, { data: { status: "renamed" } });

    await makeFiles().rename("/home/user/a.txt", "/home/user/b.txt");

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/files/rename");
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe("/home/user/a.txt");
    expect(body.to).toBe("/home/user/b.txt");
  });
});

// ── copy ───────────────────────────────────────────────────────────────────────

describe("Files.copy", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("should POST to /computers/:id/files/copy with recursive:false by default", async () => {
    mockFetch(201, { data: { status: "copied" } });

    await makeFiles().copy("/home/user/src.txt", "/home/user/dst.txt");

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe("/home/user/src.txt");
    expect(body.to).toBe("/home/user/dst.txt");
    expect(body.recursive).toBe(false);
  });

  it("should send recursive:true when option is set", async () => {
    mockFetch(201, { data: { status: "copied" } });

    await makeFiles().copy("/home/user/src", "/home/user/dst", {
      recursive: true,
    });

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body.recursive).toBe(true);
  });
});

// ── chmod ──────────────────────────────────────────────────────────────────────

describe("Files.chmod", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("should POST to /computers/:id/files/chmod with octal integer", async () => {
    mockFetch(200, { data: { status: "ok" } });

    await makeFiles().chmod("/home/user/run.sh", 0o755);

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/files/chmod");
    const body = JSON.parse(init.body as string);
    expect(body.path).toBe("/home/user/run.sh");
    expect(body.mode).toBe("0755");
  });

  it("should accept a string mode directly", async () => {
    mockFetch(200, { data: { status: "ok" } });

    await makeFiles().chmod("/home/user/read.txt", "0644");

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body.mode).toBe("0644");
  });

  it("should zero-pad mode < 4 digits", async () => {
    mockFetch(200, { data: { status: "ok" } });

    // 0o77 = 63 decimal → "0077"
    await makeFiles().chmod("/tmp/x", 0o77);

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body.mode).toBe("0077");
  });
});

// ── readdir ────────────────────────────────────────────────────────────────────

describe("Files.readdir", () => {
  beforeEach(() => vi.restoreAllMocks());

  const mockEntries: DirEntry[] = [
    {
      name: "main.py",
      is_dir: false,
      is_symlink: false,
      size: 100,
      modified_at: "2026-01-01T00:00:00Z",
    },
    {
      name: "tests",
      is_dir: true,
      is_symlink: false,
      size: 0,
      modified_at: "2026-01-01T00:00:00Z",
    },
  ];

  it("should GET /computers/:id/files/readdir with path query param", async () => {
    mockFetch(200, { data: { entries: mockEntries, path: "/workspace" } });

    const result = await makeFiles().readdir("/workspace");

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("/files/readdir");
    expect(url).toContain("path=%2Fworkspace");
    expect(result).toEqual(mockEntries);
  });

  it("should return an array of DirEntry", async () => {
    mockFetch(200, { data: { entries: mockEntries, path: "/workspace" } });

    const entries = await makeFiles().readdir("/workspace");
    expect(entries).toHaveLength(2);
    expect(entries[0]!.name).toBe("main.py");
    expect(entries[0]!.is_dir).toBe(false);
    expect(entries[1]!.name).toBe("tests");
    expect(entries[1]!.is_dir).toBe(true);
  });
});

// ── writeFile / readFile helpers ───────────────────────────────────────────────

describe("Files.writeFile", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("should delegate to upload() with base64-encoded content", async () => {
    mockFetch(201, {
      file: { path: "/home/user/hello.txt" },
      success: true,
    });

    await makeFiles().writeFile("/home/user/hello.txt", "hello");

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/files/write");
    const body = JSON.parse(init.body as string);
    expect(body.path).toBe("/home/user/hello.txt");
    expect(typeof body.content_base64).toBe("string");
  });
});

describe("Files.readFile", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("should delegate to download() and decode UTF-8", async () => {
    const content = "print('hello')";
    const bytes = new TextEncoder().encode(content);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/octet-stream" }),
        json: () => Promise.reject(new Error("not json")),
        arrayBuffer: () => Promise.resolve(bytes.buffer as ArrayBuffer),
        body: null,
      }),
    );

    const result = await makeFiles().readFile("/home/user/main.py");
    expect(result).toBe(content);
  });
});
