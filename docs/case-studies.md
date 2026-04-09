# AIC Case Studies

Use this page when you want proof that AIC works on real agent workflows without turning the main README into a benchmark dump.

## 1. TailAdmin Dashboard

TailAdmin is the clearest browser-agent proof case in this repo.

Report:
- [TailAdmin Benchmark Report](/mnt/c/users/vatsa/agentinteractioncontrol/docs/tailadmin-benchmark-claude-2026-04-02.md)

Strongest results:
- `calendar_event_creation` success improved from `33.3%` to `100.0%`
- median time improved from `134s` to `64s`
- median steps improved from `12` to `3`
- `profile_modal_edit` stayed at `100.0%` success while reducing time and steps materially

What this proves:
- AIC can make a realistic browser flow reliable, not just slightly faster
- AIC is especially useful on modal and calendar workflows where agents normally guess

## 2. Twenty CRM

Twenty is the strongest real-app adoption proof in this repo.

Reports and benchmark assets:
- [Twenty Official Benchmark Report](/mnt/c/users/vatsa/agentinteractioncontrol/benchmarks/twenty-adoption/benchmark-report-official.md)
- [Twenty Adoption Benchmark](/mnt/c/users/vatsa/agentinteractioncontrol/benchmarks/twenty-adoption/README.md)
- [Twenty Benchmark Summary](/mnt/c/users/vatsa/agentinteractioncontrol/benchmarks/twenty-adoption/benchmark-summary-official.md)

The current official measured slice is green on:
- detail navigation
- destructive cancel
- record note creation
- record task creation
- list sort plus record open
- list filter plus record open
- record stage mutation
- list filter clear

What this proves:
- AIC can be adopted into a real open-source CRM, not just repo-owned demos
- the main gain is contract correctness and safety, not just fewer clicks
- destructive actions, exact-record targeting, and workflow boundaries benefit the most

## 3. How To Read These Proofs

TailAdmin answers:
- does AIC help a real browser agent operate an app more reliably?

Twenty answers:
- can AIC be added to a real existing app and improve correctness on a hard slice?

Together they support the current product claim:

> In owned React/Next/Vite apps with explicit AIC metadata, agents can resolve UI and action semantics by contract instead of guessing from DOM text, screenshots, or selectors.
