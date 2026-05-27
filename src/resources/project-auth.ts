/**
 * Project auth — built-in auth for sandboxes and deployments.
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface ProjectAuthStatus {
  enabled?: boolean;
  state?: string;
  database_id?: string | null;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export type ProjectAuthResourceType = "sandbox" | "deployment";

export interface ProjectAuthResourceParams {
  resourceType?: ProjectAuthResourceType;
  resource_type?: ProjectAuthResourceType;
  resourceId?: string;
  resource_id?: string;
}

export interface ProjectAuthEnableParams extends ProjectAuthResourceParams {
  signupEnabled?: boolean;
  signup_enabled?: boolean;
  emailConfirmRequired?: boolean;
  email_confirm_required?: boolean;
  tokenExpirySec?: number;
  token_expiry_sec?: number;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ProjectAuthUpdateParams extends ProjectAuthEnableParams {}

export interface ProjectAuthDisableParams extends ProjectAuthResourceParams {
  [key: string]: unknown;
}

export interface ProjectAuthStatusParams extends ProjectAuthResourceParams {
  [key: string]: unknown;
}

function resourcePayload(params: ProjectAuthResourceParams): {
  resource_type: ProjectAuthResourceType;
  resource_id: string;
} {
  const resource_type = params.resource_type ?? params.resourceType;
  const resource_id = params.resource_id ?? params.resourceId;

  if (!resource_type || !resource_id) {
    throw new Error("project auth requires resourceType/resourceId");
  }

  return { resource_type, resource_id };
}

function authConfig(params: ProjectAuthEnableParams): Record<string, unknown> {
  return stripUndefined({
    ...(params.config ?? {}),
    signup_enabled: params.signup_enabled ?? params.signupEnabled,
    email_confirm_required:
      params.email_confirm_required ?? params.emailConfirmRequired,
    token_expiry_sec: params.token_expiry_sec ?? params.tokenExpirySec,
  });
}

function requestBody(params: ProjectAuthEnableParams): Record<string, unknown> {
  return stripUndefined({
    ...resourcePayload(params),
    config: authConfig(params),
  });
}

export interface ProjectAuthLegacyParams {
  provider?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["data", "project_auth", "config", "items"]) {
      if (k in p) return p[k] as T;
    }
  }
  return payload as T;
}

function stripUndefined(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  );
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class ProjectAuth {
  constructor(private readonly http: HttpClient) {}

  /** Get the current project-auth status and config. */
  async status(params: ProjectAuthStatusParams): Promise<ProjectAuthStatus> {
    const data = await this.http.get<unknown>(
      "/project-auth/status",
      resourcePayload(params),
    );
    return unwrap<ProjectAuthStatus>(data);
  }

  /** Enable project auth. */
  async enable(params: ProjectAuthEnableParams): Promise<ProjectAuthStatus> {
    const body = requestBody(params);
    const data = await this.http.post<unknown>("/project-auth/enable", body);
    return unwrap<ProjectAuthStatus>(data);
  }

  /** Disable project auth. */
  async disable(params: ProjectAuthDisableParams): Promise<ProjectAuthStatus> {
    const data = await this.http.post<unknown>(
      "/project-auth/disable",
      resourcePayload(params),
    );
    return unwrap<ProjectAuthStatus>(data);
  }

  /** Update project-auth configuration. */
  async update(params: ProjectAuthUpdateParams): Promise<ProjectAuthStatus> {
    const body = requestBody(params);
    const data = await this.http.patch<unknown>("/project-auth/config", body);
    return unwrap<ProjectAuthStatus>(data);
  }
}
