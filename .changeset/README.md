# Changesets

This repo uses Changesets to manage alpha npm releases for the publishable `@aicorg/*` packages.

Typical flow:

1. Run `pnpm changeset` to record package release notes.
2. Run `pnpm version:packages` on the release branch to bump package versions.
3. Run `pnpm release:publish` from CI or a trusted maintainer environment with npm credentials.

Examples and deferred packages remain private.

Behavior-assurance changes normally require coordinated changesets for `@aicorg/spec`, `@aicorg/automation-core`, and `@aicorg/cli`; include `@aicorg/webmcp` only when its published package surface changes.
