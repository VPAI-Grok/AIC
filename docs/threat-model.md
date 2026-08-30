# AIC Threat Model

This threat model covers interaction metadata, guarded WebMCP execution, behavior contracts, conformance packs and bindings, protocol evidence collection, proof generation, assurance policy, signed trust claims, issuer stores, scheduled key transitions, reference transparency indexes, registries, canonical reliance decisions, the bundled reliance action, and the reference resolver.

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
- A valid old `allow` decision is replayed for a later request, a different operation/deployment binding, or after its attestation expires.
- An untrusted caller supplies a convenient evaluation timestamp so stale evidence appears current.
- A resolver record, resolver-produced decision, DNS host, or AIC-operated service is treated as a universal trust root.
- A resolver fetches or executes publisher-supplied content, or leaks private evidence through its public snapshot.
- A consumer sends private evidence, trust policy, or secrets to a resolver-operated evaluation endpoint and mistakes local verification semantics for local data custody.
- A CI gate downloads a mutable verifier, follows a symlink outside the workspace, accepts a changed consumer policy or trust store, or proceeds on `confirm`/`indeterminate`.
- A policy that requires transparency accepts an unsigned, wrongly keyed, disallowed-log, or non-including history.

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
- GitHub OIDC/Sigstore provenance for trusted CI evidence bundles;
- canonical reliance-decision validation that binds the verdict, reason codes, artifact digests, policy evaluation, exact request, freshness, and check consistency;
- local reliance evaluation from caller-supplied artifacts and consumer-owned fail-closed policy and trust stores, with no implicit network, resolver, registry, filesystem, or environment discovery;
- trusted-current-clock preflight plus complete local decision reproduction from consumer-owned inputs, a normative 60-second maximum `allow` lifetime, evidence-derived exclusive deadlines, zero future skew by default, and current attestation-expiry checks;
- optional policy-required verification of the signed reference transparency index, exact attestation inclusion, and allowed log/key identities;
- a bundled offline GitHub action that accepts bounded regular JSON files, rejects symlinks and paths outside the workspace, pins policy and trust-store file digests and expected identities, writes a canonical decision, and succeeds only for `allow`; and
- a read-only resolver that exposes exact lookups and portable snapshots, labels discovery untrusted, never fetches artifact references, and requires an operator-provided limiter when local evaluation is enabled.

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

The AIC transparency index is an offline/reference, append-only linear hash chain with a signed checkpoint. A pinned checkpoint key plus consumer policy can bound checkpoint age and minimum size, pin an exact checkpoint digest, and require consistency with a last-seen trusted index. These controls detect a replayed older prefix for a stateful or explicitly pinned consumer. Stateless inclusion alone cannot detect rollback or a split view. None of these controls provide global witnessing, gossip, fork detection across isolated consumers, or public availability.

External receipt records are metadata bound into the entry digest. AIC core does not cryptographically verify provider profiles such as COSE Receipts/SCITT or Sigstore bundles, so those references remain `not_checked` until a compatible external verifier validates them.

All AIC byte-parsing trust boundaries reject duplicate JSON object member names, including escape-equivalent names, before schema validation or canonicalization. Native `JSON.parse` is last-member-wins and is not sufficient for untrusted signed bytes. SDK callers that receive bytes must call `parseAICStrictJson`; a parsed object cannot reveal that its original envelope contained duplicate members.

### Registry

The registry is untrusted discovery data. Clients must ignore its convenience fields until the embedded attestation signature, digest, and derived fields verify against their own pinned trust store. Registry inclusion is not endorsement. The current public registry has no verified external adopters.

### Reliance decision and trusted time

An `aic_reliance_decision` is a portable result of one consumer policy over exact supplied artifacts and request bindings at one evaluation time. `allow` requires valid artifacts, exact binding, trusted signed attestation, and passing cumulative policy. `confirm` still requires a real confirmation flow; `deny` and `indeterminate` must stop execution.

Schema validity and internally consistent fields do not authenticate or reproduce a decision. Authenticated provenance does not prove that the producer used the consumer's policy, trust store, artifacts, or correct deadline. If consumers accept a decision from another process, they must call `assertAICRelianceAllowed` with the complete pinned evaluation input and their trusted clock, then use the detached decision it returns. The guard snapshots consumer input before the raw decision, rejects active accessors, locally re-evaluates at the claimed time, canonical-compares the entire result, and samples trusted time after that reproduction. Every `allow` carries an exclusive `valid_until` no later than 60 seconds after evaluation and no later than any applicable proof, observation, attestation, expiry, or transparency-checkpoint boundary; consumers can impose a shorter age or minimum residual lifetime.

The time window limits stale replay but does not make a decision single-use. Consequential integrations still need protocol-native authorization and confirmation plus application idempotency or a consumer-managed nonce where duplicate execution matters.

### Reliance GitHub action

The checked-in action bundle avoids downloading a mutable verifier during the enforcement job. It still inherits the security of the pinned action commit, GitHub runner, checked-in bundle review, consumer-owned policy and trust-store changes, and workflow protections. Policy and trust-store digests detect byte changes; repository review controls decide whether a new digest is acceptable. The action is a release/agent gate, not application authorization, production reachability proof, or certification.

### Reliance resolver

`@aicorg/reliance-server` distributes candidate records and history. Its snapshots are intentionally exportable for independent mirroring and therefore must contain public assurance material only. Resolver records are `unverified_discovery`; the consumer's separately pinned trust stores, policy, exact bindings, and trusted current clock decide whether execution is allowed. The optional evaluator endpoint is a convenience and does not make the resolver operator an implicit issuer or trust anchor.

An evaluator endpoint receives the supplied policy, trust store, contract, observations, proof, and attestation. The open verifier can run locally, so consumers should not send private artifacts or secrets to a resolver they do not trust. Protocol-level local verification does not imply local data custody when the endpoint is remote.

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
- Recompute reliance locally when possible; otherwise authenticate the decision source and enforce trusted-time, expiry, and exact request-binding checks before use.
- Make the relying party—not the application publisher or resolver—own the fail-closed policy, issuer/runner/log pins, and final disposition.
- Pin the reliance action to a full commit SHA, protect policy and trust-store changes, keep its checked-in bundle reproducible, and never continue an enforcement workflow after a non-`allow` verdict.
- Publish only public artifacts through a resolver and preserve portable snapshot export so another operator can mirror it.
- Keep sensitive policy, evidence, and trust data local unless the selected evaluator operator and transport are explicitly trusted; never put private keys or implicit secrets in a reliance request.
- Keep production secrets and side effects out of untrusted pull-request jobs.

## Deferred hardening

- independently operated hosted production runners and external reachability attestations;
- globally witnessed transparency, gossip, and provider-specific verification of external receipts;
- hosted policy, evidence-history, and review dashboards;
- a public resolver plus independently operated mirror with durable history and externally enforced service-level objectives;
- external agent and gateway consumers that enforce AIC in their normal pre-execution path;
- compromise-specific recovery-key and threshold-authority workflows;
- verified external adopters and independent conformance certification;
- deeper custom-component inference and broader guarded write-back; and
- provider-specific bootstrap governance.

These are ecosystem or roadmap outcomes, not current claims.
