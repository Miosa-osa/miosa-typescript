import { describe, expect, it, vi, beforeEach } from "vitest";
import { AgentRunGroups } from "./agent-run-groups.js";
import type { HttpClient } from "../http.js";

const get = vi.fn();
const post = vi.fn();
const stream = vi.fn();

const http = { get, post, stream } as unknown as HttpClient;

describe("AgentRunGroups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates, lists, fetches, dispatches, and cancels groups", async () => {
    post
      .mockResolvedValueOnce({ data: { id: "grp_1", name: "fanout", status: "running" } })
      .mockResolvedValueOnce({
        data: {
          group: { id: "grp_1", name: "fanout", status: "succeeded" },
          results: [{ index: 0, ok: true, run: { id: "run_1", status: "succeeded" } }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          group: { id: "grp_1", name: "fanout", status: "running" },
          results: [],
          entries: [{ id: "entry_1", index: 0, status: "queued" }],
        },
      })
      .mockResolvedValueOnce({ data: { id: "grp_1", name: "fanout", status: "canceled" } });

    get
      .mockResolvedValueOnce({ data: [{ id: "grp_1", name: "fanout", status: "running" }] })
      .mockResolvedValueOnce({ data: { id: "grp_1", name: "fanout", runs: [] } })
      .mockResolvedValueOnce({
        data: [
          {
            id: "evt_1",
            agent_run_group_id: "grp_1",
            agent_run_id: "run_1",
            type: "created",
          },
        ],
      })
      .mockResolvedValueOnce({
        data: {
          id: "grp_1",
          name: "fanout",
          status: "succeeded",
          runs: [{ id: "run_1", status: "succeeded" }],
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "art_1",
            path: "/workspace/report.html",
            kind: "html",
          },
        ],
      });

    stream.mockReturnValueOnce((async function* () {
      yield { id: "evt_2", type: "command_finished" };
    })());

    const groups = new AgentRunGroups(http);
    const created = await groups.create({
      name: "fanout",
      workspaceId: "wk_1",
      concurrencyLimit: 10,
    });
    const listed = await groups.list({ workspaceId: "wk_1", status: "running", limit: 20 });
    const fetched = await groups.get("grp_1", { includeRuns: true });
    const dispatched = await groups.dispatch("grp_1", [
      {
        sandboxId: "sbx_1",
        provider: "claude",
        prompt: "build",
        orchestrationRole: "worker",
        executionPacket: { goal: "build workspace" },
        outputContract: { artifacts: ["/workspace/report.html"] },
        approvalPolicy: { publish: "manual" },
        capabilityRequirements: ["filesystem"],
      },
    ]);
    const queued = await groups.dispatch(
      "grp_1",
      [{ sandboxId: "sbx_2", provider: "codex", prompt: "test" }],
      { async: true },
    );
    const canceled = await groups.cancel("grp_1");
    const events = await groups.events("grp_1");
    const streamIterator = groups.streamEvents("grp_1");
    const streamed = await streamIterator.next();
    const artifacts = await groups.artifacts("grp_1");

    expect(post).toHaveBeenNthCalledWith(1, "/agent-run-groups", {
      name: "fanout",
      workspace_id: "wk_1",
      concurrency_limit: 10,
    });
    expect(get).toHaveBeenNthCalledWith(1, "/agent-run-groups", {
      workspace_id: "wk_1",
      status: "running",
      limit: 20,
    });
    expect(get).toHaveBeenNthCalledWith(2, "/agent-run-groups/grp_1?include=runs");
    expect(post).toHaveBeenNthCalledWith(2, "/agent-run-groups/grp_1/dispatch", {
      runs: [
        {
          prompt: "build",
          sandbox_id: "sbx_1",
          provider: "claude",
          orchestration_role: "worker",
          execution_packet: { goal: "build workspace" },
          output_contract: { artifacts: ["/workspace/report.html"] },
          approval_policy: { publish: "manual" },
          capability_requirements: ["filesystem"],
        },
      ],
    });
    expect(post).toHaveBeenNthCalledWith(3, "/agent-run-groups/grp_1/dispatch", {
      runs: [{ prompt: "test", sandbox_id: "sbx_2", provider: "codex" }],
      async: true,
    });
    expect(post).toHaveBeenNthCalledWith(4, "/agent-run-groups/grp_1/cancel", {});
    expect(get).toHaveBeenNthCalledWith(3, "/agent-run-groups/grp_1/events");
    expect(get).toHaveBeenNthCalledWith(4, "/agent-run-groups/grp_1?include=runs");
    expect(get).toHaveBeenNthCalledWith(5, "/agent-runs/run_1/artifacts");
    expect(stream).toHaveBeenCalledWith("/agent-run-groups/grp_1/events");
    expect(created.id).toBe("grp_1");
    expect(listed[0]?.id).toBe("grp_1");
    expect(fetched.id).toBe("grp_1");
    expect(dispatched.results?.[0]?.ok).toBe(true);
    expect(queued.entries?.[0]?.status).toBe("queued");
    expect(canceled.status).toBe("canceled");
    expect(events[0]?.agent_run_id).toBe("run_1");
    expect(streamed.value?.type).toBe("command_finished");
    expect(artifacts[0]).toMatchObject({
      id: "art_1",
      agent_run_id: "run_1",
      path: "/workspace/report.html",
    });
  });

  it("waits for group completion", async () => {
    get
      .mockResolvedValueOnce({ data: { id: "grp_1", name: "fanout", status: "running" } })
      .mockResolvedValueOnce({
        data: { id: "grp_1", name: "fanout", status: "succeeded", runs: [] },
      });

    const result = await new AgentRunGroups(http).waitForCompletion("grp_1", {
      includeRuns: true,
      pollIntervalMs: 0,
      timeoutMs: 1000,
    });

    expect(get).toHaveBeenNthCalledWith(1, "/agent-run-groups/grp_1?include=runs");
    expect(get).toHaveBeenNthCalledWith(2, "/agent-run-groups/grp_1?include=runs");
    expect(result.status).toBe("succeeded");
  });
});
