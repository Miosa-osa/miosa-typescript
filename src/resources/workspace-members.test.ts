import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "../http.js";
import { WorkspaceMembers } from "./workspace-members.js";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();
const mockRequest = vi.fn();

function makeHttp(): HttpClient {
  const http = {} as HttpClient;
  http.get = mockGet;
  http.post = mockPost;
  http.patch = mockPatch;
  http.delete = mockDelete;
  http.request = mockRequest;
  return http;
}

const MEMBER = {
  user_id: "usr_abc",
  email: "alice@example.com",
  name: "Alice",
  avatar_url: null,
  role: "member" as const,
  joined_at: "2026-05-01T10:00:00Z",
  added_by: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WorkspaceMembers", () => {
  describe("list()", () => {
    it("calls GET /workspaces/:id/members and returns array", async () => {
      mockGet.mockResolvedValue({ data: [MEMBER] });
      const resource = new WorkspaceMembers(makeHttp());

      const result = await resource.list("ws-uuid");

      expect(mockGet).toHaveBeenCalledWith("/workspaces/ws-uuid/members");
      expect(result).toHaveLength(1);
      expect(result[0].user_id).toBe("usr_abc");
      expect(result[0].email).toBe("alice@example.com");
      expect(result[0].role).toBe("member");
    });

    it("returns empty array when data is empty", async () => {
      mockGet.mockResolvedValue({ data: [] });
      const resource = new WorkspaceMembers(makeHttp());

      const result = await resource.list("ws-uuid");
      expect(result).toEqual([]);
    });
  });

  describe("add()", () => {
    it("calls POST /workspaces/:id/members with userId and role", async () => {
      const record = {
        user_id: "usr_def",
        workspace_id: "ws-uuid",
        role: "member",
        joined_at: "2026-05-22T09:00:00Z",
        added_by: "usr_abc",
      };
      mockPost.mockResolvedValue({ data: record });
      const resource = new WorkspaceMembers(makeHttp());

      const result = await resource.add("ws-uuid", {
        user_id: "usr_def",
        role: "member",
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/workspaces/ws-uuid/members",
        expect.objectContaining({ user_id: "usr_def", role: "member" }),
      );
      expect(result.user_id).toBe("usr_def");
      expect(result.role).toBe("member");
    });
  });

  describe("updateRole()", () => {
    it("calls PATCH /workspaces/:id/members/:userId with new role", async () => {
      const updated = {
        user_id: "usr_def",
        workspace_id: "ws-uuid",
        role: "admin",
        joined_at: "2026-05-22T09:00:00Z",
        added_by: "usr_abc",
      };
      mockPatch.mockResolvedValue({ data: updated });
      const resource = new WorkspaceMembers(makeHttp());

      const result = await resource.updateRole("ws-uuid", "usr_def", {
        role: "admin",
      });

      expect(mockPatch).toHaveBeenCalledWith(
        "/workspaces/ws-uuid/members/usr_def",
        { role: "admin" },
      );
      expect(result.role).toBe("admin");
    });
  });

  describe("remove()", () => {
    it("calls DELETE /workspaces/:id/members/:userId", async () => {
      mockDelete.mockResolvedValue({ deleted: true });
      const resource = new WorkspaceMembers(makeHttp());

      await resource.remove("ws-uuid", "usr_def");

      expect(mockDelete).toHaveBeenCalledWith(
        "/workspaces/ws-uuid/members/usr_def",
      );
    });
  });
});
