# Changesets

This repo uses Changesets to manage alpha npm releases for the publishable `@aicorg/*` packages.

Typical flow:

1. Run `pnpm changeset` to record package release notes.
2. Run `pnpm version:packages` on the release branch to bump package versions.
3. Dispatch the protected publish workflow, which verifies and packs without OIDC before a minimal npm Trusted Publisher job receives the exact tarballs. `pnpm release:publish` remains a maintainer-only local fallback and is not used by that workflow.

Examples and deferred packages remain private.

Behavior-assurance changes normally require coordinated changesets for `@aicorg/spec`, `@aicorg/verify-core`, `@aicorg/automation-core`, and `@aicorg/cli`; include `@aicorg/rely` when the decision or preflight surface changes, and `@aicorg/webmcp` only when its published package surface changes.
