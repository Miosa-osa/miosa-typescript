/**
 * ComputerVolumes — per-computer volume attachment.
 *
 * Routes:
 *   GET    /computers/:id/volumes          — list attachments
 *   POST   /computers/:id/volumes          — attach a volume
 *   DELETE /computers/:id/volumes/:aid     — detach an attachment
 */

import type { HttpClient } from "../http.js";

function unwrap(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if ("data" in d && Object.keys(d).length <= 2) {
      return d.data as Record<string, unknown>;
    }
  }
  return (data ?? {}) as Record<string, unknown>;
}

function unwrapList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["data", "attachments", "volumes", "items"]) {
      if (Array.isArray(d[k])) return d[k] as Record<string, unknown>[];
    }
  }
  return [];
}

export class ComputerVolumes {
  constructor(
    private readonly http: HttpClient,
    private readonly computerId: string,
  ) {}

  private base(): string {
    return `/computers/${this.computerId}/volumes`;
  }

  async list(): Promise<Record<string, unknown>[]> {
    return unwrapList(await this.http.get<unknown>(this.base()));
  }

  /** Attach volumeId at mountPath inside the VM. */
  async attach(
    volumeId: string,
    mountPath: string,
  ): Promise<Record<string, unknown>> {
    return unwrap(
      await this.http.post<unknown>(this.base(), {
        volume_id: volumeId,
        mount_path: mountPath,
      }),
    );
  }

  /** Detach an existing attachment by attachment id. */
  async detach(attachmentId: string): Promise<void> {
    await this.http.delete(`${this.base()}/${attachmentId}`);
  }
}
