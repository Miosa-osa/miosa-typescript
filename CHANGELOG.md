# Changelog

## [1.2.22] - 2026-06-23

### Fixed
- Export `SandboxExecEvent` and `SandboxExecRunner` from the public TypeScript SDK entrypoint.

## [1.2.21] - 2026-06-23

### Added
- `sandbox.exposeInfo()` / `sandbox.preview.exposeInfo()` return the full preview URL contract: `url`, `url_class`, `stable_for_embedding`, and `recommended_next_action`.

### Fixed
- Preview URL fallbacks use `miosa.ai`.

## [1.2.19] - 2026-06-22

### Added
- Computer external viewer-password helpers:
  - `miosa.computers.viewerPassword(id)`
  - `miosa.computers.rotateViewerPassword(id)`
  - `computer.viewerPassword()`
  - `computer.rotateViewerPassword()`

### Changed
- Computer size types now expose canonical `xs`, `small`, `medium`, `large`, `xl`.
- `computers.create({ size: "xlarge" })` normalizes the legacy alias to `xl`.
- Computer examples use the canonical fast desktop profile: `miosa-desktop` + `small`.

## [0.3.0] - 2026-04-19

### Added
- `client.openComputers` namespace with 11 sub-resources for BYOC host management:
  - `hosts` — register, list, get, update, revoke hosts; SSE event stream
  - `jobs` — run commands on remote hosts, list/get/cancel jobs, stream output via SSE
  - `files` — list directories, stat paths, download, upload (multipart), delete, mkdir
  - `terminal` — issue short-lived WebSocket tickets for PTY sessions
  - `desktop` — issue short-lived WebSocket tickets for KasmVNC desktop streaming
  - `tunnels` — create/list/update/delete HTTP tunnels exposing host ports publicly
  - `agents` — dispatch Optimal AI agent sessions, stream events, cancel sessions
  - `clusters` — create/manage multi-host LLM inference clusters (exo/MLX Distributed)
  - `apps` — app library catalog, install/uninstall, install event streaming
  - `workspaces` — git-backed dev environments: create, pull, open terminal, events
  - `secrets` — encrypted per-host and per-tenant env var management with reveal
- Full TypeScript types for all OpenComputers request/response shapes
- `OpenComputers` class exported from the top-level index
- `examples/open-computers.ts` usage example

## [0.2.1] - 2026-04-17

### Fixed
- `ExecResult` fields (`stdout`, `stderr`, `exit_code`) match server reality
- `ComputerStatus` includes `"active"` alias for running VMs

### Added
- `computer.previewUrl(port)` and `computer.publicUrl` helpers
- Next.js artifact reference example

## [0.2.0] - 2026-04-11

### Added
- Full public Developer API surface: Computers, Desktop, Exec, Files, Agent (CUA)
- Admin resource (`msk_a_*` / `msk_p_*` keys)
- Sandboxes helper (E2B/Daytona model)
- Checkpoints (Firecracker snapshots)
- Network policy (egress firewall)
- Custom domains
- Services (systemd units)
- Events (SSE computer event stream)
- Credits balance, transactions, usage
- Workspaces CRUD

## [0.1.0] - 2026-03-14

### Added
- Initial release: Computers CRUD, Exec, Files, basic Desktop actions
