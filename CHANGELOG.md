# Changelog

## Unreleased

- Added `aic.behavior/0.1` contracts, observations, proofs, validators, and public JSON Schemas.
- Added deterministic behavior verification with evidence classification, canonical SHA-256 digests, scenario checks, and cross-surface parity findings.
- Added `aic validate behavior`, `aic verify`, and behavior-proof inspection.
- Expanded the shared-domain checkout reference to executed human UI/WebMCP success, authorization-denial, confirmation-decline, business-failure, and safe-recovery scenarios.
- Added a dedicated behavior-assurance CI workflow and regression tests that prove divergent WebMCP outcomes fail.
- Added `@aicorg/evidence-playwright` and a strict native Chrome/WebMCP evidence harness with digest-addressed screenshots.
- Added `aic.trust/0.1` deployment-bound statements, Ed25519 signed claims, issuer trust stores, registries, validators, and public JSON Schemas.
- Added `aic trust keygen/attest/verify`, `aic registry build/verify/query`, trust-aware inspection, and well-known registry discovery.
- Added CI claim generation, registry verification, evidence packaging, and GitHub OIDC/Sigstore artifact provenance on trusted runs.
- Added `@aicorg/evidence-core`, `@aicorg/evidence-http`, and `@aicorg/evidence-mcp` for protocol-neutral HTTP/OpenAPI and MCP observation collection.
- Added `@aicorg/runner-remote` with exact deployment preflight, public-network restrictions, bounded execution, separate operator grants, and default-deny mutation controls.
- Added `@aicorg/conformance-packs` with checkout, billing mutation, account deletion, admin mutation, and record CRUD profiles plus digest-bound bindings and proof verification.
- Added cumulative assurance policy, portable trust interoperability vectors, signed append-only transparency checkpoints, and dual-signed scheduled key transitions.
- Added CLI commands and schemas for conformance, policy, evidence bundles, remote jobs, interoperability, transparency, and key transitions.
- Added an evidence-first adopter submission process while keeping the public adopter list and registry empty until genuine claims pass review.
- Repositioned WebMCP as a native execution surface and AIC as the protocol-neutral assurance layer.

## 0.1.0

- Core AIC platform implemented across spec, runtime, React SDK, framework plugins, CLI, devtools, bootstrap, and reference integrations.
- Guarded authoring-plan apply flow implemented through the CLI.
- Deterministic extraction expanded to same-file aliases, object-member reads, and zero-arg helpers.
- Example apps now prove confirmation, validation, execution, recovery, entity, and workflow metadata.
- Bootstrap providers hardened with normalized errors, retries, and timeout controls.
- Reference consumer proof harness added to show external consumption without selector-first fallbacks.
- First alpha npm publish completed for the first `@aicorg/*` package wave, with package metadata, release tooling, and tarball smoke tests in place.

### Current Boundaries

- `@aicorg/devtools` and example apps remain private.
- Supported target is owned React/Next/Vite apps.
- Dynamic inference and heuristic repo mutation remain out of scope.
- Stable GA npm publication is still pending.
