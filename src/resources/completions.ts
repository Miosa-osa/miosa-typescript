/**
 * Completions — OpenAI-compatible chat / text completion endpoints.
 *
 * Routes: POST /intelligence/completions, POST /intelligence/chat/completions
 * Requires an mki_* intelligence key. Supports stream=true via SSE.
 */

import type { HttpClient } from "../http.js";

interface CompletionBase {
  model: string;
  prompt?: string | string[];
  [key: string]: unknown;
}

export interface CompletionCreateParams extends CompletionBase {
  stream?: false;
}

export interface CompletionCreateStreamParams extends CompletionBase {
  stream: true;
}

interface ChatBase {
  model: string;
  messages: Record<string, unknown>[];
  [key: string]: unknown;
}

export interface ChatCompletionCreateParams extends ChatBase {
  stream?: false;
}

export interface ChatCompletionCreateStreamParams extends ChatBase {
  stream: true;
}

function unwrap(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    // Preserve OpenAI envelope (choices array present)
    if (Array.isArray(d.choices)) return d;
    if ("data" in d) return d.data as Record<string, unknown>;
  }
  return data as Record<string, unknown>;
}

function buildBody(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined),
  );
}

export class Completions {
  constructor(private readonly http: HttpClient) {}

  /** Create a text completion (POST /intelligence/completions). */
  async create(
    params: CompletionCreateParams,
  ): Promise<Record<string, unknown>>;
  create(
    params: CompletionCreateStreamParams,
  ): AsyncIterableIterator<Record<string, unknown>>;
  create(
    params: CompletionCreateParams | CompletionCreateStreamParams,
  ):
    | Promise<Record<string, unknown>>
    | AsyncIterableIterator<Record<string, unknown>> {
    const body = buildBody(params);
    if (params.stream === true) {
      return this.http.stream<Record<string, unknown>>(
        "/intelligence/completions",
        { method: "POST", body },
      );
    }
    return this.http
      .post<unknown>("/intelligence/completions", body)
      .then(unwrap);
  }

  /** Create a chat completion (POST /intelligence/chat/completions). */
  async chat(
    params: ChatCompletionCreateParams,
  ): Promise<Record<string, unknown>>;
  chat(
    params: ChatCompletionCreateStreamParams,
  ): AsyncIterableIterator<Record<string, unknown>>;
  chat(
    params: ChatCompletionCreateParams | ChatCompletionCreateStreamParams,
  ):
    | Promise<Record<string, unknown>>
    | AsyncIterableIterator<Record<string, unknown>> {
    const body = buildBody(params);
    if (params.stream === true) {
      return this.http.stream<Record<string, unknown>>(
        "/intelligence/chat/completions",
        { method: "POST", body },
      );
    }
    return this.http
      .post<unknown>("/intelligence/chat/completions", body)
      .then(unwrap);
  }
}
