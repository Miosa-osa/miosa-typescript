import { HttpClient } from "../http.js";
import type {
  ComputerData,
  ComputerId,
  ComputerViewerPasswordRotation,
  ComputerViewerPasswordStatus,
} from "../types.js";
import { Checkpoints } from "./checkpoints.js";
import { ComputerAutoStop } from "./computer-auto-stop.js";
import { ComputerEnv } from "./computer-env.js";
import { ComputerLogs } from "./computer-logs.js";
import { ComputerOsa } from "./computer-osa.js";
import { ComputerPorts } from "./computer-ports.js";
import { ComputerTerminal } from "./computer-terminal.js";
import { ComputerVolumes } from "./computer-volumes.js";
import { ComputerConnectors } from "./connectors.js";
import { CustomDomains } from "./custom_domains.js";
import { Desktop } from "./desktop.js";
import { ComputerAudit } from "./egressAudit.js";
import { ComputerNetwork } from "./egressNetwork.js";
import { ComputerSecrets } from "./egressSecrets.js";
import { Events } from "./events.js";
import { Exec } from "./exec.js";
import { Files } from "./files.js";
import { NetworkPolicy } from "./network_policy.js";
import {
  AgentRuns,
  type AgentRun,
  type AgentRunCreateParams,
} from "./agent-runs.js";
import {
  Runs,
  type Run,
  type RunCreateParams,
} from "./runs.js";

/**
 * Per-computer inbox config (GET/PATCH /computers/:id/inbox).
 * Defined inline because it has no separate file (small surface).
 */
export class ComputerInbox {
  constructor(
    private readonly http: HttpClient,
    private readonly computerId: string,
  ) {}

  async get(): Promise<Record<string, unknown>> {
    const raw = await this.http.get<unknown>(
      `/computers/${this.computerId}/inbox`,
    );
    return unwrapData(raw);
  }

  async update(
    fields: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const body = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined),
    );
    const raw = await this.http.patch<unknown>(
      `/computers/${this.computerId}/inbox`,
      body,
    );
    return unwrapData(raw);
  }
}

function unwrapData(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if ("data" in d && Object.keys(d).length <= 2) {
      return d.data as Record<string, unknown>;
    }
  }
  return (data ?? {}) as Record<string, unknown>;
}

export type ComputerRunOptions = Omit<
  RunCreateParams,
  "instruction" | "targetKind" | "targetId" | "sandboxId" | "computerId"
>;

export type ComputerPromptOptions = Omit<
  AgentRunCreateParams,
  "prompt" | "targetKind" | "targetId" | "sandboxId" | "computerId"
>;

/**
 * A Computer instance bound to a specific computer ID.
 *
 * Returned by `miosa.computers.create()`, `miosa.computers.get()`, and
 * `miosa.computers.list()`. Exposes all per-computer actions as methods and
 * sub-resources as properties.
 */
export class Computer {
  /** Raw data from the API. Refresh with `await computer.reload()`. */
  data: ComputerData;

  /** Desktop control — screenshot, click, type, drag, etc. */
  readonly desktop: Desktop;

  /** Execute shell and Python commands. */
  readonly exec: Exec;

  /** File operations — upload, download, list, delete. */
  readonly files: Files;

  /** Firecracker checkpoint (snapshot) management. */
  readonly checkpoints: Checkpoints;

  /** Egress network policy — allow/deny rules applied at the host TAP level. */
  readonly networkPolicy: NetworkPolicy;

  /** Real-time event subscription (window, clipboard, file, process, idle). */
  readonly events: Events;

  /** Custom domain management — map your own FQDNs to this sandbox. */
  readonly domains: CustomDomains;

  /** PTY session management — create/resize. */
  readonly terminal: ComputerTerminal;

  /** In-VM OSA agent dispatch — submitTask, cancelTask, status, configure. */
  readonly osa: ComputerOsa;

  /** Idle auto-stop config — get/update. */
  readonly autoStop: ComputerAutoStop;

  /** Per-computer inbox config — get/update. */
  readonly inbox: ComputerInbox;

  /** Encrypted env var CRUD — list, set, update, delete, bulkSet. */
  readonly env: ComputerEnv;

  /** VM log read + SSE stream. */
  readonly logs: ComputerLogs;

  /** Per-port visibility control — list, get, create, update, delete. */
  readonly ports: ComputerPorts;

  /** Volume attachment — list, attach, detach. */
  readonly volumes: ComputerVolumes;

  /** MIOSA Connect provider bindings scoped to this computer. */
  readonly connectors: ComputerConnectors;

  /** Encrypted secrets + OAuth credentials scoped to this computer. */
  readonly secrets: ComputerSecrets;

  /** Egress allowlist + policies scoped to this computer. */
  readonly network: ComputerNetwork;

  /** Egress audit log + live tail scoped to this computer. */
  readonly audit: ComputerAudit;

  private readonly http: HttpClient;

  constructor(http: HttpClient, data: ComputerData) {
    this.http = http;
    this.data = data;

    const id = data.id as string;
    this.desktop = new Desktop(http, id);
    this.exec = new Exec(http, id);
    this.files = new Files(http, id);
    this.checkpoints = new Checkpoints(http, id);
    this.networkPolicy = new NetworkPolicy(http, id);
    this.events = new Events(http.baseUrl, http.apiKey, id);
    this.domains = new CustomDomains(http, id);
    this.terminal = new ComputerTerminal(http, id);
    this.osa = new ComputerOsa(http, id);
    this.autoStop = new ComputerAutoStop(http, id);
    this.inbox = new ComputerInbox(http, id);
    this.env = new ComputerEnv(http, id);
    this.logs = new ComputerLogs(http, id);
    this.ports = new ComputerPorts(http, id);
    this.volumes = new ComputerVolumes(http, id);
    this.connectors = new ComputerConnectors(http, id);
    // Egress (security) namespaces — pre-scoped to this computer id.
    this.secrets = new ComputerSecrets(http, id);
    this.network = new ComputerNetwork(http, id);
    this.audit = new ComputerAudit(http, id);
  }

  get id(): ComputerId {
    return this.data.id;
  }

  get name(): string {
    return this.data.name;
  }

  get status(): ComputerData["status"] {
    return this.data.status;
  }

  /** URL-safe slug; falls back to the raw id when unset. */
  get slug(): string {
    return this.data.slug || (this.data.id as string);
  }

  /**
   * Public HTTPS URL that forwards to a given port inside the VM.
   *
   * Example — expose a dev server running on port 3000:
   * ```ts
   * await computer.exec.bash("npm run dev &");
   * const url = computer.previewUrl(3000);
   * // => https://3000-<slug>.sandbox.<tenant-domain>
   * ```
   *
   * Works for any TCP HTTP listener. Public (no auth required); anyone with
   * the URL can see it. Served over the ingress proxy so it inherits the
   * tenant's white-label preview domain — no per-sandbox certs to manage.
   */
  previewUrl(port: number, path: string = "/"): string {
    const p = path.startsWith("/") ? path : `/${path}`;
    return `https://${port}-${this.slug}.sandbox.${this.previewDomain}${p}`;
  }

  /** Root preview URL — serves whatever is on the default app port. */
  get publicUrl(): string {
    return `https://${this.slug}.sandbox.${this.previewDomain}`;
  }

  /** Tenant's preview/base domain, white-label aware. */
  get previewDomain(): string {
    return this.data.preview_domain || "miosa.ai";
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /** Start the computer. */
  async start(): Promise<Computer> {
    const updated = await this.http.post<ComputerData>(
      `/computers/${this.id}/start`,
    );
    this.data = updated;
    return this;
  }

  /** Stop the computer. */
  async stop(): Promise<Computer> {
    const updated = await this.http.post<ComputerData>(
      `/computers/${this.id}/stop`,
    );
    this.data = updated;
    return this;
  }

  /** Restart the computer. */
  async restart(): Promise<Computer> {
    const updated = await this.http.post<ComputerData>(
      `/computers/${this.id}/restart`,
    );
    this.data = updated;
    return this;
  }

  /** Permanently destroy the computer. After this call the instance is invalid. */
  async destroy(): Promise<void> {
    return this.http.delete<void>(`/computers/${this.id}`);
  }

  /** Reload metadata from the API and update `this.data`. */
  async reload(): Promise<Computer> {
    this.data = await this.http.get<ComputerData>(`/computers/${this.id}`);
    return this;
  }

  /**
   * Run an AI agent inside this Computer.
   *
   * The Computer is the graphical desktop VM product. This dispatches the
   * same Runs API as `miosa agent run --computer`, scoped to this VM.
   */
  async run(
    instruction: string,
    options: ComputerRunOptions = {},
  ): Promise<Run> {
    const runner = options.runner ?? "claude-code";

    return new Runs(this.http).run({
      ...options,
      instruction,
      targetKind: "computer",
      targetId: this.id,
      runtimeId: this.id,
      computerId: this.id,
      runner,
      cwd: options.cwd ?? "/workspace",
      wait: options.wait ?? true,
    });
  }

  /**
   * Dispatch a prompt into this Computer through the Agent Runs API.
   */
  async prompt(
    prompt: string,
    options: ComputerPromptOptions = {},
  ): Promise<AgentRun> {
    return new AgentRuns(this.http).run({
      ...options,
      prompt,
      targetKind: "computer",
      targetId: this.id,
      computerId: this.id,
      provider: options.provider ?? "claude",
      cwd: options.cwd ?? "/workspace",
      wait: options.wait ?? true,
    });
  }

  // ─── Desktop shortcuts ─────────────────────────────────────────────────────

  /**
   * Capture a desktop screenshot as PNG bytes.
   * Shortcut for `computer.desktop.screenshot()`.
   */
  async screenshot(): Promise<Uint8Array> {
    return this.desktop.screenshot();
  }

  /**
   * Capture a desktop screenshot encoded as a base64 string.
   * Convenience for AI agents that pass screenshots to LLMs.
   */
  async screenshotBase64(): Promise<string> {
    const bytes = await this.desktop.screenshot();
    // Browser-safe base64 — Buffer isn't always available.
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  }

  /**
   * Click at the given coordinates (default left button).
   * Shortcut for `computer.desktop.click(x, y)`.
   */
  async click(x: number, y: number): Promise<void> {
    await this.desktop.click(x, y);
  }

  /** Explicit left-button click. Alias for `click(x, y)`. */
  async leftClick(x: number, y: number): Promise<void> {
    await this.desktop.click(x, y, "left");
  }

  /** Right-button click. */
  async rightClick(x: number, y: number): Promise<void> {
    await this.desktop.click(x, y, "right");
  }

  /** Double-click at the given coordinates. */
  async doubleClick(x: number, y: number): Promise<void> {
    await this.desktop.doubleClick(x, y);
  }

  /** Middle-button click. */
  async middleClick(x: number, y: number): Promise<void> {
    await this.desktop.click(x, y, "middle");
  }

  /** Move the pointer without clicking. */
  async moveMouse(x: number, y: number): Promise<void> {
    await this.desktop.moveMouse(x, y);
  }

  /**
   * Type text into the focused element.
   * Shortcut for `computer.desktop.type(text)`.
   */
  async type(text: string): Promise<void> {
    await this.desktop.type(text);
  }

  /** Alias for `type(text)`. */
  async write(text: string): Promise<void> {
    await this.desktop.write(text);
  }

  /**
   * Send a key or key combo.
   * Shortcut for `computer.desktop.key(key)`.
   */
  async key(key: string): Promise<void> {
    await this.desktop.key(key);
  }

  /** Alias for `key(key)`. */
  async press(key: string): Promise<void> {
    await this.desktop.press(key);
  }

  /**
   * Scroll in a direction.
   * Shortcut for `computer.desktop.scroll(direction, clicks)`.
   */
  async scroll(
    direction: Parameters<Desktop["scroll"]>[0],
    clicks = 3,
  ): Promise<void> {
    await this.desktop.scroll(direction, clicks);
  }

  /**
   * Click and drag between two points.
   * Shortcut for `computer.desktop.drag(fromX, fromY, toX, toY)`.
   */
  async drag(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): Promise<void> {
    await this.desktop.drag(fromX, fromY, toX, toY);
  }

  /**
   * Wait for N seconds inside the desktop environment.
   * Shortcut for `computer.desktop.wait(seconds)`.
   */
  async wait(seconds: number): Promise<void> {
    await this.desktop.wait(seconds);
  }

  // ─── Exec shortcuts ────────────────────────────────────────────────────────

  /**
   * Run a shell command.
   * Shortcut for `computer.exec.bash(command)`.
   */
  async bash(command: string, timeout?: number) {
    return this.exec.bash(command, timeout);
  }

  /**
   * Run Python code.
   * Shortcut for `computer.exec.python(code)`.
   */
  async python(code: string, timeout?: number) {
    return this.exec.python(code, timeout);
  }

  // ─── Window / cursor / app shortcuts ───────────────────────────────────────

  /** List open windows on the desktop. */
  async windows(): Promise<Awaited<ReturnType<Desktop["windows"]>>> {
    return this.desktop.windows();
  }

  /** Get the current cursor position. */
  async cursor(): Promise<Awaited<ReturnType<Desktop["cursor"]>>> {
    return this.desktop.cursor();
  }

  /** Focus a specific window by ID. */
  async focusWindow(windowId: string): Promise<void> {
    await this.desktop.focusWindow(windowId);
  }

  /** Launch an installed app inside the VM. */
  async launch(appName: string): Promise<void> {
    await this.desktop.launch(appName);
  }

  // ─── Scoped filesystem helper ──────────────────────────────────────────────

  /**
   * Return a `ScopedFs` bound to `workingDir`.  All path arguments to
   * `readFile`, `writeFile`, and `readdir` are resolved relative to that
   * directory — no need to repeat the prefix on every call.
   *
   * ```ts
   * const fs = computer.fs("/workspace");
   * await fs.writeFile("main.py", "print(1)");
   * const src = await fs.readFile("main.py");
   * const entries = await fs.readdir(".");
   * ```
   */
  fs(workingDir: string): ScopedFs {
    return new ScopedFs(this.files, workingDir);
  }

  // ─── Direct methods ────────────────────────────────────────────────────────

  /** Get VNC credentials for this computer. */
  async vncCredentials(): Promise<Record<string, unknown>> {
    return unwrapData(
      await this.http.get<unknown>(`/computers/${this.id}/vnc-credentials`),
    );
  }

  /**
   * Return whether the external/raw desktop viewer password is set.
   *
   * Authenticated MIOSA platform users should use the platform desktop entry
   * URL and do not need this password. This is only for raw external viewer
   * links such as `*.computer.miosa.ai/desktop/index.html`.
   */
  async viewerPassword(): Promise<ComputerViewerPasswordStatus> {
    return this.http.get<ComputerViewerPasswordStatus>(
      `/computers/${this.id}/viewer-password`,
    );
  }

  /**
   * Rotate the external/raw desktop viewer password and return the plaintext
   * one time. Store it if you need to share the raw viewer URL.
   */
  async rotateViewerPassword(): Promise<ComputerViewerPasswordRotation> {
    return this.http.post<ComputerViewerPasswordRotation>(
      `/computers/${this.id}/viewer-password/rotate`,
    );
  }

  /** List installed apps inside the VM. */
  async apps(): Promise<Record<string, unknown>> {
    return unwrapData(
      await this.http.get<unknown>(`/computers/${this.id}/apps`),
    );
  }

  /** Get URL map for this computer (VNC, preview, etc.). */
  async urls(): Promise<Record<string, unknown>> {
    return unwrapData(
      await this.http.get<unknown>(`/computers/${this.id}/urls`),
    );
  }

  /** Mint a short-lived stream token for this computer. */
  async streamToken(): Promise<Record<string, unknown>> {
    return unwrapData(
      await this.http.post<unknown>(`/computers/${this.id}/stream-token`),
    );
  }

  /**
   * Mint a passwordless browser embed URL for authenticated platform sessions.
   *
   * Use this inside MIOSA or tenant apps. Raw shared desktop URLs can still use
   * the viewer password flow when opened outside an authenticated platform.
   */
  async embed(): Promise<Record<string, unknown>> {
    return unwrapData(
      await this.http.get<unknown>(`/computers/${this.id}/embed`),
    );
  }

  /** Clone this computer into a new one. */
  async clone(opts: Record<string, unknown> = {}): Promise<Computer> {
    const body = Object.fromEntries(
      Object.entries(opts).filter(([, v]) => v !== undefined),
    );
    const raw = await this.http.post<unknown>(
      `/computers/${this.id}/clone`,
      body,
    );
    const data = unwrapData(raw) as unknown as ComputerData;
    return new Computer(this.http, data);
  }

  /** Resize the computer (change CPU/memory/disk). */
  async resize(size: string): Promise<Computer> {
    const updated = await this.http.post<ComputerData>(
      `/computers/${this.id}/resize`,
      { size },
    );
    this.data = updated;
    return this;
  }

  /** Move the computer to a different region or host. */
  async move(opts: Record<string, unknown>): Promise<Computer> {
    const body = Object.fromEntries(
      Object.entries(opts).filter(([, v]) => v !== undefined),
    );
    const updated = await this.http.post<ComputerData>(
      `/computers/${this.id}/move`,
      body,
    );
    this.data = updated;
    return this;
  }

  /** Capture a region of the desktop as PNG bytes. */
  async screenshotRegion(
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<Uint8Array> {
    return this.http.request<Uint8Array>(
      `/computers/${this.id}/screenshot-region`,
      {
        method: "POST",
        body: { x, y, width, height },
        binary: true,
      },
    );
  }

  /** Get time-series metrics (window: "1h" | "24h" | "7d"). */
  async metrics(window = "1h"): Promise<Record<string, unknown>> {
    return unwrapData(
      await this.http.get<unknown>(`/computers/${this.id}/metrics`, {
        window,
      }),
    );
  }

  // ─── Serialisation ─────────────────────────────────────────────────────────

  toJSON(): ComputerData {
    return this.data;
  }

  toString(): string {
    return `Computer(${this.id}, ${this.status})`;
  }
}

/**
 * A thin filesystem wrapper that prepends a fixed working directory to all
 * path arguments, mirroring the Node.js `fs/promises` surface.
 *
 * Obtain via `computer.fs("/workspace")`.
 */
export class ScopedFs {
  private readonly files: Files;
  private readonly workingDir: string;

  constructor(files: Files, workingDir: string) {
    this.files = files;
    // Normalise: strip trailing slash unless it's the root.
    this.workingDir =
      workingDir !== "/" ? workingDir.replace(/\/$/, "") : workingDir;
  }

  /** Resolve a relative or absolute path against `workingDir`. */
  private resolve(path: string): string {
    if (path.startsWith("/")) return path;
    const joined = `${this.workingDir}/${path}`;
    // Collapse double slashes and simple `.` segments.
    return joined.replace(/\/\.\//g, "/").replace(/\/+/g, "/");
  }

  /** Write a UTF-8 string to a file (relative or absolute path). */
  async writeFile(path: string, content: string): Promise<void> {
    return this.files.writeFile(this.resolve(path), content);
  }

  /** Read a file and return its UTF-8 contents (relative or absolute path). */
  async readFile(path: string): Promise<string> {
    return this.files.readFile(this.resolve(path));
  }

  /** List a directory (relative or absolute path). */
  async readdir(path: string): Promise<import("../types.js").DirEntry[]> {
    return this.files.readdir(this.resolve(path));
  }

  /** Stat a path (relative or absolute). */
  async stat(path: string): Promise<import("../types.js").FileStat> {
    return this.files.stat(this.resolve(path));
  }

  /** Create a directory (relative or absolute). */
  async mkdir(
    path: string,
    options?: import("../types.js").MkdirParams,
  ): Promise<void> {
    return this.files.mkdir(this.resolve(path), options);
  }
}
