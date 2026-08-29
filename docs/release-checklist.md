# Release Checklist

## Workspace gates

- `pnpm check`
- `pnpm build`
- `pnpm test`
- `pnpm test:goldens`
- `pnpm smoke:init`
- `pnpm smoke:adoption`
- `pnpm smoke:mcp`
- `pnpm smoke:mcp:stdio`

## Behavior-assurance gates

- `aic validate behavior` accepts every shipped behavior contract.
- `pnpm --dir examples/nextjs-checkout-demo run aic:verify` passes.
- `pnpm --dir examples/nextjs-checkout-demo run aic:verify:browser` passes against native `document.modelContext`.
- The proof contains executed evidence, all required observations, zero findings, and passed parity for the checkout scenarios.
- Browser screenshot references exist and their SHA-256 digests match.
- A deliberate WebMCP outcome divergence makes the verifier and CLI fail.
- Checked-in schemas match the public TypeScript types and validator behavior.
- Harnesses are reviewed as trusted code and CI uses least-privilege credentials.
- Documentation does not call an unsigned local proof a production attestation.

## AIC Verified gates

- Signed-attestation, trust-store, and registry validators reject unknown or malformed fields.
- Signature tampering, wrong origin/revision expectations, revoked keys, and registry field tampering fail verification.
- `aic trust verify` is run with the original contract, proof, expected origin, and expected revision where available.
- CI private keys stay in the runner temporary directory and are never uploaded.
- Trusted branch runs create GitHub artifact provenance for the packaged evidence archive.
- Registry inclusion is described as discoverability, not endorsement or certification.

## Open ecosystem conformance gates

- Every built-in conformance pack and profile validates, includes the required scenario classes, and has a stable digest.
- Contract-to-pack bindings reject missing mappings, unknown obligations, stale contract/pack/profile/mapping digests, and unreviewed substitution.
- Proof-level conformance rejects failed proofs and checks phases, confirmation behavior, and surface roles.
- Assurance policy regenerates proof from the supplied observations instead of trusting a producer summary.
- Every matching policy rule is applied cumulatively, and an unmatched operation fails closed.
- Policy tests cover freshness, required scenarios, evidence level, parity, conformance bindings, trust, origin/revision, and allowed issuer, key, runner kind, and runner identity pins.
- Evidence plans and remote jobs reject unknown fields, executable modules, shell commands, callbacks, implicit secrets, and undeclared projections.
- HTTP/OpenAPI and MCP adapters fail closed on malformed responses, missing projections, protocol errors, and observations that cannot satisfy the contract.
- Remote collection resolves and pins public-network targets, rejects redirects, binds exact origin/deployment/source revision, and keeps raw evidence within declared limits.
- Remote mutations are denied by default; mutation tests require exact operation/canary and operator grants, and uncertain mutations are never retried.
- Evidence-bundle verification recomputes plan, observation, deployment-identity, and receipt bindings and verifies a pinned runner key when one is required.
- Interoperability suites reject empty or structurally unknown suites and cover canonical JSON, digests, stable finding codes, attestation verification, and registry verification without checked-in usable private keys.
- Transparency tests cover domain-separated entry and checkpoint digests, append-only sequence/previous-head rules, pinned checkpoint signatures, artifact bindings, and prefix consistency.
- External receipt references are artifact-bound and reported `not_checked`; no provider receipt is described as cryptographically verified by AIC core.
- Scheduled key transitions require valid signatures from both retiring and successor keys, bind prior and next trust stores, retain the retiring active key through `valid_until`, and reject origin broadening.
- Rotation is documented as scheduled maintenance, not automated compromise recovery; revocation and out-of-band recovery remain separate operations.
- The public adopter registry stays empty unless a genuine external submission passes the documented evidence-first checks.

## Clean-workspace gate

- verification creates no unexpected tracked diffs;
- intentional generated proof fixtures are deterministic;
- local generated outputs are ignored or cleaned up; and
- README and documentation links target committed files.

## Contract and consumer gates

- runtime and reference-consumer tests pass;
- QA readiness and behavior proof are described as distinct evidence;
- supported-boundary and threat-model documents match the implementation; and
- generated AIC JSON is regenerated and reviewed rather than hand-edited.

## Repository release gates

- license, contribution, security, conduct, changelog, and service files are current;
- root and example READMEs show the current behavior-assurance workflow;
- CI, MCP stdio, and behavior-assurance workflows are enabled; and
- package descriptions and changesets match the release contents.

## npm alpha gates

- package manifests remain public and include publish metadata;
- tarball smoke tests pass;
- package matrix docs match the exact publish wave;
- `@aicorg/webmcp`, the evidence packages, `@aicorg/runner-remote`, `@aicorg/conformance-packs`, and the extended behavior/trust tooling are not called published before registry verification; and
- the manual publish workflow completes its configured checks before publishing.

## Not a release claim

Passing these gates does not provide GA stability, non-React support, an external adopter, an independently operated hosted runner, independent proof of production reachability, a globally witnessed transparency service, provider verification of external receipt metadata, or independent certification.
