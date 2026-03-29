# AIC

AIC (Agent Interaction Contract) is an open contract and tooling stack for making web apps reliably operable by AI agents.

It is currently optimized for teams instrumenting **owned React/Next/Vite apps** with explicit AIC metadata.

## What Works Today

- runtime UI manifests with stable IDs, confirmation, entity, workflow, execution, recovery, and validation metadata
- generated discovery, action, permissions, and workflow manifests
- guarded CLI apply for exact-match source edits
- offline bootstrap from saved captures with reviewed outputs
- reference consumer proof showing external resolution by contract instead of selector-first fallbacks
- explicit `@aic/*/client` entrypoints for Next/RSC-aware consumption of React-facing packages
- coding-agent onboarding templates plus `aic init` and `aic doctor` for app repos adopting AIC

## Not Guaranteed Yet

- arbitrary third-party sites
- zero-touch onboarding of dynamic codebases
- heuristic repo mutation
- non-React production coverage
- npm package publishing from this repo

## Start Here

- [Next checkout example](/mnt/c/users/vatsa/agentinteractioncontrol/examples/nextjs-checkout-demo)
- [Vite CRM example](/mnt/c/users/vatsa/agentinteractioncontrol/examples/react-basic)
- [Bootstrap example](/mnt/c/users/vatsa/agentinteractioncontrol/examples/bootstrap-openai)
- [Coding Agent Onboarding](/mnt/c/users/vatsa/agentinteractioncontrol/docs/coding-agents.md)
- [Supported Today](/mnt/c/users/vatsa/agentinteractioncontrol/docs/supported-today.md)
- [Reference consumer proof](/mnt/c/users/vatsa/agentinteractioncontrol/tests/reference-consumer.test.mjs)

## Repo Status

- Public GitHub launch ready
- Packages remain private in this milestone
- npm publishing is intentionally deferred

## What Exists Now

- `@aic/spec`
  Rich discovery, runtime UI, permissions, workflows, action-contract, execution, recovery, validation, and browser-safe manifest diff models/helpers.
- `@aic/automation-core`
  Shared deterministic source scanning, diagnostics, project artifact generation, artifact writing, and CLI-facing manifest diff wrappers.
- `@aic/runtime`
  Provenance-aware in-browser registry with runtime serialization helpers and event hooks.
- `@aic/sdk-react`
  React-first AIC APIs, wrapped primitives, and compatibility aliases for the earlier `Agent*` surface.
- `@aic/plugin-next`
  Baseline Next artifact-generation plus real source scanning helpers.
- `@aic/plugin-vite`
  Baseline Vite artifact-generation plus real source scanning helpers.
- `@aic/cli`
  Scan, validate, project generation, manifest diffing, bootstrap, and inspection commands.
- `@aic/devtools`
  Runtime inspector overlay, opt-in live bridge, DOM discovery helpers, authoring patch-plan exports, and a browser-extension shell with popup plus DevTools panel assets.
- `@aic/ai-bootstrap`
  Playwright-backed capture helpers plus heuristic/model-provider review generation, prompt payload helpers, and human-review reports.
- `@aic/ai-bootstrap-http`
  Concrete HTTP transport adapter for model-backed bootstrap suggestion providers.
- `@aic/ai-bootstrap-openai`
  OpenAI Responses/Structured Outputs adapter for bootstrap suggestion generation.
- `@aic/integrations-radix` and `@aic/integrations-shadcn`
  Practical adapter coverage for common dialog, dropdown/menu, select, checkbox, switch, and tabs usage.
- examples
  A Vite CRM demo, a Next checkout demo proving serious-workflow metadata, and an OpenAI bootstrap example from saved captures.

## Core Outputs

- `/.well-known/agent.json`
- `/.well-known/agent/ui`
- `/.well-known/agent/actions`
- `agent-permissions.json`
- `agent-workflows.json`
- `operate.txt`

## Specs And Docs

- Checked-in v1 JSON Schemas now live under [`schemas/`](/mnt/c/users/vatsa/agentinteractioncontrol/schemas).
- Contract and usage docs live in:
  [manifest-spec.md](/mnt/c/users/vatsa/agentinteractioncontrol/docs/manifest-spec.md),
  [coding-agents.md](/mnt/c/users/vatsa/agentinteractioncontrol/docs/coding-agents.md),
  [sdk-api.md](/mnt/c/users/vatsa/agentinteractioncontrol/docs/sdk-api.md),
  [threat-model.md](/mnt/c/users/vatsa/agentinteractioncontrol/docs/threat-model.md),
  [release-checklist.md](/mnt/c/users/vatsa/agentinteractioncontrol/docs/release-checklist.md),
  [supported-today.md](/mnt/c/users/vatsa/agentinteractioncontrol/docs/supported-today.md),
  and [implementation-phases.md](/mnt/c/users/vatsa/agentinteractioncontrol/docs/implementation-phases.md).

## Coding Agent Onboarding

- The canonical coding-agent instructions for this repo live in [AGENTS.md](/mnt/c/users/vatsa/agentinteractioncontrol/AGENTS.md).
- Tool-specific wrappers live in [CLAUDE.md](/mnt/c/users/vatsa/agentinteractioncontrol/CLAUDE.md), [GEMINI.md](/mnt/c/users/vatsa/agentinteractioncontrol/GEMINI.md), [.github/copilot-instructions.md](/mnt/c/users/vatsa/agentinteractioncontrol/.github/copilot-instructions.md), and [.cursor/rules/aic.mdc](/mnt/c/users/vatsa/agentinteractioncontrol/.cursor/rules/aic.mdc).
- Run `aic init [project-root]` to scaffold `aic.project.json` plus the recommended onboarding files into an app repo.
- Run `aic doctor [project-root]` to audit config presence, onboarding files, scan coverage, diagnostics, and generated-manifest validity without mutating source files.
- Copy-ready starter files still live under [templates/agent-onboarding](/mnt/c/users/vatsa/agentinteractioncontrol/templates/agent-onboarding) for manual or external-tool use.
- `aic generate project ... --out-dir ...` now records optional onboarding warnings in `report.json` when the recommended repo-level agent files are missing or stale.

## Key Idea

Expose what the page means, not what the DOM looks like.

## Bootstrap Flow

- Capture routes with Playwright or provide saved captures to the CLI.
- Generate a structured prompt payload from `@aic/ai-bootstrap`.
- Feed that payload to your model provider and save the returned suggestion JSON.
- Or point the CLI at an HTTP model endpoint with `--provider-endpoint` and `--provider-model`.
- Or use the OpenAI shortcut with `--provider-kind openai --provider-model <model>`.
- Run `aic bootstrap <url> --captures-file <file> --suggestions-file <file>` to build a reviewable bundle without requiring a live browser session.
- For model-backed providers, use `--provider-timeout-ms` and `--provider-retries` to keep transient failures predictable. The defaults are `30000` ms and `2` retries.
- Add `--prompt-file`, `--draft-file`, `--review-file`, and `--report-file` to write bootstrap artifacts to disk.
- Use `--min-confidence` and `--max-suggestions` to keep the accepted draft subset deterministic while still preserving filtered suggestions inside the review bundle.

See [examples/bootstrap-openai/README.md](/mnt/c/Users/vatsa/agentinteractioncontrol/examples/bootstrap-openai/README.md#L1) for a copyable OpenAI-based workflow from saved captures.

## Automation Flow

- Run `aic init [project-root]` to scaffold onboarding files and a starter `aic.project.json`.
- Annotate controls with explicit `agent*` props.
- Run `aic doctor [project-root]` before artifact generation to surface missing config, onboarding drift, empty workflows/policies, extraction diagnostics, and invalid generated manifests.
- Run `aic scan <path>` to see extracted matches, deterministic source inventory entries, and diagnostics.
- Run `aic generate project <config-file> [--out-dir <dir>]` to emit discovery, UI, action, permissions, workflow, and `operate.txt` artifacts together. When `--out-dir` is used, the CLI also writes a review `report.json` with extracted matches, source inventory, and diagnostics.
- Run `aic diff <discovery|ui|permissions|workflows|actions> <before> <after>` for stable summary output.
- Add `--format detailed` when you need field-level before/after values for changed manifest entries.

## Devtools Flow

- Mount `AICDevtoolsBridge` next to `AICProvider` in development to emit live registry snapshots from the page.
- Use the in-app `AICDevtoolsOverlay` for quick visual checks.
- Use the browser extension popup for active-tab status.
- Use the browser DevTools panel for filtering, baseline capture, diffing, DOM discovery, imported `report.json` / bootstrap review context, and authoring patch-plan export.
- Run `aic apply authoring-plan <plan-file> --project-root <dir>` for a dry-run apply result, then add `--write` to commit guarded JSX prop edits for exact source matches.
- If the bridge is absent, the extension falls back to `/.well-known/agent/ui`.

## Example Coverage

- `examples/nextjs-checkout-demo`
  Proves structured confirmation on a critical checkout action, async save plus recovery metadata, validation guidance on coupon entry, and entity-bound order-line actions.
- `examples/react-basic`
  Proves CRM-style confirmation, async execution plus recovery, entity identity, workflow-linked controls, and validation-bearing note capture using the shadcn wrapper surface.

## Verification

- `pnpm check`
  Typechecks every workspace package and example.
- `pnpm build`
  Builds the published package entrypoints and example apps.
- `pnpm test`
  Rebuilds the workspace and runs contract tests for spec validation, runtime behavior, SDK rendering, plugin artifact generation, CLI flows, and bootstrap-provider adapters.
- `pnpm test:goldens`
  Rebuilds the workspace and verifies checked-in golden artifact directories against the current generators.
- `pnpm test:update-goldens`
  Rebuilds the workspace and refreshes the checked-in golden artifact directories after intentional contract changes.

## Contract Review Workflow

1. Update source annotations, generators, or fixtures.
2. Run `pnpm test:update-goldens`.
3. Inspect the manifest file diffs under `tests/fixtures/**/expected`.
4. Run `pnpm test:goldens`.
5. Run `pnpm test`.

## Current Stability Boundaries

- The offline bootstrap path using `--captures-file` is the stable baseline for CI and documentation.
- Model-backed bootstrap retries only on timeouts, network failures, `429`, and `5xx` responses. Ordinary `4xx`, invalid JSON, invalid structured responses, and OpenAI refusals fail fast with normalized provider errors.
- Live Playwright capture is implemented, but still depends on the local browser/sandbox environment.
- Framework plugins and the CLI support deterministic extraction only:
  string literals, no-substitution template literals, same-file const alias chains, same-file const object-member reads, and same-file zero-arg helpers that reduce to static strings.
- Dynamic JSX expressions are skipped with diagnostics instead of being inferred.
- Extraction diagnostics are review signals, not CI blockers by default. The repo treats warning drift as important by asserting expected diagnostics in fixtures and goldens.
- Devtools remains read-only: live inspection, filtering, diffing, DOM discovery, and authoring patch-plan export are implemented in the extension, but repo mutation only happens through the CLI apply flow.
- The first write-back phase is intentionally narrow: `aic apply authoring-plan` only mutates proposals with one exact source match and only edits JSX opening-tag AIC props in place.
- Radix and shadcn coverage now handles common control-layer adoption paths, but it is still not a full design-system mirror or a guarantee for every custom component pattern.
