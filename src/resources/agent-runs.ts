import type { HttpClient } from "../http.js";

export type AgentRunTargetKind = "sandbox" | "computer";
export type AgentRunStatus = "running" | "succeeded" | "failed" | "canceled";

export interface AgentRun {
  id: string;
  agent_run_group_id?: string;
  parent_agent_run_id?: string;
  orchestration_role?: string;
  external_workspace_id?: string | null;
  external_user_id?: string | null;
  external_project_id?: string | null;
  target_kind: AgentRunTargetKind;
  target_id: string;
  provider: string;
  prompt: string;
  status: AgentRunStatus;
  output?: string;
  stderr?: string;
  exit_code?: number;
  metadata?: Record<string, unknown>;
  started_at?: string;
  finished_at?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface AgentRunArtifact {
  id: string;
  agent_run_id?: string;
  target_kind?: AgentRunTargetKind;
  target_id?: string;
  path: string;
  kind?: string;
  mime_type?: string;
  size_bytes?: number;
  sha256?: string;
  status?: string;
  persisted?: boolean;
  storage_backend?: string | null;
  persisted_at?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface AgentRunEvent {
  id: string;
  agent_run_id?: string;
  sequence?: number;
  type: string;
  message?: string | null;
  payload?: Record<string, unknown>;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface AgentRunExecutionPacket {
  goal?: string;
  context?: Record<string, unknown>;
  plan?: unknown;
  constraints?: unknown;
  acceptance_criteria?: unknown;
  [key: string]: unknown;
}

export interface AgentRunOutputContract {
  artifacts?: Array<string | Partial<AgentRunArtifact>>;
  artifact_paths?: string[];
  preview_port?: number;
  required_files?: string[];
  [key: string]: unknown;
}

export interface AgentRunApprovalPolicy {
  publish?: "manual" | "automatic" | string;
  external_write?: "manual" | "automatic" | string;
  destructive_actions?: "forbidden" | "manual" | "automatic" | string;
  [key: string]: unknown;
}

export interface AgentRunCreateParams {
  prompt: string;
  targetKind?: AgentRunTargetKind;
  targetId?: string;
  sandboxId?: string;
  /** Shortcut for a computer-backed Agent Run. */
  computerId?: string;
  provider?: string;
  model?: string;
  command?: string;
  runtimeCommand?: string;
  cwd?: string;
  timeout?: number;
  wait?: boolean;
  env?: Record<string, string>;
  /** Claude Code: `--output-format`, e.g. "json" or "stream-json". */
  outputFormat?: "text" | "json" | "stream-json" | string;
  output_format?: "text" | "json" | "stream-json" | string;
  /** Claude Code: `--resume <session_id>`. */
  resumeSessionId?: string;
  resume_session_id?: string;
  /** Codex: pass `--json` for JSONL event output. */
  json?: boolean;
  /** Codex: path to a JSON Schema file inside the runtime. */
  outputSchema?: string;
  output_schema?: string;
  /** Codex: path to an image file inside the runtime. */
  image?: string;
  agentRuntimeProfileId?: string;
  agentProfileId?: string;
  agentRunGroupId?: string;
  parentAgentRunId?: string;
  orchestrationRole?: string;
  externalWorkspaceId?: string;
  external_workspace_id?: string;
  externalUserId?: string;
  external_user_id?: string;
  externalProjectId?: string;
  external_project_id?: string;
  skipAgentRuntimeProfile?: boolean;
  executionPacket?: AgentRunExecutionPacket;
  outputContract?: AgentRunOutputContract;
  approvalPolicy?: AgentRunApprovalPolicy;
  capabilityRequirements?: string[];
  metadata?: Record<string, unknown>;
}

export interface AgentRunListParams {
  targetKind?: AgentRunTargetKind;
  targetId?: string;
  sandboxId?: string;
  computerId?: string;
  agentRunGroupId?: string;
  externalWorkspaceId?: string;
  external_workspace_id?: string;
  externalUserId?: string;
  external_user_id?: string;
  externalProjectId?: string;
  external_project_id?: string;
  status?: AgentRunStatus | string;
}

export interface AgentRunWaitOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  terminalStatuses?: string[];
}

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in (payload as object)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function stripUndefined(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

function isTerminalStatus(status: unknown, terminalStatuses: string[]): boolean {
  return typeof status === "string" && terminalStatuses.includes(status.toLowerCase());
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AgentRuns {
  constructor(private readonly http: HttpClient) {}

  async list(params: AgentRunListParams = {}): Promise<AgentRun[]> {
    const response = await this.http.get<unknown>(
      "/agent-runs",
      stripUndefined({
        target_kind: params.targetKind,
        target_id: params.targetId,
        sandbox_id: params.sandboxId,
        computer_id: params.computerId,
        agent_run_group_id: params.agentRunGroupId,
        external_workspace_id: params.externalWorkspaceId ?? params.external_workspace_id,
        external_user_id: params.externalUserId ?? params.external_user_id,
        external_project_id: params.externalProjectId ?? params.external_project_id,
        status: params.status,
      }) as Record<string, string | number | boolean | undefined>,
    );
    const data = unwrap<AgentRun[] | { runs?: AgentRun[]; items?: AgentRun[] }>(
      response,
    );
    if (Array.isArray(data)) return data;
    return data.runs ?? data.items ?? [];
  }

  async get(id: string): Promise<AgentRun> {
    return unwrap<AgentRun>(
      await this.http.get<unknown>(`/agent-runs/${encodeURIComponent(id)}`),
    );
  }

  async artifacts(id: string): Promise<AgentRunArtifact[]> {
    const data = unwrap<
      AgentRunArtifact[] | { artifacts?: AgentRunArtifact[]; items?: AgentRunArtifact[] }
    >(
      await this.http.get<unknown>(
        `/agent-runs/${encodeURIComponent(id)}/artifacts`,
      ),
    );
    if (Array.isArray(data)) return data;
    return data.artifacts ?? data.items ?? [];
  }

  async downloadArtifact(
    id: string,
    artifactId: string,
    options: { inline?: boolean } = {},
  ): Promise<Uint8Array> {
    const query = options.inline ? "?disposition=inline" : "";
    return this.http.getBinary(
      `/agent-runs/${encodeURIComponent(id)}/artifacts/${encodeURIComponent(
        artifactId,
      )}/download${query}`,
    );
  }

  async events(id: string): Promise<AgentRunEvent[]> {
    const data = unwrap<AgentRunEvent[] | { events?: AgentRunEvent[]; items?: AgentRunEvent[] }>(
      await this.http.get<unknown>(`/agent-runs/${encodeURIComponent(id)}/events`),
    );
    if (Array.isArray(data)) return data;
    return data.events ?? data.items ?? [];
  }

  streamEvents(id: string): AsyncIterableIterator<AgentRunEvent> {
    return this.http.stream<AgentRunEvent>(
      `/agent-runs/${encodeURIComponent(id)}/events`,
    );
  }

  async waitForCompletion(
    id: string,
    options: AgentRunWaitOptions = {},
  ): Promise<AgentRun> {
    const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;
    const pollIntervalMs = options.pollIntervalMs ?? 2000;
    const terminalStatuses = options.terminalStatuses ?? [
      "succeeded",
      "failed",
      "canceled",
      "cancelled",
    ];
    const deadline = Date.now() + timeoutMs;

    while (true) {
      const run = await this.get(id);
      if (isTerminalStatus(run.status, terminalStatuses)) return run;
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for agent run ${id}`);
      }
      await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
    }
  }

  async run(params: AgentRunCreateParams): Promise<AgentRun> {
    const body = stripUndefined({
      prompt: params.prompt,
      target_kind: params.targetKind,
      target_id: params.targetId,
      sandbox_id: params.sandboxId,
      computer_id: params.computerId,
      provider: params.provider,
      model: params.model,
      command: params.command,
      runtime_command: params.runtimeCommand,
      cwd: params.cwd,
      timeout: params.timeout,
      wait: params.wait,
      env: params.env,
      output_format: params.outputFormat ?? params.output_format,
      resume_session_id: params.resumeSessionId ?? params.resume_session_id,
      json: params.json,
      output_schema: params.outputSchema ?? params.output_schema,
      image: params.image,
      agent_runtime_profile_id: params.agentRuntimeProfileId,
      agent_profile_id: params.agentProfileId,
      agent_run_group_id: params.agentRunGroupId,
      parent_agent_run_id: params.parentAgentRunId,
      orchestration_role: params.orchestrationRole,
      external_workspace_id: params.externalWorkspaceId ?? params.external_workspace_id,
      external_user_id: params.externalUserId ?? params.external_user_id,
      external_project_id: params.externalProjectId ?? params.external_project_id,
      skip_agent_runtime_profile: params.skipAgentRuntimeProfile,
      execution_packet: params.executionPacket,
      output_contract: params.outputContract,
      approval_policy: params.approvalPolicy,
      capability_requirements: params.capabilityRequirements,
      metadata: params.metadata,
    });

    return unwrap<AgentRun>(await this.http.post<unknown>("/agent-runs", body));
  }

  async cancel(id: string): Promise<AgentRun> {
    return unwrap<AgentRun>(
      await this.http.post<unknown>(
        `/agent-runs/${encodeURIComponent(id)}/cancel`,
        {},
      ),
    );
  }
}
