import type { HttpClient } from "../http.js";

export interface AgentVersionData {
  id: string;
  agent_definition_id: string;
  version: number;
  fingerprint: string;
  configuration: Record<string, unknown>;
  published_by_user_id?: string | null;
  published_at: string;
}

export interface AgentDefinitionData {
  id: string;
  tenant_id: string;
  workspace_id: string;
  project_id?: string | null;
  name: string;
  description?: string | null;
  status: "active" | "archived" | string;
  metadata: Record<string, unknown>;
  latest_version: AgentVersionData;
  versions?: AgentVersionData[];
  created_at: string;
  updated_at: string;
}

export interface AgentDefinitionListParams {
  workspaceId?: string;
  workspace_id?: string;
  projectId?: string;
  project_id?: string;
  status?: "active" | "archived" | "all" | string;
}

export interface AgentDefinitionCreateParams {
  workspaceId?: string;
  workspace_id?: string;
  projectId?: string;
  project_id?: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  configuration: Record<string, unknown>;
}

export interface AgentDefinitionUpdateParams {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

function unwrap<T>(payload: T | { data: T }): T {
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

export class AgentDefinitions {
  constructor(private readonly http: HttpClient) {}

  async list(
    params: AgentDefinitionListParams = {},
  ): Promise<AgentDefinitionData[]> {
    return unwrap(
      await this.http.get<
        AgentDefinitionData[] | { data: AgentDefinitionData[] }
      >("/agents", {
        workspace_id: params.workspaceId ?? params.workspace_id,
        project_id: params.projectId ?? params.project_id,
        status: params.status,
      }),
    );
  }

  async get(id: string): Promise<AgentDefinitionData> {
    return unwrap(
      await this.http.get<AgentDefinitionData | { data: AgentDefinitionData }>(
        `/agents/${encodeURIComponent(id)}`,
      ),
    );
  }

  async create(
    params: AgentDefinitionCreateParams,
  ): Promise<AgentDefinitionData> {
    return unwrap(
      await this.http.post<AgentDefinitionData | { data: AgentDefinitionData }>(
        "/agents",
        {
          workspace_id: params.workspaceId ?? params.workspace_id,
          project_id: params.projectId ?? params.project_id,
          name: params.name,
          description: params.description,
          metadata: params.metadata,
          configuration: params.configuration,
        },
      ),
    );
  }

  async update(
    id: string,
    params: AgentDefinitionUpdateParams,
  ): Promise<AgentDefinitionData> {
    return unwrap(
      await this.http.patch<
        AgentDefinitionData | { data: AgentDefinitionData }
      >(`/agents/${encodeURIComponent(id)}`, params),
    );
  }

  async publish(
    id: string,
    configuration: Record<string, unknown>,
  ): Promise<AgentVersionData> {
    return unwrap(
      await this.http.post<AgentVersionData | { data: AgentVersionData }>(
        `/agents/${encodeURIComponent(id)}/versions`,
        { configuration },
      ),
    );
  }

  async archive(id: string): Promise<void> {
    await this.http.delete(`/agents/${encodeURIComponent(id)}`);
  }
}
