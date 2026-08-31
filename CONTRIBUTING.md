# Contributing

## Working Agreement

- Keep changes aligned with the current supported boundary in [docs/supported-today.md](./docs/supported-today.md).
- Prefer explicit contract improvements over heuristic behavior.
- Do not broaden repo mutation, extraction, or provider behavior without tests and docs in the same change.

## Local Workflow

1. Install dependencies with `pnpm install`.
2. Run `pnpm check`.
3. Run `pnpm build`.
4. Run `pnpm test`.
5. If manifest or fixture outputs changed, run `pnpm test:update-goldens` and then `pnpm test:goldens`.
6. If behavior contracts, observations, or verification changed, run the checkout `aic:verify` script and inspect the proof.

## Pull Requests

- Keep PRs scoped to one milestone or one subsystem.
- Update docs when the public behavior or supported boundary changes.
- Include tests for any behavior change.
- Call out intentional contract changes in the PR description.
- Behavior-verifier changes must include both passing evidence and a regression case that fails for the intended divergence.

## Ground Rules

- The CLI is the only supported repo-mutation path.
- Runtime UI is the authoritative source for rich per-element metadata.
- Bootstrap suggestions remain review inputs, not a source of truth.
- Native protocol fields take precedence over duplicate AIC metadata.
- Behavior harnesses are trusted code; proofs must state their evidence level without implying signatures or production attestation.

## Licensing

- The AIC open-source core and published packages are licensed under Apache-2.0.
- Contributions intentionally submitted for inclusion are accepted under Apache-2.0 unless a different written agreement is made before submission.
- AIC does not currently require a contributor license agreement.
- Hosted services and support may have separate commercial terms without changing the license of the open-source core.
- See [CONTRIBUTOR-LICENSING.md](./CONTRIBUTOR-LICENSING.md) for the current project policy.
