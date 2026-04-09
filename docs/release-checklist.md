# Release Checklist

## Technical Gates

- `pnpm check`
- `pnpm build`
- `pnpm test`
- `pnpm test:goldens`
- `pnpm smoke:init`
- `pnpm smoke:adoption`
- `pnpm smoke:mcp`
- `pnpm smoke:mcp:stdio`

## Clean Workspace Gate

- the documented verification flow does not leave unexpected tracked diffs
- common generated local outputs are ignored or cleaned up
- README and docs links resolve to committed files, not local-only notes

## Contract Proof Gates

- example runtime proof tests are green
- reference consumer proof tests are green
- supported-boundary docs reflect the current product surface

## Repo Launch Gates

- `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and `CHANGELOG.md` are present
- README links to the examples, supported-boundary doc, and proof harness
- GitHub issue and PR templates are present
- CI workflow is enabled on the default branch

## npm Alpha Release Gates

- first-wave package manifests are public and include publish metadata
- tarball smoke tests are green
- package matrix docs match the current publish wave
- publish workflow is configured with npm-token expectations documented
- the publish workflow runs:
  - `pnpm check`
  - `pnpm build`
  - `pnpm test:contracts`
  - `pnpm test:goldens`
  - `pnpm test:packaging`

## Workflow Roles

- `ci.yml`
  - fast mainline verification for the workspace
  - includes adoption and MCP handler smokes
- `mcp-stdio-smoke.yml`
  - real stdio transport verification for `@aicorg/mcp-server`
- `publish-packages.yml`
  - manual npm alpha publish path after verification succeeds

## Not In This Release

- stable GA npm publishing
- non-React platform support
- heuristic repo mutation
