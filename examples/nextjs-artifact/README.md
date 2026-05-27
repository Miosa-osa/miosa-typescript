# MIOSA Artifact Sandbox — Next.js reference

Drop-in example for an app that generates an artifact (static site,
Python script, Node server, Vite project, etc.) inside a MIOSA sandbox
and hands a **live preview URL** back to the browser.

## What you get

```
https://{port}-{slug}.sandbox.miosa.ai
```

Anything your code runs inside the VM on `0.0.0.0:{port}` is immediately
reachable at that URL over HTTPS (wildcard cert, no cert management,
auto-cleanup when the VM is destroyed).

Parity with Fly.io / E2B / Daytona preview URLs — same ergonomics.

## Setup

```bash
npm i @miosa/sdk
```

`.env.local`:

```bash
MIOSA_API_KEY=msk_u_...
MIOSA_BASE_URL=https://api.miosa.ai/api/v1   # default, can omit
```

Copy `app/api/sandbox/route.ts` into your Next.js app. That's it — it uses `@miosa/sdk` directly, no wrapper layer.

## Usage

Client side, after POSTing to `/api/sandbox`:

```tsx
const res = await fetch("/api/sandbox", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    kind: "static",
    files: {
      "index.html": "<h1>hello from an AI-generated artifact</h1>",
    },
  }),
});
const { id, previewUrl } = await res.json();

// drop previewUrl straight into an <iframe>
<iframe src={previewUrl} className="h-full w-full border-0" />
```

## Supported kinds

| `kind`    | What it does                                                                 |
| --------- | ---------------------------------------------------------------------------- |
| `static`  | Writes files, serves with `python3 -m http.server` on `:8080`                |
| `python`  | One-shot `exec.python()`, returns stdout/stderr, sandbox destroyed           |
| `node`    | Writes files, `npm install`, runs `node <entry>` on `:3000` (configurable)   |
| `vite`    | Writes files, `npm install`, runs `npm run dev -- --host 0.0.0.0`            |

Add your own kind in `app/api/sandbox/route.ts` — the primitives are
`writeFile`, `execCommand`, `execPython`, and `startServer`.

## Lifecycle

- `POST /api/sandbox` with `kind: "python"` → one-shot, sandbox destroyed automatically
- `POST /api/sandbox` with a server kind → sandbox stays alive, returns `id` + `previewUrl`
- `DELETE /api/sandbox?id=<id>` → destroys when the user is done

If your app crashes mid-run the server-side `catch` block destroys the
sandbox so you don't leak VMs.

## The one rule that bites everyone

**Your server command must bind `0.0.0.0`, not `127.0.0.1`.**

- Vite: `--host 0.0.0.0`
- Next dev: `-H 0.0.0.0`
- Express: `app.listen(port, "0.0.0.0")`
- Python http.server: default is already 0.0.0.0

The proxy runs outside the VM — if your listener only accepts localhost,
the preview URL gets `connection refused`.

## Filesystem primitives (Phase 7)

The SDK exposes a full stdlib-parity filesystem surface alongside the existing
`upload` / `download` / `list` / `delete` methods.

### Per-call API

```ts
// Stat a path (lstat — does not follow symlinks)
const info = await computer.files.stat("/home/user/main.py");
// → { path, size, mode, is_dir, is_symlink, symlink_target?, modified_at }

// Create a directory (recursive by default)
await computer.files.mkdir("/workspace/project/src");
await computer.files.mkdir("/opt/strict", { recursive: false, mode: 0o700 });

// Rename / move
await computer.files.rename("/tmp/a.txt", "/tmp/b.txt");

// Copy (set recursive:true for directories)
await computer.files.copy("/workspace/src", "/workspace/backup", { recursive: true });

// Change permissions
await computer.files.chmod("/home/user/run.sh", 0o755);

// Rich directory listing (is_dir, is_symlink, size, modified_at per entry)
const entries = await computer.files.readdir("/workspace");
// → [{ name, is_dir, is_symlink, size, modified_at }, ...]
```

### Scoped filesystem helper

Use `computer.fs(workingDir)` to avoid repeating a path prefix on every call.
All relative paths are resolved against `workingDir`; absolute paths pass through unchanged.

```ts
const fs = computer.fs("/workspace");

await fs.writeFile("main.py", "print('hello')");
const src = await fs.readFile("main.py");
const entries = await fs.readdir(".");
const info = await fs.stat("main.py");
await fs.mkdir("tests");
```

### Edge cases

| Situation | Behaviour |
|-----------|-----------|
| `mkdir` without `recursive:true` when parent is missing | 5xx error from envd — parent must exist |
| `copy` a directory without `recursive:true` | 5xx error — pass `{ recursive: true }` for directory trees |
| `stat` on a symlink | Returns `is_symlink:true` and `symlink_target` — does **not** follow the link |
| `rename` across allowed path roots | Allowed as long as both `from` and `to` are under `/home/user`, `/home/ubuntu`, or `/tmp` |
| Path traversal attempts (`../../etc`) | 403 `FORBIDDEN_PATH` before any envd call |

## Gotchas

- **Port routing**: one port per subdomain. For multi-port apps use
  `sb.computer.previewUrl(3000)` and `sb.computer.previewUrl(8080)`
  separately.
- **Public**: anyone with the URL sees it. For tenant-private previews
  send `Authorization: Bearer <jwt>`; the proxy enforces tenant match.
- **Package install latency**: `npm install` for a full Next.js project
  takes 30-90s the first time. Pre-bake a template if that's too slow
  (ping the MIOSA team about custom templates).
- **Not for long-running agents**: this path is for one-shot artifacts.
  For long-lived Claude Code / Codex sessions with stdin injection, use
  the local Elixir SSE transport, not the hosted API.
