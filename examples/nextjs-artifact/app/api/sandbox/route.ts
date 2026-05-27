/**
 * POST /api/sandbox — boot a sandbox, generate an artifact, return the
 * public preview URL the client can iframe.
 *
 * Body:
 *   { "kind": "static",  "files": { "index.html": "..." } }
 *   { "kind": "python",  "code": "print('hi')" }
 *   { "kind": "node",    "files": {...}, "entry": "server.js", "port": 3000 }
 *   { "kind": "vite",    "files": {...}, "port": 5173 }
 *
 * Response: { id, previewUrl?, stdout?, stderr? }
 */
import { NextResponse } from "next/server";
import { Miosa } from "@miosa/sdk";

const miosa = new Miosa({
  apiKey: process.env.MIOSA_API_KEY!,
  baseUrl: process.env.MIOSA_BASE_URL,
});

type Body =
  | { kind: "static"; files: Record<string, string> }
  | { kind: "python"; code: string }
  | {
      kind: "node";
      files: Record<string, string>;
      entry: string;
      port?: number;
    }
  | { kind: "vite"; files: Record<string, string>; port?: number };

async function waitActive(id: string, timeoutSec = 120) {
  const deadline = Date.now() + timeoutSec * 1000;
  let c = await miosa.computers.get(id);
  while (c.status !== "active" && Date.now() < deadline) {
    if (["error", "stopped", "destroyed"].includes(c.status)) {
      throw new Error(`terminal state: ${c.status}`);
    }
    await new Promise((r) => setTimeout(r, 2500));
    c = await miosa.computers.get(id);
  }
  if (c.status !== "active")
    throw new Error(`timeout; last status: ${c.status}`);
  return c;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const sb = await miosa.sandboxes.create({
    name: `artifact-${Date.now()}`,
    size: "small",
  });

  try {
    const c = await waitActive(sb.id);

    switch (body.kind) {
      case "python": {
        const r = await c.exec.python(body.code, 60);
        await miosa.computers.delete(c.id);
        return NextResponse.json({
          id: c.id,
          stdout: r.stdout,
          stderr: r.stderr,
        });
      }

      case "static": {
        for (const [path, content] of Object.entries(body.files)) {
          await c.files.upload(content, `/tmp/app/${path}`);
        }
        await c.exec.bash(
          "cd /tmp/app && nohup python3 -m http.server 8080 --bind 0.0.0.0 > /tmp/srv.log 2>&1 &",
        );
        return NextResponse.json({ id: c.id, previewUrl: c.previewUrl(8080) });
      }

      case "node": {
        const port = body.port ?? 3000;
        for (const [path, content] of Object.entries(body.files)) {
          await c.files.upload(content, `/tmp/app/${path}`);
        }
        if (body.files["package.json"]) {
          await c.exec.bash("cd /tmp/app && npm install --silent", 180);
        }
        await c.exec.bash(
          `cd /tmp/app && nohup node ${JSON.stringify(body.entry)} > /tmp/srv.log 2>&1 &`,
        );
        return NextResponse.json({ id: c.id, previewUrl: c.previewUrl(port) });
      }

      case "vite": {
        const port = body.port ?? 5173;
        for (const [path, content] of Object.entries(body.files)) {
          await c.files.upload(content, `/tmp/app/${path}`);
        }
        await c.exec.bash("cd /tmp/app && npm install --silent", 240);
        await c.exec.bash(
          `cd /tmp/app && nohup npm run dev -- --host 0.0.0.0 --port ${port} > /tmp/srv.log 2>&1 &`,
        );
        return NextResponse.json({ id: c.id, previewUrl: c.previewUrl(port) });
      }
    }
  } catch (err) {
    await miosa.computers.delete(sb.id).catch(() => {});
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await miosa.computers.delete(id);
  return NextResponse.json({ ok: true });
}
