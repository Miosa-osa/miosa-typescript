/**
 * Product-aware template catalog.
 *
 * This is different from `sandboxTemplates`, which manages tenant-owned
 * sandbox template build records. `templates` is the canonical discovery
 * surface for product/template/size/readiness primitives across sandboxes,
 * computers, and appliances.
 */

import type { HttpClient } from "../http.js";

export type ComputeProduct =
  | "sandbox"
  | "computer"
  | "docker_deploy_host"
  | "managed_database"
  | "deployment";

export type TemplateReadinessState =
  | "fast_ready"
  | "cold_boot_only"
  | "missing"
  | "partial_fast_ready"
  | "unavailable";

export interface TemplateSizeReadiness {
  size: string;
  state: TemplateReadinessState | string;
  fast_ready?: boolean;
  cold_boot_only?: boolean;
  readiness_scope?: string;
  checked_nodes?: number;
  ready_nodes?: number;
  cold_boot_nodes?: number;
  missing_nodes?: number;
  unavailable_nodes?: number;
  [key: string]: unknown;
}

export interface TemplateBenchmarkLane {
  id: string;
  name?: string;
  command?: string;
  purpose?: string;
  [key: string]: unknown;
}

export interface TemplateReadinessContract {
  exec_ready?: boolean;
  preview_ready?: boolean;
  desktop_ready?: boolean;
  app_ready?: boolean;
  benchmark_command?: string;
  start_command?: string | null;
  readiness_probe?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface ProductTemplate {
  id: string;
  name: string;
  product: ComputeProduct | string;
  primitive?: "template" | string;
  default_size?: string;
  image_id?: string;
  description?: string | null;
  sdk_name?: string;
  cli_name?: string;
  installed_tools?: string[];
  install_command?: string | null;
  start_command?: string | null;
  readiness_probe?: Record<string, unknown> | null;
  readiness_contract?: TemplateReadinessContract;
  benchmark_lane?: TemplateBenchmarkLane;
  aliases?: string[];
  sizes?: TemplateSizeReadiness[];
  readiness?: TemplateReadinessState | string;
  [key: string]: unknown;
}

export interface ProductCatalogEntry {
  id: ComputeProduct | string;
  name: string;
  primitive?: "product" | string;
  description?: string;
  default_template?: string;
  default_size?: string;
  templates?: ProductTemplate[];
  size_ids?: string[];
  [key: string]: unknown;
}

export interface TemplatesListParams {
  product?: ComputeProduct | string;
}

export interface ProductTemplateCatalog {
  data?: ProductTemplate[];
  templates: ProductTemplate[];
  products?: ProductCatalogEntry[];
  sizes?: Array<Record<string, unknown>>;
  readiness_states?: string[];
  rules?: Record<string, unknown>;
  [key: string]: unknown;
}

function unwrapCatalog(payload: unknown): ProductTemplateCatalog {
  if (!payload || typeof payload !== "object") return { templates: [] };
  const data =
    "data" in payload &&
    typeof (payload as { data?: unknown }).data === "object" &&
    !Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: Record<string, unknown> }).data
      : (payload as Record<string, unknown>);

  const templates = Array.isArray(data.templates)
    ? (data.templates as ProductTemplate[])
    : Array.isArray(data.data)
      ? (data.data as ProductTemplate[])
      : [];

  return {
    ...data,
    templates,
  } as ProductTemplateCatalog;
}

export class Templates {
  constructor(private readonly http: HttpClient) {}

  /**
   * List product-aware templates across sandbox, computer, and appliance.
   *
   * Use `sandboxTemplates` for tenant-owned sandbox template CRUD/builds.
   */
  async list(params: TemplatesListParams = {}): Promise<ProductTemplate[]> {
    const data = await this.http.get<unknown>("/templates");
    const catalog = unwrapCatalog(data);

    if (!params.product) return catalog.templates;

    return catalog.templates.filter((template) => template.product === params.product);
  }

  async catalog(): Promise<ProductTemplateCatalog> {
    const data = await this.http.get<unknown>("/templates");
    return unwrapCatalog(data);
  }

  async get(templateId: string, params: TemplatesListParams = {}): Promise<ProductTemplate> {
    const templates = await this.list(params);
    const match = templates.find((template) => template.id === templateId);

    if (!match) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return match;
  }

  async readiness(
    templateId: string,
    params: TemplatesListParams = {},
  ): Promise<TemplateSizeReadiness[]> {
    const template = await this.get(templateId, params);
    return template.sizes ?? [];
  }
}
