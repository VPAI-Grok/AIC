# AIC Manifest Spec

This repo currently treats five JSON artifacts as the stable v1 contract surface:

- `/.well-known/agent.json`
- `/.well-known/agent/ui`
- `/.well-known/agent/actions`
- `agent-permissions.json`
- `agent-workflows.json`

`operate.txt` is intentionally not a schema-driven contract. It is a human-readable discovery aid.

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

Action contracts are the right place for dry-run, undo, preview, and batch metadata when the app exposes those semantics.

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

## Schemas

The checked-in v1 JSON Schemas live under [`schemas/`](/mnt/c/users/vatsa/agentinteractioncontrol/schemas):

- [agent.schema.json](/mnt/c/users/vatsa/agentinteractioncontrol/schemas/agent.schema.json)
- [agent-ui.schema.json](/mnt/c/users/vatsa/agentinteractioncontrol/schemas/agent-ui.schema.json)
- [agent-actions.schema.json](/mnt/c/users/vatsa/agentinteractioncontrol/schemas/agent-actions.schema.json)
- [agent-permissions.schema.json](/mnt/c/users/vatsa/agentinteractioncontrol/schemas/agent-permissions.schema.json)
- [agent-workflows.schema.json](/mnt/c/users/vatsa/agentinteractioncontrol/schemas/agent-workflows.schema.json)

They are intended as the portable artifact definitions for integrators and docs. The repo’s TypeScript validators remain the enforcement source used in tests and CLI validation.
