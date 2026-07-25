import { beforeEach, describe, expect, it, vi } from "vitest";
import { Miosa } from "../client.js";
import type { HttpClient } from "../http.js";
import { Organizations } from "./organizations.js";

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();

function http(): HttpClient {
  return { get, post, delete: del } as unknown as HttpClient;
}

beforeEach(() => vi.clearAllMocks());

describe("Organizations", () => {
  it("lists, resolves current, switches, and manages members", async () => {
    get.mockResolvedValueOnce({ data: [{ id: "ten_1", name: "Panther", slug: "panther", role: "admin" }] });
    get.mockResolvedValueOnce({ id: "ten_1", name: "Panther", slug: "panther", branding: {} });
    post.mockResolvedValueOnce({ tenant: { id: "ten_1" }, token: "jwt", refresh_token: "refresh" });
    get.mockResolvedValueOnce({ members: [{ user_id: "usr_1", role: "member" }], total: 1 });
    post.mockResolvedValueOnce({ id: "mem_1", tenant_id: "ten_1", user_id: "usr_2", role: "admin", status: "active" });
    del.mockResolvedValueOnce({ tenant_id: "ten_1", user_id: "usr_2", removed: true });
    const organizations = new Organizations(http());

    expect(await organizations.list()).toHaveLength(1);
    expect((await organizations.current()).branding).toEqual({});
    expect((await organizations.switch("panther/defense")).token).toBe("jwt");
    expect((await organizations.members.list("ten_1")).total).toBe(1);
    expect((await organizations.members.add("ten_1", "usr_2", "admin")).role).toBe("admin");
    expect((await organizations.members.remove("ten_1", "usr_2")).removed).toBe(true);
    expect(post).toHaveBeenCalledWith("/platform/tenants/panther%2Fdefense/switch", {});
  });

  it("sends user auth and X-MIOSA-Tenant", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new Miosa({ accessToken: "user.jwt", tenant: "panther-defense", maxRetries: 0 });
    await client.organizations.list();
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer user.jwt");
    expect(headers["X-MIOSA-Tenant"]).toBe("panther-defense");
    vi.unstubAllGlobals();
  });

  it("exposes the organization invite lifecycle", async () => {
    post.mockResolvedValueOnce({
      data: {
        invite_id: "inv_1",
        email: "partner@example.com",
        role: "member",
        expires_at: "2026-07-21T00:00:00Z",
        invite_url: "https://miosa.ai/invites/token",
      },
    });
    get.mockResolvedValueOnce({
      data: [{ id: "inv_1", email: "partner@example.com", role: "member" }],
      total: 1,
    });
    del.mockResolvedValueOnce({ invite_id: "inv_1", revoked: true });
    const organizations = new Organizations(http());

    expect(
      await organizations.invites.create("ten_1", {
        email: "partner@example.com",
      }),
    ).toMatchObject({ invite_id: "inv_1" });
    expect(await organizations.invites.list("ten_1")).toHaveLength(1);
    expect(await organizations.invites.revoke("ten_1", "inv_1")).toEqual({
      invite_id: "inv_1",
      revoked: true,
    });
    expect(post).toHaveBeenCalledWith("/tenants/ten_1/invites", {
      email: "partner@example.com",
    });
  });

  it("rejects ambiguous credentials", () => {
    expect(() => new Miosa({ apiKey: "msk_test", accessToken: "jwt" })).toThrow("either apiKey or accessToken");
  });
});
