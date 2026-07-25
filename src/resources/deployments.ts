/**
 * Deployments resource — sandbox→production publishing surface.
 *
 * Backend phase status:
 *   - list / get / create / update / delete / env: repo deployment surface.
 *   - publish / versions.* / releases.* / rollback / domains.*: live release surface.
 *   - runtimeInstances.*: dynamic runtime status/log inspection.
 *   - publishFromSandbox: direct sandbox -> deployment bridge.
 *
 * See docs/deploy/* for the conceptual model.
 */

import { randomUUID } from "node:crypto";

import type { HttpClient } from "../http.js";
import { DeploymentConnectors } from "./connectors.js";
import type { DockerDeployHostData } from "./docker-deploy.js";

// ── Branded IDs ─────────────────────────────────────────────────────────────

export type DeploymentId = string & { readonly __brand: "DeploymentId" };
export type DeploymentVersionId = string & {
  readonly __brand: "DeploymentVersionId";
};
export type DeploymentReleaseId = string & {
  readonly __brand: "DeploymentReleaseId";
};
export type DeploymentServiceId = string & {
  readonly __brand: "DeploymentServiceId";
};
export type RuntimeInstanceId = string & {
  readonly __brand: "RuntimeInstanceId";
};

// ── States / enums ──────────────────────────────────────────────────────────

export type DeploymentState =
  | "pending"
  | "building"
  | "running"
  | "stopped"
  | "failed";

export type DeploymentVersionKind = "static" | "dynamic" | "sandbox_backed";

export type DeploymentVersionState =
  | "created"
  | "building"
  | "ready"
  | "failed"
  | "archived";

export type DeploymentSourceType = "repo" | "sandbox" | "upload";

export type DeploymentProduct = "miosa_deploy" | "docker_deploy";

export type DeploymentServiceType =
  | "static_web"
  | "web"
  | "api"
  | "function"
  | "worker"
  | "cron"
  | "postgres"
  | "redis"
  | "bucket"
  | "volume";

export type RuntimeInstanceState =
  | "provisioning"
  | "starting"
  | "healthy"
  | "unhealthy"
  | "error"
  | "stopped"
  | "destroyed";

// ── Shared attribution ──────────────────────────────────────────────────────

export interface ExternalAttribution {
  externalWorkspaceId?: string;
  external_workspace_id?: string;
  externalUserId?: string;
  external_user_id?: string;
  externalProjectId?: string;
  external_project_id?: string;
}

// ── Resource shapes ─────────────────────────────────────────────────────────

export interface DeploymentData {
  id: DeploymentId;
  tenant_id: string;
  owner_id?: string;
  workspace_id?: string | null;
  project_id?: string | null;
  name: string;
  slug: string;
  /**
   * @deprecated — repo-based model. New deployments use source_type: "sandbox"
   * with `source_sandbox_id` on the version row. Will become nullable.
   */
  repo_url?: string;
  repo_provider?: "github";
  branch?: string;
  build_command?: string | null;
  run_command?: string | null;
  runtime_image?: string | null;
  current_build_id?: string | null;
  active_version_id?: string | null;
  active_release_id?: string | null;
  running_artifact_sha256?: string | null;
  source_type?: DeploymentSourceType;
  state: DeploymentState;
  auto_deploy?: boolean;
  custom_domain_id?: string | null;
  linked_database_id?: string | null;
  deployment_product?: DeploymentProduct | string | null;
  docker_deploy_host_id?: string | null;
  docker_deploy_app?: {
    id?: string | null;
    deployment_id?: string | null;
    deployment_version_id?: string | null;
    docker_deploy_host_id?: string | null;
    name?: string | null;
    app_id?: string | null;
    container_id?: string | null;
    status?: string | null;
    runtime_ip?: string | null;
    runtime_port?: number | string | null;
    public_url?: string | null;
    last_health_status?: string | null;
    last_error?: string | null;
    last_seen_at?: string | null;
    deployed_at?: string | null;
    stopped_at?: string | null;
  } | null;
  metadata?: Record<string, unknown>;
  external_workspace_id?: string | null;
  external_user_id?: string | null;
  external_project_id?: string | null;
  public_url?: string | null;
  /** Backend-computed default hostname. Prefer public_url as the canonical URL. */
  auto_subdomain?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type DeploymentDatabaseRequest =
  | boolean
  | {
      engine?: "postgresql" | "mysql" | "redis" | "qdrant";
      size?: "xs" | "small" | "medium" | "large";
      storage_mb?: number;
      region?: string;
    };

export interface DeploymentVersionData {
  id: DeploymentVersionId;
  deployment_id: DeploymentId;
  tenant_id: string;
  workspace_id?: string | null;
  project_id?: string | null;
  created_by?: string | null;
  source_sandbox_id?: string | null;
  build_id?: string | null;
  version_number: number;
  kind: DeploymentVersionKind;
  state: DeploymentVersionState;
  artifact_uri?: string | null;
  artifact_manifest?: Record<string, unknown>;
  artifact_sha256?: string | null;
  runtime_image?: string | null;
  runtime_command?: string | null;
  runtime_port?: number | null;
  health_check_path?: string | null;
  build_log_uri?: string | null;
  metadata?: Record<string, unknown>;
  promoted_at?: string | null;
  archived_at?: string | null;
  external_workspace_id?: string | null;
  external_user_id?: string | null;
  external_project_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MigrationBackupData {
  id: string;
  database_id: string;
  state: string;
  backup_type?: string;
  size_bytes?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
}

export interface DeploymentReleaseData {
  id: DeploymentReleaseId;
  deployment_id?: DeploymentId;
  environment_id?: string | null;
  deployment_version_id: DeploymentVersionId;
  service_id?: DeploymentServiceId | null;
  tenant_id: string;
  workspace_id?: string | null;
  project_id?: string | null;
  external_workspace_id?: string | null;
  external_user_id?: string | null;
  external_project_id?: string | null;
  source_sandbox_id?: string | null;
  build_id?: string | null;
  kind: "static" | "oci" | "rootfs" | string;
  state?: string;
  artifact_uri?: string | null;
  artifact_sha256?: string | null;
  artifact_manifest?: Record<string, unknown>;
  storage_backend?: string | null;
  storage_uri?: string;
  sha256?: string;
  size_bytes?: number;
  start_command?: string | null;
  port?: number | null;
  health_check_path?: string | null;
  build_log_uri?: string | null;
  metadata?: Record<string, unknown>;
  ready_at?: string | null;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DeploymentServiceData {
  id: DeploymentServiceId;
  deployment_id: DeploymentId;
  environment_id?: string | null;
  tenant_id: string;
  type: DeploymentServiceType;
  name?: string | null;
  desired_replicas?: number;
  state: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeInstanceData {
  id: RuntimeInstanceId;
  deployment_id?: DeploymentId;
  environment_id?: string | null;
  service_id?: DeploymentServiceId | null;
  release_id?: DeploymentReleaseId;
  tenant_id: string;
  external_workspace_id?: string | null;
  external_user_id?: string | null;
  external_project_id?: string | null;
  host_id?: string | null;
  node_id?: string | null;
  vm_id?: string | null;
  desired_state?: string | null;
  state: RuntimeInstanceState;
  ip_address?: string | null;
  port?: number | null;
  health_check_path?: string | null;
  last_health_check_at?: string | null;
  last_heartbeat_at?: string | null;
  started_at?: string | null;
  stopped_at?: string | null;
  error_message?: string | null;
  restart_count?: number;
  cpu_limit_millicores?: number | null;
  memory_limit_mb?: number | null;
  runtime_log_path?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface DeploymentBuildData {
  id: string;
  deployment_id: DeploymentId;
  commit_sha?: string | null;
  commit_message?: string | null;
  triggered_by?: string;
  state: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  log_url?: string | null;
  image_digest?: string | null;
  error_message?: string | null;
  external_workspace_id?: string | null;
  external_user_id?: string | null;
  external_project_id?: string | null;
  created_at?: string;
}

// ── Request / response payloads ─────────────────────────────────────────────

export interface DeploymentListParams extends ExternalAttribution {
  project_id?: string;
  projectId?: string;
  state?: DeploymentState | string;
  limit?: number;
  cursor?: string;
}

export interface DeploymentCreateParams extends ExternalAttribution {
  name: string;
  /** Current backend create route is repo-backed; project IDs are attribution, not route ownership. */
  project_id?: string;
  projectId?: string;
  /** @deprecated Ignored by the backend create route. Use sandbox.deploy() for sandbox-backed deployments. */
  source_type?: DeploymentSourceType;
  /** @deprecated Ignored by the backend create route. Use sandbox.deploy() for sandbox-backed deployments. */
  sourceType?: DeploymentSourceType;
  repo_url?: string;
  repoUrl?: string;
  branch?: string;
  build_command?: string;
  buildCommand?: string;
  run_command?: string;
  runCommand?: string;
  auto_deploy?: boolean;
  autoDeploy?: boolean;
  database?: DeploymentDatabaseRequest;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface DockerDeployCreateParams extends DeploymentCreateParams {}

export interface DockerDeployDoctorCheck {
  name: string;
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface DockerDeployDoctorProbe {
  url: string;
  ok: boolean;
  status?: number;
  error?: string;
}

export interface DockerDeployDoctorResult {
  ok: boolean;
  deployment: DeploymentData;
  host?: DockerDeployHostData;
  checks: DockerDeployDoctorCheck[];
  probe?: DockerDeployDoctorProbe;
}

export interface DeploymentProofCheck {
  id: string;
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
  recovery?: string[];
}

export interface DeploymentProofProbe {
  url?: string;
  ok: boolean;
  status?: number;
  error?: string;
}

export interface DeploymentProofResult {
  ok: boolean;
  deployment: DeploymentData;
  deployment_product: string | null;
  public_url: string | null;
  checks: DeploymentProofCheck[];
  probe?: DeploymentProofProbe;
  next_actions: string[];
}

export interface DeploymentProofParams {
  probePath?: string;
  probe_path?: string;
  timeoutMs?: number;
  timeout_ms?: number;
  probe?: boolean;
}

export interface DockerDeployDoctorParams {
  probePath?: string;
  probe_path?: string;
  timeoutMs?: number;
  timeout_ms?: number;
}

export interface DeploymentUpdateParams {
  name?: string;
  branch?: string;
  build_command?: string;
  buildCommand?: string;
  run_command?: string;
  runCommand?: string;
  auto_deploy?: boolean;
  autoDeploy?: boolean;
}

export interface PublishParams extends ExternalAttribution {
  sourceSandboxId: string;
  source_sandbox_id?: string;
  name?: string;
  deploymentId?: string;
  deployment_id?: string;
  /** @deprecated Reserved for dynamic runtime publish; ignored by current static publish route. */
  kind?: "auto" | "static" | "dynamic";
  /** @deprecated Reserved for deployment environments; ignored by current static publish route. */
  environment?: "production" | "staging" | string;
  outputPath?: string;
  output_path?: string;
  /** @deprecated Current /deployments/:id/publish snapshots /workspace internally. */
  sourceSnapshotPath?: string;
  /** @deprecated Current /deployments/:id/publish snapshots /workspace internally. */
  source_snapshot_path?: string;
  entrypoint?: string;
  promote?: boolean;
  domain?: string;
  customDomain?: string;
  custom_domain?: string;
  /** @deprecated Reserved for dynamic runtime publish. */
  buildCommand?: string;
  /** @deprecated Reserved for dynamic runtime publish. */
  build_command?: string;
  /** @deprecated Reserved for dynamic runtime publish. */
  runCommand?: string;
  /** @deprecated Reserved for dynamic runtime publish. */
  run_command?: string;
  /** @deprecated Reserved for dynamic runtime publish. */
  port?: number;
  /** @deprecated Reserved for dynamic runtime publish. */
  healthCheckPath?: string;
  /** @deprecated Reserved for dynamic runtime publish. */
  health_check_path?: string;
  /** @deprecated Reserved for managed data-service binding. */
  dataServices?: string[];
  /** @deprecated Reserved for managed data-service binding. */
  data_services?: string[];
  idempotencyKey?: string;
}

export interface PublishResult {
  deployment: DeploymentData;
  version: DeploymentVersionData;
  release?: DeploymentReleaseData;
  services?: DeploymentServiceData[];
  promoted: boolean;
}

export type PublishFromSandboxParams = Omit<
  PublishParams,
  "sourceSandboxId" | "source_sandbox_id"
> & {
  sourceSandboxId?: string;
  source_sandbox_id?: string;
};

export interface RollbackParams {
  versionId?: string;
  version_id?: string;
  idempotencyKey?: string;
}

export interface VersionListParams extends ExternalAttribution {
  state?: DeploymentVersionState | string;
  limit?: number;
  cursor?: string;
}

export interface RuntimeLogsResult {
  runtime_instance_id?: string;
  deployment_id?: string;
  log_path?: string;
  logs: string;
}

export interface AddDomainParams extends ExternalAttribution {
  redirectPolicy?: "none" | "www_to_apex" | "apex_to_www";
  redirect_policy?: "none" | "www_to_apex" | "apex_to_www";
  idempotencyKey?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function attributionBody(p: ExternalAttribution): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const ws = p.externalWorkspaceId ?? p.external_workspace_id;
  const usr = p.externalUserId ?? p.external_user_id;
  const proj = p.externalProjectId ?? p.external_project_id;
  if (ws !== undefined) out.external_workspace_id = ws;
  if (usr !== undefined) out.external_user_id = usr;
  if (proj !== undefined) out.external_project_id = proj;
  return out;
}

function idempotencyKey(key?: string): string {
  return key ?? randomUUID();
}

function unwrap<T>(payload: { data?: T } | T): T {
  if (payload && typeof payload === "object" && "data" in (payload as object)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function listItems<T>(
  payload: { data?: T[] } | { items?: T[] } | T[] | unknown,
  candidateKeys: string[] = ["items", "deployments", "versions", "domains"],
): T[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  if (Array.isArray(p.data)) return p.data as T[];
  for (const key of candidateKeys) {
    if (Array.isArray(p[key])) return p[key] as T[];
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

function dockerDeployMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    deployment_product: "docker_deploy",
  };
}

function dockerDeployProduct(deployment: DeploymentData): unknown {
  return deployment.deployment_product ?? deployment.metadata?.deployment_product;
}

function dockerDeployHostId(deployment: DeploymentData): string | null {
  const metadataHost = deployment.metadata?.docker_deploy_host_id;
  const appHost = dockerDeployApp(deployment)?.docker_deploy_host_id;
  return (
    deployment.docker_deploy_host_id ??
    (typeof metadataHost === "string" ? metadataHost : null) ??
    (typeof appHost === "string" ? appHost : null)
  );
}

function dockerDeployApp(
  deployment: DeploymentData,
): Record<string, unknown> | null {
  if (
    deployment.docker_deploy_app &&
    typeof deployment.docker_deploy_app === "object" &&
    !Array.isArray(deployment.docker_deploy_app)
  ) {
    return deployment.docker_deploy_app;
  }
  const app = deployment.metadata?.docker_deploy;
  if (!app || typeof app !== "object" || Array.isArray(app)) return null;
  return app as Record<string, unknown>;
}

function dockerDeployAppPort(app: Record<string, unknown> | null): number | null {
  const runtimePort = app?.runtime_port;
  if (typeof runtimePort === "number" && Number.isFinite(runtimePort)) return runtimePort;
  if (typeof runtimePort === "string" && /^\d+$/.test(runtimePort)) return Number(runtimePort);

  const url = app?.url;
  if (typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    const port = Number.parseInt(parsed.port, 10);
    return Number.isInteger(port) ? port : null;
  } catch {
    return null;
  }
}

function addDoctorCheck(
  checks: DockerDeployDoctorCheck[],
  name: string,
  ok: boolean,
  message: string,
  details?: Record<string, unknown>,
): void {
  checks.push({ name, ok, message, ...(details ? { details } : {}) });
}

function addProofCheck(
  checks: DeploymentProofCheck[],
  id: string,
  ok: boolean,
  message: string,
  details?: Record<string, unknown>,
  recovery?: string[],
): void {
  checks.push({
    id,
    ok,
    message,
    ...(details ? { details } : {}),
    ...(recovery ? { recovery } : {}),
  });
}

function deploymentPublicUrl(deployment: DeploymentData): string | null {
  const app = dockerDeployApp(deployment);
  const appUrl = app?.public_url;
  if (typeof appUrl === "string" && appUrl) return appUrl;
  return deployment.public_url ?? null;
}

function hostHealthy(host: DockerDeployHostData | undefined): boolean {
  return Boolean(
    host && host.status === "active" && host.appliance_status === "healthy",
  );
}

function probeUrl(publicUrl: string, probePath: string): string {
  const url = new URL(publicUrl);
  url.pathname = probePath.startsWith("/") ? probePath : `/${probePath}`;
  return url.toString();
}

// ── Sub-resources ──────────────────────────────────────────────────────────

export class DeploymentVersions {
  constructor(
    private readonly http: HttpClient,
    private readonly deploymentId: string,
  ) {}

  async list(params: VersionListParams = {}): Promise<DeploymentVersionData[]> {
    const query = stripUndefined({
      state: params.state,
      limit: params.limit,
      cursor: params.cursor,
      ...attributionBody(params),
    });
    const data = await this.http.get<unknown>(
      `/deployments/${this.deploymentId}/versions`,
      query as Record<string, string | number | boolean | undefined>,
    );
    return listItems<DeploymentVersionData>(data);
  }

  async get(versionId: string): Promise<DeploymentVersionData> {
    const data = await this.http.get<unknown>(
      `/deployments/${this.deploymentId}/versions/${versionId}`,
    );
    return unwrap(data) as DeploymentVersionData;
  }

  async promote(
    versionId: string,
    opts: { environment?: string; idempotencyKey?: string } = {},
  ): Promise<DeploymentData> {
    const body = stripUndefined({ environment: opts.environment });
    const data = await this.http.request<unknown>(
      `/deployments/${this.deploymentId}/versions/${versionId}/promote`,
      {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotencyKey(opts.idempotencyKey) },
      },
    );
    return unwrap(data) as DeploymentData;
  }

  async prepareMigrationBackup(versionId: string): Promise<{
    backup: MigrationBackupData;
    version: DeploymentVersionData;
  }> {
    const data = await this.http.request<unknown>(
      `/deployments/${this.deploymentId}/versions/${versionId}/migration-backup`,
      { method: "POST", body: {} },
    );
    return unwrap(data) as { backup: MigrationBackupData; version: DeploymentVersionData };
  }
}

export class DeploymentReleases {
  constructor(
    private readonly http: HttpClient,
    private readonly deploymentId: string,
  ) {}

  async list(): Promise<DeploymentReleaseData[]> {
    const data = await this.http.get<unknown>(
      `/deployments/${this.deploymentId}/releases`,
    );
    return listItems<DeploymentReleaseData>(data, ["releases"]);
  }

  async get(releaseId: string): Promise<DeploymentReleaseData> {
    const data = await this.http.get<unknown>(
      `/deployments/${this.deploymentId}/releases/${releaseId}`,
    );
    return unwrap(data) as DeploymentReleaseData;
  }

  async promote(
    releaseId: string,
    idempotencyKey?: string,
  ): Promise<DeploymentData> {
    const key =
      idempotencyKey ?? `promote:${this.deploymentId}:${releaseId}`;
    const data = await this.http.request<unknown>(
      `/deployments/${this.deploymentId}/releases/${releaseId}/promote`,
      {
        method: "POST",
        body: {},
        headers: { "Idempotency-Key": key },
      },
    );
    return unwrap(data) as DeploymentData;
  }
}

export class DeploymentRuntimeInstances {
  constructor(
    private readonly http: HttpClient,
    private readonly deploymentId: string,
  ) {}

  async list(): Promise<RuntimeInstanceData[]> {
    const data = await this.http.get<unknown>(
      `/deployments/${this.deploymentId}/runtime-instances`,
    );
    return listItems<RuntimeInstanceData>(data, ["runtime_instances"]);
  }

  async get(instanceId: string): Promise<RuntimeInstanceData> {
    const data = await this.http.get<unknown>(
      `/deployments/${this.deploymentId}/runtime-instances/${instanceId}`,
    );
    return unwrap(data) as RuntimeInstanceData;
  }

  async logs(instanceId: string, lines = 100): Promise<RuntimeLogsResult> {
    const data = await this.http.get<unknown>(
      `/deployments/${this.deploymentId}/runtime-instances/${instanceId}/logs`,
      { lines },
    );
    const unwrapped = unwrap(data) as Record<string, unknown>;
    const result: RuntimeLogsResult = { logs: String(unwrapped.logs ?? "") };
    if (typeof unwrapped.runtime_instance_id === "string") {
      result.runtime_instance_id = unwrapped.runtime_instance_id;
    }
    if (typeof unwrapped.deployment_id === "string") {
      result.deployment_id = unwrapped.deployment_id;
    }
    if (typeof unwrapped.log_path === "string") {
      result.log_path = unwrapped.log_path;
    }
    return result;
  }
}

export class DeploymentDomains {
  constructor(
    private readonly http: HttpClient,
    private readonly deploymentId: string,
  ) {}

  async add(
    domain: string,
    params: AddDomainParams = {},
  ): Promise<Record<string, unknown>> {
    const body = {
      domain,
      redirect_policy: params.redirectPolicy ?? params.redirect_policy,
      ...attributionBody(params),
    };
    const data = await this.http.request<unknown>(
      `/deployments/${this.deploymentId}/domains`,
      {
        method: "POST",
        body: stripUndefined(body),
        headers: { "Idempotency-Key": idempotencyKey(params.idempotencyKey) },
      },
    );
    return unwrap(data) as Record<string, unknown>;
  }

  async list(
    filters: ExternalAttribution = {},
  ): Promise<Record<string, unknown>[]> {
    const data = await this.http.get<unknown>(
      `/deployments/${this.deploymentId}/domains`,
      attributionBody(filters) as Record<
        string,
        string | number | boolean | undefined
      >,
    );
    return listItems<Record<string, unknown>>(data);
  }

  async verify(domainId: string): Promise<Record<string, unknown>> {
    const data = await this.http.post<unknown>(
      `/deployments/${this.deploymentId}/domains/${domainId}/verify`,
    );
    return unwrap(data) as Record<string, unknown>;
  }

  async delete(domainId: string): Promise<void> {
    await this.http.delete<unknown>(
      `/deployments/${this.deploymentId}/domains/${domainId}`,
    );
  }
}

// ── Main resource ──────────────────────────────────────────────────────────

export class Deployments {
  constructor(private readonly http: HttpClient) {}

  async list(params: DeploymentListParams = {}): Promise<DeploymentData[]> {
    const projectId = params.projectId ?? params.project_id;
    const query = stripUndefined({
      project_id: projectId,
      state: params.state,
      limit: params.limit,
      cursor: params.cursor,
      ...attributionBody(params),
    });
    const data = await this.http.get<unknown>(
      "/deployments",
      query as Record<string, string | number | boolean | undefined>,
    );
    return listItems<DeploymentData>(data);
  }

  async get(deploymentId: string): Promise<DeploymentData> {
    const data = await this.http.get<unknown>(`/deployments/${deploymentId}`);
    return unwrap(data) as DeploymentData;
  }

  async create(params: DeploymentCreateParams): Promise<DeploymentData> {
    const body = stripUndefined({
      name: params.name,
      repo_url: params.repoUrl ?? params.repo_url,
      branch: params.branch,
      build_command: params.buildCommand ?? params.build_command,
      run_command: params.runCommand ?? params.run_command,
      auto_deploy: params.autoDeploy ?? params.auto_deploy,
      database: params.database,
      metadata: params.metadata,
      ...attributionBody(params),
    });
    const data = await this.http.request<unknown>("/deployments", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey(params.idempotencyKey) },
    });
    return unwrap(data) as DeploymentData;
  }

  /**
   * Create a deployment that runs on the workspace's dedicated App Engine
   * runtime. It uses the same /deployments API as MIOSA Deploy, but marks the
   * deployment so the control plane attaches it to the workspace Docker host.
   */
  async createDockerDeploy(
    params: DockerDeployCreateParams,
  ): Promise<DeploymentData> {
    return this.create({
      ...params,
      metadata: dockerDeployMetadata(params.metadata),
    });
  }

  /**
   * Verify a App Engine deployment before telling a user or agent it is
   * live. Checks product markers, appliance host health, route metadata, and
   * optionally probes the public URL.
   */
  async doctorDockerDeploy(
    deploymentId: string,
    params: DockerDeployDoctorParams = {},
  ): Promise<DockerDeployDoctorResult> {
    const checks: DockerDeployDoctorCheck[] = [];
    const deployment = await this.get(deploymentId);
    const metadata = deployment.metadata ?? {};
    const product = dockerDeployProduct(deployment);
    const hostId = dockerDeployHostId(deployment);

    addDoctorCheck(
      checks,
      "deployment_product",
      product === "docker_deploy",
      product === "docker_deploy"
        ? "Deployment is marked for App Engine."
        : `Expected deployment_product=docker_deploy, got ${String(product ?? "missing")}.`,
      { deployment_product: product ?? null },
    );

    addDoctorCheck(
      checks,
      "docker_deploy_host_id",
      Boolean(hostId),
      hostId
        ? "Deployment has a App Engine host id."
        : "Deployment has no docker_deploy_host_id.",
      { docker_deploy_host_id: hostId },
    );

    let host: DockerDeployHostData | undefined;
    if (hostId) {
      try {
        const rawHost = await this.http.get<unknown>(
          `/docker-deploy/hosts/${hostId}`,
        );
        host = unwrap<DockerDeployHostData>(
          rawHost as DockerDeployHostData | { data?: DockerDeployHostData },
        );
        addDoctorCheck(
          checks,
          "docker_deploy_host_health",
          hostHealthy(host),
          hostHealthy(host)
            ? "App Engine host is active and healthy."
            : `App Engine host status=${host.status} appliance=${host.appliance_status}.`,
          {
            status: host.status,
            appliance_status: host.appliance_status,
          },
        );
      } catch (error) {
        addDoctorCheck(
          checks,
          "docker_deploy_host_health",
          false,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    const app = dockerDeployApp(deployment);
    const appPort = dockerDeployAppPort(app);
    const appRunning = app?.status === "running" && appPort !== null;
    addDoctorCheck(
      checks,
      "docker_deploy_app",
      appRunning,
      appRunning
        ? "App Engine app metadata points at a running container."
        : "Deployment is missing running App Engine app metadata.",
      app
        ? {
            app_id: app.app_id,
            container_id: app.container_id,
            status: app.status,
            url: app.url,
            expected_port: appPort,
          }
        : undefined,
    );

    const runtime = metadata.runtime;
    const runtimeCandidate =
      typeof runtime === "object" && runtime !== null
        ? (runtime as Record<string, unknown>)
        : undefined;
    const appRuntimeIp = app?.runtime_ip;
    const appRuntimePort = app?.runtime_port;
    const appRuntimeCandidate =
      typeof appRuntimeIp === "string" &&
      (typeof appRuntimePort === "number" || typeof appRuntimePort === "string")
        ? { ip: appRuntimeIp, port: Number(appRuntimePort) }
        : undefined;
    const effectiveRuntime = appRuntimeCandidate ?? runtimeCandidate;
    const hasRuntimeRoute =
      typeof effectiveRuntime?.ip === "string" &&
      typeof effectiveRuntime.port === "number" &&
      Number.isFinite(effectiveRuntime.port);
    const runtimeRecord = hasRuntimeRoute
      ? effectiveRuntime
      : undefined;
    const routeMatchesContainerPort =
      hasRuntimeRoute && (appPort === null || runtimeRecord?.port === appPort);
    addDoctorCheck(
      checks,
      "runtime_route",
      hasRuntimeRoute && routeMatchesContainerPort,
      hasRuntimeRoute && routeMatchesContainerPort
        ? "Deployment route points at the Docker container host port."
        : hasRuntimeRoute && appPort !== null
          ? `Deployment route port ${String(runtimeRecord?.port)} does not match Docker container host port ${appPort}.`
          : "Deployment is missing appliance runtime route metadata.",
      runtimeRecord
        ? {
            ...runtimeRecord,
            expected_port: appPort,
            docker_deploy_url: app?.url,
          }
        : undefined,
    );

    let probe: DockerDeployDoctorProbe | undefined;
    const publicUrl = deploymentPublicUrl(deployment);
    const path = params.probePath ?? params.probe_path ?? "/";
    if (publicUrl && typeof fetch === "function") {
      const url = probeUrl(publicUrl, path);
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        params.timeoutMs ?? params.timeout_ms ?? 10_000,
      );
      try {
        const response = await fetch(url, {
          method: "GET",
          signal: controller.signal,
        });
        probe = { url, ok: response.ok, status: response.status };
        addDoctorCheck(
          checks,
          "public_url_probe",
          response.ok,
          `Public URL returned HTTP ${response.status}.`,
          { url, status: response.status },
        );
      } catch (error) {
        probe = {
          url,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
        addDoctorCheck(
          checks,
          "public_url_probe",
          false,
          probe.error ?? "Public URL probe failed.",
          { url },
        );
      } finally {
        clearTimeout(timeout);
      }
    }

    return {
      ok: checks.every((check) => check.ok),
      deployment,
      ...(host ? { host } : {}),
      checks,
      ...(probe ? { probe } : {}),
    };
  }

  async prove(
    deploymentId: string,
    params: DeploymentProofParams = {},
  ): Promise<DeploymentProofResult> {
    const deployment = await this.get(deploymentId);
    const product = dockerDeployProduct(deployment);
    const checks: DeploymentProofCheck[] = [];
    const publicUrl = deploymentPublicUrl(deployment);

    addProofCheck(
      checks,
      "deployment_row",
      true,
      `Deployment ${deployment.id} exists with state=${deployment.state}.`,
      { state: deployment.state },
    );

    addProofCheck(
      checks,
      "deployment_running",
      deployment.state === "running",
      deployment.state === "running"
        ? "Deployment is marked running."
        : `Deployment state is ${deployment.state}, expected running.`,
      { state: deployment.state },
      ["Inspect deployment logs.", "Redeploy the deployment."],
    );

    addProofCheck(
      checks,
      "public_url_present",
      Boolean(publicUrl),
      publicUrl ? `Public URL is ${publicUrl}.` : "Deployment has no public URL.",
      { public_url: publicUrl },
    );

    if (product === "docker_deploy") {
      const app = dockerDeployApp(deployment);
      const appPort = dockerDeployAppPort(app);
      const hostId = dockerDeployHostId(deployment);
      const runtimeIp =
        typeof app?.runtime_ip === "string"
          ? app.runtime_ip
          : typeof deployment.metadata?.runtime === "object" &&
              deployment.metadata.runtime !== null
            ? (deployment.metadata.runtime as Record<string, unknown>).ip
            : null;

      addProofCheck(
        checks,
        "docker_deploy_host_link",
        Boolean(hostId),
        hostId
          ? `Deployment links App Engine host ${hostId}.`
          : "Deployment has no App Engine host id.",
        { docker_deploy_host_id: hostId },
        ["Ensure the workspace App Engine appliance."],
      );

      if (hostId) {
        try {
          const rawHost = await this.http.get<unknown>(
            `/docker-deploy/hosts/${hostId}`,
          );
          const host = unwrap<DockerDeployHostData>(
            rawHost as DockerDeployHostData | { data?: DockerDeployHostData },
          );
          addProofCheck(
            checks,
            "docker_deploy_host_ready",
            hostHealthy(host),
            `Host status=${host.status}, appliance=${host.appliance_status}.`,
            {
              status: host.status,
              appliance_status: host.appliance_status,
            },
            ["Check App Engine host health."],
          );
        } catch (error) {
          addProofCheck(
            checks,
            "docker_deploy_host_ready",
            false,
            error instanceof Error ? error.message : String(error),
            { docker_deploy_host_id: hostId },
          );
        }
      }

      addProofCheck(
        checks,
        "docker_deploy_app_row",
        Boolean(app),
        app
          ? `App Engine app status=${String(app.status ?? "unknown")}.`
          : "App Engine app row is missing.",
        app
          ? {
              app_id: app.app_id,
              container_id: app.container_id,
              status: app.status,
            }
          : undefined,
        ["Publish through App Engine again."],
      );

      addProofCheck(
        checks,
        "docker_deploy_container_route",
        Boolean(
          app &&
            app.status === "running" &&
            typeof app.container_id === "string" &&
            typeof runtimeIp === "string" &&
            appPort !== null,
        ),
        app
          ? `Container=${String(app.container_id ?? "missing")}, route=${String(runtimeIp ?? "missing")}:${String(appPort ?? "missing")}.`
          : "Cannot verify container route without App Engine app row.",
        {
          container_id: app?.container_id ?? null,
          runtime_ip: runtimeIp ?? null,
          runtime_port: appPort,
        },
        ["Run App Engine doctor.", "Check appliance container health."],
      );
    }

    let probe: DeploymentProofProbe | undefined;
    const shouldProbe = params.probe ?? true;
    if (shouldProbe && publicUrl && typeof fetch === "function") {
      const url = probeUrl(publicUrl, params.probePath ?? params.probe_path ?? "/");
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        params.timeoutMs ?? params.timeout_ms ?? 10_000,
      );
      try {
        const response = await fetch(url, {
          method: "GET",
          signal: controller.signal,
        });
        probe = { url, ok: response.ok, status: response.status };
      } catch (error) {
        probe = {
          url,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      } finally {
        clearTimeout(timeout);
      }

      addProofCheck(
        checks,
        "public_url_probe",
        probe.ok,
        probe.ok
          ? `Public URL returned HTTP ${probe.status}.`
          : `Public URL probe failed: ${probe.error ?? `HTTP ${probe.status}`}.`,
        { ...probe },
        ["Check DNS/custom domain routing.", "Check app logs and container health."],
      );
    }

    const nextActions = checks
      .filter((check) => !check.ok)
      .flatMap((check) => check.recovery ?? [])
      .filter((action, index, all) => all.indexOf(action) === index);

    return {
      ok: checks.every((check) => check.ok),
      deployment,
      deployment_product: typeof product === "string" ? product : null,
      public_url: publicUrl,
      checks,
      ...(probe ? { probe } : {}),
      next_actions: nextActions,
    };
  }

  async update(
    deploymentId: string,
    params: DeploymentUpdateParams,
  ): Promise<DeploymentData> {
    const body = stripUndefined({
      name: params.name,
      branch: params.branch,
      build_command: params.buildCommand ?? params.build_command,
      run_command: params.runCommand ?? params.run_command,
      auto_deploy: params.autoDeploy ?? params.auto_deploy,
    });
    const data = await this.http.patch<unknown>(
      `/deployments/${deploymentId}`,
      body,
    );
    return unwrap(data) as DeploymentData;
  }

  async delete(deploymentId: string): Promise<void> {
    await this.http.delete<unknown>(`/deployments/${deploymentId}`);
  }

  async publish(
    deploymentId: string,
    params: PublishParams,
  ): Promise<PublishResult> {
    const body = stripUndefined({
      source_sandbox_id: params.sourceSandboxId ?? params.source_sandbox_id,
      output_path: params.outputPath ?? params.output_path,
      entrypoint: params.entrypoint,
      promote: params.promote,
    });
    const data = await this.http.request<unknown>(
      `/deployments/${deploymentId}/publish`,
      {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotencyKey(params.idempotencyKey) },
      },
    );
    return unwrap(data) as PublishResult;
  }

  /**
   * Backward-compatible bridge: POST /sandboxes/:id/deploy. Works today;
   * returns either release-backed or sandbox-backed depending on backend
   * phase. Prefer `publish()` once Phase 2B/3 lands.
   */
  async publishFromSandbox(
    sandboxId: string,
    params: PublishFromSandboxParams = {},
  ): Promise<Record<string, unknown>> {
    const body = stripUndefined({
      name: params.name,
      deployment_id: params.deploymentId ?? params.deployment_id,
      output_path: params.outputPath ?? params.output_path,
      source_snapshot_path:
        params.sourceSnapshotPath ?? params.source_snapshot_path,
      entrypoint: params.entrypoint,
      domain: params.domain,
      custom_domain: params.customDomain ?? params.custom_domain,
    });
    const data = await this.http.request<unknown>(
      `/sandboxes/${sandboxId}/deploy`,
      {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotencyKey(params.idempotencyKey) },
      },
    );
    return unwrap(data) as Record<string, unknown>;
  }

  async rollback(
    deploymentId: string,
    params: RollbackParams = {},
  ): Promise<DeploymentData> {
    const body = stripUndefined({
      version_id: params.versionId ?? params.version_id,
    });
    const data = await this.http.request<unknown>(
      `/deployments/${deploymentId}/rollback`,
      {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotencyKey(params.idempotencyKey) },
      },
    );
    return unwrap(data) as DeploymentData;
  }

  async listBuilds(deploymentId: string): Promise<DeploymentBuildData[]> {
    const data = await this.http.get<unknown>(
      `/deployments/${deploymentId}/builds`,
    );
    return listItems<DeploymentBuildData>(data);
  }

  async getBuild(
    deploymentId: string,
    buildId: string,
  ): Promise<DeploymentBuildData> {
    const data = await this.http.get<unknown>(
      `/deployments/${deploymentId}/builds/${buildId}`,
    );
    return unwrap(data) as DeploymentBuildData;
  }

  async listEnv(deploymentId: string): Promise<Record<string, unknown>[]> {
    const data = await this.http.get<unknown>(
      `/deployments/${deploymentId}/env`,
    );
    return listItems<Record<string, unknown>>(data);
  }

  async setEnv(
    deploymentId: string,
    vars: Record<string, string>,
    opts: { environment?: string } = {},
  ): Promise<Record<string, unknown>[]> {
    const body = stripUndefined({ env: vars, environment: opts.environment });
    const data = await this.http.post<unknown>(
      `/deployments/${deploymentId}/env`,
      body,
    );
    return listItems<Record<string, unknown>>(data);
  }

  versions(deploymentId: string): DeploymentVersions {
    return new DeploymentVersions(this.http, deploymentId);
  }

  releases(deploymentId: string): DeploymentReleases {
    return new DeploymentReleases(this.http, deploymentId);
  }

  runtimeInstances(deploymentId: string): DeploymentRuntimeInstances {
    return new DeploymentRuntimeInstances(this.http, deploymentId);
  }

  runtime_instances(deploymentId: string): DeploymentRuntimeInstances {
    return this.runtimeInstances(deploymentId);
  }

  domains(deploymentId: string): DeploymentDomains {
    return new DeploymentDomains(this.http, deploymentId);
  }

  connectors(deploymentId: string): DeploymentConnectors {
    return new DeploymentConnectors(this.http, deploymentId);
  }
}
