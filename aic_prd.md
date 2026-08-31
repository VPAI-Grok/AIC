# AIC (Agent Interaction Control) — Historical Codex Implementation PRD

> **Current direction (2026-08-28):** This is the foundational interaction-manifest PRD. The implemented product has expanded into Agent Interaction Control: a protocol-neutral behavioral assurance layer for agent-operated software. Native WebMCP capabilities take precedence over duplicate AIC fields, while AIC contracts, observations, parity verification, and proof remain independent of protocol. See [`docs/behavior-assurance.md`](./docs/behavior-assurance.md) and [ADR 0002](./docs/adr/0002-behavioral-assurance.md); they supersede conflicting positioning in this historical plan.

## Overview
Build an open standard and SDK that makes web apps reliably operable by AI agents.

This includes:
- Discovery manifest
- Runtime UI contract
- Permissions policy
- Workflow definitions
- SDK + plugins + CLI + devtools
- AI-assisted bootstrap

---

## Core Principles
- Semantic over positional
- Stable IDs required
- Runtime-aware
- Annotation-first + automation
- Safe by default
- Framework-native

---

## Outputs
- /.well-known/agent.json
- agent-ui.json (runtime)
- agent-permissions.json
- agent-workflows.json (optional)
- operate.txt (optional)

---

## Developer API Example

```tsx
<Button
  agentId="checkout.submit_order"
  agentDescription="Completes purchase"
  agentRisk="critical"
  agentRequiresConfirmation
>
  Complete purchase
</Button>
```

---

## Data Attributes

SDK should auto-inject:
- data-agent-id
- data-agent-description
- data-agent-action
- data-agent-risk

---

## Generation Modes

1. Build-time (AST scan)
2. Runtime (registry)
3. Hybrid (recommended)
4. AI bootstrap (Playwright + LLM)

---

## Packages

- @aicorg/spec
- @aicorg/runtime
- @aicorg/sdk-react
- @aicorg/plugin-next
- @aicorg/plugin-vite
- @aicorg/cli
- @aicorg/devtools
- @aicorg/ai-bootstrap

---

## Repo Structure

aic/
  packages/
  apps/
  examples/
  docs/

---

## CLI Commands

- aic scan
- aic generate
- aic validate
- aic bootstrap

---

## Tech Stack

- TypeScript
- Next.js / React / Vite
- Babel / ts-morph
- Ajv / Zod
- Playwright
- pnpm + turborepo

---

## Codex Build Phases

1. Spec
2. Runtime registry
3. React SDK
4. Plugins
5. CLI
6. Devtools
7. AI bootstrap

---

## Success Criteria

- fewer automation failures
- stable IDs across deploys
- safe handling of high-risk actions
- improved agent success rate

---

## Final Note

Focus on:
"Expose what the page means, not what the DOM looks like."
