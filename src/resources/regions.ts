/**
 * Regions — datacenter availability, sizes, pricing, templates.
 */

import type { HttpClient } from "../http.js";

// ── Resource shapes ──────────────────────────────────────────────────────────

export interface RegionData {
  id?: string;
  name?: string;
  slug?: string;
  available?: boolean;
  [key: string]: unknown;
}

export interface SizeData {
  id?: string;
  name?: string;
  slug?: string;
  cpu?: number;
  memory_mb?: number;
  [key: string]: unknown;
}

export interface TemplateData {
  id?: string;
  name?: string;
  slug?: string;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of [
      "data",
      "regions",
      "sizes",
      "pricing",
      "templates",
      "items",
    ]) {
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

// ── Main resource ─────────────────────────────────────────────────────────────

export class Regions {
  constructor(private readonly http: HttpClient) {}

  /** List datacenter regions. */
  async listRegions(): Promise<RegionData[]> {
    const data = await this.http.get<unknown>("/compute/regions");
    return listItems<RegionData>(data);
  }

  /** List available compute sizes. */
  async listSizes(): Promise<SizeData[]> {
    const data = await this.http.get<unknown>("/compute/sizes");
    return listItems<SizeData>(data);
  }

  /** Get static compute pricing data. */
  async pricing(): Promise<unknown> {
    const data = await this.http.get<unknown>("/compute/pricing");
    return unwrap(data);
  }

  /** List community computer templates. */
  async listTemplates(): Promise<TemplateData[]> {
    const data = await this.http.get<unknown>("/compute/templates");
    return listItems<TemplateData>(data);
  }

  /** Get a single community template by id. */
  async getTemplate(templateId: string): Promise<TemplateData> {
    const data = await this.http.get<unknown>(
      `/compute/templates/${templateId}`,
    );
    return unwrap<TemplateData>(data);
  }
}
