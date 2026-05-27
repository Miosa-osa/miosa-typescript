/**
 * BuilderSessions — durable, cross-device Builder UI state.
 *
 * Routes: /builder/sessions/*
 * Accepts msk_* API keys or JWT.
 * Sessions are optimal_sessions with resource_type="sandbox".
 */

import type { HttpClient } from "../http.js";

function unwrap(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["data", "sessions", "items"]) {
      if (k in d) return d[k] as Record<string, unknown>;
    }
  }
  return data as Record<string, unknown>;
}

function unwrapList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["data", "sessions", "items"]) {
      if (Array.isArray(d[k])) return d[k] as Record<string, unknown>[];
    }
  }
  return [];
}

export interface BuilderSessionListParams {
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}

export class BuilderSessions {
  constructor(private readonly http: HttpClient) {}

  async list(
    params: BuilderSessionListParams = {},
  ): Promise<Record<string, unknown>[]> {
    const query = { limit: 50, ...params } as Record<
      string,
      string | number | boolean | undefined
    >;
    return unwrapList(await this.http.get<unknown>("/builder/sessions", query));
  }

  /**
   * Get a single session. The platform router only exposes index +
   * title-update + delete, so this filters list() client-side.
   */
  async get(sessionId: string): Promise<Record<string, unknown>> {
    const all = await this.list();
    return (
      all.find((s) => (s as Record<string, unknown>).id === sessionId) ?? {}
    );
  }

  async updateTitle(
    sessionId: string,
    title: string,
  ): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.patch<unknown>(`/builder/sessions/${sessionId}/title`, {
        title,
      }),
    );
  }

  async delete(sessionId: string): Promise<void> {
    await this.http.delete(`/builder/sessions/${sessionId}`);
  }
}
