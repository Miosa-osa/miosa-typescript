/**
 * Models — list available LLMs across providers.
 *
 * Routes: GET /intelligence/models
 * Requires an mki_* intelligence key or JWT.
 */

import type { HttpClient } from "../http.js";

function unwrap(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["data", "models", "items"]) {
      if (Array.isArray(d[k])) return d[k] as unknown[];
    }
  }
  return [];
}

export class Models {
  constructor(private readonly http: HttpClient) {}

  /** List all models available to the calling tenant (OpenAI-compatible shape). */
  async list(
    filters: Record<string, string | number | boolean | undefined> = {},
  ): Promise<Record<string, unknown>[]> {
    const query = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined),
    ) as Record<string, string | number | boolean | undefined>;
    const data = await this.http.get<unknown>("/intelligence/models", query);
    return unwrap(data) as Record<string, unknown>[];
  }

  /**
   * Get a single model by id.
   *
   * The platform router does not expose a per-model GET; this filters
   * the list payload client-side.
   */
  async get(modelId: string): Promise<Record<string, unknown>> {
    const all = await this.list();
    return all.find((m) => (m as Record<string, unknown>).id === modelId) ?? {};
  }
}
