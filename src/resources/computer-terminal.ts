/**
 * ComputerTerminal — PTY session management for a Computer.
 *
 * Routes:
 *   POST /computers/:id/terminal
 *   POST /computers/:id/pty/:sessionId/resize
 */

import type { HttpClient } from "../http.js";

export interface TerminalCreateParams {
  cols?: number;
  rows?: number;
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
}

export class ComputerTerminal {
  constructor(
    private readonly http: HttpClient,
    private readonly computerId: string,
  ) {}

  /** Open a new PTY session. Returns the server payload (session id, etc.). */
  async create(
    params: TerminalCreateParams = {},
  ): Promise<Record<string, unknown>> {
    const body = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined),
    );
    const raw = await this.http.post<unknown>(
      `/computers/${this.computerId}/terminal`,
      body,
    );
    return unwrap(raw);
  }

  /** Resize an existing PTY session. */
  async resize(
    sessionId: string,
    cols: number,
    rows: number,
  ): Promise<Record<string, unknown>> {
    const raw = await this.http.post<unknown>(
      `/computers/${this.computerId}/pty/${sessionId}/resize`,
      { cols, rows },
    );
    return unwrap(raw);
  }
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
