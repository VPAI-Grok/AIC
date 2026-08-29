<!-- AIC_AGENT_ONBOARDING_TEMPLATE_VERSION: 5 -->
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
9. For a covered consequential operation, select a versioned conformance pack, author and review its application mapping, and verify the digest-bound binding.
10. For evidence others will rely on, use the appropriate browser, HTTP/OpenAPI, or MCP adapter. If collection is remote, use a data-only job, exact deployment identity, and explicit mutation grants.
11. Regenerate the proof from the collected observations and verify the applicable conformance binding.
12. Bind a passed proof to the exact origin/deployment/revision, sign it, verify it with a separately pinned trust store, and apply every matching assurance-policy rule before relying on the result.

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
- Treat conformance mappings as reviewed application assertions, not generated semantic truth.
- Treat assurance policy as cumulative and fail closed when no rule matches.
- Pin issuer IDs, key IDs, runner IDs, origins, and revisions whenever the relying party needs those identities rather than a self-declared provenance label.

## Do Not

- Do not hand-edit generated AIC JSON artifacts.
- Do not rely on dynamic inference when explicit metadata is practical.
- Do not treat DOM selectors or visible text as the primary contract.
- Do not use bootstrap suggestions without review.
- Do not duplicate a native protocol field only to preserve an AIC-shaped copy.
- Do not call a local unsigned proof a production attestation.
- Do not treat registry inclusion or a valid issuer signature as independent proof that production is reachable or certified.
- Do not treat the open remote-runner software as evidence that a separate operator ran it.
- Do not treat an external transparency receipt reference as verified unless its provider-specific verifier has checked it.
- Do not use scheduled key rotation as an automated response to a suspected key compromise.

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

## Open Ecosystem Conformance Policy

- Prefer a built-in versioned conformance pack when an operation matches checkout, billing mutation, account deletion, admin mutation, or record CRUD obligations.
- Review every contract-to-pack mapping. A digest-bound mapping prevents later substitution; it does not prove the mapping was semantically correct.
- Keep evidence plans and remote jobs data-only. Do not permit executable modules, shell commands, callbacks, implicit secrets, or unbounded response capture.
- Require public-network targets, reject redirects, use strict response projections, and bind exact origin/deployment/revision values for remote evidence.
- Deny remote mutations by default. Require both an operation-specific canary grant and an operator grant, and never retry an uncertain mutation.
- Regenerate proof from observations during policy evaluation. Do not trust producer-supplied proof summaries.
- Apply every matching policy rule, require an explicit match, and enforce freshness, required scenarios, evidence strength, parity, trust, binding, and allowed issuer/key/runner identities cumulatively.
- Treat the signed linear transparency index as an offline/reference history format, not a global public transparency protocol. External receipt references are hash-bound metadata and remain `not_checked` until a provider verifier validates them.
- Rotate keys only through a dual-signed transition that binds the prior and next trust stores, retains the retiring key through `valid_until`, and does not broaden origin scope. Use revocation and an out-of-band recovery process for suspected compromise.

## Verification

- `aic scan <path>`
- `aic generate project <config-file> --out-dir <dir>`
- `aic inspect <dir>/report.json`
- `aic validate <kind> <file>`
- `aic scan <path> --webmcp`
- `aic doctor <path> --webmcp`
- `aic validate behavior <behavior-contract-file>`
- `aic verify <behavior-contract-file> --harness <module> --out-file <proof-file>`
- `aic conformance list`
- `aic conformance show <pack-id-or-file>`
- `aic conformance bind <pack-id-or-file> <profile-id> <contract> <mapping> --out-file <file>`
- `aic conformance verify <pack-id-or-file> <binding> <contract> --proof <proof-file> --out-file <file>`
- `aic evidence run-remote <job> --runner-id <id> --runner-revision <sha> --out-file <file>`
- `aic evidence verify <bundle> --runner-public-key <file> --runner-key-id <sha256:id> --out-file <file>`
- `aic policy evaluate <policy> <contract> <proof> --observations <file> --out-file <file>`
- `aic interop verify <suite> --out-file <file>`
- `aic trust verify <attestation-file> --trust-store <trust-store-file> --contract <contract-file> --proof <proof-file> --expect-origin <origin> --expect-revision <revision>`
- `aic transparency verify <index-file> --trust-store <trust-store-file>`
- `aic transparency consistency <from-index> <to-index> --trust-store <trust-store-file>`
- `aic trust transition verify --prior-trust-store <file> --next-trust-store <file> --transition <file>`
- `aic registry verify <registry-file> --trust-store <trust-store-file>`
- `aic inspect <proof-file>`

## Done Criteria

- Critical and high-value actions have stable IDs and explicit semantics.
- Risk, confirmation, entity, workflow, validation, execution, and recovery metadata are present where needed.
- Generated discovery, UI, actions, permissions, and workflow artifacts are current.
- `report.json` has no unresolved onboarding or extraction surprises that should block review.
- Consequential multi-surface actions map to the same domain operation and have explicit behavior contracts.
- Required proof scenarios pass with the intended evidence level and no unresolved parity findings.
- Applicable conformance profiles pass against reviewed, digest-bound mappings.
- Evidence bundles verify their plan, observations, deployment identity, and runner receipt bindings before policy consumes them.
- Every applicable assurance-policy rule passes; unmatched evaluations fail.
- Any externally relied-on signed claim verifies against a pinned issuer key and the expected origin, deployment context, source revision, contract, and proof.
- Transparency and scheduled rotation artifacts are verified when the relying policy requires them, without overstating unverified external receipts or operator independence.
