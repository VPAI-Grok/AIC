<!-- AIC_AGENT_ONBOARDING_TEMPLATE_VERSION: 1 -->
# AIC Agent Onboarding

Use AIC when this repo needs to expose reliable interaction semantics for AI agents.

## Implementation Order

1. Identify the important flows, risky actions, and entity-scoped actions.
2. Add explicit `agent*` metadata to important controls.
3. Add or update `aic.project.json`.
4. Generate and inspect AIC artifacts.
5. Fix review findings before treating the app as agent-ready.

## Rules

- stable IDs first
- explicit metadata over inference
- confirmation on critical actions
- entity metadata on record-scoped actions
- workflow, validation, execution, and recovery metadata where the app supports them
- generated JSON stays generated

## Verification

- `aic scan <path>`
- `aic generate project <config-file> --out-dir <dir>`
- `aic inspect <dir>/report.json`
- `aic validate <kind> <file>`
