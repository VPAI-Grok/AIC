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

Manual fallback:

- Copy the starter files from [`templates/agent-onboarding/`](/mnt/c/users/vatsa/agentinteractioncontrol/templates/agent-onboarding) if you are not using the CLI scaffold path.

## What Agents Should Be Told

- Prefer explicit `agent*` annotations over inference.
- Use stable IDs that survive label or copy changes.
- Add confirmation metadata on critical-risk actions.
- Add entity identity on row/card actions.
- Add workflow, validation, execution, and recovery metadata where the app already has those semantics.
- Treat bootstrap as a review aid, not a source of truth.
- Regenerate AIC artifacts instead of hand-editing generated JSON.

## Optional Validation

`aic doctor [project-root]` is the primary readiness audit, and `aic generate project <config-file> --out-dir <dir>` still records an `agent_onboarding` section in `report.json`.

- Missing recommended files are warnings only.
- Template-managed files can be marked stale if their embedded template version falls behind.
- Hand-written files without a template marker still count as present.
- `aic doctor` returns non-zero only for blocking errors such as missing/invalid config, unreadable project roots, unsupported frameworks, or invalid generated manifests.
