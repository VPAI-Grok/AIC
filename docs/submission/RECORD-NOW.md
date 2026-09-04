# Record now — agent-driven cut

All five surfaces confirmed live immediately before this was written.

| Surface | State |
|---|---|
| Espresso store | http://localhost:3000 — **200** |
| Wasp server | http://localhost:3001 — **200** |
| Recording Chrome (CDP) | http://127.0.0.1:9333 — **200**, logged in, 16 tools |
| Vercel demo | https://agentinteractioncontrol.vercel.app/injection — **200** |
| Discovery manifest | https://agentinteractioncontrol.vercel.app/.well-known/agent.json — **200** |

**Target 2:50.** The centrepiece is a real agent calling the tools, not a console paste.

---

## Setup (off camera)

1. **Use the Chrome window that is already open** — the one on the throwaway profile with
   `--remote-debugging-port=9333`. It has the WebMCP flag and is already logged in as vince.
   Do not use your normal Chrome; it does not have the flag.

2. **Second terminal, start the agent.** `claude` is not on PATH on this machine - it ships inside
   Claude Desktop. Add it for the session, then run it:

   ```bash
   $env:PATH = "$env:APPDATA\Claude\claude-code\2.1.258;$env:PATH"
   ```

   ```bash
   cd C:\Users\vatsa\agentinteractioncontrol\examples\espresso-retrofit\agent-harness; claude
   ```

   Run the two lines separately - pasting both at once makes PowerShell join them into one block.

   Approve the `chrome-devtools` server. Set `execute_webmcp_tool` to **always-allow** — otherwise
   you get an approval prompt on every tool call and the take is ruined.

3. **Smoke-test the agent before rolling:**

   > list the WebMCP tools on the current page

   Must return **16**. If it returns 3 you are logged out; if 0, the tab is not on localhost:3000.

4. Terminal font ~18pt. Close notifications.

5. **Screen layout:** agent terminal on the left, Chrome on the right, both visible at once. The
   whole point is watching the browser move while the agent talks.

---

## 0:00 — 0:22 · The sentence

**Screen:** https://github.com/vincanger/webmcp-espresso-store/blob/7dff5af/src/webmcp/WebMCPTools.tsx#L272-L287

> "This is a real WebMCP tool from a real storefront. It charges a card, and the author knew it —
> they wrote 'Irreversible. Only call when the user explicitly asks to buy.'
>
> But a WebMCP tool descriptor has exactly two annotations: `readOnlyHint` and
> `untrustedContentHint`. That warning had nowhere to go except an English sentence. Nothing
> enforces it. No agent can check it before acting."

## 0:22 — 0:42 · The census

**Screen:** the census page — three counts, then the six-row field grid.

> "So we scanned every public WebMCP app we could find. Seventy-five tools. Forty-nine of them
> mutate state — `book_table`, `submit_order`, `delete_note`. Zero can tell an agent they're
> dangerous. Including Google's own demos. Not carelessness. The protocol has no field for it."

## 0:42 — 1:35 · The agent shops **(let it run — do not cut)**

**Screen:** agent terminal + the storefront side by side.

> "That same storefront is running here, with sixteen WebMCP tools. This is Claude Code driving it
> through Chrome DevTools MCP — it discovers the tools itself. I've told it nothing about the app."

**Type into the agent:**

```
Bianca in white, plus a water filter that fits it, and use whatever discount I've got.
```

Let the trace play. `search_products` → `check_compatibility` → `get_my_coupons` → `add_to_cart` ×2
→ `apply_coupon`. The cart drawer opens on its own; total lands at €2,096.01.

> "Five tool calls. It searched, checked the filter actually fits the machine, found my coupon and
> filled the cart — and it never asked me for permission once, because none of that is
> consequential. Applying a coupon moves money, but it's reversible, so we marked it `medium` and it
> runs freely."

## 1:35 — 2:05 · The gate **(the money shot)**

**Type into the agent:**

```
Place the order.
```

The agent calls `checkout`. **The confirmation dialog appears. Click Cancel.**

> "And there it stops. `checkout` is declared `critical`, so it needs a human. I said no."

**Show:** the cart drawer — both items still there. Let the agent report it could not complete.

> "The order was refused and the cart still has everything in it. That's not a polite message from
> the model. That's the database."

**Type again:** `Place the order.` — **this time click OK.**

> "Same agent, same tool, same call. The only thing that changed is that a human agreed. Now the
> order is placed and the cart is empty."

## 2:05 — 2:20 · Two of sixteen

**Screen:** `~/espresso-aic/src/webmcp/aic-contract.ts`

> "We governed two of the sixteen tools and left fourteen exactly as the author wrote them.
> Applying a coupon is `medium` and reversible. Checkout is `critical` and isn't. A layer that
> marked everything critical would be useless — the gradient is the product."

## 2:20 — 2:35 · Where the semantics live

**Screen:** the `agent.json` tab, scrolled to the `webmcp` block.

> "And the risk level isn't buried in our code. It's published in the discovery manifest, so an
> agent can read it *before* it calls anything — risk, required permission, whether a human has to
> confirm. Generated from the app, not hand-written."

## 2:35 — 2:50 · The gift, and close

**Screen:** terminal.

```bash
npx -y @aicorg/cli@alpha scan ./src --webmcp
```

> "One command against any WebMCP app. Sixteen tools, sixteen ungoverned — that's this storefront
> before we touched it.
>
> WebMCP made the web callable by agents. It didn't give a page any way to say *this one charges a
> card*. We think that belongs in the spec, and we've written the proposal. Until then, it's one npm
> install."

**End card:** `github.com/VPAI-Grok/AIC` · `npm i @aicorg/webmcp`

---

## Between takes

A completed checkout consumes the coupon and empties the cart. Reset, then reload the Chrome tab:

```bash
wsl -d Ubuntu-24.04 -- bash -lc 'export DATABASE_URL="postgresql://postgres:espresso@localhost:5432/espresso"; cd ~/espresso-aic && wasp db seed demoReset'
```

## If it misbehaves on camera

| Symptom | Cause |
|---|---|
| Agent sees 0 tools | Tab isn't on localhost:3000, or page still mounting |
| Agent sees 3 tools | Logged out — 13 of 16 are auth-gated |
| "Invalid credentials" | Whitespace from a paste. Type `vince` / `espresso123` by hand |
| Agent connection refused | The port-9333 Chrome window was closed; relaunch per the harness README |
| Approval prompt on every call | `execute_webmcp_tool` isn't set to always-allow |
| Coupon "already used" | Run demoReset above |

If a live run fails mid-take, cut to committed evidence rather than retrying:
`examples/espresso-retrofit/espresso-aic-result.json` (8/8) and `benchmarks/webmcp/report.md`.

## Claims that are safe

- 75 tools / 49 mutating / 0 governed across 5 public apps
- Published `@aicorg/cli@alpha` finds 16 registrations on the espresso store
- Retrofit verified 8/8 in Chrome 152: declined → cart 1→1; approved → order placed, cart 1→0
- Injection benchmark: unsafe completion 100% → 0%, legitimate 100% → 100%

## One claim to avoid

Don't say the benchmark proves agents get tricked less often. It shows the **mechanism holds** when
something attempts the unsafe call — the harness calls tools directly rather than prompting a model.
The narrower claim is true and still lands.

Note the distinction on camera if it comes up: the *espresso* demo is a real agent choosing to call
tools. The *benchmark* is a deterministic harness. Both are honest; they measure different things.
