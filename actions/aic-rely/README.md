# AIC reliance gate

This action is a consumer-side, fail-closed gate for one consequential operation. It runs AIC's canonical `evaluateAICReliance` locally: raw observations regenerate the behavior proof, the deployment-bound attestation is checked against a separately pinned trust store, and every applicable consumer-policy rule is evaluated.

The action is a self-contained JavaScript bundle committed with the action. It performs no package install, registry lookup, network request, dynamic import, or execution of submitted code at runtime. Its accepted evidence is limited to regular, fatal-UTF-8, strictly parsed JSON files with unique object member names inside the checked-out workspace. Pinning the action to a full commit SHA therefore pins the verifier implementation as well as the action wrapper.

It uses the GitHub Actions Node.js 24 runtime. A relying repository should be able to add and test the gate in well under an hour once its evidence bundle and identity values are available.

## Use it

Replace every placeholder below, including the full action SHAs. Keep checkout credentials out of the workspace so an evaluated repository cannot reuse them.

```yaml
name: AIC reliance

on:
  workflow_dispatch:
  schedule:
    - cron: "17 * * * *"

permissions:
  contents: read

jobs:
  verify-checkout:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<full-40-character-actions-checkout-commit-sha>
        with:
          persist-credentials: false

      - id: rely
        uses: VPAI-Grok/AIC/actions/aic-rely@<full-40-character-AIC-commit-sha>
        with:
          policy-file: .aic/policy.json
          policy-sha256: <64-lowercase-hex>
          contract-file: evidence/contract.json
          proof-file: evidence/proof.json
          observations-file: evidence/observations.json
          attestation-file: evidence/attestation.json
          trust-store-file: .aic/trust-store.json
          trust-store-sha256: <64-lowercase-hex>
          expected-operation-id: checkout.complete.domain
          expected-origin: https://shop.example
          expected-environment: production
          expected-deployment-id: production-2026-08-29.1
          expected-revision: 0123456789abcdef0123456789abcdef01234567
          expected-issuer-id: org:example:production-assurance
          expected-key-id: sha256:<64-lowercase-hex>
          expected-runner-id: runner:independent.example:primary
          minimum-validity-seconds: "30"
          decision-file: .aic/reliance-decision.json

      - if: always() && steps.rely.outputs.decision-file != ''
        uses: actions/upload-artifact@<full-40-character-actions-upload-artifact-commit-sha>
        with:
          name: aic-reliance-decision
          path: ${{ steps.rely.outputs.decision-file }}
```

The gate succeeds only when `allowed` is `true` and the canonical verdict is `allow`. `confirm`, `deny`, and `indeterminate` decisions fail the step. Do not add `continue-on-error` to an enforcement job.

`decision-file` must be a JSON file beneath the dedicated workspace `.aic/` directory. The action rejects control characters, symlinked output paths, reserved action/workflow/package paths, and any path that aliases an input. It proves the configured target is distinct from every input and removes any prior decision before reading evidence, so a missing or malformed input cannot leave an old allow behind. It then replaces the decision atomically. If the target cannot be safely approved or the final write fails, the output path remains blank.

## Establish the consumer pins

The relying party—not the application submitting evidence—owns the policy, trust store, their SHA-256 digests, the workflow revision, and every expected identity. Protect those values with review rules or `CODEOWNERS`. At runtime the action supplies its complete already-parsed immutable snapshot input to every allow assertion. The canonical SDK clones that input, derives its artifact and request bindings, locally reproduces the entire decision at the decision's evaluation time, and requires a canonical match; the action never trusts bindings copied back out of the submitted decision.

```bash
sha256sum .aic/policy.json .aic/trust-store.json
```

The matching policy must set `unmatched` to `fail`, match at least one rule, and require the exact origin, revision, issuer, key, and runner identities. A production allow additionally requires explicit maximum proof, observation, and attestation ages, maximum attestation validity, required observations, and required attestation expiry; `not_checked` freshness is never actionable in production. Add required scenarios and surface parity appropriate to the operation. Every applicable production rule that requires transparency must explicitly pin non-empty `allowed_log_ids` and `allowed_key_ids`, even when the transparency trust-store file is byte-pinned. It must also include checkpoint freshness, an expected checkpoint digest, or consistency with a separately consumer-pinned prior checkpoint; `minimum_size` is only an additional floor. Policies that do not require transparency are unaffected.

The action evaluates freshness against the trusted runner clock and writes that exact time to `evaluated_at`; there is no workflow input that can override time. After an allow write, it re-evaluates the in-memory snapshots at the post-write time, takes a trusted-clock sample, and evaluates them again at that exact time. It writes non-authorizing metadata and the best-effort human summary first, then writes `allowed` last. After that awaited I/O it fully reproduces the decision from immutable consumer inputs and only then samples the live trusted clock inside the canonical assertion. It takes one final cheap trusted-clock sample to enforce the five-second age bound, exclusive expiry, and minimum residual validity, then returns immediately without hashing, crypto, optional I/O, or awaited work. The written allow is exposed only when no proof, observation, attestation, transparency, or `valid_until` boundary has been crossed. `minimum-validity-seconds` is a canonical decimal integer from 0 through 60 and defaults to 30; publication must still leave at least that much residual decision validity. A failure removes the decision and appends blank `decision-file`/`valid-until` plus a final `allowed=false` override, so the last GitHub output value fails closed. Keep self-hosted runner clocks synchronized. Update the deployment and revision pins with each approved release, use short-lived attestations, and run this workflow on a renewal schedule. A signature, registry entry, or unchecked external receipt is not by itself permission to act.

Treat `allowed` and `valid-until` as immediate outputs of this step, not a transferable authorization. A delayed consumer or a consumer in another job, workflow, machine, or queue must re-run the gate from its complete pinned evaluation input and current trusted clock. Never cache or forward only the `allowed=true` string.

To require AIC's signed reference history, pass all three optional values together:

- `transparency-index-file`
- `transparency-trust-store-file`
- `transparency-trust-store-sha256`

Also pass `transparency-prior-index-file` when the matching policy sets `require_consistency: true`, and pin that checkpoint with `expected_prior_checkpoint_digest`. The action binds both signed checkpoints and fails closed if the current history is not an append-only extension of the pinned prior one.

An external receipt reference remains `not_checked` until its provider-specific verifier validates it.

## Outputs

| Output | Meaning |
| --- | --- |
| `allowed` | `true` only for a validated canonical `allow`, successful atomic write, and final publication-time reassertion |
| `verdict` | `allow`, `confirm`, `deny`, or `indeterminate` |
| `reason-codes` | JSON array of canonical AIC reliance reason codes |
| `decision-file` | Workspace-relative canonical `aic_reliance_decision`; blank unless the write succeeded |
| `valid-until` | Exclusive RFC 3339 deadline for a finalized allow; blank for non-allow and failed finalization |

The decision is a consumer-policy result. It is not an attestation, application authorization, external transparency receipt, or certification.

## Rebuild and audit the bundle

Maintainers build the committed bundle from `@aicorg/rely`, the minimal `@aicorg/verify-core`, and `@aicorg/spec` repository sources with one exact build dependency. These commands are for release maintenance only; consumers do not run npm or any install step:

```bash
npm --prefix actions/aic-rely ci --ignore-scripts --no-audit --no-fund
npm --prefix actions/aic-rely run build
npm --prefix actions/aic-rely run check:bundle
pnpm --filter @aicorg/spec build
pnpm --filter @aicorg/verify-core build
node --test tests/aic-rely-action.test.mjs
```

`check:bundle` rebuilds in memory and fails if `dist/index.js` differs from the committed artifact or imports anything outside its small crypto/filesystem/path/URL allowlist. Network and process-execution modules are not allowed. The focused regression test uses generated signed fixtures, so a fresh clone must build the ignored `@aicorg/spec` and `@aicorg/verify-core` test-time outputs first; those builds are not runtime dependencies of the action.
