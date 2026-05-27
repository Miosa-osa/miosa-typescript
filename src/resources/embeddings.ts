/**
 * Embeddings — OpenAI-compatible embedding vectors.
 *
 * Route: POST /intelligence/embeddings
 * Requires an mki_* intelligence key.
 */

import type { HttpClient } from "../http.js";

export interface EmbeddingCreateParams {
  input: string | string[];
  model: string;
  [key: string]: unknown;
}

export class Embeddings {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create one or more embedding vectors.
   *
   * Returns the full OpenAI-compatible envelope
   * `{ object: "list", data: [...], model, usage }`.
   */
  async create(
    params: EmbeddingCreateParams,
  ): Promise<Record<string, unknown>> {
    const body = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined),
    );
    return this.http.post<Record<string, unknown>>(
      "/intelligence/embeddings",
      body,
    );
  }
}
