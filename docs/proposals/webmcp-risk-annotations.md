# Proposal: risk and confirmation annotations for WebMCP tools

**Status:** draft, not filed. Intended for
[`webmachinelearning/webmcp`](https://github.com/webmachinelearning/webmcp) as a discussion issue.
**Author's interest, stated up front:** we maintain [AIC](https://github.com/VPAI-Grok/AIC), which
implements a userland version of what this proposes. We would rather this live in the platform.

## Summary

A WebMCP tool descriptor can say a tool mutates state. It cannot say the mutation is consequential,
who may perform it, or that a human should confirm it first. Today the only place to express that is
`description` prose, which nothing can enforce or verify.

We propose adding a small number of declarative annotations so a user agent — not each individual
application — can mediate consequential calls.

## Evidence

We scanned every public WebMCP repository we could find
([full data](https://github.com/VPAI-Grok/AIC/blob/main/docs/evidence/webmcp-census.json)):

- 75 tools across 5 applications
- 49 of them mutate state, including `book_table`, `confirm_order`, `submit_order`,
  `delete_bookmark`, `delete_note`, `delete_task`, `apply_coupon`
- 0 express enforceable risk semantics of any kind

Representative, from a well-built storefront demo:

```ts
useWebMCP({
  name: "checkout",
  description:
    "Place the order for everything in the cart. Irreversible. Only call when the user explicitly asks to buy / check out / place the order.",
  annotations: { readOnlyHint: false },
  execute: async () => placeOrder()
});
```

The author knew this was irreversible and said so. The statement is unreachable by any mechanism
other than an LLM reading English and choosing to comply.

## The gap

`annotations` currently carries `readOnlyHint` and `untrustedContentHint`. Both describe the tool's
relationship to *data*. Neither describes its relationship to *consequence*.

`readOnlyHint: false` covers `set_reverb` and `submit_order` identically.

## Sketch

Not attached to a specific spelling — the shape matters more than the names.

```js
document.modelContext.registerTool({
  name: "submit_order",
  description: "Place the order for everything in the cart.",
  inputSchema: { /* ... */ },
  annotations: {
    readOnlyHint: false,
    // NEW: how consequential is a successful call?
    riskHint: "critical",              // "low" | "medium" | "high" | "critical"
    // NEW: does this require human confirmation before execute() runs?
    requiresConfirmation: true,
    confirmationPrompt: "Charge {{order_total}} for order {{order_id}}?"
  },
  execute: async (input, { signal }) => { /* ... */ }
});
```

What a user agent could then do, none of which is possible today:

- surface a consent UI for `requiresConfirmation` tools without the page implementing its own;
- let users set a policy ("always ask above `high`") that applies across every site;
- let an agent decline to call `critical` tools when running unattended;
- let extensions and devtools show which tools on a page are dangerous;
- give prompt-injection defenses a machine-readable signal to act on — the injected instruction
  cannot lower a tool's declared risk.

## Why the platform and not each app

Every application currently reinvents this, if it does it at all — see the four distinct registration
patterns in the census. Userland can add a gate (we did), but userland cannot:

- guarantee the gate exists on a page it does not control;
- present a trustworthy, unspoofable confirmation surface;
- give the user one cross-site policy;
- prevent the page itself from claiming an action is safe when it isn't.

The last point matters most and argues for browser mediation rather than a page-supplied promise.

## Open questions

1. **Is a page-declared risk level trustworthy?** A hostile page will lie. This is the same trust
   posture as `readOnlyHint`, which is also unverifiable — but risk carries more weight, so it may
   need to be advisory-to-the-user-agent rather than authoritative.
2. **Enum or free-form?** A fixed enum is checkable; free-form is expressive. We lean enum.
3. **Confirmation UI ownership.** Browser-owned is trustworthy but inflexible; page-owned is
   flexible but spoofable. A `confirmationPrompt` string rendered by the browser is a middle path.
4. **Relationship to permissions.** Some tools are role-gated rather than risk-gated. Out of scope
   here, but worth not foreclosing.
5. **Does this belong in `annotations` at all,** or as a sibling field? `annotations` currently reads
   as hints to the model; enforcement semantics may deserve their own home.

## What we are not proposing

- No changes to `registerTool`, `getTools`, or `executeTool` signatures.
- No new permission prompts by default. A `riskHint` with no user policy behaves exactly as today.
- Not a competing metadata format. If this lands in WebMCP, the equivalent userland fields in our own
  adapter should be deprecated in its favor.

## Prior art

- MCP tool annotations (`destructiveHint`, `idempotentHint`) cover adjacent ground server-side and
  suggest naming.
- Permissions API — precedent for user-agent-mediated consent with a persisted policy.
- `AIC` — a working userland implementation of gating, confirmation, and published discovery, offered
  as evidence the shape is implementable rather than as the thing to adopt.
