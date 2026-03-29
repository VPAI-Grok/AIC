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

1. Copy the starter files from [`templates/agent-onboarding/`](/mnt/c/users/vatsa/agentinteractioncontrol/templates/agent-onboarding) into the app repo.
2. Keep `AGENTS.md` as the source of truth and keep the other wrappers short.
3. Add or update `aic.project.json` for the app.
4. Instrument critical flows with explicit `agent*` metadata.
5. Run `aic scan`, `aic generate project`, `aic inspect report.json`, and `aic validate ...` as part of review.

## What Agents Should Be Told

- Prefer explicit `agent*` annotations over inference.
- Use stable IDs that survive label or copy changes.
- Add confirmation metadata on critical-risk actions.
- Add entity identity on row/card actions.
- Add workflow, validation, execution, and recovery metadata where the app already has those semantics.
- Treat bootstrap as a review aid, not a source of truth.
- Regenerate AIC artifacts instead of hand-editing generated JSON.

## Optional Validation

`aic generate project <config-file> --out-dir <dir>` now records an `agent_onboarding` section in `report.json`.

- Missing recommended files are warnings only.
- Template-managed files can be marked stale if their embedded template version falls behind.
- Hand-written files without a template marker still count as present.
