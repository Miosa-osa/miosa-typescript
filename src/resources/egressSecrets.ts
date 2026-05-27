/**
 * Egress secrets — encrypted API key + OAuth credential vault.
 *
 * Backed by:
 *   POST   /api/v1/egress/secrets
 *   GET    /api/v1/egress/secrets
 *   GET    /api/v1/egress/secrets/:id
 *   PATCH  /api/v1/egress/secrets/:id     (rotate)
 *   DELETE /api/v1/egress/secrets/:id
 *
 *   POST   /api/v1/egress/bindings
 *   GET    /api/v1/egress/bindings
 *   DELETE /api/v1/egress/bindings/:id
 *
 *   GET    /api/v1/egress/oauth/providers
 *   POST   /api/v1/egress/oauth/start
 *   GET    /api/v1/egress/oauth/status?state=...
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export type EgressSecretType =
  | "api_key"
  | "oauth_token"
  | "bearer"
  | "basic"
  | "generic";

export type EgressSecretScope =
  | "user"
  | "workspace"
  | "tenant"
  | "external_user"
  | "external_workspace";

export interface EgressSecretData {
  id: string;
  name?: string;
  type?: EgressSecretType | string;
  scope?: EgressSecretScope | string;
  workspace_id?: string | null;
  owner_user_id?: string | null;
  external_user_id?: string | null;
  external_workspace_id?: string | null;
  resource_id?: string | null;
  resource_type?: string | null;
  masked_value?: string | null;
  expires_at?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface EgressBindingData {
  id: string;
  secret_id: string;
  resource_id: string;
  resource_type: string;
  expose_as_env: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface OauthProvider {
  name: string;
  display_name?: string;
  scopes?: string[];
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface SecretSetParams {
  name: string;
  value: string;
  type?: EgressSecretType | string;
  scope?: EgressSecretScope | string;
  exposeAsEnv?: string;
  expose_as_env?: string;
  workspaceId?: string;
  workspace_id?: string;
  ownerUserId?: string;
  owner_user_id?: string;
  externalUserId?: string;
  external_user_id?: string;
  externalWorkspaceId?: string;
  external_workspace_id?: string;
  resourceId?: string;
  resource_id?: string;
  resourceType?: string;
  resource_type?: string;
  refreshToken?: string;
  refresh_token?: string;
  expiresAt?: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
}

export interface SecretListParams {
  scope?: string;
  type?: string;
  workspaceId?: string;
  workspace_id?: string;
  ownerUserId?: string;
  owner_user_id?: string;
  externalUserId?: string;
  external_user_id?: string;
  externalWorkspaceId?: string;
  external_workspace_id?: string;
  resourceId?: string;
  resource_id?: string;
  resourceType?: string;
  resource_type?: string;
}

export interface SecretRotateParams {
  newValue?: string;
  new_value?: string;
  value?: string;
  refreshToken?: string;
  refresh_token?: string;
  expiresAt?: string;
  expires_at?: string;
}

export interface BindingCreateParams {
  secretId?: string;
  secret_id?: string;
  resourceId?: string;
  resource_id?: string;
  resourceType?: string;
  resource_type?: string;
  exposeAsEnv?: string;
  expose_as_env?: string;
}

export interface BindingListParams {
  resourceId?: string;
  resource_id?: string;
  resourceType?: string;
  resource_type?: string;
  secretId?: string;
  secret_id?: string;
}

export interface OauthConnectParams {
  provider: string;
  exposeAsEnv?: string;
  expose_as_env?: string;
  scope?: string;
  ownerUserId?: string;
  owner_user_id?: string;
  externalUserId?: string;
  external_user_id?: string;
  externalWorkspaceId?: string;
  external_workspace_id?: string;
  resourceId?: string;
  resource_id?: string;
  resourceType?: string;
  resource_type?: string;
  redirectUri?: string;
  redirect_uri?: string;
}

export interface OauthStartResult {
  authorize_url: string;
  authorizeUrl?: string;
  state: string;
  provider?: string;
  expires_at?: string;
  [key: string]: unknown;
}

export interface OauthStatusResult {
  status: string;
  state?: string;
  secret_id?: string;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface WireEnvelope<T> {
  data?: T;
  secret?: T;
  binding?: T;
  items?: T;
}

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["data", "secret", "binding", "items"]) {
      if (k in p) return p[k] as T;
    }
  }
  return payload as T;
}

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["data", "secrets", "bindings", "providers", "items"]) {
      if (Array.isArray(p[k])) return p[k] as T[];
    }
  }
  return [];
}

function stripUndefined(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  );
}

function pickFirst<T>(...values: Array<T | undefined>): T | undefined {
  for (const v of values) if (v !== undefined) return v;
  return undefined;
}

function setBody(params: SecretSetParams): Record<string, unknown> {
  return stripUndefined({
    name: params.name,
    value: params.value,
    type: params.type ?? "api_key",
    scope: params.scope ?? "user",
    expose_as_env: pickFirst(params.exposeAsEnv, params.expose_as_env),
    workspace_id: pickFirst(params.workspaceId, params.workspace_id),
    owner_user_id: pickFirst(params.ownerUserId, params.owner_user_id),
    external_user_id: pickFirst(params.externalUserId, params.external_user_id),
    external_workspace_id: pickFirst(
      params.externalWorkspaceId,
      params.external_workspace_id,
    ),
    resource_id: pickFirst(params.resourceId, params.resource_id),
    resource_type: pickFirst(params.resourceType, params.resource_type),
    refresh_token: pickFirst(params.refreshToken, params.refresh_token),
    expires_at: pickFirst(params.expiresAt, params.expires_at),
    metadata: params.metadata,
  });
}

function listQuery(
  params: SecretListParams,
): Record<string, string | number | boolean | undefined> {
  return stripUndefined({
    scope: params.scope,
    type: params.type,
    workspace_id: pickFirst(params.workspaceId, params.workspace_id),
    owner_user_id: pickFirst(params.ownerUserId, params.owner_user_id),
    external_user_id: pickFirst(params.externalUserId, params.external_user_id),
    external_workspace_id: pickFirst(
      params.externalWorkspaceId,
      params.external_workspace_id,
    ),
    resource_id: pickFirst(params.resourceId, params.resource_id),
    resource_type: pickFirst(params.resourceType, params.resource_type),
  }) as Record<string, string | number | boolean | undefined>;
}

function rotateBody(params: SecretRotateParams): Record<string, unknown> {
  return stripUndefined({
    value: pickFirst(params.newValue, params.new_value, params.value),
    refresh_token: pickFirst(params.refreshToken, params.refresh_token),
    expires_at: pickFirst(params.expiresAt, params.expires_at),
  });
}

function bindingBody(params: BindingCreateParams): Record<string, unknown> {
  return stripUndefined({
    secret_id: pickFirst(params.secretId, params.secret_id),
    resource_id: pickFirst(params.resourceId, params.resource_id),
    resource_type: pickFirst(params.resourceType, params.resource_type),
    expose_as_env: pickFirst(params.exposeAsEnv, params.expose_as_env),
  });
}

function bindingQuery(
  params: BindingListParams,
): Record<string, string | number | boolean | undefined> {
  return stripUndefined({
    resource_id: pickFirst(params.resourceId, params.resource_id),
    resource_type: pickFirst(params.resourceType, params.resource_type),
    secret_id: pickFirst(params.secretId, params.secret_id),
  }) as Record<string, string | number | boolean | undefined>;
}

function oauthBody(params: OauthConnectParams): Record<string, unknown> {
  return stripUndefined({
    provider: params.provider,
    expose_as_env: pickFirst(params.exposeAsEnv, params.expose_as_env),
    scope: params.scope,
    owner_user_id: pickFirst(params.ownerUserId, params.owner_user_id),
    external_user_id: pickFirst(params.externalUserId, params.external_user_id),
    external_workspace_id: pickFirst(
      params.externalWorkspaceId,
      params.external_workspace_id,
    ),
    resource_id: pickFirst(params.resourceId, params.resource_id),
    resource_type: pickFirst(params.resourceType, params.resource_type),
    redirect_uri: pickFirst(params.redirectUri, params.redirect_uri),
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── OAuth flow handle ────────────────────────────────────────────────────────

/**
 * A pending OAuth flow.
 *
 * The SDK does NOT auto-open a browser — the caller is responsible for
 * surfacing `authorizeUrl` to the end user. Once the user grants
 * consent, call `waitForCompletion()` to poll the upstream provider
 * status.
 */
export class OAuthFlow {
  readonly authorizeUrl: string;
  readonly state: string;
  readonly provider?: string;
  readonly data: OauthStartResult;
  private readonly http: HttpClient;

  constructor(http: HttpClient, payload: OauthStartResult, provider?: string) {
    this.http = http;
    this.authorizeUrl = payload.authorize_url ?? payload.authorizeUrl ?? "";
    this.state = payload.state ?? "";
    if (provider !== undefined) {
      this.provider = provider;
    }
    this.data = payload;
  }

  /**
   * Poll `GET /egress/oauth/status?state=...` until the flow completes.
   *
   * Returns the status payload once the upstream provider issues
   * tokens. Rejects with a `TimeoutError`-style Error if the flow does
   * not complete within `timeoutSec` seconds, or if the upstream
   * returns a failed status.
   */
  async waitForCompletion(
    options: { timeoutSec?: number; pollIntervalMs?: number } = {},
  ): Promise<OauthStatusResult> {
    const timeoutSec = options.timeoutSec ?? 300;
    const pollMs = options.pollIntervalMs ?? 2000;
    const deadline = Date.now() + timeoutSec * 1000;
    while (Date.now() < deadline) {
      const data = await this.http.get<unknown>("/egress/oauth/status", {
        state: this.state,
      });
      const payload = unwrap<OauthStatusResult>(data) ?? {};
      const status = (payload as OauthStatusResult).status;
      if (
        status === "completed" ||
        status === "ready" ||
        status === "succeeded"
      ) {
        return payload as OauthStatusResult;
      }
      if (status === "failed" || status === "error" || status === "denied") {
        throw new Error(
          `OAuth flow ${this.state} ended in status=${status}: ${
            payload.error ?? payload.message ?? "no detail"
          }`,
        );
      }
      await sleep(pollMs);
    }
    throw new Error(
      `OAuth flow ${this.state} did not complete within ${timeoutSec}s`,
    );
  }
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class EgressSecrets {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Create a secret. When `exposeAsEnv` is provided together with
   * `resourceId` the backend also creates a binding so the value is
   * injected as an env-var on that resource.
   */
  async set(params: SecretSetParams): Promise<EgressSecretData> {
    const data = await this.http.post<WireEnvelope<EgressSecretData>>(
      "/egress/secrets",
      setBody(params),
    );
    return unwrap<EgressSecretData>(data);
  }

  /** List secrets. */
  async list(params: SecretListParams = {}): Promise<EgressSecretData[]> {
    const data = await this.http.get<unknown>(
      "/egress/secrets",
      listQuery(params),
    );
    return unwrapList<EgressSecretData>(data);
  }

  /** Get a single secret by id. */
  async get(id: string): Promise<EgressSecretData> {
    const data = await this.http.get<WireEnvelope<EgressSecretData>>(
      `/egress/secrets/${id}`,
    );
    return unwrap<EgressSecretData>(data);
  }

  /** Rotate the secret's value. */
  async rotate(
    id: string,
    params: SecretRotateParams | string,
  ): Promise<EgressSecretData> {
    const body =
      typeof params === "string"
        ? rotateBody({ newValue: params })
        : rotateBody(params);
    const data = await this.http.patch<WireEnvelope<EgressSecretData>>(
      `/egress/secrets/${id}`,
      body,
    );
    return unwrap<EgressSecretData>(data);
  }

  /** Delete a secret. */
  async delete(id: string): Promise<void> {
    await this.http.delete<unknown>(`/egress/secrets/${id}`);
  }

  // ── bindings ───────────────────────────────────────────────────────────────

  /** Bind a secret to a resource as an env var. */
  async createBinding(params: BindingCreateParams): Promise<EgressBindingData> {
    const data = await this.http.post<WireEnvelope<EgressBindingData>>(
      "/egress/bindings",
      bindingBody(params),
    );
    return unwrap<EgressBindingData>(data);
  }

  /** List secret bindings. */
  async listBindings(
    params: BindingListParams = {},
  ): Promise<EgressBindingData[]> {
    const data = await this.http.get<unknown>(
      "/egress/bindings",
      bindingQuery(params),
    );
    return unwrapList<EgressBindingData>(data);
  }

  /** Delete a binding. */
  async deleteBinding(id: string): Promise<void> {
    await this.http.delete<unknown>(`/egress/bindings/${id}`);
  }

  // ── OAuth Connect ──────────────────────────────────────────────────────────

  /** List OAuth providers visible to the current tenant. */
  async providers(): Promise<OauthProvider[]> {
    const data = await this.http.get<unknown>("/egress/oauth/providers");
    return unwrapList<OauthProvider>(data);
  }

  /**
   * Start an OAuth Connect flow.
   *
   * Returns an {@link OAuthFlow} — the caller must surface
   * `flow.authorizeUrl` to the end user (the SDK does NOT open the
   * browser) and then call `flow.waitForCompletion()` to receive the
   * resulting secret id.
   */
  async connect(params: OauthConnectParams): Promise<OAuthFlow> {
    const data = await this.http.post<WireEnvelope<OauthStartResult>>(
      "/egress/oauth/start",
      oauthBody(params),
    );
    const payload = unwrap<OauthStartResult>(data) ?? ({} as OauthStartResult);
    return new OAuthFlow(this.http, payload, params.provider);
  }
}

// ── Resource-scoped wrappers ─────────────────────────────────────────────────

/**
 * Sandbox-bound view of {@link EgressSecrets}. Pre-scopes
 * `resource_id` + `resource_type="sandbox"` on every call.
 */
export class SandboxSecrets {
  protected readonly resourceType: string = "sandbox";
  private readonly delegate: EgressSecrets;

  constructor(
    http: HttpClient,
    protected readonly resourceId: string,
  ) {
    this.delegate = new EgressSecrets(http);
  }

  private resolvedResourceId(params: {
    resourceId?: string;
    resource_id?: string;
  }): string {
    return params.resourceId ?? params.resource_id ?? this.resourceId;
  }

  private resolvedResourceType(params: {
    resourceType?: string;
    resource_type?: string;
  }): string {
    return params.resourceType ?? params.resource_type ?? this.resourceType;
  }

  set(params: SecretSetParams): Promise<EgressSecretData> {
    return this.delegate.set({
      ...params,
      resource_id: this.resolvedResourceId(params),
      resource_type: this.resolvedResourceType(params),
    });
  }

  list(params: SecretListParams = {}): Promise<EgressSecretData[]> {
    return this.delegate.list({
      ...params,
      resource_id: this.resolvedResourceId(params),
      resource_type: this.resolvedResourceType(params),
    });
  }

  get(id: string): Promise<EgressSecretData> {
    return this.delegate.get(id);
  }

  rotate(
    id: string,
    params: SecretRotateParams | string,
  ): Promise<EgressSecretData> {
    return this.delegate.rotate(id, params);
  }

  delete(id: string): Promise<void> {
    return this.delegate.delete(id);
  }

  connect(params: OauthConnectParams): Promise<OAuthFlow> {
    return this.delegate.connect({
      ...params,
      resource_id: this.resolvedResourceId(params),
      resource_type: this.resolvedResourceType(params),
    });
  }

  listBindings(params: BindingListParams = {}): Promise<EgressBindingData[]> {
    return this.delegate.listBindings({
      ...params,
      resource_id: this.resolvedResourceId(params),
      resource_type: this.resolvedResourceType(params),
    });
  }
}

/** Computer-bound secrets — same shape, `resource_type="computer"`. */
export class ComputerSecrets extends SandboxSecrets {
  protected readonly resourceType: string = "computer";
}
