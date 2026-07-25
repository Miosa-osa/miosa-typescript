import type { HttpClient } from "../http.js";

type WireEnvelope<T> = T | { data: T };

function unwrap<T>(payload: WireEnvelope<T>): T {
  if (
    payload !== null &&
    typeof payload === "object" &&
    "data" in payload &&
    (payload as { data?: unknown }).data !== undefined
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function stripUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

export type CloudProvider = "aws" | "gcp" | string;
export type CloudAccountMode = "miosa_managed" | "customer_byoc" | string;
export type CloudCredentialType =
  | "miosa_owned"
  | "assume_role"
  | "access_key_smoke"
  | "service_account"
  | string;
export type CloudAccountStatus =
  | "draft"
  | "preflight_required"
  | "preflight_failed"
  | "ready"
  | "disabled"
  | "error"
  | string;
export type CloudPoolKind = "cloudburst" | "standing_byoc" | string;
export type CloudPlacementScope = "sandbox" | "computer" | "deployment" | "mixed" | string;
export type CloudPreflightStatus = "pass" | "warn" | "fail" | string;

export interface CloudAccount {
  id: string;
  tenant_id?: string;
  tenantId?: string;
  provider: CloudProvider;
  mode: CloudAccountMode;
  display_name?: string;
  displayName?: string;
  external_account_id?: string | null;
  externalAccountId?: string | null;
  credential_type?: CloudCredentialType;
  credentialType?: CloudCredentialType;
  role_arn?: string | null;
  roleArn?: string | null;
  external_id?: string | null;
  externalId?: string | null;
  default_region?: string | null;
  defaultRegion?: string | null;
  status?: CloudAccountStatus;
  last_preflight_run_id?: string | null;
  lastPreflightRunId?: string | null;
  created_by_user_id?: string | null;
  createdByUserId?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface CloudRegion {
  id: string;
  cloud_account_id?: string;
  cloudAccountId?: string;
  provider: CloudProvider;
  provider_region?: string;
  providerRegion?: string;
  provider_zone?: string | null;
  providerZone?: string | null;
  display_name?: string;
  displayName?: string;
  guest_supernet?: string | null;
  guestSupernet?: string | null;
  artifact_manifest_uri?: string | null;
  artifactManifestUri?: string | null;
  network_ref?: string | null;
  networkRef?: string | null;
  subnet_ref?: string | null;
  subnetRef?: string | null;
  security_group_refs?: string[];
  securityGroupRefs?: string[];
  instance_profile_ref?: string | null;
  instanceProfileRef?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CloudPool {
  id: string;
  cloud_region_id?: string;
  cloudRegionId?: string;
  pool_kind?: CloudPoolKind;
  poolKind?: CloudPoolKind;
  node_type?: string;
  nodeType?: string;
  instance_type?: string;
  instanceType?: string;
  target_nodes?: number;
  targetNodes?: number;
  max_nodes?: number;
  maxNodes?: number;
  ttl_seconds?: number | null;
  ttlSeconds?: number | null;
  max_hourly_cents?: number | null;
  maxHourlyCents?: number | null;
  placement_scope?: CloudPlacementScope;
  placementScope?: CloudPlacementScope;
  status?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CloudPreflightRun {
  id: string;
  cloud_account_id?: string | null;
  cloudAccountId?: string | null;
  cloud_region_id?: string | null;
  cloudRegionId?: string | null;
  provider: CloudProvider;
  status: CloudPreflightStatus;
  checks?: Record<string, unknown>;
  raw_report?: Record<string, unknown>;
  rawReport?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface CloudAccountCreateParams {
  provider: CloudProvider;
  mode: CloudAccountMode;
  displayName?: string;
  display_name?: string;
  externalAccountId?: string;
  external_account_id?: string;
  credentialType?: CloudCredentialType;
  credential_type?: CloudCredentialType;
  defaultRegion?: string;
  default_region?: string;
  metadata?: Record<string, unknown>;
}

export interface AttachAwsRoleParams {
  roleArn?: string;
  role_arn?: string;
  defaultRegion?: string;
  default_region?: string;
}

export interface CloudRegionCreateParams {
  cloudAccountId?: string;
  cloud_account_id?: string;
  providerRegion?: string;
  provider_region?: string;
  providerZone?: string;
  provider_zone?: string;
  displayName?: string;
  display_name?: string;
  guestSupernet?: string;
  guest_supernet?: string;
  artifactManifestUri?: string;
  artifact_manifest_uri?: string;
  networkRef?: string;
  network_ref?: string;
  subnetRef?: string;
  subnet_ref?: string;
  securityGroupRefs?: string[];
  security_group_refs?: string[];
  instanceProfileRef?: string;
  instance_profile_ref?: string;
  metadata?: Record<string, unknown>;
}

export interface CloudPoolCreateParams {
  cloudRegionId?: string;
  cloud_region_id?: string;
  poolKind?: CloudPoolKind;
  pool_kind?: CloudPoolKind;
  nodeType?: string;
  node_type?: string;
  instanceType?: string;
  instance_type?: string;
  targetNodes?: number;
  target_nodes?: number;
  maxNodes?: number;
  max_nodes?: number;
  ttlSeconds?: number;
  ttl_seconds?: number;
  maxHourlyCents?: number;
  max_hourly_cents?: number;
  placementScope?: CloudPlacementScope;
  placement_scope?: CloudPlacementScope;
  metadata?: Record<string, unknown>;
}

export interface CloudPreflightRecordParams {
  cloudAccountId?: string;
  cloud_account_id?: string;
  cloudRegionId?: string;
  cloud_region_id?: string;
  provider: CloudProvider;
  status: CloudPreflightStatus;
  checks?: Record<string, unknown>;
  rawReport?: Record<string, unknown>;
  raw_report?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CloudListParams {
  cloudAccountId?: string;
  cloud_account_id?: string;
  cloudRegionId?: string;
  cloud_region_id?: string;
  limit?: number;
}

function accountBody(params: CloudAccountCreateParams): Record<string, unknown> {
  return stripUndefined({
    provider: params.provider,
    mode: params.mode,
    display_name: params.displayName ?? params.display_name,
    external_account_id: params.externalAccountId ?? params.external_account_id,
    credential_type: params.credentialType ?? params.credential_type,
    default_region: params.defaultRegion ?? params.default_region,
    metadata: params.metadata,
  });
}

function regionBody(params: CloudRegionCreateParams): Record<string, unknown> {
  return stripUndefined({
    cloud_account_id: params.cloudAccountId ?? params.cloud_account_id,
    provider_region: params.providerRegion ?? params.provider_region,
    provider_zone: params.providerZone ?? params.provider_zone,
    display_name: params.displayName ?? params.display_name,
    guest_supernet: params.guestSupernet ?? params.guest_supernet,
    artifact_manifest_uri:
      params.artifactManifestUri ?? params.artifact_manifest_uri,
    network_ref: params.networkRef ?? params.network_ref,
    subnet_ref: params.subnetRef ?? params.subnet_ref,
    security_group_refs: params.securityGroupRefs ?? params.security_group_refs,
    instance_profile_ref: params.instanceProfileRef ?? params.instance_profile_ref,
    metadata: params.metadata,
  });
}

function poolBody(params: CloudPoolCreateParams): Record<string, unknown> {
  return stripUndefined({
    cloud_region_id: params.cloudRegionId ?? params.cloud_region_id,
    pool_kind: params.poolKind ?? params.pool_kind,
    node_type: params.nodeType ?? params.node_type,
    instance_type: params.instanceType ?? params.instance_type,
    target_nodes: params.targetNodes ?? params.target_nodes,
    max_nodes: params.maxNodes ?? params.max_nodes,
    ttl_seconds: params.ttlSeconds ?? params.ttl_seconds,
    max_hourly_cents: params.maxHourlyCents ?? params.max_hourly_cents,
    placement_scope: params.placementScope ?? params.placement_scope,
    metadata: params.metadata,
  });
}

function preflightBody(params: CloudPreflightRecordParams): Record<string, unknown> {
  return stripUndefined({
    cloud_account_id: params.cloudAccountId ?? params.cloud_account_id,
    cloud_region_id: params.cloudRegionId ?? params.cloud_region_id,
    provider: params.provider,
    status: params.status,
    checks: params.checks,
    raw_report: params.rawReport ?? params.raw_report,
    metadata: params.metadata,
  });
}

function query(params: CloudListParams = {}): Record<string, string | number | undefined> {
  return stripUndefined({
    cloud_account_id: params.cloudAccountId ?? params.cloud_account_id,
    cloud_region_id: params.cloudRegionId ?? params.cloud_region_id,
    limit: params.limit,
  }) as Record<string, string | number | undefined>;
}

export class Cloud {
  constructor(private readonly http: HttpClient) {}

  async listAccounts(): Promise<CloudAccount[]> {
    return unwrap(
      await this.http.get<WireEnvelope<CloudAccount[]>>("/cloud/accounts"),
    );
  }

  async createAccount(params: CloudAccountCreateParams): Promise<CloudAccount> {
    return unwrap(
      await this.http.post<WireEnvelope<CloudAccount>>(
        "/cloud/accounts",
        accountBody(params),
      ),
    );
  }

  async attachAwsRole(id: string, params: AttachAwsRoleParams): Promise<CloudAccount> {
    return unwrap(
      await this.http.post<WireEnvelope<CloudAccount>>(
        `/cloud/accounts/${encodeURIComponent(id)}/aws/role`,
        stripUndefined({
          role_arn: params.roleArn ?? params.role_arn,
          default_region: params.defaultRegion ?? params.default_region,
        }),
      ),
    );
  }

  async listRegions(params: CloudListParams = {}): Promise<CloudRegion[]> {
    return unwrap(
      await this.http.get<WireEnvelope<CloudRegion[]>>(
        "/cloud/regions",
        query(params),
      ),
    );
  }

  async createRegion(params: CloudRegionCreateParams): Promise<CloudRegion> {
    return unwrap(
      await this.http.post<WireEnvelope<CloudRegion>>(
        "/cloud/regions",
        regionBody(params),
      ),
    );
  }

  async listPools(params: CloudListParams = {}): Promise<CloudPool[]> {
    return unwrap(
      await this.http.get<WireEnvelope<CloudPool[]>>("/cloud/pools", query(params)),
    );
  }

  async createPool(params: CloudPoolCreateParams): Promise<CloudPool> {
    return unwrap(
      await this.http.post<WireEnvelope<CloudPool>>(
        "/cloud/pools",
        poolBody(params),
      ),
    );
  }

  async listPreflights(params: CloudListParams = {}): Promise<CloudPreflightRun[]> {
    return unwrap(
      await this.http.get<WireEnvelope<CloudPreflightRun[]>>(
        "/cloud/preflights",
        query(params),
      ),
    );
  }

  async recordPreflight(params: CloudPreflightRecordParams): Promise<CloudPreflightRun> {
    return unwrap(
      await this.http.post<WireEnvelope<CloudPreflightRun>>(
        "/cloud/preflights",
        preflightBody(params),
      ),
    );
  }
}
