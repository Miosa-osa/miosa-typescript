import { describe, expect, it, vi, beforeEach } from "vitest";
import { RunGroups } from "./run-groups.js";
import type { HttpClient } from "../http.js";

const get = vi.fn();
const post = vi.fn();
const stream = vi.fn();

const http = { get, post, stream } as unknown as HttpClient;

describe("RunGroups", () => {
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
            run_group_id: "grp_1",
            run_id: "run_1",
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
            id: "file_1",
            path: "/workspace/report.html",
            kind: "html",
          },
        ],
      });

    stream.mockReturnValueOnce((async function* () {
      yield { id: "evt_2", type: "command_finished" };
    })());

    const groups = new RunGroups(http);
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
        instruction: "build",
        runtimeId: "sbx_1",
        runner: "claude-code",
        orchestrationRole: "worker",
        executionPacket: { goal: "build workspace" },
        expectedOutputs: { files: ["/workspace/report.html"] },
        approvalPolicy: { publish: "manual" },
        capabilityRequirements: ["filesystem", "files", "downloads"],
      },
    ]);
    const queued = await groups.dispatch(
      "grp_1",
      [{ sandboxId: "sbx_2", runner: "codex", instruction: "test" }],
      { async: true },
    );
    const canceled = await groups.cancel("grp_1");
    const activity = await groups.activity("grp_1");
    const streamIterator = groups.streamActivity("grp_1");
    const streamed = await streamIterator.next();
    const files = await groups.files("grp_1");

    expect(post).toHaveBeenNthCalledWith(1, "/run-groups", {
      name: "fanout",
      workspace_id: "wk_1",
      concurrency_limit: 10,
    });
    expect(get).toHaveBeenNthCalledWith(1, "/run-groups", {
      workspace_id: "wk_1",
      status: "running",
      limit: 20,
    });
    expect(get).toHaveBeenNthCalledWith(2, "/run-groups/grp_1?include=runs");
    expect(post).toHaveBeenNthCalledWith(2, "/run-groups/grp_1/dispatch", {
      runs: [
        {
          instruction: "build",
          runtime_id: "sbx_1",
          sandbox_id: "sbx_1",
          runner: "claude-code",
          orchestration_role: "worker",
          execution_packet: { goal: "build workspace" },
          expected_outputs: { files: ["/workspace/report.html"] },
          approval_policy: { publish: "manual" },
          capability_requirements: ["filesystem", "files", "downloads"],
        },
      ],
    });
    expect(post).toHaveBeenNthCalledWith(3, "/run-groups/grp_1/dispatch", {
      runs: [{ instruction: "test", sandbox_id: "sbx_2", runner: "codex" }],
      async: true,
    });
    expect(post).toHaveBeenNthCalledWith(4, "/run-groups/grp_1/cancel", {});
    expect(get).toHaveBeenNthCalledWith(3, "/run-groups/grp_1/activity");
    expect(get).toHaveBeenNthCalledWith(4, "/run-groups/grp_1?include=runs");
    expect(get).toHaveBeenNthCalledWith(5, "/runs/run_1/files");
    expect(stream).toHaveBeenCalledWith("/run-groups/grp_1/activity");
    expect(created.id).toBe("grp_1");
    expect(listed[0]?.id).toBe("grp_1");
    expect(fetched.id).toBe("grp_1");
    expect(dispatched.results?.[0]?.ok).toBe(true);
    expect(queued.entries?.[0]?.status).toBe("queued");
    expect(canceled.status).toBe("canceled");
    expect(activity[0]?.run_id).toBe("run_1");
    expect(streamed.value?.type).toBe("command_finished");
    expect(files[0]).toMatchObject({
      id: "file_1",
      run_id: "run_1",
      path: "/workspace/report.html",
    });
  });

  it("waits for group completion", async () => {
    get
      .mockResolvedValueOnce({ data: { id: "grp_1", name: "fanout", status: "running" } })
      .mockResolvedValueOnce({
        data: { id: "grp_1", name: "fanout", status: "succeeded", runs: [] },
      });

    const result = await new RunGroups(http).waitForCompletion("grp_1", {
      includeRuns: true,
      pollIntervalMs: 0,
      timeoutMs: 1000,
    });

    expect(get).toHaveBeenNthCalledWith(1, "/run-groups/grp_1?include=runs");
    expect(get).toHaveBeenNthCalledWith(2, "/run-groups/grp_1?include=runs");
    expect(result.status).toBe("succeeded");
  });
});
