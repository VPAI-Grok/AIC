# Coding Agents

Use this repo's onboarding kit when you want a coding agent to make an app AIC-ready with less guesswork.

## Recommended File Set

- `AGENTS.md`
  Canonical AIC instructions for coding agents.
- `CLAUDE.md`
  Thin Claude Code wrapper that points to `AGENTS.md`.
- `GEMINI.md`
  Thin Gemini wrapper that points to `AGENTS.md`.
- `.github/copilot-instructions.md`
  GitHub Copilot repository instructions that point to `AGENTS.md`.
- `.cursor/rules/aic.mdc`
  Cursor rule that points to `AGENTS.md` for app-code paths.

Optional advanced helper:

- `.github/skills/aic-onboarding/SKILL.md`

## How To Use The Kit

1. Run `aic init [project-root]` in the app repo to scaffold `aic.project.json` and the recommended onboarding files.
2. Keep `AGENTS.md` as the source of truth and keep the other wrappers short.
3. Instrument critical flows with explicit `agent*` metadata.
4. Run `aic doctor [project-root]` to audit readiness before generating artifacts.
5. Run `aic scan`, `aic generate project`, `aic inspect report.json`, and `aic validate ...` as part of review.
6. For consequential actions exposed through more than one surface, map every entrypoint to one domain `operation_id`, define a behavior contract, and run `aic verify`.
7. Use native browser evidence for rendered UI/WebMCP claims and sign only passed proofs that are bound to an exact origin, deployment, and revision.

Manual fallback:

- Copy the starter files from [`templates/agent-onboarding/`](../templates/agent-onboarding) if you are not using the CLI scaffold path.

## What Agents Should Be Told

- Prefer explicit `agent*` annotations over inference.
- Use stable IDs that survive label or copy changes.
- Add confirmation metadata on critical-risk actions.
- Add entity identity on row/card actions.
- Add workflow, validation, execution, and recovery metadata where the app already has those semantics.
- Treat bootstrap as a review aid, not a source of truth.
- Regenerate AIC artifacts instead of hand-editing generated JSON.
- Prefer native protocol fields when they are equivalent.
- Keep metadata readiness separate from executed behavior proof.
- Never describe a local signed claim as independent proof of production reachability or certification.

## Optional Validation

`aic doctor [project-root]` is the primary readiness audit, and `aic generate project <config-file> --out-dir <dir>` still records an `agent_onboarding` section in `report.json`.

`aic validate behavior` and `aic verify` are separate assurance gates when a behavior contract exists.

`aic trust attest`, `aic trust verify`, and `aic registry verify` are additional gates when an issuer makes a deployment-bound claim. A registry is discovery data; agents must verify embedded attestations against a separately pinned trust store.

- Missing recommended files are warnings only.
- Template-managed files can be marked stale if their embedded template version falls behind.
- Hand-written files without a template marker still count as present.
- `aic doctor` returns non-zero only for blocking errors such as missing/invalid config, unreadable project roots, unsupported frameworks, or invalid generated manifests.
