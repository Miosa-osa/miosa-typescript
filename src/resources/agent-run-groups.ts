import type { AgentRun, AgentRunArtifact, AgentRunCreateParams } from "./agent-runs.js";
import type { HttpClient } from "../http.js";

export type AgentRunGroupStatus = "running" | "succeeded" | "failed" | "canceled";

export interface AgentRunGroupCounts {
  total: number;
  running: number;
  succeeded: number;
  failed: number;
  canceled: number;
}

export interface AgentRunGroupEntryCounts extends AgentRunGroupCounts {
  queued: number;
}

export type AgentRunGroupEntryStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export interface AgentRunGroupEntry {
  id: string;
  agent_run_group_id: string;
  agent_run_id?: string;
  index: number;
  status: AgentRunGroupEntryStatus;
  attempts?: number;
  error?: Record<string, unknown>;
  queued_at?: string;
  claimed_at?: string;
  finished_at?: string;
  updated_at?: string;
}

export interface AgentRunGroup {
  id: string;
  tenant_id?: string;
  user_id?: string;
  workspace_id?: string;
  project_id?: string;
  name: string;
  description?: string;
  status: AgentRunGroupStatus;
  concurrency_limit?: number;
  expected_runs?: number;
  counts?: AgentRunGroupCounts;
  entry_counts?: AgentRunGroupEntryCounts;
  metadata?: Record<string, unknown>;
  started_at?: string;
  finished_at?: string;
  created_at?: string;
  updated_at?: string;
  runs?: AgentRun[];
  [key: string]: unknown;
}

export interface AgentRunGroupCreateParams {
  name: string;
  description?: string;
  workspaceId?: string;
  projectId?: string;
  concurrencyLimit?: number;
  expectedRuns?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentRunGroupListParams {
  workspaceId?: string;
  projectId?: string;
  status?: AgentRunGroupStatus | string;
  limit?: number;
}

export type AgentRunGroupDispatchEntry = AgentRunCreateParams & {
  targetId?: string;
  sandboxId?: string;
  computerId?: string;
};

export interface AgentRunGroupDispatchResult {
  group: AgentRunGroup;
  results?: Array<
    | { index: number; ok: true; run: AgentRun }
    | { index: number; ok: false; error: Record<string, unknown> }
  >;
  entries?: AgentRunGroupEntry[];
}

export interface AgentRunGroupDispatchOptions {
  async?: boolean;
}

export interface AgentRunGroupWaitOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  terminalStatuses?: string[];
  includeRuns?: boolean;
}

export interface AgentRunGroupEvent {
  id: string;
  agent_run_group_id?: string;
  agent_run_id?: string;
  sequence?: number;
  type: string;
  message?: string | null;
  payload?: Record<string, unknown>;
  created_at?: string | null;
  [key: string]: unknown;
}

export type AgentRunGroupArtifact = AgentRunArtifact & {
  agent_run_id: string;
};

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in (payload as object)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function artifactRows(raw: unknown): AgentRunArtifact[] {
  const data = unwrap<
    AgentRunArtifact[] | { artifacts?: AgentRunArtifact[]; items?: AgentRunArtifact[] }
  >(raw);
  if (Array.isArray(data)) return data;
  return data.artifacts ?? data.items ?? [];
}

function stripUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

function body(params: AgentRunGroupCreateParams): Record<string, unknown> {
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

function runBody(entry: AgentRunGroupDispatchEntry): Record<string, unknown> {
  return stripUndefined({
    prompt: entry.prompt,
    target_kind: entry.targetKind,
    target_id: entry.targetId,
    sandbox_id: entry.sandboxId,
    computer_id: entry.computerId,
    provider: entry.provider,
    model: entry.model,
    command: entry.command,
    runtime_command: entry.runtimeCommand,
    cwd: entry.cwd,
    timeout: entry.timeout,
    env: entry.env,
    agent_runtime_profile_id: entry.agentRuntimeProfileId,
    agent_profile_id: entry.agentProfileId,
    parent_agent_run_id: entry.parentAgentRunId,
    orchestration_role: entry.orchestrationRole,
    skip_agent_runtime_profile: entry.skipAgentRuntimeProfile,
    execution_packet: entry.executionPacket,
    output_contract: entry.outputContract,
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

export class AgentRunGroups {
  constructor(private readonly http: HttpClient) {}

  async list(params: AgentRunGroupListParams = {}): Promise<AgentRunGroup[]> {
    const response = await this.http.get<unknown>(
      "/agent-run-groups",
      stripUndefined({
        workspace_id: params.workspaceId,
        project_id: params.projectId,
        status: params.status,
        limit: params.limit,
      }) as Record<string, string | number | boolean | undefined>,
    );
    const data = unwrap<AgentRunGroup[] | { groups?: AgentRunGroup[]; items?: AgentRunGroup[] }>(
      response,
    );
    if (Array.isArray(data)) return data;
    return data.groups ?? data.items ?? [];
  }

  async create(params: AgentRunGroupCreateParams): Promise<AgentRunGroup> {
    return unwrap<AgentRunGroup>(
      await this.http.post<unknown>("/agent-run-groups", body(params)),
    );
  }

  async get(id: string, options: { includeRuns?: boolean } = {}): Promise<AgentRunGroup> {
    const query = options.includeRuns ? "?include=runs" : "";
    return unwrap<AgentRunGroup>(
      await this.http.get<unknown>(`/agent-run-groups/${encodeURIComponent(id)}${query}`),
    );
  }

  async dispatch(
    id: string,
    runs: AgentRunGroupDispatchEntry[],
    options: AgentRunGroupDispatchOptions = {},
  ): Promise<AgentRunGroupDispatchResult> {
    return unwrap<AgentRunGroupDispatchResult>(
      await this.http.post<unknown>(
        `/agent-run-groups/${encodeURIComponent(id)}/dispatch`,
        stripUndefined({ runs: runs.map(runBody), async: options.async }),
      ),
    );
  }

  async cancel(id: string): Promise<AgentRunGroup> {
    return unwrap<AgentRunGroup>(
      await this.http.post<unknown>(
        `/agent-run-groups/${encodeURIComponent(id)}/cancel`,
        {},
      ),
    );
  }

  async events(id: string): Promise<AgentRunGroupEvent[]> {
    const data = unwrap<
      AgentRunGroupEvent[] | { events?: AgentRunGroupEvent[]; items?: AgentRunGroupEvent[] }
    >(
      await this.http.get<unknown>(
        `/agent-run-groups/${encodeURIComponent(id)}/events`,
      ),
    );
    if (Array.isArray(data)) return data;
    return data.events ?? data.items ?? [];
  }

  streamEvents(id: string): AsyncIterableIterator<AgentRunGroupEvent> {
    return this.http.stream<AgentRunGroupEvent>(
      `/agent-run-groups/${encodeURIComponent(id)}/events`,
    );
  }

  async artifacts(id: string): Promise<AgentRunGroupArtifact[]> {
    const group = await this.get(id, { includeRuns: true });
    const runs = (group.runs ?? []).filter((run) => Boolean(run.id));
    const nested = await Promise.all(
      runs.map(async (run) => {
        const artifacts = artifactRows(
          await this.http.get<unknown>(
            `/agent-runs/${encodeURIComponent(run.id)}/artifacts`,
          ),
        );
        return artifacts.map((artifact) => ({
          ...artifact,
          agent_run_id: artifact.agent_run_id ?? run.id,
        }));
      }),
    );
    return nested.flat() as AgentRunGroupArtifact[];
  }

  async waitForCompletion(
    id: string,
    options: AgentRunGroupWaitOptions = {},
  ): Promise<AgentRunGroup> {
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
        throw new Error(`Timed out waiting for agent run group ${id}`);
      }
      await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
    }
  }
}
