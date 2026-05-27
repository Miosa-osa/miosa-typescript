/**
 * ComputerPorts — per-port visibility control.
 *
 * Routes:
 *   GET    /computers/:id/ports        — list
 *   POST   /computers/:id/ports        — create
 *   PATCH  /computers/:id/ports/:port  — update
 *   DELETE /computers/:id/ports/:port  — delete
 *
 * The backend does not expose a single-port GET; get() filters the list
 * response client-side for ergonomics.
 */

import type { HttpClient } from "../http.js";

function unwrap(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if ("data" in d && Object.keys(d).length <= 2) {
      return d.data as Record<string, unknown>;
    }
  }
  return (data ?? {}) as Record<string, unknown>;
}

function unwrapList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["data", "ports", "items"]) {
      if (Array.isArray(d[k])) return d[k] as Record<string, unknown>[];
    }
  }
  return [];
}

export class ComputerPorts {
  constructor(
    private readonly http: HttpClient,
    private readonly computerId: string,
  ) {}

  private base(): string {
    return `/computers/${this.computerId}/ports`;
  }

  async list(): Promise<Record<string, unknown>[]> {
    return unwrapList(await this.http.get<unknown>(this.base()));
  }

  /** Return the port record for port, or null if not exposed. */
  async get(port: number): Promise<Record<string, unknown> | null> {
    const all = await this.list();
    return (
      all.find((r) => Number((r as Record<string, unknown>).port) === port) ??
      null
    );
  }

  /** Expose port with the given visibility options. */
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
    return unwrap(await this.http.post<unknown>(this.base(), body));
  }

  /** Patch visibility / auth options for port. */
  async update(
    port: number,
    opts: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const body = Object.fromEntries(
      Object.entries(opts).filter(([, v]) => v !== undefined),
    );
    return unwrap(
      await this.http.patch<unknown>(`${this.base()}/${port}`, body),
    );
  }

  /** Stop exposing port. */
  async delete(port: number): Promise<void> {
    await this.http.delete(`${this.base()}/${port}`);
  }
}
