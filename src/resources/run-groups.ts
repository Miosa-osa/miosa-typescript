import type { Run, RunCreateParams, RunFile } from "./runs.js";
import type { HttpClient } from "../http.js";

export type RunGroupStatus = "running" | "succeeded" | "failed" | "canceled";

export interface RunGroupCounts {
  total: number;
  running: number;
  succeeded: number;
  failed: number;
  canceled: number;
}

export interface RunGroupEntryCounts extends RunGroupCounts {
  queued: number;
}

export type RunGroupEntryStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export interface RunGroupEntry {
  id: string;
  run_group_id: string;
  run_id?: string;
  index: number;
  status: RunGroupEntryStatus;
  attempts?: number;
  error?: Record<string, unknown>;
  queued_at?: string;
  claimed_at?: string;
  finished_at?: string;
  updated_at?: string;
}

export interface RunGroup {
  id: string;
  tenant_id?: string;
  user_id?: string;
  workspace_id?: string;
  project_id?: string;
  name: string;
  description?: string;
  status: RunGroupStatus;
  concurrency_limit?: number;
  expected_runs?: number;
  counts?: RunGroupCounts;
  entry_counts?: RunGroupEntryCounts;
  metadata?: Record<string, unknown>;
  started_at?: string;
  finished_at?: string;
  created_at?: string;
  updated_at?: string;
  runs?: Run[];
  [key: string]: unknown;
}

export interface RunGroupCreateParams {
  name: string;
  description?: string;
  workspaceId?: string;
  projectId?: string;
  concurrencyLimit?: number;
  expectedRuns?: number;
  metadata?: Record<string, unknown>;
}

export interface RunGroupListParams {
  workspaceId?: string;
  projectId?: string;
  status?: RunGroupStatus | string;
  limit?: number;
}

export type RunGroupDispatchEntry = RunCreateParams & {
  targetId?: string;
  sandboxId?: string;
  computerId?: string;
};

export interface RunGroupDispatchResult {
  group: RunGroup;
  results?: Array<
    | { index: number; ok: true; run: Run }
    | { index: number; ok: false; error: Record<string, unknown> }
  >;
  entries?: RunGroupEntry[];
}

export interface RunGroupDispatchOptions {
  async?: boolean;
}

export interface RunGroupWaitOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  terminalStatuses?: string[];
  includeRuns?: boolean;
}

export interface RunGroupActivity {
  id: string;
  run_group_id?: string;
  run_id?: string;
  sequence?: number;
  type: string;
  message?: string | null;
  payload?: Record<string, unknown>;
  created_at?: string | null;
  [key: string]: unknown;
}

export type RunGroupFile = RunFile & {
  run_id: string;
};

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in (payload as object)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function fileRows(raw: unknown): RunFile[] {
  const data = unwrap<RunFile[] | { files?: RunFile[]; items?: RunFile[] }>(raw);
  if (Array.isArray(data)) return data;
  return data.files ?? data.items ?? [];
}

function stripUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

function body(params: RunGroupCreateParams): Record<string, unknown> {
  return stripUndefined({
    name: params.name,
    description: params.description,
    workspace_id: params.workspaceId,
    project_id: params.projectId,
    concurrency_limit: params.concurrencyLimit,
    expected_runs: params.expectedRuns,
    metadata: params.metadata,
  });
}

function runBody(entry: RunGroupDispatchEntry): Record<string, unknown> {
  return stripUndefined({
    instruction: entry.instruction,
    target_kind: entry.targetKind,
    target_id: entry.targetId,
    runtime_id: entry.runtimeId,
    sandbox_id: entry.sandboxId,
    computer_id: entry.computerId,
    provider: entry.provider,
    runner: entry.runner,
    model: entry.model,
    command: entry.command,
    runtime_command: entry.runtimeCommand,
    cwd: entry.cwd,
    timeout: entry.timeout,
    env: entry.env,
    agent_runtime_profile_id: entry.agentRuntimeProfileId,
    agent_profile_id: entry.agentProfileId,
    parent_run_id: entry.parentRunId,
    orchestration_role: entry.orchestrationRole,
    skip_agent_runtime_profile: entry.skipRuntimeProfile,
    execution_packet: entry.executionPacket,
    expected_outputs: entry.expectedOutputs,
    approval_policy: entry.approvalPolicy,
    capability_requirements: entry.capabilityRequirements,
    metadata: entry.metadata,
  });
}

function isTerminalStatus(status: unknown, terminalStatuses: string[]): boolean {
  return typeof status === "string" && terminalStatuses.includes(status.toLowerCase());
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RunGroups {
  constructor(private readonly http: HttpClient) {}

  async list(params: RunGroupListParams = {}): Promise<RunGroup[]> {
    const response = await this.http.get<unknown>(
      "/run-groups",
      stripUndefined({
        workspace_id: params.workspaceId,
        project_id: params.projectId,
        status: params.status,
        limit: params.limit,
      }) as Record<string, string | number | boolean | undefined>,
    );
    const data = unwrap<RunGroup[] | { groups?: RunGroup[]; items?: RunGroup[] }>(
      response,
    );
    if (Array.isArray(data)) return data;
    return data.groups ?? data.items ?? [];
  }

  async create(params: RunGroupCreateParams): Promise<RunGroup> {
    return unwrap<RunGroup>(
      await this.http.post<unknown>("/run-groups", body(params)),
    );
  }

  async get(id: string, options: { includeRuns?: boolean } = {}): Promise<RunGroup> {
    const query = options.includeRuns ? "?include=runs" : "";
    return unwrap<RunGroup>(
      await this.http.get<unknown>(`/run-groups/${encodeURIComponent(id)}${query}`),
    );
  }

  async dispatch(
    id: string,
    runs: RunGroupDispatchEntry[],
    options: RunGroupDispatchOptions = {},
  ): Promise<RunGroupDispatchResult> {
    return unwrap<RunGroupDispatchResult>(
      await this.http.post<unknown>(
        `/run-groups/${encodeURIComponent(id)}/dispatch`,
        stripUndefined({ runs: runs.map(runBody), async: options.async }),
      ),
    );
  }

  async cancel(id: string): Promise<RunGroup> {
    return unwrap<RunGroup>(
      await this.http.post<unknown>(
        `/run-groups/${encodeURIComponent(id)}/cancel`,
        {},
      ),
    );
  }

  async activity(id: string): Promise<RunGroupActivity[]> {
    const data = unwrap<
      RunGroupActivity[] | { activity?: RunGroupActivity[]; items?: RunGroupActivity[] }
    >(
      await this.http.get<unknown>(
        `/run-groups/${encodeURIComponent(id)}/activity`,
      ),
    );
    if (Array.isArray(data)) return data;
    return data.activity ?? data.items ?? [];
  }

  streamActivity(id: string): AsyncIterableIterator<RunGroupActivity> {
    return this.http.stream<RunGroupActivity>(
      `/run-groups/${encodeURIComponent(id)}/activity`,
    );
  }

  async files(id: string): Promise<RunGroupFile[]> {
    const group = await this.get(id, { includeRuns: true });
    const runs = (group.runs ?? []).filter((run) => Boolean(run.id));
    const nested = await Promise.all(
      runs.map(async (run) => {
        const files = fileRows(
          await this.http.get<unknown>(
            `/runs/${encodeURIComponent(run.id)}/files`,
          ),
        );
        return files.map((file) => ({
          ...file,
          run_id: file.run_id ?? run.id,
        }));
      }),
    );
    return nested.flat() as RunGroupFile[];
  }

  async waitForCompletion(
    id: string,
    options: RunGroupWaitOptions = {},
  ): Promise<RunGroup> {
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
      const group = await this.get(
        id,
        options.includeRuns === undefined ? {} : { includeRuns: options.includeRuns },
      );
      if (isTerminalStatus(group.status, terminalStatuses)) return group;
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for run group ${id}`);
      }
      await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
    }
  }
}
