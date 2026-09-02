# WebMCP ground truth and AIC mapping (Phase 0)

Verification date: 2026-09-02. Every identifier below is cited to a source file or URL.
Nothing here is inferred from memory.

## 1. Current WebMCP API surface

Source: <https://developer.chrome.com/docs/ai/webmcp/imperative-api> (fetched 2026-09-02),
cross-checked against `packages/webmcp/src/index.ts:9-46` and the espresso store reference
(`src/webmcp/WebMCPTools.tsx`).

| Concern | Exact current value |
|---|---|
| Global object | `document.modelContext` (no `navigator.modelContext` in the imperative docs) |
| Register | `document.modelContext.registerTool(toolConfig, options?)` |
| Discover | `document.modelContext.getTools(options?)` — `options.fromOrigins?: string[]` |
| Invoke (client side) | `document.modelContext.executeTool(tool, inputJson, options?)` |
| Change event | `document.modelContext.addEventListener("toolchange", cb)` |
| Registration options | `{ signal?: AbortSignal; exposedTo?: string[] }` |

Tool descriptor fields:

```js
{
  name: string,
  description: string,
  inputSchema: object,        // JSON Schema
  execute: async (input, { signal }) => string,
  annotations?: { readOnlyHint: boolean, untrustedContentHint: boolean }
}
```

Semantics worth pinning:

- `execute` receives a **parsed object**; `executeTool` takes a **JSON string**. The two sides of
  the API disagree on encoding by design, which is why the browser harness records an input-encoding
  observation (`docs/webmcp.md`, "Native browser evidence": Chrome `152.0.7977.65` records
  `json_string_compat`).
- `execute` returns a **string**, not an MCP-style `content[]` array.
- Annotations are limited to `readOnlyHint` and `untrustedContentHint`. **There is no risk level, no
  confirmation hook, no role/permission field, and no workflow field in the tool descriptor.** This
  absence is the entire AIC value proposition — see section 3.
- Chrome: flag `chrome://flags/#enable-webmcp-testing`; origin trial from Chrome 149; Chrome 153
  fixed unregistration breaking in-flight executions. Local machine has Chrome `152.0.7977.75`.

The repo's pinned baseline (`packages/webmcp/src/index.ts:9-11`) is
`AIC_WEBMCP_DRAFT_BASELINE = "2026-08-26"`, `AIC_WEBMCP_TYPES_BASELINE = "0.1.5"`,
`AIC_WEBMCP_API = "document.modelContext"`. **That baseline is still correct as of today.**

## 2. Reference bed: vincanger/webmcp-espresso-store

Cloned shallow to the session scratchpad (not into this repo, not modified, not to be submitted).

- 16 hand-written tools in `src/webmcp/WebMCPTools.tsx`, enumerated in a `TOOL_META` table
  (`{ name, auth, writes }`) at lines 64-80.
- Annotations are exactly two shared constants: `const readOnly = { readOnlyHint: true }` and
  `const mutating = { readOnlyHint: false }` (lines 59-60).
- Write tools with no risk, confirmation, or permission semantics of any kind:
  `set_compare_list`, `highlight_differences`, `clear_highlights`, `add_to_cart`,
  `update_cart_quantity`, `remove_from_cart`, `apply_coupon`, `checkout`.
- `checkout` carries `readOnlyHint: false` and nothing else. `auth: true` is enforced in app code,
  not declared to the agent.
- Its `.mcp.json` drives the tab through
  `npx -y chrome-devtools-mcp@latest --categoryExperimentalWebmcp --autoConnect --no-usage-statistics`.

**One-line pitch this validates:** a competent WebMCP app with 16 tools declares that `checkout`
mutates. It does not declare that `checkout` is *consequential*, who may call it, what confirmation
it needs, or which workflow it completes.

## 3. AIC to WebMCP mapping (as built)

`document.modelContext` has no field for any of the right-hand AIC concerns, so AIC does not encode
them as tool metadata — it enforces them in the registration gate and the `execute` wrapper.

| AIC concept | Where it lands in WebMCP | Enforcement point |
|---|---|---|
| `agentId` / stable `operation_id` | not a WebMCP field; tool `name` is chosen separately | `target_mismatch` audit finding |
| `agentDescription` | `description` | `tool_description_missing`, `description_budget_exceeded` |
| `agentAction` + declared fields | `inputSchema` (object schema required) | `input_schema_invalid` |
| read-only `agentAction` | `annotations.readOnlyHint: true` | `read_only_side_effect_conflict` |
| `agentRisk: high` | requires an `authorize` handler | `high_risk_authorization_missing` |
| `agentRisk: critical` | requires permission + entity scope | `critical_permission_missing`, `critical_entity_missing` |
| `agentRequiresConfirmation` + `confirmation.prompt_template` | wrapped `execute`, pre-execution | `confirmation_metadata_missing`, `confirmation_handler_missing` |
| mutating action | must declare side effects and a completion verifier | `mutating_side_effects_missing`, `mutating_verification_missing` |
| action provenance | authored + `execution_ready` only | `action_not_authored`, `action_not_execution_ready` |
| permissions / workflows manifests | `/.well-known/agent.json` discovery, not tool metadata | **gap — see section 5** |

Runtime error codes (`packages/webmcp/src/index.ts:124-133`): `authorization_denied`,
`confirmation_declined`, `execution_aborted`, `execution_failed`, `registration_aborted`,
`registration_blocked`, `registration_failed`, `unsupported_browser`, `verification_failed`.

## 4. What already exists in this repo

The challenge plan was written as if `packages/webmcp` were greenfield. It is not.

- `@aicorg/webmcp@0.1.0-alpha.2` is **published to npm under the `alpha` tag**.
- `packages/webmcp/src/index.ts` (624 lines): `auditAICWebMCPTool`, `registerAICWebMCPTool`,
  18 readiness finding codes, 9 error codes, `exposedTo`/`signal`/`requireSupport` support.
- `packages/webmcp/src/react.ts`: `useAICWebMCPTool` hook with full mount/unmount lifecycle.
- `tests/webmcp.test.mjs` (335 lines).
- `examples/nextjs-checkout-demo` registers two real tools via `useAICWebMCPTool`
  (`app/CheckoutDemoContent.tsx:92,187`) and ships executed browser evidence for 5 scenarios
  times 2 surfaces in `aic-browser-evidence/`.
- CLI already supports `aic scan --webmcp`, `aic doctor --webmcp`, `aic generate webmcp-plan`.
- `pnpm check` is green as of this commit.

## 5. Actual remaining gaps

1. **`webmcp` block missing from `/.well-known/agent.json`.** Current top-level keys are
   `spec, manifest_version, generated_at, framework, notes, app, capabilities, endpoints`.
   No `webmcp` key. This must come from the generator, not a hand edit (`AGENTS.md`: "Do not
   hand-edit generated AIC JSON artifacts").
2. **No WebMCP benchmark.** `benchmarks/` contains only `twenty-adoption`.
3. **No espresso-store cross-check artifact** — running `aic scan`/`doctor` against a WebMCP-only
   app is the strongest single demo beat and nothing captures it yet.
4. **No `aic_list_workflows` tool** and no workflow tag in descriptions.
5. **No live deployment** of the checkout demo.
6. No demo video, no Devpost submission.

## 6. Two places the plan conflicts with repo policy

- **Auto-registration from the registry.** The plan's `registerAICTools(options)` would walk the
  runtime registry and register every annotated control. `AGENTS.md` WebMCP Policy says: "Register
  task-level tools only from authored AIC action contracts marked `execution_ready`" and "Never
  expose generated, inferred, AI-suggested, or placeholder action contracts as executable WebMCP
  tools." The shipped explicit-binding API is the policy-compliant design. Building the sweeping
  auto-registrar would contradict the project's own stated rule and weaken the pitch.
- **"Agent Interaction Contract" rename.** The plan calls the current name "title drift". The repo,
  the npm org, and the working directory are all consistently **Agent Interaction Control**. This is
  a rename, not a typo fix, and it would touch published package descriptions. Not doing it without
  an explicit decision.
