/**
 * TenantEvents — tenant-scoped SSE event stream.
 * Corresponds to: GET /api/v1/events/stream?types=sandbox.*,webhook.delivered
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface TenantStreamEvent {
  type: string;
  [key: string]: unknown;
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class TenantEvents {
  constructor(private readonly http: HttpClient) {}

  /**
   * GET /api/v1/events/stream — tenant-scoped SSE event stream.
   *
   * @param types - Event type globs to filter. Accepts a comma-separated string
   *   or an array, e.g. `["sandbox.*", "webhook.delivered"]`.
   *   Omit to receive all event types.
   */
  stream(types?: string | string[]): AsyncIterableIterator<TenantStreamEvent> {
    const typesParam = Array.isArray(types) ? types.join(",") : types;
    const query = typesParam ? `?types=${encodeURIComponent(typesParam)}` : "";
    return this.http.stream<TenantStreamEvent>(`/events/stream${query}`);
  }
}
