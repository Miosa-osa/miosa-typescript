import { MiosaError } from "../errors.js";
import { HttpClient } from "../http.js";
import { SandboxAudit } from "./egressAudit.js";
import { SandboxNetwork } from "./egressNetwork.js";
import { SandboxSecrets } from "./egressSecrets.js";

function encodeContent(content: string | Uint8Array): string {
  const bytes =
    typeof content === "string" ? new TextEncoder().encode(content) : content;
  const maybeBuffer = (
    globalThis as {
      Buffer?: { from(b: Uint8Array): { toString(e: string): string } };
    }
  ).Buffer;
  if (maybeBuffer) return maybeBuffer.from(bytes).toString("base64");
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

export const SANDBOX_TEMPLATE = "miosa-sandbox";

export type SandboxId = string & { readonly __brand: "SandboxId" };
export type SandboxState =
  | "provisioning"
  | "running"
  | "paused"
  | "destroyed"
  | "error";

export interface SandboxCreateParams {
  templateId?: string;
  template_id?: string;
  image?: string;
  cpuCount?: number;
  cpu_count?: number;
  memoryMb?: number;
  memory_mb?: number;
  diskMb?: number;
  disk_mb?: number;
  diskSizeMb?: number;
  disk_size_mb?: number;
  timeoutSec?: number;
  timeout_sec?: number;
  idleTimeoutSec?: number;
  idle_timeout_sec?: number;
  alwaysOn?: boolean;
  always_on?: boolean;
  env?: Record<string, string>;
  metadata?: Record<string, unknown>;
  services?: Array<Record<string, unknown>>;
  readinessProbe?: Record<string, unknown>;
  readiness_probe?: Record<string, unknown>;
  database?: Record<string, unknown> | boolean;
  githubRepoUrl?: string;
  github_repo_url?: string;
  githubBranch?: string;
  github_branch?: string;
  githubClonePath?: string;
  github_clone_path?: string;
  name?: string;
  region?: string;
  entrypoint?: string;
  tags?: string[];
  idempotencyKey?: string;
  idempotency_key?: string;
  slug?: string;
  // White-label attribution. See platform/attribution docs.
  externalWorkspaceId?: string;
  external_workspace_id?: string;
  externalUserId?: string;
  external_user_id?: string;
  externalProjectId?: string;
  external_project_id?: string;
}

export interface SandboxListParams {
  state?: SandboxState | string;
  tags?: string[];
  externalWorkspaceId?: string;
  external_workspace_id?: string;
  externalUserId?: string;
  external_user_id?: string;
  externalProjectId?: string;
  external_project_id?: string;
}

export interface SandboxExecOptions {
  cwd?: string;
  workingDir?: string;
  working_dir?: string;
  env?: Record<string, string>;
  timeout?: number;
  timeoutSec?: number;
  timeout_sec?: number;
}

export interface SandboxExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  exit_code: number;
  durationMs?: number;
  duration_ms?: number;
}

export type SandboxExecEvent =
  | { type?: "stdout"; line: string }
  | { type?: "stderr"; line: string }
  | { type?: "exit"; exit_code: number; exitCode?: number }
  | Record<string, unknown>;

export interface SandboxExecRunner {
  (command: string, options?: SandboxExecOptions): Promise<SandboxExecResult>;
  run(
    command: string,
    options?: SandboxExecOptions,
  ): Promise<SandboxExecResult>;
  stream(
    command: string,
    options?: SandboxExecOptions,
  ): AsyncIterableIterator<SandboxExecEvent>;
}

export interface SandboxData {
  id: SandboxId;
  state: SandboxState;
  ready?: boolean;
  template_id?: string;
  image_id?: string | null;
  cpu_count?: number | null;
  memory_mb?: number | null;
  disk_mb?: number | null;
  disk_size_mb?: number | null;
  timeout_sec?: number | null;
  boot_path?: string | null;
  boot_ms?: number | null;
  ready_at?: string | null;
  preview_url?: string | null;
  metadata?: Record<string, unknown>;
  inserted_at?: string;
  created_at?: string;
  started_at?: string | null;
  destroyed_at?: string | null;
  total_runtime_sec?: number | null;
}

export interface SandboxTemplate {
  id: string;
  name?: string;
  slug?: string;
  description?: string;
  image_id?: string;
  built_in?: boolean;
  status?: string;
  preview_port?: number | null;
  workdir?: string;
  install_command?: string | null;
  start_command?: string | null;
  readiness_probe?: Record<string, unknown> | null;
  artifact_paths?: string[];
  runtimes?: string[];
  tags?: string[];
  build_spec?: Record<string, unknown>;
  current_build_id?: string | null;
}

export interface SandboxTemplateList {
  data: SandboxTemplate[];
  default_template_id?: string;
}

export interface SandboxBuildSpec {
  from: string;
  vcpu?: number;
  memoryMib?: number;
  diskMib?: number;
  steps?: Array<Record<string, unknown>>;
  env?: Record<string, string>;
  workdir?: string;
  user?: string;
  startCmd?: string;
  readyCmd?: string;
  previewPort?: number;
  artifactPaths?: string[];
}

export interface SandboxBuildSpecError {
  code: string;
  field: string;
  message: string;
}

export interface SandboxBuildSpecValidation {
  valid: boolean;
  build_spec?: Record<string, unknown>;
  errors?: SandboxBuildSpecError[];
}

export interface SandboxTemplateCreateParams {
  name: string;
  buildSpec?: SandboxBuildSpec;
  build_spec?: SandboxBuildSpec;
  slug?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface SandboxTemplateBuildCreateParams {
  buildSpec?: SandboxBuildSpec;
  build_spec?: SandboxBuildSpec;
  metadata?: Record<string, unknown>;
}

export interface SandboxTemplateBuild {
  id: string;
  sandbox_template_id: string;
  source_type: "build_spec" | string;
  state:
    | "queued"
    | "building"
    | "certifying"
    | "snapshotting"
    | "ready"
    | "failed"
    | "cancelled";
  image_id?: string | null;
  rootfs_path?: string | null;
  snapshot_manifest?: Record<string, unknown>;
  log_url?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  build_spec?: Record<string, unknown>;
  inserted_at?: string;
  updated_at?: string;
}

export interface SandboxFileEntry {
  name: string;
  path: string;
  size?: number;
  is_dir?: boolean;
  isDir?: boolean;
  modified_at?: string;
  modifiedAt?: string;
  [key: string]: unknown;
}

export interface SandboxFileTreeNode {
  path: string;
  name: string;
  type: "file" | "dir";
  size?: number;
  modified_at?: string;
  children?: SandboxFileTreeNode[];
}

export interface SandboxWriteManyEntry {
  path: string;
  content: string | Uint8Array;
}

export interface SandboxWriteManyResult {
  written: Array<{ path: string; size_bytes: number }>;
  failed: Array<{ path: string; error: string }>;
}

export interface SandboxFileChange {
  type: "created" | "modified" | "deleted";
  path: string;
  size_bytes?: number;
}

export interface SandboxEnvVar {
  key: string;
  encrypted: boolean;
  value?: string;
}

export interface SandboxFileList {
  path?: string;
  entries: SandboxFileEntry[];
}

export interface SandboxFileStat {
  path: string;
  size?: number;
  is_dir?: boolean;
  isDir?: boolean;
  mode?: string;
  modified_at?: string;
  modifiedAt?: string;
  [key: string]: unknown;
}

export interface SandboxSnapshot {
  id: string;
  sandbox_id?: string;
  status?: string;
  comment?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface SandboxDeployParams {
  name?: string;
  deploymentId?: string;
  deployment_id?: string;
  path?: string;
  sourcePath?: string;
  source_path?: string;
  outputPath?: string;
  output_path?: string;
  sourceSnapshotPath?: string;
  source_snapshot_path?: string;
  entrypoint?: string;
  domain?: string;
  customDomain?: string;
  custom_domain?: string;
  idempotencyKey?: string;
  idempotency_key?: string;
}

type WireEnvelope<T> = T | { data: T };

function unwrap<T>(payload: WireEnvelope<T>): T {
  if (
    payload !== null &&
    typeof payload === "object" &&
    "data" in payload &&
    (payload as { data?: unknown }).data !== undefined
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function listItems(
  payload:
    | WireEnvelope<SandboxData[]>
    | { sandboxes: SandboxData[] }
    | { items: SandboxData[] },
): SandboxData[] {
  if (Array.isArray(payload)) return payload;
  if ("data" in payload && Array.isArray(payload.data)) return payload.data;
  if ("sandboxes" in payload && Array.isArray(payload.sandboxes))
    return payload.sandboxes;
  if ("items" in payload && Array.isArray(payload.items)) return payload.items;
  return [];
}

function createBody(params: SandboxCreateParams = {}): Record<string, unknown> {
  const templateId =
    params.templateId ?? params.template_id ?? params.image ?? SANDBOX_TEMPLATE;
  return stripUndefined({
    template_id: templateId,
    cpu_count: params.cpuCount ?? params.cpu_count,
    memory_mb: params.memoryMb ?? params.memory_mb,
    disk_mb: params.diskMb ?? params.disk_mb,
    disk_size_mb: params.diskSizeMb ?? params.disk_size_mb,
    timeout_sec: params.timeoutSec ?? params.timeout_sec,
    idle_timeout_sec: params.idleTimeoutSec ?? params.idle_timeout_sec,
    always_on: params.alwaysOn ?? params.always_on,
    env: params.env,
    metadata: params.metadata,
    services: params.services,
    readiness_probe: params.readinessProbe ?? params.readiness_probe,
    database: params.database,
    github_repo_url: params.githubRepoUrl ?? params.github_repo_url,
    github_branch: params.githubBranch ?? params.github_branch,
    github_clone_path: params.githubClonePath ?? params.github_clone_path,
    name: params.name,
    region: params.region,
    entrypoint: params.entrypoint,
    tags: params.tags,
    slug: params.slug,
    external_workspace_id:
      params.externalWorkspaceId ?? params.external_workspace_id,
    external_user_id: params.externalUserId ?? params.external_user_id,
    external_project_id: params.externalProjectId ?? params.external_project_id,
  });
}

function execBody(
  command: string,
  options: SandboxExecOptions = {},
): Record<string, unknown> {
  return stripUndefined({
    command,
    cwd: options.cwd ?? options.workingDir ?? options.working_dir,
    env: options.env,
    timeout: options.timeout ?? options.timeoutSec ?? options.timeout_sec,
  });
}

function stripUndefined(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

export class SandboxCommands {
  constructor(private readonly sandbox: Sandbox) {}

  run(
    command: string,
    options?: SandboxExecOptions,
  ): Promise<SandboxExecResult> {
    return this.sandbox.exec.run(command, options);
  }

  stream(
    command: string,
    options?: SandboxExecOptions,
  ): AsyncIterableIterator<SandboxExecEvent> {
    return this.sandbox.exec.stream(command, options);
  }
}

export class SandboxFiles {
  constructor(private readonly sandbox: Sandbox) {}

  async write(path: string, content: string | Uint8Array): Promise<void> {
    await this.sandbox.writeFile(path, content);
  }

  async read(path: string): Promise<Uint8Array> {
    return this.sandbox.download(path);
  }

  async readText(path: string): Promise<string> {
    return new TextDecoder().decode(await this.read(path));
  }

  list(path = "/workspace"): Promise<SandboxFileList> {
    return this.sandbox.listFiles(path);
  }

  stat(path: string): Promise<SandboxFileStat> {
    return this.sandbox.statFile(path);
  }

  upload(path: string, content: string | Uint8Array): Promise<void> {
    return this.write(path, content);
  }

  download(path: string): Promise<Uint8Array> {
    return this.read(path);
  }

  /** GET /api/v1/sandboxes/{id}/files/tree — recursive directory tree. */
  async tree(path = "/workspace", depth = 3): Promise<SandboxFileTreeNode> {
    const http = (this.sandbox as unknown as { http: HttpClient }).http;
    const response = await http.get<unknown>(
      `/sandboxes/${this.sandbox.id}/files/tree`,
      { path, depth },
    );
    if (
      response &&
      typeof response === "object" &&
      "data" in (response as object)
    ) {
      return (response as { data: SandboxFileTreeNode }).data;
    }
    return response as SandboxFileTreeNode;
  }

  /** POST /api/v1/sandboxes/{id}/files/write-many — write multiple files atomically. */
  async writeMany(
    files: SandboxWriteManyEntry[],
  ): Promise<SandboxWriteManyResult> {
    const http = (this.sandbox as unknown as { http: HttpClient }).http;
    const payload = files.map((f) => ({
      path: f.path,
      content_base64: encodeContent(f.content),
    }));
    const response = await http.post<unknown>(
      `/sandboxes/${this.sandbox.id}/files/write-many`,
      { files: payload },
    );
    if (
      response &&
      typeof response === "object" &&
      "data" in (response as object)
    ) {
      return (response as { data: SandboxWriteManyResult }).data;
    }
    return response as SandboxWriteManyResult;
  }

  /** GET /api/v1/sandboxes/{id}/files/watch (SSE) — live file change events. */
  watch(): AsyncIterableIterator<SandboxFileChange> {
    const http = (this.sandbox as unknown as { http: HttpClient }).http;
    return http.stream<SandboxFileChange>(
      `/sandboxes/${this.sandbox.id}/files/watch`,
    );
  }
}

export class SandboxPreview {
  constructor(private readonly sandbox: Sandbox) {}

  expose(port?: number): Promise<string> {
    return this.sandbox.expose(port);
  }
}

export class SandboxArtifacts {
  constructor(private readonly sandbox: Sandbox) {}

  list(): Promise<Record<string, unknown>> {
    return this.sandbox.getArtifacts();
  }
}

export class SandboxLogs {
  constructor(private readonly sandbox: Sandbox) {}

  get(lines?: number): Promise<string | Record<string, unknown>> {
    return this.sandbox.getLogs(lines);
  }

  stream(): AsyncIterableIterator<Record<string, unknown>> {
    return this.sandbox.streamLogs();
  }
}

export class SandboxSnapshots {
  constructor(private readonly sandbox: Sandbox) {}

  create(comment?: string): Promise<SandboxSnapshot> {
    return this.sandbox.createSnapshot(comment);
  }

  list(): Promise<SandboxSnapshot[]> {
    return this.sandbox.listSnapshots();
  }

  restore(snapshotId: string): Promise<Sandbox> {
    return this.sandbox.restoreSnapshot(snapshotId);
  }

  delete(snapshotId: string): Promise<void> {
    return this.sandbox.deleteSnapshot(snapshotId);
  }
}

export class SandboxTerminal {
  constructor(private readonly sandbox: Sandbox) {}

  async create(
    params: {
      cols?: number;
      rows?: number;
      shell?: string;
      cwd?: string;
      env?: Record<string, string>;
    } = {},
  ): Promise<Record<string, unknown>> {
    const body = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined),
    );
    const response = unwrap(
      await (this.sandbox as unknown as { http: HttpClient }).http.post<
        WireEnvelope<Record<string, unknown>>
      >(`/sandboxes/${this.sandbox.id}/terminal`, body),
    );
    return response as Record<string, unknown>;
  }

  async delete(sessionId: string): Promise<void> {
    await (this.sandbox as unknown as { http: HttpClient }).http.delete(
      `/sandboxes/${this.sandbox.id}/terminal/${sessionId}`,
    );
  }
}

export class SandboxEvents {
  constructor(private readonly sandbox: Sandbox) {}

  /** Stream live sandbox events via SSE. */
  stream(): AsyncIterableIterator<Record<string, unknown>> {
    return (this.sandbox as unknown as { http: HttpClient }).http.stream<
      Record<string, unknown>
    >(`/sandboxes/${this.sandbox.id}/events`);
  }
}

export class SandboxPreviews {
  constructor(private readonly sandbox: Sandbox) {}

  private get http(): HttpClient {
    return (this.sandbox as unknown as { http: HttpClient }).http;
  }

  async list(): Promise<Record<string, unknown>[]> {
    const response = await this.http.get<unknown>(
      `/sandboxes/${this.sandbox.id}/previews`,
    );
    if (Array.isArray(response)) return response as Record<string, unknown>[];
    if (response && typeof response === "object") {
      const r = response as Record<string, unknown>;
      for (const k of ["data", "previews", "items"]) {
        if (Array.isArray(r[k])) return r[k] as Record<string, unknown>[];
      }
    }
    return [];
  }

  async create(
    port: number,
    opts: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const body = {
      port,
      ...Object.fromEntries(
        Object.entries(opts).filter(([, v]) => v !== undefined),
      ),
    };
    return unwrap(
      await this.http.post<WireEnvelope<Record<string, unknown>>>(
        `/sandboxes/${this.sandbox.id}/previews`,
        body,
      ),
    ) as Record<string, unknown>;
  }

  async get(previewId: string): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.get<WireEnvelope<Record<string, unknown>>>(
        `/sandboxes/${this.sandbox.id}/previews/${previewId}`,
      ),
    ) as Record<string, unknown>;
  }

  async delete(previewId: string): Promise<void> {
    await this.http.delete(
      `/sandboxes/${this.sandbox.id}/previews/${previewId}`,
    );
  }

  /** Mint a share token for previewId. */
  async share(
    previewId: string,
    opts: { ttl_seconds?: number; expires_in_sec?: number } = {},
  ): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.post<WireEnvelope<Record<string, unknown>>>(
        `/sandboxes/${this.sandbox.id}/previews/${previewId}/share`,
        { ttl_seconds: opts.ttl_seconds ?? opts.expires_in_sec ?? 3600 },
      ),
    ) as Record<string, unknown>;
  }

  /** Invalidate every share token associated with previewId. */
  async revokeShare(previewId: string): Promise<void> {
    await this.http.delete(
      `/sandboxes/${this.sandbox.id}/previews/${previewId}/share`,
    );
  }
}

export class SandboxEnv {
  constructor(private readonly sandbox: Sandbox) {}

  private get http(): HttpClient {
    return (this.sandbox as unknown as { http: HttpClient }).http;
  }

  /** GET /api/v1/sandboxes/{id}/env → list of env vars. */
  async get(): Promise<SandboxEnvVar[]> {
    const response = await this.http.get<unknown>(
      `/sandboxes/${this.sandbox.id}/env`,
    );
    if (Array.isArray(response)) return response as SandboxEnvVar[];
    if (response && typeof response === "object") {
      const r = response as Record<string, unknown>;
      for (const k of ["data", "vars", "env", "items"]) {
        if (Array.isArray(r[k])) return r[k] as SandboxEnvVar[];
      }
    }
    return [];
  }

  /** @deprecated Use get() */
  async list(): Promise<SandboxEnvVar[]> {
    return this.get();
  }

  /** PUT /api/v1/sandboxes/{id}/env — set (replace) env vars. */
  async set(
    vars: Array<{ key: string; value: string; encrypted?: boolean }>,
  ): Promise<SandboxEnvVar[]> {
    const response = await this.http.put<unknown>(
      `/sandboxes/${this.sandbox.id}/env`,
      { vars },
    );
    if (Array.isArray(response)) return response as SandboxEnvVar[];
    if (response && typeof response === "object") {
      const r = response as Record<string, unknown>;
      for (const k of ["data", "vars", "env", "items"]) {
        if (Array.isArray(r[k])) return r[k] as SandboxEnvVar[];
      }
    }
    return [];
  }

  /** DELETE /api/v1/sandboxes/{id}/env/{key} — remove a single env var. */
  async delete(key: string): Promise<void> {
    await this.http.delete<unknown>(
      `/sandboxes/${this.sandbox.id}/env/${encodeURIComponent(key)}`,
    );
  }
}

export class SandboxTags {
  constructor(private readonly sandbox: Sandbox) {}

  /** Replace the full tag list with tags. */
  async set(tags: string[]): Promise<Record<string, unknown>> {
    return unwrap(
      await (this.sandbox as unknown as { http: HttpClient }).http.patch<
        WireEnvelope<Record<string, unknown>>
      >(`/sandboxes/${this.sandbox.id}/tags`, { tags }),
    ) as Record<string, unknown>;
  }
}

export class Sandbox {
  data: SandboxData;
  readonly commands: SandboxCommands;
  readonly exec: SandboxExecRunner;
  readonly files: SandboxFiles;
  readonly preview: SandboxPreview;
  readonly artifacts: SandboxArtifacts;
  readonly logs: SandboxLogs;
  readonly snapshots: SandboxSnapshots;
  /** PTY session control — create/delete. */
  readonly terminal: SandboxTerminal;
  /** SSE event stream. */
  readonly events: SandboxEvents;
  /** Preview CRUD + share/revokeShare. */
  readonly previews: SandboxPreviews;
  /** Read-only env var listing. */
  readonly env: SandboxEnv;
  /** Tag replacement. */
  readonly tags: SandboxTags;
  /** Encrypted secrets + OAuth credentials scoped to this sandbox. */
  readonly secrets: SandboxSecrets;
  /** Egress allowlist + policies scoped to this sandbox. */
  readonly network: SandboxNetwork;
  /** Egress audit log + live tail scoped to this sandbox. */
  readonly audit: SandboxAudit;

  constructor(
    private readonly http: HttpClient,
    data: SandboxData,
  ) {
    this.data = data;
    const runExec = (command: string, options?: SandboxExecOptions) =>
      this.runExec(command, options);
    this.exec = Object.assign(runExec, {
      run: runExec,
      stream: (command: string, options?: SandboxExecOptions) =>
        this.execStream(command, options),
    });
    this.commands = new SandboxCommands(this);
    this.files = new SandboxFiles(this);
    this.preview = new SandboxPreview(this);
    this.artifacts = new SandboxArtifacts(this);
    this.logs = new SandboxLogs(this);
    this.snapshots = new SandboxSnapshots(this);
    this.terminal = new SandboxTerminal(this);
    this.events = new SandboxEvents(this);
    this.previews = new SandboxPreviews(this);
    this.env = new SandboxEnv(this);
    this.tags = new SandboxTags(this);
    // Egress (security) namespaces — pre-scoped to this sandbox id.
    const sandboxId = data.id as string;
    this.secrets = new SandboxSecrets(http, sandboxId);
    this.network = new SandboxNetwork(http, sandboxId);
    this.audit = new SandboxAudit(http, sandboxId);
  }

  get id(): SandboxId {
    return this.data.id;
  }

  get state(): SandboxState {
    return this.data.state;
  }

  get ready(): boolean {
    return this.data.ready ?? this.data.state === "running";
  }

  get templateId(): string {
    return this.data.template_id ?? this.data.image_id ?? "";
  }

  async refresh(): Promise<Sandbox> {
    this.data = unwrap(
      await this.http.get<WireEnvelope<SandboxData>>(`/sandboxes/${this.id}`),
    );
    return this;
  }

  private async runExec(
    command: string,
    options?: SandboxExecOptions,
  ): Promise<SandboxExecResult> {
    this.assertRunning("exec");
    const response = unwrap(
      await this.http.post<WireEnvelope<Record<string, unknown>>>(
        `/sandboxes/${this.id}/exec`,
        execBody(command, options),
      ),
    );
    const exitCode = Number(response.exit_code ?? response.exitCode ?? 0);
    const result: SandboxExecResult = {
      stdout: String(response.stdout ?? ""),
      stderr: String(response.stderr ?? ""),
      exitCode,
      exit_code: exitCode,
    };
    if (typeof response.duration_ms === "number") {
      result.durationMs = response.duration_ms;
      result.duration_ms = response.duration_ms;
    }
    return result;
  }

  private execStream(
    command: string,
    options?: SandboxExecOptions,
  ): AsyncIterableIterator<SandboxExecEvent> {
    this.assertRunning("exec.stream");
    return this.http.stream<SandboxExecEvent>(
      `/sandboxes/${this.id}/exec/stream`,
      {
        method: "POST",
        body: execBody(command, options),
      },
    );
  }

  async writeFile(path: string, content: string | Uint8Array): Promise<void> {
    this.assertRunning("writeFile");
    const bytes =
      typeof content === "string" ? new TextEncoder().encode(content) : content;
    await this.http.post(`/sandboxes/${this.id}/files`, {
      path,
      content: toBase64(bytes),
    });
  }

  async download(path: string): Promise<Uint8Array> {
    this.assertRunning("download");
    return this.http.getBinary(
      `/sandboxes/${this.id}/files/${path.replace(/^\/+/, "")}`,
    );
  }

  async readFile(path: string): Promise<string> {
    return new TextDecoder().decode(await this.download(path));
  }

  async listFiles(path = "/workspace"): Promise<SandboxFileList> {
    this.assertRunning("files.list");
    const response = unwrap(
      await this.http.get<WireEnvelope<SandboxFileList>>(
        `/sandboxes/${this.id}/files`,
        { path },
      ),
    );
    return response;
  }

  async statFile(path: string): Promise<SandboxFileStat> {
    this.assertRunning("files.stat");
    return unwrap(
      await this.http.post<WireEnvelope<SandboxFileStat>>(
        `/sandboxes/${this.id}/files/stat`,
        { path },
      ),
    );
  }

  async expose(port?: number): Promise<string> {
    this.assertRunning("expose");
    const response = unwrap(
      await this.http.post<WireEnvelope<Record<string, unknown>>>(
        `/sandboxes/${this.id}/expose`,
        port === undefined ? {} : { port },
      ),
    );
    return String(response.url ?? response.preview_url ?? "");
  }

  async startTemplate(
    options: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    this.assertRunning("startTemplate");
    return unwrap(
      await this.http.post<WireEnvelope<Record<string, unknown>>>(
        `/sandboxes/${this.id}/template/start`,
        options,
      ),
    );
  }

  async getArtifacts(): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.get<WireEnvelope<Record<string, unknown>>>(
        `/sandboxes/${this.id}/artifacts`,
      ),
    );
  }

  async getLogs(lines?: number): Promise<string | Record<string, unknown>> {
    const response = await this.http.get<WireEnvelope<Record<string, unknown>>>(
      `/sandboxes/${this.id}/logs`,
      { lines },
    );
    return unwrap(response);
  }

  streamLogs(): AsyncIterableIterator<Record<string, unknown>> {
    return this.http.stream<Record<string, unknown>>(
      `/sandboxes/${this.id}/logs/stream`,
    );
  }

  async createSnapshot(comment?: string): Promise<SandboxSnapshot> {
    this.assertRunning("snapshots.create");
    return unwrap(
      await this.http.post<WireEnvelope<SandboxSnapshot>>(
        `/sandboxes/${this.id}/snapshots`,
        comment ? { comment } : {},
      ),
    );
  }

  async listSnapshots(): Promise<SandboxSnapshot[]> {
    return unwrap(
      await this.http.get<WireEnvelope<SandboxSnapshot[]>>(
        `/sandboxes/${this.id}/snapshots`,
      ),
    );
  }

  async restoreSnapshot(snapshotId: string): Promise<Sandbox> {
    const data = unwrap(
      await this.http.post<WireEnvelope<SandboxData>>(
        `/sandboxes/${this.id}/restore/${snapshotId}`,
        {},
      ),
    );
    return new Sandbox(this.http, data);
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    await this.http.delete(`/sandboxes/${this.id}/snapshots/${snapshotId}`);
  }

  /**
   * Fork (clone) this sandbox into a new sandbox via copy-on-write snapshot.
   * The original sandbox continues running unchanged.
   */
  async fork(
    opts: { name?: string; metadata?: Record<string, unknown> } = {},
  ): Promise<Sandbox> {
    this.assertRunning("fork");
    const body: Record<string, unknown> = {};
    if (opts.name !== undefined) body.name = opts.name;
    if (opts.metadata !== undefined) body.metadata = opts.metadata;
    const data = unwrap(
      await this.http.post<WireEnvelope<SandboxData>>(
        `/sandboxes/${this.id}/fork`,
        body,
      ),
    );
    return new Sandbox(this.http, data);
  }

  /**
   * PATCH /api/v1/sandboxes/{id} — update mutable sandbox fields.
   */
  async update(params: {
    name?: string;
    slug?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    always_on?: boolean;
    timeout_sec?: number;
    idle_timeout_sec?: number;
  }): Promise<Sandbox> {
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) body[k] = v;
    }
    const data = unwrap(
      await this.http.patch<WireEnvelope<SandboxData>>(
        `/sandboxes/${this.id}`,
        body,
      ),
    );
    this.data = data;
    return this;
  }

  /**
   * POST /api/v1/sandboxes/{id}/preview-token → {token, url, expires_at, scope}
   */
  async previewToken(
    expiresIn = 3600,
    scope = "read",
  ): Promise<{
    token: string;
    url: string;
    expires_at: string;
    scope: string;
    [key: string]: unknown;
  }> {
    const raw = await this.http.post<unknown>(
      `/sandboxes/${this.id}/preview-token`,
      { expires_in: expiresIn, scope },
    );
    if (raw && typeof raw === "object" && "data" in (raw as object)) {
      return (
        raw as {
          data: {
            token: string;
            url: string;
            expires_at: string;
            scope: string;
          };
        }
      ).data;
    }
    return raw as {
      token: string;
      url: string;
      expires_at: string;
      scope: string;
    };
  }

  async pause(): Promise<Sandbox> {
    const data = unwrap(
      await this.http.post<WireEnvelope<SandboxData>>(
        `/sandboxes/${this.id}/pause`,
        {},
      ),
    );
    this.data = data;
    return this;
  }

  async resume(): Promise<Sandbox> {
    const data = unwrap(
      await this.http.post<WireEnvelope<SandboxData>>(
        `/sandboxes/${this.id}/resume`,
        {},
      ),
    );
    this.data = data;
    return this;
  }

  async deploy(
    params: SandboxDeployParams = {},
  ): Promise<Record<string, unknown>> {
    const idempotencyKey = params.idempotencyKey ?? params.idempotency_key;
    const requestOptions: Parameters<HttpClient["request"]>[1] = {
      method: "POST",
      body: stripUndefined({
        name: params.name,
        deployment_id: params.deploymentId ?? params.deployment_id,
        output_path:
          params.outputPath ??
          params.output_path ??
          params.path ??
          params.sourcePath ??
          params.source_path,
        source_snapshot_path:
          params.sourceSnapshotPath ?? params.source_snapshot_path,
        entrypoint: params.entrypoint,
        domain: params.domain,
        custom_domain: params.customDomain ?? params.custom_domain,
      }),
    };
    if (idempotencyKey) {
      requestOptions.headers = { "Idempotency-Key": idempotencyKey };
    }

    return unwrap(
      await this.http.request<WireEnvelope<Record<string, unknown>>>(
        `/sandboxes/${this.id}/deploy`,
        requestOptions,
      ),
    );
  }

  /** Check readiness of the sandbox (GET /sandboxes/:id/readiness). */
  async readiness(): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.get<WireEnvelope<Record<string, unknown>>>(
        `/sandboxes/${this.id}/readiness`,
      ),
    ) as Record<string, unknown>;
  }

  /**
   * Block until the sandbox reports ready, or *timeout* seconds elapse.
   *
   * When `stream` is `true` (the default) this opens an SSE connection
   * to `GET /sandboxes/:id/readiness/stream` and waits for an
   * `event: ready` frame. The server emits `ready` immediately if the
   * sandbox is already ready, otherwise as soon as the readiness PubSub
   * message fires.
   *
   * Returns `true` once the sandbox is ready, `false` on `event: timeout`
   * or when the local timeout elapses before ready.
   *
   * If the SSE endpoint returns 404 (server pre-dates the streaming
   * endpoint) this transparently falls back to polling
   * {@link readiness} every 10 ms until ready or timeout.
   */
  async waitUntilReady(
    options: { timeout?: number; stream?: boolean } = {},
  ): Promise<boolean> {
    const timeout = options.timeout ?? 30;
    const stream = options.stream ?? true;

    if (stream) {
      const sseResult = await this.tryReadinessStream(timeout);
      if (sseResult !== null) return sseResult;
      // null === fall through to polling fallback (404 or transport error)
    }

    // Polling fallback — fixed 10 ms tick, no exponential backoff.
    const deadlineMs = Date.now() + timeout * 1000;
    while (Date.now() < deadlineMs) {
      try {
        const data = await this.readiness();
        if (data.ready === true || data.status === "ready") return true;
      } catch {
        // swallow transient errors and keep polling
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return false;
  }

  /**
   * Returns `true` / `false` for terminal SSE events, or `null` if the
   * stream endpoint is unavailable (404 or transport error) so callers
   * can fall back to polling.
   */
  private async tryReadinessStream(
    timeoutSec: number,
  ): Promise<boolean | null> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), (timeoutSec + 5) * 1000);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.http.apiKey}`,
        Accept: "text/event-stream",
        "User-Agent": "@miosa/sdk/1.0.0",
      };
      const response = await fetch(
        `${this.http.baseUrl}/sandboxes/${this.id}/readiness/stream`,
        { method: "GET", headers, signal: abort.signal },
      );
      if (response.status === 404) return null;
      if (!response.ok || !response.body) return null;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newlineIdx: number;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIdx).replace(/\r$/, "");
            buffer = buffer.slice(newlineIdx + 1);
            if (line.startsWith("event:")) {
              const evt = line.slice(6).trim();
              if (evt === "ready") return true;
              if (evt === "timeout") return false;
            }
          }
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // already released
        }
      }
      // stream closed without a terminal event — let caller decide
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      try {
        abort.abort();
      } catch {
        // signal already aborted
      }
    }
  }

  async destroy(): Promise<void> {
    if (this.data.state === "destroyed") return;
    await this.http.delete(`/sandboxes/${this.id}`);
    this.data = {
      ...this.data,
      state: "destroyed",
      destroyed_at: new Date().toISOString(),
    };
  }

  delete(): Promise<void> {
    return this.destroy();
  }

  private assertRunning(operation: string): void {
    if (this.data.state === "destroyed") {
      throw new MiosaError(
        `Sandbox ${this.id} has been destroyed`,
        400,
        "SANDBOX_DESTROYED",
      );
    }
    if (this.data.state !== "running") {
      throw new MiosaError(
        `Cannot ${operation} on sandbox ${this.id}: state is ${this.data.state}, expected running`,
        409,
        "SANDBOX_NOT_RUNNING",
      );
    }
  }
}

export class Sandboxes {
  constructor(private readonly http: HttpClient) {}

  async create(params: SandboxCreateParams = {}): Promise<Sandbox> {
    const idempotencyKey = params.idempotencyKey ?? params.idempotency_key;
    const requestOptions: Parameters<HttpClient["request"]>[1] = {
      method: "POST",
      body: createBody(params),
    };
    if (idempotencyKey) {
      requestOptions.headers = { "Idempotency-Key": idempotencyKey };
    }

    const data = unwrap(
      await this.http.request<WireEnvelope<SandboxData>>(
        "/sandboxes",
        requestOptions,
      ),
    );
    return new Sandbox(this.http, data);
  }

  async list(params: SandboxListParams = {}): Promise<Sandbox[]> {
    const data = await this.http.get<
      | WireEnvelope<SandboxData[]>
      | { sandboxes: SandboxData[] }
      | { items: SandboxData[] }
    >("/sandboxes", {
      state: params.state,
      tags: params.tags?.join(","),
      external_workspace_id:
        params.externalWorkspaceId ?? params.external_workspace_id,
      external_user_id: params.externalUserId ?? params.external_user_id,
      external_project_id:
        params.externalProjectId ?? params.external_project_id,
    });
    return listItems(data).map((item) => new Sandbox(this.http, item));
  }

  async get(id: SandboxId | string): Promise<Sandbox> {
    const data = unwrap(
      await this.http.get<WireEnvelope<SandboxData>>(`/sandboxes/${id}`),
    );
    return new Sandbox(this.http, data);
  }

  connect(id: SandboxId | string): Promise<Sandbox> {
    return this.get(id);
  }

  async delete(id: SandboxId | string): Promise<void> {
    await this.http.delete(`/sandboxes/${id}`);
  }

  async listTemplates(
    options: { includeAliases?: boolean } = {},
  ): Promise<SandboxTemplateList> {
    return this.http.get<SandboxTemplateList>("/sandbox-templates", {
      include_aliases: options.includeAliases,
    });
  }

  async getTemplate(id: string): Promise<SandboxTemplate> {
    return this.http.get<SandboxTemplate>(`/sandbox-templates/${id}`);
  }

  async getBuildSpecSchema(): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(
      "/sandbox-templates/build-spec",
    );
  }

  async validateBuildSpec(
    buildSpec: SandboxBuildSpec,
  ): Promise<SandboxBuildSpecValidation> {
    return this.http.post<SandboxBuildSpecValidation>(
      "/sandbox-templates/validate",
      {
        build_spec: buildSpec,
      },
    );
  }

  async createTemplate(
    params: SandboxTemplateCreateParams,
  ): Promise<SandboxTemplate> {
    const response = await this.http.post<WireEnvelope<SandboxTemplate>>(
      "/sandbox-templates",
      stripUndefined({
        name: params.name,
        slug: params.slug,
        description: params.description,
        build_spec: params.buildSpec ?? params.build_spec,
        metadata: params.metadata,
      }),
    );
    return unwrap(response);
  }

  async createTemplateBuild(
    templateId: string,
    params: SandboxTemplateBuildCreateParams = {},
  ): Promise<SandboxTemplateBuild> {
    const response = await this.http.post<WireEnvelope<SandboxTemplateBuild>>(
      `/sandbox-templates/${templateId}/builds`,
      stripUndefined({
        build_spec: params.buildSpec ?? params.build_spec,
        metadata: params.metadata,
      }),
    );
    return unwrap(response);
  }

  async listTemplateBuilds(
    templateId: string,
  ): Promise<SandboxTemplateBuild[]> {
    const response = await this.http.get<WireEnvelope<SandboxTemplateBuild[]>>(
      `/sandbox-templates/${templateId}/builds`,
    );
    return unwrap(response);
  }

  async getTemplateBuild(buildId: string): Promise<SandboxTemplateBuild> {
    const response = await this.http.get<WireEnvelope<SandboxTemplateBuild>>(
      `/sandbox-template-builds/${buildId}`,
    );
    return unwrap(response);
  }
}

function toBase64(bytes: Uint8Array): string {
  const maybeBuffer = (
    globalThis as {
      Buffer?: {
        from(data: Uint8Array): { toString(encoding: string): string };
      };
    }
  ).Buffer;
  if (maybeBuffer) return maybeBuffer.from(bytes).toString("base64");

  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return btoa(binary);
}
