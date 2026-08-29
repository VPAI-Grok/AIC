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
- Significant external contributions may be held until contributor licensing terms are in place.
- Behavior-verifier changes must include both passing evidence and a regression case that fails for the intended divergence.
- By opening a pull request, you acknowledge that maintainers may ask for a contributor agreement before merging work that affects future relicensing flexibility.

## Ground Rules

- The CLI is the only supported repo-mutation path.
- Runtime UI is the authoritative source for rich per-element metadata.
- Bootstrap suggestions remain review inputs, not a source of truth.
- Native protocol fields take precedence over duplicate AIC metadata.
- Behavior harnesses are trusted code; proofs must state their evidence level without implying signatures or production attestation.

## Licensing Flexibility

- The repository is currently licensed under Apache-2.0 to maximize adoption.
- That does not guarantee future versions will always use the same license.
- Already-released Apache-2.0 versions remain under Apache-2.0 for recipients of those versions.
- To preserve future licensing flexibility, maintainers may prefer small patches, documentation fixes, issue reports, and design discussion unless or until a formal contributor licensing process is established.
- See [CONTRIBUTOR-LICENSING.md](./CONTRIBUTOR-LICENSING.md) for the current project policy.
