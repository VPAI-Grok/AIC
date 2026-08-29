<!-- AIC_AGENT_ONBOARDING_TEMPLATE_VERSION: 5 -->
# AIC Onboarding

Use this skill when the task is to make a React, Next.js, or Vite app AIC-ready.

## Workflow

1. Read [AGENTS.md](../../../AGENTS.md).
2. Find the critical user flows and risky actions.
3. Add explicit `agent*` metadata first.
4. Add or update `aic.project.json`.
5. Generate and inspect AIC artifacts.
6. Leave generated JSON to the tooling unless review requires otherwise.
7. For consequential multi-surface actions, define a behavior contract and run `aic verify`.
8. For externally relied-on claims, collect rendered/native evidence and verify an origin/revision-bound signed claim with a separately pinned trust store.
9. Bind covered critical operations to a reviewed conformance pack and apply every matching assurance-policy rule.

## Output Expectations

- stable `agentId` values
- meaningful risk and confirmation metadata
- entity and workflow metadata where applicable
- current discovery, UI, actions, permissions, and workflows artifacts
- behavior proof with the intended evidence level when parity is in scope
- independently verified deployment binding when a signed claim is in scope
- digest-bound conformance and fail-closed policy results when external reliance is in scope
