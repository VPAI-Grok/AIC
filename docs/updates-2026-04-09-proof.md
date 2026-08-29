# 📊 What The Benchmarks Actually Prove

There are two easy mistakes people make with AIC:

1. “This is just fewer clicks.”
2. “This only works on toy demos.”

The current proof says neither of those is true.

## Proof Surface 1: TailAdmin

TailAdmin answers the browser-agent question:

> does AIC help an agent operate a UI more reliably?

Best result:
- `calendar_event_creation` went from `33.3%` success to `100.0%`
- median time dropped from `134s` to `64s`
- median steps dropped from `12` to `3`

That is not a vanity metric. That is the difference between:
- “the agent kind of flails around”
- and “the agent actually completes the workflow”

## Proof Surface 2: Twenty CRM

Twenty answers the adoption question:

> can AIC be added to a real existing app and improve correctness on a hard slice?

The current official slice is green on:
- detail navigation
- destructive cancel
- note creation
- task creation
- list sort and open
- list filter and open
- stage mutation
- filter clear

The important part is not raw speed. The important part is contract correctness:
- detail navigation: `0.40 -> 0.90`
- destructive cancel: `0.60 -> 1.00`
- note creation: `0.35 -> 0.95`
- task creation: `0.40 -> 0.95`
- filter clear: `0.55 -> 1.00`

That’s what AIC is supposed to improve.

## What This Means

AIC is strongest when:
- the workflow is risky
- the target entity matters
- confirmation rules matter
- the UI has real ambiguity

In other words: the exact places where “just use the DOM” starts getting goofy.

## What It Does *Not* Mean

It does not mean:
- every agent suddenly becomes perfect
- every app can be operated with zero app-team work
- AIC replaces auth, permissions, or backend policy

It means:
- if the app team publishes the contract clearly
- the agent can operate by meaning instead of by guesswork

That’s the win.

## If You Want The Raw Details

- [AIC Case Studies](./case-studies.md)
- [TailAdmin Benchmark Report](./tailadmin-benchmark-claude-2026-04-02.md)
- [Twenty Official Benchmark Report](../benchmarks/twenty-adoption/benchmark-report-official.md)
