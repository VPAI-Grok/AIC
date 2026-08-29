# QA Agent Readiness

Use this offer when a team wants one real web-app workflow to be testable and safely operable by AI agents without relying on brittle selectors, visible labels, screenshots, or coordinate clicks.

## Pilot Offer

Default offer:

> Make one high-risk workflow AI-agent-testable in one week.

Best-fit customers:

- SaaS startups preparing for launch
- internal tools teams with risky admin workflows
- agencies that maintain several React, Next.js, or Vite apps
- teams already using Playwright, Claude, Cursor, Codex, or other browser agents
- teams with fragile end-to-end tests around billing, records, checkout, admin, or data mutation flows

Suggested starting price:

- $1,500-$5,000 for a fixed-scope founder-led pilot
- $49-$299/month for ongoing readiness reports, generated QA plans, and CI use after the pilot

## Deliverables

Each paid pilot should produce:

- AIC instrumentation for 1-3 critical workflows
- generated discovery, runtime UI, actions, permissions, workflows, and `report.json`
- a QA readiness report from `aic inspect qa-readiness`
- a generated QA test plan from `aic generate qa-plan`
- a behavior contract for each in-scope consequential operation
- an executed behavior proof covering the agreed human and agent surfaces
- an MCP verification pass proving agents can resolve the workflow by AIC contract
- a short handoff explaining blockers, warnings, and next actions

## Workflow

1. Identify the critical user flows, risky actions, and record-scoped actions.
2. Add `AICProvider` and development-time bridge or overlay support.
3. Add explicit `agent*` metadata to important controls.
4. Run the normal review loop:

```bash
npx @aicorg/cli@alpha doctor ./my-app
npx @aicorg/cli@alpha scan ./my-app/src
npx @aicorg/cli@alpha generate project ./my-app/aic.project.json --out-dir ./my-app/public
npx @aicorg/cli@alpha inspect ./my-app/public/report.json
```

5. Produce the QA-facing outputs:

```bash
npx @aicorg/cli@alpha inspect qa-readiness ./my-app/public/report.json
npx @aicorg/cli@alpha generate qa-plan ./my-app/public/report.json --out-file ./my-app/public/aic-qa-plan.json
```

6. Connect the MCP server and verify that an agent can discover the workflow, high-risk actions, confirmation metadata, entity metadata, permissions, and workflow steps.

7. For consequential operations, execute the behavior contract:

```bash
aic validate behavior ./aic-behavior-contract.json
aic verify ./aic-behavior-contract.json \
  --harness ./aic-verification-harness.mjs \
  --out-file ./aic-proof.json
```

## What The Readiness Score Means

The QA readiness score is deterministic and conservative. It only rewards metadata that exists in generated artifacts.

The report checks:

- stable AIC IDs
- high and critical action confirmation metadata
- entity metadata on high-value actions
- workflow references and generated workflows
- execution, validation, and recovery metadata coverage
- generated manifest validity
- extraction diagnostics

The report does not claim execution or test coverage. It says whether the generated interaction metadata is complete enough for a QA agent to inspect and exercise the selected workflow.

## Readiness versus proof

QA readiness and behavior assurance answer different questions:

- readiness asks whether stable IDs, risk, confirmation, entity, workflow, validation, execution, and recovery metadata are present;
- behavior proof asks whether supplied observations actually met the scenario requirements and whether required surfaces behaved equivalently.

A high readiness score cannot substitute for executed evidence. An executed proof also cannot repair an incomplete or incorrect contract.

## QA Plan Output

`aic generate qa-plan` reads generated AIC manifests and emits:

- scenario IDs
- workflow-derived steps when workflows exist
- high-value runtime UI scenarios when workflows are absent
- max risk per scenario
- confirmation-aware safety-path flags
- a Playwright skeleton that resolves controls by `data-agent-id`

Selectors remain execution mechanics. Stable `agentId` values are the contract.

## Pilot Acceptance Criteria

A pilot workflow is ready for customer handoff when:

- `aic doctor` has no blocking errors
- `aic generate project` writes current artifacts
- `aic inspect qa-readiness` has no blockers
- high and critical actions expose structured confirmation metadata
- record-scoped actions expose entity ID, type, and label where the app has that data
- at least one meaningful workflow exists for the pilot flow
- the generated QA plan includes the target workflow
- an MCP-compatible agent can discover the workflow without relying on DOM text or CSS selectors
- critical mutations have an executed behavior proof for success, denial, and confirmation decline
- required human/agent parity scenarios pass with no findings
