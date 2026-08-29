<div align="center">

# AIC — Agent Interaction Control

**Behavioral assurance for agent-operated software.**

[![npm](https://img.shields.io/npm/v/@aicorg/cli?label=%40aicorg%2Fcli&color=4f9cf9)](https://www.npmjs.com/package/@aicorg/cli)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange.svg)](./docs/release-status.md)
[![WebMCP](https://img.shields.io/badge/WebMCP-native--first-0f766e.svg)](./docs/webmcp.md)
[![Behavior Proof](https://img.shields.io/badge/AIC%20Proof-executed-7c3aed.svg)](./docs/behavior-assurance.md)

**Standards describe. AIC proves.**

</div>

A browser protocol can describe a tool. It cannot, by itself, prove that the human UI, WebMCP tool, MCP server, and API enforce the same authorization, confirmation, side effects, and outcomes.

AIC is an open-source assurance layer for that gap. It helps teams:

- publish explicit semantics for important UI controls;
- adopt native WebMCP without duplicating equivalent metadata;
- define protocol-neutral behavioral contracts;
- execute the same scenarios across multiple surfaces;
- fail CI when those surfaces diverge; and
- emit a portable, digest-addressed behavior proof.

AIC does not compete with WebMCP, MCP, OpenAPI, or future browser standards. Those are execution and description surfaces. AIC verifies the behavior behind them.

## What is new

The repository now includes the first AIC Behavior Assurance vertical slice:

- `aic.behavior/0.1` contracts for actions, surfaces, invariants, side effects, outcomes, and parity scenarios;
- validators and public JSON Schemas;
- a deterministic verification engine in `@aicorg/automation-core`;
- `aic validate behavior` and `aic verify` commands;
- executed, imported, mixed, and no-evidence classifications;
- canonical SHA-256 digests for contracts and observation sets;
- a checkout harness proving human UI/WebMCP parity for success, authorization denial, and confirmation decline; and
- a dedicated GitHub Actions gate that publishes the proof as a CI artifact.

This proves what the supplied evidence demonstrates. It is not yet a cryptographic signature, remote attestation, or guarantee about production.

## Quick start

### 1. Instrument an owned React, Next.js, or Vite app

```bash
npx @aicorg/cli@alpha init ./my-app
npx @aicorg/cli@alpha doctor ./my-app
npx @aicorg/cli@alpha generate project ./my-app/aic.project.json --out-dir ./my-app/public
```

Use stable IDs and explicit semantics on important controls:

```tsx
<AICButton
  agentId="checkout.submit_order"
  agentAction="submit"
  agentDescription="Charges the selected payment method and submits the order"
  agentRisk="critical"
  agentEntityId="ord_100245"
  agentEntityType="order"
  agentRequiresConfirmation
  agentConfirmation={{
    type: "human_review",
    prompt_template: "Charge {{payment_method}} for {{order_total}}?"
  }}
>
  Submit order
</AICButton>
```

### 2. Define behavior once, independent of protocol

```json
{
  "artifact_type": "aic_behavior_contract",
  "spec": "aic.behavior/0.1",
  "id": "checkout.complete.behavior",
  "action": {
    "id": "checkout.complete",
    "operation_id": "checkout.complete.domain",
    "risk": "critical"
  },
  "surfaces": [
    { "id": "human-ui", "kind": "human_ui", "label": "Submit button", "entrypoint": "checkout.submit_order" },
    { "id": "webmcp", "kind": "webmcp", "label": "WebMCP tool", "entrypoint": "complete_checkout" }
  ],
  "requirements": [
    {
      "id": "order.submitted",
      "phase": "postcondition",
      "description": "The order ends in submitted state."
    }
  ],
  "scenarios": [
    {
      "id": "success",
      "title": "Checkout succeeds",
      "surfaces": ["human-ui", "webmcp"],
      "parity": "required",
      "expected": {
        "status": "succeeded",
        "required_requirements": ["order.submitted"]
      }
    }
  ]
}
```

The sample is intentionally minimal; use the [checkout contract](./examples/nextjs-checkout-demo/aic-behavior-contract.json) as the complete reference.

### 3. Execute and verify

From this repository:

```bash
pnpm build
pnpm aic validate behavior ./examples/nextjs-checkout-demo/aic-behavior-contract.json
pnpm aic verify ./examples/nextjs-checkout-demo/aic-behavior-contract.json \
  --harness ./examples/nextjs-checkout-demo/aic-verification-harness.mjs \
  --out-file ./examples/nextjs-checkout-demo/aic-proof.json
pnpm aic inspect ./examples/nextjs-checkout-demo/aic-proof.json
```

`aic verify` exits nonzero when observations are missing, expected behavior fails, operation identities differ, or required surfaces are not behaviorally equivalent. Harness modules are trusted local code and execute with the permissions of the CLI process.

See [Behavior Assurance](./docs/behavior-assurance.md) for the full contract and evidence model.

## WebMCP: native first, AIC verified

When WebMCP provides a field or lifecycle primitive, AIC should consume it rather than invent a parallel one. AIC adds value where protocol metadata stops:

1. WebMCP registers and executes the browser tool.
2. The app routes human and agent entrypoints to the same domain operation.
3. AIC records explicit requirements and expected outcomes.
4. AIC runs cross-surface scenarios and produces reviewable proof.

The current `@aicorg/webmcp` adapter remains useful as a fail-closed compatibility bridge for the experimental browser API. Its wrapper is not the long-term moat; portable behavior contracts, evidence, parity verification, and CI policy are.

```bash
pnpm add @aicorg/webmcp@workspace:*
pnpm add -D webmcp-types@0.1.5
pnpm aic scan ./src --webmcp
```

WebMCP remains feature-detected and experimental. In browsers without `document.modelContext`, the human application continues to work. Read [WebMCP with AIC](./docs/webmcp.md).

## Existing discovery and operation surface

AIC can generate and serve:

```text
/.well-known/agent.json          app identity and capabilities
/.well-known/agent/ui            current UI semantics
/.well-known/agent/actions       semantic action contracts
agent-permissions.json           permission and risk policy
agent-workflows.json             multi-step workflows
operate.txt                      compact operation guidance
aic-proof.json                   behavior verification result
```

The MCP server exposes the discovery manifests through read-only tools, so MCP-compatible agents can inspect a supported app without relying on CSS selectors or visible labels.

```json
{
  "mcpServers": {
    "aic": {
      "command": "npx",
      "args": ["-y", "@aicorg/mcp-server"]
    }
  }
}
```

See [MCP Server Setup](./docs/mcp-server.md).

## Packages

| Package | Purpose |
|---|---|
| `@aicorg/spec` | Interaction manifests, behavior contracts, proof types, and validators |
| `@aicorg/automation-core` | Deterministic scanning, generation, readiness analysis, and behavior verification |
| `@aicorg/cli` | `init`, `doctor`, `scan`, `generate`, `validate`, `verify`, `inspect`, `diff`, and `apply` |
| `@aicorg/runtime` | Browser registry and live UI manifest serialization |
| `@aicorg/sdk-react` | React hooks and components for explicit `agent*` semantics |
| `@aicorg/webmcp` | Native WebMCP compatibility and guarded registration |
| `@aicorg/mcp-server` | Read-only MCP discovery server |
| `@aicorg/devtools` | Browser overlay, inspection, diffing, and authoring plans |
| `@aicorg/plugin-next` / `@aicorg/plugin-vite` | Framework artifact generation |
| `@aicorg/ai-bootstrap*` | Review-assisted annotation suggestions |
| `@aicorg/integrations-*` | Component-library adapters |

The published npm line is alpha. Repository-only behavior-assurance additions ship with the next package release. See [npm Packages](./docs/npm-packages.md).

## Proof and examples

Start with the [Next.js checkout demo](./examples/nextjs-checkout-demo). It contains:

- an AIC-instrumented critical checkout action;
- native WebMCP registration;
- a shared checkout domain operation;
- a behavior contract and executable harness; and
- a checked-in [behavior proof](./examples/nextjs-checkout-demo/aic-proof.json).

The broader benchmark corpus includes real browser-agent experiments on TailAdmin and a measured adoption slice on Twenty CRM. Those benchmarks measure agent task performance; the new behavior proof measures contract conformance and cross-surface parity. They answer different questions.

- [Case studies](./docs/case-studies.md)
- [Twenty official benchmark](./benchmarks/twenty-adoption/benchmark-report-official.md)
- [TailAdmin benchmark](./examples/tailadmin-dashboard)

## Supported boundary

AIC is currently optimized for owned React, Next.js, and Vite applications. It deliberately prefers authored metadata and executable evidence over inference.

Current limitations:

- alpha APIs can change;
- unknown third-party sites are outside the supported boundary;
- dynamic JSX extraction produces diagnostics instead of guesses;
- bootstrap suggestions require review;
- WebMCP tracks an experimental browser API;
- the included harness proof is local evidence, not production attestation;
- proof signing, transparency logs, remote runners, and hosted policy enforcement are not implemented yet.

Read [Supported Today](./docs/supported-today.md) and [Threat Model](./docs/threat-model.md) before making assurance claims.

## Development

```bash
pnpm install
pnpm check
pnpm build
pnpm test
pnpm test:goldens
pnpm --dir examples/nextjs-checkout-demo run aic:verify
```

Generated AIC JSON should be regenerated and reviewed, not hand-edited.

## Documentation

| Document | Focus |
|---|---|
| [Behavior Assurance](./docs/behavior-assurance.md) | Contracts, observations, proof semantics, harnesses, and CI |
| [WebMCP with AIC](./docs/webmcp.md) | Native-first integration and compatibility boundary |
| [Architecture](./docs/architecture.md) | Packages, data flow, and trust boundaries |
| [Manifest Spec](./docs/manifest-spec.md) | Discovery and interaction artifacts |
| [SDK API](./docs/sdk-api.md) | React authoring surface |
| [QA Agent Readiness](./docs/qa-agent-readiness.md) | Metadata coverage and test planning |
| [MCP Server](./docs/mcp-server.md) | Read-only agent discovery |
| [Adopt an Existing App](./docs/adopt-existing-app.md) | Practical onboarding path |
| [Coding Agents](./docs/coding-agents.md) | Versioned onboarding instructions for coding agents |
| [npm Packages](./docs/npm-packages.md) | Published and next-wave package matrix |
| [Release Status](./docs/release-status.md) | Current shipped and repository-only capabilities |
| [Threat Model](./docs/threat-model.md) | What AIC proof does and does not establish |

JSON Schemas live under [`schemas/`](./schemas/).

## Open source

AIC is Apache-2.0 licensed for commercial and non-commercial use. The core contract, verifier, CLI, adapters, examples, and schemas are intended to remain open so teams and agent vendors can build on a neutral assurance layer.

Commercial work can sit above the open core: hosted evidence collection, policy gates, signed attestations, conformance programs, and implementation support. See [Services](./SERVICES.md) and [Contributor Licensing](./CONTRIBUTOR-LICENSING.md).

<div align="center">

[npm packages](https://www.npmjs.com/search?q=%40aicorg) · [issues](https://github.com/VPAI-Grok/AIC/issues) · [release status](./docs/release-status.md)

</div>
