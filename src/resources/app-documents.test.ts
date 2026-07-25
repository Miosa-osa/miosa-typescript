import { describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../http.js";
import { AppDocuments, type AppDocument } from "./app-documents.js";

const document: AppDocument = {
  id: "app-local",
  name: "Triage board",
  format: "miosa-app/v1",
  view: { kind: "generated", source: "<main>Triage</main>" },
  capabilities: ["computer.exec"],
  collections: ["tickets"],
  connectors: ["linear"],
  automations: [],
  pins: [],
};

describe("AppDocuments", () => {
  it("creates a workspace-bound durable App Document", async () => {
    const post = vi.fn().mockResolvedValue({
      data: { id: "app-record", document },
    });
    const resource = new AppDocuments({ post } as unknown as HttpClient);

    const created = await resource.create({
      workspaceId: "workspace-1",
      name: document.name,
      document,
    });

    expect(post).toHaveBeenCalledWith("/builder/apps", {
      workspace_id: "workspace-1",
      name: document.name,
      document,
    });
    expect(created.id).toBe("app-record");
  });

  it("lists only the selected workspace", async () => {
    const get = vi.fn().mockResolvedValue({ data: [{ id: "app-record" }] });
    const resource = new AppDocuments({ get } as unknown as HttpClient);

    expect(await resource.list("workspace-1")).toEqual([{ id: "app-record" }]);
    expect(get).toHaveBeenCalledWith("/builder/apps", {
      workspace_id: "workspace-1",
    });
  });

  it("uses declared app collection routes with exact record versions", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [{ key: "cust_1", value: { name: "Ada" }, version: 1 }],
    });
    const put = vi.fn().mockResolvedValue({
      data: { key: "cust_1", value: { name: "Grace" }, version: 2 },
    });
    const del = vi.fn().mockResolvedValue(undefined);
    const resource = new AppDocuments({
      get,
      put,
      delete: del,
    } as unknown as HttpClient);

    expect(await resource.listData("app", "customers")).toHaveLength(1);
    expect(
      (
        await resource.putData(
          "app",
          "customers",
          "cust_1",
          { name: "Grace" },
          1,
        )
      ).version,
    ).toBe(2);
    await resource.deleteData("app", "customers", "cust_1", 2);

    expect(put).toHaveBeenCalledWith(
      "/builder/apps/app/data/customers/cust_1",
      { value: { name: "Grace" }, expected_version: 1 },
    );
    expect(del).toHaveBeenCalledWith(
      "/builder/apps/app/data/customers/cust_1?expected_version=2",
    );
  });

  it("routes app callbacks through release-pinned platform authority", async () => {
    const request = vi.fn().mockResolvedValue({
      decision: "allow",
      receipt_id: "receipt-1",
    });
    const resource = new AppDocuments({ request } as unknown as HttpClient);

    await expect(
      resource.authorizeAction("app-1", {
        releaseId: "release-1",
        callbackToken: "app-callback-token",
        capability: {
          name: "deployment.list",
          fingerprint: `sha256:${"a".repeat(64)}`,
        },
        requestFingerprint: "request:1",
        paramsFingerprint: "sha256:params",
        connectorId: "connector-1",
      }),
    ).resolves.toEqual({ decision: "allow", receipt_id: "receipt-1" });

    expect(request).toHaveBeenCalledWith("/actions/apps/app-1/authorize", {
      method: "POST",
      headers: {
        "x-miosa-app-callback-token": "app-callback-token",
      },
      body: {
        release_id: "release-1",
        capability: {
          name: "deployment.list",
          fingerprint: `sha256:${"a".repeat(64)}`,
        },
        request_fingerprint: "request:1",
        params_fingerprint: "sha256:params",
        connector_id: "connector-1",
      },
    });
  });

  it("mints a release-pinned runtime token and resolves receipt-backed bindings", async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        token: "callback-token",
        release_id: "release-1",
        expires_in: 300,
      },
    });
    const request = vi.fn().mockResolvedValue({
      data: {
        binding_id: "invoice-total",
        receipt_id: "receipt-1",
        capability_fingerprint: "sha256:capability",
        value: [42, 7],
      },
    });
    const resource = new AppDocuments({
      post,
      request,
    } as unknown as HttpClient);

    const runtime = await resource.mintRuntimeToken("app-1");
    const binding = await resource.resolveBinding(
      "app-1",
      "invoice-total",
      "receipt-1",
      runtime.token,
    );

    expect(runtime.release_id).toBe("release-1");
    expect(binding.value).toEqual([42, 7]);
    expect(request).toHaveBeenCalledWith(
      "/builder/apps/app-1/runtime/bindings/invoice-total?receipt_id=receipt-1",
      {
        method: "GET",
        headers: {
          "x-miosa-app-callback-token": "callback-token",
        },
      },
    );
  });

  it("uses durable automation claim and completion endpoints", async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "run-1", status: "running" } })
      .mockResolvedValueOnce({
        data: {
          id: "run-1",
          status: "executing",
          claim: {
            cursor: 0,
            idempotency_key: "run-1:0",
            receipt_id: "receipt-1",
          },
        },
      })
      .mockResolvedValueOnce({ data: { id: "run-1", status: "completed" } });
    const resource = new AppDocuments({ post } as unknown as HttpClient);

    await resource.startAutomationRun("app-1", "daily");
    const claimed = await resource.claimAutomationStep("app-1", "run-1");
    await resource.completeAutomationStep(
      "app-1",
      "run-1",
      0,
      claimed.claim!.idempotency_key,
      { count: 2 },
    );

    expect(post).toHaveBeenNthCalledWith(
      3,
      "/builder/apps/app-1/automation-runs/run-1/complete",
      {
        cursor: 0,
        idempotency_key: "run-1:0",
        output: { count: 2 },
      },
    );
  });

  it("captures, approves, publishes, and revokes one exact immutable release", async () => {
    const get = vi.fn().mockResolvedValue({
      data: { ok: true, issues: [], manifest: {} },
    });
    const post = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          deployment_id: "deployment-1",
          deployment_version_id: "version-1",
          release_id: "release-1",
          artifact_sha256: "artifact-sha",
          source_snapshot_sha256: "source-sha",
        },
      })
      .mockResolvedValueOnce({
        data: { id: "approval-1", version_hash: "sha256:exact" },
      })
      .mockResolvedValueOnce({
        data: {
          app: { id: "app-record", state: "published" },
          deployment_id: "deployment-1",
          release_id: "release-1",
        },
      })
      .mockResolvedValueOnce(undefined);
    const resource = new AppDocuments({ get, post } as unknown as HttpClient);

    expect((await resource.diagnostics("app-record")).ok).toBe(true);
    const candidate = await resource.stageCandidate("app-record");
    const approval = await resource.approveExactVersion(
      "app-record",
      candidate.release_id,
      "reviewed",
    );
    expect((await resource.publishExactRelease("app-record")).state).toBe(
      "published",
    );
    await resource.revokeApproval("app-record", approval.id);

    expect(post).toHaveBeenNthCalledWith(
      1,
      "/builder/apps/app-record/candidates",
      {},
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/builder/apps/app-record/approvals",
      { reason: "reviewed", release_id: "release-1" },
    );
    expect(post).toHaveBeenNthCalledWith(
      3,
      "/builder/apps/app-record/publish",
      {},
    );
    expect(post).toHaveBeenNthCalledWith(
      4,
      "/builder/apps/app-record/approvals/approval-1/revoke",
      {},
    );
  });
});
