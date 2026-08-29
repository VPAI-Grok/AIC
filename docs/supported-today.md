# Supported Today

This project currently targets **owned React/Next/Vite apps** where the team can add or review explicit AIC annotations.

## Supported Today

- explicit `agent*` metadata authored in React source
- runtime UI manifests as the authoritative source for rich per-element metadata
- generated discovery, action, permissions, and workflow manifests from project configs
- deterministic extraction of static aliases, object-member reads, spreads, template interpolation, and zero-arg helpers
- published devtools bridge and overlay helpers plus proposal export from the browser inspector
- CLI-only repo mutation through guarded authoring-plan apply
- bootstrap review bundles from saved captures with authoring-plan handoff and human-reviewed outputs
- coding-agent onboarding through `AGENTS.md`-style templates, `aic init`, and `aic doctor`
- experimental WebMCP support pinned to the `2026-08-26` draft through `@aicorg/webmcp`
- fail-closed imperative registration for explicitly authored execution-ready AIC action contracts
- declarative WebMCP React props with risky auto-submit suppression
- `aic scan --webmcp`, `aic doctor --webmcp`, and WebMCP implementation-plan generation

## Not Guaranteed Yet

- arbitrary third-party sites or zero-touch onboarding
- dynamic-code inference beyond the current deterministic extraction boundary
- heuristic or ambiguous repo mutation
- full production coverage for non-React ecosystems
- claims that agents can reliably operate an app without the app team owning the contract quality
- automatic conversion of inferred elements or generated review-only actions into executable WebMCP tools
- stable WebMCP browser coverage while the proposal and implementations remain experimental

## How To Read Current Claims

The strongest current proof is for apps that expose stable IDs and explicit metadata through AIC. In that environment, external consumers can resolve UI elements, actions, permissions, and workflows by contract rather than by DOM selector heuristics.
