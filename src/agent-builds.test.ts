import { describe, expect, it } from "vitest";
import {
  createAgentBuildExecutionPacket,
  createAgentBuildExpectedOutputs,
  createBuildRunParams,
  resolveAgentBuildKind,
} from "./agent-builds.js";

describe("agent build helpers", () => {
  it("normalizes product build labels to canonical build kinds", () => {
    expect(resolveAgentBuildKind("sales page")).toBe("landing_page");
    expect(resolveAgentBuildKind("Lead-Magnet")).toBe("lead_magnet");
    expect(resolveAgentBuildKind("carousel")).toBe("social_content");
    expect(resolveAgentBuildKind("unknown thing")).toBe("custom");
  });

  it("creates expected output files for landing pages", () => {
    const contract = createAgentBuildExpectedOutputs("landing-page");

    expect(contract).toMatchObject({
      write_files_under: "/workspace/output",
      manifest: "/workspace/output/manifest.json",
      preview_port: 3000,
    });
    expect(contract.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "html",
          path: "/workspace/output/landing-page.html",
          previewable: true,
        }),
      ]),
    );
  });

  it("builds an execution packet with planner markdown and metadata", () => {
    const packet = createAgentBuildExecutionPacket({
      runType: "booking",
      title: "New Patient Booking Page",
      goal: "Create a conversion-focused booking page for a dental office.",
      contextMarkdown: "# Doctor\nDr. Ray",
      plannerDocuments: [
        {
          kind: "brand_voice",
          title: "Brand Voice",
          contentMarkdown: "Warm, expert, direct.",
        },
      ],
      inputRefs: [
        {
          kind: "inline_text",
          title: "Calendar embed code",
          text: "<iframe src='https://calendar.example.com'></iframe>",
        },
      ],
      qualityRules: ["Use provided brand colors.", "Write a manifest."],
      metadata: { workspace_id: "clinic_ws_1" },
    });

    expect(packet.build_kind).toBe("booking_page");
    expect(packet.deliverable_type).toBe("booking_page");
    expect(packet.input_refs[0]).toMatchObject({
      title: "Calendar embed code",
    });
    expect(packet.runtime_instructions.input_materialization).toMatchObject({
      directory: "/workspace/inputs",
    });
    expect(packet.metadata).toMatchObject({
      workspace_id: "clinic_ws_1",
      input_refs: packet.input_refs,
      design_research_required: true,
    });
    expect(packet.planner_documents[0]).toMatchObject({
      kind: "brand_voice",
      content_markdown: "Warm, expert, direct.",
    });
    expect(packet.expected_outputs.preview_port).toBe(3000);
  });

  it("creates agent run params ready for runs.run", () => {
    const params = createBuildRunParams({
      sandboxId: "sbx_123",
      agentRuntimeProfileId: "arp_claude",
      externalWorkspaceId: "clinic_ws_1",
      externalUserId: "doctor_1",
      externalProjectId: "project_1",
      runType: "lead magnet",
      title: "Implant Readiness Guide",
      goal: "Build a downloadable lead magnet.",
      model: "claude-opus-4.8",
    });

    expect(params).toMatchObject({
      targetKind: "sandbox",
      sandboxId: "sbx_123",
      runner: "claude-code",
      model: "claude-opus-4.8",
      agentRuntimeProfileId: "arp_claude",
      externalWorkspaceId: "clinic_ws_1",
      externalUserId: "doctor_1",
      externalProjectId: "project_1",
      approvalPolicy: {
        publish: "manual",
        external_write: "manual",
        destructive_actions: "forbidden",
      },
      capabilityRequirements: ["filesystem", "shell", "files", "downloads"],
    });
    expect(params.executionPacket).toMatchObject({
      build_kind: "lead_magnet",
      deliverable_type: "lead_magnet",
      runtime_profile_id: "arp_claude",
    });
    expect(params.instruction).toContain("Build: Implant Readiness Guide");
  });
});
