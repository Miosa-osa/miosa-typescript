import * as crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../http.js";
import { Sandbox } from "./sandboxes.js";
import { Tenant } from "./tenant.js";
import { verifySignature, Webhooks } from "./webhooks.js";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();
const mockRequest = vi.fn();

function makeHttp(): HttpClient {
  return {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    patch: mockPatch,
    delete: mockDelete,
    request: mockRequest,
  } as unknown as HttpClient;
}

function sandboxData(overrides: Record<string, unknown> = {}) {
  return {
    id: "sbx_123",
    state: "running",
    ready: true,
    template_id: "miosa-sandbox",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ── tenant.preview_domain ────────────────────────────────────────────────────

describe("tenant.preview_domain", () => {
  it("get calls GET /tenant/preview-domain", async () => {
    mockGet.mockResolvedValue({
      preview_domain: "preview.acme.com",
      verified_at: null,
    });
    const tenant = new Tenant(makeHttp());
    const result = await tenant.preview_domain.get();
    expect(mockGet).toHaveBeenCalledWith("/tenant/preview-domain");
    expect(result.preview_domain).toBe("preview.acme.com");
  });

  it("set calls PUT /tenant/preview-domain", async () => {
    mockPut.mockResolvedValue({ preview_domain: "preview.acme.com" });
    const tenant = new Tenant(makeHttp());
    await tenant.preview_domain.set("preview.acme.com");
    expect(mockPut).toHaveBeenCalledWith("/tenant/preview-domain", {
      preview_domain: "preview.acme.com",
    });
  });

  it("verify calls POST /tenant/preview-domain/verify", async () => {
    mockPost.mockResolvedValue({
      verified: true,
      target: "proxy.miosa.app",
      records: [],
    });
    const tenant = new Tenant(makeHttp());
    const result = await tenant.preview_domain.verify();
    expect(mockPost).toHaveBeenCalledWith("/tenant/preview-domain/verify", {});
    expect(result.verified).toBe(true);
  });

  it("delete calls DELETE /tenant/preview-domain", async () => {
    mockDelete.mockResolvedValue(undefined);
    const tenant = new Tenant(makeHttp());
    await tenant.preview_domain.delete();
    expect(mockDelete).toHaveBeenCalledWith("/tenant/preview-domain");
  });
});

// ── tenant.branding ──────────────────────────────────────────────────────────

describe("tenant.branding", () => {
  it("get calls GET /tenant/branding", async () => {
    mockGet.mockResolvedValue({ product_name: "Acme AI" });
    const tenant = new Tenant(makeHttp());
    const result = await tenant.branding.get();
    expect(result.product_name).toBe("Acme AI");
  });

  it("set calls PUT /tenant/branding", async () => {
    const branding = { product_name: "Acme", primary_color: "#ff0000" };
    mockPut.mockResolvedValue(branding);
    const tenant = new Tenant(makeHttp());
    await tenant.branding.set(branding);
    expect(mockPut).toHaveBeenCalledWith("/tenant/branding", { branding });
  });
});

// ── sandbox.update ───────────────────────────────────────────────────────────

describe("sandbox.update", () => {
  it("calls PATCH /sandboxes/{id} with body", async () => {
    const updated = sandboxData({ name: "renamed" });
    mockPatch.mockResolvedValue({ data: updated });
    const sbx = new Sandbox(makeHttp(), sandboxData());
    await sbx.update({ name: "renamed", slug: "my-slug" });
    expect(mockPatch).toHaveBeenCalledWith("/sandboxes/sbx_123", {
      name: "renamed",
      slug: "my-slug",
    });
  });

  it("only sends defined fields", async () => {
    mockPatch.mockResolvedValue({ data: sandboxData() });
    const sbx = new Sandbox(makeHttp(), sandboxData());
    await sbx.update({ always_on: true });
    expect(mockPatch).toHaveBeenCalledWith("/sandboxes/sbx_123", {
      always_on: true,
    });
  });
});

// ── sandbox.previewToken ─────────────────────────────────────────────────────

describe("sandbox.previewToken", () => {
  it("calls POST /sandboxes/{id}/preview-token", async () => {
    const tokenResp = {
      token: "tok_xyz",
      url: "https://preview.miosa.app?t=tok_xyz",
      expires_at: "2026-05-26T01:00:00Z",
      scope: "read",
    };
    mockPost.mockResolvedValue(tokenResp);
    const sbx = new Sandbox(makeHttp(), sandboxData());
    const result = await sbx.previewToken(3600, "read");
    expect(mockPost).toHaveBeenCalledWith("/sandboxes/sbx_123/preview-token", {
      expires_in: 3600,
      scope: "read",
    });
    expect(result.token).toBe("tok_xyz");
  });
});

// ── verifySignature ──────────────────────────────────────────────────────────

function makeHeader(payload: Buffer, secret: string, ts?: number): string {
  const t = ts ?? Math.floor(Date.now() / 1000);
  const signed = Buffer.concat([Buffer.from(`${t}.`), payload]);
  const sig = crypto.createHmac("sha256", secret).update(signed).digest("hex");
  return `t=${t},v1=${sig}`;
}

describe("verifySignature", () => {
  it("returns true for a valid signature", () => {
    const payload = Buffer.from('{"event":"sandbox.created"}');
    const header = makeHeader(payload, "secret123");
    expect(verifySignature(payload, header, "secret123")).toBe(true);
  });

  it("returns false for wrong secret", () => {
    const payload = Buffer.from('{"event":"sandbox.created"}');
    const header = makeHeader(payload, "secret123");
    expect(verifySignature(payload, header, "wrongsecret")).toBe(false);
  });

  it("throws for old timestamp", () => {
    const payload = Buffer.from("body");
    const old = Math.floor(Date.now() / 1000) - 400;
    const header = makeHeader(payload, "s3cr3t", old);
    expect(() => verifySignature(payload, header, "s3cr3t")).toThrow("too old");
  });

  it("returns false for malformed header", () => {
    expect(verifySignature(Buffer.from("body"), "malformed", "secret")).toBe(
      false,
    );
  });

  it("Webhooks.verifySignature delegates to module function", () => {
    const payload = Buffer.from("body");
    const header = makeHeader(payload, "secret");
    expect(Webhooks.verifySignature(payload, header, "secret")).toBe(true);
  });
});
