# Codex Loop Instructions

You are running inside a repeated Codex execution loop.

Rules:
- Treat each iteration as a fresh session.
- Read `AGENTS.md` before making changes.
- Read `tasks/aic-current.md` before planning work. This is the primary task source of truth for AIC.
- Read `.codex-loop/progress.txt` if it exists before starting work.
- Read `.codex-loop/operating-memory.md` if it exists before starting work.
- Read `.codex-loop/known-good-commands.md`, `.codex-loop/touch-matrix.md`, and `.codex-loop/recent-regressions.md` if they exist before choosing a slice.
- Write the chosen slice summary to `.codex-loop/current-slice.md`.
- Check `.codex-loop/last-slice.txt` and avoid repeating the same slice unless it is the only high-value safe continuation.
- Append progress and reusable learnings to `.codex-loop/progress.txt`.
- Keep changes scoped and incremental.
- Run the relevant checks before concluding the iteration.
- If the task is fully complete, reply with exactly `COMPLETE` on its own line in the final message.
- If the task is not complete, explain the next highest-value step briefly in the final message.

Expected workflow:
1. Read `tasks/aic-current.md` and treat its current active slice as the backlog for this run.
2. Read the loop memory files and use them to avoid repeated mistakes and reuse known good validation paths.
3. Identify one small, concrete unit of work for this iteration.
4. Write a short slice record to `.codex-loop/current-slice.md` with:
   - priority area
   - chosen slice
   - why this slice beats the next best alternative
   - planned validation commands
5. Implement it.
6. Validate it.
7. Append a structured progress note to `.codex-loop/progress.txt` including:
   - what changed
   - what validated it
   - what was learned
   - the next recommended slice
8. If the same learning should affect future runs, promote it into `.codex-loop/operating-memory.md` or another loop memory file.
9. Stop after one coherent slice, unless the remaining work is trivial and safe to finish in the same iteration.

AIC-specific requirements:
- Follow the implementation order and done criteria in `AGENTS.md`.
- Prefer explicit `agent*` metadata over inference.
- Do not hand-edit generated AIC JSON artifacts.
- When touching onboarding or instrumentation flows, prefer validating with the local CLI commands documented in `AGENTS.md`.
- Keep edits aligned with React, Next.js, and Vite support as the current product boundary.

Slice selection guidance:
- Prefer fixes that improve contract quality, onboarding clarity, validation quality, example instrumentation, or proof strength.
- Prefer work that can be validated cheaply and clearly.
- Avoid speculative scope expansion when a supported-path quality gap exists.
- Prefer a different subsystem than the immediately previous slice when the value is similar and the previous slice is already validated.

Progress note template:

```md
## YYYY-MM-DDTHH:MM:SS iteration N
- Priority area:
- Chosen slice:
- Files changed:
- Validation:
- Learnings:
- Next slice:
```

The loop runner will invoke you again if you do not output `COMPLETE`.
