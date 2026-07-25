import type { HttpClient } from "../http.js";

export type AppJson =
  null | boolean | number | string | AppJson[] | { [key: string]: AppJson };

export interface AppDocument {
  id: string;
  name: string;
  format: "miosa-app/v1";
  metadata?: Record<string, AppJson>;
  view:
    | {
        kind: "generated";
        source: string;
        artifact?: {
          entrypoint: string;
          files: Record<string, string>;
        };
      }
    | { kind: "served"; deploymentId: string; releaseId: string };
  capabilities: string[];
  collections: string[];
  connectors: string[];
  automations: Array<{
    id: string;
    trigger:
      { kind: "schedule"; cron: string } | { kind: "event"; event: string };
    steps: Array<{ capability: string; input: AppJson }>;
  }>;
  pins: Array<{
    slot: string;
    component: string;
    baseHash: string;
    source: string;
    editIntents: AppJson[];
  }>;
  bindings?: Array<{
    id: string;
    capability: string;
    samples: AppJson[];
    path: string[];
  }>;
}

export interface AppReleaseApproval {
  id: string;
  app_document_id: string;
  version_hash: string;
  approved_by_user_id: string | null;
  reason: string | null;
  compiled_requirements: Record<string, AppJson>;
  deployment_id: string | null;
  deployment_version_id: string | null;
  release_id: string | null;
  artifact_sha256: string | null;
  source_snapshot_sha256: string | null;
  approved_at: string;
  revoked_at: string | null;
  revoked_by_user_id: string | null;
}

export interface AppReleaseCandidate {
  deployment_id: string;
  deployment_version_id: string;
  release_id: string;
  artifact_sha256: string;
  source_snapshot_sha256: string;
}

export interface AppDocumentDiagnostics {
  ok: boolean;
  issues: Array<Record<string, AppJson>>;
  manifest: Record<string, AppJson> | null;
}

export interface AppCollectionRecord<
  T extends Record<string, AppJson> = Record<string, AppJson>,
> {
  key: string;
  collection: string;
  value: T;
  version: number;
  inserted_at: string;
  updated_at: string;
}

export interface AppPublication {
  deployment_id: string;
  release_id: string;
  version_hash: string;
  published_at: string;
}

export interface AppActionDecision {
  decision: "allow" | "pending_approval" | "deny";
  receipt_id?: string;
  approval_request_id?: string;
  reason?: string;
  capability?: Record<string, AppJson>;
}

export interface AppRuntimeToken {
  token: string;
  release_id: string;
  expires_in: number;
}

export interface AppBindingResolution {
  binding_id: string;
  receipt_id: string;
  capability_fingerprint: string;
  value: AppJson;
}

export interface AppAutomationRun {
  id: string;
  app_document_id: string;
  release_id: string;
  automation_id: string;
  trigger: Record<string, AppJson>;
  cursor: number;
  status:
    | "running"
    | "executing"
    | "waiting_approval"
    | "completed"
    | "failed"
    | "stopped";
  current_step: Record<string, AppJson> | null;
  claim: {
    receipt_id: string;
    idempotency_key: string;
    cursor: number;
  } | null;
  pending_approval_request_id: string | null;
  history: Array<Record<string, AppJson>>;
  last_error: Record<string, AppJson> | null;
  inserted_at: string;
  updated_at: string;
}

export interface AppDocumentRecord {
  id: string;
  tenant_id: string;
  workspace_id: string;
  created_by_user_id: string | null;
  name: string;
  document: AppDocument;
  version_hash: string;
  state: "draft" | "published" | "archived";
  version_approved: boolean;
  approval: AppReleaseApproval | null;
  publication: AppPublication | null;
  inserted_at: string;
  updated_at: string;
}

export interface AppDocumentCreateParams {
  workspaceId: string;
  name: string;
  document: AppDocument;
}

export interface AppDocumentUpdateParams {
  name?: string;
  document?: AppDocument;
}

interface DataEnvelope<T> {
  data: T;
}

interface ListEnvelope<T> {
  data: T[];
}

function unwrap<T>(payload: T | DataEnvelope<T>): T {
  return payload && typeof payload === "object" && "data" in payload
    ? payload.data
    : (payload as T);
}

export class AppDocuments {
  constructor(private readonly http: HttpClient) {}

  async list(workspaceId: string): Promise<AppDocumentRecord[]> {
    const payload = await this.http.get<ListEnvelope<AppDocumentRecord>>(
      "/builder/apps",
      { workspace_id: workspaceId },
    );
    return payload.data;
  }

  async get(id: string): Promise<AppDocumentRecord> {
    return unwrap(
      await this.http.get<AppDocumentRecord | DataEnvelope<AppDocumentRecord>>(
        `/builder/apps/${id}`,
      ),
    );
  }

  async create(params: AppDocumentCreateParams): Promise<AppDocumentRecord> {
    const { workspaceId, ...body } = params;
    return unwrap(
      await this.http.post<AppDocumentRecord | DataEnvelope<AppDocumentRecord>>(
        "/builder/apps",
        { ...body, workspace_id: workspaceId },
      ),
    );
  }

  async update(
    id: string,
    params: AppDocumentUpdateParams,
  ): Promise<AppDocumentRecord> {
    return unwrap(
      await this.http.patch<
        AppDocumentRecord | DataEnvelope<AppDocumentRecord>
      >(`/builder/apps/${id}`, params),
    );
  }

  async archive(id: string): Promise<void> {
    await this.http.delete(`/builder/apps/${id}`);
  }

  async diagnostics(id: string): Promise<AppDocumentDiagnostics> {
    return unwrap(
      await this.http.get<
        AppDocumentDiagnostics | DataEnvelope<AppDocumentDiagnostics>
      >(`/builder/apps/${id}/diagnostics`),
    );
  }

  async stageCandidate(id: string): Promise<AppReleaseCandidate> {
    return unwrap(
      await this.http.post<
        AppReleaseCandidate | DataEnvelope<AppReleaseCandidate>
      >(`/builder/apps/${id}/candidates`, {}),
    );
  }

  async approveExactVersion(
    id: string,
    releaseId: string,
    reason?: string,
  ): Promise<AppReleaseApproval> {
    return unwrap(
      await this.http.post<
        AppReleaseApproval | DataEnvelope<AppReleaseApproval>
      >(`/builder/apps/${id}/approvals`, {
        reason,
        release_id: releaseId,
      }),
    );
  }

  async publishExactRelease(id: string): Promise<AppDocumentRecord> {
    const payload = await this.http.post<
      | { app: AppDocumentRecord; deployment_id: string; release_id: string }
      | DataEnvelope<{
          app: AppDocumentRecord;
          deployment_id: string;
          release_id: string;
        }>
    >(`/builder/apps/${id}/publish`, {});
    return unwrap(payload).app;
  }

  async listData<T extends Record<string, AppJson> = Record<string, AppJson>>(
    id: string,
    collection: string,
  ): Promise<AppCollectionRecord<T>[]> {
    const payload = await this.http.get<ListEnvelope<AppCollectionRecord<T>>>(
      `/builder/apps/${encodeURIComponent(id)}/data/${encodeURIComponent(collection)}`,
    );
    return payload.data;
  }

  async getData<T extends Record<string, AppJson> = Record<string, AppJson>>(
    id: string,
    collection: string,
    key: string,
  ): Promise<AppCollectionRecord<T>> {
    return unwrap(
      await this.http.get<
        AppCollectionRecord<T> | DataEnvelope<AppCollectionRecord<T>>
      >(
        `/builder/apps/${encodeURIComponent(id)}/data/${encodeURIComponent(collection)}/${encodeURIComponent(key)}`,
      ),
    );
  }

  async putData<T extends Record<string, AppJson>>(
    id: string,
    collection: string,
    key: string,
    value: T,
    expectedVersion?: number,
  ): Promise<AppCollectionRecord<T>> {
    return unwrap(
      await this.http.put<
        AppCollectionRecord<T> | DataEnvelope<AppCollectionRecord<T>>
      >(
        `/builder/apps/${encodeURIComponent(id)}/data/${encodeURIComponent(collection)}/${encodeURIComponent(key)}`,
        { value, expected_version: expectedVersion },
      ),
    );
  }

  async deleteData(
    id: string,
    collection: string,
    key: string,
    expectedVersion?: number,
  ): Promise<void> {
    const suffix =
      expectedVersion === undefined
        ? ""
        : `?expected_version=${encodeURIComponent(String(expectedVersion))}`;
    await this.http.delete(
      `/builder/apps/${encodeURIComponent(id)}/data/${encodeURIComponent(collection)}/${encodeURIComponent(key)}${suffix}`,
    );
  }

  async authorizeAction(
    id: string,
    input: {
      releaseId: string;
      callbackToken: string;
      capability: Record<string, AppJson>;
      requestFingerprint: string;
      paramsFingerprint: string;
      connectorId?: string;
    },
  ): Promise<AppActionDecision> {
    return this.http.request<AppActionDecision>(
      `/actions/apps/${encodeURIComponent(id)}/authorize`,
      {
        method: "POST",
        headers: {
          "x-miosa-app-callback-token": input.callbackToken,
        },
        body: {
          release_id: input.releaseId,
          capability: input.capability,
          request_fingerprint: input.requestFingerprint,
          params_fingerprint: input.paramsFingerprint,
          connector_id: input.connectorId,
        },
      },
    );
  }

  async mintRuntimeToken(id: string): Promise<AppRuntimeToken> {
    return unwrap(
      await this.http.post<AppRuntimeToken | DataEnvelope<AppRuntimeToken>>(
        `/builder/apps/${encodeURIComponent(id)}/runtime-token`,
        {},
      ),
    );
  }

  async resolveBinding(
    id: string,
    bindingId: string,
    receiptId: string,
    callbackToken: string,
  ): Promise<AppBindingResolution> {
    return unwrap(
      await this.http.request<
        AppBindingResolution | DataEnvelope<AppBindingResolution>
      >(
        `/builder/apps/${encodeURIComponent(id)}/runtime/bindings/${encodeURIComponent(bindingId)}?receipt_id=${encodeURIComponent(receiptId)}`,
        {
          method: "GET",
          headers: {
            "x-miosa-app-callback-token": callbackToken,
          },
        },
      ),
    );
  }

  async listAutomationRuns(id: string): Promise<AppAutomationRun[]> {
    const payload = await this.http.get<ListEnvelope<AppAutomationRun>>(
      `/builder/apps/${encodeURIComponent(id)}/automation-runs`,
    );
    return payload.data;
  }

  async startAutomationRun(
    id: string,
    automationId: string,
    trigger: Record<string, AppJson> = {},
  ): Promise<AppAutomationRun> {
    return unwrap(
      await this.http.post<AppAutomationRun | DataEnvelope<AppAutomationRun>>(
        `/builder/apps/${encodeURIComponent(id)}/automations/${encodeURIComponent(automationId)}/runs`,
        { trigger },
      ),
    );
  }

  async claimAutomationStep(
    id: string,
    runId: string,
  ): Promise<AppAutomationRun> {
    return unwrap(
      await this.http.post<AppAutomationRun | DataEnvelope<AppAutomationRun>>(
        `/builder/apps/${encodeURIComponent(id)}/automation-runs/${encodeURIComponent(runId)}/claim`,
        {},
      ),
    );
  }

  async completeAutomationStep(
    id: string,
    runId: string,
    cursor: number,
    idempotencyKey: string,
    output: AppJson = null,
  ): Promise<AppAutomationRun> {
    return unwrap(
      await this.http.post<AppAutomationRun | DataEnvelope<AppAutomationRun>>(
        `/builder/apps/${encodeURIComponent(id)}/automation-runs/${encodeURIComponent(runId)}/complete`,
        {
          cursor,
          idempotency_key: idempotencyKey,
          output,
        },
      ),
    );
  }

  async failAutomationStep(
    id: string,
    runId: string,
    cursor: number,
    idempotencyKey: string,
    reason: string,
  ): Promise<AppAutomationRun> {
    return unwrap(
      await this.http.post<AppAutomationRun | DataEnvelope<AppAutomationRun>>(
        `/builder/apps/${encodeURIComponent(id)}/automation-runs/${encodeURIComponent(runId)}/fail`,
        {
          cursor,
          idempotency_key: idempotencyKey,
          reason,
        },
      ),
    );
  }

  async revokeApproval(id: string, approvalId: string): Promise<void> {
    await this.http.post(
      `/builder/apps/${id}/approvals/${approvalId}/revoke`,
      {},
    );
  }
}
