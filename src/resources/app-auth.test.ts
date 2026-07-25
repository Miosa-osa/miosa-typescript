import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppAuth,
  type AppAuthSession,
  type AppAuthTokenPayload,
} from "./app-auth.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_AUTH_URL = "https://auth.example.com";
const TEST_RESOURCE_TYPE = "deployment" as const;
const TEST_RESOURCE_ID = "dep_abc123";
const TEST_JWT_SECRET = "super-secret-key-for-tests";

function makeAuth(
  overrides?: Partial<ConstructorParameters<typeof AppAuth>[0]>,
): AppAuth {
  return new AppAuth({
    authUrl: TEST_AUTH_URL,
    resourceType: TEST_RESOURCE_TYPE,
    resourceId: TEST_RESOURCE_ID,
    jwtSecret: TEST_JWT_SECRET,
    ...overrides,
  });
}

function mockFetchOnce(body: unknown, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const SESSION_RESPONSE = {
  data: {
    user_id: "usr_001",
    token: "tok_abc",
    expires_at: "2099-01-01T00:00:00Z",
  },
};

beforeEach(() => {
  vi.unstubAllGlobals();
});

// ── Construction ──────────────────────────────────────────────────────────────

describe("AppAuth construction", () => {
  it("throws when authUrl is missing and AUTH_URL env is unset", () => {
    const originalEnv = process.env["AUTH_URL"];
    delete process.env["AUTH_URL"];
    expect(
      () =>
        new AppAuth({
          resourceType: "sandbox",
          resourceId: "sb_1",
        }),
    ).toThrow("authUrl is required");
    if (originalEnv !== undefined) process.env["AUTH_URL"] = originalEnv;
  });

  it("throws when resourceType is missing", () => {
    expect(
      () =>
        new AppAuth({
          authUrl: TEST_AUTH_URL,
          resourceType: "" as "sandbox",
          resourceId: "sb_1",
        }),
    ).toThrow("resourceType and resourceId are required");
  });

  it("throws when resourceId is missing", () => {
    expect(
      () =>
        new AppAuth({
          authUrl: TEST_AUTH_URL,
          resourceType: "sandbox",
          resourceId: "",
        }),
    ).toThrow("resourceType and resourceId are required");
  });

  it("reads AUTH_URL from env when not provided in config", () => {
    process.env["AUTH_URL"] = "https://env-auth.example.com";
    expect(
      () =>
        new AppAuth({
          resourceType: "sandbox",
          resourceId: "sb_1",
        }),
    ).not.toThrow();
    delete process.env["AUTH_URL"];
  });
});

// ── signup ────────────────────────────────────────────────────────────────────

describe("AppAuth.signup", () => {
  it("POST to correct URL with email+password", async () => {
    const fetch = mockFetchOnce(SESSION_RESPONSE);
    const auth = makeAuth();

    const session = await auth.signup("alice@example.com", "hunter2");

    expect(fetch).toHaveBeenCalledWith(
      `${TEST_AUTH_URL}/app-auth/${TEST_RESOURCE_TYPE}/${TEST_RESOURCE_ID}/signup`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "alice@example.com",
          password: "hunter2",
        }),
      }),
    );
    expect(session.userId).toBe("usr_001");
    expect(session.token).toBe("tok_abc");
    expect(session.expiresAt).toBe("2099-01-01T00:00:00Z");
  });

  it("throws on non-2xx response", async () => {
    mockFetchOnce({ error: "email taken" }, 422);
    await expect(makeAuth().signup("x@x.com", "pw")).rejects.toThrow("422");
  });
});

// ── login ─────────────────────────────────────────────────────────────────────

describe("AppAuth.login", () => {
  it("POST to correct URL with email+password", async () => {
    const fetch = mockFetchOnce(SESSION_RESPONSE);
    const auth = makeAuth();

    const session = await auth.login("bob@example.com", "secret");

    expect(fetch).toHaveBeenCalledWith(
      `${TEST_AUTH_URL}/app-auth/${TEST_RESOURCE_TYPE}/${TEST_RESOURCE_ID}/login`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(session.userId).toBe("usr_001");
  });

  it("throws on 401", async () => {
    mockFetchOnce({ error: "invalid credentials" }, 401);
    await expect(makeAuth().login("x@x.com", "wrong")).rejects.toThrow("401");
  });
});

// ── verify ────────────────────────────────────────────────────────────────────

describe("AppAuth.verify", () => {
  it("POST to verify endpoint with token body", async () => {
    const fetch = mockFetchOnce(SESSION_RESPONSE);

    await makeAuth().verify("confirm_tok_xyz");

    expect(fetch).toHaveBeenCalledWith(
      `${TEST_AUTH_URL}/app-auth/${TEST_RESOURCE_TYPE}/${TEST_RESOURCE_ID}/verify`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "confirm_tok_xyz" }),
      }),
    );
  });
});

// ── logout ────────────────────────────────────────────────────────────────────

describe("AppAuth.logout", () => {
  it("POST to logout endpoint with bearer token in body", async () => {
    const fetch = mockFetchOnce({ ok: true });

    await makeAuth().logout(
      "tok_abc" as ReturnType<typeof makeAuth>["logout"] extends (
        ...a: infer A
      ) => unknown
        ? A[0]
        : never,
    );

    expect(fetch).toHaveBeenCalledWith(
      `${TEST_AUTH_URL}/app-auth/${TEST_RESOURCE_TYPE}/${TEST_RESOURCE_ID}/logout`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "tok_abc" }),
      }),
    );
  });
});

// ── me ────────────────────────────────────────────────────────────────────────

describe("AppAuth.me", () => {
  it("GET to me endpoint with Authorization header", async () => {
    const fetch = mockFetchOnce(SESSION_RESPONSE);

    const session = await makeAuth().me(
      "tok_bearer" as AppAuthSession["token"],
    );

    expect(fetch).toHaveBeenCalledWith(
      `${TEST_AUTH_URL}/app-auth/${TEST_RESOURCE_TYPE}/${TEST_RESOURCE_ID}/me`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer tok_bearer",
        }),
      }),
    );
    expect(session.userId).toBe("usr_001");
  });
});

// ── passwordReset ─────────────────────────────────────────────────────────────

describe("AppAuth.passwordReset", () => {
  it("POST to password-reset endpoint", async () => {
    const fetch = mockFetchOnce({ ok: true });

    const result = await makeAuth().passwordReset("alice@example.com");

    expect(fetch).toHaveBeenCalledWith(
      `${TEST_AUTH_URL}/app-auth/${TEST_RESOURCE_TYPE}/${TEST_RESOURCE_ID}/password-reset`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "alice@example.com" }),
      }),
    );
    expect(result.ok).toBe(true);
  });
});

// ── verifyToken (HS256 local) ─────────────────────────────────────────────────

describe("AppAuth.verifyToken", () => {
  // Build a real HS256 token using WebCrypto so we don't need an external dep.
  async function signHS256(
    payload: Record<string, unknown>,
    secret: string,
  ): Promise<string> {
    const encoder = new TextEncoder();
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const body = btoa(JSON.stringify(payload))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const signingInput = `${header}.${body}`;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(signingInput),
    );
    const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    return `${signingInput}.${sig}`;
  }

  it("returns decoded payload for a valid token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signHS256(
      { sub: "usr_001", iat: now, exp: now + 3600 },
      TEST_JWT_SECRET,
    );

    const payload = await makeAuth().verifyToken(token);

    expect(payload.sub).toBe("usr_001");
    expect(payload.exp).toBeGreaterThan(now);
  });

  it("throws for an expired token", async () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    const token = await signHS256(
      { sub: "usr_001", iat: past - 3600, exp: past },
      TEST_JWT_SECRET,
    );

    await expect(makeAuth().verifyToken(token)).rejects.toThrow("expired");
  });

  it("throws for a token signed with the wrong secret", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signHS256(
      { sub: "usr_001", iat: now, exp: now + 3600 },
      "wrong-secret",
    );

    await expect(makeAuth().verifyToken(token)).rejects.toThrow(
      "invalid JWT signature",
    );
  });

  it("throws for a malformed token", async () => {
    await expect(makeAuth().verifyToken("not.a.valid")).rejects.toThrow();
  });

  it("throws when jwtSecret is not configured", async () => {
    const auth = makeAuth({ jwtSecret: undefined });
    // Also clear env
    const saved = process.env["AUTH_JWT_SECRET"];
    delete process.env["AUTH_JWT_SECRET"];

    await expect(auth.verifyToken("a.b.c")).rejects.toThrow("jwtSecret");

    if (saved !== undefined) process.env["AUTH_JWT_SECRET"] = saved;
  });
});
