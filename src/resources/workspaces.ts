/**
 * Workspaces resource — top-level tenant workspaces grouping computers.
 *
 * A workspace is a logical bucket of computers (handy for teams / projects).
 * Accessed via `miosa.workspaces` on the top-level client.
 *
 * @example
 * ```ts
 * const ws = await miosa.workspaces.create({ name: "prod" });
 * const computers = await miosa.workspaces.listComputers(ws.id);
 * ```
 */

import type { HttpClient } from "../http.js";
import type { ComputerData } from "../types.js";
import { Computer } from "./computer.js";

// ── Branded IDs ──────────────────────────────────────────────────────────────

export type WorkspaceId = string & { readonly __brand: "WorkspaceId" };

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface WorkspaceData {
  id: WorkspaceId;
  tenant_id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface WorkspaceCreateParams {
  name: string;
  slug?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkspaceUpdateParams {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkspaceComputerTemplateCreateParams {
  name: string;
  templateType?: string;
  template_type?: string;
  description?: string;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in (payload as object)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function listItems<T>(
  payload: unknown,
  candidateKeys: string[] = ["data", "items"],
): T[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  if (Array.isArray(p.data)) return p.data as T[];
  for (const key of candidateKeys) {
    if (Array.isArray(p[key])) return p[key] as T[];
  }
  return [];
}

// ── Workspaces resource ───────────────────────────────────────────────────────

export class Workspaces {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Create a new workspace.
   */
  async create(params: WorkspaceCreateParams): Promise<WorkspaceData> {
    const payload = await this.http.post<unknown>("/workspaces", params);
    return unwrap<WorkspaceData>(payload);
  }

  /**
   * List all workspaces visible to the current credential.
   */
  async list(): Promise<WorkspaceData[]> {
    const payload = await this.http.get<unknown>("/workspaces");
    if (
      payload &&
      typeof payload === "object" &&
      "workspaces" in (payload as object)
    ) {
      const p = payload as Record<string, unknown>;
      return (p["workspaces"] as WorkspaceData[]) ?? [];
    }
    return listItems<WorkspaceData>(payload, ["data", "workspaces", "items"]);
  }

  /**
   * Get a single workspace by ID.
   */
  async get(id: WorkspaceId | string): Promise<WorkspaceData> {
    const payload = await this.http.get<unknown>(`/workspaces/${id}`);
    return unwrap<WorkspaceData>(payload);
  }

  /**
   * Update a workspace's metadata.
   */
  async update(
    id: WorkspaceId | string,
    params: WorkspaceUpdateParams,
  ): Promise<WorkspaceData> {
    const payload = await this.http.patch<unknown>(`/workspaces/${id}`, params);
    return unwrap<WorkspaceData>(payload);
  }

  /**
   * Delete a workspace. Does not delete member computers.
   */
  async delete(id: WorkspaceId | string): Promise<void> {
    await this.http.delete<void>(`/workspaces/${id}`);
  }

  /**
   * Update workspace-level settings.
   */
  async updateSettings(
    id: WorkspaceId | string,
    settings: Record<string, unknown>,
  ): Promise<WorkspaceData> {
    const payload = await this.http.put<unknown>(
      `/workspaces/${id}/settings`,
      settings,
    );
    return unwrap<WorkspaceData>(payload);
  }

  /**
   * List all computers that belong to the given workspace.
   */
  async listComputers(id: WorkspaceId | string): Promise<Computer[]> {
    const payload = await this.http.get<unknown>(`/workspaces/${id}/computers`);
    const items = listItems<ComputerData>(payload, [
      "data",
      "computers",
      "items",
    ]);
    return items.map((d) => new Computer(this.http, d));
  }

  /**
   * List all sandboxes that belong to this workspace.
   */
  async listSandboxes(
    id: WorkspaceId | string,
  ): Promise<Record<string, unknown>[]> {
    const payload = await this.http.get<unknown>(`/workspaces/${id}/sandboxes`);
    return listItems<Record<string, unknown>>(payload, [
      "data",
      "sandboxes",
      "items",
    ]);
  }

  /**
   * List all deployments that belong to this workspace.
   */
  async listDeployments(
    id: WorkspaceId | string,
  ): Promise<Record<string, unknown>[]> {
    const payload = await this.http.get<unknown>(
      `/workspaces/${id}/deployments`,
    );
    return listItems<Record<string, unknown>>(payload, [
      "data",
      "deployments",
      "items",
    ]);
  }

  /**
   * List all managed databases that belong to this workspace.
   */
  async listDatabases(
    id: WorkspaceId | string,
  ): Promise<Record<string, unknown>[]> {
    const payload = await this.http.get<unknown>(`/workspaces/${id}/databases`);
    return listItems<Record<string, unknown>>(payload, [
      "data",
      "databases",
      "items",
    ]);
  }

  /**
   * List all projects that belong to this workspace.
   */
  async listProjects(
    id: WorkspaceId | string,
  ): Promise<Record<string, unknown>[]> {
    const payload = await this.http.get<unknown>(`/workspaces/${id}/projects`);
    return listItems<Record<string, unknown>>(payload, [
      "data",
      "projects",
      "items",
    ]);
  }

  /**
   * Return aggregate resource stats for this workspace.
   */
  async stats(id: WorkspaceId | string): Promise<Record<string, unknown>> {
    const payload = await this.http.get<unknown>(`/workspaces/${id}/stats`);
    return unwrap<Record<string, unknown>>(payload);
  }

  /**
   * Return metered usage data for this workspace.
   */
  async usage(id: WorkspaceId | string): Promise<Record<string, unknown>> {
    const payload = await this.http.get<unknown>(`/workspaces/${id}/usage`);
    return unwrap<Record<string, unknown>>(payload);
  }

  /**
   * Return activity feed for this workspace.
   */
  async activity(id: WorkspaceId | string): Promise<Record<string, unknown>[]> {
    const payload = await this.http.get<unknown>(`/workspaces/${id}/activity`);
    return listItems<Record<string, unknown>>(payload, [
      "data",
      "activity",
      "events",
      "items",
    ]);
  }

  /**
   * List computer templates available in this workspace.
   */
  async listComputerTemplates(
    id: WorkspaceId | string,
  ): Promise<Record<string, unknown>[]> {
    const payload = await this.http.get<unknown>(
      `/workspaces/${id}/computer-templates`,
    );
    return listItems<Record<string, unknown>>(payload, [
      "data",
      "templates",
      "items",
    ]);
  }

  /**
   * Create a computer template scoped to this workspace.
   */
  async createComputerTemplate(
    id: WorkspaceId | string,
    params: WorkspaceComputerTemplateCreateParams,
  ): Promise<Record<string, unknown>> {
    const payload = await this.http.post<unknown>(
      `/workspaces/${id}/computer-templates`,
      params,
    );
    return unwrap<Record<string, unknown>>(payload);
  }
}
