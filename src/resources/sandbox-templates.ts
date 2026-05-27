/**
 * SandboxTemplates resource — tenant sandbox template management.
 */

import { randomUUID } from "node:crypto";

import type { HttpClient } from "../http.js";

// ── Branded IDs ──────────────────────────────────────────────────────────────

export type SandboxTemplateResourceId = string & {
  readonly __brand: "SandboxTemplateResourceId";
};
export type SandboxTemplateBuildResourceId = string & {
  readonly __brand: "SandboxTemplateBuildResourceId";
};

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface SandboxTemplateResourceData {
  id: SandboxTemplateResourceId;
  tenant_id: string;
  name: string;
  state?: string;
  build_spec?: Record<string, unknown>;
  aliases?: string[];
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface SandboxTemplateBuildResourceData {
  id: SandboxTemplateBuildResourceId;
  template_id: SandboxTemplateResourceId;
  state?: string;
  started_at?: string | null;
  finished_at?: string | null;
  error?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

// ── Request payloads ─────────────────────────────────────────────────────────

export interface SandboxTemplateListParams {
  include_aliases?: boolean;
  includeAliases?: boolean;
}

export interface TemplateCreateParams {
  name: string;
  build_spec: Record<string, unknown>;
  buildSpec?: Record<string, unknown>;
  idempotencyKey?: string;
  [key: string]: unknown;
}

export interface TemplateBuildCreateParams {
  idempotencyKey?: string;
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
  candidateKeys: string[] = ["data", "templates", "builds", "items"],
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

function stripUndefined(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  );
}

function idempotencyKey(key?: string): string {
  return key ?? randomUUID();
}

// ── Main resource ─────────────────────────────────────────────────────────────

export class SandboxTemplates {
  constructor(private readonly http: HttpClient) {}

  async list(
    params: SandboxTemplateListParams = {},
  ): Promise<SandboxTemplateResourceData[]> {
    const includeAliases =
      params.includeAliases ?? params.include_aliases ?? false;
    const query = includeAliases
      ? ({ include_aliases: true } as Record<
          string,
          string | number | boolean | undefined
        >)
      : undefined;
    const data = await this.http.get<unknown>("/sandbox-templates", query);
    return listItems<SandboxTemplateResourceData>(data, [
      "data",
      "templates",
      "items",
    ]);
  }

  async get(templateId: string): Promise<SandboxTemplateResourceData> {
    const data = await this.http.get<unknown>(
      `/sandbox-templates/${templateId}`,
    );
    return unwrap<SandboxTemplateResourceData>(data);
  }

  async create(
    params: TemplateCreateParams,
  ): Promise<SandboxTemplateResourceData> {
    const {
      idempotencyKey: ikey,
      buildSpec,
      build_spec,
      name,
      ...rest
    } = params;
    const body = stripUndefined({
      name,
      build_spec: buildSpec ?? build_spec,
      ...rest,
    });
    const data = await this.http.request<unknown>("/sandbox-templates", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey(ikey) },
    });
    return unwrap<SandboxTemplateResourceData>(data);
  }

  async buildSpecSchema(): Promise<Record<string, unknown>> {
    const data = await this.http.get<unknown>("/sandbox-templates/build-spec");
    return (data ?? {}) as Record<string, unknown>;
  }

  async validate(
    buildSpec: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const data = await this.http.post<unknown>("/sandbox-templates/validate", {
      build_spec: buildSpec,
    });
    return (data ?? {}) as Record<string, unknown>;
  }

  async listBuilds(
    templateId: string,
  ): Promise<SandboxTemplateBuildResourceData[]> {
    const data = await this.http.get<unknown>(
      `/sandbox-templates/${templateId}/builds`,
    );
    return listItems<SandboxTemplateBuildResourceData>(data, [
      "data",
      "builds",
      "items",
    ]);
  }

  async createBuild(
    templateId: string,
    params: TemplateBuildCreateParams = {},
  ): Promise<SandboxTemplateBuildResourceData> {
    const { idempotencyKey: ikey, ...rest } = params;
    const body = stripUndefined(rest as Record<string, unknown>);
    const data = await this.http.request<unknown>(
      `/sandbox-templates/${templateId}/builds`,
      {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotencyKey(ikey) },
      },
    );
    return unwrap<SandboxTemplateBuildResourceData>(data);
  }
}
