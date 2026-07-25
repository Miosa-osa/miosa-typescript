/**
 * AppAuth — end-user authentication client for apps deployed on MIOSA.
 *
 * Reads AUTH_URL and AUTH_JWT_SECRET from the process environment at
 * construction time. Both are injected automatically when a sandbox or
 * deployment boots.
 *
 * @example
 * ```ts
 * import { AppAuth } from '@miosa/sdk';
 *
 * const auth = new AppAuth({ resourceType: 'deployment', resourceId: 'dep_abc' });
 *
 * const session = await auth.signup('alice@example.com', 'hunter2');
 * console.log(session.userId, session.token);
 *
 * const verified = await auth.verifyToken(session.token);
 * console.log(verified.sub);
 * ```
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Branded string types for domain safety. */
export type UserId = string & { readonly __brand: "UserId" };
export type AuthToken = string & { readonly __brand: "AuthToken" };

/** Response returned by signup, login, verify, and me. */
export interface AppAuthSession {
  userId: UserId;
  token: AuthToken;
  expiresAt: string;
}

/** Decoded JWT payload returned by verifyToken. */
export interface AppAuthTokenPayload {
  sub: string;
  exp: number;
  iat: number;
  [key: string]: unknown;
}

export type AppAuthResourceType = "sandbox" | "deployment";

export interface AppAuthConfig {
  /** Resource type — "sandbox" or "deployment". */
  resourceType: AppAuthResourceType;
  /** Resource ID (sandbox ID or deployment ID). */
  resourceId: string;
  /**
   * Base URL of the app-auth service. Defaults to the AUTH_URL environment
   * variable, which is injected at boot inside every MIOSA sandbox/deployment.
   */
  authUrl?: string;
  /**
   * HS256 secret for verifyToken(). Defaults to AUTH_JWT_SECRET from env.
   * Only needed if you call verifyToken() server-side.
   */
  jwtSecret?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrapSession(data: unknown): AppAuthSession {
  const d = (
    data && typeof data === "object" && "data" in (data as object)
      ? (data as Record<string, unknown>).data
      : data
  ) as Record<string, unknown>;

  const userId =
    (d.user_id as string | undefined) ?? (d.userId as string | undefined);
  const token =
    (d.token as string | undefined) ?? (d.access_token as string | undefined);
  const expiresAt =
    (d.expires_at as string | undefined) ??
    (d.expiresAt as string | undefined) ??
    "";

  if (!userId || !token) {
    throw new Error(
      `AppAuth: unexpected response shape — got: ${JSON.stringify(d)}`,
    );
  }

  return {
    userId: userId as UserId,
    token: token as AuthToken,
    expiresAt,
  };
}

function base64UrlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

// ── AppAuth client ─────────────────────────────────────────────────────────────

export class AppAuth {
  private readonly baseUrl: string;
  private readonly resourceType: AppAuthResourceType;
  private readonly resourceId: string;
  private readonly jwtSecret: string | undefined;

  constructor(config: AppAuthConfig) {
    const authUrl =
      config.authUrl ??
      (typeof process !== "undefined" ? process.env["AUTH_URL"] : undefined);
    if (!authUrl) {
      throw new Error(
        "AppAuth: authUrl is required. Pass authUrl in config or set AUTH_URL env var.",
      );
    }
    if (!config.resourceType || !config.resourceId) {
      throw new Error("AppAuth: resourceType and resourceId are required.");
    }
    this.baseUrl = authUrl.replace(/\/$/, "");
    this.resourceType = config.resourceType;
    this.resourceId = config.resourceId;
    this.jwtSecret =
      config.jwtSecret ??
      (typeof process !== "undefined"
        ? process.env["AUTH_JWT_SECRET"]
        : undefined);
  }

  /** POST /app-auth/:resourceType/:resourceId/signup */
  async signup(email: string, password: string): Promise<AppAuthSession> {
    return unwrapSession(await this._post("signup", { email, password }));
  }

  /** POST /app-auth/:resourceType/:resourceId/login */
  async login(email: string, password: string): Promise<AppAuthSession> {
    return unwrapSession(await this._post("login", { email, password }));
  }

  /**
   * POST /app-auth/:resourceType/:resourceId/verify
   * Verifies an email confirmation or magic-link token issued by the backend.
   */
  async verify(token: string): Promise<AppAuthSession> {
    return unwrapSession(await this._post("verify", { token }));
  }

  /** POST /app-auth/:resourceType/:resourceId/password-reset */
  async passwordReset(email: string): Promise<{ ok: boolean }> {
    const data = await this._post("password-reset", { email });
    return { ok: true, ...(data as object) };
  }

  /**
   * POST /app-auth/:resourceType/:resourceId/logout
   * Invalidates the given bearer token server-side.
   */
  async logout(token: AuthToken): Promise<{ ok: boolean }> {
    const data = await this._post("logout", { token });
    return { ok: true, ...(data as object) };
  }

  /**
   * GET /app-auth/:resourceType/:resourceId/me
   * Returns the session for the bearer token.
   */
  async me(token: AuthToken): Promise<AppAuthSession> {
    const url = `${this.baseUrl}/app-auth/${this.resourceType}/${this.resourceId}/me`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`AppAuth me failed (${resp.status}): ${body}`);
    }
    return unwrapSession(await resp.json());
  }

  /**
   * Verifies a JWT token locally using HS256 + AUTH_JWT_SECRET.
   *
   * Does NOT make a network call. Throws if the signature is invalid or the
   * token is expired. Returns the decoded payload on success.
   */
  async verifyToken(token: string): Promise<AppAuthTokenPayload> {
    if (!this.jwtSecret) {
      throw new Error(
        "AppAuth.verifyToken: jwtSecret is required. Pass jwtSecret in config or set AUTH_JWT_SECRET env var.",
      );
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("AppAuth.verifyToken: malformed JWT — expected 3 parts");
    }

    const [headerB64, payloadB64, signatureB64] = parts as [
      string,
      string,
      string,
    ];

    // Decode payload first to check expiry before expensive crypto.
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson) as AppAuthTokenPayload;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) {
      throw new Error(
        `AppAuth.verifyToken: token expired at ${new Date(payload.exp * 1000).toISOString()}`,
      );
    }

    // Verify HS256 signature using WebCrypto (available in Node >=18 and all modern browsers).
    const encoder = new TextEncoder();
    const signingInput = `${headerB64}.${payloadB64}`;
    const secretBytes = encoder.encode(this.jwtSecret);

    const key = await crypto.subtle.importKey(
      "raw",
      secretBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signatureBytes = base64UrlDecode(signatureB64).buffer as ArrayBuffer;
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(signingInput),
    );

    if (!valid) {
      throw new Error("AppAuth.verifyToken: invalid JWT signature");
    }

    return payload;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async _post(
    action: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const url = `${this.baseUrl}/app-auth/${this.resourceType}/${this.resourceId}/${action}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`AppAuth ${action} failed (${resp.status}): ${text}`);
    }
    return resp.json();
  }
}
