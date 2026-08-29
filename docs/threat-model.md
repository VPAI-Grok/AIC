# AIC Threat Model

This threat model covers interaction metadata, guarded WebMCP execution, behavior contracts, observation collection, proof generation, signed trust claims, issuer stores, and registries.

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
- A valid signature is mistaken for independent proof that an origin is live.
- A trusted issuer key is stolen, mis-scoped, expired, or not revoked.
- A registry rewrites unsigned index fields or serves stale claims.
- A valid old claim is replayed after the deployment changes.

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
- nonzero CLI exit status for invalid or failed proofs;
- Ed25519 signatures over canonical deployment/proof statements;
- SHA-256-derived key IDs and pinned public-key trust stores;
- issuer, allowed-origin, validity-window, and revocation checks;
- verifier-supplied expected origin and revision checks;
- registries that embed the signed attestation and re-derive index fields; and
- GitHub OIDC/Sigstore provenance for trusted CI evidence bundles.

## Trust boundaries

### Metadata

`authored` is more trusted than `inferred`, which is more trusted than `ai_suggested`. Generated semantics do not become execution authority without review.

### Harness

A local harness is arbitrary code. AIC imports and executes it with the CLI process's permissions. Repository review, sandboxing, isolated CI, and least-privilege credentials are operational requirements.

### Observations

An `executed` label means the harness says it executed the scenario. AIC validates shape and conformance; it does not independently establish that the harness reached production or recorded every side effect.

### Proof

The behavior proof binds canonical contract and observation content with hashes. It does not identify the runner or stop a malicious producer from fabricating both inputs.

### Signed claim

An `aic.trust/0.1` signature proves that the holder of a pinned Ed25519 private key signed the exact issuer, runner, origin, deployment, revision, operation, contract, and proof fields. The verifier can also require the original contract, proof, expected origin, and expected revision.

It still relies on the issuer and runner being honest and uncompromised. A signature does not independently contact the origin or prove that the revision is deployed. `local_signed_claim`, `ci_signed_claim`, and `remote_signed_claim` describe provenance classes, not certification levels.

### Registry

The registry is untrusted discovery data. Clients must ignore its convenience fields until the embedded attestation signature, digest, and derived fields verify against their own pinned trust store. Registry inclusion is not endorsement.

### GitHub artifact provenance

GitHub artifact attestation binds the packaged evidence archive to GitHub repository/workflow/commit provenance. It does not prove current production reachability. Pull-request runs do not receive the trusted-branch attestation step.

## Safety rules

- Prefer explicit semantics on critical paths.
- Route human and agent entrypoints to the same domain operation.
- Use native protocol controls when available; do not create contradictory policy layers.
- Require denial and confirmation-decline tests for consequential mutations.
- Treat bootstrap as review assistance.
- Review harness code before execution.
- Describe proof strength precisely.
- Pin issuer keys outside the registry being queried.
- Require expected origin and revision at verification time for consequential use.
- Use short validity windows, protected signing keys, rotation, and revocation for production issuers.
- Keep production secrets and side effects out of untrusted pull-request jobs.

## Deferred hardening

- tamper-evident transparency logs;
- independently operated remote production runners and reachability checks;
- policy bundles and threshold rules;
- independent conformance certification;
- deeper custom-component inference and broader guarded write-back; and
- provider-specific bootstrap governance.

These are roadmap items, not current claims.
