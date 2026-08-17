import { beforeEach, describe, expect, it, vi } from "vitest";
import { Miosa } from "../client.js";
import { MiosaError } from "../errors.js";
import type { HttpClient } from "../http.js";
import {
  Forge,
  ForgeContractError,
  ForgeUnavailableError,
  ForgeRepositories,
  type ForgeRepositoryId,
} from "./forge.js";

const get = vi.fn();
const request = vi.fn();

function http(): HttpClient {
  return { get, request } as unknown as HttpClient;
}

function repository() {
  return {
    id: "96a47492-d5e1-4e50-bef2-2f9d1136a326",
    name: "Platform",
    slug: "platform",
    default_branch: "main",
    visibility: "private",
    state: "active",
    clone_ready: true,
    clone_url: "https://forge.miosa.ai/acme/platform.git",
    project_ids: [],
    created_at: "2026-08-14T12:00:00Z",
    updated_at: "2026-08-14T12:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Forge repository contract", () => {
  it("is attached at client.forge without speculative namespaces", () => {
    const client = new Miosa({ apiKey: "msk_test", maxRetries: 0 });
    expect(client.forge).toBeInstanceOf(Forge);
    expect(client.forge.repositories).toBeInstanceOf(ForgeRepositories);
    expect(client.forge).not.toHaveProperty("pullRequests");
    expect(client.forge).not.toHaveProperty("changeRequests");
    expect(client.forge).not.toHaveProperty("checks");
    expect(client.forge).not.toHaveProperty("releases");
  });

  it("creates an organization-owned repository and sends idempotency", async () => {
    request.mockResolvedValue({ data: repository() });

    const created = await new ForgeRepositories(http()).create({
      name: "Platform",
      slug: "platform",
      defaultBranch: "main",
      visibility: "private",
      projectIds: ["project-1"],
      idempotencyKey: "forge-create-1",
    });

    expect(request).toHaveBeenCalledWith("/forge/repositories", {
      method: "POST",
      headers: { "Idempotency-Key": "forge-create-1" },
      body: {
        name: "Platform",
        slug: "platform",
        default_branch: "main",
        visibility: "private",
        project_ids: ["project-1"],
      },
    });
    expect(created.id).toBe(repository().id);
  });

  it("lists, gets, and deletes through verified backend routes", async () => {
    get.mockResolvedValueOnce({ data: [repository()] });
    get.mockResolvedValueOnce({ data: repository() });
    request.mockResolvedValue(new Response(null, { status: 204, headers: { "X-Forge-Operation-Id": repository().id } }));
    const repositories = new ForgeRepositories(http());
    const id = repository().id as ForgeRepositoryId;

    expect(await repositories.list()).toHaveLength(1);
    expect(await repositories.get(id)).toEqual(repository());
    expect(await repositories.delete(id)).toEqual({ operation_id: repository().id, replayed: false });

    expect(get).toHaveBeenNthCalledWith(1, "/forge/repositories");
    expect(get).toHaveBeenNthCalledWith(
      2,
      `/forge/repositories/${repository().id}`,
    );
    expect(request).toHaveBeenCalledWith(
      `/forge/repositories/${repository().id}`,
      {
        method: "DELETE",
        rawResponse: true,
      },
    );
  });

  it("fails closed when the backend response drifts", async () => {
    get.mockResolvedValue({ data: [{ id: "repo-only" }] });
    await expect(new ForgeRepositories(http()).list()).rejects.toBeInstanceOf(
      ForgeContractError,
    );
  });

  it("accepts public repositories published by the canonical backend contract", async () => {
    get.mockResolvedValue({ data: [{ ...repository(), visibility: "public" }] });
    await expect(new ForgeRepositories(http()).list()).resolves.toMatchObject([
      { visibility: "public" },
    ]);
  });

  it("raises a typed error when Forge is disabled", async () => {
    request.mockRejectedValue(
      new MiosaError("not found", 404, "FORGE_DISABLED"),
    );
    await expect(
      new ForgeRepositories(http()).create({ name: "Platform" }),
    ).rejects.toBeInstanceOf(ForgeUnavailableError);
  });

  it("reads refs, trees, blobs, README content, and paginated history", async () => {
    get
      .mockResolvedValueOnce({
        data: {
          default_branch: "main",
          head_oid: "a".repeat(40),
          branches: [{ name: "main", oid: "a".repeat(40), is_default: true }],
          tags: [{ name: "v1.0.0", oid: "b".repeat(40) }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          ref: "main",
          commit_oid: "a".repeat(40),
          path: "lib",
          entries: [{ name: "forge.ts", path: "lib/forge.ts", type: "blob", oid: "c".repeat(40), size: 14 }],
          truncated: false,
        },
      })
      .mockResolvedValueOnce({
        data: {
          ref: "main",
          commit_oid: "a".repeat(40),
          path: "lib/forge.ts",
          oid: "c".repeat(40),
          size: 14,
          encoding: "utf-8",
          content: "export {};\n",
        },
      })
      .mockResolvedValueOnce({
        data: {
          ref: "main",
          commit_oid: "a".repeat(40),
          path: "README.md",
          oid: "d".repeat(40),
          size: 8,
          encoding: "utf-8",
          content: "# Forge\n",
        },
      })
      .mockResolvedValueOnce({
        data: {
          ref: "main",
          path: "lib/forge.ts",
          commits: [{
            oid: "a".repeat(40), short_oid: "aaaaaaa", subject: "Add Forge",
            author_name: "MIOSA", author_email: "forge@miosa.ai",
            authored_at: "2026-08-14T12:00:00Z", committer_name: "MIOSA",
            committed_at: "2026-08-14T12:00:00Z", parents: ["e".repeat(40)],
          }],
          page: { has_more: true, next_cursor: "a".repeat(40) },
        },
      });

    const repositories = new ForgeRepositories(http());
    const id = repository().id as ForgeRepositoryId;

    expect((await repositories.refs(id)).branches[0]?.is_default).toBe(true);
    expect((await repositories.tree(id, { ref: "main", path: "lib" })).entries[0]?.path).toBe("lib/forge.ts");
    expect((await repositories.blob(id, { ref: "main", path: "lib/forge.ts" })).encoding).toBe("utf-8");
    expect((await repositories.readme(id, { ref: "main" })).path).toBe("README.md");
    expect((await repositories.commits(id, { ref: "main", path: "lib/forge.ts", limit: 1 })).page.has_more).toBe(true);

    expect(get).toHaveBeenNthCalledWith(1, `/forge/repositories/${repository().id}/refs`);
    expect(get).toHaveBeenNthCalledWith(2, `/forge/repositories/${repository().id}/tree?ref=main&path=lib`);
    expect(get).toHaveBeenNthCalledWith(3, `/forge/repositories/${repository().id}/blob?ref=main&path=lib%2Fforge.ts`);
    expect(get).toHaveBeenNthCalledWith(4, `/forge/repositories/${repository().id}/readme?ref=main`);
    expect(get).toHaveBeenNthCalledWith(5, `/forge/repositories/${repository().id}/commits?ref=main&path=lib%2Fforge.ts&limit=1`);
  });

  it("fails closed when repository content drifts", async () => {
    get.mockResolvedValueOnce({ data: { branches: "main" } });
    await expect(
      new ForgeRepositories(http()).refs(repository().id as ForgeRepositoryId),
    ).rejects.toBeInstanceOf(ForgeContractError);
  });

  it("reads the verified capability and lifecycle contract", async () => {
    get.mockResolvedValueOnce({ data: {
      api_version: "v1", ownership: "organization", detail_locator: "repository_id",
      lifecycle_states: ["provisioning", "active", "error", "deletion_pending", "deleted"],
      visibility_values: ["public", "private", "internal"], clone_ready_states: ["active"],
      base_url: "https://forge.miosa.ai", features: { git_smart_http: true, repository_tree: true },
    } });
    const capabilities = await new Forge(http()).capabilities();
    expect(capabilities.clone_ready_states).toEqual(["active"]);
    expect(get).toHaveBeenCalledWith("/forge/capabilities");
  });

  it("authors files with optimistic concurrency and replay receipts", async () => {
    request.mockResolvedValueOnce(new Response(JSON.stringify({ data: {
      operation_id: "op-1", repository_id: repository().id, branch: "main", path: "README.md",
      action: "update", previous_head: "a".repeat(40), new_head: "b".repeat(40),
      commit: { oid: "b".repeat(40), short_oid: "bbbbbbb", subject: "Update README", author_name: "Ada", author_email: "ada@example.test", authored_at: "now", committer_name: "MIOSA Forge", committer_email: "forge@miosa.ai", committed_at: "now", signature_status: "unsigned" },
      policy: { decision: "allowed", receipt_ids: ["policy-1"] },
    } }), { headers: { "content-type": "application/json", "idempotency-replayed": "true" } }));
    const receipt = await new ForgeRepositories(http()).putFile(repository().id as ForgeRepositoryId, "README.md", {
      expectedHead: "a".repeat(40), content: "hello", idempotencyKey: "author-1",
    });
    expect(receipt.replayed).toBe(true);
    expect(request).toHaveBeenCalledWith(`/forge/repositories/${repository().id}/files/README.md`, {
      method: "PUT", rawResponse: true, headers: { "Idempotency-Key": "author-1" },
      body: { expected_head: "a".repeat(40), content: "hello" },
    });
  });
});
