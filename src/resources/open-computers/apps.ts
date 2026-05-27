import { HttpClient } from "../../http.js";
import type {
  AppCatalogEntry,
  AppInstallData,
  AppInstallEvent,
  HostId,
} from "./types.js";

/**
 * Apps resource — one-click install of common dev services on a remote host.
 *
 * ```ts
 * const catalog = await client.openComputers.apps.catalog();
 * const install = await client.openComputers.apps.install(hostId, "postgres");
 *
 * for await (const evt of client.openComputers.apps.installEvents(hostId, install.id)) {
 *   console.log(evt.type, evt.data);
 *   if (evt.type === "installed" || evt.type === "failed") break;
 * }
 * ```
 */
export class Apps {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List all available apps in the MIOSA app library.
   */
  async catalog(): Promise<AppCatalogEntry[]> {
    const result = await this.http.get<{ data: AppCatalogEntry[] }>(
      "/opencomputers/apps",
    );
    return result.data;
  }

  /**
   * List apps installed on a specific host.
   */
  async listInstalled(hostId: HostId | string): Promise<AppInstallData[]> {
    const result = await this.http.get<{ data: AppInstallData[] }>(
      `/opencomputers/hosts/${hostId}/apps`,
    );
    return result.data;
  }

  /**
   * Install an app on a host by app catalog ID.
   */
  async install(
    hostId: HostId | string,
    appId: string,
  ): Promise<AppInstallData> {
    return this.http.post<AppInstallData>(
      `/opencomputers/hosts/${hostId}/apps/${appId}/install`,
    );
  }

  /**
   * Get the current state of an install operation.
   */
  async getInstall(
    hostId: HostId | string,
    installId: string,
  ): Promise<AppInstallData> {
    return this.http.get<AppInstallData>(
      `/opencomputers/hosts/${hostId}/apps/installs/${installId}`,
    );
  }

  /**
   * Stream install progress events.
   */
  installEvents(
    hostId: HostId | string,
    installId: string,
  ): AsyncIterableIterator<AppInstallEvent> {
    return this.http.stream<AppInstallEvent>(
      `/opencomputers/hosts/${hostId}/apps/installs/${installId}/events`,
    );
  }

  /**
   * Uninstall an app from a host.
   */
  async uninstall(hostId: HostId | string, appId: string): Promise<void> {
    return this.http.delete<void>(
      `/opencomputers/hosts/${hostId}/apps/${appId}`,
    );
  }

  /**
   * Start a previously installed app (e.g. start the postgres service).
   */
  async startApp(hostId: HostId | string, appId: string): Promise<void> {
    return this.http.post<void>(
      `/opencomputers/hosts/${hostId}/apps/${appId}/start`,
    );
  }
}
