import { HttpClient } from "../../http.js";
import type { FsEntry, FsListResponse, FsStat, HostId } from "./types.js";

/**
 * Files resource — direct file-system access on a remote OpenComputers host.
 *
 * Operations are proxied through the OSA daemon running on the host.
 *
 * ```ts
 * const entries = await client.openComputers.files.list(hostId, "/home/user");
 * const bytes = await client.openComputers.files.download(hostId, "/home/user/report.pdf");
 * await client.openComputers.files.upload(hostId, "/tmp/data.json", new TextEncoder().encode("{}"));
 * ```
 */
export class OcFiles {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  private base(hostId: string): string {
    return `/opencomputers/hosts/${hostId}/fs`;
  }

  /**
   * List directory entries at `path`.
   */
  async list(hostId: HostId | string, path: string): Promise<FsListResponse> {
    return this.http.get<FsListResponse>(this.base(hostId), { path });
  }

  /**
   * Stat a path (does not follow symlinks).
   */
  async stat(hostId: HostId | string, path: string): Promise<FsStat> {
    return this.http.get<FsStat>(`${this.base(hostId)}/stat`, { path });
  }

  /**
   * Download a file from the host. Returns raw bytes.
   */
  async download(hostId: HostId | string, path: string): Promise<Uint8Array> {
    const url = `${this.base(hostId)}/download?path=${encodeURIComponent(path)}`;
    return this.http.getBinary(url);
  }

  /**
   * Upload content to `remotePath` on the host.
   *
   * @param content    - `Blob`, `Uint8Array`, or UTF-8 string.
   * @param remotePath - Absolute destination path on the host.
   * @param filename   - Optional filename hint; defaults to `remotePath` basename.
   */
  async upload(
    hostId: HostId | string,
    remotePath: string,
    content: Blob | Uint8Array | string,
    filename?: string,
  ): Promise<FsEntry> {
    const fd = new FormData();
    const name = filename ?? remotePath.split("/").pop() ?? "file";

    if (typeof content === "string") {
      fd.append("file", new Blob([content]), name);
    } else if (content instanceof Uint8Array) {
      fd.append("file", new Blob([content.buffer as ArrayBuffer]), name);
    } else {
      fd.append("file", content, name);
    }
    fd.append("path", remotePath);

    return this.http.postFormData<FsEntry>(`${this.base(hostId)}/upload`, fd);
  }

  /**
   * Delete a file or directory.
   *
   * @param recursive - When `true`, delete non-empty directories recursively.
   */
  async delete(
    hostId: HostId | string,
    path: string,
    recursive = false,
  ): Promise<void> {
    return this.http.delete<void>(
      `${this.base(hostId)}?path=${encodeURIComponent(path)}&recursive=${recursive}`,
    );
  }

  /**
   * Create a directory (and any missing parents).
   */
  async mkdir(hostId: HostId | string, path: string): Promise<void> {
    return this.http.post<void>(`${this.base(hostId)}/mkdir`, { path });
  }
}
