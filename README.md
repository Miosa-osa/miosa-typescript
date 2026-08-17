# @miosa/sdk (TypeScript)

> Official TypeScript / JavaScript SDK for MIOSA — the AI cloud platform for sandboxes, computers, deployments, and managed data.

[![npm version](https://img.shields.io/npm/v/@miosa/sdk.svg)](https://www.npmjs.com/package/@miosa/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@miosa/sdk.svg)](https://www.npmjs.com/package/@miosa/sdk)
[![Types](https://img.shields.io/badge/types-included-blue)](https://www.npmjs.com/package/@miosa/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docs](https://img.shields.io/badge/docs-miosa.ai%2Fdocs-blue)](https://miosa.ai/docs/sdks/typescript)

Ships ESM + CJS. Full TypeScript types included — no `@types/` package needed. Node.js 18+.

## Install

```bash
npm install @miosa/sdk
# or
pnpm add @miosa/sdk
# or
yarn add @miosa/sdk
# or
bun add @miosa/sdk
```

## Quickstart

```ts
import { Miosa } from "@miosa/sdk";

const miosa = new Miosa({ apiKey: "msk_live_..." });

// Create or resume a persistent sandbox workspace, then work inside it.
const sbx = await miosa.sandboxes.createAgentWorkspace({
  name: "my-build",
  externalWorkspaceId: "customer-workspace-123",
});

await sbx.files.write("/workspace/hello.ts", `console.log("hello from miosa")`);
const result = await sbx.exec("npx tsx /workspace/hello.ts");
console.log(result.stdout); // hello from miosa

// Expose a live preview URL
const url = await sbx.expose(3000);
console.log(url); // https://3000-<slug>.sandbox.miosa.ai

// Keep progress. Pause preserves the workspace so the next session can resume.
await sbx.snapshots.create("after-hello-world");
await sbx.pause();
```

## What's included

| Resource | Description |
|---|---|
| `miosa.sandboxes` | Lightweight code-execution VMs — exec, files, snapshots, previews |
| `miosa.computers` | Full Linux desktop VMs with desktop control for agents |
| `miosa.deployments` | Versioned production releases with rollback |
| `miosa.appDocuments` | Durable generated apps with exact-version review approvals and immutable publication bindings |
| `miosa.databases` | Managed Postgres / Redis lifecycle |
| `miosa.storage` | S3-compatible object storage |
| `miosa.volumes` | Persistent block storage |
| `miosa.apiKeys` | Programmatic API key management |
| `miosa.usage` | Usage reports per workspace, per external tenant |
| `miosa.settings` | Workspace config, branding, BYOK provider keys |
| `miosa.webhooks` | Outgoing tenant webhooks — CRUD, test, delivery history |
| `miosa.openComputers` | BYOC host management — register your own machines |
| `miosa.devices` | Unified device facade for sandbox/computer list, exec, files, previews |
| `miosa.connectors` | Provider credentials and short-lived runtime tokens |
| `miosa.runtimeEnv` | Inherited tenant/workspace/project runtime environment variables |
| `miosa.completions` | OpenAI-compatible chat completions with SSE streaming |
| `miosa.embeddings` | OpenAI-compatible embedding vectors |

## Durable generated apps

App Documents persist the generated app contract outside the browser.
They are workspace-scoped and include the view, declared capabilities, connectors, collections, automations, and component pins.
Native rendering authority is a separate approval pinned to the current canonical version hash.
Editing the document changes the hash and invalidates the old approval.

```ts
const app = await miosa.appDocuments.create({
  workspaceId: "workspace-id",
  name: "Clinic triage",
  document: {
    id: crypto.randomUUID(),
    name: "Clinic triage",
    format: "miosa-app/v1",
    view: { kind: "generated", source: "<main>Triage</main>" },
    capabilities: ["computer.exec"],
    collections: ["tickets"],
    connectors: ["linear"],
    automations: [],
    pins: [],
  },
});

const approval = await miosa.appDocuments.approveExactVersion(
  app.id,
  "Reviewed for exact release publishing",
);

await miosa.appDocuments.revokeApproval(app.id, approval.id);
```

## Connect vs Egress

Use **Connect** when your product needs to manage provider credentials for
agents, sandboxes, computers, or deployments. Connect owns the product-level
contract: connectors, installations, project links, inherited defaults,
short-lived tokens, white-label attribution, and runtime bindings.

Use **Egress** when you need the low-level security boundary: encrypted secret
storage, outbound host allowlists, placeholder token exchange, and audit logs.
Egress is the enforcement layer under Connect. Most white-label apps should
call `miosa.connectors` and runtime binding helpers first; only call
`miosa.secrets`, `miosa.network`, or `miosa.audit` when you are building
security/admin controls directly.

```ts
// Product-level credential setup.
const connector = await miosa.connectors.create("anthropic", {
  name: "workspace-claude",
  scope: "workspace",
  externalWorkspaceId: "clinic-iq",
  value: process.env.ANTHROPIC_API_KEY,
});

// Runtime-level materialization: the sandbox sees ANTHROPIC_API_KEY, but your
// app does not get the raw provider key back from MIOSA.
await miosa.connectors.materializeDefaults({
  workspaceId: "workspace-id",
  resourceType: "sandbox",
  resourceId: sbx.id,
  target: "agent",
  externalWorkspaceId: "clinic-iq",
});
```

## Agent workspaces

For AI builders, code assistants, and white-label agent products, the sandbox
is the development machine. Do not run builds on the user's laptop and upload
the result as the primary flow. Create or resume a stable sandbox workspace,
write files under `/workspace`, run package installs/tests/builds inside the
sandbox, expose previews from the sandbox, and publish from that sandbox.

```ts
const sbx = await miosa.sandboxes.getOrCreate({
  name: "acme-marketing-page",
  templateId: "miosa-sandbox",
  persistent: true,
  timeoutSec: 86_400,
  idleTimeoutSec: 1800,
  snapshotExpirationDays: 30,
  keepLastSnapshots: 1,
  externalWorkspaceId: "acme",
  externalUserId: "jane",
  waitUntilReady: true,
});

await sbx.files.writeMany([
  { path: "/workspace/package.json", content: `{"scripts":{"dev":"vite --host 0.0.0.0"}}` },
  { path: "/workspace/index.html", content: `<main id="app"></main>` },
]);

for await (const event of sbx.exec.stream("cd /workspace && npm install && npm run dev -- --port 3000")) {
  console.log(event);
}

const preview = await sbx.previews.create(3000);
console.log(preview.url);
```

For platform agents that plan work outside the sandbox and then hand execution
to a runtime inside the sandbox/computer, use the unified device API:

```ts
await miosa.agentRuntimeProfiles.create({
  workspaceId: "clinic-workspace",
  name: "ClinicIQ Claude Code",
  runtime: "claude-code",
  isDefault: true,
  connectors: [
    "anthropic/cliniciq",
    {
      uid: "refero",
      type: "mcp",
      managed: true,
      serverUrl: "https://api.refero.design/mcp",
    },
  ],
  env: {
    ANTHROPIC_API_KEY: "miosa-managed:anthropic/cliniciq",
  },
  metadata: {
    model: "claude-opus-4.8",
    whiteLabelClient: "cliniciq",
  },
});

await miosa.devices.writeFile(sbx.id, {
  path: "/workspace/PLAN.md",
  content: "# Build plan\nUse the customer profile and export /workspace/out.",
});

const build = await miosa.devices.exec(sbx.id, {
  command: "npm install && npm run build",
  cwd: "/workspace",
  timeoutMs: 600_000,
});

const artifact = await miosa.devices.readFile(sbx.id, {
  path: "/workspace/out/report.pdf",
});
```

`createAgentWorkspace()` is a convenience wrapper around `getOrCreate()` with
builder defaults: a 24-hour activity cap, thirty-minute idle snapshot/pause,
readiness waiting, 30-day snapshot-retention metadata, keep-last-snapshot
metadata, and metadata that marks the sandbox as an agent workspace.

That mirrors the Vercel-style persistent-sandbox model without keeping CPU
running forever: activity extends the running session, idle workspaces are
checkpointed and paused, and later sessions resume from the checkpoint. Use
`extend(86_400)` before long builds, `pause()` when the user is done for now,
`resume()` for the next session, `snapshots.create()` for manual checkpoints,
and `destroy()` only when the workspace should be permanently deleted.

## Sandbox sub-resources

Every `Sandbox` instance exposes composable sub-resources:

```ts
const sbx = await miosa.sandboxes.create();

// Files
await sbx.files.write("/workspace/app.py", "print('hi')");
const text    = await sbx.files.readText("/workspace/app.py");
const entries = await sbx.files.list("/workspace");
const stat    = await sbx.files.stat("/workspace/app.py");

// Exec — callable directly, or via .exec.run / .exec.stream
const result = await sbx.exec.run("python /workspace/app.py");
for await (const event of sbx.exec.stream("tail -f /var/log/app.log")) {
  if ("line" in event) console.log(event.line);
}

// Snapshots
const snap = await sbx.snapshots.create("pre-migration");
const restored = await sbx.snapshots.restore(snap.id);
await sbx.snapshots.delete(snap.id);

// Previews
const preview = await sbx.previews.create(8000);
console.log(preview.url);

// Live SSE event stream
for await (const event of sbx.events.stream()) {
  console.log(event.type, event.data);
}

// Pause / resume
await sbx.pause();
await sbx.resume();
```

## Publish from sandbox

Preview is mutable; publish creates a durable deployment version. Static output
is served by MIOSA's artifact plane. Dynamic apps run in reconciled runtime VMs.

```ts
const deployment = await sbx.deploy({
  name: "clinic-intake",
  outputPath: "/workspace/dist",
  entrypoint: "index.html",
});

console.log(deployment.url ?? deployment.deployment?.public_url);
```

For dynamic/full-stack apps:

```ts
const deployment = await sbx.deploy({
  name: "clinic-intake-api",
  outputPath: "/workspace",
  runCommand: "npm start",
  port: 3000,
  domain: "intake.apps.cliniciq.com",
});
```

To publish the exact snapshot that passed QA instead of whatever the editable
sandbox holds right now, use `deploySnapshot`. It forks the snapshot into a
temporary release sandbox, deploys that fork, and destroys it again, so the
source sandbox is never mutated:

```ts
const snap = await sbx.snapshots.create("qa-approved");

const release = await sbx.deploySnapshot(snap.id, {
  name: "clinic-intake",
  outputPath: "/workspace/dist",
  entrypoint: "index.html",
});

console.log(release.source_snapshot_id, release.release_sandbox_id);
```

The result always carries `source_snapshot_id` and `release_sandbox_id` for
provenance. Pass `{ cleanup: false }` as the third argument to keep the release
sandbox for inspection. If the release sandbox could not be destroyed, the
deployment still succeeds and `release.release_cleanup_error` explains why; when
the deploy itself fails and the release sandbox survives, the thrown error
carries the same fields so the leftover sandbox can be cleaned up by id.

For workspace App Engine, publish from the same sandbox but choose the
App Engine target:

```ts
const deployment = await sbx.deployDocker({
  name: "lead-magnet",
  path: "/workspace",
  buildCommand: "npm run build",
  runCommand: "npm start",
  port: 3000,
});

console.log(deployment.url ?? deployment.public_url);
```

App Engine runs app containers inside the workspace's dedicated MIOSA
App Engine appliance VM. It is separate from normal MIOSA dynamic runtime
VMs and is useful when a workspace needs many small apps, funnels, lead
magnets, APIs, or client sites.

Always display the server-returned `url` / `public_url`. Do not hardcode
`preview.miosa.app`, `api.miosa.app`, or `<tenant>.miosa.app`.

## Desktop control (Computers)

```ts
const computer = await miosa.computers.create({
  name: "agent-desktop",
  template_type: "miosa-desktop",
  // Canonical fast desktop profile: 2 vCPU / 4 GB.
  size: "small",
});
await computer.start();
await computer.wait(5);

const png = await computer.screenshot();    // Uint8Array
await computer.click(640, 400);
await computer.type("hello world");
await computer.key("Return");
await computer.scroll("down", 3);
await computer.drag(100, 100, 400, 400);

const result = await computer.bash("ls -la /home/user");
console.log(result.output);

// Authenticated platform desktop links are passwordless. Raw external viewer
// links are password-gated; rotate the one-time password when you need to share
// that raw URL outside the platform.
const rotated = await computer.rotateViewerPassword();
console.log(rotated.viewer_password);

await computer.destroy();
```

## White-label / multi-tenant

```ts
const sbx = await miosa.sandboxes.create({
  externalWorkspaceId: "dental-office-123",
  externalUserId: "dr-smith-456",
});

const sandboxes = await miosa.sandboxes.list({
  externalWorkspaceId: "dental-office-123",
});
```

White-label domain layers are separate:

```text
sandbox preview:     https://<port>-<slug>.sandbox.<preview-domain>
durable deployment:  https://<slug>.<deployment-domain>
custom domain:       https://app.customer.com
```

Tenant preview-domain management is available through `miosa.tenant.previewDomain`.
Tenant deployment-domain routing exists server-side; SDKs should consume
deployment `public_url` instead of reconstructing it.

## Error handling

```ts
import { MiosaError } from "@miosa/sdk";

try {
  await miosa.sandboxes.get("sbx_doesnt_exist");
} catch (e) {
  if (e instanceof MiosaError) {
    console.error(`${e.status} ${e.code}: ${e.message}`);
  }
}
```

The SDK retries `429` and `5xx` automatically (3 retries, exponential backoff + jitter). Set `maxRetries: 0` to disable.

## Configuration

| Option | Env var | Default |
|---|---|---|
| `apiKey` | `MIOSA_API_KEY` | — |
| `baseUrl` | `MIOSA_BASE_URL` | `https://api.miosa.ai/api/v1` |
| `timeout` | — | 30 000 ms |
| `maxRetries` | — | 3 |

```ts
const miosa = new Miosa({
  apiKey: process.env.MIOSA_API_KEY!,
  timeout: 60_000,
  maxRetries: 5,
});
```

## Links

- [Full documentation](https://miosa.ai/docs/sdks/typescript)
- [Quickstart](https://miosa.ai/docs/quickstart)
- [GitHub](https://github.com/miosa-ai/miosa-js)
- [Contact](mailto:platform@miosa.ai)

## License

MIT
