// ─── Shared primitives ──────────────────────────────────────────────────────

export type ComputerId = string & { readonly __brand: "ComputerId" };
export type SessionId = string & { readonly __brand: "SessionId" };
export type TenantId = string & { readonly __brand: "TenantId" };

// ─── Computers ───────────────────────────────────────────────────────────────

export type ComputerSize = "xs" | "small" | "medium" | "large" | "xl";
export type ComputerSizeInput = ComputerSize | "xlarge";
/**
 * Lifecycle states emitted by the control plane.
 *
 * Canonical states (what the server actually emits):
 *   provisioning  — VM is being created + booted (~30-50s on small tier)
 *   active        — running and reachable (same as legacy "running")
 *   paused        — RAM snapshot on disk, cold start available
 *   stopped       — explicitly halted
 *   error         — terminal failure; destroy and retry
 *   destroyed     — terminal; gone
 *
 * Legacy aliases (`running`, `starting`, `creating`, `stopping`) are kept
 * in the union so older callers still typecheck, but the server will emit
 * the canonical names. Treat `active` and `running` as synonymous.
 */
export type ComputerStatus =
  | "provisioning"
  | "active"
  | "paused"
  | "stopped"
  | "error"
  | "destroyed"
  // legacy — retained for backwards compatibility
  | "creating"
  | "starting"
  | "running"
  | "stopping";
/**
 * Template slug for the rootfs a computer boots into.
 *
 * - `miosa-desktop` — full KasmVNC + Xfce GUI (default)
 * - `miosa-sandbox` — lightweight code-exec rootfs, no desktop
 *
 * Additional templates can be added at the platform level; the type is kept
 * open so future templates don't require an SDK release.
 */
export type ComputerTemplateType =
  | "miosa-desktop"
  | "miosa-sandbox"
  | (string & {});

/**
 * Controls who can access the computer's HTTP preview URL.
 *
 * - `public`  — unauthenticated access to preview paths (default)
 * - `tenant`  — requires a valid JWT with matching tenant_id
 * - `key`     — requires a Bearer `msk_u_*` key matching the owner tenant
 *
 * Sensitive paths (`/api/*`, `/vnc/*`, `/term/*`) are always auth-gated
 * regardless of visibility mode.
 */
export type ComputerVisibility = "public" | "tenant" | "key";

export interface ComputerCreateParams {
  name: string;
  template_type?: ComputerTemplateType;
  /** Canonical sizes are xs/small/medium/large/xl. `xlarge` is accepted as a legacy input alias. */
  size?: ComputerSizeInput;
  visibility?: ComputerVisibility;
  metadata?: Record<string, string>;
  /**
   * Explicit agent runtime profile to mount into this computer. When omitted,
   * MIOSA applies the workspace/tenant default profile that targets computers.
   */
  agentRuntimeProfileId?: string;
  agent_runtime_profile_id?: string;
  /** Back-compat shorthand for agentRuntimeProfileId. */
  agentProfileId?: string;
  agent_profile_id?: string;
  /** Opt out of the default agent runtime profile for this create call. */
  skipRuntimeProfile?: boolean;
  skipAgentRuntimeProfile?: boolean;
  skip_agent_runtime_profile?: boolean;
}

export interface ComputerUpdateParams {
  name?: string;
  visibility?: ComputerVisibility;
  metadata?: Record<string, string>;
}

export interface ComputerData {
  id: ComputerId;
  name: string;
  /**
   * URL-safe identifier used in preview URLs: `https://{port}-{slug}.sandbox.{preview_domain}`.
   * Falls back to the computer id when no slug is assigned. The domain is the
   * tenant's white-label `preview_domain` (server-provided) — never hardcode it.
   */
  slug: string;
  status: ComputerStatus;
  template_type: ComputerTemplateType;
  size: ComputerSize;
  tenant_id: TenantId;
  ip_address: string | null;
  metadata: Record<string, string>;
  /** Controls who can access the HTTP preview URL. Defaults to `"public"`. */
  visibility: ComputerVisibility;
  /** Public ingress root, e.g. `https://<slug>.sandbox.<preview_domain>` (server-provided). */
  sandbox_url?: string;
  /** Tenant's white-label preview/base domain (e.g. `cliniciq.com`). Use to build preview URLs. */
  preview_domain?: string;
  /** KasmVNC URL for desktop templates. */
  desktop_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ComputerViewerPasswordStatus {
  computer_id?: ComputerId | string;
  password_set: boolean;
  password_set_at?: string | null;
  viewer_password_set_at?: string | null;
  rotated_at?: string | null;
}

export interface ComputerViewerPasswordRotation extends ComputerViewerPasswordStatus {
  viewer_password: string;
  password?: string;
}

// ─── Network Policy ───────────────────────────────────────────────────────────

export type NetworkPolicyEffect = "allow" | "deny";
export type NetworkPolicyProtocol = "tcp" | "udp" | "any";

/**
 * A single egress rule.
 *
 * - `effect`      — `"allow"` or `"deny"`
 * - `destination` — CIDR (`"10.0.0.0/8"`), IP, domain (`"example.com"`),
 *                   wildcard (`"*.example.com"`), or `"any"`
 * - `ports`       — optional: `"80"`, `"80,443"`, `"8000-9000"` (omit = all ports)
 * - `protocol`    — `"tcp"` | `"udp"` | `"any"` (default `"any"`)
 */
export interface NetworkPolicyRule {
  effect: NetworkPolicyEffect;
  destination: string;
  ports?: string;
  protocol?: NetworkPolicyProtocol;
}

export interface NetworkPolicySetParams {
  /** Rules evaluated top-to-bottom. */
  rules: NetworkPolicyRule[];
  /**
   * Verdict when no rule matches.
   * `"allow"` = allowlist entries, deny everything else.
   * `"deny"`  = blocklist entries, allow everything else (default).
   */
  default_effect?: NetworkPolicyEffect;
}

export interface NetworkPolicyData {
  computer_id: ComputerId;
  tenant_id: TenantId;
  rules: NetworkPolicyRule[];
  default_effect: NetworkPolicyEffect;
  inserted_at?: string;
  updated_at?: string;
}

export interface ComputerListResponse {
  data: ComputerData[];
  meta: {
    total: number;
    page: number;
    per_page: number;
  };
}

export interface ComputerListParams {
  page?: number;
  per_page?: number;
  status?: ComputerStatus;
}

// ─── Desktop ─────────────────────────────────────────────────────────────────

export type MouseButton = "left" | "right" | "middle";
export type ScrollDirection = "up" | "down" | "left" | "right";

export interface ClickParams {
  x: number;
  y: number;
  button?: MouseButton;
}

export interface DoubleClickParams {
  x: number;
  y: number;
}

export interface TypeParams {
  text: string;
  delay?: number;
}

export interface KeyParams {
  key: string;
}

export interface ScrollParams {
  x?: number;
  y?: number;
  direction: ScrollDirection;
  clicks?: number;
}

export interface DragParams {
  from_x: number;
  from_y: number;
  to_x: number;
  to_y: number;
}

export interface WaitParams {
  seconds: number;
}

export interface WindowInfo {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  is_focused: boolean;
}

export interface CursorInfo {
  x: number;
  y: number;
}

export interface WindowFocusParams {
  window_id: string;
}

export interface LaunchParams {
  app_name: string;
}

export interface DesktopActionResult {
  success: boolean;
}

// ─── Exec ────────────────────────────────────────────────────────────────────

export interface ExecParams {
  command: string;
  timeout?: number;
}

export interface ExecPythonParams {
  code: string;
  timeout?: number;
}

/**
 * Result of `exec.bash()` / `exec.python()`.
 *
 * The server returns stdout and stderr separately (what every other
 * runtime does too) — the older `{output, success}` shape was never
 * actually emitted. `output` is kept as a read-only alias of `stdout`
 * for backwards compatibility; new code should use `stdout` + `stderr`.
 */
export interface ExecResult {
  /** Standard output from the command. */
  stdout: string;
  /** Standard error from the command. Empty string when no error output. */
  stderr: string;
  /** Process exit code. 0 = success. */
  exit_code: number;
  /** @deprecated alias for `stdout`; prefer `stdout` in new code. */
  output?: string;
  /** @deprecated derive from `exit_code === 0` in new code. */
  success?: boolean;
}

// ─── Files ───────────────────────────────────────────────────────────────────

export interface FileEntry {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
  modified_at: string;
}

export interface FileListParams {
  path: string;
}

export interface FileDownloadParams {
  path: string;
}

export interface FileDeleteParams {
  path: string;
}

export interface FileExportParams {
  path: string;
}

export interface FileExportResult {
  url: string;
  expires_at: string;
}

export interface FileListResult {
  entries: FileEntry[];
  path: string;
}

// ─── Phase-7 stdlib-parity file types ────────────────────────────────────────

export interface FileStat {
  path: string;
  /** File size in bytes. */
  size: number;
  /** Unix mode bits (e.g. 0o100644 for a regular file with rw-r--r--). */
  mode: number;
  is_dir: boolean;
  is_symlink: boolean;
  /** Populated when is_symlink is true. */
  symlink_target?: string;
  modified_at: string;
}

export interface DirEntry {
  name: string;
  is_dir: boolean;
  is_symlink: boolean;
  size: number;
  modified_at: string;
}

export interface MkdirParams {
  /** Create parent directories as needed. Defaults to true. */
  recursive?: boolean;
  /** Octal mode bits (e.g. 0o755). Defaults to 0o755. */
  mode?: number;
}

export interface CopyParams {
  /** Copy directory trees recursively. Defaults to false. */
  recursive?: boolean;
}

export interface DirListResult {
  data: {
    entries: DirEntry[];
    path: string;
  };
}

// ─── Computer Control Sessions ───────────────────────────────────────────────

export type AgentSessionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface AgentSessionCreateParams {
  goal: string;
  model_id?: string;
  max_turns?: number;
}

export interface AgentSessionData {
  id: SessionId;
  computer_id: ComputerId;
  goal: string;
  model_id: string;
  status: AgentSessionStatus;
  max_turns: number;
  turns_used: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error: string | null;
}

export interface AgentSessionListResponse {
  data: AgentSessionData[];
}

export type AgentEventType =
  | "session_started"
  | "turn_started"
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "streaming_token"
  | "agent_response"
  | "turn_completed"
  | "session_completed"
  | "session_failed"
  | "done"
  | "error";

export interface AgentEvent {
  type: AgentEventType;
  session_id: SessionId;
  data: unknown;
  timestamp: string;
}

// ─── Credits ─────────────────────────────────────────────────────────────────

export interface CreditBalance {
  balance: number;
  expires_at: string | null;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  type: "credit" | "debit";
  description: string;
  created_at: string;
}

export interface CreditTransactionListResponse {
  data: CreditTransaction[];
  meta: {
    total: number;
    page: number;
    per_page: number;
  };
}

export interface CreditUsage {
  period_start: string;
  period_end: string;
  compute_credits: number;
  ai_credits: number;
  total_credits: number;
}

// ─── Events ──────────────────────────────────────────────────────────────────

export type {
  EventProducer,
  EventSubscribeOptions,
  ComputerEvent,
  EventStream,
  WindowFocusChangedPayload,
  WindowOpenedPayload,
  WindowClosedPayload,
  ClipboardChangedPayload,
  FileCreatedPayload,
  FileModifiedPayload,
  FileDeletedPayload,
  ProcessStartedPayload,
  ProcessStoppedPayload,
  IdleInactivePayload,
  IdleActivePayload,
  ProducerUnavailablePayload,
} from "./resources/events.js";

// ─── Custom Domains ──────────────────────────────────────────────────────────

export type {
  CustomDomainStatus,
  CustomDomainData,
  CustomDomainRegisterParams,
} from "./resources/custom_domains.js";

// ─── Client config ───────────────────────────────────────────────────────────

export interface MiosaClientConfig {
  apiKey?: string;
  /** User JWT required for organization switching. */
  accessToken?: string;
  /** Organization UUID or slug sent as X-MIOSA-Tenant on every request. */
  tenant?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}
