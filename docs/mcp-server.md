# MCP Server

`@aicorg/mcp-server` is an official MCP (Model Context Protocol) server that exposes AIC manifests to AI agents.

Any MCP-compatible agent — Claude Desktop, Cursor, Cline, Windsurf, or any custom client — can instantly discover and reason about an AIC-instrumented web app without parsing raw DOM, screenshots, or brittle selectors.

## Quick Setup

### Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aic": {
      "command": "npx",
      "args": ["-y", "@aicorg/mcp-server"]
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "aic": {
      "command": "npx",
      "args": ["-y", "@aicorg/mcp-server"]
    }
  }
}
```

### Local Development

If you have the monorepo checked out:

```bash
node packages/mcp-server/dist/index.js
```

## Authentication

`@aicorg/mcp-server` is read-only and auth-agnostic.

Recommended pattern:
- protect your app and APIs with your normal auth layer
- let the MCP client or browser session access the app as an authenticated user
- let `@aicorg/mcp-server` read AIC manifests over HTTP from that app

If you use Auth0 for user login, API protection, or delegated third-party API access, keep that in the app/auth layer rather than coupling it directly into the MCP server. See [Auth0 For AI Agents With AIC](/mnt/c/users/vatsa/agentinteractioncontrol/docs/auth0-ai-agents.md).

## Available Tools

The MCP server exposes 6 read-only tools that let an AI agent understand any AIC-instrumented web app:

| Tool | Description |
| --- | --- |
| `discover_aic_app` | Fetch and validate `/.well-known/agent.json`. Returns the app's capabilities, version, and resolved endpoint URLs. |
| `get_aic_ui_state` | Get the full runtime UI manifest — every interactive element with its ID, role, risk, actions, entity refs, execution metadata, recovery guidance, validation constraints, workflow links, and state. |
| `list_aic_elements` | Search and filter elements by role, risk level, entity type, or keyword. Returns a focused subset instead of the full manifest. |
| `get_aic_permissions` | Get risk band policies, forbidden actions, action-specific policies, and mutation rules. |
| `get_aic_workflows` | Get workflow definitions with steps, checkpoints, human approval requirements, and rollback paths. |
| `get_aic_actions` | Get semantic action contracts with preconditions, failure modes, undo capabilities, and batch config. |

## Tool Details

### `discover_aic_app`

**Input:**
- `base_url` (string, required) — Base URL of the app (e.g. `http://localhost:3000`)

**Output:** App name, version, AIC spec version, capability flags, resolved endpoint URLs for all manifests, and validation results.

### `get_aic_ui_state`

**Input:**
- `base_url` (string, required)

**Output:** Page metadata, view metadata, all rendered interactive elements with complete AIC metadata (IDs, roles, actions, risk, entity refs, execution/recovery, validation, workflow refs, current state), and relationships.

### `list_aic_elements`

**Input:**
- `base_url` (string, required)
- `role` (string, optional) — Filter by element role (`button`, `input`, `form`, `select`, etc.)
- `risk` (string, optional) — Filter by risk level (`low`, `medium`, `high`, `critical`)
- `entity_type` (string, optional) — Filter by entity type (`invoice`, `order`, `customer`, etc.)
- `query` (string, optional) — Free-text search across labels and descriptions
- `actionable_only` (boolean, optional, default `true`) — Hide disabled/hidden elements
- `limit` (number, optional, default `50`) — Max elements to return

**Output:** Filtered array of elements matching the criteria, with match counts and truncation info.

### `get_aic_permissions`

**Input:**
- `base_url` (string, required)

**Output:** Risk band policies (which levels require confirmation/audit), forbidden actions, action-specific policies with role requirements, and mutation rules.

### `get_aic_workflows`

**Input:**
- `base_url` (string, required)
- `workflow_id` (string, optional) — Return only this specific workflow

**Output:** Workflow definitions with steps, entry points, checkpoints, human approval steps, rollback/fallback steps, completion signals, and estimated duration.

### `get_aic_actions`

**Input:**
- `base_url` (string, required)
- `action_name` (string, optional) — Return only this specific action contract

**Output:** Semantic action contracts with preconditions, postconditions, side effects, failure modes, idempotency, undo capabilities, batch config, latency estimates, and dry-run support.

## Example Conversation

With the Next.js checkout demo running on `http://localhost:3000`:

> **You:** What actions are available on the checkout page? Which ones are critical risk?

Claude will automatically call:
1. `discover_aic_app({ base_url: "http://localhost:3000" })` — to confirm AIC support
2. `list_aic_elements({ base_url: "http://localhost:3000", risk: "critical" })` — to find critical-risk controls
3. Answer with structured information about each critical action, including confirmation requirements and workflow context

## Design Decisions

- **Read-only.** The MCP server tells the agent what exists and what the rules are. It does not physically click buttons or execute actions. The agent's own browser tool handles execution.
- **Stateless.** Every tool call fetches fresh data over HTTP. No server-side session or state required.
- **Minimal dependencies.** Only `@aicorg/spec` (for validation) and `@modelcontextprotocol/sdk`. No Playwright, no runtime library.
- **Works with any AIC app.** The server fetches manifests over HTTP, so it works with any framework that serves AIC manifests — not just React apps using the SDK.
