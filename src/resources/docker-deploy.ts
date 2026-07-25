import type { HttpClient } from "../http.js";

export type DockerDeployHostId = string & {
  readonly __brand: "DockerDeployHostId";
};

export type DockerDeployHostStatus =
  | "pending"
  | "provisioning"
  | "bootstrapping"
  | "active"
  | "degraded"
  | "suspended"
  | "retired"
  | "error";

export type DockerDeployApplianceStatus =
  | "not_installed"
  | "installing"
  | "starting"
  | "healthy"
  | "unhealthy"
  | "unknown";

export interface DockerDeployHostData {
  id: DockerDeployHostId;
  tenant_id: string;
  workspace_id: string;
  external_workspace_id?: string | null;
  computer_id?: string | null;
  fleet_node_id?: string | null;
  status: DockerDeployHostStatus;
  size: string;
  region: string;
  portal_domain?: string | null;
  runtime_base_url?: string | null;
  agent_base_url?: string | null;
  appliance_image?: string | null;
  appliance_version?: string | null;
  appliance_status: DockerDeployApplianceStatus;
  agent_last_seen_at?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface DockerDeployHostListParams {
  workspace_id?: string;
  workspaceId?: string;
}

export interface DockerDeployHostEnsureParams {
  workspace_id?: string;
  workspaceId?: string;
  external_workspace_id?: string;
  externalWorkspaceId?: string;
}

export interface DockerDeployHostListResponse {
  data?: DockerDeployHostData[];
  hosts?: DockerDeployHostData[];
}

export interface DockerDeployHostResponse {
  data?: DockerDeployHostData;
  host?: DockerDeployHostData;
  queued?: boolean;
}

export interface DockerDeployTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  runtime?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DockerDeployTemplateListResponse {
  data?: DockerDeployTemplate[];
  templates?: DockerDeployTemplate[];
}

export interface DockerDeployTemplateResponse {
  data?: DockerDeployTemplate;
  template?: DockerDeployTemplate;
}

function workspaceId(params?: DockerDeployHostListParams): string | undefined {
  return params?.workspace_id ?? params?.workspaceId;
}

function ensureBody(params: DockerDeployHostEnsureParams): Record<string, string> {
  const body: Record<string, string> = {};
  const id = params.workspace_id ?? params.workspaceId;
  const externalId = params.external_workspace_id ?? params.externalWorkspaceId;
  if (id) body.workspace_id = id;
  if (externalId) body.external_workspace_id = externalId;
  return body;
}

function unwrapHost(response: DockerDeployHostResponse): DockerDeployHostData {
  const host = response.data ?? response.host;
  if (!host) {
    throw new Error("App Engine host response was empty.");
  }
  return host;
}

function unwrapTemplates(response: DockerDeployTemplateListResponse): DockerDeployTemplate[] {
  return response.data ?? response.templates ?? [];
}

function unwrapTemplate(response: DockerDeployTemplateResponse): DockerDeployTemplate {
  const template = response.data ?? response.template;
  if (!template) {
    throw new Error("App Engine template response was empty.");
  }
  return template;
}

export class DockerDeploy {
  constructor(private readonly http: HttpClient) {}

  /**
   * List App Engine appliance hosts scoped to the current tenant.
   *
   * Pass a workspace ID to inspect the dedicated always-on appliance machine
   * for one white-label workspace.
   */
  async listHosts(
    params: DockerDeployHostListParams = {},
  ): Promise<DockerDeployHostData[]> {
    const res = await this.http.get<DockerDeployHostListResponse>(
      "/docker-deploy/hosts",
      { workspace_id: workspaceId(params) },
    );
    return res.data ?? res.hosts ?? [];
  }

  /**
   * Ensure a workspace has its dedicated App Engine appliance host.
   *
   * The host may still be `pending`, `provisioning`, or `bootstrapping` after
   * this call. Treat `status === "active"` and `appliance_status === "healthy"`
   * as the ready condition before sending app/container traffic to it.
   */
  async ensureHost(
    params: DockerDeployHostEnsureParams = {},
  ): Promise<{ host: DockerDeployHostData; queued: boolean }> {
    const res = await this.http.post<DockerDeployHostResponse>(
      "/docker-deploy/hosts/ensure",
      ensureBody(params),
    );
    return { host: unwrapHost(res), queued: res.queued ?? false };
  }

  /** Fetch one App Engine host by ID. */
  async getHost(hostId: string): Promise<DockerDeployHostData> {
    const res = await this.http.get<DockerDeployHostResponse>(
      `/docker-deploy/hosts/${hostId}`,
    );
    return unwrapHost(res);
  }

  /** List App Engine starter templates. */
  async listTemplates(): Promise<DockerDeployTemplate[]> {
    const res = await this.http.get<DockerDeployTemplateListResponse>(
      "/docker-deploy/templates",
    );
    return unwrapTemplates(res);
  }

  /** Fetch one App Engine starter template by ID. */
  async getTemplate(templateId: string): Promise<DockerDeployTemplate> {
    const res = await this.http.get<DockerDeployTemplateResponse>(
      `/docker-deploy/templates/${encodeURIComponent(templateId)}`,
    );
    return unwrapTemplate(res);
  }
}
