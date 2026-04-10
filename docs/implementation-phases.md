# AIC Implementation Phases

This document maps the original master-spec phases to the current repo state.

## Phases 1-8

The master spec defined these implementation phases:

1. Spec foundation
2. Runtime registry
3. React SDK
4. Build plugins
5. CLI
6. Devtools
7. AI bootstrap
8. Integrations and demos

The current repo has all of those package families implemented:

- `@aicorg/spec`
- `@aicorg/runtime`
- `@aicorg/sdk-react`
- `@aicorg/plugin-next`
- `@aicorg/plugin-vite`
- `@aicorg/cli`
- `@aicorg/devtools`
- `@aicorg/ai-bootstrap`
- `@aicorg/integrations-radix`
- `@aicorg/integrations-shadcn`

It also includes:

- `@aicorg/automation-core`
- `@aicorg/ai-bootstrap-http`
- `@aicorg/ai-bootstrap-openai`

## Current Milestone

Treat the repo as:

- Phase 8 / MVP-baseline complete
- in stabilization and capability-deepening mode
- not yet fully production-polished across every edge case
- already carrying a small amount of post-MVP surface beyond the original master spec

## Beyond The Original Master Spec

The original master spec stopped the MVP at integrations and demos.

The current repo also includes:

- `@aicorg/mcp-server`
- `@aicorg/automation-core`
- guarded authoring-plan generation and apply flows wired through the CLI and devtools review loop

Those additions should be read as incremental capability work on top of the completed MVP, not as proof that a new roadmap phase is required before release hardening.

## What v1 Still Needs

- green verification from a clean workspace after the current release-facing changes are committed
- checked-in schema and docs artifacts that match the shipped surface
- deeper but still guarded write-back support around the authoring-plan/apply path
- stronger provider and bootstrap documentation for real evaluation flows
- fuller Radix/shadcn reference coverage in examples and docs

## Next Steps Now

The next milestone should stay inside stabilization:

1. Close the clean-workspace gate so the documented verification flow does not leave unexpected tracked diffs.
2. Finish docs and schema alignment so package docs, release docs, and generated-contract docs all describe the same shipped surface.
3. Harden guarded write-back around authoring plans instead of expanding into heuristic repo mutation.
4. Improve integration examples and reference docs for Radix/shadcn adoption depth.

## Explicit Non-Goals For This Milestone

Do not expand scope to:

- Vue or Svelte adapters
- new OpenAPI bridge work
- workflow recording
- enterprise governance/observability products

Those remain after the current v1 stabilization milestone.
