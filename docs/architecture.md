# AIC Architecture Notes

The repo is now aligned to the master-spec core platform rather than the earlier thin prototype.

## Current Core Packages

- `@aicorg/spec`
  The source of truth for discovery, runtime UI, permissions, workflows, semantic actions, action contracts, entity refs, execution metadata, recovery metadata, confirmation, validation, and browser-safe manifest diff helpers.
- `@aicorg/automation-core`
  The shared source-to-artifact layer. It scans source files, emits deterministic diagnostics, generates project manifests, writes artifact files, creates review reports, and reuses the shared manifest diff helpers.
- `@aicorg/runtime`
  The live registry and serializer layer. It merges provenance sources in this order: `ai_suggested`, `inferred`, `authored`.
- `@aicorg/sdk-react`
  The React-first API surface. `AICProvider`, `useAICRegistry`, `useAICElement`, and `AIC.*` wrappers are preferred. `Agent*` exports remain compatibility aliases.
- `@aicorg/plugin-next` and `@aicorg/plugin-vite`
  Framework-facing wrappers over the shared automation core.
- `@aicorg/cli`
  Source scanning, validation, project generation, diffing, manifest inspection, and Playwright-backed bootstrap entrypoints.
- `@aicorg/devtools`
  The development-time inspection and authoring layer. It now supports an opt-in React bridge, an in-app overlay, DOM discovery helpers, and a Chrome-first extension shell with popup plus DevTools panel assets.
- `@aicorg/ai-bootstrap-http`
  A concrete HTTP adapter that turns the generic bootstrap model-client contract into a simple JSON POST integration.
- `@aicorg/ai-bootstrap-openai`
  A provider-specific adapter that targets the OpenAI Responses API with Structured Outputs.

## Contract Model

### Discovery

Discovery is served from `/.well-known/agent.json` and includes:

- `spec`
- `app`
- `capabilities`
- `endpoints`
- optional `framework`, `generated_at`, `manifest_version`, `notes`, and compatibility metadata

### Runtime UI

The runtime manifest describes the live interface and includes:

- `page`
- `view`
- `user_context`
- `elements`
- `relationships`
- `updated_at`

Each element carries:

- stable ID, role, label, description
- actions and effects
- risk, confirmation, validation, and recovery metadata
- entity references
- execution metadata
- workflow references
- provenance metadata

### Validation and Safety

Blocking rules currently enforced:

- duplicate IDs
- malformed discovery/runtime/permissions/workflow/action manifests
- critical actions without structured confirmation
- action contracts missing completion or failure semantics

Warnings currently enforced:

- row- or grid-associated actions without entity identity
- async elements without described effects
- unknown action names outside semantic-action contexts

## Automation Model

The shared automation pipeline currently supports only deterministic extraction:

- direct string literals
- no-substitution template literals
- same-file const alias chains
- property access or string-literal bracket access on same-file const object literals
- same-file zero-arg helpers with a single static return expression

Unsupported dynamic expressions are skipped with diagnostics. The pipeline does not attempt cross-module inference or runtime evaluation, and imported or effectful helpers remain out of scope.

Project-level generation now emits the full artifact set from one config:

- discovery
- runtime UI
- semantic actions
- permissions
- workflows
- `operate.txt`

When the CLI writes a project to disk, it also emits a `report.json` review file containing:

- framework
- files scanned
- extracted matches
- deterministic source inventory entries for exact apply matching
- deterministic diagnostics

## Devtools Model

The devtools workflow now has two data sources:

- live bridge snapshots emitted from `AICDevtoolsBridge`
- endpoint fallback reads from `/.well-known/agent/ui`

The authoring workflow adds two optional augmentation sources:

- on-demand DOM discovery candidates for currently unannotated controls
- imported project `report.json` and bootstrap `review.json` artifacts for source resolution and suggestion enrichment

The bridge dispatches a browser event carrying:

- `version`
- `captured_at`
- `source`
- `manifest`

The extension stores the latest snapshot by tab and the panel renders:

- connection state
- filterable element list
- selected-element detail
- baseline-vs-current UI diff
- raw JSON export
- authoring proposals with ready / unresolved / ignored states plus apply eligibility
- copyable prop snippets plus exported patch-plan JSON and summary text

Repo mutation stays outside the extension. The write path now lives in the CLI:

- `aic apply authoring-plan <plan-file> --project-root <dir>` runs a dry-run apply
- adding `--write` performs guarded in-place JSX prop edits for exact source matches only
- drifted, ambiguous, review-only, or ignored proposals are skipped instead of guessed

## Near-Term Direction

The current codebase now covers the master-spec core platform plus read-only devtools authoring plus a first guarded CLI apply path. The next substantial layers are:

- richer model-provider integrations on top of the current bootstrap prompt/provider pipeline
- broader table/card/list semantics and deeper design-system adoption beyond the current control-layer Radix/shadcn coverage
- potentially broader static extraction only if it remains deterministic and reviewable
- deeper write-back support beyond in-place JSX prop edits, including broader source inventories and more complex component patterns

## Example Proof Surface

The example apps now act as the primary proof surface for the current contract claims:

- `examples/nextjs-checkout-demo` demonstrates critical confirmation, async execution plus recovery, validation-bearing checkout inputs, and entity-bound order-line actions.
- `examples/react-basic` demonstrates CRM-oriented confirmation, execution, recovery, workflow references, and validation-bearing note capture on the shadcn wrapper surface.

Contract tests render these example metadata flows and validate the serialized runtime manifests directly so the examples remain aligned with the supported product boundary.

## Stabilization Gates

The repo now treats correctness as a first-class concern:

- fixture-backed contract tests cover spec validation, runtime merging, SDK rendering, plugin artifact generation, CLI commands, and bootstrap provider adapters
- checked-in golden artifact directories provide a file-level review surface for source-to-manifest changes
- CI runs `pnpm check`, `pnpm build`, `pnpm test:goldens`, and `pnpm test:contracts`
- plugin and CLI verification is based on explicit, deterministic annotations rather than inferred dynamic behavior
- extraction warnings remain non-blocking by default, but expected diagnostics are asserted so drift fails review

The intended baseline workflow for contributors is:

1. update code and fixtures together when contract output changes
2. run `pnpm test:update-goldens`
3. inspect the expected manifest file diffs
4. run `pnpm test:goldens`
5. run `pnpm test`

## Bootstrap Provider Path

`@aicorg/ai-bootstrap` now supports three suggestion modes:

- heuristic generation directly from captures
- static/file-backed suggestions for offline review workflows
- structured model providers via a generic `completeJson(...)` client contract

The intended production flow is:

1. collect captures
2. build a normalized prompt payload
3. call a model provider outside the core library
4. normalize suggestions back into an AIC review bundle and accepted draft subset for human review

The concrete reference implementations for step 3 now live in two places:

- `@aicorg/ai-bootstrap-http` for generic JSON POST providers
- `@aicorg/ai-bootstrap-openai` for OpenAI Responses API integrations using Structured Outputs

The repo also now includes a runnable reference workflow in [examples/bootstrap-openai/README.md](/mnt/c/Users/vatsa/agentinteractioncontrol/examples/bootstrap-openai/README.md#L1), backed by a saved capture file and CLI artifact emission.

The preferred CLI artifact flow is:

- `--prompt-file` for the provider prompt payload
- `--review-file` for the full structured review bundle
- `--draft-file` for the accepted manifest subset
- `--report-file` for a concise human-readable review summary

Review bundles keep accepted and filtered suggestions together, record deterministic issue codes such as duplicate targets and low-confidence filtering, and embed manifest-validation findings without failing generation by default.
