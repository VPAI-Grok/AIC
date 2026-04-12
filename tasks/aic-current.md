# AIC Current Loop Task

This file is the default backlog and stop-condition source of truth for the Codex loop.

## Goal

Make AIC materially better in small, safe, validated iterations.

## Working Rules

- Read `AGENTS.md` before making product decisions.
- Prefer explicit metadata and stable contracts over inference.
- Do not hand-edit generated AIC artifacts.
- Keep each iteration small enough to finish with validation.
- Read `.codex-loop/operating-memory.md` and related loop memory files before choosing a slice.
- Avoid repeating the same slice if another high-value safe slice is available.
- Promote repeated learnings into loop memory when they should influence future iterations.
- Update this file when priorities or completion criteria change.

## Priority Ladder

Work from the highest incomplete item first.

1. Strengthen core AIC authoring and runtime semantics for critical actions, risky actions, and entity-scoped actions.
2. Improve CLI, scan, generate, inspect, and validate workflows so onboarding and review are more reliable.
3. Improve React, Next.js, and Vite integration quality in packages and examples.
4. Tighten tests, smoke coverage, and documentation for agent-driven adoption flows.
5. Improve developer ergonomics only after the above are solid.
6. Improve the codex loop itself only when that clearly increases future slice quality or reduces repeated mistakes.

## Current Active Slice

Until this file is updated with a narrower task, the loop should pick one small improvement from this set:

- Close the highest-value gap in CLI validation or inspection output.
- Improve a generated or runtime manifest workflow without hand-editing generated artifacts.
- Add or refine AIC metadata in an example app for a critical or risky user flow.
- Add or tighten tests for a recent behavior change or uncovered contract.
- Improve documentation for adoption, instrumentation, or verification if the code path is already solid.
- Improve loop memory, loop prompts, or loop operating docs if that will materially improve future autonomous iterations.

## Slice Selection Heuristics

When several safe slices are available, prefer the one with the best mix of:

- user-visible contract quality improvement
- onboarding or review-path leverage
- confidence that the change can be validated in one iteration
- likelihood of preventing repeated future mistakes

Avoid slices that:

- expand unsupported product scope
- require hand-editing generated artifacts
- are mostly speculative refactors without clear user or operator value
- are so large they cannot be validated in one iteration

## Completion Standard For A Slice

A slice is complete only when:

- The code change is implemented.
- Relevant checks have been run.
- Any related docs or examples are updated if needed.
- `.codex-loop/current-slice.md` records the chosen slice and planned validation.
- `.codex-loop/progress.txt` has a brief appended note with learnings and the next recommended slice.
- Durable repeated learnings are promoted into loop memory files when needed.

## Loop Stop Condition

The loop should output `COMPLETE` only when one of these is true:

- This file contains a single explicit task and that task is fully done.
- All listed active items are complete and there is no next safe slice to take automatically.

Otherwise, finish the iteration normally and let the next loop continue.

## Self-Improvement Goal

The loop should get better over time through repo-native learning, not through model changes.

That means:

- better task selection
- better reusable memory
- better validation discipline
- better skill creation when workflows repeat
- better avoidance of recent regressions

If the loop notices repeated wasted motion, unclear prompts, or recurring review findings, improving the loop itself is valid work as long as the change is small, safe, and validated.
