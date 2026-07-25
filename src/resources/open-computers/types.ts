// ─── OpenComputers shared types ──────────────────────────────────────────────

export type HostId = string & { readonly __brand: "HostId" };
export type JobId = string & { readonly __brand: "JobId" };
export type TunnelId = string & { readonly __brand: "TunnelId" };
export type ClusterId = string & { readonly __brand: "ClusterId" };
export type WorkspaceId = string & { readonly __brand: "WorkspaceId" };
export type SecretId = string & { readonly __brand: "SecretId" };

// ─── Hosts ───────────────────────────────────────────────────────────────────

export type HostStatus = "pending" | "online" | "offline" | "error" | "revoked";

export interface HostData {
  id: HostId;
  name: string;
  region: string | null;
  status: HostStatus;
  tenant_id: string;
  labels: Record<string, string>;
  /** Present only on create response — treat as write-once. */
  host_key?: string;
  created_at: string;
  updated_at: string;
}

export interface HostCreateParams {
  name: string;
  region?: string;
  labels?: Record<string, string>;
}

export interface HostUpdateParams {
  name?: string;
  labels?: Record<string, string>;
}

export interface HostListResponse {
  data: HostData[];
  meta: { total: number; page: number; per_page: number };
}

export interface HostEvent {
  type: "host_connected" | "host_disconnected" | "host_error" | string;
  host_id: HostId;
  data: unknown;
  timestamp: string;
}

// ─── Jobs (exec on host) ─────────────────────────────────────────────────────

export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface JobData {
  id: JobId;
  host_id: HostId;
  status: JobStatus;
  command: string;
  args: string[];
  env: string[];
  cwd: string | null;
  exit_code: number | null;
  stdout: string | null;
  stderr: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface JobRunParams {
  command: string;
  args?: string[];
  env?: string[];
  cwd?: string;
  timeout?: number;
}

export interface JobListResponse {
  data: JobData[];
  meta: { total: number; page: number; per_page: number };
}

export type JobEventType =
  | "stdout"
  | "stderr"
  | "exit"
  | "error"
  | "started"
  | "done";

export interface JobEvent {
  type: JobEventType;
  job_id: JobId;
  data: string | number | null;
  timestamp: string;
}

// ─── File system ─────────────────────────────────────────────────────────────

export interface FsEntry {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
  modified_at: string;
}

export interface FsStat {
  path: string;
  size: number;
  mode: number;
  is_dir: boolean;
  is_symlink: boolean;
  symlink_target?: string;
  modified_at: string;
}

export interface FsListResponse {
  entries: FsEntry[];
  path: string;
}

// ─── Terminal / Desktop tickets ───────────────────────────────────────────────

export interface WsTicket {
  /** Short-lived JWT for WS authentication. */
  ticket: string;
  /** Fully-qualified WS URL to connect to. */
  ws_url: string;
  expires_at: string;
}

// ─── Tunnels ─────────────────────────────────────────────────────────────────

export type TunnelAuthMode = "public" | "tenant_only" | "password";

export interface TunnelData {
  id: TunnelId;
  host_id: HostId;
  slug: string;
  target_port: number;
  auth_mode: TunnelAuthMode;
  public_url: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TunnelCreateParams {
  target_port: number;
  auth_mode?: TunnelAuthMode;
  slug?: string;
}

export interface TunnelUpdateParams {
  target_port?: number;
  auth_mode?: TunnelAuthMode;
  enabled?: boolean;
}

export interface TunnelListResponse {
  data: TunnelData[];
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export type AgentSessionStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "completed"
  | "failed"
  | "canceled"
  | "cancelled";

export interface OcAgentSessionData {
  id: string;
  session_id?: string;
  host_id: HostId;
  task: string;
  model_id?: string | null;
  model?: string | null;
  status: AgentSessionStatus;
  tools?: string[];
  max_turns?: number;
  turns_used?: number;
  max_steps?: number | null;
  max_tokens?: number | null;
  timeout_ms?: number | null;
  agent_runtime_profile_id?: string | null;
  runtime_context?: Record<string, unknown>;
  sse_url?: string;
  optimal_session_id?: string | null;
  created_at?: string;
  updated_at?: string;
  started_at?: string | null;
  ended_at?: string | null;
  inserted_at?: string;
  completed_at?: string | null;
  error?: string | null;
  result_summary?: string | null;
}

export interface AgentDispatchParams {
  task: string;
  model?: string;
  model_id?: string;
  max_turns?: number;
  tools?: string[];
  budget?: {
    max_steps?: number;
    max_tokens?: number;
    timeout_ms?: number;
  };
  agent_runtime_profile_id?: string;
  agent_profile_id?: string;
  skip_agent_runtime_profile?: boolean;
  context?: Record<string, unknown>;
}

export interface AgentSessionListResponse {
  data?: OcAgentSessionData[];
  sessions?: OcAgentSessionData[];
}

export interface AgentEvent {
  type: string;
  session_id: string;
  data: unknown;
  timestamp: string;
}

// ─── Inference Clusters ───────────────────────────────────────────────────────

export type ClusterStatus =
  | "provisioning"
  | "active"
  | "stopped"
  | "error"
  | "destroyed";

export interface ClusterData {
  id: ClusterId;
  name: string;
  model: string;
  slug: string;
  status: ClusterStatus;
  host_ids: HostId[];
  /** OpenAI-compatible endpoint: POST /inference/{slug}/v1/chat/completions */
  inference_url: string;
  created_at: string;
  updated_at: string;
}

export interface ClusterCreateParams {
  name: string;
  model: string;
  host_ids: string[];
}

export interface ClusterListResponse {
  data: ClusterData[];
}

export interface ClusterEvent {
  type: string;
  cluster_id: ClusterId;
  data: unknown;
  timestamp: string;
}

// ─── Apps ────────────────────────────────────────────────────────────────────

export interface AppCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  icon_url: string | null;
}

export interface AppInstallData {
  id: string;
  host_id: HostId;
  app_id: string;
  status: "pending" | "installing" | "installed" | "failed" | "uninstalled";
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppInstallEvent {
  type: string;
  install_id: string;
  data: unknown;
  timestamp: string;
}

// ─── Workspaces ───────────────────────────────────────────────────────────────

export type OcWorkspaceStatus =
  | "creating"
  | "ready"
  | "running"
  | "stopped"
  | "error";

export interface OcWorkspaceData {
  id: WorkspaceId;
  host_id: HostId;
  name: string;
  repo_url: string | null;
  branch: string | null;
  status: OcWorkspaceStatus;
  directory: string;
  created_at: string;
  updated_at: string;
}

export interface OcWorkspaceCreateParams {
  name: string;
  repo_url?: string;
  branch?: string;
  directory?: string;
}

export interface OcWorkspaceUpdateParams {
  name?: string;
  branch?: string;
}

export interface OcWorkspaceListResponse {
  data: OcWorkspaceData[];
}

export interface OcWorkspaceEvent {
  type: string;
  workspace_id: WorkspaceId;
  data: unknown;
  timestamp: string;
}

// ─── Secrets ─────────────────────────────────────────────────────────────────

export interface SecretData {
  id: SecretId;
  name: string;
  description: string | null;
  host_id: HostId | null;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface SecretCreateParams {
  name: string;
  value: string;
  description?: string;
}

export interface SecretUpdateParams {
  value?: string;
  description?: string;
}
