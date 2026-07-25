/**
 * White-label agent platform flow:
 *
 * 1. Your app gathers customer context and writes an execution packet.
 * 2. MIOSA provisions or receives a sandbox/computer device.
 * 3. Connect attaches customer/workspace credentials without exposing raw keys
 *    back to your app.
 * 4. The device runs the builder/runtime work.
 * 5. Your app downloads artifacts for display or publish.
 *
 * Required env:
 *   MIOSA_API_KEY
 *   MIOSA_WORKSPACE_ID
 *   MIOSA_EXTERNAL_WORKSPACE_ID
 *   ANTHROPIC_API_KEY
 */

import { Miosa } from "../src/index.js";

const miosa = new Miosa({ apiKey: process.env.MIOSA_API_KEY! });

const workspaceId = process.env.MIOSA_WORKSPACE_ID!;
const externalWorkspaceId =
  process.env.MIOSA_EXTERNAL_WORKSPACE_ID ?? "clinic-iq-workspace";

async function main() {
  const connector = await miosa.connectors.create("anthropic", {
    name: "clinic-iq-claude",
    scope: "workspace",
    workspaceId,
    externalWorkspaceId,
    value: process.env.ANTHROPIC_API_KEY!,
  });

  const sandbox = await miosa.sandboxes.create({
    templateId: "nextjs",
    name: "clinic-iq-builder",
    timeoutSec: 3600,
  });

  await miosa.connectors.createDefault({
    connector: connector.uid ?? "anthropic/clinic-iq-claude",
    workspaceId,
    externalWorkspaceId,
    defaultScope: "external_workspace",
    target: "agent",
    mode: "brokered-env",
    allowedScopes: ["messages:create"],
  });

  await miosa.connectors.materializeDefaults({
    workspaceId,
    resourceType: "sandbox",
    resourceId: sandbox.id,
    target: "agent",
    externalWorkspaceId,
  });

  await miosa.devices.writeFile(sandbox.id, {
    path: "/workspace/PLAN.md",
    content: [
      "# Clinic IQ landing page",
      "",
      "Build a polished landing page for a white-label healthcare AI product.",
      "Use the customer profile and output all artifacts under /workspace/out.",
    ].join("\n"),
  });

  const result = await miosa.devices.exec(sandbox.id, {
    command: "npm install && npm run build",
    cwd: "/workspace",
    timeoutMs: 10 * 60 * 1000,
  });

  console.log(result);

  const artifact = await miosa.devices.readFile(sandbox.id, {
    path: "/workspace/PLAN.md",
  });
  console.log({
    artifact: artifact.path,
    encoding: artifact.encoding,
    bytes: artifact.size,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
