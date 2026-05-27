/**
 * ComputerEnv — encrypted env var CRUD scoped to one Computer.
 *
 * Routes:
 *   GET    /computers/:id/env           → list
 *   POST   /computers/:id/env           → create (single)
 *   PATCH  /computers/:id/env/:name     → update value
 *   DELETE /computers/:id/env/:name     → remove
 *
 * bulkSet falls back to N individual POSTs (no bulk endpoint yet).
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
    for (const k of ["data", "env", "items"]) {
      if (Array.isArray(d[k])) return d[k] as Record<string, unknown>[];
    }
  }
  return [];
}

export class ComputerEnv {
  constructor(
    private readonly http: HttpClient,
    private readonly computerId: string,
  ) {}

  private base(): string {
    return `/computers/${this.computerId}/env`;
  }

  /** List all env vars (values may be masked depending on server policy). */
  async list(): Promise<Record<string, unknown>[]> {
    return unwrapList(await this.http.get<unknown>(this.base()));
  }

  /** Create a new env var. Use update() to change an existing one. */
  async set(name: string, value: string): Promise<Record<string, unknown>> {
    return unwrap(await this.http.post<unknown>(this.base(), { name, value }));
  }

  /** Patch the value of an existing env var by name. */
  async update(name: string, value: string): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.patch<unknown>(`${this.base()}/${name}`, { value }),
    );
  }

  /** Remove an env var by name. */
  async delete(name: string): Promise<void> {
    await this.http.delete(`${this.base()}/${name}`);
  }

  /** Convenience: create one env var per entry. */
  async bulkSet(
    env: Record<string, string>,
  ): Promise<Record<string, unknown>[]> {
    return Promise.all(
      Object.entries(env).map(([name, value]) => this.set(name, value)),
    );
  }
}
