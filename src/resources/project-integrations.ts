/**
 * Project integrations — third-party API key connections injected into VMs.
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface ProjectIntegrationData {
  id?: string;
  project_id?: string;
  provider?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ProjectIntegrationCatalogEntry {
  provider?: string;
  name?: string;
  description?: string;
  schema?: Record<string, unknown>;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface ProjectIntegrationListParams {
  project_id?: string;
  provider?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface ProjectIntegrationCreateParams {
  project_id?: string;
  provider?: string;
  credentials?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ProjectIntegrationUpdateParams {
  credentials?: Record<string, unknown>;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["data", "project_integrations", "catalog", "items"]) {
      if (k in p) return p[k] as T;
    }
  }
  return payload as T;
}

function listItems<T>(payload: unknown): T[] {
  const result = unwrap<T[] | unknown>(payload);
  if (Array.isArray(result)) return result;
  return [];
}

function stripUndefined(
  input: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  ) as Record<string, string | number | boolean | undefined>;
}

function stripUndefObj(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  );
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class ProjectIntegrations {
  constructor(private readonly http: HttpClient) {}

  /** List project integrations. */
  async list(
    params: ProjectIntegrationListParams = {},
  ): Promise<ProjectIntegrationData[]> {
    const query = stripUndefined(params as Record<string, unknown>);
    const data = await this.http.get<unknown>("/project-integrations", query);
    return listItems<ProjectIntegrationData>(data);
  }

  /** List supported providers and their schemas. */
  async catalog(): Promise<ProjectIntegrationCatalogEntry[]> {
    const data = await this.http.get<unknown>("/project-integrations/catalog");
    return listItems<ProjectIntegrationCatalogEntry>(data);
  }

  /** Get a project integration by id. */
  async get(integrationId: string): Promise<ProjectIntegrationData> {
    const data = await this.http.get<unknown>(
      `/project-integrations/${integrationId}`,
    );
    return unwrap<ProjectIntegrationData>(data);
  }

  /** Create a project integration. */
  async create(
    params: ProjectIntegrationCreateParams,
  ): Promise<ProjectIntegrationData> {
    const body = stripUndefObj(params as Record<string, unknown>);
    const data = await this.http.post<unknown>("/project-integrations", body);
    return unwrap<ProjectIntegrationData>(data);
  }

  /** Update a project integration. */
  async update(
    integrationId: string,
    params: ProjectIntegrationUpdateParams,
  ): Promise<ProjectIntegrationData> {
    const body = stripUndefObj(params as Record<string, unknown>);
    const data = await this.http.patch<unknown>(
      `/project-integrations/${integrationId}`,
      body,
    );
    return unwrap<ProjectIntegrationData>(data);
  }

  /** Delete a project integration. */
  async delete(integrationId: string): Promise<void> {
    await this.http.delete<unknown>(`/project-integrations/${integrationId}`);
  }
}
