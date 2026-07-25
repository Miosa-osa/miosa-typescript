import type { HttpClient } from "../http.js";

export type RunTargetKind = "sandbox" | "computer";
export type RunStatus = "running" | "succeeded" | "failed" | "canceled";

export interface Run {
  id: string;
  run_group_id?: string;
  parent_run_id?: string;
  orchestration_role?: string;
  external_workspace_id?: string | null;
  external_user_id?: string | null;
  external_project_id?: string | null;
  target_kind: RunTargetKind;
  target_id: string;
  runner: string;
  provider?: string | null;
  model?: string | null;
  instruction: string;
  status: RunStatus;
  metadata?: Record<string, unknown>;
  started_at?: string;
  finished_at?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface RunFile {
  id: string;
  run_id?: string;
  target_kind?: RunTargetKind;
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
  name?: string | null;
  download_url?: string | null;
  signed_download_url?: string | null;
}

export interface RunMessage {
  id?: string;
  role?: string;
  type?: string;
  text?: string;
  content?: string;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface RunCommandOutput {
  stdout?: string | null;
  stderr?: string | null;
  exit_code?: number | null;
}

export interface RunDownload {
  id?: string;
  file_id: string;
  name?: string | null;
  path?: string;
  url: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  status?: string;
  [key: string]: unknown;
}

export interface RunPreview {
  id: string;
  run_id?: string;
  file_id?: string;
  type: string;
  title?: string | null;
  path?: string | null;
  url?: string | null;
  mime_type?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RunDiagnostic {
  id: string;
  run_id?: string;
  code: string;
  message?: string | null;
  retryable?: boolean;
  [key: string]: unknown;
}

export interface RunOutputs {
  run_id: string;
  task_run_id?: string;
  status: RunStatus;
  result?: Record<string, unknown> | null;
  message?: string | null;
  messages: RunMessage[];
  command_output: RunCommandOutput;
  activity: RunActivity[];
  files: RunFile[];
  downloads: RunDownload[];
  previews: RunPreview[];
  diagnostics: RunDiagnostic[];
  [key: string]: unknown;
}

export interface RunActivity {
  id: string;
  run_id?: string;
  sequence?: number;
  type: string;
  message?: string | null;
  payload?: Record<string, unknown>;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface RunExecutionPacket {
  goal?: string;
  context?: Record<string, unknown>;
  plan?: unknown;
  constraints?: unknown;
  acceptance_criteria?: unknown;
  [key: string]: unknown;
}

export interface RunExpectedFile {
  path: string;
  name?: string;
  kind?: string;
  mime_type?: string;
  preview?: boolean;
  [key: string]: unknown;
}

export interface RunExpectedOutputs {
  messages?: boolean;
  files?: Array<string | RunExpectedFile>;
  previews?: boolean | unknown[];
  [key: string]: unknown;
}

export interface RunApprovalPolicy {
  publish?: "manual" | "automatic" | string;
  external_write?: "manual" | "automatic" | string;
  destructive_actions?: "forbidden" | "manual" | "automatic" | string;
  [key: string]: unknown;
}

export interface RunCreateParams {
  instruction?: string;
  targetKind?: RunTargetKind;
  targetId?: string;
  runtimeId?: string;
  sandboxId?: string;
  /** Shortcut for a computer-backed run. */
  computerId?: string;
  /** Optional model/vendor configuration, not the runner selector. */
  provider?: string;
  runner?: string;
  model?: string;
  command?: string;
  runtimeCommand?: string;
  cwd?: string;
  timeout?: number;
  wait?: boolean;
  env?: Record<string, string>;
  agentRuntimeProfileId?: string;
  agentProfileId?: string;
  runGroupId?: string;
  parentRunId?: string;
  orchestrationRole?: string;
  externalWorkspaceId?: string;
  external_workspace_id?: string;
  externalUserId?: string;
  external_user_id?: string;
  externalProjectId?: string;
  external_project_id?: string;
  skipRuntimeProfile?: boolean;
  executionPacket?: RunExecutionPacket;
  expectedOutputs?: RunExpectedOutputs;
  approvalPolicy?: RunApprovalPolicy;
  capabilityRequirements?: string[];
  metadata?: Record<string, unknown>;
}

export interface RunListParams {
  targetKind?: RunTargetKind;
  targetId?: string;
  runtimeId?: string;
  sandboxId?: string;
  computerId?: string;
  runGroupId?: string;
  externalWorkspaceId?: string;
  external_workspace_id?: string;
  externalUserId?: string;
  external_user_id?: string;
  externalProjectId?: string;
  external_project_id?: string;
  status?: RunStatus | string;
}

export interface RunWaitOptions {
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

export class Runs {
  constructor(private readonly http: HttpClient) {}

  async list(params: RunListParams = {}): Promise<Run[]> {
    const response = await this.http.get<unknown>(
      "/runs",
      stripUndefined({
        target_kind: params.targetKind,
        target_id: params.targetId,
        runtime_id: params.runtimeId,
        sandbox_id: params.sandboxId,
        computer_id: params.computerId,
        run_group_id: params.runGroupId,
        external_workspace_id: params.externalWorkspaceId ?? params.external_workspace_id,
        external_user_id: params.externalUserId ?? params.external_user_id,
        external_project_id: params.externalProjectId ?? params.external_project_id,
        status: params.status,
      }) as Record<string, string | number | boolean | undefined>,
    );
    const data = unwrap<Run[] | { runs?: Run[]; items?: Run[] }>(
      response,
    );
    if (Array.isArray(data)) return data;
    return data.runs ?? data.items ?? [];
  }

  async get(id: string): Promise<Run> {
    return unwrap<Run>(
      await this.http.get<unknown>(`/runs/${encodeURIComponent(id)}`),
    );
  }

  async outputs(id: string): Promise<RunOutputs> {
    return unwrap<RunOutputs>(
      await this.http.get<unknown>(`/runs/${encodeURIComponent(id)}/outputs`),
    );
  }

  async files(id: string): Promise<RunFile[]> {
    const data = unwrap<RunFile[] | { files?: RunFile[]; items?: RunFile[] }>(
      await this.http.get<unknown>(`/runs/${encodeURIComponent(id)}/files`),
    );
    if (Array.isArray(data)) return data;
    return data.files ?? data.items ?? [];
  }

  async downloadFile(
    id: string,
    fileId: string,
    options: { inline?: boolean } = {},
  ): Promise<Uint8Array> {
    const query = options.inline ? "?disposition=inline" : "";
    return this.http.getBinary(
      `/runs/${encodeURIComponent(id)}/files/${encodeURIComponent(
        fileId,
      )}/download${query}`,
    );
  }

  async messages(id: string): Promise<RunMessage[]> {
    const data = unwrap<RunMessage[] | { messages?: RunMessage[]; items?: RunMessage[] }>(
      await this.http.get<unknown>(`/runs/${encodeURIComponent(id)}/messages`),
    );
    if (Array.isArray(data)) return data;
    return data.messages ?? data.items ?? [];
  }

  async commandOutput(id: string): Promise<RunCommandOutput> {
    return unwrap<RunCommandOutput>(
      await this.http.get<unknown>(`/runs/${encodeURIComponent(id)}/command-output`),
    );
  }

  async activity(id: string): Promise<RunActivity[]> {
    const data = unwrap<RunActivity[] | { activity?: RunActivity[]; items?: RunActivity[] }>(
      await this.http.get<unknown>(`/runs/${encodeURIComponent(id)}/activity`),
    );
    if (Array.isArray(data)) return data;
    return data.activity ?? data.items ?? [];
  }

  async previews(id: string): Promise<RunPreview[]> {
    const data = unwrap<RunPreview[] | { previews?: RunPreview[]; items?: RunPreview[] }>(
      await this.http.get<unknown>(`/runs/${encodeURIComponent(id)}/previews`),
    );
    if (Array.isArray(data)) return data;
    return data.previews ?? data.items ?? [];
  }

  async diagnostics(id: string): Promise<RunDiagnostic[]> {
    const data = unwrap<
      RunDiagnostic[] | { diagnostics?: RunDiagnostic[]; items?: RunDiagnostic[] }
    >(await this.http.get<unknown>(`/runs/${encodeURIComponent(id)}/diagnostics`));
    if (Array.isArray(data)) return data;
    return data.diagnostics ?? data.items ?? [];
  }

  streamActivity(id: string): AsyncIterableIterator<RunActivity> {
    return this.http.stream<RunActivity>(
      `/runs/${encodeURIComponent(id)}/activity`,
    );
  }

  async waitForCompletion(
    id: string,
    options: RunWaitOptions = {},
  ): Promise<Run> {
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
        throw new Error(`Timed out waiting for run ${id}`);
      }
      await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
    }
  }

  async run(params: RunCreateParams): Promise<Run> {
    const body = stripUndefined({
      instruction: params.instruction,
      target_kind: params.targetKind,
      target_id: params.targetId,
      runtime_id: params.runtimeId,
      sandbox_id: params.sandboxId,
      computer_id: params.computerId,
      provider: params.provider,
      runner: params.runner,
      model: params.model,
      command: params.command,
      runtime_command: params.runtimeCommand,
      cwd: params.cwd,
      timeout: params.timeout,
      wait: params.wait,
      env: params.env,
      agent_runtime_profile_id: params.agentRuntimeProfileId,
      agent_profile_id: params.agentProfileId,
      run_group_id: params.runGroupId,
      parent_run_id: params.parentRunId,
      orchestration_role: params.orchestrationRole,
      external_workspace_id: params.externalWorkspaceId ?? params.external_workspace_id,
      external_user_id: params.externalUserId ?? params.external_user_id,
      external_project_id: params.externalProjectId ?? params.external_project_id,
      skip_agent_runtime_profile: params.skipRuntimeProfile,
      execution_packet: params.executionPacket,
      expected_outputs: params.expectedOutputs,
      approval_policy: params.approvalPolicy,
      capability_requirements: params.capabilityRequirements,
      metadata: params.metadata,
    });

    return unwrap<Run>(await this.http.post<unknown>("/runs", body));
  }

  async cancel(id: string): Promise<Run> {
    return unwrap<Run>(
      await this.http.post<unknown>(
        `/runs/${encodeURIComponent(id)}/cancel`,
        {},
      ),
    );
  }
}
