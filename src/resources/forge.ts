import { MiosaError } from "../errors.js";
import type { HttpClient } from "../http.js";

export type ForgeRepositoryId = string & {
  readonly __brand: "ForgeRepositoryId";
};

export type ForgeOrganizationId = string & {
  readonly __brand: "ForgeOrganizationId";
};

export type ForgeRepositoryVisibility = "public" | "private" | "internal";
export type ForgeRepositoryState =
  | "provisioning"
  | "active"
  | "error"
  | "deletion_pending"
  | "deleted";

const REPOSITORY_VISIBILITIES = new Set<ForgeRepositoryVisibility>([
  "public",
  "private",
  "internal",
]);
const REPOSITORY_STATES = new Set<ForgeRepositoryState>([
  "provisioning", "active", "error", "deletion_pending", "deleted",
]);

export interface ForgeRepository {
  id: ForgeRepositoryId;
  name: string;
  slug: string;
  default_branch: string;
  visibility: ForgeRepositoryVisibility;
  state: ForgeRepositoryState;
  clone_ready: boolean;
  clone_url: string | null;
  project_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ForgeRepositoryCreateParams {
  name: string;
  slug?: string;
  defaultBranch?: string;
  visibility?: ForgeRepositoryVisibility;
  projectIds?: string[];
  idempotencyKey?: string;
}

export interface ForgeRepositoryUpdateParams {
  name?: string;
  slug?: string;
  visibility?: ForgeRepositoryVisibility;
  projectIds?: string[];
}

export interface ForgeRepositoryDeleteOptions {
  /** Deprecated: delete is inherently replay-safe and accepts no key in v1. */
  idempotencyKey?: never;
}

export interface ForgeCapabilities {
  api_version: "v1";
  ownership: "organization";
  detail_locator: "repository_id";
  lifecycle_states: ForgeRepositoryState[];
  visibility_values: ForgeRepositoryVisibility[];
  clone_ready_states: ["active"];
  base_url: string;
  features: Record<string, boolean>;
}

export interface ForgeDeleteReceipt {
  operation_id: ForgeRepositoryId;
  replayed: boolean;
}

export interface ForgeNamedRef {
  name: string;
  oid: string;
}

export interface ForgeBranch extends ForgeNamedRef {
  is_default: boolean;
}

export interface ForgeRepositoryRefs {
  default_branch: string;
  head_oid: string | null;
  branches: ForgeBranch[];
  tags: ForgeNamedRef[];
}

export type ForgeTreeEntryType = "blob" | "tree";

export interface ForgeTreeEntry {
  name: string;
  path: string;
  type: ForgeTreeEntryType;
  oid: string;
  size: number | null;
}

export interface ForgeRepositoryTree {
  ref: string;
  commit_oid: string;
  path: string;
  entries: ForgeTreeEntry[];
  truncated: boolean;
}

export type ForgeBlobEncoding = "utf-8" | "base64";

export interface ForgeRepositoryBlob {
  ref: string;
  commit_oid: string;
  path: string;
  oid: string;
  size: number;
  encoding: ForgeBlobEncoding;
  content: string;
}

export interface ForgeCommit {
  oid: string;
  short_oid: string;
  subject: string;
  author_name: string;
  author_email: string;
  authored_at: string;
  committer_name: string;
  committed_at: string;
  parents: string[];
}

export interface ForgeCommitHistory {
  ref: string;
  path: string;
  commits: ForgeCommit[];
  page: { has_more: boolean; next_cursor: string | null };
}

export interface ForgeContentLocation {
  ref?: string;
  path?: string;
}

export interface ForgeCommitQuery extends ForgeContentLocation {
  limit?: number;
  cursor?: string;
}

export interface ForgeFileAuthoringParams {
  branch?: string;
  expectedHead: string;
  message?: string;
  content?: string;
  idempotencyKey?: string;
}

export interface ForgeFileOperationReceipt {
  operation_id: string;
  repository_id: ForgeRepositoryId;
  branch: string;
  path: string;
  action: "create" | "update" | "delete";
  previous_head: string;
  new_head: string;
  commit: Omit<ForgeCommit, "parents"> & { committer_email: string; signature_status: "unsigned" };
  policy: { decision: "allowed"; receipt_ids: string[] };
  replayed: boolean;
}

export class ForgeContractError extends MiosaError {
  constructor(message: string, details?: unknown) {
    super(message, 502, "FORGE_CONTRACT_ERROR", details);
    this.name = "ForgeContractError";
  }
}

export class ForgeUnavailableError extends MiosaError {
  constructor(message: string, cause: MiosaError) {
    super(message, cause.status, "FORGE_DISABLED", cause.details, cause.requestId);
    this.name = "ForgeUnavailableError";
  }
}

export class ForgeStorageError extends MiosaError {
  constructor(message: string, cause: MiosaError) {
    super(message, cause.status, cause.code, cause.details, cause.requestId);
    this.name = "ForgeStorageError";
  }
}

export class ForgePolicyViolationError extends MiosaError {
  constructor(message: string, cause: MiosaError) {
    super(message, cause.status, cause.code, cause.details, cause.requestId);
    this.name = "ForgePolicyViolationError";
  }
}

function translateError(error: unknown): never {
  if (!(error instanceof MiosaError)) throw error;
  if (error.code === "FORGE_DISABLED") {
    throw new ForgeUnavailableError("Forge is not enabled for this organization", error);
  }
  if (error.code === "FORGE_STORAGE_UNAVAILABLE" || error.code === "FORGE_OPERATION_FAILED") {
    throw new ForgeStorageError("Forge repository storage is unavailable", error);
  }
  if (error.code === "INVALID_PROJECT_ATTACHMENT") {
    throw new ForgePolicyViolationError("Forge repository policy rejected the operation", error);
  }
  throw error;
}

function repositoryPath(id: ForgeRepositoryId): string {
  return `/forge/repositories/${encodeURIComponent(id)}`;
}

function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}

function object(payload: unknown, label: string): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ForgeContractError(`Forge returned invalid ${label}`, { payload });
  }
  return payload as Record<string, unknown>;
}

function string(value: unknown, field: string, payload: unknown): string {
  if (typeof value !== "string") {
    throw new ForgeContractError(`Forge content is missing ${field}`, { field, payload });
  }
  return value;
}

function nullableString(value: unknown, field: string, payload: unknown): string | null {
  if (value !== null && typeof value !== "string") {
    throw new ForgeContractError(`Forge content has invalid ${field}`, { field, payload });
  }
  return value;
}

function queryPath(path: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `${path}?${encoded}` : path;
}

function parseNamedRef(payload: unknown): ForgeNamedRef {
  const value = object(payload, "repository ref");
  return { name: string(value.name, "name", payload), oid: string(value.oid, "oid", payload) };
}

function parseRefs(payload: unknown): ForgeRepositoryRefs {
  const value = object(payload, "repository refs");
  if (!Array.isArray(value.branches) || !Array.isArray(value.tags)) {
    throw new ForgeContractError("Forge repository refs have invalid collections", { payload });
  }
  const branches = value.branches.map((item) => {
    const branch = object(item, "branch");
    if (typeof branch.is_default !== "boolean") {
      throw new ForgeContractError("Forge branch is missing is_default", { payload: item });
    }
    return { ...parseNamedRef(item), is_default: branch.is_default };
  });
  return {
    default_branch: string(value.default_branch, "default_branch", payload),
    head_oid: nullableString(value.head_oid, "head_oid", payload),
    branches,
    tags: value.tags.map(parseNamedRef),
  };
}

function parseTree(payload: unknown): ForgeRepositoryTree {
  const value = object(payload, "repository tree");
  if (!Array.isArray(value.entries) || typeof value.truncated !== "boolean") {
    throw new ForgeContractError("Forge repository tree has invalid entries", { payload });
  }
  const entries = value.entries.map((item): ForgeTreeEntry => {
    const entry = object(item, "tree entry");
    if (entry.type !== "blob" && entry.type !== "tree") {
      throw new ForgeContractError("Forge tree entry has invalid type", { payload: item });
    }
    if (entry.size !== null && (typeof entry.size !== "number" || !Number.isSafeInteger(entry.size) || entry.size < 0)) {
      throw new ForgeContractError("Forge tree entry has invalid size", { payload: item });
    }
    return {
      name: string(entry.name, "name", item), path: string(entry.path, "path", item),
      type: entry.type, oid: string(entry.oid, "oid", item), size: entry.size,
    };
  });
  return {
    ref: string(value.ref, "ref", payload),
    commit_oid: string(value.commit_oid, "commit_oid", payload),
    path: string(value.path, "path", payload), entries, truncated: value.truncated,
  };
}

function parseBlob(payload: unknown): ForgeRepositoryBlob {
  const value = object(payload, "repository blob");
  if (value.encoding !== "utf-8" && value.encoding !== "base64") {
    throw new ForgeContractError("Forge blob has invalid encoding", { payload });
  }
  if (typeof value.size !== "number" || !Number.isSafeInteger(value.size) || value.size < 0) {
    throw new ForgeContractError("Forge blob has invalid size", { payload });
  }
  return {
    ref: string(value.ref, "ref", payload), commit_oid: string(value.commit_oid, "commit_oid", payload),
    path: string(value.path, "path", payload), oid: string(value.oid, "oid", payload),
    size: value.size, encoding: value.encoding, content: string(value.content, "content", payload),
  };
}

function parseHistory(payload: unknown): ForgeCommitHistory {
  const value = object(payload, "commit history");
  const page = object(value.page, "commit page");
  if (!Array.isArray(value.commits) || typeof page.has_more !== "boolean") {
    throw new ForgeContractError("Forge commit history has invalid pagination", { payload });
  }
  const commits = value.commits.map((item): ForgeCommit => {
    const commit = object(item, "commit");
    if (!Array.isArray(commit.parents) || !commit.parents.every((parent) => typeof parent === "string")) {
      throw new ForgeContractError("Forge commit has invalid parents", { payload: item });
    }
    return {
      oid: string(commit.oid, "oid", item), short_oid: string(commit.short_oid, "short_oid", item),
      subject: string(commit.subject, "subject", item), author_name: string(commit.author_name, "author_name", item),
      author_email: string(commit.author_email, "author_email", item), authored_at: string(commit.authored_at, "authored_at", item),
      committer_name: string(commit.committer_name, "committer_name", item), committed_at: string(commit.committed_at, "committed_at", item),
      parents: commit.parents as string[],
    };
  });
  return {
    ref: string(value.ref, "ref", payload), path: string(value.path, "path", payload), commits,
    page: { has_more: page.has_more, next_cursor: nullableString(page.next_cursor, "next_cursor", page) },
  };
}

function parseFileReceipt(payload: unknown, replayed: boolean): ForgeFileOperationReceipt {
  const value = object(payload, "file operation receipt");
  const commit = object(value.commit, "file operation commit");
  const policy = object(value.policy, "file operation policy");
  const stringFields = ["operation_id", "repository_id", "branch", "path", "previous_head", "new_head"];
  if (stringFields.some((field) => typeof value[field] !== "string") ||
      !["create", "update", "delete"].includes(String(value.action)) || policy.decision !== "allowed" ||
      !Array.isArray(policy.receipt_ids) || !policy.receipt_ids.every((id) => typeof id === "string") ||
      typeof commit.oid !== "string" || typeof commit.committed_at !== "string") {
    throw new ForgeContractError("Forge returned invalid file operation receipt", { payload });
  }
  return { ...value, replayed } as unknown as ForgeFileOperationReceipt;
}

function parseRepository(payload: unknown): ForgeRepository {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ForgeContractError("Forge returned an invalid repository", {
      payload,
    });
  }

  const value = payload as Record<string, unknown>;
  const requiredStrings = [
    "id",
    "name",
    "slug",
    "default_branch",
    "visibility",
    "state",
    "created_at",
    "updated_at",
  ] as const;

  for (const field of requiredStrings) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      throw new ForgeContractError(`Forge repository is missing ${field}`, {
        field,
        payload,
      });
    }
  }

  if (!REPOSITORY_VISIBILITIES.has(value.visibility as ForgeRepositoryVisibility)) {
    throw new ForgeContractError("Forge repository has an invalid visibility", {
      payload,
    });
  }
  if (!REPOSITORY_STATES.has(value.state as ForgeRepositoryState)) {
    throw new ForgeContractError("Forge repository has an invalid state", {
      payload,
    });
  }

  if (typeof value.clone_ready !== "boolean" ||
      (value.clone_url !== null && typeof value.clone_url !== "string") ||
      !Array.isArray(value.project_ids) || !value.project_ids.every((id) => typeof id === "string"))
    throw new ForgeContractError("Forge repository has invalid clone or project metadata", { payload });
  if (value.clone_ready !== (value.state === "active") ||
      (value.clone_ready && !value.clone_url) || (!value.clone_ready && value.clone_url !== null))
    throw new ForgeContractError("Forge repository clone readiness is inconsistent", { payload });

  return {
    id: value.id as ForgeRepositoryId,
    name: value.name as string,
    slug: value.slug as string,
    default_branch: value.default_branch as string,
    visibility: value.visibility as ForgeRepositoryVisibility,
    state: value.state as ForgeRepositoryState,
    clone_ready: value.clone_ready,
    clone_url: value.clone_url as string | null,
    project_ids: value.project_ids as string[],
    created_at: value.created_at as string,
    updated_at: value.updated_at as string,
  };
}

function parseCapabilities(payload: unknown): ForgeCapabilities {
  const value = object(payload, "capabilities");
  const valid = value.api_version === "v1" && value.ownership === "organization" &&
    value.detail_locator === "repository_id" && typeof value.base_url === "string" &&
    Array.isArray(value.lifecycle_states) && Array.isArray(value.visibility_values) &&
    Array.isArray(value.clone_ready_states) && value.clone_ready_states.length === 1 &&
    value.clone_ready_states[0] === "active" && value.features && typeof value.features === "object";
  if (!valid) throw new ForgeContractError("Forge returned invalid capabilities", { payload });
  return value as unknown as ForgeCapabilities;
}

export class ForgeRepositories {
  constructor(private readonly http: HttpClient) {}

  async create(params: ForgeRepositoryCreateParams): Promise<ForgeRepository> {
    try {
      const payload = await this.http.request<unknown>("/forge/repositories", {
        method: "POST",
        headers: { "Idempotency-Key": params.idempotencyKey ?? crypto.randomUUID() },
        body: compact({
          name: params.name,
          slug: params.slug,
          default_branch: params.defaultBranch,
          visibility: params.visibility,
          project_ids: params.projectIds,
        }),
      });
      return parseRepository(unwrapData(payload));
    } catch (error) {
      translateError(error);
    }
  }

  async list(): Promise<ForgeRepository[]> {
    const payload = await this.http.get<unknown>("/forge/repositories");
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      !Array.isArray((payload as Record<string, unknown>).data)
    ) {
      throw new ForgeContractError("Forge returned an invalid repository list", {
        payload,
      });
    }
    return ((payload as Record<string, unknown>).data as unknown[]).map(
      parseRepository,
    );
  }

  async get(id: ForgeRepositoryId): Promise<ForgeRepository> {
    return parseRepository(unwrapData(await this.http.get<unknown>(repositoryPath(id))));
  }

  async refs(id: ForgeRepositoryId): Promise<ForgeRepositoryRefs> {
    return parseRefs(unwrapData(await this.http.get<unknown>(`${repositoryPath(id)}/refs`)));
  }

  async tree(id: ForgeRepositoryId, location: ForgeContentLocation = {}): Promise<ForgeRepositoryTree> {
    const path = queryPath(`${repositoryPath(id)}/tree`, { ref: location.ref, path: location.path });
    return parseTree(unwrapData(await this.http.get<unknown>(path)));
  }

  async blob(id: ForgeRepositoryId, location: ForgeContentLocation & { path: string }): Promise<ForgeRepositoryBlob> {
    const path = queryPath(`${repositoryPath(id)}/blob`, { ref: location.ref, path: location.path });
    return parseBlob(unwrapData(await this.http.get<unknown>(path)));
  }

  async readme(id: ForgeRepositoryId, location: ForgeContentLocation = {}): Promise<ForgeRepositoryBlob> {
    const path = queryPath(`${repositoryPath(id)}/readme`, { ref: location.ref, path: location.path });
    return parseBlob(unwrapData(await this.http.get<unknown>(path)));
  }

  async commits(id: ForgeRepositoryId, query: ForgeCommitQuery = {}): Promise<ForgeCommitHistory> {
    const path = queryPath(`${repositoryPath(id)}/commits`, {
      ref: query.ref, path: query.path, limit: query.limit, cursor: query.cursor,
    });
    return parseHistory(unwrapData(await this.http.get<unknown>(path)));
  }

  async putFile(id: ForgeRepositoryId, path: string, params: ForgeFileAuthoringParams & { content: string }): Promise<ForgeFileOperationReceipt> {
    return this.authorFile(id, path, "PUT", params);
  }

  async deleteFile(id: ForgeRepositoryId, path: string, params: ForgeFileAuthoringParams): Promise<ForgeFileOperationReceipt> {
    return this.authorFile(id, path, "DELETE", params);
  }

  private async authorFile(id: ForgeRepositoryId, path: string, method: "PUT" | "DELETE", params: ForgeFileAuthoringParams): Promise<ForgeFileOperationReceipt> {
    const response = await this.http.request<Response>(`${repositoryPath(id)}/files/${path.split("/").map(encodeURIComponent).join("/")}`, {
      method, rawResponse: true,
      headers: { "Idempotency-Key": params.idempotencyKey ?? crypto.randomUUID() },
      body: compact({ branch: params.branch, expected_head: params.expectedHead, message: params.message, content: params.content }),
    });
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new ForgeContractError("Forge returned invalid file operation JSON"); }
    return parseFileReceipt(unwrapData(payload), response.headers.get("idempotency-replayed") === "true");
  }

  async update(id: ForgeRepositoryId, params: ForgeRepositoryUpdateParams): Promise<ForgeRepository> {
    try {
      const payload = await this.http.request<unknown>(repositoryPath(id), { method: "PATCH", body: compact({
        name: params.name, slug: params.slug, visibility: params.visibility, project_ids: params.projectIds,
      }) });
      return parseRepository(unwrapData(payload));
    } catch (error) { translateError(error); }
  }

  async delete(
    id: ForgeRepositoryId,
    _options: ForgeRepositoryDeleteOptions = {},
  ): Promise<ForgeDeleteReceipt> {
    try {
      const response = await this.http.request<Response>(repositoryPath(id), {
        method: "DELETE",
        rawResponse: true,
      });
      const operationId = response.headers.get("x-forge-operation-id");
      if (!operationId) throw new ForgeContractError("Forge delete omitted its operation receipt");
      return { operation_id: operationId as ForgeRepositoryId, replayed: response.headers.get("idempotency-replayed") === "true" };
    } catch (error) {
      translateError(error);
    }
  }
}

function unwrapData(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !("data" in payload))
    throw new ForgeContractError("Forge returned an invalid success envelope", { payload });
  return (payload as { data: unknown }).data;
}

export class Forge {
  readonly repositories: ForgeRepositories;

  constructor(http: HttpClient) {
    this.repositories = new ForgeRepositories(http);
    this.http = http;
  }

  private readonly http: HttpClient;

  async capabilities(): Promise<ForgeCapabilities> {
    return parseCapabilities(unwrapData(await this.http.get<unknown>("/forge/capabilities")));
  }
}
