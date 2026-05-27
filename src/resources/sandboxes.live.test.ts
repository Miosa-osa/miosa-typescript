import { describe, expect, it } from "vitest";
import { Miosa } from "../client.js";
import type { Sandbox } from "./sandboxes.js";

const liveApiKey = process.env.MIOSA_API_KEY;
const liveBaseUrl = process.env.MIOSA_BASE_URL ?? "https://api.miosa.ai/api/v1";
const describeLive = liveApiKey ? describe : describe.skip;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitReady(sandbox: Sandbox, timeoutMs = 60_000): Promise<Sandbox> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sandbox.refresh();
    if (sandbox.state === "running" && sandbox.ready) return sandbox;
    await sleep(500);
  }
  throw new Error(`sandbox ${sandbox.id} was not ready within ${timeoutMs}ms`);
}

describeLive("live native sandbox API", () => {
  it(
    "creates, execs, writes files, exposes preview, and destroys",
    async () => {
      const client = new Miosa({
        apiKey: liveApiKey!,
        baseUrl: liveBaseUrl,
        timeout: 60_000,
        maxRetries: 1,
      });
      let sandbox: Sandbox | undefined;
      const marker = `miosa-ts-live-${Date.now()}`;
      const port = 32_173;

      try {
        sandbox = await client.sandboxes.create({
          name: `sdk-ts-live-${Date.now()}`,
          templateId: "miosa-sandbox",
          timeoutSec: 600,
          metadata: { test: "typescript-live-e2e" },
        });
        await waitReady(sandbox);

        const exec = await sandbox.commands.run("python3 -c 'print(21 * 2)'", {
          timeoutSec: 30,
        });
        expect(exec.exitCode).toBe(0);
        expect(exec.stdout.trim()).toBe("42");

        await sandbox.files.write("/workspace/index.html", `<h1>${marker}</h1>`);
        expect(await sandbox.files.readText("/workspace/index.html")).toContain(marker);
        const list = await sandbox.files.list("/workspace");
        expect(JSON.stringify(list)).toContain("index.html");
        const stat = await sandbox.files.stat("/workspace/index.html");
        expect(Number(stat.size ?? 0)).toBeGreaterThan(0);

        await sandbox.commands.run(
          [
            "cd /workspace",
            `nohup python3 -m http.server ${port} --bind 0.0.0.0 >/tmp/miosa-ts-live.log 2>&1 &`,
          ].join(" && "),
          { timeoutSec: 10 },
        );

        let reachable = false;
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const probe = await sandbox.commands.run(
            `python3 - <<'PY'\nimport urllib.request\nprint(urllib.request.urlopen('http://127.0.0.1:${port}', timeout=2).read().decode())\nPY`,
            { timeoutSec: 5 },
          );
          if (probe.exitCode === 0 && probe.stdout.includes(marker)) {
            reachable = true;
            break;
          }
          await sleep(500);
        }
        expect(reachable).toBe(true);

        const previewUrl = await sandbox.preview.expose(port);
        expect(previewUrl).toMatch(/^https:\/\//);
        const preview = await fetch(previewUrl);
        expect(preview.status).toBe(200);
        expect(await preview.text()).toContain(marker);
      } finally {
        if (sandbox) {
          await sandbox.destroy().catch(() => undefined);
        }
      }
    },
    120_000,
  );
});
