import { HttpClient } from "./http.js";
import { Admin } from "./resources/admin.js";
import { AgentRunGroups } from "./resources/agent-run-groups.js";
import { AgentRuns } from "./resources/agent-runs.js";
import { RunGroups } from "./resources/run-groups.js";
import { AgentRuntimeProfiles } from "./resources/agent-runtime-profiles.js";
import { AgentDefinitions } from "./resources/agent-definitions.js";
import { Runs } from "./resources/runs.js";
import { Analytics } from "./resources/analytics.js";
import { ApiKeys } from "./resources/api-keys.js";
import { AppDocuments } from "./resources/app-documents.js";
import { AuditLog } from "./resources/audit-log.js";
import { Benchmarks } from "./resources/benchmarks.js";
import { BuilderSessions } from "./resources/builder-sessions.js";
import { Channels } from "./resources/channels.js";
import { Cloud } from "./resources/cloud.js";
import { CommandCenter } from "./resources/command-center.js";
import { Community } from "./resources/community.js";
import { Completions } from "./resources/completions.js";
import { Computers } from "./resources/computers.js";
import { Connectors } from "./resources/connectors.js";
import { Credits } from "./resources/credits.js";
import { CronJobs } from "./resources/cron-jobs.js";
import { Dashboard } from "./resources/dashboard.js";
import { Databases } from "./resources/databases.js";
import { Deployments } from "./resources/deployments.js";
import { Devices } from "./resources/devices.js";
import { DockerDeploy } from "./resources/docker-deploy.js";
import { EgressAudit } from "./resources/egressAudit.js";
import { EgressNetwork } from "./resources/egressNetwork.js";
import { EgressSecrets } from "./resources/egressSecrets.js";
import { Email } from "./resources/email.js";
import { Embeddings } from "./resources/embeddings.js";
import { ExternalKeys } from "./resources/external-keys.js";
import { FlatCustomDomains } from "./resources/flat-custom-domains.js";
import { Functions } from "./resources/functions.js";
import { Forge } from "./resources/forge.js";
import { HealthChecks } from "./resources/health-checks.js";
import { Integrations } from "./resources/integrations.js";
import { Mcp } from "./resources/mcp.js";
import { Models } from "./resources/models.js";
import { OpenComputers } from "./resources/open-computers/index.js";
import { ProjectAuth } from "./resources/project-auth.js";
import { ProjectIntegrations } from "./resources/project-integrations.js";
import { ProviderDefaults } from "./resources/provider-defaults.js";
import { Regions } from "./resources/regions.js";
import { RuntimeEnv } from "./resources/runtime-env.js";
import { RuntimeCapabilitiesResource } from "./resources/runtime-capabilities.js";
import { Sandboxes } from "./resources/sandboxes.js";
import { SandboxTemplates } from "./resources/sandbox-templates.js";
import { Settings } from "./resources/settings.js";
import { SnapshotsStandalone } from "./resources/snapshots-standalone.js";
import { Storage } from "./resources/storage.js";
import { OrgInvites } from "./resources/org-invites.js";
import { Organizations } from "./resources/organizations.js";
import { Tenant } from "./resources/tenant.js";
import { Templates } from "./resources/templates.js";
import { Usage } from "./resources/usage.js";
import { Volumes } from "./resources/volumes.js";
import { Webhooks } from "./resources/webhooks.js";
import { WorkspaceInvites } from "./resources/workspace-invites.js";
import { WorkspaceMembers } from "./resources/workspace-members.js";
import type { MiosaClientConfig } from "./types.js";

const DEFAULT_BASE_URL = "https://api.miosa.ai/api/v1";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * The top-level MIOSA client.
 *
 * @example
 * ```ts
 * import { Miosa } from '@miosa/sdk';
 *
 * const miosa = new Miosa({ apiKey: 'msk_u_...' });
 *
 * const computer = await miosa.computers.create({ name: 'my-agent' });
 * await computer.start();
 * ```
 */
export class Miosa {
  /** Per-workspace user roster — list, add, update role, remove. */
  readonly workspaceMembers: WorkspaceMembers;

  /**
   * Workspace invite flow — create invite, list, revoke, preview, accept.
   * Sending to an email already in the org adds the user directly.
   */
  readonly workspaceInvites: WorkspaceInvites;

  /**
   * Org invite flow — create invite, list, revoke, preview, accept.
   * Requires admin/owner role for write operations.
   */
  readonly orgInvites: OrgInvites;
  /** Organizations available to the user session, membership, invites, and switching. */
  readonly organizations: Organizations;
  readonly forge: Forge;

  /** Current tenant plan, limits, and live usage counters. */
  readonly tenant: Tenant;

  /** Datacenter regions, compute sizes, pricing, community templates. */
  readonly regions: Regions;

  /** Tenant settings — workspace config, branding, BYOK provider keys. */
  readonly settings: Settings;

  /** Aggregated platform dashboard and health overview. */
  readonly dashboard: Dashboard;

  /** Admin-scoped analytics overview and timeseries metrics. */
  readonly analytics: Analytics;

  /** Admin-scoped audit log event stream. */
  readonly auditLog: AuditLog;

  /** Current-period usage summary, sessions, and report queries. */
  readonly usage: Usage;

  /** Notification channels — Slack, Discord, email, etc. */
  readonly channels: Channels;

  /** Cloud accounts / BYOC / cloudburst control-plane state. */
  readonly cloud: Cloud;

  /** OAuth integrations — GitHub, Slack, Linear, Discord. */
  readonly integrations: Integrations;

  /** Per-project integrations (Stripe, Resend, Twilio, etc.). */
  readonly projectIntegrations: ProjectIntegrations;

  /** Built-in auth for generated apps inside sandboxes/deployments. */
  readonly projectAuth: ProjectAuth;

  /** Durable generated App Documents, exact-version reviews, and publication bindings. */
  readonly appDocuments: AppDocuments;

  /** BYOK encrypted per-user provider keys. */
  readonly externalKeys: ExternalKeys;

  /** Model Context Protocol — JSON-RPC dispatch + streaming channel. */
  readonly mcp: Mcp;

  /** Runs - instruction dispatch into sandbox and computer targets. */
  readonly runs: Runs;

  /** Run groups - durable multi-run orchestration groups. */
  readonly runGroups: RunGroups;

  /** Agent runs - compatibility API for prompt dispatch. */
  readonly agentRuns: AgentRuns;

  /** Agent run groups - compatibility API for multi-agent orchestration. */
  readonly agentRunGroups: AgentRunGroups;

  /** Agent runtime profiles — tenant/workspace defaults for sandbox/computer agents. */
  readonly agentRuntimeProfiles: AgentRuntimeProfiles;

  /** Persisted workspace Agent definitions and immutable versions. */
  readonly agents: AgentDefinitions;

  /** MIOSA Connect — provider connectors and runtime tokens. */
  readonly connectors: Connectors;

  /** Inherited runtime env — tenant/workspace/project defaults for agent runtimes. */
  readonly runtimeEnv: RuntimeEnv;

  /** Runtime capabilities — live backend feature and contract discovery. */
  readonly runtimeCapabilities: RuntimeCapabilitiesResource;

  /** Unified devices — sandbox workers and desktop computers behind one API. */
  readonly devices: Devices;

  /** Computer management — create, list, get, delete. */
  readonly computers: Computers;

  /** Sandboxes — native code-execution environments under `/sandboxes`. */
  readonly sandboxes: Sandboxes;

  /**
   * Deployments — publish from a sandbox to a stable production URL.
   * Versions, releases, rollback, custom domains.
   */
  readonly deployments: Deployments;

  /** App Engine appliance hosts — one always-on workspace host, many apps. */
  readonly dockerDeploy: DockerDeploy;

  /** Credit balance and usage. */
  readonly credits: Credits;

  /** Admin surface (`/api/v1/admin/*`) — requires an admin credential. */
  readonly admin: Admin;

  /**
   * OpenComputers — BYOC host management: register your own machines and use
   * them like cloud computers (jobs, files, tunnels, AI agents, clusters).
   */
  readonly openComputers: OpenComputers;

  /** Managed Postgres databases — lifecycle, credentials, logs. */
  readonly databases: Databases;

  /** Managed object storage — buckets, objects, presigned URLs. */
  readonly storage: Storage;

  /** Persistent block storage volumes. */
  readonly volumes: Volumes;

  /** Tenant-scoped custom domains across all resources. */
  readonly customDomains: FlatCustomDomains;

  /** Serverless edge functions — CRUD and invoke. */
  readonly functions: Functions;

  /** Scheduled cron jobs — CRUD, pause/resume, execution history. */
  readonly cronJobs: CronJobs;

  /** Uptime health checks. */
  readonly healthChecks: HealthChecks;

  /** Outgoing tenant webhooks — CRUD, test, delivery history. */
  readonly webhooks: Webhooks;

  /** Sandbox templates — CRUD, build-spec schema, builds. */
  readonly sandboxTemplates: SandboxTemplates;

  /** Product-aware templates — catalog/readiness for sandbox, computer, appliance. */
  readonly templates: Templates;

  /** API key management — list, create, delete. */
  readonly apiKeys: ApiKeys;

  // ── P3 / P4 resources ──────────────────────────────────────────────────────

  /** Available LLM models via the intelligence gateway. */
  readonly models: Models;

  /** OpenAI-compatible text + chat completions (supports SSE streaming). */
  readonly completions: Completions;

  /** OpenAI-compatible embedding vectors. */
  readonly embeddings: Embeddings;

  /** Admin: fleet-wide + per-tenant LLM provider routing defaults. */
  readonly providerDefaults: ProviderDefaults;

  /** Admin: trigger + inspect platform benchmark runs. */
  readonly benchmarks: Benchmarks;

  /** Read-only views of the Optimal AI agent fleet. */
  readonly commandCenter: CommandCenter;

  /** Community template + agent catalog. */
  readonly community: Community;

  /** Admin email campaigns, templates, and inbox. */
  readonly email: Email;

  /** Builder UI session metadata. */
  readonly builderSessions: BuilderSessions;

  /** Admin: fleet-wide snapshot index. */
  readonly snapshotsStandalone: SnapshotsStandalone;

  // ── Egress (security) namespaces ───────────────────────────────────────────

  /** Encrypted secret + OAuth credential vault (`/egress/secrets`). */
  readonly secrets: EgressSecrets;

  /** Egress allowlist + policies — host-level firewall (`/egress/policies`). */
  readonly network: EgressNetwork;

  /** Egress audit log — every outbound request, paginated query + tail. */
  readonly audit: EgressAudit;

  private readonly http: HttpClient;

  constructor(config: MiosaClientConfig) {
    if (config.apiKey && config.accessToken) {
      throw new Error("Miosa: pass either apiKey or accessToken, not both.");
    }
    const credential = config.accessToken ?? config.apiKey;
    if (!credential) {
      throw new Error(
        'Miosa: apiKey or accessToken is required.',
      );
    }

    if (config.apiKey && !config.apiKey.startsWith("msk_")) {
      // Soft warning — allow non-standard keys in tests / self-hosted
      console.warn(
        '[miosa] Warning: API key does not start with "msk_". Double-check your key.',
      );
    }

    this.http = new HttpClient({
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      apiKey: credential,
      ...(config.tenant ? { tenant: config.tenant } : {}),
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    });

    this.workspaceMembers = new WorkspaceMembers(this.http);
    this.workspaceInvites = new WorkspaceInvites(this.http);
    this.orgInvites = new OrgInvites(this.http);
    this.organizations = new Organizations(this.http);
    this.forge = new Forge(this.http);
    this.tenant = new Tenant(this.http);
    this.regions = new Regions(this.http);
    this.settings = new Settings(this.http);
    this.dashboard = new Dashboard(this.http);
    this.analytics = new Analytics(this.http);
    this.auditLog = new AuditLog(this.http);
    this.usage = new Usage(this.http);
    this.channels = new Channels(this.http);
    this.cloud = new Cloud(this.http);
    this.integrations = new Integrations(this.http);
    this.projectIntegrations = new ProjectIntegrations(this.http);
    this.projectAuth = new ProjectAuth(this.http);
    this.appDocuments = new AppDocuments(this.http);
    this.externalKeys = new ExternalKeys(this.http);
    this.mcp = new Mcp(this.http);
    this.runs = new Runs(this.http);
    this.runGroups = new RunGroups(this.http);
    this.agentRuns = new AgentRuns(this.http);
    this.agentRunGroups = new AgentRunGroups(this.http);
    this.agentRuntimeProfiles = new AgentRuntimeProfiles(this.http);
    this.agents = new AgentDefinitions(this.http);
    this.connectors = new Connectors(this.http);
    this.runtimeEnv = new RuntimeEnv(this.http);
    this.runtimeCapabilities = new RuntimeCapabilitiesResource(this.http);
    this.devices = new Devices(this.http);
    this.computers = new Computers(this.http);
    this.sandboxes = new Sandboxes(this.http);
    this.deployments = new Deployments(this.http);
    this.dockerDeploy = new DockerDeploy(this.http);
    this.credits = new Credits(this.http);
    this.admin = new Admin(this.http);
    this.openComputers = new OpenComputers(this.http);
    this.databases = new Databases(this.http);
    this.storage = new Storage(this.http);
    this.volumes = new Volumes(this.http);
    this.customDomains = new FlatCustomDomains(this.http);
    this.functions = new Functions(this.http);
    this.cronJobs = new CronJobs(this.http);
    this.healthChecks = new HealthChecks(this.http);
    this.webhooks = new Webhooks(this.http);
    this.sandboxTemplates = new SandboxTemplates(this.http);
    this.templates = new Templates(this.http);
    this.apiKeys = new ApiKeys(this.http);
    this.models = new Models(this.http);
    this.completions = new Completions(this.http);
    this.embeddings = new Embeddings(this.http);
    this.providerDefaults = new ProviderDefaults(this.http);
    this.benchmarks = new Benchmarks(this.http);
    this.commandCenter = new CommandCenter(this.http);
    this.community = new Community(this.http);
    this.email = new Email(this.http);
    this.builderSessions = new BuilderSessions(this.http);
    this.snapshotsStandalone = new SnapshotsStandalone(this.http);
    // Egress (security) namespaces
    this.secrets = new EgressSecrets(this.http);
    this.network = new EgressNetwork(this.http);
    this.audit = new EgressAudit(this.http);
  }
}
