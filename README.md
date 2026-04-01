# AIC

AIC (Agent Interaction Contract) is an open contract and tooling stack for making web apps reliably operable by AI agents.

At a high level, AIC gives an app a stable, machine-readable interface for agent operation. Instead of forcing an agent to guess intent from brittle selectors, DOM structure, screenshots, or button text, AIC lets the app publish explicit semantics: what an element is, what action it performs, how risky it is, whether it needs confirmation, what entity it acts on, which workflow it belongs to, and what completion or recovery conditions apply.

The core idea is simple: expose what the UI means, not just what it looks like. In an AIC-instrumented app, important controls get stable contract IDs and explicit metadata, the runtime can emit a live UI manifest describing what is currently available, and the build/generation toolchain can emit discovery, actions, permissions, and workflow artifacts that external agents can consume without relying on selector-first automation.

In practice, AIC is made of a few layers that work together:

- a spec layer that defines the manifest shapes and validation rules
- a runtime/UI layer that serializes the current app state into agent-readable manifests
- a React SDK and integration helpers for adding explicit `agent*` metadata in real app code
- a CLI and automation layer for scanning source, generating artifacts, validating manifests, bootstrapping reviewed suggestions, and auditing adoption readiness
- an MCP server that lets tools like Claude Desktop, Cursor, and other MCP-compatible agents query AIC-enabled apps directly

This repo does not try to make arbitrary websites magically agent-safe. The current product boundary is much narrower and more honest: AIC is optimized for teams instrumenting **owned React/Next/Vite apps** with explicit metadata, reviewed generation, and contract-first agent operations.

If you are evaluating the project quickly, the shortest useful mental model is:

- developers annotate important UI controls with stable IDs and semantics
- AIC turns that into runtime and generated manifests
- agents use those manifests to discover capabilities and operate the app more reliably than raw DOM scraping alone

That makes AIC useful anywhere an app owner wants stronger guarantees around agent behavior, especially for risky actions, record-scoped operations, multi-step workflows, and UI flows where “click the thing that looks right” is not good enough.

The repository is source-available under `PolyForm-Noncommercial-1.0.0`. Personal, research, evaluation, and other noncommercial use is allowed under that license, but direct commercial monetization is not.

## What Works Today

- runtime UI manifests with stable IDs, confirmation, entity, workflow, execution, recovery, and validation metadata
- generated discovery, action, permissions, and workflow manifests
- guarded CLI apply for exact-match source edits
- offline bootstrap from saved captures with reviewed outputs
- reference consumer proof showing external resolution by contract instead of selector-first fallbacks
- explicit `@aicorg/*/client` entrypoints for Next/RSC-aware consumption of React-facing packages
- coding-agent onboarding templates plus `aic init` and `aic doctor` for app repos adopting AIC
- alpha npm packages are live for the core `@aicorg/*` publish wave, with tarball smoke tests and a release workflow backing the release process
- **MCP server** lets Claude Desktop, Cursor, and other MCP-compatible agents discover and reason about AIC-instrumented apps natively

## MCP Server

Any MCP-compatible AI agent can connect to an AIC-instrumented app:

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

This gives the agent 6 read-only tools to discover app capabilities, inspect UI elements, filter by risk/role/entity, read permissions and workflows, and understand semantic action contracts.

See [docs/mcp-server.md](./docs/mcp-server.md) for full setup and tool reference.

## Not Guaranteed Yet

- arbitrary third-party sites
- zero-touch onboarding of dynamic codebases
- heuristic repo mutation
- non-React production coverage
- stable npm GA publication has not happened yet

## Start Here

- [MCP Server (Claude Desktop / Cursor)](./docs/mcp-server.md)
- [Next checkout example](./examples/nextjs-checkout-demo)
- [Vite CRM example](./examples/react-basic)
- [TodoMVC MCP Benchmark](./examples/todomvc-react)
- [Bootstrap example](./examples/bootstrap-openai)
- [Coding Agent Onboarding](./docs/coding-agents.md)
- [npm Packages](./docs/npm-packages.md)
- [Supported Today](./docs/supported-today.md)
- [Reference consumer proof](./tests/reference-consumer.test.mjs)

## Repo Status

- Public GitHub launch ready
- First-wave `@aicorg/*` packages are published to npm under the `alpha` tag
- Further package releases still go through the GitHub publish workflow

## npm Alpha Packaging

- The first npm wave targets the core publishable packages under the existing `@aicorg/*` scope.
- `@aicorg/devtools` and the example apps remain repo-only for now.
- Package release plumbing uses Changesets plus a manual GitHub Actions publish workflow.
- See [npm-packages.md](./docs/npm-packages.md) for the published package matrix and install commands.

## What Exists Now

- `@aicorg/spec`
  Rich discovery, runtime UI, permissions, workflows, action-contract, execution, recovery, validation, and browser-safe manifest diff models/helpers.
- `@aicorg/automation-core`
  Shared deterministic source scanning, diagnostics, project artifact generation, artifact writing, onboarding init/doctor helpers, and CLI-facing manifest diff wrappers.
- `@aicorg/runtime`
  Provenance-aware in-browser registry with runtime serialization helpers and event hooks.
- `@aicorg/sdk-react`
  React-first AIC APIs, wrapped primitives, and compatibility aliases for the earlier `Agent*` surface.
- `@aicorg/plugin-next`
  Baseline Next artifact-generation plus real source scanning helpers.
- `@aicorg/plugin-vite`
  Baseline Vite artifact-generation plus real source scanning helpers.
- `@aicorg/cli`
  Scan, init, doctor, validate, project generation, authoring-plan generation/apply, manifest diffing, bootstrap, and inspection commands.
- `@aicorg/devtools`
  Runtime inspector overlay, opt-in live bridge, DOM discovery helpers, authoring patch-plan exports, and a browser-extension shell with popup plus DevTools panel assets.
- `@aicorg/ai-bootstrap`
  Playwright-backed capture helpers plus heuristic/model-provider review generation, prompt payload helpers, and human-review reports.
- `@aicorg/ai-bootstrap-http`
  Concrete HTTP transport adapter for model-backed bootstrap suggestion providers.
- `@aicorg/ai-bootstrap-openai`
  OpenAI Responses/Structured Outputs adapter for bootstrap suggestion generation.
- `@aicorg/integrations-radix` and `@aicorg/integrations-shadcn`
  Practical adapter coverage for common dialog, dropdown/menu, select, checkbox, switch, and tabs usage.
- `@aicorg/mcp-server`
  MCP server exposing AIC manifests to Claude Desktop, Cursor, and other MCP-compatible agents with 6 read-only tools for discovery, UI inspection, element filtering, permissions, workflows, and semantic actions.
- examples
  A Vite CRM demo, a Next checkout demo proving serious-workflow metadata, an OpenAI bootstrap example from saved captures, and a TodoMVC benchmark proving out autonomous MCP interoperability.

## Core Outputs

- `/.well-known/agent.json`
- `/.well-known/agent/ui`
- `/.well-known/agent/actions`
- `agent-permissions.json`
- `agent-workflows.json`
- `operate.txt`

## Specs And Docs

- Checked-in v1 JSON Schemas now live under [`schemas/`](./schemas/).
- Contract and usage docs live in:
  [manifest-spec.md](./docs/manifest-spec.md),
  [coding-agents.md](./docs/coding-agents.md),
  [npm-packages.md](./docs/npm-packages.md),
  [mcp-server.md](./docs/mcp-server.md),
  [sdk-api.md](./docs/sdk-api.md),
  [threat-model.md](./docs/threat-model.md),
  [release-checklist.md](./docs/release-checklist.md),
  [supported-today.md](./docs/supported-today.md),
  and [implementation-phases.md](./docs/implementation-phases.md).

## Coding Agent Onboarding

- The canonical coding-agent instructions for this repo live in [AGENTS.md](./AGENTS.md).
- Tool-specific wrappers live in [CLAUDE.md](./CLAUDE.md), [GEMINI.md](./GEMINI.md), [.github/copilot-instructions.md](./.github/copilot-instructions.md), and [.cursor/rules/aic.mdc](./.cursor/rules/aic.mdc).
- Run `aic init [project-root]` to scaffold `aic.project.json` plus the recommended onboarding files into an app repo.
- Run `aic doctor [project-root]` to audit config presence, onboarding files, scan coverage, diagnostics, and generated-manifest validity without mutating source files.
- Copy-ready starter files still live under [templates/agent-onboarding](./templates/agent-onboarding) for manual or external-tool use.
- `aic generate project ... --out-dir ...` now records optional onboarding warnings in `report.json` when the recommended repo-level agent files are missing or stale.

## Key Idea

Expose what the page means, not what the DOM looks like.

## Bootstrap Flow

- Capture routes with Playwright or provide saved captures to the CLI.
- Generate a structured prompt payload from `@aicorg/ai-bootstrap`.
- Feed that payload to your model provider and save the returned suggestion JSON.
- Or point the CLI at an HTTP model endpoint with `--provider-endpoint` and `--provider-model`.
- Or use the OpenAI shortcut with `--provider-kind openai --provider-model <model>`.
- Run `aic bootstrap <url> --captures-file <file> --suggestions-file <file>` to build a reviewable bundle without requiring a live browser session.
- For model-backed providers, use `--provider-timeout-ms` and `--provider-retries` to keep transient failures predictable. The defaults are `30000` ms and `2` retries.
- Add `--prompt-file`, `--draft-file`, `--review-file`, and `--report-file` to write bootstrap artifacts to disk.
- Use `--min-confidence` and `--max-suggestions` to keep the accepted draft subset deterministic while still preserving filtered suggestions inside the review bundle.

See [examples/bootstrap-openai/README.md](./examples/bootstrap-openai/README.md) for a copyable OpenAI-based workflow from saved captures.

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
  Builds the workspace packages and example apps.
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
