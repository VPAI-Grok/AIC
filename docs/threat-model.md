# AIC Threat Model

This threat model covers interaction metadata, guarded WebMCP execution, behavior contracts, observation collection, and proof generation.

## Primary failure modes

- A wrong-record action lacks stable entity identity.
- A high-risk action bypasses authorization or confirmation.
- Human and agent entrypoints drift into different domain behavior.
- Static manifests no longer match the live UI or deployed code.
- Inference overstates intent, risk, or execution readiness.
- A write-back plan targets the wrong source.
- A contract omits a material requirement and still passes.
- A harness fabricates, incompletely observes, or mislabels evidence.
- Imported evidence is treated as executed evidence.
- A digest is mistaken for a signature or deployment attestation.
- An untrusted harness executes with developer or CI credentials.

## Current mitigations

- stable `agentId`, entity IDs, and domain `operation_id` values;
- structured confirmation for critical actions;
- authored-only `execution_ready` WebMCP registration;
- deterministic extraction and guarded exact-match source apply;
- explicit provenance for authored, inferred, and AI-suggested metadata;
- protocol-neutral success, denial, confirmation, failure, and recovery scenarios;
- required and forbidden behavior checks;
- cross-surface parity verification;
- executed/imported evidence classification;
- canonical SHA-256 contract and observation digests; and
- nonzero CLI exit status for invalid or failed proofs.

## Trust boundaries

### Metadata

`authored` is more trusted than `inferred`, which is more trusted than `ai_suggested`. Generated semantics do not become execution authority without review.

### Harness

A local harness is arbitrary code. AIC imports and executes it with the CLI process's permissions. Repository review, sandboxing, isolated CI, and least-privilege credentials are operational requirements.

### Observations

An `executed` label means the harness says it executed the scenario. AIC validates shape and conformance; it does not independently establish that the harness reached production or recorded every side effect.

### Proof

The proof binds canonical contract and observation content with hashes. It does not identify the runner, sign the result, bind a deployment digest, or stop a malicious producer from fabricating both inputs.

## Safety rules

- Prefer explicit semantics on critical paths.
- Route human and agent entrypoints to the same domain operation.
- Use native protocol controls when available; do not create contradictory policy layers.
- Require denial and confirmation-decline tests for consequential mutations.
- Treat bootstrap as review assistance.
- Review harness code before execution.
- Describe proof strength precisely.
- Keep production secrets and side effects out of untrusted pull-request jobs.

## Deferred hardening

- proof signing and verifier identity;
- commit, build, and deployment binding;
- tamper-evident transparency logs;
- remote attested runners;
- policy bundles and threshold rules;
- independent conformance certification;
- deeper custom-component inference and broader guarded write-back; and
- provider-specific bootstrap governance.

These are roadmap items, not current claims.
