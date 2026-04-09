# Release Status

## Current Position

AIC should currently be read as:

- alpha on npm
- real and usable for evaluation
- strongest on owned React, Next.js, and Vite apps
- still in stabilization and capability-deepening mode

This is not a toy repo anymore, but it is also not claiming GA maturity.

## What Is Ready To Evaluate

- `@aicorg/cli`
  - `init`
  - `doctor`
  - `generate`
  - `inspect`
  - `validate`
- React SDK instrumentation through explicit `agent*` metadata
- generated discovery, UI, actions, permissions, and workflow artifacts
- `@aicorg/mcp-server`
  - handler-level MCP validation
  - real stdio transport validation
- starter adoption paths for:
  - Next.js
  - Vite/React
- offline bootstrap from saved captures

## What The Repo Verifies Today

Mainline verification:
- `pnpm check`
- `pnpm build`
- `pnpm test`
- `pnpm test:goldens`
- `pnpm smoke:init`
- `pnpm smoke:adoption`
- `pnpm smoke:mcp`

Separate transport verification:
- `pnpm smoke:mcp:stdio`

Manual package publish path:
- `publish-packages.yml`
- includes packaging smoke before npm publish

## Best Fit Right Now

Best current fit:
- teams who own the app code
- teams willing to add explicit metadata
- teams evaluating AI-agent operation on real workflows
- product/infra teams that want safer agent interaction than DOM guessing

Not the best fit yet:
- arbitrary third-party sites
- zero-touch onboarding of unknown apps
- non-React production rollouts
- buyers expecting GA stability guarantees

## Proof Strength

The current proof is strongest in two places:

- browser-agent proof:
  - [TailAdmin Benchmark Report](/mnt/c/users/vatsa/agentinteractioncontrol/docs/tailadmin-benchmark-claude-2026-04-02.md)
- real-app adoption proof:
  - [Twenty Official Benchmark Report](/mnt/c/users/vatsa/agentinteractioncontrol/benchmarks/twenty-adoption/benchmark-report-official.md)

Use [AIC Case Studies](/mnt/c/users/vatsa/agentinteractioncontrol/docs/case-studies.md) for the short version.

## What Is Still Intentionally Rough

- npm surface is still alpha-tagged
- devtools are repo-only, not part of the published package wave
- dynamic inference is intentionally conservative
- write-back mutation remains guarded and limited
- auth is documented as an integration path, not built into core packages

## Recommended Evaluation Path

1. Read [Supported Today](/mnt/c/users/vatsa/agentinteractioncontrol/docs/supported-today.md).
2. Follow [Adopt AIC In An Existing App](/mnt/c/users/vatsa/agentinteractioncontrol/docs/adopt-existing-app.md).
3. Run the verification flow from [Release Checklist](/mnt/c/users/vatsa/agentinteractioncontrol/docs/release-checklist.md).
4. Review [AIC Case Studies](/mnt/c/users/vatsa/agentinteractioncontrol/docs/case-studies.md).

That path gives the most honest picture of current maturity.
