/**
 * Storage resource — managed S3-compatible buckets, objects, and presigned URLs.
 */

import type { HttpClient } from "../http.js";

// ── Branded IDs ──────────────────────────────────────────────────────────────

export type BucketId = string & { readonly __brand: "BucketId" };

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface BucketData {
  id: BucketId;
  tenant_id: string;
  name: string;
  region?: string | null;
  visibility?: "private" | "public" | string;
  quota_bytes?: number | null;
  used_bytes?: number | null;
  public?: boolean;
  object_count?: number | null;
  size_bytes?: number | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface StorageObjectData {
  key: string;
  size_bytes?: number;
  content_type?: string;
  etag?: string | null;
  last_modified?: string | null;
  [key: string]: unknown;
}

export interface PresignResult {
  url: string;
  expires_at?: string;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface BucketCreateParams {
  name: string;
  region?: string;
  visibility?: "private" | "public";
  quota_bytes?: number;
  public?: boolean;
  [key: string]: unknown;
}

export interface ObjectListParams {
  prefix?: string;
  maxKeys?: number;
  max_keys?: number;
  marker?: string;
  /** @deprecated use maxKeys/max_keys; kept as a convenience alias. */
  limit?: number;
  /** @deprecated use marker; kept as a convenience alias. */
  cursor?: string;
}

export interface PresignParams {
  key: string;
  method?: "GET" | "PUT";
  expiresIn?: number;
  expires_in?: number;
  /** @deprecated use method; kept as a convenience alias. */
  operation?: "get" | "put";
  /** @deprecated use expiresIn/expires_in; kept as a convenience alias. */
  expiresInSec?: number;
  /** @deprecated use expiresIn/expires_in; kept as a convenience alias. */
  expires_in_sec?: number;
  contentType?: string;
  content_type?: string;
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
  candidateKeys: string[] = ["data", "buckets", "objects", "items"],
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

// ── Main resource ─────────────────────────────────────────────────────────────

export class Storage {
  constructor(private readonly http: HttpClient) {}

  // ── Buckets ────────────────────────────────────────────────────────────────

  async listBuckets(): Promise<BucketData[]> {
    const data = await this.http.get<unknown>("/storage/buckets");
    return listItems<BucketData>(data);
  }

  async createBucket(params: BucketCreateParams): Promise<BucketData> {
    const { name, public: isPublic, visibility, ...rest } = params;
    const body = stripUndefined({
      name,
      visibility:
        visibility ??
        (isPublic === undefined ? undefined : isPublic ? "public" : "private"),
      ...rest,
    });
    const data = await this.http.post<unknown>("/storage/buckets", body);
    return unwrap<BucketData>(data);
  }

  async getBucket(bucketId: string): Promise<BucketData> {
    const data = await this.http.get<unknown>(`/storage/buckets/${bucketId}`);
    return unwrap<BucketData>(data);
  }

  async deleteBucket(bucketId: string): Promise<void> {
    await this.http.delete<unknown>(`/storage/buckets/${bucketId}`);
  }

  // ── Objects ────────────────────────────────────────────────────────────────

  async listObjects(
    bucketId: string,
    params: ObjectListParams = {},
  ): Promise<StorageObjectData[]> {
    const query = stripUndefined({
      prefix: params.prefix,
      max_keys: params.max_keys ?? params.maxKeys ?? params.limit,
      marker: params.marker ?? params.cursor,
    }) as Record<string, string | number | boolean | undefined>;
    const data = await this.http.get<unknown>(
      `/storage/buckets/${bucketId}/objects`,
      query,
    );
    return listItems<StorageObjectData>(data, ["data", "objects", "items"]);
  }

  async putObject(
    bucketId: string,
    key: string,
    content: Uint8Array | ArrayBuffer,
    opts: { contentType?: string } = {},
  ): Promise<Record<string, unknown>> {
    const contentType = opts.contentType ?? "application/octet-stream";
    const data = await this.http.request<unknown>(
      `/storage/buckets/${bucketId}/objects/${key}`,
      {
        method: "PUT",
        body: content,
        headers: { "Content-Type": contentType },
      },
    );
    return (data ?? {}) as Record<string, unknown>;
  }

  async getObject(bucketId: string, key: string): Promise<Uint8Array> {
    return this.http.getBinary(`/storage/buckets/${bucketId}/objects/${key}`);
  }

  async deleteObject(bucketId: string, key: string): Promise<void> {
    await this.http.delete<unknown>(
      `/storage/buckets/${bucketId}/objects/${key}`,
    );
  }

  // ── Presigned URLs ─────────────────────────────────────────────────────────

  async presign(
    bucketId: string,
    params: PresignParams,
  ): Promise<PresignResult> {
    const operationMethod =
      params.operation === "put"
        ? "PUT"
        : params.operation === "get"
          ? "GET"
          : undefined;

    const body = stripUndefined({
      key: params.key,
      method: params.method ?? operationMethod ?? "GET",
      expires_in:
        params.expiresIn ??
        params.expires_in ??
        params.expiresInSec ??
        params.expires_in_sec ??
        3600,
    });
    const data = await this.http.post<unknown>(
      `/storage/buckets/${bucketId}/presign`,
      body,
    );
    return unwrap<PresignResult>(data);
  }
}
