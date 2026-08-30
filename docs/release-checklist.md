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
- `npm --prefix actions/aic-rely run check:bundle`

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

## Trust Fabric gates

- The reliance JSON Schemas screen structural interchange shape and clearly state that acceptance is not permission; normative runtime validators additionally reject digest, equality, binding, ordering, expiry, and other semantic contradictions that JSON Schema cannot express.
- Canonical JSON and digest regression vectors distinguish dangerous property names such as `__proto__` and `constructor` instead of dropping or aliasing them.
- `@aicorg/rely` performs no implicit network, resolver, registry, filesystem, or environment discovery.
- An `allow` requires valid supplied artifacts, exact origin/operation/deployment/revision bindings, trusted non-expired and non-revoked attestation, regenerated proof, at least one passed matching rule, and every applicable policy rule to pass.
- Missing or malformed artifacts yield `indeterminate` by default; valid but stale, wrongly bound, untrusted, revoked, expired, unmatched, or policy-failing inputs do not become `allow`.
- Disposition settings can route results to `confirm` but cannot upgrade a failed or indeterminate result to `allow`.
- `assertAICRelianceAllowed` snapshots the complete consumer-owned input before the raw decision, returns a detached locally reproduced decision, and samples trusted time after reproduction. It rejects schema-invalid, stateful, or fabricated decisions, non-`allow` verdicts, insufficient residual validity, decisions outside the caller-trusted replay/future-skew window, decisions at their exclusive policy-derived `valid_until`, attestations expired since evaluation, and every input or request mismatch.
- Production preflight and the GitHub action use a trusted current clock. Any reproducible timestamp override remains a test/debug facility and is not exposed by the enforcement action.
- When any matching policy rule requires transparency, the signed reference index, separately pinned log trust store, allowed log/key identities, and exact attestation inclusion all verify. External receipt references remain `not_checked` without a provider-specific verifier.
- `aic rely evaluate` writes a canonical decision and returns zero only for `allow`; CLI and schema tests validate generated decisions against the public contract.
- The bundled action is reproducible, has no runtime package imports or verifier download, rejects symlinked/out-of-workspace/unbounded inputs and unsafe output paths, pins consumer policy and trust-store bytes plus expected identities, requires bounded residual `valid_until` lifetime before publishing `allowed=true`, clears the deadline on failure, and fails the job for `confirm`, `deny`, `indeterminate`, or malformed output.
- The reference resolver remains read-only, never fetches artifact locators or executes publisher content, labels discovery untrusted, returns non-cacheable evaluations/errors, requires a limiter when evaluation is enabled, and exports a portable snapshot another operator can mirror.
- Resolver-produced decisions never bypass local canonical validation, exact response/request binding checks, trusted-current-clock/replay checks, or consumer trust policy.

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
- Trust Fabric, architecture, supported-boundary, threat-model, package, service, and onboarding docs match the canonical SDK/CLI/action/resolver behavior;
- CI, MCP stdio, and behavior-assurance workflows are enabled; and
- package descriptions and changesets match the release contents.

## npm alpha gates

- the external [`npm-alpha` protected environment and per-package npm Trusted Publisher bindings](./npm-trusted-publishing.md) are configured before dispatch;
- the protected publish job receives only the exact immutable artifact from the no-OIDC verification job, uses npm 11.5.1 or newer, and has no checkout, dependency install, repository-script execution, or static npm token;
- package manifests remain public and include publish metadata;
- tarball smoke tests pass;
- package matrix docs match the exact publish wave;
- `@aicorg/webmcp`, the evidence packages, `@aicorg/runner-remote`, `@aicorg/conformance-packs`, `@aicorg/verify-core`, `@aicorg/rely`, `@aicorg/reliance-server`, `aic rely evaluate`, and the extended behavior/trust tooling are not called published before registry verification; and
- every publish-workflow action remains pinned to its reviewed full commit SHA; and
- the manual publish workflow completes its configured checks before publishing verified tarballs with provenance and lifecycle scripts disabled.

## Not a release claim

Passing these gates does not provide GA stability, non-React support, an external adopter or enforcing agent consumer, an independently operated hosted runner, independent proof of production reachability, a public hosted resolver or independent mirror, durable public history, a globally witnessed transparency service, provider verification of external receipt metadata, or independent certification.
