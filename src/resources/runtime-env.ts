import type { HttpClient } from "../http.js";

type WireEnvelope<T> = T | { data: T };

function unwrap<T>(payload: WireEnvelope<T>): T {
  if (
    payload !== null &&
    typeof payload === "object" &&
    "data" in payload &&
    (payload as { data?: unknown }).data !== undefined
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export type RuntimeEnvScope = "tenant" | "workspace" | "project";
export type RuntimeEnvTarget = "all" | "sandbox" | "computer" | "agent" | "deployment";

export interface RuntimeEnvVar {
  id: string;
  tenant_id?: string;
  tenantId?: string;
  scope: RuntimeEnvScope | string;
  workspace_id?: string | null;
  workspaceId?: string | null;
  project_id?: string | null;
  projectId?: string | null;
  target: RuntimeEnvTarget | string;
  name: string;
  preview?: string;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export interface RuntimeEnvListParams {
  scope?: RuntimeEnvScope | string;
  workspaceId?: string;
  workspace_id?: string;
  projectId?: string;
  project_id?: string;
  target?: RuntimeEnvTarget | string;
}

export interface RuntimeEnvSetParams extends RuntimeEnvListParams {
  name: string;
  value: string;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

function body(params: RuntimeEnvSetParams): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      scope: params.scope,
      workspace_id: params.workspaceId ?? params.workspace_id,
      project_id: params.projectId ?? params.project_id,
      target: params.target,
      name: params.name,
      value: params.value,
      enabled: params.enabled,
      metadata: params.metadata,
    }).filter(([, value]) => value !== undefined),
  );
}

function query(params: RuntimeEnvListParams): Record<string, string | undefined> {
  return {
    scope: params.scope,
    workspace_id: params.workspaceId ?? params.workspace_id,
    project_id: params.projectId ?? params.project_id,
    target: params.target,
  };
}

function normalize(row: RuntimeEnvVar): RuntimeEnvVar {
  const tenantId = row.tenantId ?? row.tenant_id;
  const workspaceId = row.workspaceId ?? row.workspace_id;
  const projectId = row.projectId ?? row.project_id;
  const createdAt = row.createdAt ?? row.created_at;
  const updatedAt = row.updatedAt ?? row.updated_at;
  return {
    ...row,
    ...(tenantId !== undefined ? { tenantId } : {}),
    ...(workspaceId !== undefined ? { workspaceId } : {}),
    ...(projectId !== undefined ? { projectId } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {}),
  };
}

export class RuntimeEnv {
  constructor(private readonly http: HttpClient) {}

  async list(params: RuntimeEnvListParams = {}): Promise<RuntimeEnvVar[]> {
    const response = await this.http.get<WireEnvelope<RuntimeEnvVar[]>>(
      "/runtime-env",
      query(params),
    );
    return unwrap(response).map(normalize);
  }

  async get(id: string): Promise<RuntimeEnvVar> {
    return normalize(
      unwrap(
        await this.http.get<WireEnvelope<RuntimeEnvVar>>(
          `/runtime-env/${encodeURIComponent(id)}`,
        ),
      ),
    );
  }

  async set(params: RuntimeEnvSetParams): Promise<RuntimeEnvVar> {
    return normalize(
      unwrap(
        await this.http.post<WireEnvelope<RuntimeEnvVar>>(
          "/runtime-env",
          body(params),
        ),
      ),
    );
  }

  async delete(id: string): Promise<void> {
    await this.http.delete<void>(`/runtime-env/${encodeURIComponent(id)}`);
  }
}
