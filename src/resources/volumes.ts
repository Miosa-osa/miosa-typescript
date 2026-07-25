/**
 * Volumes resource — persistent block storage.
 */

import { randomUUID } from "node:crypto";

import type { HttpClient } from "../http.js";

// ── Branded IDs ──────────────────────────────────────────────────────────────

export type VolumeId = string & { readonly __brand: "VolumeId" };

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface VolumeData {
  id: VolumeId;
  tenant_id: string;
  name: string;
  size_gb: number;
  state?: string;
  region?: string | null;
  attached_to?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface VolumeListParams {
  limit?: number;
  cursor?: string;
  state?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface VolumeCreateParams {
  name: string;
  size_gb: number;
  sizeGb?: number;
  region?: string;
  idempotencyKey?: string;
  [key: string]: unknown;
}

export interface VolumeAttachmentData {
  id: string;
  volume_id: string;
  computer_id: string;
  mount_path: string;
  read_only?: boolean;
  state?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface VolumeAttachParams {
  volumeId?: string;
  volume_id?: string;
  mountPath?: string;
  mount_path?: string;
  readOnly?: boolean;
  read_only?: boolean;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in (payload as object)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function listItems<T>(
  payload: unknown,
  candidateKeys: string[] = ["data", "volumes", "items"],
): T[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  if (Array.isArray(p.data)) return p.data as T[];
  for (const key of candidateKeys) {
    if (Array.isArray(p[key])) return p[key] as T[];
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

function idempotencyKey(key?: string): string {
  return key ?? randomUUID();
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class Volumes {
  constructor(private readonly http: HttpClient) {}

  async list(params: VolumeListParams = {}): Promise<VolumeData[]> {
    const query = stripUndefined({ ...params }) as Record<
      string,
      string | number | boolean | undefined
    >;
    const data = await this.http.get<unknown>("/volumes", query);
    return listItems<VolumeData>(data);
  }

  async get(volumeId: string): Promise<VolumeData> {
    const data = await this.http.get<unknown>(`/volumes/${volumeId}`);
    return unwrap<VolumeData>(data);
  }

  async create(params: VolumeCreateParams): Promise<VolumeData> {
    const { idempotencyKey: ikey, sizeGb, ...rest } = params;
    const body = stripUndefined({
      ...rest,
      size_gb: sizeGb ?? rest.size_gb,
    });
    const data = await this.http.request<unknown>("/volumes", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey(ikey) },
    });
    return unwrap<VolumeData>(data);
  }

  async delete(volumeId: string): Promise<void> {
    await this.http.delete<unknown>(`/volumes/${volumeId}`);
  }

  async listAttachments(computerId: string): Promise<VolumeAttachmentData[]> {
    const data = await this.http.get<unknown>(`/computers/${computerId}/volumes`);
    return listItems<VolumeAttachmentData>(data, [
      "data",
      "attachments",
      "volumes",
      "items",
    ]);
  }

  async attach(
    computerId: string,
    params: VolumeAttachParams,
  ): Promise<VolumeAttachmentData> {
    const volumeId = params.volumeId ?? params.volume_id;
    const mountPath = params.mountPath ?? params.mount_path;
    const readOnly = params.readOnly ?? params.read_only;
    const body = stripUndefined({
      ...params,
      volumeId: undefined,
      mountPath: undefined,
      readOnly: undefined,
      volume_id: volumeId,
      mount_path: mountPath,
      read_only: readOnly,
    });
    const data = await this.http.post<unknown>(
      `/computers/${computerId}/volumes`,
      body,
    );
    return unwrap<VolumeAttachmentData>(data);
  }

  async detach(computerId: string, attachmentId: string): Promise<void> {
    await this.http.delete<unknown>(
      `/computers/${computerId}/volumes/${attachmentId}`,
    );
  }
}
