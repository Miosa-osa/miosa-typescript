import type { HttpClient } from "../http.js";

export type DeviceKind = "sandbox" | "computer" | "sandbox_worker" | string;

export interface DeviceData {
  id?: string;
  kind?: DeviceKind;
  type?: DeviceKind;
  name?: string | null;
  state?: string | null;
  status?: string | null;
  ready?: boolean | null;
  persistent?: boolean | null;
  always_on?: boolean | null;
  preview_url?: string | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface DeviceListParams {
  kind?: DeviceKind;
  type?: DeviceKind;
  workspaceId?: string;
  workspace_id?: string;
  projectId?: string;
  project_id?: string;
}

export interface DeviceCapabilities {
  id?: string;
  kind?: DeviceKind;
  capabilities?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DeviceExecParams {
  command: string | string[];
  timeoutMs?: number;
  timeout_ms?: number;
  cwd?: string;
  env?: Record<string, string>;
}

export interface DeviceExecResult {
  exit_code?: number | null;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  status?: string;
  [key: string]: unknown;
}

export interface DeviceFileListParams {
  path?: string;
}

export interface DeviceFileEntry {
  name?: string;
  path?: string;
  type?: "file" | "dir" | string;
  size?: number | null;
  modified?: string | null;
  [key: string]: unknown;
}

export interface DeviceReadFileParams {
  path: string;
}

export interface DeviceReadFileResult {
  path: string;
  size?: number | null;
  encoding?: "base64" | string;
  content: string;
  [key: string]: unknown;
}

export interface DeviceWriteFileParams {
  path: string;
  content?: string;
  contentBase64?: string;
  content_base64?: string;
}

export interface DeviceWriteFileResult {
  path?: string;
  size?: number | null;
  [key: string]: unknown;
}

export interface DeviceExposeParams {
  port: number;
}

export interface DeviceExposeResult {
  port?: number;
  url?: string;
  ready?: boolean;
  [key: string]: unknown;
}

export interface DeviceLifecycleResult {
  id?: string;
  state?: string;
  [key: string]: unknown;
}

export interface DeviceExtendParams {
  timeoutSec?: number;
  timeout_sec?: number;
}

export type DeviceConnectorBinding =
  | string
  | {
      uid?: string;
      name?: string;
      type?: "mcp" | "api-key" | "api_key" | "oauth" | "custom" | string;
      provider?: string;
      managed?: boolean;
      server_url?: string;
      serverUrl?: string;
      scopes?: string[];
      metadata?: Record<string, unknown>;
      [key: string]: unknown;
    };

export interface DeviceBootstrapParams {
  runtime: "osa" | "claude-code" | "claude" | "codex" | "hermes" | "pi" | "custom" | string;
  cwd?: string;
  connectors?: DeviceConnectorBinding[];
  env?: Record<string, string>;
  mcp?: Array<{ name: string; url: string }>;
  installCommand?: string;
  install_command?: string;
  skipProbe?: boolean;
  skip_probe?: boolean;
}

export interface DeviceBootstrapResult {
  device_id: string;
  ok: boolean;
  runtime: string;
  manifest_path: string;
  steps: Array<{
    name: string;
    ok: boolean;
    detail?: unknown;
    error?: string;
  }>;
}

export interface DeviceBrowserResult {
  kind?: string;
  desktop_url?: string;
  desktopEntryUrl?: string;
  desktop_entry_url?: string;
  ws_url?: string;
  wsUrl?: string;
  token?: string;
  expires_at?: number;
  expiresAt?: number;
  computer_id?: string;
  computerId?: string;
  slug?: string;
  [key: string]: unknown;
}

const RUNTIME_BINARIES: Record<string, string[]> = {
  "claude-code": ["claude-code", "claude"],
  claude: ["claude"],
  codex: ["codex"],
  hermes: ["hermes"],
  osa: ["osa"],
  pi: ["pi"],
  custom: [],
};

function unwrap<T>(payload: unknown, keys: string[] = ["data"]): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const key of keys) {
      if (key in p) return p[key] as T;
    }
  }
  return payload as T;
}

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const key of ["data", "devices", "items", "entries"]) {
      if (Array.isArray(p[key])) return p[key] as T[];
    }
  }
  return [];
}

function stripUndefined(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

function pickFirst<T>(...values: Array<T | undefined>): T | undefined {
  for (const value of values) if (value !== undefined) return value;
  return undefined;
}

function queryFromListParams(
  params: DeviceListParams = {},
): Record<string, string | number | boolean | undefined> {
  return stripUndefined({
    kind: pickFirst(params.kind, params.type),
    workspace_id: pickFirst(params.workspaceId, params.workspace_id),
    project_id: pickFirst(params.projectId, params.project_id),
  }) as Record<string, string | number | boolean | undefined>;
}

function queryFromFileParams(
  params: DeviceFileListParams | DeviceReadFileParams = {},
): Record<string, string | number | boolean | undefined> {
  return stripUndefined({
    path: params.path,
  }) as Record<string, string | number | boolean | undefined>;
}

function devicePath(id: string): string {
  return encodeURIComponent(id);
}

export class Devices {
  constructor(private readonly http: HttpClient) {}

  /** List unified MIOSA devices: sandbox workers and desktop computers. */
  async list(params: DeviceListParams = {}): Promise<DeviceData[]> {
    const data = await this.http.get<unknown>(
      "/devices",
      queryFromListParams(params),
    );
    return unwrapList<DeviceData>(data);
  }

  /** Show one unified device by id. */
  async get(id: string): Promise<DeviceData> {
    const data = await this.http.get<unknown>(`/devices/${devicePath(id)}`);
    return unwrap<DeviceData>(data);
  }

  show(id: string): Promise<DeviceData> {
    return this.get(id);
  }

  /** Discover the operations this device supports. */
  async capabilities(id: string): Promise<DeviceCapabilities> {
    const data = await this.http.get<unknown>(
      `/devices/${devicePath(id)}/capabilities`,
    );
    return unwrap<DeviceCapabilities>(data);
  }

  /** Execute a command inside the device. */
  async exec(id: string, params: DeviceExecParams): Promise<DeviceExecResult> {
    const data = await this.http.post<unknown>(
      `/devices/${devicePath(id)}/exec`,
      stripUndefined({
        command: params.command,
        timeout_ms: pickFirst(params.timeoutMs, params.timeout_ms),
        cwd: params.cwd,
        env: params.env,
      }),
    );
    return unwrap<DeviceExecResult>(data);
  }

  /** List files inside the device filesystem. */
  async listFiles(
    id: string,
    params: DeviceFileListParams = {},
  ): Promise<DeviceFileEntry[]> {
    const data = await this.http.get<unknown>(
      `/devices/${devicePath(id)}/files`,
      queryFromFileParams(params),
    );
    return unwrapList<DeviceFileEntry>(data);
  }

  /** Read a file. Content is returned base64-encoded by the API. */
  async readFile(
    id: string,
    params: DeviceReadFileParams,
  ): Promise<DeviceReadFileResult> {
    const data = await this.http.get<unknown>(
      `/devices/${devicePath(id)}/files/read`,
      queryFromFileParams(params),
    );
    return unwrap<DeviceReadFileResult>(data);
  }

  /** Write a text or base64 payload into the device filesystem. */
  async writeFile(
    id: string,
    params: DeviceWriteFileParams,
  ): Promise<DeviceWriteFileResult> {
    const data = await this.http.post<unknown>(
      `/devices/${devicePath(id)}/files/write`,
      stripUndefined({
        path: params.path,
        content: params.content,
        content_base64: pickFirst(params.contentBase64, params.content_base64),
      }),
    );
    return unwrap<DeviceWriteFileResult>(data);
  }

  /** Expose a device port through MIOSA routing. */
  async expose(
    id: string,
    params: DeviceExposeParams,
  ): Promise<DeviceExposeResult> {
    const data = await this.http.post<unknown>(
      `/devices/${devicePath(id)}/expose`,
      { port: params.port },
    );
    return unwrap<DeviceExposeResult>(data);
  }

  /** Return browser/desktop connection details for a computer-backed device. */
  async browser(id: string): Promise<DeviceBrowserResult> {
    const data = await this.http.get<unknown>(`/devices/${devicePath(id)}/browser`);
    return unwrap<DeviceBrowserResult>(data);
  }

  async pause(id: string): Promise<DeviceLifecycleResult> {
    const data = await this.http.post<unknown>(
      `/devices/${devicePath(id)}/pause`,
      {},
    );
    return unwrap<DeviceLifecycleResult>(data);
  }

  async stop(id: string): Promise<DeviceLifecycleResult> {
    const data = await this.http.post<unknown>(
      `/devices/${devicePath(id)}/stop`,
      {},
    );
    return unwrap<DeviceLifecycleResult>(data);
  }

  async resume(id: string): Promise<DeviceLifecycleResult> {
    const data = await this.http.post<unknown>(
      `/devices/${devicePath(id)}/resume`,
      {},
    );
    return unwrap<DeviceLifecycleResult>(data);
  }

  async extend(
    id: string,
    params: DeviceExtendParams,
  ): Promise<DeviceData> {
    const data = await this.http.post<unknown>(
      `/devices/${devicePath(id)}/extend`,
      { timeout_sec: pickFirst(params.timeoutSec, params.timeout_sec) },
    );
    return unwrap<DeviceData>(data);
  }

  async destroy(id: string): Promise<DeviceLifecycleResult> {
    const data = await this.http.delete<unknown>(`/devices/${devicePath(id)}`);
    return unwrap<DeviceLifecycleResult>(data);
  }

  /**
   * Write a MIOSA runtime bootstrap manifest and optionally install/probe
   * an agent runtime inside the device.
   */
  async bootstrap(
    id: string,
    params: DeviceBootstrapParams,
  ): Promise<DeviceBootstrapResult> {
    const runtime = params.runtime.trim().toLowerCase();
    const cwd = params.cwd ?? "/workspace";
    const manifestPath = `${cwd.replace(/\/$/, "")}/.miosa/runtime-bootstrap.json`;
    const steps: DeviceBootstrapResult["steps"] = [];

    const manifest = {
      version: 1,
      runtime,
      cwd,
      expected_binaries: RUNTIME_BINARIES[runtime] ?? [],
      connectors: params.connectors ?? [],
      env: params.env ?? {},
      mcp: params.mcp ?? [],
      created_by: "@miosa/sdk",
    };

    await this.recordStep(steps, "write_manifest", () =>
      this.writeFile(id, {
        path: manifestPath,
        content: `${JSON.stringify(manifest, null, 2)}\n`,
      }),
    );

    const installCommand = pickFirst(params.installCommand, params.install_command);
    if (installCommand) {
      await this.recordStep(steps, "install", () =>
        this.exec(id, {
          command: installCommand,
          cwd,
          timeoutMs: 600_000,
        }),
      );
    }

    if (!(params.skipProbe ?? params.skip_probe)) {
      await this.recordStep(steps, "probe", () =>
        this.exec(id, {
          command: runtimeProbeCommand(runtime),
          cwd,
          timeoutMs: 60_000,
        }),
      );
    }

    return {
      device_id: id,
      ok: steps.every((step) => step.ok),
      runtime,
      manifest_path: manifestPath,
      steps,
    };
  }

  private async recordStep(
    steps: DeviceBootstrapResult["steps"],
    name: string,
    fn: () => Promise<unknown>,
  ): Promise<void> {
    try {
      steps.push({ name, ok: true, detail: await fn() });
    } catch (error) {
      steps.push({
        name,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function runtimeProbeCommand(runtime: string): string {
  const binaries = RUNTIME_BINARIES[runtime] ?? [];
  if (binaries.length === 0) return "printf 'custom runtime manifest written\\n'";
  const checks = binaries
    .map((binary) => `command -v ${shellWord(binary)} >/dev/null 2>&1`)
    .join(" || ");
  const display = binaries.join(" or ");
  return `${checks} && printf 'runtime available: ${display}\\n' || { printf 'runtime missing: ${display}\\n' >&2; exit 127; }`;
}

function shellWord(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}
