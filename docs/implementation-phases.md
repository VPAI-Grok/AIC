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
- success, authorization-denial, and confirmation-decline scenarios; and
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

## Next milestone: ecosystem proof and adoption

Priorities:

1. Three real external applications publishing independently verifiable claims.
2. Remote production observation runners that verify origin, deployment, and revision from outside the app owner's CI.
3. MCP and HTTP/OpenAPI evidence adapters using the same observation contract.
4. Reusable conformance packs for checkout, billing, account deletion, admin mutations, and record CRUD.
5. Configurable CI policies by risk, evidence level, scenario class, freshness, and parity requirement.
6. Verifier compatibility fixtures for independent implementations.
7. Tamper-evident public provenance/transparency indexing and key-rotation operations.
8. Hosted evidence history and policy dashboards that remain compatible with the open verifier.

The contracts, schemas, verifier, signing format, local/browser runner, and registry format remain open. Hosted capabilities should add convenience and independently operated trust, not lock users out of their evidence.

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
