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

This completes every repository-achievable technical prerequisite from the milestone. The contracts, schemas, verifier, signing format, adapters, packs, policy, runner kit, and compatibility vectors remain open. Hosted capabilities should add convenience and independently operated trust, not lock users out of their evidence.

## Next market and operations gate

The following outcomes require real external actors or operated infrastructure and are not manufactured by repository fixtures:

1. Three real external applications publishing independently verifiable claims.
2. At least one remote runner operated independently from both the application owner and the AIC project.
3. A hosted evidence-history and policy-dashboard service compatible with the open verifier.
4. External verifier implementations passing the compatibility vectors.
5. Standardized or independently operated public transparency receipts for production claims.

The canonical adopter list and registry stay empty until genuine submissions pass review.

## Ongoing stabilization

- keep package docs and release claims aligned with the published npm wave;
- keep WebMCP support date-pinned and native-first;
- preserve deterministic extraction and guarded write-back;
- expand React component coverage based on real adoption evidence; and
- maintain clean builds, tests, goldens, packaging checks, and examples.

## Explicit non-goals for the current milestone

- replacing WebMCP, MCP, OpenAPI, or browser automation;
- silently promoting inferred actions to execution-ready status;
- claiming production reachability or independent certification from a local or CI-signed claim;
- broad heuristic repo mutation; and
- expanding framework breadth before the assurance core is stable.
