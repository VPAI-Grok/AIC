# WebMCP With AIC

AIC treats WebMCP as a complementary browser execution layer, not a competing contract system.

> WebMCP exposes task-level browser tools. AIC governs whether those tools are safe, correctly scoped, verifiable, and ready to execute.

## Compatibility Baseline

This implementation is pinned to:

- WebMCP draft: `2026-08-26`
- imperative API: `document.modelContext.registerTool(...)`
- official TypeScript declarations: `webmcp-types@0.1.5`
- browser behavior: feature-detected progressive enhancement

WebMCP remains an experimental Community Group proposal and can change. Review the [current specification](https://webmachinelearning.github.io/webmcp/) and [Chrome imperative API documentation](https://developer.chrome.com/docs/ai/webmcp/imperative-api) before changing the pinned baseline.

## Product Policy: Support, Enhance, or Prepare

When a WebMCP request appears, classify it as one or more of:

1. **Support** — use the current native API, feature detection, official types, lifecycle cancellation, and secure origin exposure.
2. **Enhance** — bind native tools to AIC risk, permission, confirmation, entity, workflow, validation, execution, recovery, and audit metadata.
3. **Prepare** — produce a readiness report and implementation plan when the app is not ready for safe tool registration.

Do not build a competing browser protocol, generic polyfill, or replacement hook ecosystem inside AIC.

## Architecture

```text
Human UI ---------------------> shared application/domain function
                                     ^
                                     |
WebMCP -> AIC guard -> validate -> authorize -> confirm
                                     |
                                     v
                         execute -> verify -> audit/UI update
```

The human and WebMCP paths must reuse the same domain operation. A WebMCP-only mutation path can drift away from human validation and is not considered AIC-ready.

AIC manifests and the read-only AIC MCP server remain useful for static discovery, headless consumers, unsupported browsers, and richer semantics that WebMCP does not carry.

## Imperative Tools

Install the adapter and official draft types:

```bash
# Inside this monorepo
pnpm add @aicorg/webmcp@workspace:*

# After the next npm alpha release
pnpm add @aicorg/webmcp@alpha
pnpm add -D webmcp-types@0.1.5
```

The package is implemented and release-ready in this repository. Do not describe it as published until the npm alpha release succeeds.

Use `registerAICWebMCPTool` directly or the React lifecycle helper:

```tsx
import { useAICWebMCPTool } from "@aicorg/webmcp/react";

const state = useAICWebMCPTool(
  () => ({
    action: authoredExecutionReadyAction,
    element: criticalCheckoutElement,
    tool: {
      name: "complete_checkout",
      description: "Complete the displayed checkout after authorization and confirmation.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { order_id: { type: "string" } },
        required: ["order_id"]
      },
      annotations: { readOnlyHint: false }
    },
    validate: validateCheckoutInput,
    authorize: authorizeCheckout,
    confirm: requestHumanConfirmation,
    execute: completeCheckout,
    verify: verifyCheckoutCompletion,
    registry
  }),
  [registry, completeCheckout]
);
```

The adapter returns `unsupported` without failing when `document.modelContext` is unavailable. Use `requireSupport: true` only in a controlled WebMCP test environment.

## Registration Gates

Registration fails closed when any blocker is present:

- action contract is not explicitly `execution_ready`
- execution readiness is inferred or AI-suggested instead of authored
- action target and AIC element do not match
- input schema is not an object schema
- completion signal or failure modes are placeholders
- mutating tool has no side effects or verifier
- high/critical tool has no authorization callback
- critical tool lacks permissions or entity identity
- confirmation-gated tool lacks structured metadata or a human confirmation handler
- read-only annotation conflicts with declared side effects

Generated action contracts are intentionally marked `review_required` and cannot pass these gates.

## Declarative Forms

The React SDK maps explicit props to the current declarative WebMCP attributes:

```tsx
<AIC.Form
  agentId="catalog.search"
  agentRisk="low"
  webMCPToolName="search_products"
  webMCPToolDescription="Search the product catalog"
  webMCPToolAutoSubmit
>
  <AIC.Input
    agentId="catalog.search.query"
    agentRisk="low"
    webMCPParamDescription="Words to search for"
  />
</AIC.Form>
```

This emits `toolname`, `tooldescription`, `toolparamdescription`, and, when safe, `toolautosubmit`. AIC suppresses `toolautosubmit` unless the action is low risk and does not require confirmation.

## CLI Readiness

```bash
aic scan ./src --webmcp
aic doctor . --webmcp
aic generate webmcp-plan ./src --out-file webmcp-plan.json
```

The scanner detects:

- governed `@aicorg/webmcp` registrations
- current direct `document.modelContext.registerTool` calls that bypass AIC
- obsolete `navigator.modelContext` and `provideContext` usage
- declarative tools and auto-submit review points

`aic doctor --webmcp` adds the WebMCP report to the ordinary AIC doctor result. A blocked WebMCP report produces a non-zero exit code.

## Verification

Minimum verification for a mutating tool:

- schema and application validation tests
- authorization denial test
- confirmation accept and decline tests
- cancellation test
- success and declared failure-mode tests
- completion-verifier failure test
- lifecycle disposal test
- unsupported-browser test
- parity test proving the human and tool paths use the same domain function

The checkout reference implementation lives in [`examples/nextjs-checkout-demo`](../examples/nextjs-checkout-demo/README.md). It registers a live read-only `get_checkout_summary` tool and a separately governed critical `complete_checkout` tool.

## Services Ready To Deliver

### WebMCP Readiness Audit

Inventory tool candidates, current/obsolete API usage, dangerous exposure, form auto-submit, browser constraints, and missing AIC contracts.

### WebMCP Implementation Sprint

Implement task-level imperative or declarative tools, feature detection, shared domain execution, and the first browser verification flow.

### Safety And Governance Hardening

Add AIC authorization, entity scope, confirmation, side effects, completion verification, recovery, and audit behavior to existing WebMCP tools.

### Compatibility And Regression Maintenance

Track draft and browser changes, update the pinned compatibility baseline after review, and run regression/evaluation suites against supported browsers.

These services focus on consequential business-flow assurance. Generic hooks, polyfills, inspectors, and baseline tool-call evaluation already have upstream and ecosystem implementations.
