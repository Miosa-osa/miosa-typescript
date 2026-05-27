/**
 * Mcp — Model Context Protocol streamable-HTTP transport.
 *
 * Clients (Claude Code, Cursor, Gemini CLI, Copilot) point at /api/v1/mcp
 * with a msk_* Bearer token and discover the MIOSA tool-belt.
 */

import type { HttpClient } from "../http.js";

// ── Request payloads ─────────────────────────────────────────────────────────

export interface McpDispatchParams {
  method?: string;
  params?: Record<string, unknown>;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["data", "mcp", "result", "items"]) {
      if (k in p) return p[k] as T;
    }
  }
  return payload as T;
}

function stripUndefined(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  );
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class Mcp {
  constructor(private readonly http: HttpClient) {}

  /** Send a JSON-RPC request to the MCP endpoint. */
  async dispatch(
    params: McpDispatchParams = {},
  ): Promise<Record<string, unknown>> {
    const body = stripUndefined(params as Record<string, unknown>);
    const data = await this.http.post<unknown>(
      "/mcp",
      Object.keys(body).length > 0 ? body : undefined,
    );
    return unwrap<Record<string, unknown>>(data);
  }

  /**
   * Open the MCP listen channel (GET).
   *
   * Returns whatever the server returns. For true SSE streaming, use
   * `http.stream("/mcp")` directly.
   */
  async listen(): Promise<unknown> {
    const data = await this.http.get<unknown>("/mcp");
    return unwrap(data);
  }

  /** Close (terminate) the MCP session. */
  async close(): Promise<void> {
    await this.http.delete<unknown>("/mcp");
  }
}
