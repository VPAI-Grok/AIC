# Changesets

This repo uses Changesets to manage alpha npm releases for the publishable `@aicorg/*` packages.

Typical flow:

1. Run `pnpm changeset` to record package release notes.
2. Run `pnpm version:packages` on the release branch to bump package versions.
3. Run `pnpm release:publish` from CI or a trusted maintainer environment with npm credentials.

Examples and deferred packages remain private.
