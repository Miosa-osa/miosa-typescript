import { HttpClient } from "../http.js";
import type { ExecParams, ExecPythonParams, ExecResult } from "../types.js";

// ── Exec stream types ────────────────────────────────────────────────────────

/** Options for `Exec.stream()`. */
export interface ExecStreamOptions {
  /** Command to execute. */
  command: string;
  /** Optional arguments. */
  args?: string[];
  /** Optional environment variables as KEY=VALUE strings. */
  env?: string[];
  /** Working directory inside the VM. */
  cwd?: string;
  /** Allocate a PTY. Defaults to false. */
  tty?: boolean;
  /** Terminal rows (when tty=true). */
  rows?: number;
  /** Terminal columns (when tty=true). */
  cols?: number;
}

type ExecStreamEventMap = {
  stdout: [data: Uint8Array];
  stderr: [data: Uint8Array];
  exit: [code: number];
  error: [err: Error];
  close: [code: number, reason: string];
};

/**
 * Live bidirectional exec stream backed by a `miosa-exec-v1` WebSocket.
 *
 * The binary wire protocol (1-byte frame ID) is handled by the server-side
 * proxy and envd. The SDK exposes typed events on the received frames:
 *
 * - `stdout` — chunk of stdout bytes
 * - `stderr` — chunk of stderr bytes
 * - `exit`   — process exit code (stream ends after this)
 * - `error`  — WebSocket error
 * - `close`  — WebSocket closed
 *
 * Obtain via `computer.exec.stream({ command: "bash", tty: true })`.
 *
 * ```ts
 * const s = computer.exec.stream({ command: "python3", args: ["script.py"] });
 * s.on("stdout", chunk => process.stdout.write(chunk));
 * s.on("exit",   code  => console.log("exit:", code));
 * s.sendStdin(new TextEncoder().encode("hello\n"));
 * await s.close();
 * ```
 */
export class ExecStreamHandle {
  private ws: WebSocket | import("ws").WebSocket | null = null;
  private closed = false;
  private readonly listeners = new Map<
    keyof ExecStreamEventMap,
    Array<(...args: unknown[]) => void>
  >();

  // Frame IDs — must match the envd binary protocol.
  private static readonly FRAME_STDIN = 0x00;
  private static readonly FRAME_STDOUT = 0x01;
  private static readonly FRAME_STDERR = 0x02;
  private static readonly FRAME_EXIT = 0x03;

  /** @internal — use `Exec.stream()` instead. */
  constructor(ws: WebSocket | import("ws").WebSocket) {
    this.ws = ws;
    this.attachHandlers();
  }

  // ── EventEmitter-style API ──────────────────────────────────────────────────

  on<K extends keyof ExecStreamEventMap>(
    event: K,
    handler: (...args: ExecStreamEventMap[K]) => void,
  ): this {
    const list = this.listeners.get(event) ?? [];
    list.push(handler as (...args: unknown[]) => void);
    this.listeners.set(event, list);
    return this;
  }

  off<K extends keyof ExecStreamEventMap>(
    event: K,
    handler: (...args: ExecStreamEventMap[K]) => void,
  ): this {
    const list = this.listeners.get(event) ?? [];
    const idx = list.indexOf(handler as (...args: unknown[]) => void);
    if (idx !== -1) list.splice(idx, 1);
    return this;
  }

  private emit<K extends keyof ExecStreamEventMap>(
    event: K,
    ...args: ExecStreamEventMap[K]
  ): void {
    for (const fn of this.listeners.get(event) ?? []) {
      fn(...(args as unknown[]));
    }
  }

  // ── Write API ───────────────────────────────────────────────────────────────

  /**
   * Send stdin bytes to the running process.
   * Prepends the 0x00 frame ID byte automatically.
   */
  sendStdin(data: Uint8Array): void {
    if (this.closed || !this.ws) return;
    const frame = new Uint8Array(1 + data.length);
    frame[0] = ExecStreamHandle.FRAME_STDIN;
    frame.set(data, 1);
    (this.ws as WebSocket).send(frame);
  }

  /**
   * Send a terminal resize event.
   * Encodes as 0x05 + rows (u16 BE) + cols (u16 BE).
   */
  sendResize(rows: number, cols: number): void {
    if (this.closed || !this.ws) return;
    const frame = new Uint8Array(5);
    const view = new DataView(frame.buffer);
    frame[0] = 0x05;
    view.setUint16(1, rows, false);
    view.setUint16(3, cols, false);
    (this.ws as WebSocket).send(frame);
  }

  /** Close the stream. Idempotent. */
  async close(): Promise<void> {
    if (this.closed || !this.ws) return;
    this.closed = true;
    (this.ws as WebSocket).close(1000, "client closed");
    this.ws = null;
  }

  /** Whether the stream has ended (by client or server). */
  get isClosed(): boolean {
    return this.closed;
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private attachHandlers() {
    if (!this.ws) return;
    const ws = this.ws;

    ws.onmessage = (ev: MessageEvent) => {
      let bytes: Uint8Array;
      if (ev.data instanceof ArrayBuffer) {
        bytes = new Uint8Array(ev.data);
      } else if (ev.data instanceof Uint8Array) {
        bytes = ev.data;
      } else {
        // Unexpected type (e.g. string on a text frame) — ignore.
        return;
      }
      if (bytes.length === 0) return;

      const frameId = bytes[0];
      const payload = bytes.slice(1);

      switch (frameId) {
        case ExecStreamHandle.FRAME_STDOUT:
          this.emit("stdout", payload);
          break;
        case ExecStreamHandle.FRAME_STDERR:
          this.emit("stderr", payload);
          break;
        case ExecStreamHandle.FRAME_EXIT: {
          const view = new DataView(payload.buffer, payload.byteOffset);
          const code = view.getUint32(0, false);
          this.emit("exit", code);
          break;
        }
        default:
          // Unknown frame IDs — ignore, per protocol spec.
          break;
      }
    };

    ws.onerror = (ev: Event) => {
      const err =
        ev instanceof ErrorEvent ? ev.error : new Error("WebSocket error");
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    };

    ws.onclose = (ev: CloseEvent) => {
      this.closed = true;
      this.emit("close", ev.code, ev.reason);
    };
  }
}

// ── Exec resource ─────────────────────────────────────────────────────────────

/**
 * Exec resource attached to every `Computer` instance.
 * Exposes `bash()`, `python()`, and `stream()` for command execution.
 */
export class Exec {
  private readonly http: HttpClient;
  private readonly computerId: string;

  constructor(http: HttpClient, computerId: string) {
    this.http = http;
    this.computerId = computerId;
  }

  private base(): string {
    return `/computers/${this.computerId}/exec`;
  }

  /**
   * Run a shell command inside the computer.
   * @param command - Shell command string to execute.
   * @param timeout - Optional timeout in seconds.
   */
  async bash(command: string, timeout?: number): Promise<ExecResult> {
    const params: ExecParams = {
      command,
      ...(timeout !== undefined && { timeout }),
    };
    return this.http.post<ExecResult>(this.base(), params);
  }

  /**
   * Execute Python code inside the computer.
   * @param code - Python source code string.
   * @param timeout - Optional timeout in seconds.
   */
  async python(code: string, timeout?: number): Promise<ExecResult> {
    const params: ExecPythonParams = {
      code,
      ...(timeout !== undefined && { timeout }),
    };
    return this.http.post<ExecResult>(`${this.base()}/python`, params);
  }

  /**
   * Open a live binary exec stream using the `miosa-exec-v1` subprotocol.
   *
   * The WebSocket negotiates `Sec-WebSocket-Protocol: miosa-exec-v1` to
   * ensure version compatibility. Future protocol versions can be added
   * server-side without breaking v1 clients.
   *
   * ```ts
   * const stream = computer.exec.stream({ command: "bash", tty: true, rows: 24, cols: 80 });
   * stream.on("stdout", data => process.stdout.write(data));
   * stream.on("exit",   code => console.log("done:", code));
   * stream.sendStdin(new TextEncoder().encode("echo hello\n"));
   * ```
   */
  stream(options: ExecStreamOptions): ExecStreamHandle {
    const wsUrl = this.buildWsUrl(options);
    const ws = createWebSocket(wsUrl, this.http.apiKey, "miosa-exec-v1");
    return new ExecStreamHandle(ws);
  }

  private buildWsUrl(options: ExecStreamOptions): string {
    const wsBase = this.http.baseUrl
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://")
      .replace(/\/$/, "");

    const params = new URLSearchParams();
    params.set("command", options.command);

    if (options.args && options.args.length > 0) {
      for (const arg of options.args) params.append("args", arg);
    }
    if (options.env && options.env.length > 0) {
      for (const e of options.env) params.append("env", e);
    }
    if (options.cwd) params.set("cwd", options.cwd);
    if (options.tty) params.set("tty", "true");
    if (options.rows !== undefined) params.set("rows", String(options.rows));
    if (options.cols !== undefined) params.set("cols", String(options.cols));

    return `${wsBase}/computers/${this.computerId}/exec/stream?${params.toString()}`;
  }
}

// ── WebSocket factory (Node vs browser) ──────────────────────────────────────

/**
 * Creates a WebSocket connection with the given subprotocol.
 *
 * In the browser the `Authorization` header cannot be set directly — the API
 * key is passed via a `bearer.<key>` subprotocol as a fallback; the real
 * protocol is the first entry in the list and is what the server echoes back.
 *
 * In Node.js the `Authorization` header is set directly and only the protocol
 * string is offered.
 */
function createWebSocket(
  url: string,
  apiKey: string,
  protocol: string,
): WebSocket | import("ws").WebSocket {
  if (
    typeof window !== "undefined" &&
    typeof window.WebSocket !== "undefined"
  ) {
    // Browser: protocol first, then the auth fallback.
    return new window.WebSocket(url, [protocol, `bearer.${apiKey}`]);
  }

  // Node.js
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const WS = require("ws") as typeof import("ws").WebSocket;
  return new WS(url, [protocol], {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}
