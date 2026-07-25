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

export type AgentRuntime =
  | "osa"
  | "codex"
  | "claude"
  | "claude-code"
  | "pi"
  | "hermes"
  | "custom";

export type AgentRuntimeConnector =
  | string
  | {
      uid?: string;
      name?: string;
      type?: "mcp" | "api-key" | "api_key" | "oauth" | "custom" | string;
      provider?: string;
      managed?: boolean;
      server_url?: string;
      serverUrl?: string;
      scopes?: string[];
      metadata?: Record<string, unknown>;
      [key: string]: unknown;
    };

export interface AgentRuntimeProfile {
  id: string;
  tenant_id?: string;
  tenantId?: string;
  workspace_id?: string | null;
  workspaceId?: string | null;
  project_id?: string | null;
  projectId?: string | null;
  name: string;
  runtime: AgentRuntime | string;
  description?: string | null;
  applies_to?: Record<string, unknown>;
  appliesTo?: Record<string, unknown>;
  tools?: string[];
  connectors?: AgentRuntimeConnector[];
  env?: Record<string, string>;
  policy?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  is_default?: boolean;
  isDefault?: boolean;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export interface AgentRuntimeProfileParams {
  workspaceId?: string;
  workspace_id?: string;
  projectId?: string;
  project_id?: string;
  name: string;
  runtime: AgentRuntime | string;
  description?: string;
  appliesTo?: Record<string, unknown>;
  applies_to?: Record<string, unknown>;
  tools?: string[];
  connectors?: AgentRuntimeConnector[];
  env?: Record<string, string>;
  policy?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  isDefault?: boolean;
  is_default?: boolean;
}

export type AgentRuntimeProfileUpdateParams =
  Partial<AgentRuntimeProfileParams>;

function body(
  params: AgentRuntimeProfileParams | AgentRuntimeProfileUpdateParams,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      workspace_id: params.workspaceId ?? params.workspace_id,
      project_id: params.projectId ?? params.project_id,
      name: params.name,
      runtime: params.runtime,
      description: params.description,
      applies_to: params.appliesTo ?? params.applies_to,
      tools: params.tools,
      connectors: params.connectors,
      env: params.env,
      policy: params.policy,
      metadata: params.metadata,
      is_default: params.isDefault ?? params.is_default,
    }).filter(([, value]) => value !== undefined),
  );
}

function normalize(profile: AgentRuntimeProfile): AgentRuntimeProfile {
  const normalized: AgentRuntimeProfile = {
    ...profile,
  };
  const tenantId = profile.tenantId ?? profile.tenant_id;
  const workspaceId = profile.workspaceId ?? profile.workspace_id;
  const projectId = profile.projectId ?? profile.project_id;
  const appliesTo = profile.appliesTo ?? profile.applies_to;
  const isDefault = profile.isDefault ?? profile.is_default;
  const createdAt = profile.createdAt ?? profile.created_at;
  const updatedAt = profile.updatedAt ?? profile.updated_at;
  if (tenantId !== undefined) normalized.tenantId = tenantId;
  if (workspaceId !== undefined) normalized.workspaceId = workspaceId;
  if (projectId !== undefined) normalized.projectId = projectId;
  if (appliesTo !== undefined) normalized.appliesTo = appliesTo;
  if (isDefault !== undefined) normalized.isDefault = isDefault;
  if (createdAt !== undefined) normalized.createdAt = createdAt;
  if (updatedAt !== undefined) normalized.updatedAt = updatedAt;
  return normalized;
}

export class AgentRuntimeProfiles {
  constructor(private readonly http: HttpClient) {}

  async list(
    params: {
      workspaceId?: string;
      workspace_id?: string;
      projectId?: string;
      project_id?: string;
    } = {},
  ) {
    const response = await this.http.get<WireEnvelope<AgentRuntimeProfile[]>>(
      "/agent-runtime-profiles",
      {
        workspace_id: params.workspaceId ?? params.workspace_id,
        project_id: params.projectId ?? params.project_id,
      },
    );
    return unwrap(response).map(normalize);
  }

  async get(id: string): Promise<AgentRuntimeProfile> {
    return normalize(
      unwrap(
        await this.http.get<WireEnvelope<AgentRuntimeProfile>>(
          `/agent-runtime-profiles/${encodeURIComponent(id)}`,
        ),
      ),
    );
  }

  async create(
    params: AgentRuntimeProfileParams,
  ): Promise<AgentRuntimeProfile> {
    return normalize(
      unwrap(
        await this.http.post<WireEnvelope<AgentRuntimeProfile>>(
          "/agent-runtime-profiles",
          body(params),
        ),
      ),
    );
  }

  async update(
    id: string,
    params: AgentRuntimeProfileUpdateParams,
  ): Promise<AgentRuntimeProfile> {
    return normalize(
      unwrap(
        await this.http.put<WireEnvelope<AgentRuntimeProfile>>(
          `/agent-runtime-profiles/${encodeURIComponent(id)}`,
          body(params),
        ),
      ),
    );
  }

  async delete(id: string): Promise<void> {
    await this.http.delete<void>(
      `/agent-runtime-profiles/${encodeURIComponent(id)}`,
    );
  }
}
