/**
 * Community — public template + agent catalog with install + rate.
 *
 * Routes: /community/*
 * Requires JWT.
 */

import type { HttpClient } from "../http.js";

function unwrap(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["data", "templates", "agents", "items"]) {
      if (k in d) return d[k] as Record<string, unknown>;
    }
  }
  return data as Record<string, unknown>;
}

function unwrapList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["data", "templates", "agents", "items"]) {
      if (Array.isArray(d[k])) return d[k] as Record<string, unknown>[];
    }
  }
  return [];
}

export class Community {
  constructor(private readonly http: HttpClient) {}

  // ── Agents ────────────────────────────────────────────────────────────

  async listAgents(
    filters: Record<string, string | number | boolean | undefined> = {},
  ): Promise<Record<string, unknown>[]> {
    const query = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined),
    ) as Record<string, string | number | boolean | undefined>;
    return unwrapList(await this.http.get<unknown>("/community/agents", query));
  }

  async getAgent(agentId: string): Promise<Record<string, unknown>> {
    return unwrap(await this.http.get<unknown>(`/community/agents/${agentId}`));
  }

  // ── Templates ─────────────────────────────────────────────────────────

  async listTemplates(
    filters: Record<string, string | number | boolean | undefined> = {},
  ): Promise<Record<string, unknown>[]> {
    const query = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined),
    ) as Record<string, string | number | boolean | undefined>;
    return unwrapList(
      await this.http.get<unknown>("/community/templates", query),
    );
  }

  async getTemplate(templateId: string): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.get<unknown>(`/community/templates/${templateId}`),
    );
  }

  /** Install a community template into the caller's tenant. */
  async installTemplate(
    templateId: string,
    opts: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const body = Object.fromEntries(
      Object.entries(opts).filter(([, v]) => v !== undefined),
    );
    return unwrap(
      await this.http.post<unknown>(
        `/community/templates/${templateId}/install`,
        body,
      ),
    );
  }

  /** Rate a community template (1–5). */
  async rateTemplate(
    templateId: string,
    rating: number,
    opts: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const body = {
      rating,
      ...Object.fromEntries(
        Object.entries(opts).filter(([, v]) => v !== undefined),
      ),
    };
    return unwrap(
      await this.http.post<unknown>(
        `/community/templates/${templateId}/rate`,
        body,
      ),
    );
  }
}
