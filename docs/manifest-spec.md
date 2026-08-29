# AIC Manifest Spec

This repo treats five JSON artifacts as the v1 interaction-description surface:

- `/.well-known/agent.json`
- `/.well-known/agent/ui`
- `/.well-known/agent/actions`
- `agent-permissions.json`
- `agent-workflows.json`

`operate.txt` is intentionally not a schema-driven contract. It is a human-readable discovery aid.

Behavior assurance uses a separate, protocol-neutral artifact family. Interaction manifests describe what an app exposes; behavior contracts and proofs test what those surfaces actually do.

## Discovery

The discovery manifest advertises that AIC is enabled and tells agents where to find the rest of the contract.

Required fields:

- `spec`
- `app.name`
- `capabilities`
- `endpoints`
- `generated_at`

Typical endpoint mapping:

- `ui` -> `/.well-known/agent/ui`
- `actions` -> `/.well-known/agent/actions`
- `permissions` -> `/agent-permissions.json`
- `workflows` -> `/agent-workflows.json`

## Runtime UI

The runtime manifest is the source of truth for what the page means right now.

Required fields:

- `spec`
- `page.url`
- `view.view_id`
- `updated_at`
- `elements`

Each element must currently provide:

- `id`
- `label`
- `role`
- at least one `actions[]` entry
- `risk`
- `state`

Important v1 safety expectations:

- duplicate element IDs are blocking
- critical-risk elements must include structured confirmation metadata
- row/grid-affecting actions should include `entity_ref`
- async or long-running elements should describe effects and execution hints

## Semantic Actions

Semantic actions provide a safer abstraction than replaying raw DOM interactions.

Each action contract currently requires:

- `name`
- `title`
- `target`
- `preconditions`
- `postconditions`
- `side_effects`
- `idempotent`
- `undoable`
- `estimated_latency_ms`
- `completion_signal`
- `failure_modes`
- `execution_readiness`

Action contracts are the right place for dry-run, undo, preview, and batch metadata when the app exposes those semantics.

`execution_readiness.status` is either `review_required` or `execution_ready`. Execution-ready contracts must be explicitly authored, have no unresolved blockers, and contain real completion and failure semantics. Generated contracts are marked inferred and review-required; consumers must not treat them as executable authority.

## Permissions

The permissions manifest is the policy layer over the UI/action surface.

Required fields:

- `spec`
- `generated_at`
- `riskBands.low`
- `riskBands.medium`
- `riskBands.high`
- `riskBands.critical`

Risk-band policies are the stable baseline. Action-specific policies are optional overrides.

## Workflows

Workflows model multi-step task structure above individual element actions.

Each workflow currently requires:

- `id`
- `title`
- `entry_points`
- `steps`

Use workflows for checkpointing, fallback, rollback, human approvals, and completion signals.

## Behavior assurance artifacts

The `aic.behavior/0.1` family is not generated from UI annotations and should not be mixed into the five discovery manifests.

- `aic_behavior_contract` defines one business action, its stable domain `operation_id`, supported surfaces, behavioral requirements, and expected scenarios.
- `aic_behavior_observation_set` records executed or imported evidence for each required scenario/surface pair.
- `aic_behavior_proof` records deterministic verification results, evidence level, artifact digests, findings, and parity status.

Use `aic validate behavior <file>` for contracts and `aic verify` to create proofs. See [Behavior Assurance](./behavior-assurance.md).

## Schemas

The checked-in JSON Schemas live under [`schemas/`](../schemas):

- [agent.schema.json](../schemas/agent.schema.json)
- [agent-ui.schema.json](../schemas/agent-ui.schema.json)
- [agent-actions.schema.json](../schemas/agent-actions.schema.json)
- [agent-permissions.schema.json](../schemas/agent-permissions.schema.json)
- [agent-workflows.schema.json](../schemas/agent-workflows.schema.json)
- [behavior-contract.schema.json](../schemas/behavior-contract.schema.json)
- [behavior-observation-set.schema.json](../schemas/behavior-observation-set.schema.json)
- [behavior-proof.schema.json](../schemas/behavior-proof.schema.json)

They are intended as the portable artifact definitions for integrators and docs. The repo’s TypeScript validators remain the enforcement source used in tests and CLI validation.
