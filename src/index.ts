// Main client
export { Miosa } from "./client.js";

// OpenComputers namespace
export { OpenComputers } from "./resources/open-computers/index.js";
export type {
  // Hosts
  HostId,
  HostStatus,
  HostData,
  HostCreateParams,
  HostUpdateParams,
  HostListResponse,
  HostEvent,
  // Jobs
  JobId,
  JobStatus,
  JobData,
  JobRunParams,
  JobListResponse,
  JobEvent,
  JobEventType,
  // File system
  FsEntry,
  FsStat,
  FsListResponse,
  // Terminal / Desktop
  WsTicket,
  // Tunnels
  TunnelId,
  TunnelAuthMode,
  TunnelData,
  TunnelCreateParams,
  TunnelUpdateParams,
  TunnelListResponse,
  // Agents (OC-specific; main AgentSessionListResponse/AgentEvent live in types.ts)
  OcAgentSessionData,
  AgentDispatchParams,
  AgentSessionListResponse as OcAgentSessionListResponse,
  AgentEvent as OcAgentEvent,
  // Clusters
  ClusterId,
  ClusterStatus,
  ClusterData,
  ClusterCreateParams,
  ClusterListResponse,
  ClusterEvent,
  // Apps
  AppCatalogEntry,
  AppInstallData,
  AppInstallEvent,
  // Workspaces
  WorkspaceId,
  OcWorkspaceStatus,
  OcWorkspaceData,
  OcWorkspaceCreateParams,
  OcWorkspaceUpdateParams,
  OcWorkspaceListResponse,
  OcWorkspaceEvent,
  // Secrets
  SecretId,
  SecretData,
  SecretCreateParams,
  SecretUpdateParams,
} from "./resources/open-computers/index.js";

// Resource classes (useful for isinstance checks and extension)
export { Computer, ScopedFs } from "./resources/computer.js";
export { Computers } from "./resources/computers.js";
export { Desktop } from "./resources/desktop.js";
export { Exec } from "./resources/exec.js";
export { Files } from "./resources/files.js";
export { Credits } from "./resources/credits.js";
export { Admin } from "./resources/admin.js";
export type {
  ListAdminUsersParams,
  ListAdminTenantsParams,
  ListAdminComputersParams,
  ListAdminApiKeysParams,
  CreateAdminApiKeyParams,
  BulkUserActionParams,
} from "./resources/admin.js";
export {
  Sandbox,
  Sandboxes,
  SandboxArtifacts,
  SandboxCommands,
  SandboxFiles,
  SandboxPreview,
  SANDBOX_TEMPLATE,
} from "./resources/sandboxes.js";
export type {
  SandboxCreateParams,
  SandboxData,
  SandboxExecOptions,
  SandboxExecResult,
  SandboxId,
  SandboxListParams,
  SandboxState,
  SandboxBuildSpec,
  SandboxBuildSpecError,
  SandboxBuildSpecValidation,
  SandboxTemplate,
  SandboxTemplateBuild,
  SandboxTemplateBuildCreateParams,
  SandboxTemplateCreateParams,
  SandboxTemplateList,
} from "./resources/sandboxes.js";
export { Checkpoints } from "./resources/checkpoints.js";
export { NetworkPolicy } from "./resources/network_policy.js";
export {
  DeploymentDomains,
  DeploymentReleases,
  DeploymentRuntimeInstances,
  DeploymentVersions,
  Deployments,
} from "./resources/deployments.js";
export type {
  AddDomainParams,
  DeploymentBuildData,
  DeploymentCreateParams,
  DeploymentData,
  DeploymentId,
  DeploymentListParams,
  DeploymentReleaseData,
  DeploymentReleaseId,
  DeploymentServiceData,
  DeploymentServiceId,
  DeploymentServiceType,
  DeploymentSourceType,
  DeploymentState,
  DeploymentUpdateParams,
  DeploymentVersionData,
  DeploymentVersionId,
  DeploymentVersionKind,
  DeploymentVersionState,
  ExternalAttribution,
  PublishFromSandboxParams,
  PublishParams,
  PublishResult,
  RollbackParams,
  RuntimeInstanceData,
  RuntimeInstanceId,
  RuntimeInstanceState,
  RuntimeLogsResult,
  VersionListParams,
} from "./resources/deployments.js";
export type {
  SnapshotData,
  SnapshotStatus,
  SnapshotCreateParams,
  SnapshotRestoreResult,
  SnapshotListResponse,
  SnapshotProgressEvent,
} from "./resources/checkpoints.js";

// P1 resources
export { Databases } from "./resources/databases.js";
export type {
  DatabaseId,
  DatabaseData,
  DatabaseCredentials,
  DatabaseLogsResult,
  DatabaseListParams,
  DatabaseCreateParams,
  DatabaseLogsParams,
} from "./resources/databases.js";
export { Storage } from "./resources/storage.js";
export type {
  BucketId,
  BucketData,
  StorageObjectData,
  PresignResult,
  BucketCreateParams,
  ObjectListParams,
  PresignParams,
} from "./resources/storage.js";
export { Volumes } from "./resources/volumes.js";
export type {
  VolumeId,
  VolumeData,
  VolumeListParams,
  VolumeCreateParams,
} from "./resources/volumes.js";
export { FlatCustomDomains } from "./resources/flat-custom-domains.js";
export type {
  CustomDomainId,
  CustomDomainData,
  CustomDomainListParams,
  CustomDomainCreateParams,
} from "./resources/flat-custom-domains.js";
export { Functions } from "./resources/functions.js";
export type {
  FunctionId,
  FunctionData,
  FunctionListParams,
  FunctionCreateParams,
  FunctionUpdateParams,
  FunctionInvokeParams,
} from "./resources/functions.js";
export { CronJobs } from "./resources/cron-jobs.js";
export type {
  CronJobId,
  CronJobExecutionId,
  CronJobData,
  CronJobExecutionData,
  CronJobListParams,
  CronJobCreateParams,
  CronJobUpdateParams,
} from "./resources/cron-jobs.js";
export { HealthChecks } from "./resources/health-checks.js";
export type {
  HealthCheckId,
  HealthCheckData,
  HealthCheckListParams,
  HealthCheckCreateParams,
  HealthCheckUpdateParams,
} from "./resources/health-checks.js";
export { Webhooks } from "./resources/webhooks.js";
export type {
  WebhookId,
  WebhookDeliveryId,
  WebhookData,
  WebhookDeliveryData,
  WebhookListParams,
  WebhookCreateParams,
  WebhookUpdateParams,
} from "./resources/webhooks.js";
export { SandboxTemplates } from "./resources/sandbox-templates.js";
export type {
  SandboxTemplateResourceId,
  SandboxTemplateBuildResourceId,
  SandboxTemplateResourceData,
  SandboxTemplateBuildResourceData,
  SandboxTemplateListParams,
  TemplateCreateParams,
  TemplateBuildCreateParams,
} from "./resources/sandbox-templates.js";
export { ApiKeys } from "./resources/api-keys.js";
export type {
  ApiKeyId,
  ApiKeyData,
  ApiKeyCreateResult,
  ApiKeyListParams,
  ApiKeyCreateParams,
} from "./resources/api-keys.js";

// Members & Invites
export { WorkspaceMembers } from "./resources/workspace-members.js";
export type {
  WorkspaceRole,
  WorkspaceMember,
  WorkspaceMemberRecord,
  AddWorkspaceMemberParams,
  UpdateWorkspaceMemberRoleParams,
  WorkspaceMemberListResponse,
  WorkspaceMemberRecordResponse,
  WorkspaceMemberDeleteResponse,
} from "./resources/workspace-members.js";
export { WorkspaceInvites } from "./resources/workspace-invites.js";
export type {
  WorkspaceInvite,
  WorkspaceInvitePreview,
  CreateWorkspaceInviteParams,
  CreateWorkspaceInviteResponse,
  WorkspaceInviteCreatedResponse,
  WorkspaceMemberAddedResponse,
  WorkspaceInviteListResponse,
  WorkspaceInviteRevokeResponse,
  AcceptWorkspaceInviteResponse,
} from "./resources/workspace-invites.js";
export { OrgInvites } from "./resources/org-invites.js";
export type {
  OrgRole,
  OrgInvite,
  OrgInviteCreated,
  OrgInvitePreview,
  TenantSummary,
  CreateOrgInviteParams,
  OrgInviteCreatedResponse,
  OrgInviteListResponse,
  OrgInviteRevokeResponse,
  AcceptOrgInviteResponse,
} from "./resources/org-invites.js";

// P2 resources
export { Tenant } from "./resources/tenant.js";
export type { TenantPlan } from "./resources/tenant.js";
export { Regions } from "./resources/regions.js";
export type {
  RegionData,
  SizeData,
  TemplateData,
} from "./resources/regions.js";
export { Settings } from "./resources/settings.js";
export type {
  SettingsUpdateParams,
  BrandingUpdateParams,
  ProviderKeyUpsertParams,
} from "./resources/settings.js";
export { Dashboard } from "./resources/dashboard.js";
export type { DashboardSummary, OverviewData } from "./resources/dashboard.js";
export { Analytics } from "./resources/analytics.js";
export type {
  AnalyticsFilters,
  TimeseriesParams,
} from "./resources/analytics.js";
export { AuditLog } from "./resources/audit-log.js";
export type {
  AuditLogEvent,
  AuditLogListParams,
} from "./resources/audit-log.js";
export { Usage } from "./resources/usage.js";
export type {
  UsageSummary,
  UsageSession,
  UsageSessionsParams,
  UsageReportParams,
} from "./resources/usage.js";
export { Channels } from "./resources/channels.js";
export type {
  ChannelData,
  ChannelListParams,
  ChannelCreateParams,
  ChannelUpdateParams,
  NotificationPrefsUpdateParams,
} from "./resources/channels.js";
export { Integrations } from "./resources/integrations.js";
export type {
  IntegrationData,
  IntegrationCatalogEntry,
  GithubRepo,
  GithubSshKey,
  SlackSendTestParams,
  DiscordSendTestParams,
  LinearCreateIssueParams,
} from "./resources/integrations.js";
export { ProjectIntegrations } from "./resources/project-integrations.js";
export type {
  ProjectIntegrationData,
  ProjectIntegrationCatalogEntry,
  ProjectIntegrationListParams,
  ProjectIntegrationCreateParams,
  ProjectIntegrationUpdateParams,
} from "./resources/project-integrations.js";
export { ProjectAuth } from "./resources/project-auth.js";
export type {
  ProjectAuthStatus,
  ProjectAuthEnableParams,
  ProjectAuthUpdateParams,
} from "./resources/project-auth.js";
export { ExternalKeys } from "./resources/external-keys.js";
export type {
  ExternalKeyData,
  ExternalKeyCreateParams,
} from "./resources/external-keys.js";
export { Mcp } from "./resources/mcp.js";
export type { McpDispatchParams } from "./resources/mcp.js";

// P3 / P4 resources
export { Models } from "./resources/models.js";
export { Completions } from "./resources/completions.js";
export type {
  CompletionCreateParams,
  CompletionCreateStreamParams,
  ChatCompletionCreateParams,
  ChatCompletionCreateStreamParams,
} from "./resources/completions.js";
export { Embeddings } from "./resources/embeddings.js";
export type { EmbeddingCreateParams } from "./resources/embeddings.js";
export { ProviderDefaults } from "./resources/provider-defaults.js";
export { Benchmarks } from "./resources/benchmarks.js";
export type {
  BenchmarkCreateParams,
  BenchmarkCompareParams,
} from "./resources/benchmarks.js";
export { CommandCenter } from "./resources/command-center.js";
export { Community } from "./resources/community.js";
export {
  Email,
  EmailCampaigns,
  EmailTemplates,
  EmailInbox,
} from "./resources/email.js";
export { BuilderSessions } from "./resources/builder-sessions.js";
export type { BuilderSessionListParams } from "./resources/builder-sessions.js";
export { SnapshotsStandalone } from "./resources/snapshots-standalone.js";

// Computer sub-resources
export { ComputerInbox } from "./resources/computer.js";
export { ComputerTerminal } from "./resources/computer-terminal.js";
export type { TerminalCreateParams } from "./resources/computer-terminal.js";
export { ComputerOsa } from "./resources/computer-osa.js";
export { ComputerAutoStop } from "./resources/computer-auto-stop.js";
export { ComputerEnv } from "./resources/computer-env.js";
export { ComputerLogs } from "./resources/computer-logs.js";
export type { ComputerLogsGetParams } from "./resources/computer-logs.js";
export { ComputerPorts } from "./resources/computer-ports.js";
export { ComputerVolumes } from "./resources/computer-volumes.js";

// Sandbox sub-resources
export {
  SandboxTerminal,
  SandboxEvents,
  SandboxPreviews,
  SandboxEnv,
  SandboxTags,
} from "./resources/sandboxes.js";

// Egress (security) — secrets, network, audit
export {
  EgressSecrets,
  OAuthFlow,
  SandboxSecrets,
  ComputerSecrets,
} from "./resources/egressSecrets.js";
export type {
  EgressSecretType,
  EgressSecretScope,
  EgressSecretData,
  EgressBindingData,
  OauthProvider,
  SecretSetParams,
  SecretListParams,
  SecretRotateParams,
  BindingCreateParams,
  BindingListParams,
  OauthConnectParams,
  OauthStartResult,
  OauthStatusResult,
} from "./resources/egressSecrets.js";
export {
  EgressNetwork,
  SandboxNetwork,
  ComputerNetwork,
} from "./resources/egressNetwork.js";
export type {
  EgressPolicyMode,
  EgressRuleEffect,
  EgressPolicyData,
  EgressAllowlistRule,
  EgressSuggestion,
  AllowParams,
  PolicyCreateParams,
  PolicyUpdateParams,
  ModeParams,
  SuggestionsParams,
  PolicyListParams,
  RulesListParams,
} from "./resources/egressNetwork.js";
export {
  EgressAudit,
  SandboxAudit,
  ComputerAudit,
} from "./resources/egressAudit.js";
export type {
  EgressAuditEvent,
  AuditListParams,
  AuditTailParams,
} from "./resources/egressAudit.js";

// Error types
export {
  MiosaError,
  AuthError,
  NotFoundError,
  RateLimitError,
  InsufficientCreditsError,
  ValidationError,
  TimeoutError,
  NetworkError,
} from "./errors.js";

// All TypeScript types
export type {
  // Config
  MiosaClientConfig,
  // Computers
  ComputerId,
  SessionId,
  TenantId,
  ComputerSize,
  ComputerStatus,
  ComputerTemplateType,
  ComputerVisibility,
  ComputerData,
  ComputerCreateParams,
  ComputerUpdateParams,
  ComputerListParams,
  ComputerListResponse,
  // Network Policy
  NetworkPolicyEffect,
  NetworkPolicyProtocol,
  NetworkPolicyRule,
  NetworkPolicySetParams,
  NetworkPolicyData,
  // Desktop
  MouseButton,
  ScrollDirection,
  ClickParams,
  DoubleClickParams,
  TypeParams,
  KeyParams,
  ScrollParams,
  DragParams,
  WaitParams,
  WindowInfo,
  CursorInfo,
  WindowFocusParams,
  LaunchParams,
  DesktopActionResult,
  // Exec
  ExecParams,
  ExecPythonParams,
  ExecResult,
  // Files
  FileEntry,
  FileListParams,
  FileListResult,
  FileDownloadParams,
  FileDeleteParams,
  FileExportParams,
  FileExportResult,
  // Files — Phase-7 stdlib-parity
  FileStat,
  DirEntry,
  MkdirParams,
  CopyParams,
  DirListResult,
  // Agent / CUA
  AgentSessionStatus,
  AgentSessionCreateParams,
  AgentSessionData,
  AgentSessionListResponse,
  AgentEventType,
  AgentEvent,
  // Credits
  CreditBalance,
  CreditTransaction,
  CreditTransactionListResponse,
  CreditUsage,
} from "./types.js";
