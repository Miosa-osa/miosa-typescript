import EventEmitter from "node:events";

// ── Types ────────────────────────────────────────────────────────────────────

/** Producer names that can be subscribed to. */
export type EventProducer =
  | "window"
  | "clipboard"
  | "file"
  | "process"
  | "idle";

/** Options for `Events.subscribe()`. */
export interface EventSubscribeOptions {
  /** At least one producer is required. */
  subscribe: EventProducer[];
  /** Paths to watch for the `file` producer. Defaults to `["/home/user"]`. */
  paths?: string[];
  /** Idle threshold in seconds for the `idle` producer. Defaults to 30. */
  idleThresholdSec?: number;
}

// ── Emitted event payload types (indexed by event type string) ────────────────

export interface WindowFocusChangedPayload {
  window_id: string;
  pid: string;
  title: string;
}

export interface WindowOpenedPayload {
  window_id: string;
  pid: string;
  title: string;
}

export interface WindowClosedPayload {
  window_id: string;
  pid: string;
  title: string;
}

export interface ClipboardChangedPayload {
  size_bytes: number;
}

export interface FileCreatedPayload {
  path: string;
}

export interface FileModifiedPayload {
  path: string;
}

export interface FileDeletedPayload {
  path: string;
}

export interface ProcessStartedPayload {
  pid: number;
  cmd: string;
  ppid: string;
}

export interface ProcessStoppedPayload {
  pid: number;
  cmd: string;
}

export interface IdleInactivePayload {
  idle_ms: number;
}

export interface IdleActivePayload {
  idle_ms: number;
}

export interface ProducerUnavailablePayload {
  producer: EventProducer;
  reason: string;
}

/** Union of all typed event envelopes. */
export type ComputerEvent =
  | {
      type: "window.focus_changed";
      timestamp: string;
      payload: WindowFocusChangedPayload;
    }
  | { type: "window.opened"; timestamp: string; payload: WindowOpenedPayload }
  | { type: "window.closed"; timestamp: string; payload: WindowClosedPayload }
  | {
      type: "clipboard.changed";
      timestamp: string;
      payload: ClipboardChangedPayload;
    }
  | { type: "file.created"; timestamp: string; payload: FileCreatedPayload }
  | { type: "file.modified"; timestamp: string; payload: FileModifiedPayload }
  | { type: "file.deleted"; timestamp: string; payload: FileDeletedPayload }
  | {
      type: "process.started";
      timestamp: string;
      payload: ProcessStartedPayload;
    }
  | {
      type: "process.stopped";
      timestamp: string;
      payload: ProcessStoppedPayload;
    }
  | { type: "idle.inactive"; timestamp: string; payload: IdleInactivePayload }
  | { type: "idle.active"; timestamp: string; payload: IdleActivePayload }
  | {
      type: "producer.unavailable";
      timestamp: string;
      payload: ProducerUnavailablePayload;
    };

// ── EventStream ───────────────────────────────────────────────────────────────

type EventMap = {
  [K in ComputerEvent["type"]]: [
    Extract<ComputerEvent, { type: K }>["payload"],
  ];
} & {
  error: [Error];
  close: [{ code: number; reason: string }];
};

/**
 * Typed event stream returned by `computer.events.subscribe()`.
 *
 * ```ts
 * const stream = computer.events.subscribe({ subscribe: ["file", "process"] });
 * stream.on("file.created", e => console.log("created:", e.path));
 * stream.on("process.started", e => console.log("pid:", e.pid));
 * stream.on("error", err => console.error(err));
 * await stream.close();
 * ```
 */
export class EventStream extends EventEmitter<EventMap> {
  private ws: WebSocket | import("ws").WebSocket | null = null;
  private closed = false;

  /** @internal — use `Events.subscribe()` instead. */
  constructor(ws: WebSocket | import("ws").WebSocket) {
    super();
    this.ws = ws;
    this.attachHandlers();
  }

  private attachHandlers() {
    if (!this.ws) return;
    const ws = this.ws;

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const raw = typeof ev.data === "string" ? ev.data : String(ev.data);
        const event = JSON.parse(raw) as ComputerEvent;
        // EventEmitter.emit requires (event, ...args) — payload as first arg.
        this.emit(event.type as keyof EventMap, event.payload as never);
      } catch {
        // Ignore malformed frames.
      }
    };

    ws.onerror = (ev: Event) => {
      const err =
        ev instanceof ErrorEvent ? ev.error : new Error("WebSocket error");
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    };

    ws.onclose = (ev: CloseEvent) => {
      this.closed = true;
      this.emit("close", { code: ev.code, reason: ev.reason });
    };
  }

  /** Close the event stream. Idempotent. */
  async close(): Promise<void> {
    if (this.closed || !this.ws) return;
    this.closed = true;
    this.ws.close(1000, "client closed");
    this.ws = null;
  }

  /** Whether the stream has been closed (by client or server). */
  get isClosed(): boolean {
    return this.closed;
  }
}

// ── Events resource ───────────────────────────────────────────────────────────

/**
 * Events resource attached to every `Computer` instance.
 * Exposes `subscribe()` for real-time in-VM event streaming.
 */
export class Events {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly computerId: string;

  constructor(baseUrl: string, apiKey: string, computerId: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.computerId = computerId;
  }

  /**
   * Open a WebSocket subscription for the specified producers.
   *
   * ```ts
   * const stream = computer.events.subscribe({
   *   subscribe: ["window", "clipboard", "file"],
   *   paths: ["/home/user", "/workspace"],
   * });
   * stream.on("window.focus_changed", e => ...);
   * stream.on("file.created", e => ...);
   * stream.on("error", err => ...);
   * await stream.close();
   * ```
   */
  subscribe(options: EventSubscribeOptions): EventStream {
    const wsUrl = this.buildWsUrl(options);
    const ws = createWebSocket(wsUrl, this.apiKey);
    return new EventStream(ws);
  }

  private buildWsUrl(options: EventSubscribeOptions): string {
    // Convert the HTTP base URL to a WS URL.
    // baseUrl is something like "https://api.miosa.ai/api/v1"
    const wsBase = this.baseUrl
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://")
      .replace(/\/$/, "");

    const params = new URLSearchParams();
    params.set("subscribe", options.subscribe.join(","));

    if (options.paths && options.paths.length > 0) {
      params.set("paths", options.paths.join(","));
    }
    if (options.idleThresholdSec !== undefined) {
      params.set("idle_threshold_sec", String(options.idleThresholdSec));
    }

    return `${wsBase}/computers/${this.computerId}/events?${params.toString()}`;
  }
}

// ── WebSocket factory (Node vs browser) ──────────────────────────────────────

/**
 * Creates a WebSocket connection. Uses the native browser `WebSocket` when
 * running in a browser context, or the `ws` npm package in Node.js.
 *
 * The `Authorization: Bearer <key>` header is attached via a subprotocol
 * trick in the browser (WS spec doesn't allow custom headers) — the server
 * accepts the key in the `Sec-WebSocket-Protocol` header as a fallback.
 * In Node.js the `Authorization` header is set directly.
 */
/**
 * Creates a WebSocket connection with `Sec-WebSocket-Protocol: miosa-events-v1`.
 *
 * The subprotocol must be negotiated for the server to accept the connection.
 * Future protocol versions (miosa-events-v2, etc.) can be added server-side
 * without breaking v1 clients.
 *
 * In the browser the `Authorization` header cannot be set directly — the API
 * key is passed as a secondary subprotocol entry (`bearer.<key>`). The server
 * echoes only `miosa-events-v1` back.
 *
 * In Node.js the `Authorization` header is set directly.
 */
function createWebSocket(
  url: string,
  apiKey: string,
): WebSocket | import("ws").WebSocket {
  const protocol = "miosa-events-v1";

  if (
    typeof window !== "undefined" &&
    typeof window.WebSocket !== "undefined"
  ) {
    // Browser: real protocol first, then auth fallback subprotocol.
    return new window.WebSocket(url, [protocol, `bearer.${apiKey}`]);
  }

  // Node.js: use the `ws` package with a proper Authorization header.
  // Dynamic require so bundlers targeting browsers don't break.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const WS = require("ws") as typeof import("ws").WebSocket;
  return new WS(url, [protocol], {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}
