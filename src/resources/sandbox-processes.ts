/**
 * SandboxProcesses — long-running process management inside a sandbox.
 * Corresponds to: POST/GET/DELETE /api/v1/sandboxes/{id}/processes
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface SandboxProcessData {
  pid: number;
  name?: string;
  command: string;
  status: "running" | "stopped" | "failed" | string;
  started_at?: string;
  exit_code?: number | null;
  [key: string]: unknown;
}

export interface SandboxProcessStartParams {
  command: string;
  env?: Record<string, string>;
  name?: string;
}

export interface SandboxProcessStreamEvent {
  stream: "stdout" | "stderr";
  line: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in (payload as object)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function listItems<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  for (const k of ["data", "processes", "items"]) {
    if (Array.isArray(p[k])) return p[k] as T[];
  }
  return [];
}

function stripUndefined(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  );
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class SandboxProcesses {
  constructor(
    private readonly http: HttpClient,
    private readonly sandboxId: string,
  ) {}

  private base(): string {
    return `/sandboxes/${this.sandboxId}/processes`;
  }

  /** POST /api/v1/sandboxes/{id}/processes — start a long-running process. */
  async start(params: SandboxProcessStartParams): Promise<SandboxProcessData> {
    const body = stripUndefined({
      command: params.command,
      env: params.env,
      name: params.name,
    });
    return unwrap(await this.http.post<unknown>(this.base(), body));
  }

  /** GET /api/v1/sandboxes/{id}/processes — list all processes. */
  async list(): Promise<SandboxProcessData[]> {
    const data = await this.http.get<unknown>(this.base());
    return listItems<SandboxProcessData>(data);
  }

  /** GET /api/v1/sandboxes/{id}/processes/{pid} — get a single process. */
  async get(pid: number): Promise<SandboxProcessData> {
    return unwrap(await this.http.get<unknown>(`${this.base()}/${pid}`));
  }

  /** DELETE /api/v1/sandboxes/{id}/processes/{pid} — SIGTERM then SIGKILL after 5s. */
  async stop(pid: number): Promise<void> {
    await this.http.delete<unknown>(`${this.base()}/${pid}`);
  }

  /** GET /api/v1/sandboxes/{id}/processes/{pid}/logs?tail=N — tail log text. */
  async logs(pid: number, tail = 200): Promise<string> {
    const data = await this.http.get<unknown>(`${this.base()}/${pid}/logs`, {
      tail,
    });
    if (typeof data === "string") return data;
    const d = data as Record<string, unknown>;
    return String(d.logs ?? d.output ?? d.data ?? "");
  }

  /** GET /api/v1/sandboxes/{id}/processes/{pid}/stream (SSE) — live output. */
  stream(pid: number): AsyncIterableIterator<SandboxProcessStreamEvent> {
    return this.http.stream<SandboxProcessStreamEvent>(
      `${this.base()}/${pid}/stream`,
    );
  }
}
