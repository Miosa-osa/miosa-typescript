/**
 * SandboxShares — public read-only share URLs for a sandbox.
 * Corresponds to: POST/GET/DELETE /api/v1/sandboxes/{id}/shares
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface SandboxShareData {
  share_id: string;
  share_url: string;
  expires_at?: string | null;
  scope: string;
  [key: string]: unknown;
}

export interface SandboxShareCreateParams {
  expires_in?: number;
  scope?: "read";
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
  for (const k of ["data", "shares", "items"]) {
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

export class SandboxShares {
  constructor(
    private readonly http: HttpClient,
    private readonly sandboxId: string,
  ) {}

  private base(): string {
    return `/sandboxes/${this.sandboxId}/shares`;
  }

  /** POST /api/v1/sandboxes/{id}/shares — create a public share URL. */
  async create(
    params: SandboxShareCreateParams = {},
  ): Promise<SandboxShareData> {
    const body = stripUndefined({
      expires_in: params.expires_in,
      scope: params.scope ?? "read",
    });
    return unwrap(await this.http.post<unknown>(this.base(), body));
  }

  /** GET /api/v1/sandboxes/{id}/shares — list all active shares. */
  async list(): Promise<SandboxShareData[]> {
    const data = await this.http.get<unknown>(this.base());
    return listItems<SandboxShareData>(data);
  }

  /** DELETE /api/v1/sandboxes/{id}/shares/{share_id} — revoke a share. */
  async revoke(shareId: string): Promise<void> {
    await this.http.delete<unknown>(`${this.base()}/${shareId}`);
  }
}
