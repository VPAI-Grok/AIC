<!-- AIC_AGENT_ONBOARDING_TEMPLATE_VERSION: 5 -->
# AIC Agent Onboarding

Use AIC when this repo needs reliable interaction semantics and behavioral assurance for AI agents.

## Implementation Order

1. Identify important flows, risky actions, entities, and every human or agent entrypoint.
2. Add explicit `agent*` metadata to important controls.
3. Add or update `aic.project.json`.
4. Generate and inspect AIC artifacts.
5. Fix review findings before treating interaction metadata as ready.
6. Add behavior contracts and executable scenarios for consequential multi-surface actions.
7. Run `aic verify` before claiming behavioral parity.
8. Use rendered/native evidence and a deployment-bound signed claim before asking other systems to rely on the proof.
9. Bind consequential operations to an open conformance pack and enforce the applicable assurance policy in CI.

## Rules

- stable IDs first
- explicit metadata over inference
- confirmation on critical actions
- entity metadata on record-scoped actions
- workflow, validation, execution, and recovery metadata where the app supports them
- one stable domain `operation_id` for surfaces that perform the same business action
- native protocol fields before duplicate AIC fields
- readiness and executed proof are separate claims
- a signed issuer claim is not independent production certification
- registries are untrusted discovery and require a separately pinned trust store
- remote mutation evidence requires separate operator capability and exact canary scope
- transparency indexes are locally signed append-only evidence, not automatic global transparency
- key transitions must be verified against the pinned prior trust store before application
- generated JSON stays generated

## WebMCP Rules

- treat WebMCP as the browser execution layer and AIC as the protocol-neutral assurance layer
- prefer native WebMCP fields and lifecycle controls when equivalent
- use the current `document.modelContext` API through explicit, feature-detected integration
- register only task-level tools backed by authored `execution_ready` action contracts
- reuse the human UI's application/domain function
- never expose inferred, AI-suggested, generated, or placeholder contracts as executable tools
- run `aic scan <path> --webmcp` and `aic doctor <path> --webmcp`

## Verification

- `aic scan <path>`
- `aic generate project <config-file> --out-dir <dir>`
- `aic inspect <dir>/report.json`
- `aic validate <kind> <file>`
- `aic validate behavior <behavior-contract-file>`
- `aic verify <behavior-contract-file> --harness <module> --out-file <proof-file>`
- `aic trust verify <attestation-file> --trust-store <file> --contract <contract-file> --proof <proof-file> --expect-origin <origin> --expect-revision <revision>`
- `aic registry verify <registry-file> --trust-store <file>`
- `aic conformance verify <pack-id-or-file> <binding> <contract> --proof <proof-file>`
- `aic policy evaluate <policy> <contract> <proof> --observations <file>`
- `aic interop verify <suite>`
- `aic evidence verify <bundle> --runner-public-key <file> --runner-key-id <id>`
