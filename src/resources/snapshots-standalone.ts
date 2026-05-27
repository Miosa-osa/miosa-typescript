/**
 * SnapshotsStandalone — fleet-wide snapshot index for admin callers.
 *
 * Routes: /admin/snapshots/*
 * Requires admin credential.
 *
 * Per-computer snapshots remain nested under client.computers.get(id).checkpoints.
 * This resource exposes the fleet-wide read-only index used by the admin dashboard.
 */

import type { HttpClient } from "../http.js";

function unwrap(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["data", "snapshots", "items"]) {
      if (k in d) return d[k] as Record<string, unknown>;
    }
  }
  return data as Record<string, unknown>;
}

function unwrapList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["data", "snapshots", "items"]) {
      if (Array.isArray(d[k])) return d[k] as Record<string, unknown>[];
    }
  }
  return [];
}

export class SnapshotsStandalone {
  constructor(private readonly http: HttpClient) {}

  async list(
    filters: Record<string, string | number | boolean | undefined> = {},
  ): Promise<Record<string, unknown>[]> {
    const query = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined),
    ) as Record<string, string | number | boolean | undefined>;
    return unwrapList(await this.http.get<unknown>("/admin/snapshots", query));
  }

  async get(snapshotId: string): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.get<unknown>(`/admin/snapshots/${snapshotId}`),
    );
  }
}
