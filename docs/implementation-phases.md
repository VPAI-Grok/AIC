# AIC Implementation Phases

This document maps the original product build to the current assurance roadmap.

## Completed foundation

The original phases are represented in the repository:

1. spec foundation;
2. runtime registry;
3. React SDK;
4. Next.js and Vite plugins;
5. CLI;
6. devtools;
7. AI-assisted bootstrap; and
8. component integrations and reference apps.

The repo also includes automation core, HTTP and OpenAI bootstrap providers, a read-only MCP server, coding-agent onboarding, guarded source apply, WebMCP compatibility, QA readiness, and real-app benchmarks.

## Completed: behavior assurance foundation

The protocol-neutral vertical slice is implemented:

- protocol-neutral behavior contracts;
- observation and proof types plus JSON Schemas;
- deterministic contract, evidence, and parity verification;
- CLI validation, verification, and proof inspection;
- a shared-domain checkout example across human UI and WebMCP;
- success, authorization-denial, confirmation-decline, business-failure, and safe-recovery scenarios; and
- a CI proof artifact.

## Completed: AIC Verified technical milestone

The repository now includes:

1. `@aicorg/evidence-playwright` for rendered browser evidence.
2. A strict native `document.modelContext` WebMCP runner.
3. Browser observations with version/API/encoding metadata and digest-addressed screenshots.
4. `aic.trust/0.1` origin, deployment, revision, contract, operation, and proof bindings.
5. Ed25519 signatures, pinned trust stores, origin restrictions, key validity, and revocation state.
6. An open embedded-attestation registry plus `/.well-known/aic-trust` discovery.
7. CI evidence bundles with GitHub artifact provenance on trusted runs.
8. Tamper, binding, registry, CLI, and checked-in browser-evidence tests.

This completes the in-repository technical milestone. It does not manufacture independent adoption or turn an issuer's signed claim into independent production certification.

## Completed: Open Ecosystem Conformance technical milestone

The repository now includes:

1. MCP and HTTP/OpenAPI evidence adapters using the same observation contract as browser evidence.
2. A data-only remote production runner kit with exact origin, deployment, and revision preflight, public-network restrictions, bounded response/runtime limits, and mutations disabled unless explicitly canary-scoped.
3. Reusable conformance packs for checkout, billing mutation, account deletion, admin mutation, and record CRUD.
4. Authored, digest-bound mappings from application contracts to pack obligations.
5. Cumulative configurable policy by risk, evidence level, scenario and surface coverage, freshness, parity, deployment binding, and pinned trust.
6. Portable compatibility vectors for canonical JSON, digests, verification decisions, and finding codes.
7. A signed tamper-evident reference index with checkpoint consistency and portable external receipt references.
8. Dual-signed scheduled key transitions that keep historical claims verifiable while distinguishing compromise revocation.
9. An evidence-first external adopter submission kit and ecosystem-conformance gates in the existing Behavior Assurance CI workflow.

This completed the conformance foundation required for a relying-party preflight. The contracts, schemas, verifier, signing format, adapters, packs, policy, runner kit, and compatibility vectors remain open. Hosted capabilities should add convenience and independently operated trust, not lock users out of their evidence.

## Completed: Trust Fabric repository milestone

The repository now includes:

1. Canonical `aic_reliance_decision`, `aic_reliance_record`, and `aic_reliance_snapshot` types, validators, and JSON Schemas.
2. `@aicorg/rely`, a local-only consumer SDK that evaluates exact operation/deployment bindings, regenerates proof, verifies a signed attestation against a separately pinned trust store, and applies every matching fail-closed policy rule.
3. Distinct `allow`, `confirm`, `deny`, and `indeterminate` verdicts with stable reason codes and bound artifact digests.
4. Trusted-current-clock preflight and assertion helpers that reject stale, future-dated, expired, request-mismatched, or out-of-window decisions.
5. Optional policy-required verification of the signed AIC reference transparency index, including exact attestation inclusion and pinned log/key identities. External receipt references remain `not_checked` until a provider-specific verifier checks them.
6. `aic rely evaluate`, which writes the portable decision and exits successfully only for `allow`.
7. A bundled, offline `actions/aic-rely` GitHub action that pins consumer policy, trust-store digests, and expected issuer, key, runner, origin, environment, deployment, operation, and revision identities.
8. `@aicorg/reliance-server`, a read-only reference resolver with exact lookup, history, exportable snapshots, and optional locally configured evaluation. Discovery records remain untrusted and mirrorable.

This technical milestone is published under the npm `alpha` tag, with registry integrity and provenance verified after release. The reference-server package is not a hosted public resolver, and package availability or repository fixtures do not establish external use or operator independence.

## Next Trust Fabric adoption and operations gate

The following outcomes require real external actors or operated infrastructure and are not manufactured by repository fixtures:

1. Three real external applications publishing independently verifiable claims.
2. Two separately controlled runner operators, including at least one independent from both AIC and the observed application.
3. Two external agent or gateway consumers enforcing AIC in their normal pre-execution path and failing closed on invalid, stale, revoked, or wrongly bound claims.
4. One independently maintained verifier passing the compatibility vectors.
5. A public resolver and an independently hosted mirror exposing at least 30 days of portable history without making network availability necessary for cached local verification.
6. Provider-verified standardized or independently operated transparency receipts for production claims.

The canonical adopter list and registry stay empty until genuine submissions pass review. A hosted dashboard can be useful, but it is not a Trust Fabric completion gate and must not become the only verifier or evidence-history format.

## Ongoing stabilization

- keep package docs and release claims aligned with the published npm wave;
- keep reliance decision validators, SDK, CLI, action bundle, and resolver compatibility tests aligned;
- keep WebMCP support date-pinned and native-first;
- preserve deterministic extraction and guarded write-back;
- expand React component coverage based on real adoption evidence; and
- maintain clean builds, tests, goldens, packaging checks, and examples.

## Explicit non-goals for the current milestone

- replacing WebMCP, MCP, OpenAPI, or browser automation;
- silently promoting inferred actions to execution-ready status;
- claiming production reachability or independent certification from a local or CI-signed claim;
- making an AIC resolver, hosted service, registry entry, or decision producer a universal trust root;
- broad heuristic repo mutation; and
- expanding framework breadth before the assurance core is stable.
