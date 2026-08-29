<!-- AIC_AGENT_ONBOARDING_TEMPLATE_VERSION: 4 -->
# AIC Agent Onboarding

Use AIC when a repo owner wants a web app to be reliably operable by AI agents.

## Current Product Boundary

- Optimize for owned React, Next.js, and Vite apps.
- Prefer explicit metadata over inference.
- Treat runtime UI manifests as the source of truth for rich element semantics.
- Treat bootstrap as review assistance, not truth.
- Treat native protocols as the source of truth for their own fields.
- Use AIC behavior contracts to prove shared business behavior across surfaces.

## Implementation Order

1. Find the critical user flows, risky actions, entity-scoped actions, and every human or agent entrypoint for them.
2. Add `AICProvider` and development-time bridge/inspection support where appropriate.
3. Add explicit `agent*` props on important controls before trying to infer missing meaning.
4. Add or update `aic.project.json` with app identity, permissions, and workflows.
5. Run `aic scan` and `aic generate project ... --out-dir ...`.
6. Review `report.json`, manifests, and runtime output before considering the interaction metadata ready.
7. For consequential multi-surface actions, add a behavior contract and executable success, denial, confirmation, failure, and recovery scenarios.
8. Run `aic verify` and review the proof before claiming behavioral parity.
9. For evidence others will rely on, run the rendered/native browser lane, bind a passed proof to the exact origin/deployment/revision, sign it, and verify it with a separately pinned trust store.

## Required AIC Habits

- Use stable `agentId` values, not UI labels, as the contract key.
- Use one stable domain `operation_id` for all surfaces that perform the same business action.
- Add `agentDescription`, `agentAction`, and `agentRisk` on critical paths.
- Add structured confirmation metadata for critical-risk actions.
- Add `agentEntityId`, `agentEntityType`, and `agentEntityLabel` for record-scoped actions when the app has a real backing entity.
- Add `agentWorkflowStep` where the UI is part of a meaningful multi-step flow.
- Add validation, execution, and recovery metadata where the app already exposes those semantics.
- Distinguish metadata readiness from executed behavior proof.
- Distinguish a passed proof, a signed issuer claim, CI provenance, and independent production verification.

## Do Not

- Do not hand-edit generated AIC JSON artifacts.
- Do not rely on dynamic inference when explicit metadata is practical.
- Do not treat DOM selectors or visible text as the primary contract.
- Do not use bootstrap suggestions without review.
- Do not duplicate a native protocol field only to preserve an AIC-shaped copy.
- Do not call a local unsigned proof a production attestation.
- Do not treat registry inclusion or a valid issuer signature as independent proof that production is reachable or certified.

## WebMCP Policy

- Treat WebMCP as the browser-native execution layer and AIC as the protocol-neutral behavioral assurance layer.
- Prefer native WebMCP fields and lifecycle controls when they are equivalent.
- Use the current `document.modelContext` API and the compatibility baseline recorded in `docs/webmcp.md`.
- Prefer `@aicorg/webmcp` for imperative tools and the explicit React WebMCP props for declarative forms.
- Register task-level tools only from authored AIC action contracts marked `execution_ready`.
- Reuse the same application/domain function for human UI and WebMCP execution.
- Feature-detect WebMCP and preserve the human flow in unsupported browsers.
- Do not build a competing protocol or generic polyfill inside AIC.
- Never expose generated, inferred, AI-suggested, or placeholder action contracts as executable WebMCP tools.

## AIC Verified Policy

- Prefer `@aicorg/evidence-playwright` for rendered human/WebMCP evidence and require native `document.modelContext` for WebMCP claims.
- Probe draft argument encoding only with a confirmed read-only tool; never retry an uncertain mutating tool execution.
- Sign only passed proofs whose contract digest matches the supplied contract.
- Bind signed claims to a canonical origin, environment, deployment ID, and full source revision.
- Keep issuer private keys out of repositories and uploaded evidence bundles.
- Treat registries as untrusted discovery; verify embedded attestations with a separately pinned trust store and explicit origin/revision expectations.
- Use short validity, rotation, revocation, and independently operated remote runners for production-grade reliance.

## Verification

- `aic scan <path>`
- `aic generate project <config-file> --out-dir <dir>`
- `aic inspect <dir>/report.json`
- `aic validate <kind> <file>`
- `aic scan <path> --webmcp`
- `aic doctor <path> --webmcp`
- `aic validate behavior <behavior-contract-file>`
- `aic verify <behavior-contract-file> --harness <module> --out-file <proof-file>`
- `aic trust verify <attestation-file> --trust-store <trust-store-file> --contract <contract-file> --proof <proof-file> --expect-origin <origin> --expect-revision <revision>`
- `aic registry verify <registry-file> --trust-store <trust-store-file>`
- `aic inspect <proof-file>`

## Done Criteria

- Critical and high-value actions have stable IDs and explicit semantics.
- Risk, confirmation, entity, workflow, validation, execution, and recovery metadata are present where needed.
- Generated discovery, UI, actions, permissions, and workflow artifacts are current.
- `report.json` has no unresolved onboarding or extraction surprises that should block review.
- Consequential multi-surface actions map to the same domain operation and have explicit behavior contracts.
- Required proof scenarios pass with the intended evidence level and no unresolved parity findings.
- Any externally relied-on signed claim verifies against a pinned issuer key and the expected origin, deployment context, source revision, contract, and proof.
