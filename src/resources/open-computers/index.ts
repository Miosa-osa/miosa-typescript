import { HttpClient } from "../../http.js";
import { Agents } from "./agents.js";
import { Apps } from "./apps.js";
import { Clusters } from "./clusters.js";
import { Desktop } from "./desktop.js";
import { OcFiles } from "./files.js";
import { Hosts } from "./hosts.js";
import { Jobs } from "./jobs.js";
import { Secrets } from "./secrets.js";
import { Terminal } from "./terminal.js";
import { Tunnels } from "./tunnels.js";
import { OcWorkspaces } from "./workspaces.js";

export * from "./types.js";
export { Agents } from "./agents.js";
export { Apps } from "./apps.js";
export { Clusters } from "./clusters.js";
export { Desktop } from "./desktop.js";
export { OcFiles } from "./files.js";
export { Hosts } from "./hosts.js";
export { Jobs } from "./jobs.js";
export { Secrets } from "./secrets.js";
export { Terminal } from "./terminal.js";
export { Tunnels } from "./tunnels.js";
export { OcWorkspaces } from "./workspaces.js";

/**
 * OpenComputers namespace — BYOC (Bring Your Own Computer) host management.
 *
 * Register your own machines (Mac, Linux, Windows) with MIOSA and use them
 * just like cloud computers: run jobs, manage files, open terminals, expose
 * ports, dispatch AI agents, and run LLM inference clusters.
 *
 * Access via `client.openComputers`:
 *
 * ```ts
 * const miosa = new Miosa({ apiKey: "msk_u_..." });
 *
 * // Register a host — save host_key immediately, shown only once
 * const host = await miosa.openComputers.hosts.create({ name: "my-mac" });
 *
 * // Run a command
 * const job = await miosa.openComputers.jobs.run(host.id, { command: "npm test" });
 *
 * // Stream output
 * for await (const event of miosa.openComputers.jobs.stream(host.id, job.id)) {
 *   process.stdout.write(String(event.data ?? ""));
 *   if (event.type === "done") break;
 * }
 *
 * // Expose a port
 * const tunnel = await miosa.openComputers.tunnels.create(host.id, { target_port: 3000 });
 * console.log(tunnel.public_url);
 *
 * // Dispatch an AI agent
 * const session = await miosa.openComputers.agents.dispatch(host.id, {
 *   task: "Run tests and fix failing ones",
 * });
 * ```
 */
export class OpenComputers {
  /** Host registration and lifecycle. */
  readonly hosts: Hosts;
  /** Command execution on remote hosts. */
  readonly jobs: Jobs;
  /** File system access on remote hosts. */
  readonly files: OcFiles;
  /** Interactive terminal session tickets. */
  readonly terminal: Terminal;
  /** Desktop streaming session tickets. */
  readonly desktop: Desktop;
  /** HTTP tunnel management (expose host ports publicly). */
  readonly tunnels: Tunnels;
  /** AI agent dispatch and session management. */
  readonly agents: Agents;
  /** Multi-host LLM inference clusters. */
  readonly clusters: Clusters;
  /** App library — one-click installs on hosts. */
  readonly apps: Apps;
  /** Git-backed workspace environments. */
  readonly workspaces: OcWorkspaces;
  /** Encrypted per-host / per-tenant secrets. */
  readonly secrets: Secrets;

  constructor(http: HttpClient) {
    this.hosts = new Hosts(http);
    this.jobs = new Jobs(http);
    this.files = new OcFiles(http);
    this.terminal = new Terminal(http);
    this.desktop = new Desktop(http);
    this.tunnels = new Tunnels(http);
    this.agents = new Agents(http);
    this.clusters = new Clusters(http);
    this.apps = new Apps(http);
    this.workspaces = new OcWorkspaces(http);
    this.secrets = new Secrets(http);
  }
}
