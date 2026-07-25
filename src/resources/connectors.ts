/**
 * MIOSA Connect — provider connectors and runtime tokens.
 *
 * Connect is the product-facing credential layer. Egress remains the runtime
 * enforcement layer underneath it.
 */

import type { HttpClient } from "../http.js";

export type ConnectorSubject =
  | { type: "app" }
  | { type: "user"; id: string; issuer?: string }
  | {
      type: "jwt-bearer";
      sub: string;
      iss?: string;
      aud?: string;
      additionalClaims?: Record<string, unknown>;
    };

export interface ConnectorData {
  id?: string;
  uid?: string;
  name?: string;
  provider?: string;
  type?: string;
  scope?: string;
  status?: string;
  managed?: boolean;
  display_name?: string;
  displayName?: string;
  masked_value?: string | null;
  expires_at?: string | null;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ExternalAttributionParams {
  externalUserId?: string;
  external_user_id?: string;
  externalWorkspaceId?: string;
  external_workspace_id?: string;
  externalProjectId?: string;
  external_project_id?: string;
}

export interface ConnectorListParams extends ExternalAttributionParams {
  scope?: string;
  workspaceId?: string;
  workspace_id?: string;
  ownerUserId?: string;
  owner_user_id?: string;
}

export interface ConnectorCreateParams extends ExternalAttributionParams {
  provider: string;
  name?: string;
  uid?: string;
  type?: string;
  scope?: string;
  workspaceId?: string;
  workspace_id?: string;
  ownerUserId?: string;
  owner_user_id?: string;
  value?: string;
  token?: string;
  apiKey?: string;
  api_key?: string;
  credential?: {
    field?: string;
    value: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ConnectorTokenParams extends ExternalAttributionParams {
  subject?: ConnectorSubject;
  installationId?: string;
  installation_id?: string;
  projectId?: string;
  project_id?: string;
  environment?: string;
  resourceType?: string;
  resource_type?: string;
  resourceId?: string;
  resource_id?: string;
  scopes?: string[];
  scope?: string[];
  audience?: string[];
  validityBufferMs?: number;
  validity_buffer_ms?: number;
}

export interface ConnectorTokenResponse {
  token: string;
  expires_at?: string | number | null;
  expiresAt?: string | number | null;
  connector?: {
    id?: string;
    uid?: string;
    type?: string;
    [key: string]: unknown;
  };
  name?: string;
  installation_id?: string;
  installationId?: string;
  subject?: ConnectorSubject | Record<string, unknown>;
  scopes?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ConnectorInstallation {
  id?: string;
  connector_id?: string;
  connectorId?: string;
  installation_id?: string;
  installationId?: string;
  workspace_id?: string | null;
  workspaceId?: string | null;
  subject_type?: string;
  subjectType?: string;
  scope?: string;
  status?: string;
  scopes?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ConnectorOauthProvider {
  id?: string;
  provider?: string;
  display_name?: string;
  displayName?: string;
  scopes?: string[];
  branding?: Record<string, unknown>;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface ConnectorOauthStartParams extends ExternalAttributionParams {
  provider: string;
  scope?: string;
  exposeAsEnv?: boolean;
  expose_as_env?: boolean;
  ownerUserId?: string;
  owner_user_id?: string;
}

export interface ConnectorOauthStartResponse {
  authorize_url?: string;
  authorizeUrl?: string;
  state?: string;
  [key: string]: unknown;
}

export interface ConnectorProjectLink {
  id?: string;
  connector_id?: string;
  connectorId?: string;
  installation_id?: string | null;
  installationId?: string | null;
  workspace_id?: string | null;
  workspaceId?: string | null;
  project_id?: string | null;
  projectId?: string | null;
  environment?: string;
  resource_type?: string | null;
  resourceType?: string | null;
  resource_id?: string | null;
  resourceId?: string | null;
  allowed_subjects?: string[];
  allowedSubjects?: string[];
  allowed_scopes?: string[];
  allowedScopes?: string[];
  mode?: string;
  effect?: string;
  external_workspace_id?: string | null;
  externalWorkspaceId?: string | null;
  external_user_id?: string | null;
  externalUserId?: string | null;
  external_project_id?: string | null;
  externalProjectId?: string | null;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ConnectorProjectLinkParams extends ExternalAttributionParams {
  connector?: string;
  connectorId?: string;
  connector_id?: string;
  installationId?: string;
  installation_id?: string;
  workspaceId?: string;
  workspace_id?: string;
  projectId?: string;
  project_id?: string;
  environment?: string;
  resourceType?: string;
  resource_type?: string;
  resourceId?: string;
  resource_id?: string;
  allowedSubjects?: string[];
  allowed_subjects?: string[];
  allowedScopes?: string[];
  allowed_scopes?: string[];
  mode?: "token-api" | "token_api" | "brokered-env" | "brokered_env" | "plain-env" | "plain_env" | string;
  effect?: "allow" | "deny" | string;
  metadata?: Record<string, unknown>;
}

export interface ConnectorLinkListParams extends ExternalAttributionParams {
  workspaceId?: string;
  workspace_id?: string;
  projectId?: string;
  project_id?: string;
  connectorId?: string;
  connector_id?: string;
  environment?: string;
  status?: string;
}

export interface ConnectorDefault extends ConnectorProjectLink {
  default_scope?: string;
  defaultScope?: string;
  target?: string;
}

export interface ConnectorDefaultParams extends ConnectorProjectLinkParams {
  defaultScope?: string;
  default_scope?: string;
  target?: "all" | "sandbox" | "computer" | "agent" | "deployment" | string;
}

export interface ConnectorDefaultListParams extends ConnectorLinkListParams {
  defaultScope?: string;
  default_scope?: string;
  target?: string;
}

export interface ConnectorTrigger {
  id?: string;
  connector_id?: string;
  connectorId?: string;
  workspace_id?: string | null;
  workspaceId?: string | null;
  project_id?: string | null;
  projectId?: string | null;
  environment?: string;
  destination_path?: string | null;
  destinationPath?: string | null;
  destination_url?: string | null;
  destinationUrl?: string | null;
  event_types?: string[];
  eventTypes?: string[];
  status?: string;
  provider_adapter?: "generic" | "github" | "slack" | string;
  providerAdapter?: "generic" | "github" | "slack" | string;
  signing_secret_preview?: string | null;
  signingSecretPreview?: string | null;
  webhook_signing_secret?: string;
  webhookSigningSecret?: string;
  metadata?: Record<string, unknown>;
  webhook_token?: string;
  webhookToken?: string;
  [key: string]: unknown;
}

export interface ConnectorTriggerParams extends ExternalAttributionParams {
  connector?: string;
  connectorId?: string;
  connector_id?: string;
  workspaceId?: string;
  workspace_id?: string;
  projectId?: string;
  project_id?: string;
  environment?: string;
  destinationPath?: string;
  destination_path?: string;
  destinationUrl?: string;
  destination_url?: string;
  eventTypes?: string[];
  event_types?: string[];
  status?: string;
  providerAdapter?: "generic" | "github" | "slack" | string;
  provider_adapter?: "generic" | "github" | "slack" | string;
  webhookSigningSecret?: string;
  webhook_signing_secret?: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectorTriggerListParams extends ConnectorLinkListParams {}

export interface ConnectorTriggerDelivery {
  id?: string;
  trigger_id?: string;
  triggerId?: string;
  connector_id?: string;
  connectorId?: string;
  event_type?: string;
  eventType?: string;
  provider_delivery_id?: string | null;
  providerDeliveryId?: string | null;
  state?: string;
  attempts?: number;
  destination_url?: string | null;
  destinationUrl?: string | null;
  status_code?: number | null;
  statusCode?: number | null;
  error?: string | null;
  latency_ms?: number | null;
  latencyMs?: number | null;
  delivered_at?: string | null;
  deliveredAt?: string | null;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ConnectorTriggerDeliveryListParams extends ConnectorLinkListParams {
  triggerId?: string;
  trigger_id?: string;
  eventType?: string;
  event_type?: string;
}

export interface ConnectorApplicableDefaultParams extends ExternalAttributionParams {
  workspaceId?: string;
  workspace_id?: string;
  projectId?: string;
  project_id?: string;
  environment?: string;
  target?: "all" | "sandbox" | "computer" | "agent" | "deployment" | string;
  resourceType?: string;
  resource_type?: string;
  resourceId?: string;
  resource_id?: string;
}

export interface ConnectorMaterializeDefaultsParams extends ConnectorApplicableDefaultParams {
  envName?: string;
  env_name?: string;
}

export interface ConnectorMaterializeDefaultsResult {
  applied?: number;
  results?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface SandboxConnectorBinding {
  id?: string;
  secret_id?: string;
  connector?: string;
  resource_id?: string;
  resource_type?: string;
  exposure?: string;
  expose_as_env?: string;
  env?: string;
  sync?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SandboxConnectorAttachParams {
  connector: string;
  env: string;
  mode?: "brokered-env" | "brokered_env" | "plain-env" | "plain_env" | string;
  installationId?: string;
  installation_id?: string;
  projectId?: string;
  project_id?: string;
  environment?: string;
  externalUserId?: string;
  external_user_id?: string;
  externalWorkspaceId?: string;
  external_workspace_id?: string;
  externalProjectId?: string;
  external_project_id?: string;
}

export interface SandboxConnectorPreflightParams {
  connector?: string;
  provider?: string;
}

export interface SandboxConnectorPreflightResult {
  sandbox_id?: string;
  sandboxId?: string;
  provider?: string;
  connector?: string;
  status?: Record<string, unknown>;
  sync?: Record<string, unknown>;
  [key: string]: unknown;
}

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const key of ["data", "binding"]) {
      if (key in p) return p[key] as T;
    }
  }
  return payload as T;
}

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const key of ["data", "connectors", "items"]) {
      if (Array.isArray(p[key])) return p[key] as T[];
    }
  }
  return [];
}

function stripUndefined(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

function pickFirst<T>(...values: Array<T | undefined>): T | undefined {
  for (const value of values) if (value !== undefined) return value;
  return undefined;
}

function externalAttributionParams(
  params: ExternalAttributionParams = {},
): Record<string, unknown> {
  return {
    external_user_id: pickFirst(params.externalUserId, params.external_user_id),
    external_workspace_id: pickFirst(
      params.externalWorkspaceId,
      params.external_workspace_id,
    ),
    external_project_id: pickFirst(
      params.externalProjectId,
      params.external_project_id,
    ),
  };
}

function queryFromListParams(
  params: ConnectorListParams,
): Record<string, string | number | boolean | undefined> {
  return stripUndefined({
    scope: params.scope,
    workspace_id: pickFirst(params.workspaceId, params.workspace_id),
    owner_user_id: pickFirst(params.ownerUserId, params.owner_user_id),
    ...externalAttributionParams(params),
  }) as Record<string, string | number | boolean | undefined>;
}

function bodyFromCreateParams(
  provider: string,
  params: Omit<ConnectorCreateParams, "provider">,
): Record<string, unknown> {
  const credential =
    params.credential &&
    typeof params.credential === "object" &&
    !Array.isArray(params.credential)
      ? (params.credential as {
          field?: string;
          value?: string;
          [key: string]: unknown;
        })
      : undefined;
  const value = pickFirst(
    params.value,
    params.token,
    params.apiKey,
    params.api_key,
    credential?.value,
  );
  return stripUndefined({
    provider,
    type: String(params.type ?? "api_key").replaceAll("-", "_"),
    name: params.name,
    uid: params.uid ?? `${provider}/${params.name ?? "default"}`,
    scope: params.scope,
    workspace_id: pickFirst(params.workspaceId, params.workspace_id),
    owner_user_id: pickFirst(params.ownerUserId, params.owner_user_id),
    ...externalAttributionParams(params),
    credential: value
      ? {
          field: credential?.field ?? "api_key",
          value,
          ...Object.fromEntries(
            Object.entries(credential ?? {}).filter(
              ([key]) => key !== "value" && key !== "field",
            ),
          ),
        }
      : credential,
  });
}

function tokenBody(params: ConnectorTokenParams = {}): Record<string, unknown> {
  return stripUndefined({
    subject: params.subject ?? { type: "app" },
    installation_id: pickFirst(params.installationId, params.installation_id),
    project_id: pickFirst(params.projectId, params.project_id),
    environment: params.environment,
    resource_type: pickFirst(params.resourceType, params.resource_type),
    resource_id: pickFirst(params.resourceId, params.resource_id),
    scopes: pickFirst(params.scopes, params.scope),
    audience: params.audience,
    ...externalAttributionParams(params),
    validity_buffer_ms: pickFirst(
      params.validityBufferMs,
      params.validity_buffer_ms,
    ),
  });
}

function queryFromLinkParams(
  params: ConnectorLinkListParams = {},
): Record<string, string | number | boolean | undefined> {
  return stripUndefined({
    workspace_id: pickFirst(params.workspaceId, params.workspace_id),
    project_id: pickFirst(params.projectId, params.project_id),
    connector_id: pickFirst(params.connectorId, params.connector_id),
    environment: params.environment,
    status: params.status,
    ...externalAttributionParams(params),
  }) as Record<string, string | number | boolean | undefined>;
}

function queryFromDefaultParams(
  params: ConnectorDefaultListParams = {},
): Record<string, string | number | boolean | undefined> {
  return stripUndefined({
    ...queryFromLinkParams(params),
    default_scope: pickFirst(params.defaultScope, params.default_scope),
    target: params.target,
  }) as Record<string, string | number | boolean | undefined>;
}

function queryFromApplicableDefaultParams(
  params: ConnectorApplicableDefaultParams = {},
): Record<string, string | number | boolean | undefined> {
  return stripUndefined({
    workspace_id: pickFirst(params.workspaceId, params.workspace_id),
    project_id: pickFirst(params.projectId, params.project_id),
    environment: params.environment,
    target: params.target,
    resource_type: pickFirst(params.resourceType, params.resource_type),
    resource_id: pickFirst(params.resourceId, params.resource_id),
    ...externalAttributionParams(params),
  }) as Record<string, string | number | boolean | undefined>;
}

function materializeDefaultsBody(
  params: ConnectorMaterializeDefaultsParams = {},
): Record<string, unknown> {
  return stripUndefined({
    workspace_id: pickFirst(params.workspaceId, params.workspace_id),
    project_id: pickFirst(params.projectId, params.project_id),
    environment: params.environment,
    target: params.target,
    resource_type: pickFirst(params.resourceType, params.resource_type),
    resource_id: pickFirst(params.resourceId, params.resource_id),
    env_name: pickFirst(params.envName, params.env_name),
    ...externalAttributionParams(params),
  });
}


function projectLinkBody(
  params: ConnectorProjectLinkParams,
): Record<string, unknown> {
  return stripUndefined({
    connector: params.connector,
    connector_id: pickFirst(params.connectorId, params.connector_id),
    installation_id: pickFirst(params.installationId, params.installation_id),
    workspace_id: pickFirst(params.workspaceId, params.workspace_id),
    project_id: pickFirst(params.projectId, params.project_id),
    environment: params.environment,
    resource_type: pickFirst(params.resourceType, params.resource_type),
    resource_id: pickFirst(params.resourceId, params.resource_id),
    allowed_subjects: pickFirst(
      params.allowedSubjects,
      params.allowed_subjects,
    ),
    allowed_scopes: pickFirst(params.allowedScopes, params.allowed_scopes),
    mode: params.mode?.replaceAll("-", "_"),
    effect: params.effect,
    ...externalAttributionParams(params),
    metadata: params.metadata,
  });
}

function defaultBody(params: ConnectorDefaultParams): Record<string, unknown> {
  return stripUndefined({
    ...projectLinkBody(params),
    default_scope: pickFirst(params.defaultScope, params.default_scope),
    target: params.target,
  });
}

function triggerBody(params: ConnectorTriggerParams): Record<string, unknown> {
  return stripUndefined({
    connector: params.connector,
    connector_id: pickFirst(params.connectorId, params.connector_id),
    workspace_id: pickFirst(params.workspaceId, params.workspace_id),
    project_id: pickFirst(params.projectId, params.project_id),
    environment: params.environment,
    destination_path: pickFirst(params.destinationPath, params.destination_path),
    destination_url: pickFirst(params.destinationUrl, params.destination_url),
    event_types: pickFirst(params.eventTypes, params.event_types),
    status: params.status,
    provider_adapter: pickFirst(params.providerAdapter, params.provider_adapter),
    webhook_signing_secret: pickFirst(
      params.webhookSigningSecret,
      params.webhook_signing_secret,
    ),
    ...externalAttributionParams(params),
    metadata: params.metadata,
  });
}

function queryFromTriggerDeliveryParams(
  params: ConnectorTriggerDeliveryListParams = {},
): Record<string, string | number | boolean | undefined> {
  return stripUndefined({
    ...queryFromLinkParams(params),
    trigger_id: pickFirst(params.triggerId, params.trigger_id),
    event_type: pickFirst(params.eventType, params.event_type),
  }) as Record<string, string | number | boolean | undefined>;
}

function connectorPath(connector: string): string {
  return encodeURIComponent(connector);
}

export class Connectors {
  constructor(private readonly http: HttpClient) {}

  /** List Connect provider connectors visible to the current tenant/workspace. */
  async list(params: ConnectorListParams = {}): Promise<ConnectorData[]> {
    const data = await this.http.get<unknown>(
      "/connect/connectors",
      queryFromListParams(params),
    );
    return unwrapList<ConnectorData>(data);
  }

  /** Show one connector by UID or id. */
  async get(connector: string): Promise<ConnectorData> {
    const data = await this.http.get<unknown>(
      `/connect/connectors/${connectorPath(connector)}`,
    );
    return unwrap<ConnectorData>(data);
  }

  show(connector: string): Promise<ConnectorData> {
    return this.get(connector);
  }

  /** Create an API-key backed connector. Raw values are never returned later. */
  async create(
    provider: string,
    params: Omit<ConnectorCreateParams, "provider">,
  ): Promise<ConnectorData> {
    const data = await this.http.post<unknown>(
      "/connect/connectors",
      bodyFromCreateParams(provider, params),
    );
    return unwrap<ConnectorData>(data);
  }

  /** Request a runtime provider token for a connector. */
  async getToken(
    connector: string,
    params: ConnectorTokenParams = {},
  ): Promise<ConnectorTokenResponse> {
    const data = await this.http.post<unknown>(
      `/connect/token/${connectorPath(connector)}`,
      tokenBody(params),
    );
    return unwrap<ConnectorTokenResponse>(data);
  }

  token(
    connector: string,
    params: ConnectorTokenParams = {},
  ): Promise<ConnectorTokenResponse> {
    return this.getToken(connector, params);
  }

  /** List OAuth app providers available for end-user authorization. */
  async oauthProviders(): Promise<ConnectorOauthProvider[]> {
    const data = await this.http.get<unknown>("/connect/oauth/providers");
    return unwrapList<ConnectorOauthProvider>(data);
  }

  /** Start an OAuth authorization flow for a provider-backed connector. */
  async startOauth(
    params: ConnectorOauthStartParams,
  ): Promise<ConnectorOauthStartResponse> {
    const data = await this.http.post<unknown>(
      "/connect/oauth/start",
      stripUndefined({
        provider: params.provider,
        scope: params.scope,
        expose_as_env: pickFirst(params.exposeAsEnv, params.expose_as_env),
        owner_user_id: pickFirst(params.ownerUserId, params.owner_user_id),
        ...externalAttributionParams(params),
      }),
    );
    return unwrap<ConnectorOauthStartResponse>(data);
  }

  /** List connector installations/grants. */
  async installations(
    params: ConnectorLinkListParams = {},
  ): Promise<ConnectorInstallation[]> {
    const data = await this.http.get<unknown>(
      "/connect/installations",
      queryFromLinkParams(params),
    );
    return unwrapList<ConnectorInstallation>(data);
  }

  /** List project/environment connector links. */
  async projectLinks(
    params: ConnectorLinkListParams = {},
  ): Promise<ConnectorProjectLink[]> {
    const data = await this.http.get<unknown>(
      "/connect/project-links",
      queryFromLinkParams(params),
    );
    return unwrapList<ConnectorProjectLink>(data);
  }

  /** List inherited connector defaults for tenant/workspace/project runtimes. */
  async defaults(
    params: ConnectorDefaultListParams = {},
  ): Promise<ConnectorDefault[]> {
    const data = await this.http.get<unknown>(
      "/connect/defaults",
      queryFromDefaultParams(params),
    );
    return unwrapList<ConnectorDefault>(data);
  }

  /** Resolve inherited connector defaults that apply to a runtime target. */
  async applicableDefaults(
    params: ConnectorApplicableDefaultParams = {},
  ): Promise<ConnectorDefault[]> {
    const data = await this.http.get<unknown>(
      "/connect/defaults/applicable",
      queryFromApplicableDefaultParams(params),
    );
    return unwrapList<ConnectorDefault>(data);
  }

  /** Materialize inherited connector defaults onto one runtime resource. */
  async materializeDefaults(
    params: ConnectorMaterializeDefaultsParams,
  ): Promise<ConnectorMaterializeDefaultsResult> {
    const data = await this.http.post<unknown>(
      "/connect/defaults/materialize",
      materializeDefaultsBody(params),
    );
    return unwrap<ConnectorMaterializeDefaultsResult>(data);
  }

  /** Create an inherited connector default for future runtime resources. */
  async createDefault(
    params: ConnectorDefaultParams,
  ): Promise<ConnectorDefault> {
    const data = await this.http.post<unknown>(
      "/connect/defaults",
      defaultBody(params),
    );
    return unwrap<ConnectorDefault>(data);
  }

  /** Delete an inherited connector default. */
  async deleteDefault(id: string): Promise<void> {
    await this.http.delete<unknown>(`/connect/defaults/${connectorPath(id)}`);
  }

  /** List inbound provider trigger forwarding definitions. */
  async triggers(
    params: ConnectorTriggerListParams = {},
  ): Promise<ConnectorTrigger[]> {
    const data = await this.http.get<unknown>(
      "/connect/triggers",
      queryFromLinkParams(params),
    );
    return unwrapList<ConnectorTrigger>(data);
  }

  /** Create an inbound provider trigger forwarding definition. */
  async createTrigger(params: ConnectorTriggerParams): Promise<ConnectorTrigger> {
    const data = await this.http.post<unknown>(
      "/connect/triggers",
      triggerBody(params),
    );
    return unwrap<ConnectorTrigger>(data);
  }

  /** List inbound provider trigger delivery attempts. */
  async triggerDeliveries(
    params: ConnectorTriggerDeliveryListParams = {},
  ): Promise<ConnectorTriggerDelivery[]> {
    const data = await this.http.get<unknown>(
      "/connect/trigger-deliveries",
      queryFromTriggerDeliveryParams(params),
    );
    return unwrapList<ConnectorTriggerDelivery>(data);
  }

  /** List delivery attempts for one trigger. */
  async triggerDeliveryHistory(triggerId: string): Promise<ConnectorTriggerDelivery[]> {
    const data = await this.http.get<unknown>(
      `/connect/triggers/${connectorPath(triggerId)}/deliveries`,
    );
    return unwrapList<ConnectorTriggerDelivery>(data);
  }

  /** Delete an inbound provider trigger forwarding definition. */
  async deleteTrigger(id: string): Promise<void> {
    await this.http.delete<unknown>(`/connect/triggers/${connectorPath(id)}`);
  }

  /** Link a connector to a project/environment/resource. */
  async createProjectLink(
    params: ConnectorProjectLinkParams,
  ): Promise<ConnectorProjectLink> {
    const data = await this.http.post<unknown>(
      "/connect/project-links",
      projectLinkBody(params),
    );
    return unwrap<ConnectorProjectLink>(data);
  }

  /** Delete a project connector link. */
  async deleteProjectLink(id: string): Promise<void> {
    await this.http.delete<unknown>(`/connect/project-links/${connectorPath(id)}`);
  }
}

class RuntimeConnectors {
  constructor(
    private readonly http: HttpClient,
    private readonly basePath: string,
  ) {}

  /** List provider connector bindings for this runtime resource. */
  async list(): Promise<SandboxConnectorBinding[]> {
    const data = await this.http.get<unknown>(this.basePath);
    return unwrapList<SandboxConnectorBinding>(data);
  }

  /** Attach a connector to this runtime resource as a brokered env var. */
  async attach(
    params: SandboxConnectorAttachParams,
  ): Promise<SandboxConnectorBinding> {
    const data = await this.http.post<unknown>(
      this.basePath,
      stripUndefined({
        connector: params.connector,
        env_name: params.env,
        mode: params.mode?.replaceAll("-", "_"),
        installation_id: pickFirst(
          params.installationId,
          params.installation_id,
        ),
        project_id: pickFirst(params.projectId, params.project_id),
        environment: params.environment,
        ...externalAttributionParams(params),
      }),
    );
    return unwrap<SandboxConnectorBinding>(data);
  }

  /** Detach a connector binding by binding id or connector UID. */
  async detach(bindingOrConnector: string): Promise<void> {
    await this.http.delete<unknown>(`${this.basePath}/${connectorPath(bindingOrConnector)}`);
  }

  /** Sync or materialize connector placeholder env vars for this runtime resource. */
  async sync(): Promise<Record<string, unknown>> {
    const data = await this.http.post<unknown>(`${this.basePath}/sync`, {});
    return unwrap<Record<string, unknown>>(data);
  }

  /** Verify a required connector is attached before agent work begins. */
  async preflight(
    params: SandboxConnectorPreflightParams = {},
  ): Promise<SandboxConnectorPreflightResult> {
    const data = await this.http.post<unknown>(
      `${this.basePath}/preflight`,
      stripUndefined(params as Record<string, unknown>),
    );
    return unwrap<SandboxConnectorPreflightResult>(data);
  }
}

export class SandboxConnectors extends RuntimeConnectors {
  constructor(http: HttpClient, sandboxId: string) {
    super(http, `/sandboxes/${sandboxId}/connectors`);
  }
}

export class ComputerConnectors extends RuntimeConnectors {
  constructor(http: HttpClient, computerId: string) {
    super(http, `/computers/${computerId}/connectors`);
  }
}

export class DeploymentConnectors extends RuntimeConnectors {
  constructor(http: HttpClient, deploymentId: string) {
    super(http, `/deployments/${deploymentId}/connectors`);
  }
}
