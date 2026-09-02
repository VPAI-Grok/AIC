# Cross-check: a WebMCP app with 16 tools and no enforceable risk semantics

**Subject:** [`vincanger/webmcp-espresso-store`](https://github.com/vincanger/webmcp-espresso-store)
at commit `7dff5afd696ce5d143b3b87b7c88c3a8ce60e260` (2026-08-27).
**Date run:** 2026-09-02. **Raw output:** [`espresso-webmcp-scan.json`](./espresso-webmcp-scan.json).

This repository is used here as a **read-only reference and test bed**. Nothing in it was modified,
forked, republished, or submitted. It is a well-built WebMCP application and is cited as a
representative example of the current state of the art, not as a bad one.

## Result

```
aic scan <espresso>/src --webmcp
```

| Metric | Value |
|---|---|
| `files_scanned` | 28 |
| `current_native_registrations` | 16 |
| `direct_native_registrations` | 16 |
| `governed_registrations` | **0** |
| `obsolete_api_usages` | 0 |
| `status` | `review_needed` |

All 16 registrations are current-API and correct. None is bound to an authored, execution-ready
action contract, so none carries a risk level, a required permission, structured confirmation
metadata, an entity scope, or a completion verifier.

## The precise gap

The espresso store's authors clearly understood that `checkout` is dangerous. Here is the actual
registration (`src/webmcp/WebMCPTools.tsx`):

```ts
useWebMCP({
  name: "checkout",
  description:
    "Place the order for everything in the cart. Irreversible. Only call when the user explicitly asks to buy / check out / place the order.",
  inputSchema: emptySchema,
  annotations: mutating,          // { readOnlyHint: false }
  enabled: loggedIn,
  execute: async () => { ... }
});
```

The safety requirement is real and the authors expressed it. But WebMCP gives them exactly one place
to put it: **an English sentence in `description`**. The machine-readable surface — `annotations` —
supports only `readOnlyHint` and `untrustedContentHint`.

So "Irreversible. Only call when the user explicitly asks" is:

- not enforced by the browser;
- not enforced by the page;
- not verifiable by the calling agent before it acts;
- not testable in CI; and
- honored only if the model chooses to honor prose.

The same is true of `auth: true` in the file's local `TOOL_META` table (lines 64-80): that
information exists in the source, is used to render a badge, and is never declared to the agent.

**This is the gap AIC fills.** Not "these authors were careless" — they were not — but "the protocol
has nowhere to put this, so it degrades into a string."

## Side by side

| | espresso `checkout` | AIC-governed `complete_checkout` |
|---|---|---|
| Registration API | `document.modelContext` (via `use-webmcp-tool`) | `document.modelContext` (via `@aicorg/webmcp`) |
| `readOnlyHint` | `false` | `false` |
| Irreversibility | prose in `description` | `risk: "critical"` in `/.well-known/agent.json` |
| Authorization | app-internal `enabled: loggedIn` | `authorize` handler; registration blocked without one |
| Confirmation | none | `requires_confirmation: true` + `prompt_template`, enforced pre-execution |
| Permission | `auth: true` in a local display table | `requires_permission: "checkout.submit_order"`, published |
| Post-execution check | none | `verify` handler; `verification_failed` on mismatch |
| Discoverable before calling | no | yes, via the `webmcp` block in `/.well-known/agent.json` |

## Detector fix this exercise produced

The first run of `aic scan --webmcp` against this repo returned `status: "not_detected"` with zero
registrations — on an app with 16 live tools.

Cause: the detector matched only literal `document.modelContext.registerTool` call expressions.
The espresso store — like most real WebMCP apps — registers through a community React wrapper
(`import { useWebMCP } from "use-webmcp-tool"`). Every one of its tools was invisible to AIC.

`scanSourceForWebMCP` now also recognizes registrations made through known wrapper modules
(`use-webmcp-tool`, `use-webmcp`, `@mcp-b/react-webmcp`, `@mcp-b/webmcp`, `webmcp-react`) and counts
them as current-but-ungoverned. Regression tests: `tests/webmcp.test.mjs`, "source readiness detects
third-party WebMCP wrapper registrations" and "source readiness does not count governed AIC bindings
as ungoverned".

Without this fix, AIC's readiness scan would have reported "no WebMCP integration" for a large
fraction of the real WebMCP ecosystem.
