# Supported Today

AIC targets owned React, Next.js, and Vite applications where the team can author and review the interaction contract and execute meaningful test scenarios.

## Interaction description

Supported now:

- explicit `agent*` metadata and stable IDs in React source;
- runtime UI semantics plus generated discovery, actions, permissions, and workflows;
- deterministic static extraction with diagnostics for unsupported dynamic values;
- `aic init`, `doctor`, `scan`, `generate`, `validate`, `inspect`, `diff`, and guarded authoring-plan apply;
- devtools inspection and proposal export;
- review-assisted bootstrap from saved or Playwright captures; and
- a read-only MCP server for manifest discovery.

## WebMCP

Supported in the repository:

- experimental WebMCP compatibility pinned to the `2026-08-26` draft;
- fail-closed imperative registration for authored, `execution_ready` actions;
- React lifecycle cleanup and unsupported-browser fallback;
- declarative WebMCP props with risky auto-submit suppression; and
- readiness scanning, doctor findings, and implementation-plan generation.

The policy is native first: use WebMCP's own capabilities when equivalent and keep AIC focused on independent assurance.

## Behavior assurance

Supported in the repository:

- `aic.behavior/0.1` contracts and validators;
- executed or imported observation sets;
- protocol surfaces for human UI, WebMCP, MCP, OpenAPI, and custom entrypoints;
- expected status, confirmation, error, JSON outcome, required behavior, and forbidden behavior;
- cross-surface parity verification;
- canonical contract and observation digests;
- `aic validate behavior`, `aic verify`, and proof inspection; and
- deterministic and native-browser checkout harnesses plus a dedicated CI proof workflow.

## AIC Verified trust

Supported in the repository:

- native Chrome/WebMCP evidence through `@aicorg/evidence-playwright`;
- `aic.trust/0.1` trust statements bound to passed behavior proofs;
- Ed25519 signatures and SHA-256-derived key identities;
- pinned issuer trust stores with origin, validity, and revocation policy;
- exact deployment, environment, origin, and full source-revision claims;
- independently verifiable embedded-attestation registries;
- `/.well-known/aic-trust` registry discovery;
- CLI key, attestation, verification, registry build, registry verify, and registry query workflows; and
- GitHub artifact provenance for the CI evidence archive on trusted workflow runs.

## Not guaranteed

- operation of arbitrary third-party sites;
- zero-touch onboarding or trustworthy dynamic inference;
- full non-React production support;
- stable browser behavior while WebMCP is experimental;
- automatic promotion of generated or inferred actions to executable tools;
- correctness or completeness of a user-authored behavior contract;
- authenticity of imported evidence;
- independent proof that a claimed revision is currently deployed at an origin;
- protection from a compromised trusted issuer or dishonest runner;
- a general public transparency log, hosted policy enforcement, or independent certification; or
- external adoption merely because the open registry interface exists.

## Reading AIC claims

There are now four distinct evidence levels:

1. Generated manifests show that semantics were authored or extracted.
2. QA readiness shows that selected metadata is present and structurally usable.
3. Behavior proof shows that supplied observations passed explicit scenarios and parity rules.
4. A verified signed claim shows that a pinned issuer signed exact proof and deployment bindings.

The fourth level verifies an issuer's claim, not current production reachability. None should be described as stronger than its evidence. See [Behavior Assurance](./behavior-assurance.md), [AIC Verified Trust Layer](./trust-layer.md), and [Threat Model](./threat-model.md).
