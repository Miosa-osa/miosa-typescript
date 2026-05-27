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

// Boot a sandbox, write a file, run a command
const sbx = await miosa.sandboxes.create({ name: "my-build" });

await sbx.files.write("/workspace/hello.ts", `console.log("hello from miosa")`);
const result = await sbx.exec("npx tsx /workspace/hello.ts");
console.log(result.stdout); // hello from miosa

// Expose a live preview URL
const url = await sbx.expose(3000);
console.log(url); // https://3000-<slug>.sandbox.miosa.ai

await sbx.destroy();
```

## What's included

| Resource | Description |
|---|---|
| `miosa.sandboxes` | Lightweight code-execution VMs — exec, files, snapshots, previews |
| `miosa.computers` | Full Linux desktop VMs for computer-use agents |
| `miosa.deployments` | Versioned production releases with rollback |
| `miosa.databases` | Managed Postgres / Redis lifecycle |
| `miosa.storage` | S3-compatible object storage |
| `miosa.volumes` | Persistent block storage |
| `miosa.apiKeys` | Programmatic API key management |
| `miosa.usage` | Usage reports per workspace, per external tenant |
| `miosa.settings` | Workspace config, branding, BYOK provider keys |
| `miosa.webhooks` | Outgoing tenant webhooks — CRUD, test, delivery history |
| `miosa.openComputers` | BYOC host management — register your own machines |
| `miosa.completions` | OpenAI-compatible chat completions with SSE streaming |
| `miosa.embeddings` | OpenAI-compatible embedding vectors |

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

## Desktop control (Computers)

```ts
const computer = await miosa.computers.create({
  name: "agent-desktop",
  template_type: "miosa-desktop",
  size: "medium",
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
