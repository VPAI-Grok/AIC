# npm Trusted Publishing Boundary

This boundary follows npm's [Trusted Publishing guidance](https://docs.npmjs.com/trusted-publishers/) and GitHub's [OIDC deployment-hardening guidance](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-cloud-providers).

The alpha release workflow has two deliberately separate trust zones:

1. `verify-and-pack` checks out the repository, installs dependencies with lifecycle scripts disabled, builds, tests, and creates the tarballs plus `SHA256SUMS` and `publish-plan.tsv`. This job has `contents: read` and no OIDC permission.
2. `publish-alpha` receives only the immutable artifact ID from the first job. It has no checkout, dependency install, package-manager bootstrap, or repository-script execution. It verifies the exact tarball set, checks every digest and embedded package identity, and publishes with `--ignore-scripts` and provenance.

The repository cannot create the external controls that make the second zone trustworthy. A repository or npm administrator must complete all of the setup below before running [Publish Packages](../.github/workflows/publish-packages.yml).

## GitHub environment

- Create a GitHub environment named exactly `npm-alpha` in `VPAI-Grok/AIC`.
- Add at least one required reviewer who understands the release diff and npm package list. Prevent self-approval when the repository plan supports it.
- Restrict deployment branches or tags to the protected alpha-release refs used by the project. Do not permit arbitrary feature branches.
- Keep environment secrets empty. In particular, the environment and repository must not contain `NPM_TOKEN`; authentication comes from the short-lived OIDC exchange.
- Protect changes to this workflow, the pack script, package manifests, the lockfile, and this policy test with branch protection and required review.

The environment approval is the last human-controlled gate. Reviewers should confirm the triggering full commit SHA, completed verification job, artifact ID, and intended package versions before approval.

## npm Trusted Publisher

For every package in the reviewed publish wave, an npm package owner must configure a GitHub Actions **Trusted Publisher** with these exact bindings:

| Setting | Required value |
| --- | --- |
| Organization or user | `VPAI-Grok` |
| Repository | `AIC` |
| Workflow filename | `publish-packages.yml` |
| GitHub environment | `npm-alpha` |

Trusted Publisher configuration is package-specific. Configure it for every existing `@aicorg/*` package before approving the workflow. A package that has never been published may require a one-time owner-controlled bootstrap publication before its Trusted Publisher can be attached; do that out of band and do not add a long-lived npm token fallback to this workflow.

Require two-factor authentication and least-privilege package ownership in npm independently of this workflow. Remove stale automation tokens after Trusted Publisher migration.

## Runtime and artifact requirements

- Trusted publishing requires npm 11.5.1 or newer. The publish job selects Node.js 24 and fails closed if the bundled npm is older; it does not install or upgrade npm in the OIDC-enabled job.
- The setup action and every registry lookup and publish command force `https://registry.npmjs.org/`. A package-level `publishConfig.registry` cannot redirect an OIDC-enabled command.
- All `uses:` references are pinned to reviewed full commit SHAs. Dependabot or maintainers may propose updates, but a floating major tag is not accepted in this workflow.
- `actions/upload-artifact` v4 produces an immutable artifact. The publish job downloads the exact artifact ID emitted by `verify-and-pack`, not an artifact selected only by name.
- `SHA256SUMS` and `publish-plan.tsv` are created after packing. The publish job rejects missing, extra, renamed, digest-mismatched, or package-identity-mismatched tarballs.
- Already-present package versions are skipped. Every new version is published from its verified `.tgz`, with the `alpha` tag, public access, npm provenance, and lifecycle scripts disabled.

After the run, verify each expected package version and its `alpha` dist-tag directly in the npm registry before changing documentation from “implemented” to “published.” A successful workflow alone is not registry verification.
