# ADR 0001: Use WebMCP As A Browser Execution Layer

- Status: Accepted
- Date: 2026-08-28
- Compatibility baseline: WebMCP draft `2026-08-26`, `document.modelContext`, `webmcp-types@0.1.5`

## Context

WebMCP provides a proposed browser-native way for a page to register task-level JavaScript tools. AIC already provides richer interaction semantics, generated manifests, permissions, workflows, runtime state, and read-only MCP discovery.

Building a second browser tool protocol would fragment adoption and duplicate standards work. Treating WebMCP registrations as trustworthy merely because they have a name and JSON schema would discard AIC's core safety value.

## Decision

Use WebMCP for native browser discovery and invocation when available. Use AIC as the contract, readiness, governance, verification, recovery, and audit layer around consequential WebMCP tools.

Only explicitly authored action contracts marked `execution_ready` may be registered through the AIC adapter. Generated, inferred, and AI-suggested contracts remain review material.

AIC manifests and the AIC MCP server remain independent compatibility surfaces. WebMCP support is feature-detected and must not break the human experience or unsupported browsers.

## Consequences

- AIC complements Microsoft, Google, browser vendors, and the standards process instead of competing with them.
- AIC differentiates on safe business-flow execution rather than generic browser hooks or polyfills.
- Tool registration is intentionally more demanding for high and critical actions.
- The compatibility baseline must be reviewed as the draft and browser implementations change.
- Human UI and WebMCP execution must share application/domain functions.
