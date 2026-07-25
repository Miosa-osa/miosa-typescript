import type {
  RunCreateParams,
  RunExpectedOutputs,
  RunTargetKind,
} from "./resources/runs.js";

export type AgentBuildKind =
  | "landing_page"
  | "website"
  | "lead_magnet"
  | "webinar"
  | "slides_deck"
  | "email_sequence"
  | "social_content"
  | "ad_creative"
  | "booking_page"
  | "brand_identity"
  | "offer"
  | "program"
  | "podcast"
  | "sales_script"
  | "campaign"
  | "challenge"
  | "character"
  | "custom";

export interface AgentBuildFileSpec {
  kind: string;
  path: string;
  mime_type?: string;
  name?: string;
  downloadable?: boolean;
  previewable?: boolean;
  required?: boolean;
}

export interface AgentBuildInputRef {
  kind?: string;
  title?: string;
  ref?: string;
  file_ref?: string;
  drive_asset_id?: string;
  filename?: string;
  content_type?: string;
  size_bytes?: number;
  public_url?: string;
  text?: string;
  path?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AgentBuildKindSpec {
  kind: AgentBuildKind;
  label: string;
  deliverableType: string;
  runtimeTemplate: Record<string, unknown>;
  requestedOutputs: string[];
  plannerDocumentKinds: string[];
  files: AgentBuildFileSpec[];
  designResearchRequired: boolean;
  previewPort?: number;
}

export interface AgentBuildPlannerDocument {
  kind: string;
  title: string;
  content_markdown?: string;
  contentMarkdown?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentBuildExecutionPacket {
  version: string;
  run_type: AgentBuildKind;
  build_kind: AgentBuildKind;
  deliverable_type: string;
  title: string;
  goal: string;
  source_refs: unknown[];
  input_refs: AgentBuildInputRef[];
  context_markdown: string;
  planner_documents: AgentBuildPlannerDocument[];
  requested_outputs: string[];
  quality_rules: string[];
  runtime_profile_id?: string;
  expected_outputs: RunExpectedOutputs;
  runtime_instructions: Record<string, unknown>;
  metadata: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CreateAgentBuildPacketParams {
  runType?: string;
  buildKind?: string;
  deliverableType?: string;
  title: string;
  goal: string;
  contextMarkdown?: string;
  plannerDocuments?: AgentBuildPlannerDocument[];
  requestedOutputs?: string[];
  qualityRules?: string[];
  sourceRefs?: unknown[];
  inputRefs?: AgentBuildInputRef[];
  runtimeProfileId?: string;
  runtimeTemplate?: Record<string, unknown>;
  expectedOutputs?: RunExpectedOutputs;
  files?: AgentBuildFileSpec[];
  outputRoot?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateBuildRunParams extends CreateAgentBuildPacketParams {
  targetKind?: RunTargetKind;
  targetId?: string;
  sandboxId?: string;
  computerId?: string;
  runner?: string;
  provider?: string;
  model?: string;
  instruction?: string;
  cwd?: string;
  timeout?: number;
  wait?: boolean;
  env?: Record<string, string>;
  agentRuntimeProfileId?: string;
  externalWorkspaceId?: string;
  externalUserId?: string;
  externalProjectId?: string;
  approvalPolicy?: RunCreateParams["approvalPolicy"];
  capabilityRequirements?: string[];
}

export const DEFAULT_AGENT_BUILD_PACKET_VERSION = "2026-06-19";
export const DEFAULT_AGENT_BUILD_OUTPUT_ROOT = "/workspace/output";
export const DEFAULT_AGENT_BUILD_INPUT_ROOT = "/workspace/inputs";

const NEXTJS_RUNTIME_TEMPLATE = {
  kind: "nextjs_app",
  template_id: "nextjs",
  workspace_root: "/workspace",
  app_dir: "/workspace/app",
  output_dir: DEFAULT_AGENT_BUILD_OUTPUT_ROOT,
  expected_preview_port: 3000,
  start_command: "npm run dev -- --hostname 0.0.0.0 --port 3000",
  build_command: "npm run build",
} as const;

function fileBundle(kind: string): Record<string, unknown> {
  return {
    kind,
    workspace_root: "/workspace",
    output_dir: DEFAULT_AGENT_BUILD_OUTPUT_ROOT,
  };
}

const COMMON_PLANNER_DOCUMENT_KINDS = [
  "input_bundle",
  "client_grounding",
  "brand_identity",
  "strategy_context",
  "quality_rules",
];

const BUILD_KIND_ALIASES: Record<string, AgentBuildKind> = {
  ad: "ad_creative",
  ads: "ad_creative",
  adcreative: "ad_creative",
  ad_creative: "ad_creative",
  booking: "booking_page",
  booking_form: "booking_page",
  booking_page: "booking_page",
  brand: "brand_identity",
  brand_character: "character",
  brand_identity: "brand_identity",
  campaign: "campaign",
  campaign_plan: "campaign",
  carousel: "social_content",
  challenge: "challenge",
  character: "character",
  character_pack: "character",
  content: "social_content",
  content_batch: "social_content",
  course: "program",
  email: "email_sequence",
  email_sequence: "email_sequence",
  email_sms_sequence: "email_sequence",
  funnel: "landing_page",
  landing: "landing_page",
  landing_page: "landing_page",
  lead_magnet: "lead_magnet",
  leadmagnet: "lead_magnet",
  offer: "offer",
  offer_stack: "offer",
  online_course: "program",
  page: "landing_page",
  podcast: "podcast",
  podcast_audio: "podcast",
  program: "program",
  sales_page: "landing_page",
  sales_script: "sales_script",
  sales_script_builder: "sales_script",
  salesscript: "sales_script",
  site: "website",
  slides: "slides_deck",
  slides_deck: "slides_deck",
  social: "social_content",
  social_content: "social_content",
  social_media: "social_content",
  social_media_post: "social_content",
  text_card: "social_content",
  webinar: "webinar",
  website: "website",
};

function spec(
  kind: AgentBuildKind,
  label: string,
  deliverableType: string,
  runtimeTemplate: Record<string, unknown>,
  files: AgentBuildFileSpec[],
  options: Partial<
    Pick<
      AgentBuildKindSpec,
      "requestedOutputs" | "plannerDocumentKinds" | "designResearchRequired" | "previewPort"
    >
  > = {},
): AgentBuildKindSpec {
  const resolved: AgentBuildKindSpec = {
    kind,
    label,
    deliverableType,
    runtimeTemplate,
    requestedOutputs: options.requestedOutputs ?? ["requested deliverables", "manifest"],
    plannerDocumentKinds: options.plannerDocumentKinds ?? COMMON_PLANNER_DOCUMENT_KINDS,
    files,
    designResearchRequired: options.designResearchRequired ?? false,
  };
  if (options.previewPort !== undefined) resolved.previewPort = options.previewPort;
  return resolved;
}

export const AGENT_BUILD_KIND_SPECS: Record<AgentBuildKind, AgentBuildKindSpec> = {
  landing_page: spec(
    "landing_page",
    "Landing page",
    "landing_page",
    NEXTJS_RUNTIME_TEMPLATE,
    [
      { kind: "html", path: "landing-page.html", mime_type: "text/html", name: "Landing page", previewable: true },
      { kind: "source", path: "source.zip", mime_type: "application/zip", name: "Source files" },
    ],
    { requestedOutputs: ["Next.js landing page", "preview URL", "source files"], designResearchRequired: true, previewPort: 3000 },
  ),
  website: spec("website", "Website", "website", NEXTJS_RUNTIME_TEMPLATE, [
    { kind: "html", path: "website.html", mime_type: "text/html", name: "Website", previewable: true },
    { kind: "source", path: "source.zip", mime_type: "application/zip", name: "Source files" },
  ], { requestedOutputs: ["Next.js website", "preview URL", "source files"], designResearchRequired: true, previewPort: 3000 }),
  lead_magnet: spec("lead_magnet", "Lead magnet", "lead_magnet", NEXTJS_RUNTIME_TEMPLATE, [
    { kind: "pdf", path: "lead-magnet.pdf", mime_type: "application/pdf", name: "Lead magnet PDF", previewable: true },
    { kind: "html", path: "opt-in-page.html", mime_type: "text/html", name: "Opt-in page", previewable: true },
  ], { requestedOutputs: ["PDF lead magnet", "opt-in page", "source files"], designResearchRequired: true, previewPort: 3000 }),
  webinar: spec("webinar", "Webinar", "webinar", NEXTJS_RUNTIME_TEMPLATE, [
    { kind: "html", path: "webinar-page.html", mime_type: "text/html", name: "Webinar page", previewable: true },
    { kind: "markdown", path: "webinar-script.md", mime_type: "text/markdown", name: "Webinar script" },
  ], { requestedOutputs: ["webinar registration page", "script", "slides"], designResearchRequired: true, previewPort: 3000 }),
  slides_deck: spec("slides_deck", "Slides deck", "slides_deck", fileBundle("html_deck"), [
    { kind: "html", path: "deck.html", mime_type: "text/html", name: "Slide deck", previewable: true },
  ], { designResearchRequired: true }),
  email_sequence: spec("email_sequence", "Email sequence", "email_sms_sequence", fileBundle("email_bundle"), [
    { kind: "markdown", path: "email-sequence.md", mime_type: "text/markdown", name: "Email sequence", previewable: true },
  ]),
  social_content: spec("social_content", "Social content", "social_media_post", fileBundle("html_image_bundle"), [
    { kind: "html", path: "social-carousel.html", mime_type: "text/html", name: "Social carousel", previewable: true },
    { kind: "markdown", path: "captions.md", mime_type: "text/markdown", name: "Caption bank" },
  ], { designResearchRequired: true }),
  ad_creative: spec("ad_creative", "Ad creative", "ad_creative", fileBundle("html_image_bundle"), [
    { kind: "html", path: "ad-creative.html", mime_type: "text/html", name: "Ad creative previews", previewable: true },
  ], { designResearchRequired: true }),
  booking_page: spec("booking_page", "Booking page", "booking_page", NEXTJS_RUNTIME_TEMPLATE, [
    { kind: "html", path: "booking-page.html", mime_type: "text/html", name: "Booking page", previewable: true },
  ], { requestedOutputs: ["booking page", "confirmation copy", "source files"], designResearchRequired: true, previewPort: 3000 }),
  brand_identity: spec("brand_identity", "Brand identity", "brand_identity", fileBundle("brand_bundle"), [
    { kind: "markdown", path: "brand-guide.md", mime_type: "text/markdown", name: "Brand guide", previewable: true },
  ], { designResearchRequired: true }),
  offer: spec("offer", "Offer", "offer", fileBundle("offer_bundle"), [
    { kind: "markdown", path: "offer-stack.md", mime_type: "text/markdown", name: "Offer stack", previewable: true },
  ]),
  program: spec("program", "Program", "program_lms", fileBundle("program_lms"), [
    { kind: "html", path: "program.html", mime_type: "text/html", name: "Program preview", previewable: true },
    { kind: "markdown", path: "program.md", mime_type: "text/markdown", name: "Program outline" },
  ], { designResearchRequired: true }),
  podcast: spec("podcast", "Podcast", "podcast_audio", fileBundle("podcast_audio"), [
    { kind: "html", path: "podcast.html", mime_type: "text/html", name: "Podcast preview", previewable: true },
    { kind: "markdown", path: "show-notes.md", mime_type: "text/markdown", name: "Show notes" },
  ]),
  sales_script: spec("sales_script", "Sales script", "sales_script", fileBundle("script_bundle"), [
    { kind: "markdown", path: "sales-script.md", mime_type: "text/markdown", name: "Sales script", previewable: true },
  ]),
  campaign: spec("campaign", "Campaign", "campaign", fileBundle("campaign_bundle"), [
    { kind: "markdown", path: "campaign-plan.md", mime_type: "text/markdown", name: "Campaign plan", previewable: true },
    { kind: "html", path: "campaign-assets.html", mime_type: "text/html", name: "Campaign assets", previewable: true },
  ], { designResearchRequired: true }),
  challenge: spec("challenge", "Challenge", "challenge", fileBundle("challenge_bundle"), [
    { kind: "markdown", path: "challenge-plan.md", mime_type: "text/markdown", name: "Challenge plan", previewable: true },
  ]),
  character: spec("character", "Character pack", "brand_character", fileBundle("character_bundle"), [
    { kind: "markdown", path: "character-pack.md", mime_type: "text/markdown", name: "Character pack", previewable: true },
  ], { designResearchRequired: true }),
  custom: spec("custom", "Custom build", "file", fileBundle("file_bundle"), []),
};

function normalizeBuildKind(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function resolveAgentBuildKind(
  value: string | undefined,
  fallback: AgentBuildKind = "custom",
): AgentBuildKind {
  const normalized = normalizeBuildKind(value);
  if (!normalized) return fallback;
  return BUILD_KIND_ALIASES[normalized] ?? fallback;
}

export function getAgentBuildKindSpec(value: string | undefined): AgentBuildKindSpec {
  return AGENT_BUILD_KIND_SPECS[resolveAgentBuildKind(value)];
}

function normalizeFilePath(path: string, outputRoot: string): string {
  return path.startsWith("/") ? path : `${outputRoot}/${path}`;
}

export function createAgentBuildExpectedOutputs(
  buildKind: string | undefined,
  options: {
    deliverableType?: string;
    files?: AgentBuildFileSpec[];
    expectedOutputs?: RunExpectedOutputs;
    outputRoot?: string;
  } = {},
): RunExpectedOutputs {
  if (options.expectedOutputs) return options.expectedOutputs;
  const spec = getAgentBuildKindSpec(buildKind);
  const outputRoot = options.outputRoot ?? DEFAULT_AGENT_BUILD_OUTPUT_ROOT;
  const files = [
    {
      path: `${outputRoot}/manifest.json`,
      kind: "json",
      mime_type: "application/json",
      name: "Manifest",
      downloadable: true,
    },
    ...(options.files ?? spec.files).map((file) => ({
      ...file,
      path: normalizeFilePath(file.path, outputRoot),
      downloadable: file.downloadable ?? true,
    })),
  ];
  const contract = withoutUndefined({
    write_files_under: outputRoot,
    manifest: `${outputRoot}/manifest.json`,
    planner_documents_under: "/workspace/planner",
    inputs_under: DEFAULT_AGENT_BUILD_INPUT_ROOT,
    deliverable_type: options.deliverableType ?? spec.deliverableType,
    required_files: [`${outputRoot}/manifest.json`],
    files: files,
    expected_outputs: {
      messages: true,
      files: files,
      previews: spec.previewPort !== undefined,
    },
    preview_port: spec.previewPort,
    include_downloads: true,
  });
  return contract as RunExpectedOutputs;
}

function normalizePlannerDocuments(
  documents: AgentBuildPlannerDocument[] | undefined,
): AgentBuildPlannerDocument[] {
  return (documents ?? []).map((document) => ({
    ...document,
    content_markdown: document.content_markdown ?? document.contentMarkdown ?? "",
  }));
}

function withoutUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as T;
}

export function createAgentBuildExecutionPacket(
  params: CreateAgentBuildPacketParams,
): AgentBuildExecutionPacket {
  const buildKind = resolveAgentBuildKind(params.buildKind ?? params.runType);
  const spec = AGENT_BUILD_KIND_SPECS[buildKind];
  const deliverableType = params.deliverableType ?? spec.deliverableType;
  const runtimeTemplate = params.runtimeTemplate ?? spec.runtimeTemplate;
  const outputOptions: {
    deliverableType?: string;
    files?: AgentBuildFileSpec[];
    expectedOutputs?: RunExpectedOutputs;
    outputRoot?: string;
  } = { deliverableType };
  if (params.files !== undefined) outputOptions.files = params.files;
  if (params.expectedOutputs !== undefined) {
    outputOptions.expectedOutputs = params.expectedOutputs;
  }
  if (params.outputRoot !== undefined) outputOptions.outputRoot = params.outputRoot;
  const expectedOutputs = createAgentBuildExpectedOutputs(buildKind, outputOptions);
  const inputRefs = params.inputRefs ?? [];

  const packet: AgentBuildExecutionPacket = {
    version: DEFAULT_AGENT_BUILD_PACKET_VERSION,
    run_type: buildKind,
    build_kind: buildKind,
    deliverable_type: deliverableType,
    title: params.title,
    goal: params.goal,
    source_refs: params.sourceRefs ?? [],
    input_refs: inputRefs,
    context_markdown: params.contextMarkdown ?? "",
    planner_documents: normalizePlannerDocuments(params.plannerDocuments),
    requested_outputs: params.requestedOutputs ?? spec.requestedOutputs,
    quality_rules: params.qualityRules ?? [],
    expected_outputs: expectedOutputs,
    runtime_instructions: {
      agent: "claude",
      template: runtimeTemplate,
      input_materialization: {
        directory: DEFAULT_AGENT_BUILD_INPUT_ROOT,
        manifest: `${DEFAULT_AGENT_BUILD_INPUT_ROOT}/inputs.json`,
      },
      design_research: {
        provider: "refero",
        required: spec.designResearchRequired,
      },
    },
    metadata: {
      ...(params.metadata ?? {}),
      build_kind: buildKind,
      deliverable_type: deliverableType,
      build_target: runtimeTemplate,
      runtime_template: runtimeTemplate,
      expected_outputs: expectedOutputs,
      input_refs: inputRefs,
      design_research_required: spec.designResearchRequired,
      planner_document_kinds: spec.plannerDocumentKinds,
    },
  };
  if (params.runtimeProfileId) packet.runtime_profile_id = params.runtimeProfileId;
  return packet;
}

export function createAgentBuildPrompt(packet: AgentBuildExecutionPacket): string {
  return [
    `Build: ${packet.title}`,
    "",
    packet.goal,
    "",
    `Materialize input_refs under ${DEFAULT_AGENT_BUILD_INPUT_ROOT}.`,
    "Use the execution packet, input bundle, planner documents, brand/context notes, and quality rules.",
    `Write every deliverable under ${packet.expected_outputs.write_files_under}.`,
    `Write a JSON manifest to ${packet.expected_outputs.manifest}.`,
    "Do not expose secrets. Do not publish externally unless the approval policy allows it.",
  ].join("\n");
}

export function createBuildRunParams(
  params: CreateBuildRunParams,
): RunCreateParams {
  const runtimeProfileId = params.agentRuntimeProfileId ?? params.runtimeProfileId;
  const packetParams: CreateAgentBuildPacketParams = { ...params };
  if (runtimeProfileId !== undefined) packetParams.runtimeProfileId = runtimeProfileId;
  const packet = createAgentBuildExecutionPacket(packetParams);

  return withoutUndefined({
    instruction: params.instruction ?? createAgentBuildPrompt(packet),
    targetKind: params.targetKind ?? (params.computerId ? "computer" : "sandbox"),
    targetId: params.targetId,
    sandboxId: params.sandboxId,
    computerId: params.computerId,
    runner: params.runner ?? "claude-code",
    provider: params.provider,
    model: params.model,
    cwd: params.cwd ?? "/workspace",
    timeout: params.timeout ?? 1800,
    wait: params.wait ?? false,
    env: params.env,
    agentRuntimeProfileId: runtimeProfileId,
    externalWorkspaceId: params.externalWorkspaceId,
    externalUserId: params.externalUserId,
    externalProjectId: params.externalProjectId,
    executionPacket: packet,
    expectedOutputs: packet.expected_outputs,
    approvalPolicy: params.approvalPolicy ?? {
      publish: "manual",
      external_write: "manual",
      destructive_actions: "forbidden",
    },
    capabilityRequirements: params.capabilityRequirements ?? [
      "filesystem",
      "shell",
      "files",
      "downloads",
    ],
    metadata: {
      ...(params.metadata ?? {}),
      build_kind: packet.build_kind,
      deliverable_type: packet.deliverable_type,
    },
  } as Record<string, unknown>) as unknown as RunCreateParams;
}
