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

## Current phase: behavior assurance foundation

The first vertical slice is implemented:

- protocol-neutral behavior contracts;
- observation and proof types plus JSON Schemas;
- deterministic contract, evidence, and parity verification;
- CLI validation, verification, and proof inspection;
- a shared-domain checkout example across human UI and WebMCP;
- success, authorization-denial, and confirmation-decline scenarios; and
- a CI proof artifact.

This phase establishes the open contract and verifier. It does not yet establish production-grade evidence authenticity.

## Next milestone: trustworthy evidence adapters

Priorities:

1. Browser/Playwright observation adapter that proves the rendered human path.
2. WebMCP browser runner against a supported experimental browser.
3. MCP and HTTP/OpenAPI observation adapters.
4. Deployment and commit metadata in evidence without overstating trust.
5. Reusable contract packs for checkout, billing, account deletion, admin mutations, and record CRUD.
6. Configurable CI policies by risk, evidence level, scenario class, and parity requirement.
7. Verifier compatibility fixtures so alternative implementations can conform.

## Later: ecosystem trust layer

- signed and deployment-bound proofs;
- remote or attested runners;
- tamper-evident transparency logs;
- public conformance profiles and registries;
- hosted evidence collection and policy dashboards; and
- independent certification programs.

The open contract, schemas, verifier, and local runner remain the foundation. Hosted capabilities should add convenience and trust, not lock users out of their evidence.

## Ongoing stabilization

- keep package docs and release claims aligned with the published npm wave;
- keep WebMCP support date-pinned and native-first;
- preserve deterministic extraction and guarded write-back;
- expand React component coverage based on real adoption evidence; and
- maintain clean builds, tests, goldens, packaging checks, and examples.

## Explicit non-goals for the current milestone

- replacing WebMCP, MCP, OpenAPI, or browser automation;
- silently promoting inferred actions to execution-ready status;
- claiming production attestation from local fixture evidence;
- broad heuristic repo mutation; and
- expanding framework breadth before the assurance core is stable.
