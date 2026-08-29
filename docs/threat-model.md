# AIC Threat Model

This threat model covers interaction metadata, guarded WebMCP execution, behavior contracts, conformance packs and bindings, protocol evidence collection, proof generation, assurance policy, signed trust claims, issuer stores, scheduled key transitions, reference transparency indexes, and registries.

## Primary failure modes

- A wrong-record action lacks stable entity identity.
- A high-risk action bypasses authorization or confirmation.
- Human and agent entrypoints drift into different domain behavior.
- Static manifests no longer match the live UI or deployed code.
- Inference overstates intent, risk, or execution readiness.
- A write-back plan targets the wrong source.
- A contract omits a material requirement and still passes.
- An application maps its contract to the wrong conformance obligation or substitutes a stale pack, profile, contract, or mapping.
- A harness fabricates, incompletely observes, or mislabels evidence.
- Imported evidence is treated as executed evidence.
- An evidence plan smuggles executable code, undeclared secrets, unbounded output, or an ambiguous projection into a runner.
- An HTTP target, redirect, or DNS change reaches a private network or an unintended origin.
- A mutating observation runs without exact authorization, runs against the wrong canary, or is retried after an uncertain outcome.
- A malicious or malformed HTTP/OpenAPI or MCP response is projected into a misleading success observation.
- A producer-supplied proof summary is trusted instead of regenerating proof from the observations.
- A policy applies only one favorable rule, accepts an unmatched operation, ignores stale evidence, or relies on a self-declared `remote` label without pinning the expected key and runner identity.
- A compatibility suite passes vacuously, drifts in canonicalization or stable finding codes, or embeds a usable private key.
- A digest is mistaken for a signature or deployment attestation.
- An untrusted harness executes with developer or CI credentials.
- A valid signature is mistaken for independent proof that an origin is live.
- A trusted issuer or runner key is stolen, mis-scoped, expired, or not revoked.
- A scheduled rotation broadens origin authority, removes the retiring key too early, or is used to conceal a suspected compromise.
- A transparency entry, checkpoint, or history prefix is rewritten, truncated, forked, or signed by an unpinned key.
- Hash-bound external receipt metadata is presented as cryptographically verified without running the provider-specific verifier.
- A registry rewrites unsigned index fields or serves stale claims.
- A valid old claim is replayed after the deployment changes.

## Current mitigations

- stable `agentId`, entity IDs, and domain `operation_id` values;
- structured confirmation for critical actions;
- authored-only `execution_ready` WebMCP registration;
- deterministic extraction and guarded exact-match source apply;
- explicit provenance for authored, inferred, and AI-suggested metadata;
- protocol-neutral success, denial, confirmation, failure, and recovery scenarios;
- required and forbidden behavior checks and cross-surface parity verification;
- versioned conformance packs plus explicit, digest-bound application mappings;
- executed/imported evidence classification;
- data-only evidence plans and remote jobs with strict schemas, declared secret references, bounded capture, and explicit projections;
- public-network resolution and pinning plus redirect rejection for remote HTTP collection;
- default-denied mutation with exact operation/canary and operator grants and no retry after uncertain execution;
- protocol-specific HTTP/OpenAPI, MCP, and native browser collectors that emit protocol-neutral observations;
- canonical SHA-256 contract, observation, plan, mapping, deployment, and receipt digests;
- proof regeneration during cumulative, unmatched-fail policy evaluation;
- policy constraints for freshness, scenarios, evidence strength, parity, conformance, trust, bindings, and allowed issuer, key, runner kind, and runner identity;
- non-empty, fail-closed interoperability suites with canonical JSON, digest, attestation, registry, and stable-code fixtures but no usable private keys;
- nonzero CLI exit status for invalid or failed proofs, policies, conformance results, evidence bundles, and compatibility suites;
- Ed25519 signatures over canonical deployment/proof statements;
- SHA-256-derived key IDs and pinned public-key trust stores;
- issuer, allowed-origin, validity-window, and revocation checks;
- verifier-supplied expected origin and revision checks;
- dual-signed scheduled transitions that bind prior and next stores, retain the retiring key through its validity window, and reject scope broadening;
- domain-separated linear entry hashes and signed, pinned reference checkpoints with prefix consistency verification;
- external receipt references that are artifact-bound but explicitly reported `not_checked`;
- registries that embed the signed attestation and re-derive index fields; and
- GitHub OIDC/Sigstore provenance for trusted CI evidence bundles.

## Trust boundaries

### Metadata

`authored` is more trusted than `inferred`, which is more trusted than `ai_suggested`. Generated semantics do not become execution authority without review.

### Conformance pack and binding

A pack defines reusable obligations for an operation class. The application mapping is still an authored assertion. Digest binding detects substitution after review; it does not prove that the chosen operation, scenario, phase, confirmation, or surface mapping was semantically correct. Pack conformance is not certification.

### Harness

A local harness is arbitrary code. AIC imports and executes it with the CLI process's permissions. Repository review, sandboxing, isolated CI, and least-privilege credentials are operational requirements.

### Evidence plan, adapter, and remote runner

Evidence plans and remote jobs are validated data. Adapters and the remote runner are privileged implementations that contact the declared surface, resolve secret references, and emit observations. Their network environment, credentials, implementation, operator, and signing key remain trust inputs.

The open `@aicorg/runner-remote` package is independently operable software. Running it in the same organization or CI account does not make the evidence independent. AIC does not currently operate an independently controlled hosted runner.

### Observations

An `executed` label means the collector says it executed the scenario. AIC validates shape, projections, and conformance; it does not independently establish that the collector reached production or recorded every side effect.

### Proof and assurance policy

The behavior proof binds canonical contract and observation content with hashes. It does not identify the runner or stop a malicious producer from fabricating both inputs. Policy evaluation therefore regenerates proof from the supplied observations and can require pinned trust, deployment, issuer, key, and runner identities. A passing policy is a consumer's configured reliance decision, not universal certification.

### Signed claim

An `aic.trust/0.1` signature proves that the holder of a pinned Ed25519 private key signed the exact issuer, runner, origin, deployment, revision, operation, contract, and proof fields. The verifier can also require the original contract, proof, expected origin, and expected revision.

It still relies on the issuer and runner being honest and uncompromised. A signature does not independently contact the origin or prove that the revision is deployed. `local_signed_claim`, `ci_signed_claim`, and `remote_signed_claim` describe provenance classes, not certification levels.

### Scheduled key transition

A dual-signed transition proves that both the retiring and successor keys approved one bounded next trust store. It is intended for planned rotation. It is unsafe as an automatic compromise-replacement mechanism because a compromised retiring key can still sign a transition; suspected compromise requires revocation and an out-of-band recovery decision.

### Reference transparency and external receipts

The AIC transparency index is an offline/reference, append-only linear hash chain with a signed checkpoint. A pinned checkpoint key and consistency verification detect tampering within the histories a verifier receives. They do not provide global witnessing, gossip, fork detection across isolated consumers, or public availability.

External receipt records are metadata bound into the entry digest. AIC core does not cryptographically verify provider profiles such as COSE Receipts/SCITT or Sigstore bundles, so those references remain `not_checked` until a compatible external verifier validates them.

### Registry

The registry is untrusted discovery data. Clients must ignore its convenience fields until the embedded attestation signature, digest, and derived fields verify against their own pinned trust store. Registry inclusion is not endorsement. The current public registry has no verified external adopters.

### GitHub artifact provenance

GitHub artifact attestation binds the packaged evidence archive to GitHub repository/workflow/commit provenance. It does not prove current production reachability. Pull-request runs do not receive the trusted-branch attestation step.

## Safety rules

- Prefer explicit semantics on critical paths.
- Route human and agent entrypoints to the same domain operation.
- Use native protocol controls when available; do not create contradictory policy layers.
- Require denial and confirmation-decline tests for consequential mutations.
- Treat bootstrap and conformance mappings as review inputs.
- Review harness code before execution.
- Keep evidence plans data-only and projections minimal.
- Resolve and pin every remote target, reject redirects, deny mutation by default, and never retry an uncertain mutation.
- Regenerate proofs during policy evaluation and require every applicable rule to pass.
- Describe proof strength precisely.
- Pin issuer and runner keys outside the registry or bundle being verified.
- Require expected origin and revision at verification time for consequential use.
- Use short validity windows, protected signing keys, scheduled dual-signed rotation, and revocation for production issuers.
- Treat external receipt references as metadata until a provider-specific verifier succeeds.
- Keep production secrets and side effects out of untrusted pull-request jobs.

## Deferred hardening

- independently operated hosted production runners and external reachability attestations;
- globally witnessed transparency, gossip, and provider-specific verification of external receipts;
- hosted policy, evidence-history, and review dashboards;
- compromise-specific recovery-key and threshold-authority workflows;
- verified external adopters and independent conformance certification;
- deeper custom-component inference and broader guarded write-back; and
- provider-specific bootstrap governance.

These are ecosystem or roadmap outcomes, not current claims.
