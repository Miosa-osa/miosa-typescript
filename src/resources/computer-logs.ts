/**
 * ComputerLogs — read + stream VM logs.
 *
 * Routes:
 *   GET /computers/:id/logs         — JSON snapshot (last N lines)
 *   GET /computers/:id/logs/stream  — text/event-stream of new lines (SSE)
 */

import type { HttpClient } from "../http.js";

export interface ComputerLogsGetParams {
  lines?: number;
  since?: string;
}

function unwrap(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if ("data" in d && Object.keys(d).length <= 2) {
      return d.data as Record<string, unknown>;
    }
  }
  return (data ?? {}) as Record<string, unknown>;
}

export class ComputerLogs {
  constructor(
    private readonly http: HttpClient,
    private readonly computerId: string,
  ) {}

  /** Fetch the most recent log snapshot. */
  async get(
    params: ComputerLogsGetParams = {},
  ): Promise<Record<string, unknown>> {
    const query = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined),
    ) as Record<string, string | number | boolean | undefined>;
    return unwrap(
      await this.http.get<unknown>(`/computers/${this.computerId}/logs`, query),
    );
  }

  /** Stream live log events as SSE dicts `{type, data, id}`. */
  stream(): AsyncIterableIterator<Record<string, unknown>> {
    return this.http.stream<Record<string, unknown>>(
      `/computers/${this.computerId}/logs/stream`,
    );
  }
}
