---
"@aicorg/automation-core": minor
"@aicorg/cli": minor
"@aicorg/runtime": minor
"@aicorg/spec": minor
---

Publish governed WebMCP tools in `/.well-known/agent.json` and detect third-party WebMCP wrappers.

Discovery manifests gain an optional `webmcp` block declaring the API, pinned draft, and each
governed tool's risk, read-only status, required confirmation, required permission, and workflow —
the semantics the `document.modelContext` tool descriptor cannot carry. The block is emitted only
when a project declares at least one governed tool.

WebMCP source readiness now recognizes registrations made through community wrapper modules
(`use-webmcp-tool`, `use-webmcp`, `@mcp-b/react-webmcp`, `@mcp-b/webmcp`, `webmcp-react`) and counts
them as current-but-ungoverned. Previously `aic scan --webmcp` reported `not_detected` for apps that
register every tool through a wrapper hook.
