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

## Not Guaranteed Yet

- arbitrary third-party sites or zero-touch onboarding
- dynamic-code inference beyond the current deterministic extraction boundary
- heuristic or ambiguous repo mutation
- full production coverage for non-React ecosystems
- claims that agents can reliably operate an app without the app team owning the contract quality

## How To Read Current Claims

The strongest current proof is for apps that expose stable IDs and explicit metadata through AIC. In that environment, external consumers can resolve UI elements, actions, permissions, and workflows by contract rather than by DOM selector heuristics.
