# Record now — verified working 2026-09-03

Everything below was run end-to-end minutes before you started. Ports are live, demo state is reset.

| Surface | State |
|---|---|
| Espresso store (WSL) | http://localhost:3000 — **200**, demo state reset |
| Wasp server | http://localhost:3001 — **200** |
| Vercel demo | https://agentinteractioncontrol.vercel.app/injection — **200** |
| Published CLI | `@aicorg/cli@alpha` = `0.1.0-alpha.4`, finds **16** on espresso |
| Espresso retrofit | **8/8 pass** in Chrome 152 |

---

## Before you hit record

1. **Chrome with the flag.** `chrome://flags/#enable-webmcp-testing` → Enabled → Relaunch.
   Sanity check in DevTools console: `'modelContext' in document` must print `true`.
2. **Terminal font to ~18pt.** Small text is the most common demo-video failure.
3. **Tabs, left to right:**
   - `http://localhost:3000` (espresso store)
   - `https://agentinteractioncontrol.vercel.app/injection`
   - `https://agentinteractioncontrol.vercel.app/.well-known/agent.json`
   - a terminal in `C:\Users\vatsa\agentinteractioncontrol`
4. **Log into espresso before recording**, so the login isn't on camera.

   **Type these by hand — do not copy-paste.** A leading or trailing space returns
   "Invalid credentials" (the server rejects `vince ` with a 401 while `vince` succeeds).
   Username is not case-sensitive; whitespace is.

       username:  vince
       password:  espresso123

5. Close notifications.

**If you stop and re-record**, reset the espresso state first — a successful checkout consumes the
coupon and empties the cart:

```bash
wsl -d Ubuntu-24.04 -- bash -lc 'export DATABASE_URL="postgresql://postgres:espresso@localhost:5432/espresso"; cd ~/espresso-aic && wasp db seed demoReset'
```

---

## 0:00 — 0:25 · The sentence

**Screen:** the espresso store's `checkout` registration. Open
`~/espresso-aic/src/webmcp/WebMCPTools.tsx` or show it from the GitHub page. Highlight `description`.

> "This is a real WebMCP tool from a real storefront. It charges a card. The author knew that — they
> wrote 'Irreversible. Only call when the user explicitly asks to buy.'
>
> But a WebMCP tool descriptor has exactly two annotations: `readOnlyHint` and
> `untrustedContentHint`. That warning had nowhere to go except an English sentence. Nothing
> enforces it."

## 0:25 — 0:45 · The census

**Screen:** the census page. Scroll the three counts, then the six-row field grid.

> "So we scanned every public WebMCP app we could find. Seventy-five tools. Forty-nine of them mutate
> state — `book_table`, `submit_order`, `delete_note`. Zero can tell an agent they're dangerous.
>
> Including Google's own demos. Not carelessness — the protocol has no field for it."

## 0:45 — 1:35 · The real store **(the money shot)**

**Screen:** `http://localhost:3000`, logged in as vince. Show the catalog, add a grinder to the cart,
open the cart drawer so the item is visibly there.

> "This is that same storefront, running. Sixteen WebMCP tools. We governed two of them and left
> fourteen exactly as the author wrote them."

**Action:** open DevTools console and paste:

```js
await document.modelContext.executeTool("checkout", "{}")
```

The AIC confirmation dialog appears. **Click Cancel.**

> "Checkout is declared `critical`, so it needs a human. I said no."

**Action:** open the cart drawer again — the item is still there.

> "The order was refused and the cart still has my grinder in it. That's not a message, that's the
> state of the database."

**Action:** run the same line again. **Click OK this time.**

> "Same tool. Same page. Same call. The only thing that changed is that a human said yes — and now
> the order is placed and the cart is empty."

## 1:35 — 1:50 · The gradient

**Screen:** `~/espresso-aic/src/webmcp/aic-contract.ts`, show both risk levels.

> "Not everything that mutates is critical. Applying a coupon moves money but is reversible, so it's
> `medium` with no gate. Checkout charges and can't be undone, so it's `critical` and confirmed.
> Fourteen read-only tools were left completely alone."

## 1:50 — 2:10 · Where the semantics live

**Screen:** the `agent.json` tab, scroll to the `webmcp` block.

> "The risk level isn't buried in our code. It's published in the discovery manifest, so an agent can
> read it *before* it calls anything — risk, required permission, whether a human has to confirm.
> Generated from the app, not hand-written."

## 2:10 — 2:30 · The gift

**Screen:** terminal. Run it live:

```bash
npx -y @aicorg/cli@alpha scan "C:/Users/vatsa/AppData/Local/Temp/claude/C--Users-vatsa-agentinteractioncontrol/9abca969-8e36-4592-b88c-cba6f252c61d/scratchpad/census-espresso/src" --webmcp
```

Expect `"current_native_registrations": 16`, `"governed_registrations": 0`.

> "One command, no install, works on any WebMCP app. Sixteen tools, sixteen ungoverned — that's the
> storefront before we touched it."

## 2:30 — 2:45 · Close

**Screen:** the census field grid, the four `✗` rows.

> "WebMCP made the web callable by agents. It didn't give a page any way to say *this one charges a
> card*. We think that belongs in the spec — we've written a proposal. Until then, it's one npm
> install."

**End card:** `github.com/VPAI-Grok/AIC` · `npm i @aicorg/webmcp`

---

## If something misbehaves on camera

- **`modelContext is undefined`** → the flag isn't on, or you're in the wrong Chrome profile.
- **"Invalid credentials" on login** → whitespace from a paste. Type `vince` / `espresso123` by
  hand. Verified: the server returns 200 for `vince` and 401 for `vince ` with a trailing space.
- **`executeTool` throws immediately** → you're logged out; espresso gates tools on login.
- **Coupon errors "already used"** → run the demoReset command above.
- **Anything else** → cut to the committed evidence rather than retrying live:
  `examples/espresso-retrofit/espresso-aic-result.json` (8/8) and
  `benchmarks/webmcp/report.md`.

## Claims that are safe to make

Every one of these is backed by committed output:

- 75 tools / 49 mutating / 0 governed across 5 public apps
- Published `@aicorg/cli@alpha` finds 16 registrations on the espresso store
- Espresso retrofit: 8/8 in Chrome 152, declined → cart 1→1, approved → order placed, cart 1→0
- Injection benchmark: unsafe completion 100% → 0%, legitimate completion 100% → 100%

## One claim to avoid

Don't say the benchmark shows agents get tricked less often. It shows the **mechanism holds** when
something attempts the unsafe call — the harness calls tools directly rather than prompting a model.
The narrower claim is the true one and is still strong.
