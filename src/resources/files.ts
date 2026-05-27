import { HttpClient } from "../http.js";
import type {
  CopyParams,
  DirEntry,
  DirListResult,
  FileDeleteParams,
  FileEntry,
  FileExportParams,
  FileExportResult,
  FileListResult,
  FileStat,
  MkdirParams,
} from "../types.js";

function toBase64(bytes: Uint8Array): string {
  // Works on both Node (Buffer available) and browsers/Deno/Bun (btoa).
  const maybeBuffer = (
    globalThis as {
      Buffer?: { from(b: Uint8Array): { toString(e: string): string } };
    }
  ).Buffer;
  if (maybeBuffer) return maybeBuffer.from(bytes).toString("base64");
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

export class Files {
  private readonly http: HttpClient;
  private readonly computerId: string;

  constructor(http: HttpClient, computerId: string) {
    this.http = http;
    this.computerId = computerId;
  }

  private base(): string {
    return `/computers/${this.computerId}/files`;
  }

  /**
   * Upload a local file to the computer.
   *
   * In a Node.js environment pass a Buffer or Blob; in a browser pass a File
   * or Blob.  The remote path is where the file will be written inside the VM.
   *
   * @param content  - File content as Blob, Buffer, Uint8Array, or string.
   * @param remotePath - Absolute path inside the VM (e.g. /home/user/file.txt).
   * @param filename - Optional filename hint (defaults to basename of remotePath).
   */
  async upload(
    content: Blob | Uint8Array | string,
    remotePath: string,
    _filename?: string,
  ): Promise<FileEntry> {
    // The hosted API is JSON-only — it doesn't accept multipart uploads.
    // We send {path, content_base64} so binary payloads round-trip cleanly.
    let bytes: Uint8Array;
    if (typeof content === "string") {
      bytes = new TextEncoder().encode(content);
    } else if (content instanceof Uint8Array) {
      bytes = content;
    } else {
      // Blob → bytes
      const buf = await content.arrayBuffer();
      bytes = new Uint8Array(buf);
    }

    const contentBase64 = toBase64(bytes);

    return this.http.post<FileEntry>(`${this.base()}/write`, {
      path: remotePath,
      content_base64: contentBase64,
    });
  }

  /**
   * List files and directories at the given path inside the VM.
   */
  async list(path: string): Promise<FileListResult> {
    return this.http.get<FileListResult>(this.base(), { path });
  }

  /**
   * Download a file from the computer. Returns raw bytes.
   */
  async download(path: string): Promise<Uint8Array> {
    const url = `${this.base()}/download`;
    // Build query manually so getBinary can still use the helper
    return this.http.getBinary(`${url}?path=${encodeURIComponent(path)}`);
  }

  /**
   * Export a file from the computer and receive a temporary signed URL.
   */
  async export(path: string): Promise<FileExportResult> {
    const params: FileExportParams = { path };
    return this.http.post<FileExportResult>(`${this.base()}/export`, params);
  }

  /**
   * Delete a file or directory inside the computer.
   */
  async delete(path: string): Promise<void> {
    const params: FileDeleteParams = { path };
    return this.http.delete<void>(this.base(), params);
  }

  // ── Phase-7 stdlib-parity methods ──────────────────────────────────────────

  /**
   * Stat a path inside the computer. Does not follow symlinks (lstat semantics).
   *
   * Returns `{path, size, mode, is_dir, is_symlink, symlink_target?, modified_at}`.
   */
  async stat(path: string): Promise<FileStat> {
    const result = await this.http.post<{ data: FileStat }>(
      `${this.base()}/stat`,
      { path },
    );
    return result.data;
  }

  /**
   * Create a directory inside the computer.
   *
   * @param path    - Absolute path to create (e.g. `/home/user/project`).
   * @param options - `{ recursive?: boolean, mode?: number }`. Defaults: recursive=true, mode=0o755.
   */
  async mkdir(path: string, options: MkdirParams = {}): Promise<void> {
    const modeStr =
      options.mode !== undefined
        ? options.mode.toString(8).padStart(4, "0")
        : "0755";

    await this.http.post<unknown>(`${this.base()}/mkdir`, {
      path,
      recursive: options.recursive ?? true,
      mode: modeStr,
    });
  }

  /**
   * Rename (move) a path inside the computer.
   *
   * Creates the destination parent directory if it does not exist.
   */
  async rename(from: string, to: string): Promise<void> {
    await this.http.post<unknown>(`${this.base()}/rename`, { from, to });
  }

  /**
   * Copy a file or directory inside the computer.
   *
   * @param from    - Source absolute path.
   * @param to      - Destination absolute path.
   * @param options - `{ recursive?: boolean }`. Required when source is a directory.
   */
  async copy(
    from: string,
    to: string,
    options: CopyParams = {},
  ): Promise<void> {
    await this.http.post<unknown>(`${this.base()}/copy`, {
      from,
      to,
      recursive: options.recursive ?? false,
    });
  }

  /**
   * Change permissions on a path inside the computer.
   *
   * @param path - Absolute path inside the VM.
   * @param mode - Unix mode bits as an octal integer (e.g. `0o755`) or string (`"0755"`).
   */
  async chmod(path: string, mode: number | string): Promise<void> {
    const modeStr =
      typeof mode === "number" ? mode.toString(8).padStart(4, "0") : mode;
    await this.http.post<unknown>(`${this.base()}/chmod`, {
      path,
      mode: modeStr,
    });
  }

  /**
   * Return a rich directory listing for the given path.
   *
   * Each entry includes `{name, is_dir, is_symlink, size, modified_at}`.
   * Richer than `list()` which uses `find` under the hood.
   *
   * @param path        - Absolute path to list.
   * @param _withTypes  - Kept for API symmetry; types are always returned.
   */
  async readdir(path: string, _withTypes = true): Promise<DirEntry[]> {
    const result = await this.http.get<DirListResult>(
      `${this.base()}/readdir`,
      { path },
    );
    return result.data.entries;
  }

  // ── Read/write text helpers ─────────────────────────────────────────────────

  /**
   * Write a UTF-8 string to a file inside the computer.
   * Convenience wrapper around `upload()`.
   */
  async writeFile(path: string, content: string): Promise<void> {
    await this.upload(content, path);
  }

  /**
   * Read a file from the computer and return its contents as a UTF-8 string.
   */
  async readFile(path: string): Promise<string> {
    const bytes = await this.download(path);
    return new TextDecoder().decode(bytes);
  }
}
