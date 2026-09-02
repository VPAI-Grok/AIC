# The WebMCP Safety Census

**Every public WebMCP application we could find, scanned for enforceable risk semantics.**

Run date: 2026-09-02 · Raw data: [`webmcp-census.json`](./webmcp-census.json) ·
Reproduce: `node scripts/webmcp-census.mjs <clone-dir> --out-file docs/evidence/webmcp-census.json`

---

## The number

> **75 WebMCP tools across 5 public applications. 49 of them mutate state. Zero can tell an agent
> that they are dangerous.**

Not because their authors were careless. Because WebMCP has nowhere to put it.

## Method

Shallow-cloned every public WebMCP repository discoverable from
[`awesome-webmcp`](https://github.com/leanMCP/awesome-webmcp), the
[spec repo](https://github.com/webmachinelearning/webmcp), and GoogleChromeLabs. Scanned each with
`aic scan <repo> --webmcp`. Applications (which expose tools to agents) are counted separately from
libraries (which implement the registration API) — counting a polyfill's own `registerTool` as an
ungoverned application tool would inflate the result.

| Repository | Kind | Registrations | Governed | Obsolete API | Mutating tool names |
|---|---|---|---|---|---|
| [`GoogleChromeLabs/webmcp-tools`](https://github.com/GoogleChromeLabs/webmcp-tools) | application | 30 | **0** | 0 | 15 |
| [`vincanger/webmcp-espresso-store`](https://github.com/vincanger/webmcp-espresso-store) | application | 16 | **0** | 0 | 6 |
| [`WebMCP-org/examples`](https://github.com/WebMCP-org/examples) | application | 6 | **0** | 18 | 14 |
| [`Leanmcp-Community/music-composer-webmcp`](https://github.com/Leanmcp-Community/music-composer-webmcp) | application | 23 † | **0** | 0 | 18 |
| [`WebMCP-org/chrome-devtools-quickstart`](https://github.com/WebMCP-org/chrome-devtools-quickstart) | application | 0 | 0 | 3 | 2 |
| [`GoogleChromeLabs/use-webmcp-tool`](https://github.com/GoogleChromeLabs/use-webmcp-tool) | library | 1 | 0 | 0 | — |
| [`WebMCP-org/npm-packages`](https://github.com/WebMCP-org/npm-packages) | library | 16 | 0 | 0 | — |
| [`LeanMCP/leanmcp-sdk`](https://github.com/LeanMCP/leanmcp-sdk) | library | 0 | 0 | 0 | — |

† Counted by hand. This app registers through its own runtime singleton that assigns to
`navigator.modelContext`; static scanning cannot attribute those calls to WebMCP without matching
every `.registerTool(` in every codebase. Reported separately rather than silently merged.

**Application totals: 52 statically detected registrations + 23 manually counted = 75 tools.
Governed: 0.**

## Finding 1 — the safety vocabulary is one English sentence

A WebMCP tool descriptor supports exactly two annotations: `readOnlyHint` and
`untrustedContentHint`. There is no field for risk, required permission, confirmation, or workflow.

So when an author knows an action is dangerous, the only place to say so is prose. From the espresso
store:

```ts
useWebMCP({
  name: "checkout",
  description:
    "Place the order for everything in the cart. Irreversible. Only call when the user explicitly asks to buy / check out / place the order.",
  annotations: mutating,   // { readOnlyHint: false }  ← the entire machine-readable safety surface
  execute: async () => placeOrder()
});
```

That sentence is not enforced by the browser, not enforced by the page, not checkable by the agent
before it acts, and not testable in CI. It is honored only if the model chooses to honor it.

These are the 49 mutating tools currently exposed this way:

```
add_bookmark            add_chord               add_item                add_note
add_notes               add_pattern             add_percussion_bar      add_search_result_to_cart
add_task                add_to_cart             add_topping             apply_coupon
apply_smart_filters     book_table              clear_cart              clear_filters
clear_highlights        clear_track             confirm_order           create_event
customize_instrument    delete_bookmark         delete_note             delete_task
humanize_track          remove_from_cart        remove_item             remove_topping
reset_filters           set_compare_list        set_counter             set_delay
set_distortion          set_eq                  set_instrument          set_lfo
set_pan                 set_pizza_size          set_pizza_style         set_reverb
set_tempo               set_time_signature      set_track_volume        submit_order
update_bookmark         update_cart_delivery_option                     update_cart_quantity
update_location         update_task_priority
```

`book_table`, `confirm_order`, `submit_order`, `delete_bookmark`, `delete_note`, `delete_task`,
`apply_coupon` — these reserve, charge, and destroy. To an agent reading the tool list, each is
indistinguishable from `set_reverb` except by reading English.

## Finding 2 — the ecosystem is split across two API surfaces

21 call sites still use `navigator.modelContext.registerTool` while Chrome's imperative API
documentation specifies `document.modelContext`. The split runs through published example code:

- `WebMCP-org/examples` — 18 call sites on `navigator.*` across its Angular, Rails, Phoenix
  LiveView, and vanilla examples, versus 6 on `document.*`
- `WebMCP-org/chrome-devtools-quickstart` — 3 call sites on `navigator.*`

This is expected churn in a young API, not a defect in those repos. It matters here because agents
and tooling must handle both, and because a safety layer that pins only one surface silently misses
the other.

## Finding 3 — at least four registration patterns, and no common governance point

| Pattern | Example |
|---|---|
| Direct `document.modelContext.registerTool` | `GoogleChromeLabs/webmcp-tools` |
| Official React hook (`use-webmcp-tool`) | `vincanger/webmcp-espresso-store` |
| Legacy `navigator.modelContext.registerTool` | `WebMCP-org/examples` |
| App-local runtime shim assigning `navigator.modelContext` | `Leanmcp-Community/music-composer-webmcp` |

There is no single chokepoint where a browser, an extension, or a reviewer could ask *"is this tool
safe to expose?"* Each app answers that question, or doesn't, in its own way.

### This census changed our own tooling

The first run of `aic scan --webmcp` reported **`not_detected`** for the espresso store — an app with
16 live tools — because the scanner matched only literal `document.modelContext.registerTool` calls.
Every tool registered through `use-webmcp-tool`, **GoogleChromeLabs' own official React hook**, was
invisible.

Fixed in `scanSourceForWebMCP`, with regression tests in `tests/webmcp.test.mjs`. Without it, this
census would have reported roughly a third of the tools it actually found.

## What this argues for

WebMCP made the web callable by agents. That part works. What is missing is a way for a page to
state, in a form a machine can check *before* acting, that a particular call is consequential.

Two things follow:

1. **Short term**, applications can publish those semantics beside the tools —
   which is what [`@aicorg/webmcp`](../../packages/webmcp) and the `webmcp` block in
   `/.well-known/agent.json` do, and what the
   [espresso cross-check](./espresso-cross-check.md) contrasts side by side.
2. **Long term**, this probably belongs in the tool descriptor itself. A `riskHint` alongside
   `readOnlyHint`, or a confirmation lifecycle hook, would let the browser mediate rather than
   leaving every app to reinvent it. See [`docs/proposals/webmcp-risk-annotations.md`](../proposals/webmcp-risk-annotations.md).

## Scan any WebMCP app yourself

```bash
npx @aicorg/cli@alpha scan ./src --webmcp
```

No install, no config, no account. It reports every registration it finds, which ones bypass
governance, and which use obsolete API shapes.

## Limitations

- Static analysis. It counts registration *sites*, not tools reachable at runtime; a loop that
  registers from an array counts once.
- The mutation classification is by name prefix (`add_`, `delete_`, `submit_`, …). It is a
  characterization of the sample, not a safety judgment, and it both over- and under-counts.
- "Governed: 0" means *no AIC binding*, which is unsurprising given AIC is the tool doing the
  counting. The load-bearing claim is not "nobody uses AIC" — it is that **no mechanism of any kind,
  AIC or otherwise, exists in these apps to express enforceable risk**, because WebMCP provides no
  field for it. Every app was checked for its own guard rails; none had them.
- Sample is every public repository we could find, not a random sample of deployed sites.
