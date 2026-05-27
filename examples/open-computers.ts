/**
 * OpenComputers SDK usage example.
 *
 * Demonstrates: host registration, job execution, file access, tunnel
 * creation, agent dispatch, and inference cluster setup.
 *
 * Run: npx tsx examples/open-computers.ts
 */
import { Miosa } from "../src/index.js";

const miosa = new Miosa({ apiKey: process.env.MIOSA_API_KEY ?? "msk_u_..." });

// ── 1. Register a host ────────────────────────────────────────────────────────
// Install the OSA agent on your machine first:
//   curl -fsSL https://api.miosa.ai/install-host.sh | bash
// Then register it here and save the host_key shown in the response.

const host = await miosa.openComputers.hosts.create({ name: "my-dev-machine" });
console.log("Registered host:", host.id);
if (host.host_key) {
  console.log("Host key (save this!):", host.host_key);
}

// ── 2. Run a command on the host ──────────────────────────────────────────────

const job = await miosa.openComputers.jobs.run(host.id, {
  command: "node",
  args: ["--version"],
});
console.log("Job started:", job.id);

// Stream output in real time
for await (const event of miosa.openComputers.jobs.stream(host.id, job.id)) {
  if (event.type === "stdout" || event.type === "stderr") {
    process.stdout.write(String(event.data ?? ""));
  }
  if (event.type === "done" || event.type === "exit") break;
}

// ── 3. File system access ─────────────────────────────────────────────────────

const entries = await miosa.openComputers.files.list(host.id, "/home");
console.log(
  "Home entries:",
  entries.entries.map((e) => e.name),
);

await miosa.openComputers.files.upload(
  host.id,
  "/tmp/hello.txt",
  "Hello from MIOSA SDK!",
);

const stat = await miosa.openComputers.files.stat(host.id, "/tmp/hello.txt");
console.log("Stat:", stat.path, stat.size, "bytes");

// ── 4. Expose a port via tunnel ───────────────────────────────────────────────

const tunnel = await miosa.openComputers.tunnels.create(host.id, {
  target_port: 3000,
  auth_mode: "public",
});
console.log("Tunnel URL:", tunnel.public_url);

// ── 5. Dispatch an AI agent ───────────────────────────────────────────────────

const session = await miosa.openComputers.agents.dispatch(host.id, {
  task: "Check disk usage and summarize the top 5 largest directories under /",
  max_turns: 10,
});
console.log("Agent session:", session.id, "status:", session.status);

for await (const event of miosa.openComputers.agents.events(
  host.id,
  session.id,
)) {
  console.log("[agent]", event.type, JSON.stringify(event.data).slice(0, 80));
  if (event.type === "session_completed" || event.type === "done") break;
}

// ── 6. Terminal ticket (connect your own xterm.js) ────────────────────────────

const { ws_url } = await miosa.openComputers.terminal.ticket(host.id);
console.log("Terminal WS URL:", ws_url);

// ── 7. Inference cluster (Apple Silicon hosts only) ───────────────────────────

// Uncomment and supply real host IDs for Apple Silicon machines:
// const cluster = await miosa.openComputers.clusters.create({
//   name: "llama-cluster",
//   model: "llama3:70b",
//   host_ids: [host.id],
// });
// console.log("Inference URL:", cluster.inference_url);
// // Then use any OpenAI client:
// import OpenAI from "openai";
// const ai = new OpenAI({ apiKey: process.env.MIOSA_API_KEY, baseURL: cluster.inference_url });
// const resp = await ai.chat.completions.create({
//   model: "llama3:70b",
//   messages: [{ role: "user", content: "Hello!" }],
// });
// console.log(resp.choices[0].message.content);

// ── Cleanup ───────────────────────────────────────────────────────────────────
await miosa.openComputers.tunnels.delete(host.id, tunnel.id);
await miosa.openComputers.hosts.revoke(host.id);
console.log("Done.");
