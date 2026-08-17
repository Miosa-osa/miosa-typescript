import { describe, expect, it, vi, beforeEach } from "vitest";
import { Runs } from "./runs.js";
import type { HttpClient } from "../http.js";

const post = vi.fn();
const get = vi.fn();
const getBinary = vi.fn();
const stream = vi.fn();

const http = {
  get,
  post,
  getBinary,
  stream,
} as unknown as HttpClient;

describe("Runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches a sandbox instruction to /runs", async () => {
    post.mockResolvedValueOnce({
      data: {
        id: "run_1",
        target_kind: "sandbox",
        target_id: "sbx_1",
        runner: "claude-code",
        instruction: "build it",
        status: "succeeded",
      },
    });

    const result = await new Runs(http).run({
      sandboxId: "sbx_1",
      targetKind: "sandbox",
      cwd: "/workspace",
      timeout: 1800,
      wait: false,
      env: { FEATURE_FLAG: "on" },
      agentRuntimeProfileId: "profile_1",
      agentDefinitionId: "agent_1",
      agentVersionId: "version_1",
      configurationReceipt: { id: "receipt_1", agent_version_id: "version_1" },
      externalWorkspaceId: "clinic-iq",
      externalUserId: "founder-1",
      externalProjectId: "landing-page",
      executionPacket: {
        goal: "build landing page",
        context: { customer: "ClinicIQ" },
      },
      expectedOutputs: {
        files: [{ path: "/workspace/report.html", kind: "html" }],
        preview_port: 3000,
      },
      approvalPolicy: { publish: "manual" },
      capabilityRequirements: ["filesystem", "shell", "files", "downloads"],
      instruction: "build it",
      runtimeId: "sbx_1",
      runner: "claude-code",
    });

    expect(post).toHaveBeenCalledWith("/runs", {
      instruction: "build it",
      target_kind: "sandbox",
      runtime_id: "sbx_1",
      sandbox_id: "sbx_1",
      runner: "claude-code",
      cwd: "/workspace",
      timeout: 1800,
      wait: false,
      env: { FEATURE_FLAG: "on" },
      agent_runtime_profile_id: "profile_1",
      agent_definition_id: "agent_1",
      agent_version_id: "version_1",
      configuration_receipt: { id: "receipt_1", agent_version_id: "version_1" },
      external_workspace_id: "clinic-iq",
      external_user_id: "founder-1",
      external_project_id: "landing-page",
      execution_packet: {
        goal: "build landing page",
        context: { customer: "ClinicIQ" },
      },
      expected_outputs: {
        files: [{ path: "/workspace/report.html", kind: "html" }],
        preview_port: 3000,
      },
      approval_policy: { publish: "manual" },
      capability_requirements: ["filesystem", "shell", "files", "downloads"],
    });
    expect(result.id).toBe("run_1");
  });

  it("lists and fetches runs", async () => {
    get
      .mockResolvedValueOnce({
        data: [
          {
            id: "run_1",
            target_kind: "sandbox",
            target_id: "sbx_1",
            runner: "codex",
            instruction: "build it",
            status: "running",
          },
        ],
      })
      .mockResolvedValueOnce({
        data: {
          id: "run_1",
          target_kind: "sandbox",
          target_id: "sbx_1",
          runner: "codex",
          instruction: "build it",
          status: "running",
        },
      });

    const runs = new Runs(http);
    const listed = await runs.list({
      sandboxId: "sbx_1",
      status: "running",
      externalWorkspaceId: "clinic-iq",
      externalUserId: "founder-1",
      externalProjectId: "landing-page",
    });
    const fetched = await runs.get("run_1");

    expect(get).toHaveBeenNthCalledWith(1, "/runs", {
      sandbox_id: "sbx_1",
      external_workspace_id: "clinic-iq",
      external_user_id: "founder-1",
      external_project_id: "landing-page",
      status: "running",
    });
    expect(get).toHaveBeenNthCalledWith(2, "/runs/run_1");
    expect(listed[0]?.id).toBe("run_1");
    expect(fetched.id).toBe("run_1");
  });

  it("preserves reserved computer target fields in the request body", async () => {
    post.mockResolvedValueOnce({
      data: {
        id: "run_2",
        target_kind: "computer",
        target_id: "cmp_1",
        runner: "codex",
        instruction: "test the browser",
        status: "failed",
      },
    });

    await new Runs(http).run({
      computerId: "cmp_1",
      targetKind: "computer",
      runner: "codex",
      instruction: "test the browser",
    });

    expect(post).toHaveBeenCalledWith("/runs", {
      instruction: "test the browser",
      target_kind: "computer",
      computer_id: "cmp_1",
      runner: "codex",
    });
  });

  it("cancels a run", async () => {
    post.mockResolvedValueOnce({
      data: {
        id: "run_1",
        target_kind: "sandbox",
        target_id: "sbx_1",
        runner: "codex",
        instruction: "build it",
        status: "canceled",
      },
    });

    const result = await new Runs(http).cancel("run_1");

    expect(post).toHaveBeenCalledWith("/runs/run_1/cancel", {});
    expect(result.status).toBe("canceled");
  });

  it("lists and downloads run files", async () => {
    get.mockResolvedValueOnce({
      data: [
        {
          id: "file_1",
          path: "/workspace/report.html",
          kind: "html",
          mime_type: "text/html",
        },
      ],
    });
    getBinary.mockResolvedValueOnce(new Uint8Array([60, 104, 49, 62]));

    const runs = new Runs(http);
    const files = await runs.files("run_1");
    const bytes = await runs.downloadFile("run_1", "file_1", { inline: true });

    expect(get).toHaveBeenCalledWith("/runs/run_1/files");
    expect(getBinary).toHaveBeenCalledWith(
      "/runs/run_1/files/file_1/download?disposition=inline",
    );
    expect(files[0]).toMatchObject({ id: "file_1", kind: "html" });
    expect(bytes).toEqual(new Uint8Array([60, 104, 49, 62]));
  });

  it("reads output bundles, files, and file downloads", async () => {
    get
      .mockResolvedValueOnce({
        data: {
          run_id: "run_1",
          status: "succeeded",
          result: { type: "message", id: "run_1:result", text: "done" },
          message: "done",
          messages: [],
          command_output: { stdout: "done", stderr: "", exit_code: 0 },
          activity: [],
          files: [{ id: "file_1", path: "/workspace/report.html", kind: "html" }],
          downloads: [],
          previews: [],
          diagnostics: [],
        },
      })
      .mockResolvedValueOnce({
        data: [{ id: "file_1", path: "/workspace/report.html", kind: "html" }],
      });
    getBinary.mockResolvedValueOnce(new Uint8Array([60, 104, 49, 62]));

    const runs = new Runs(http);
    const outputs = await runs.outputs("run_1");
    const files = await runs.files("run_1");
    const bytes = await runs.downloadFile("run_1", "file_1", { inline: true });

    expect(get).toHaveBeenNthCalledWith(1, "/runs/run_1/outputs");
    expect(get).toHaveBeenNthCalledWith(2, "/runs/run_1/files");
    expect(getBinary).toHaveBeenCalledWith(
      "/runs/run_1/files/file_1/download?disposition=inline",
    );
    expect(outputs.result).toMatchObject({ type: "message", text: "done" });
    expect(files[0]).toMatchObject({ id: "file_1", kind: "html" });
    expect(bytes).toEqual(new Uint8Array([60, 104, 49, 62]));
  });

  it("lists and streams run activity", async () => {
    get.mockResolvedValueOnce({
      data: [
        {
          id: "evt_1",
          run_id: "run_1",
          sequence: 1,
          type: "run.created",
        },
      ],
    });
    stream.mockReturnValueOnce((async function* () {
      yield { id: "evt_2", type: "command.finished" };
    })());

    const runs = new Runs(http);
    const activity = await runs.activity("run_1");
    const streamIterator = runs.streamActivity("run_1");
    const streamed = await streamIterator.next();

    expect(get).toHaveBeenCalledWith("/runs/run_1/activity");
    expect(stream).toHaveBeenCalledWith("/runs/run_1/activity");
    expect(activity[0]).toMatchObject({ id: "evt_1", type: "run.created" });
    expect(streamed.value).toMatchObject({ id: "evt_2", type: "command.finished" });
  });

  it("reads command output separately from messages", async () => {
    get.mockResolvedValueOnce({
      data: { stdout: "done", stderr: "", exit_code: 0 },
    });

    const output = await new Runs(http).commandOutput("run_1");

    expect(get).toHaveBeenCalledWith("/runs/run_1/command-output");
    expect(output).toMatchObject({ stdout: "done", exit_code: 0 });
  });

  it("waits for run completion", async () => {
    get
      .mockResolvedValueOnce({
        data: { id: "run_1", status: "running", instruction: "build it" },
      })
      .mockResolvedValueOnce({
        data: { id: "run_1", status: "succeeded", instruction: "build it" },
      });

    const result = await new Runs(http).waitForCompletion("run_1", {
      pollIntervalMs: 0,
      timeoutMs: 1000,
    });

    expect(get).toHaveBeenNthCalledWith(1, "/runs/run_1");
    expect(get).toHaveBeenNthCalledWith(2, "/runs/run_1");
    expect(result.status).toBe("succeeded");
  });
});
