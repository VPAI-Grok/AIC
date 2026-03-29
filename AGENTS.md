<!-- AIC_AGENT_ONBOARDING_TEMPLATE_VERSION: 1 -->
# AIC Agent Onboarding

Use AIC when a repo owner wants a web app to be reliably operable by AI agents.

## Current Product Boundary

- Optimize for owned React, Next.js, and Vite apps.
- Prefer explicit metadata over inference.
- Treat runtime UI manifests as the source of truth for rich element semantics.
- Treat bootstrap as review assistance, not truth.

## Implementation Order

1. Find the critical user flows, risky actions, and entity-scoped actions.
2. Add `AICProvider` and development-time bridge/inspection support where appropriate.
3. Add explicit `agent*` props on important controls before trying to infer missing meaning.
4. Add or update `aic.project.json` with app identity, permissions, and workflows.
5. Run `aic scan` and `aic generate project ... --out-dir ...`.
6. Review `report.json`, manifests, and runtime output before considering the app AIC-ready.

## Required AIC Habits

- Use stable `agentId` values, not UI labels, as the contract key.
- Add `agentDescription`, `agentAction`, and `agentRisk` on critical paths.
- Add structured confirmation metadata for critical-risk actions.
- Add `agentEntityId`, `agentEntityType`, and `agentEntityLabel` for record-scoped actions when the app has a real backing entity.
- Add `agentWorkflowStep` where the UI is part of a meaningful multi-step flow.
- Add validation, execution, and recovery metadata where the app already exposes those semantics.

## Do Not

- Do not hand-edit generated AIC JSON artifacts.
- Do not rely on dynamic inference when explicit metadata is practical.
- Do not treat DOM selectors or visible text as the primary contract.
- Do not use bootstrap suggestions without review.

## Verification

- `aic scan <path>`
- `aic generate project <config-file> --out-dir <dir>`
- `aic inspect <dir>/report.json`
- `aic validate <kind> <file>`

## Done Criteria

- Critical and high-value actions have stable IDs and explicit semantics.
- Risk, confirmation, entity, workflow, validation, execution, and recovery metadata are present where needed.
- Generated discovery, UI, actions, permissions, and workflow artifacts are current.
- `report.json` has no unresolved onboarding or extraction surprises that should block review.
