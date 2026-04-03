# TailAdmin Dashboard Benchmark Report

## Executive Summary

This report summarizes the first real agent benchmark run on the TailAdmin AIC testbed using `Claude Sonnet 4.6`.

The main result is strong:

- On `calendar_event_creation`, AIC improved success rate from `33.3%` to `100.0%`
- On `calendar_event_creation`, AIC reduced median completion time from `134s` to `64s`
- On `calendar_event_creation`, AIC reduced median interaction steps from `12` to `3`
- On `profile_modal_edit`, AIC kept success at `100.0%` while reducing median time from `99s` to `70s`
- On `profile_modal_edit`, AIC reduced median interaction steps from `20` to `6`
- On `profile_modal_edit`, AIC improved first-target accuracy from `66.7%` to `100.0%`

The most defensible product claim from this run is:

> In realistic modal and calendar workflows, AIC materially improved agent reliability and reduced interaction overhead versus baseline browser interaction.

## Scope And Method

- App: `examples/tailadmin-dashboard`
- Agent: `Claude Sonnet 4.6`
- Flows:
  - `profile_modal_edit`
  - `calendar_event_creation`
- Modes:
  - `baseline`
  - `aic`
- Runs:
  - `3` baseline and `3` AIC runs for each flow
  - `12` total runs

Primary source files:

- Raw results: `examples/tailadmin-dashboard/benchmark-results-claude-2026-04-02.csv`
- Aggregate summary: `examples/tailadmin-dashboard/benchmark-summary-claude-2026-04-02.md`
- Local control harness summary: `examples/tailadmin-dashboard/benchmark-summary-local-2026-04-02.md`

## Headline Results

### Claude Sonnet 4.6 Summary

| Flow | Baseline Success | AIC Success | Success Lift | Baseline Median Time | AIC Median Time | Time Reduction | Baseline Median Steps | AIC Median Steps | Step Reduction |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `calendar_event_creation` | `33.3%` | `100.0%` | `+66.7 pp` | `134s` | `64s` | `52.2%` | `12` | `3` | `75.0%` |
| `profile_modal_edit` | `100.0%` | `100.0%` | `0.0 pp` | `99s` | `70s` | `29.3%` | `20` | `6` | `70.0%` |

### Supporting Local Harness Summary

The local Playwright harness produced smaller but directionally consistent efficiency gains:

- `calendar_event_creation`
  - steps: `9` -> `7`
- `profile_modal_edit`
  - baseline heuristic flow was unreliable
  - AIC flow completed consistently

This matters because the agent-run benchmark and the deterministic harness both point in the same direction: semantic targeting reduces overhead, and in the harder calendar case it also improves reliability.

## Interpretation

### What The Results Mean

`calendar_event_creation` is the strongest evidence in this report.

In baseline mode, Claude frequently failed to create and verify the event reliably. In AIC mode, it completed the same flow successfully in every run with fewer steps and no retries.

That is exactly the kind of workflow where AIC is supposed to help:

- modal opening and modal targeting
- form-field identification
- exact action selection
- verification after save

`profile_modal_edit` shows a second but different kind of win.

Baseline was able to complete the flow, but it took more steps and showed more interaction friction. AIC did not create a success-rate lift here because the baseline already succeeded, but it made the flow more direct and improved first-target accuracy.

### Most Defensible Claims

- AIC can convert an unreliable multi-step workflow into a reliable one for a real browser agent.
- AIC reduces the amount of browser interaction needed even when baseline already works.
- AIC is especially useful when the workflow depends on modals, exact field targeting, and verification after save.

## Important Caveats

### Cold-Start Timing Is Excluded

Cold-start route timing was captured inconsistently across runs and agents, so it is intentionally excluded from the headline benchmark claims.

Why:

- some runs included app compile time
- some runs were clearly warm-route runs
- some rows had inconsistent or missing cold-start values

For that reason, the benchmark conclusions in this report focus on:

- success rate
- completion time
- step count
- retries
- first-target accuracy

### One AIC Outlier Exists

`claude-004` reported `1262s` on `profile_modal_edit` while still succeeding.

This looks like an outlier stall or idle period, not a representative completion time. It affects the `p90` but not the median-based headline conclusion.

### Self-Reported Step Counts Are Directional

The step counts are useful, but they are agent-reported and not instrumented by a single normalized step recorder. They should be treated as directional evidence, not laboratory-grade counts.

## Representative Failure And Win Examples

### Baseline Failure Examples

1. `calendar_event_creation` baseline failed twice to create a visible saved event, even after multiple interaction attempts.
2. `profile_modal_edit` baseline needed extra focus/clear/re-entry behavior in one run before the final values were correct.
3. Baseline profile interaction relied on coordinate-style or visual targeting rather than stable semantic references.

### AIC Win Examples

1. `calendar_event_creation` improved from `33.3%` success to `100.0%`.
2. `calendar_event_creation` reduced median steps from `12` to `3`.
3. `profile_modal_edit` improved first-target accuracy from `66.7%` to `100.0%` and reduced median steps from `20` to `6`.

## Conclusion

The first Claude benchmark run is already enough to support a meaningful AIC claim.

The strongest result is not merely that AIC makes an easy flow faster. The stronger result is that AIC made the calendar workflow reliably operable while baseline frequently failed.

That is a materially better outcome than “fewer clicks.” It is evidence that explicit semantic contracts improve autonomous operation on realistic application UI.
