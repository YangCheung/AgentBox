# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test

```bash
cargo build --release              # Build all workspace crates
cargo test                         # Run all tests
cargo test -p control-plane        # Run control-plane tests only
cargo test -p sidecar              # Run sidecar tests only
cargo run -p control-plane          # Start control plane locally
```

Database tests use `sqlite::memory:`, so they work without any setup.

## Docker

```bash
# Build the agent container image (sidecar + entrypoint)
docker build -t agent-sandbox:latest -f agent-image/Dockerfile .

# Build the control-plane image
docker build -t agentbox-control:latest -f Dockerfile .

# Run full stack (control plane + agent container)
docker compose up -d

# Run with agent profile
docker compose --profile agent up -d
```

## Architecture

This is a Rust workspace (`agentbox`) with four components + an SDK + a local cc-sdk patch:

### Control Plane (`control-plane/`)
The main REST API service (Axum 0.8) that manages Docker container lifecycles. Connects to Docker via the local socket using Bollard. Stores container metadata in SQLite (sqlx 0.8).

- **Routes** (defined in `control-plane/src/main.rs`):
  - `GET /health` — health check
  - `POST /api/containers` — create and start a new agent container (waits for sidecar `/health` readiness before returning)
  - `GET /api/containers/{id}` — get container metadata
  - `DELETE /api/containers/{id}` — stop + remove container + delete DB record
  - `POST /api/containers/{id}/status` — receive status reports from sidecar
  - `POST /api/containers/{id}/query` — proxy SSE query to sidecar (streaming, not buffered)
  - `GET /api/containers/{id}/logs` — WebSocket stream of container stdout/stderr (with secret redaction)
  - `GET/POST/PUT/DELETE /api/skills` — skill CRUD (ZIP upload with auto metadata extraction from skill.md)
- **LifecycleManager** runs as a background task (30s tick). For each active container it: (1) checks whether the Docker container is actually still running via `inspect_container`; if not, marks it `Stopped` in the DB; (2) checks idle timeout and max lifetime, stopping/removing expired containers. Containers with unparseable timestamps are skipped (logged) rather than treated as 1970.
- **Auth middleware** (`control-plane/src/auth.rs`) checks the `Authorization: Bearer <key>` header on all routes except `/health`. If `API_KEY` env var is not set, auth is skipped entirely (development mode).
- **CORS** (`build_cors` in `main.rs`) defaults to localhost only. Set `ALLOWED_ORIGINS=https://a.com,https://b.com` to allow specific origins, or `ALLOWED_ORIGINS=*` for wildcard (logged as warning).
- **Log redaction** (`control-plane/src/redact.rs`) collects values of known secret env vars (`ANTHROPIC_API_KEY`, `API_KEY`, `OPENAI_API_KEY`, `GITHUB_TOKEN`, `GH_TOKEN`) at startup and replaces them with `***REDACTED***` in the WebSocket log stream.

### Sidecar (`sidecar/`)
Runs inside each agent container as an HTTP server (Axum 0.8) on `SIDECAR_ADDR` (default `0.0.0.0:9000`). Heartbeats to the control plane via `/api/containers/{id}/status`.

- **Routes**:
  - `GET /health` — returns `ok`
  - `POST /query` — wraps `cc_sdk::query` (cc-sdk 0.8, locally patched); streams `Message` variants back as Server-Sent Events
- **Request body**: `{ "prompt": "...", "options": { ... } }`. The `options` object is mapped onto `ClaudeCodeOptions` via the builder; supported fields: `model`, `fallback_model`, `system_prompt`, `append_system_prompt`, `max_turns`, `max_output_tokens`, `max_thinking_tokens`, `allowed_tools`, `disallowed_tools`, `cwd`, `session_id`, `resume`, `continue_conversation`, `include_partial_messages`, `max_budget_usd`. Unknown fields are ignored. To support more, add a field to `QueryOptions` and a builder call in `build_options` (`sidecar/src/query.rs`).
- **SSE event names**: `assistant`, `user`, `system`, `result`, `stream_event`, `rate_limit`, `error`. Each event's `data:` is the JSON-serialized `Message`. The stream ends naturally after `cc_sdk` finishes (typically after the `result` event).
- **Token-level streaming**: Set `include_partial_messages: true` in query options to receive `stream_event` messages with token-by-token deltas (`text_delta`, `thinking_delta`). Without this, only complete `assistant` messages are sent. Requires the local cc-sdk patch (`cc-sdk-local/`) that adds `--include-partial-messages` CLI flag.

### Agent Image (`agent-image/`)
Docker image for agent containers. Contains the sidecar binary, the `claude` CLI (installed via npm `@anthropic-ai/claude-code`), Node.js 20 LTS, and Python3. The entrypoint script (`entrypoint.sh`) clones skill repos from `$SKILL_REPOS` (comma-separated Git URLs) into `/workspace/skills/`, then execs the sidecar. Exposes port 9000.

### cc-sdk Local Patch (`cc-sdk-local/`)
Local fork of cc-sdk 0.8.1 that adds `--include-partial-messages` CLI flag support. The upstream `include_partial_messages` option is defined but never passed to the CLI. The patch adds this in `query.rs`. Referenced via `[patch.crates-io]` in workspace `Cargo.toml`.

### Skills Management
Skills are uploaded as ZIP files via `POST /api/skills`. Metadata (`name`, `description`) is auto-extracted from `skill.md` YAML frontmatter inside the ZIP (case-insensitive filename match). Skills are stored on disk at `SKILLS_DIR` (default `/data/skills` in Docker volume). When creating a container, specify `skill_ids` to copy selected skills into `/workspace/skills/{name}/`.

## Key Data Flow

1. Caller POSTs to `/api/containers` with task + optional skill repos + resource limits
2. Control plane generates a UUID, creates a Docker container named `agent-{uuid}`, injects env vars (`TASK`, `CONTAINER_ID`, `CONTROL_PLANE_URL`, `SKILL_REPOS`, `ANTHROPIC_API_KEY`)
3. Container starts → entrypoint clones skills → execs sidecar
4. Sidecar listens on `:9000` and sends initial `running/ready` status; heartbeats every 30s
5. Caller (or control-plane proxy) POSTs to sidecar's `/query` with a prompt; SSE stream returns `cc_sdk` messages until `result`
6. LifecycleManager periodically sweeps active containers, stopping idle ones and destroying expired ones

## Environment Variables

**Control Plane**: `DATABASE_URL` (default `sqlite:agent_sandbox.db?mode=rwc`), `SERVER_ADDR` (default `0.0.0.0:8080`), `AGENT_IMAGE` (default `agent-sandbox:latest`), `API_KEY` (optional; if set, all non-/health routes require `Authorization: Bearer <key>`), `ALLOWED_ORIGINS` (comma-separated; default localhost only; `*` for wildcard), `ANTHROPIC_API_KEY` (forwarded into agent containers and redacted from log streams), `SKILLS_DIR` (default `/data/skills`), `RUST_LOG` (default `info`)

**Sidecar/Container**: `CONTAINER_ID` (required), `CONTROL_PLANE_URL` (for heartbeats), `SIDECAR_ADDR` (default `0.0.0.0:9000`), `SKILL_REPOS`, `ANTHROPIC_API_KEY`, `TASK` (legacy; not consumed by sidecar after the cc-sdk migration — query is now request-driven)

## TypeScript SDK (`sdk/`)

Zero-dependency SDK (`@agentbox/sdk`) for calling the AgentBox API from Node.js (>= 18). Uses native `fetch` and `AsyncGenerator` for SSE streaming.

- **AgentBox.create(config)** — POST `/api/containers`, returns `AgentBox` instance
- **agent.query(prompt, options?)** — POST `/api/containers/{id}/query`, returns `AsyncGenerator<Message>`
- **agent.delete()** — DELETE `/api/containers/{id}` (idempotent)
- **AgentBoxConfig** separates `agentServer`/`token` (Control Plane connection) from `env` (LLM env vars injected into container)

```bash
cd sdk && npm install && npm run build   # Compile TypeScript
npx tsx demo.ts                          # Run demo (requires .env)
```

## Frontend (`admin-ui/`)

**UI 组件必须使用 shadcn/ui**（位于 `src/components/ui/`）。非必要不得直接使用 HTML 原生 UI 元素（如 `<button>`、`<input>`、`<select>` 等），始终优先使用 shadcn 封装好的组件（`Button`、`Input`、`Select` 等），以保证一致的设计语言和可访问性。
