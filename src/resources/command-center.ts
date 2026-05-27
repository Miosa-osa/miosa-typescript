/**
 * CommandCenter — agent fleet, orchestrations, metrics.
 *
 * Routes: /command-center/*
 * Requires JWT or msk_u_* API key.
 */

import type { HttpClient } from "../http.js";

function unwrap(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of [
      "data",
      "agents",
      "running",
      "metrics",
      "presets",
      "tiers",
      "items",
    ]) {
      if (k in d) return d[k] as Record<string, unknown>;
    }
  }
  return data as Record<string, unknown>;
}

function unwrapList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["data", "agents", "running", "presets", "items"]) {
      if (Array.isArray(d[k])) return d[k] as Record<string, unknown>[];
    }
  }
  return [];
}

export class CommandCenter {
  constructor(private readonly http: HttpClient) {}

  /** Top-level snapshot (GET /command-center). */
  async overview(): Promise<Record<string, unknown>> {
    return unwrap(await this.http.get<unknown>("/command-center"));
  }

  async agents(): Promise<Record<string, unknown>[]> {
    return unwrapList(await this.http.get<unknown>("/command-center/agents"));
  }

  async runningAgents(): Promise<Record<string, unknown>[]> {
    return unwrapList(
      await this.http.get<unknown>("/command-center/agents/running"),
    );
  }

  async metrics(): Promise<Record<string, unknown>> {
    return unwrap(await this.http.get<unknown>("/command-center/metrics"));
  }

  async presets(): Promise<Record<string, unknown>[]> {
    return unwrapList(await this.http.get<unknown>("/command-center/presets"));
  }

  async tiers(): Promise<Record<string, unknown>> {
    return unwrap(await this.http.get<unknown>("/command-center/tiers"));
  }

  /** Stream live command-center events via SSE. */
  events(): AsyncIterableIterator<Record<string, unknown>> {
    return this.http.stream<Record<string, unknown>>("/command-center/events");
  }
}
