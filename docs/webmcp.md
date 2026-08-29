# WebMCP with AIC

AIC treats WebMCP as the native browser tool surface. It does not define a competing browser protocol.

> WebMCP describes and invokes the tool. AIC verifies the behavior behind it.

## Compatibility baseline

The current adapter is pinned to:

- WebMCP draft `2026-08-26`;
- imperative `document.modelContext.registerTool(...)`;
- `webmcp-types@0.1.5`; and
- feature-detected progressive enhancement.

WebMCP is experimental and can change. Check the [current specification](https://webmachinelearning.github.io/webmcp/) and [Chrome imperative API documentation](https://developer.chrome.com/docs/ai/webmcp/imperative-api) before updating the pinned baseline.

## Native-first policy

When WebMCP provides a capability, use it directly. Do not preserve a duplicate AIC field merely because AIC implemented it first.

AIC remains responsible for protocol-neutral concerns that must survive WebMCP changes:

- stable business-operation identity;
- shared behavior across human and agent entrypoints;
- executable success, denial, confirmation, failure, and recovery scenarios;
- cross-surface parity checks;
- evidence classification and canonical digests; and
- CI policy and portable proof artifacts.

The current adapter also supplies fail-closed compatibility gates while the browser API is experimental. Those gates can become thinner as native WebMCP matures.

## Architecture

```text
Human UI -----> guards -----> shared domain operation -----> outcome/evidence
                     ^                 ^
                     |                 |
WebMCP tool --> native API + AIC compatibility adapter

AIC behavior contract + harness --------------------------> parity proof
```

The human and WebMCP paths should call the same domain operation. Protocol tool names and UI IDs can differ; both map to one stable AIC `operation_id`.

## Imperative registration

```bash
# In this monorepo
pnpm add @aicorg/webmcp@workspace:*
pnpm add -D webmcp-types@0.1.5

# After the package is included in an npm alpha release
pnpm add @aicorg/webmcp@alpha
```

```tsx
import { useAICWebMCPTool } from "@aicorg/webmcp/react";

const registration = useAICWebMCPTool(
  () => ({
    action: authoredExecutionReadyAction,
    element: checkoutElement,
    registry,
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
    execute: executeCheckoutDomainOperation,
    verify: verifyCheckoutCompletion
  }),
  [registry]
);
```

The adapter returns `unsupported` without breaking the human app when `document.modelContext` is absent. Use `requireSupport: true` only in a controlled WebMCP test environment.

## Current compatibility gates

Registration fails closed when, among other checks:

- the action is not explicitly authored and `execution_ready`;
- action and element targets do not match;
- the input schema is not an object schema;
- completion or failure behavior is placeholder-only;
- a mutating tool has no side effects or completion verifier;
- a high/critical tool lacks authorization;
- a critical action lacks permission or entity scope; or
- confirmation metadata and the human confirmation handler disagree.

Generated actions remain `review_required`; generation alone never enables execution.

These are current adapter policy, not claims that WebMCP itself lacks or will always lack equivalent controls.

## Declarative forms

The React SDK maps explicit properties to the current declarative attributes:

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

AIC suppresses `toolautosubmit` unless the action is low risk and does not require confirmation.

## Readiness commands

```bash
aic scan ./src --webmcp
aic doctor . --webmcp
aic generate webmcp-plan ./src --out-file ./webmcp-plan.json
```

These commands find governed registrations, direct registrations that bypass the current adapter, obsolete API shapes, declarative tools, and risky auto-submit review points. Readiness analysis prepares implementation; it is not executed proof.

## Behavior verification

Create one contract for the business operation and include `human_ui` and `webmcp` surfaces:

```bash
aic validate behavior ./aic-behavior-contract.json
aic verify ./aic-behavior-contract.json \
  --harness ./aic-verification-harness.mjs \
  --out-file ./aic-proof.json
```

For a consequential mutation, cover at least:

- valid success;
- application validation failure;
- authorization denial;
- confirmation acceptance and decline;
- cancellation;
- declared failure and recovery paths;
- completion verification failure;
- unsupported-browser behavior; and
- parity with the human path.

The [checkout reference](../examples/nextjs-checkout-demo/README.md) implements the first success/denial/decline parity slice. See [Behavior Assurance](./behavior-assurance.md) for proof semantics and limitations.

## What AIC should build next

The durable roadmap is not a larger WebMCP wrapper. It is an open conformance ecosystem:

- reusable behavior-contract packs for common business actions;
- browser, MCP, API, and domain-test observation adapters;
- signed and deployment-bound proofs;
- CI policies and verifier compatibility suites;
- a public conformance registry; and
- hosted evidence collection that remains compatible with the open verifier.

This keeps AIC useful even if WebMCP absorbs richer schemas, confirmation, validation, lifecycle, or skill composition.
