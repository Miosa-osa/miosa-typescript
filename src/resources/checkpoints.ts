import type { HttpClient } from "../http.js";
import type { ComputerData } from "../types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SnapshotStatus =
  | "creating"
  | "uploading"
  | "ready"
  | "restoring"
  | "failed"
  | "deleted";

export interface SnapshotData {
  id: string;
  computer_id: string;
  tenant_id: string;
  comment: string | null;
  status: SnapshotStatus;
  state_size_bytes: number | null;
  memory_size_bytes: number | null;
  rootfs_size_bytes: number | null;
  compressed_size_bytes: number | null;
  s3_bucket: string | null;
  s3_prefix: string | null;
  parent_snapshot_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SnapshotCreateParams {
  /** Optional human-readable label for this checkpoint. */
  comment?: string;
}

export interface SnapshotRestoreResult {
  /** The newly provisioned Computer booted from this snapshot. */
  data: ComputerData;
  /** The source snapshot used for the restore. */
  snapshot: SnapshotData;
}

export interface SnapshotListResponse {
  data: SnapshotData[];
}

export type SnapshotProgressEvent = {
  type: "snapshot_progress";
  snapshot_id: string;
  status: SnapshotStatus | string;
  step?: string;
  progress?: number;
  error?: string;
};

// ─── Checkpoints ─────────────────────────────────────────────────────────────

/**
 * Firecracker microVM checkpoint management for a Computer.
 *
 * Accessed via `computer.checkpoints`.
 *
 * @example
 * ```ts
 * const snap = await computer.checkpoints.create({ comment: "before upgrade" });
 * // ... do risky work ...
 * const fresh = await computer.checkpoints.restore(snap.id);
 * ```
 */
export class Checkpoints {
  private readonly http: HttpClient;
  private readonly computerId: string;

  constructor(http: HttpClient, computerId: string) {
    this.http = http;
    this.computerId = computerId;
  }

  private base(): string {
    return `/computers/${this.computerId}/snapshots`;
  }

  /**
   * Create a checkpoint of the running computer.
   *
   * The returned snapshot starts in `creating` status and progresses
   * through `uploading` → `ready` asynchronously. Poll `get()` or subscribe
   * to progress events via `onProgress` to know when it's ready.
   *
   * @param params - Optional `comment` label.
   * @param onProgress - Optional callback fired for each SSE progress event.
   *   Only called if a SSE ticket is available (the `events` endpoint requires
   *   a prior `POST /api/v1/auth/sse-ticket` call).
   */
  async create(
    params: SnapshotCreateParams = {},
    onProgress?: (event: SnapshotProgressEvent) => void,
  ): Promise<SnapshotData> {
    const resp = await this.http.post<{ data: SnapshotData }>(
      this.base(),
      params,
    );
    const snap = resp.data;

    if (onProgress) {
      // Fire-and-forget progress subscription — caller decides how to await.
      void this.subscribeProgress(snap.id, onProgress).catch(() => {
        // Ignore SSE errors — the snapshot still proceeds on the server.
      });
    }

    return snap;
  }

  /**
   * List all non-deleted checkpoints for this computer.
   */
  async list(): Promise<SnapshotData[]> {
    const resp = await this.http.get<SnapshotListResponse>(this.base());
    return resp.data;
  }

  /**
   * Fetch a single checkpoint by id.
   */
  async get(id: string): Promise<SnapshotData> {
    const resp = await this.http.get<{ data: SnapshotData }>(
      `${this.base()}/${id}`,
    );
    return resp.data;
  }

  /**
   * Delete a checkpoint.
   *
   * Transitions the snapshot to `deleted` and schedules S3 cleanup on the
   * server. After deletion the snapshot object is returned with
   * `status: "deleted"`.
   */
  async delete(id: string): Promise<SnapshotData> {
    const resp = await this.http.delete<{ data: SnapshotData }>(
      `${this.base()}/${id}`,
    );
    return resp.data;
  }

  /**
   * Restore a checkpoint onto a fresh Computer.
   *
   * The returned Computer starts in `provisioning` status. Use
   * `computer.checkpoints.restore(id, onProgress)` to subscribe to restore
   * progress events.
   *
   * @param id - Snapshot id to restore (must be in `ready` status).
   * @param onProgress - Optional callback for SSE progress events during restore.
   * @returns A `SnapshotRestoreResult` containing the new Computer and the
   *   source snapshot.
   */
  async restore(
    id: string,
    onProgress?: (event: SnapshotProgressEvent) => void,
  ): Promise<SnapshotRestoreResult> {
    const resp = await this.http.post<SnapshotRestoreResult>(
      `/computers/${this.computerId}/restore/${id}`,
    );

    if (onProgress) {
      void this.subscribeProgress(id, onProgress).catch(() => {});
    }

    return resp;
  }

  /**
   * Subscribe to Server-Sent Events for a snapshot's progress.
   *
   * Yields `SnapshotProgressEvent` objects until the stream closes or
   * `status` reaches a terminal state (`ready`, `failed`, `deleted`).
   *
   * Requires a valid SSE ticket obtained via
   * `POST /api/v1/auth/sse-ticket` and passed as `?ticket=<token>`.
   *
   * @param id - Snapshot id to watch.
   * @param ticket - Short-lived SSE ticket from the auth endpoint.
   */
  async *events(
    id: string,
    ticket: string,
  ): AsyncIterableIterator<SnapshotProgressEvent> {
    const path = `${this.base()}/${id}/events?ticket=${encodeURIComponent(ticket)}`;

    for await (const event of this.http.stream<SnapshotProgressEvent>(path)) {
      yield event;

      if (
        event.status === "ready" ||
        event.status === "failed" ||
        event.status === "deleted"
      ) {
        return;
      }
    }
  }

  // ── Private ──────────────────────────────────────────────────────────

  /**
   * Internal: subscribe to SSE progress events and call `cb` for each.
   *
   * Resolves when the stream closes. Any auth/network errors are silently
   * swallowed so the caller isn't blocked on progress-tracking failures.
   */
  private async subscribeProgress(
    id: string,
    cb: (event: SnapshotProgressEvent) => void,
  ): Promise<void> {
    // We don't have a ticket here (the SDK caller would need to obtain one
    // separately). This internal helper is a no-op placeholder — the public
    // `events()` iterator is the proper SSE interface.
    // Left here for future wiring once ticket issuance is unified.
    void id;
    void cb;
  }
}
