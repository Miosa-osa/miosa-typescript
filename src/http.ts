import { MiosaError, NetworkError, TimeoutError } from "./errors.js";
import type { MiosaErrorBody } from "./errors.js";

// ─── Transport tuning ─────────────────────────────────────────────────────────
//
// Node's built-in ``fetch`` is backed by undici and already reuses connections
// via HTTP/1.1 keep-alive. We additionally try to install a custom undici
// ``Agent`` with HTTP/2 enabled so sequential calls can multiplex on a single
// TLS session and skip the per-call handshake tax (~80-150 ms cold,
// ~20-40 ms warm).
//
// undici is an optional dependency: when not installed, we fall back to the
// default fetch dispatcher (still pooled, just HTTP/1.1).

interface UndiciAgentOptions {
  keepAliveTimeout?: number;
  keepAliveMaxTimeout?: number;
  allowH2?: boolean;
  connections?: number;
}

interface UndiciModule {
  Agent: new (opts: UndiciAgentOptions) => unknown;
  setGlobalDispatcher: (dispatcher: unknown) => void;
}

let _h2Configured = false;
let _h2Available = false;
let _agentSingleton: unknown = null;

async function ensureHttp2Agent(): Promise<void> {
  if (_h2Configured) return;
  _h2Configured = true;
  try {
    // Indirection through a variable specifier prevents TypeScript from
    // trying to resolve the optional ``undici`` module at compile time.
    const undiciSpecifier = "undici";
    const undici = (await import(
      /* @vite-ignore */ undiciSpecifier
    )) as unknown as UndiciModule;
    const agent = new undici.Agent({
      keepAliveTimeout: 60_000,
      keepAliveMaxTimeout: 600_000,
      allowH2: true,
      connections: 20,
    });
    undici.setGlobalDispatcher(agent);
    _agentSingleton = agent;
    _h2Available = true;
  } catch {
    // undici not installed (e.g. browser bundle, or user opted out).
    // Fall back to native fetch's default keep-alive pool.
    _h2Available = false;
  }
}

// Fire-and-forget at module load. Subsequent fetch() calls will pick up the
// configured dispatcher. Tests can re-import and observe ``isHttp2Configured``.
const _h2Bootstrap = ensureHttp2Agent();

/** Exposed for tests — resolves after the HTTP/2 agent setup completes. */
export function whenTransportReady(): Promise<void> {
  return _h2Bootstrap;
}

/** Exposed for tests — true iff undici with allowH2 was installed. */
export function isHttp2Available(): boolean {
  return _h2Available;
}

/** Exposed for tests — the cached undici Agent (or null). */
export function getDispatcher(): unknown {
  return _agentSingleton;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  /** Return raw Response instead of parsing JSON */
  rawResponse?: boolean;
  /** Send body as multipart/form-data */
  formData?: FormData;
  /** Expected response is binary */
  binary?: boolean;
}

export interface HttpClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  maxRetries: number;
}

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(attempt: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader !== null) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds)) return seconds * 1000;
  }
  return BASE_DELAY_MS * 2 ** attempt + Math.random() * 100;
}

export class HttpClient {
  /** Public for WebSocket clients that need to derive their own URL. */
  readonly baseUrl: string;
  /** Public for WebSocket clients that need to send the same auth. */
  readonly apiKey: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private baseHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
      "User-Agent": "@miosa/sdk/1.0.0",
      ...extra,
    };
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const {
      method = "GET",
      body,
      formData,
      binary = false,
      timeout = this.timeout,
    } = options;

    let headers = this.baseHeaders(options.headers);

    let fetchBody: BodyInit | undefined;
    if (formData) {
      fetchBody = formData;
      // Let fetch set Content-Type with boundary for multipart
    } else if (body !== undefined) {
      headers = { ...headers, "Content-Type": "application/json" };
      fetchBody = JSON.stringify(body);
    }

    let lastError: MiosaError | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(this.buildUrl(path), {
          method,
          headers,
          // exactOptionalPropertyTypes requires null, not undefined, for body
          body: fetchBody ?? null,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const requestId = response.headers.get("x-request-id") ?? undefined;
          const retryAfter = response.headers.get("retry-after");

          let errorBody: MiosaErrorBody = {};
          try {
            errorBody = (await response.json()) as MiosaErrorBody;
          } catch {
            // body may not be JSON on 5xx errors
          }

          const error = MiosaError.fromResponse(
            response.status,
            errorBody,
            requestId,
          );

          if (RETRY_STATUS.has(response.status) && attempt < this.maxRetries) {
            lastError = error;
            await sleep(retryDelay(attempt, retryAfter));
            continue;
          }

          throw error;
        }

        if (binary) {
          const buffer = await response.arrayBuffer();
          return new Uint8Array(buffer) as unknown as T;
        }

        // 204 No Content
        if (response.status === 204) {
          return undefined as unknown as T;
        }

        return (await response.json()) as T;
      } catch (err) {
        clearTimeout(timer);

        if (err instanceof MiosaError) {
          throw err;
        }

        if (err instanceof DOMException && err.name === "AbortError") {
          throw new TimeoutError(
            `Request to ${path} timed out after ${timeout}ms`,
          );
        }

        if (err instanceof TypeError) {
          const networkErr = new NetworkError(
            `Network error reaching ${path}: ${err.message}`,
            err,
          );
          if (attempt < this.maxRetries) {
            lastError = networkErr;
            await sleep(retryDelay(attempt, null));
            continue;
          }
          throw networkErr;
        }

        throw err;
      }
    }

    // Exhausted retries
    throw (
      lastError ??
      new MiosaError("Max retries exceeded", 0, "MAX_RETRIES_EXCEEDED")
    );
  }

  async get<T>(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    let fullPath = path;
    if (query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) params.set(k, String(v));
      }
      const qs = params.toString();
      if (qs) fullPath = `${path}${path.includes("?") ? "&" : "?"}${qs}`;
    }
    return this.request<T>(fullPath, { method: "GET" });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: "PATCH", body });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: "PUT", body });
  }

  async delete<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: "DELETE", body });
  }

  async getBinary(path: string): Promise<Uint8Array> {
    return this.request<Uint8Array>(path, { method: "GET", binary: true });
  }

  async postFormData<T>(path: string, formData: FormData): Promise<T> {
    return this.request<T>(path, { method: "POST", formData });
  }

  /**
   * Open a Server-Sent Events stream. Returns an AsyncIterableIterator of
   * parsed event data objects. The caller is responsible for breaking the loop.
   */
  async *stream<T>(
    path: string,
    options: RequestOptions = {},
  ): AsyncIterableIterator<T> {
    const method = options.method ?? "GET";
    let headers = this.baseHeaders({
      Accept: "text/event-stream",
      ...options.headers,
    });
    let body: BodyInit | null = null;
    if (options.body !== undefined) {
      headers = { ...headers, "Content-Type": "application/json" };
      body = JSON.stringify(options.body);
    }

    const controller = new AbortController();

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof TypeError) {
        throw new NetworkError(
          `Network error opening SSE stream: ${err.message}`,
          err,
        );
      }
      throw err;
    }

    if (!response.ok) {
      let errorBody: MiosaErrorBody = {};
      try {
        errorBody = (await response.json()) as MiosaErrorBody;
      } catch {
        // ignore
      }
      throw MiosaError.fromResponse(
        response.status,
        errorBody,
        response.headers.get("x-request-id") ?? undefined,
      );
    }

    if (!response.body) {
      throw new MiosaError("SSE stream has no body", 0, "NO_STREAM_BODY");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            const raw = line.slice(5).trim();
            if (raw === "[DONE]" || raw === "") continue;
            try {
              yield JSON.parse(raw) as T;
            } catch {
              // skip malformed SSE data lines
            }
          }
        }
      }
    } finally {
      controller.abort();
      reader.releaseLock();
    }
  }
}
