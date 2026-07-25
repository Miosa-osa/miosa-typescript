import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthError,
  InstallationRequiredError,
  ManagedProviderBindingOnlyError,
  InsufficientCreditsError,
  MiosaError,
  NetworkError,
  NotFoundError,
  ProjectNotLinkedError,
  RateLimitError,
  ScopeNotAllowedError,
  TimeoutError,
  TokenRefreshFailedError,
  UserAuthorizationRequiredError,
} from "./errors.js";
import { HttpClient, isHttp2Available, whenTransportReady } from "./http.js";

// Minimal fetch mock helpers
function mockFetch(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  const responseHeaders = new Headers({
    "content-type": "application/json",
    ...headers,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      headers: responseHeaders,
      json: () => Promise.resolve(body),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      body: null,
    }),
  );
}

function mockFetchError(err: Error): void {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(err));
}

function makeClient(
  overrides: Partial<ConstructorParameters<typeof HttpClient>[0]> = {},
): HttpClient {
  return new HttpClient({
    baseUrl: "https://api.miosa.ai/api/v1",
    apiKey: "msk_test_123",
    timeout: 5_000,
    maxRetries: 0, // no retries in unit tests by default
    ...overrides,
  });
}

describe("HttpClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("successful requests", () => {
    it("should send Authorization header with Bearer token", async () => {
      mockFetch(200, { id: "1" });
      const client = makeClient();
      await client.get("/computers");

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        RequestInit,
      ];
      const headers = init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer msk_test_123");
    });

    it("should send Accept: application/json header", async () => {
      mockFetch(200, {});
      const client = makeClient();
      await client.get("/computers");

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        RequestInit,
      ];
      const headers = init.headers as Record<string, string>;
      expect(headers["Accept"]).toBe("application/json");
    });

    it("should parse and return JSON body on 200", async () => {
      const expected = { id: "abc", name: "test" };
      mockFetch(200, expected);
      const client = makeClient();
      const result = await client.get<typeof expected>("/computers/abc");
      expect(result).toEqual(expected);
    });

    it("should return undefined on 204 No Content", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 204,
          headers: new Headers(),
          json: () => Promise.reject(new Error("no body")),
        }),
      );
      const client = makeClient();
      const result = await client.delete("/computers/abc");
      expect(result).toBeUndefined();
    });

    it("should send JSON body on POST", async () => {
      mockFetch(201, { id: "new" });
      const client = makeClient();
      await client.post("/computers", { name: "my-vm" });

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(init.method).toBe("POST");
      expect(init.body).toBe(JSON.stringify({ name: "my-vm" }));
      const headers = init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("should append query params to GET URL", async () => {
      mockFetch(200, { data: [] });
      const client = makeClient();
      await client.get("/computers", { page: 2, per_page: 10 });

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
      ];
      expect(url).toContain("page=2");
      expect(url).toContain("per_page=10");
    });

    it("should omit undefined query params", async () => {
      mockFetch(200, { data: [] });
      const client = makeClient();
      await client.get("/computers", { page: undefined, per_page: 10 });

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
      ];
      // Match `page=` only as its own param (after `?` or `&`), so
      // `per_page=10` doesn't trip the assertion.
      expect(url).not.toMatch(/[?&]page=/);
      expect(url).toContain("per_page=10");
    });
  });

  describe("error mapping", () => {
    it("should throw AuthError on 401", async () => {
      mockFetch(401, {
        error: { code: "UNAUTHORIZED", message: "Invalid token" },
      });
      const client = makeClient();
      await expect(client.get("/me")).rejects.toBeInstanceOf(AuthError);
    });

    it("should throw AuthError on 403", async () => {
      mockFetch(403, {
        error: { code: "FORBIDDEN", message: "Access denied" },
      });
      const client = makeClient();
      await expect(client.get("/admin")).rejects.toBeInstanceOf(AuthError);
    });

    it("should throw NotFoundError on 404", async () => {
      mockFetch(404, {
        error: { code: "NOT_FOUND", message: "Computer not found" },
      });
      const client = makeClient();
      await expect(client.get("/computers/missing")).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("should throw RateLimitError on 429", async () => {
      mockFetch(429, {
        error: { code: "RATE_LIMITED", message: "Too many requests" },
      });
      const client = makeClient();
      await expect(client.get("/computers")).rejects.toBeInstanceOf(
        RateLimitError,
      );
    });

    it("should throw InsufficientCreditsError on 402", async () => {
      mockFetch(402, {
        error: { code: "INSUFFICIENT_CREDITS", message: "No credits" },
      });
      const client = makeClient();
      await expect(client.post("/computers", {})).rejects.toBeInstanceOf(
        InsufficientCreditsError,
      );
    });

    it("should throw MiosaError with correct status on 500", async () => {
      mockFetch(500, {
        error: { code: "INTERNAL_ERROR", message: "Server error" },
      });
      const client = makeClient();
      const err = await client.get("/computers").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(MiosaError);
      expect((err as MiosaError).status).toBe(500);
    });

    it("should throw typed Connect errors by backend code", async () => {
      mockFetch(403, {
        error: {
          code: "PROJECT_NOT_LINKED",
          message: "Project is not linked to connector",
        },
      });
      const client = makeClient();
      const err = await client.get("/connect/token/github%2Facme").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ProjectNotLinkedError);
      expect((err as MiosaError).code).toBe("PROJECT_NOT_LINKED");
    });

    it("should preserve Connect scope and managed-provider typed errors", async () => {
      mockFetch(403, {
        error: { code: "SCOPE_NOT_ALLOWED", message: "Scope is not allowed" },
      });
      const scopeClient = makeClient();
      await expect(scopeClient.get("/connect/token/github%2Facme")).rejects.toBeInstanceOf(
        ScopeNotAllowedError,
      );

      mockFetch(403, {
        error: {
          code: "MANAGED_PROVIDER_BINDING_ONLY",
          message: "Managed connector cannot return a raw token",
        },
      });
      const managedClient = makeClient();
      await expect(managedClient.get("/connect/token/refero%2Fdesign")).rejects.toBeInstanceOf(
        ManagedProviderBindingOnlyError,
      );
    });

    it("should preserve Connect installation and user authorization typed errors", async () => {
      mockFetch(409, {
        error: {
          code: "INSTALLATION_REQUIRED",
          message: "Connector installation required",
        },
      });
      const installationClient = makeClient();
      await expect(
        installationClient.get("/connect/token/linear%2Fworkspace"),
      ).rejects.toBeInstanceOf(InstallationRequiredError);

      mockFetch(403, {
        error: {
          code: "USER_AUTHORIZATION_REQUIRED",
          message: "User authorization required",
        },
      });
      const userAuthClient = makeClient();
      await expect(userAuthClient.get("/connect/token/linear%2Fworkspace")).rejects.toBeInstanceOf(
        UserAuthorizationRequiredError,
      );
    });

    it("should preserve Connect token refresh typed errors", async () => {
      mockFetch(502, {
        error: {
          code: "TOKEN_REFRESH_FAILED",
          message: "Provider token refresh failed",
        },
      });
      const client = makeClient();
      await expect(client.get("/connect/token/github%2Facme")).rejects.toBeInstanceOf(
        TokenRefreshFailedError,
      );
    });

    it("should include requestId from x-request-id header", async () => {
      mockFetch(
        404,
        { error: { message: "Not found" } },
        { "x-request-id": "req_abc" },
      );
      const client = makeClient();
      const err = await client.get("/missing").catch((e: unknown) => e);
      expect((err as MiosaError).requestId).toBe("req_abc");
    });
  });

  describe("retry logic", () => {
    it("should retry on 429 up to maxRetries and then throw", async () => {
      const mockFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ "retry-after": "0" }),
        json: () => Promise.resolve({ error: { message: "rate limited" } }),
      });
      vi.stubGlobal("fetch", mockFn);

      const client = makeClient({ maxRetries: 2 });

      // Attach the rejection expectation BEFORE advancing fake timers —
      // otherwise the retry loop flushes and rejects during
      // `runAllTimersAsync`, and Vitest flags the rejection as unhandled.
      const promise = client.get("/computers");
      const assertion = expect(promise).rejects.toBeInstanceOf(RateLimitError);
      await vi.runAllTimersAsync();
      await assertion;
      expect(mockFn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it("should retry on 503 and succeed on second attempt", async () => {
      const mockFn = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          headers: new Headers(),
          json: () => Promise.resolve({ error: { message: "unavailable" } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({ id: "recovered" }),
        });
      vi.stubGlobal("fetch", mockFn);

      const client = makeClient({ maxRetries: 2 });
      const promise = client.get<{ id: string }>("/computers");
      await vi.runAllTimersAsync();

      const result = await promise;
      expect(result.id).toBe("recovered");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should not retry on 400 validation errors", async () => {
      const mockFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { message: "bad request" } }),
      });
      vi.stubGlobal("fetch", mockFn);

      const client = makeClient({ maxRetries: 3 });
      await expect(client.post("/computers", {})).rejects.toBeInstanceOf(
        MiosaError,
      );
      expect(mockFn).toHaveBeenCalledTimes(1); // no retries
    });
  });

  describe("network errors", () => {
    it("should throw NetworkError on TypeError (connection refused)", async () => {
      mockFetchError(new TypeError("Failed to fetch"));
      const client = makeClient({ maxRetries: 0 });
      await expect(client.get("/computers")).rejects.toBeInstanceOf(
        NetworkError,
      );
    });

    it("should throw TimeoutError when AbortController fires", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockRejectedValue(
            Object.assign(
              new DOMException("The operation was aborted.", "AbortError"),
              {},
            ),
          ),
      );
      const client = makeClient({ maxRetries: 0 });
      await expect(client.get("/computers")).rejects.toBeInstanceOf(
        TimeoutError,
      );
    });
  });
});

describe("MiosaError", () => {
  it("preserves flat structured errors and body request ids", () => {
    const err = MiosaError.fromResponse(422, {
      error: "EMAIL_MISMATCH",
      detail: "Invite email does not match",
      details: { expected: "a@example.com" },
      request_id: "req_body",
    });
    expect(err.code).toBe("EMAIL_MISMATCH");
    expect(err.message).toBe("Invite email does not match");
    expect(err.details).toEqual({ expected: "a@example.com" });
    expect(err.requestId).toBe("req_body");
  });

  it("should carry status, code, and message", () => {
    const err = new MiosaError("Something broke", 500, "INTERNAL_ERROR", {
      detail: true,
    });
    expect(err.status).toBe(500);
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.message).toBe("Something broke");
    expect(err.details).toEqual({ detail: true });
    expect(err).toBeInstanceOf(Error);
  });

  it("fromResponse should map 401 → AuthError", () => {
    const err = MiosaError.fromResponse(401, {
      error: { message: "Unauthorized" },
    });
    expect(err).toBeInstanceOf(AuthError);
  });

  it("fromResponse should map 404 → NotFoundError", () => {
    const err = MiosaError.fromResponse(404, {
      error: { message: "Not found" },
    });
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.status).toBe(404);
  });

  it("fromResponse should map 429 → RateLimitError", () => {
    const err = MiosaError.fromResponse(429, {});
    expect(err).toBeInstanceOf(RateLimitError);
  });

  it("fromResponse should map 402 → InsufficientCreditsError", () => {
    const err = MiosaError.fromResponse(402, {});
    expect(err).toBeInstanceOf(InsufficientCreditsError);
  });

  it("fromResponse falls back to message key if no error object", () => {
    const err = MiosaError.fromResponse(500, {
      message: "raw message",
      code: "RAW",
    });
    expect(err.message).toBe("raw message");
    expect(err.code).toBe("RAW");
  });
});

describe("transport configuration", () => {
  it("should resolve whenTransportReady() without throwing", async () => {
    // The bootstrap promise must settle whether or not undici was found.
    await expect(whenTransportReady()).resolves.toBeUndefined();
  });

  it("isHttp2Available should return a boolean (no throw)", async () => {
    await whenTransportReady();
    expect(typeof isHttp2Available()).toBe("boolean");
  });
});
