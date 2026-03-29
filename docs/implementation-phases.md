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

## What v1 Still Needs

- green verification from a clean workspace
- checked-in schema and docs artifacts that match the shipped surface
- deeper but still guarded write-back support
- stronger provider and bootstrap documentation
- fuller Radix/shadcn reference coverage

## Explicit Non-Goals For This Milestone

Do not expand scope to:

- Vue or Svelte adapters
- MCP or OpenAPI bridge work
- workflow recording
- enterprise governance/observability products

Those remain after the current v1 stabilization milestone.
