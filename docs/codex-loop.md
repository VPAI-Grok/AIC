# Codex Loop

This is a Codex-native version of the Ralph pattern.

It does not try to keep one interactive session alive forever. Instead, it runs
fresh `codex exec` iterations and uses files for shared state between runs.

## Why this exists

`codex exec` supports non-interactive runs, which makes it possible to build an
external loop that does not require pressing continue in the interactive UI.

## Files

- `scripts/codex-loop.sh`: the loop runner
- `scripts/codex-loop/prompt.md`: the standing prompt template
- `.codex-loop/progress.txt`: append-only progress and learnings
- `.codex-loop/operating-memory.md`: curated durable loop memory
- `.codex-loop/known-good-commands.md`: validated command shortlist
- `.codex-loop/touch-matrix.md`: subsystem-to-validation mapping
- `.codex-loop/recent-regressions.md`: mistakes the loop should actively avoid
- `.codex-loop/current-slice.md`: the slice selected for the current run
- `.codex-loop/last-slice.txt`: the previous slice summary
- `.codex-loop/retrospective.md`: periodic loop self-review notes
- `.codex-loop/run.log`: full loop output
- `.codex-loop/last-run-status.txt`: final status summary for the most recent loop run

## Basic usage

```bash
chmod +x scripts/codex-loop.sh
scripts/codex-loop.sh --full-auto 10
```

If your task needs web access:

```bash
scripts/codex-loop.sh --full-auto --search 10
```

If you are running inside an externally sandboxed environment and want zero
approval or sandbox prompts from Codex itself:

```bash
scripts/codex-loop.sh --dangerous 10
```

Use `--dangerous` only if you understand the risk.

Useful variants:

```bash
scripts/codex-loop.sh --full-auto --search 10
scripts/codex-loop.sh --task-file tasks/aic-current.md --model gpt-5.4 10
scripts/codex-loop.sh --full-auto --notify desktop 10
```

## Completion Notifications

The loop can notify you when a run ends.

Notification modes:

- `auto`: try desktop notification first, otherwise fall back to a terminal bell
- `desktop`: require a desktop notification path such as `notify-send` or `powershell.exe`
- `bell`: emit a terminal bell only
- `off`: do not notify

Examples:

```bash
scripts/codex-loop.sh --full-auto --notify auto 10
scripts/codex-loop.sh --full-auto --notify desktop 10
scripts/codex-loop.sh --full-auto --notify bell 10
```

Every run also writes a persistent status summary to:

```text
.codex-loop/last-run-status.txt
```

That file records whether the loop:

- finished with `COMPLETE`
- stopped on a failed iteration
- reached the max-iteration limit without `COMPLETE`

## Task input

This repo now includes a default task source of truth:

- `tasks/aic-current.md`

The loop prompt is already wired to read that file first.

Update `tasks/aic-current.md` whenever you want to:

- focus the loop on a single feature or bug
- change the priority order
- tighten or relax the stop condition

## Ralph vs Codex

Ralph for Claude/Amp works by repeatedly spawning fresh agent runs and stopping
when the agent reports completion. This script follows the same core pattern for
Codex, using:

- fresh `codex exec` runs
- file-based memory via `.codex-loop/progress.txt`
- a text stop condition based on `COMPLETE`

## Self-Improving Loop Behavior

The loop is designed to improve over time without changing the underlying model.

It gets better through:

- durable repo-local memory in `.codex-loop/`
- stronger slice selection rules
- explicit validation discipline
- regression memory for repeated mistakes
- periodic retrospectives that improve the loop prompt and backlog structure

This is repo-native learning, not model fine-tuning.

The intended workflow is:

1. Read the task file and loop memory.
2. Choose one small safe slice.
3. Record the chosen slice before implementation.
4. Implement and validate it.
5. Append learnings and the next recommended slice.
6. Promote durable learnings from progress into operating memory when they should shape future runs.

## Recommended Memory Maintenance

Use `progress.txt` as the raw append-only log.

Promote information into `operating-memory.md` when it becomes a standing rule, for example:

- `if touching package exports, also run packaging tests`
- `if touching MCP behavior, run both handler and stdio smokes`
- `do not regress textarea semantics in shadcn wrappers`

Update `recent-regressions.md` whenever a review finding or failed validation reveals a mistake future runs should actively avoid.

Update `retrospective.md` after a batch of iterations when the loop itself needs to change.

## Suggested next step for AIC

Run the loop against the default AIC backlog:

```bash
scripts/codex-loop.sh --full-auto 10
```

Or use the package script:

```bash
pnpm codex:loop
```

Additional package scripts can wrap the search or dangerous variants when needed.
