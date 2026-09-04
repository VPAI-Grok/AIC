# Record now — agent-driven cut

All five surfaces confirmed live immediately before this was written.

| Surface | State |
|---|---|
| Espresso store | http://localhost:3000 — **200** |
| Wasp server | http://localhost:3001 — **200** |
| Recording Chrome (CDP) | http://127.0.0.1:9333 — **200**, logged in, 16 tools |
| Vercel demo | https://agentinteractioncontrol.vercel.app/injection — **200** |
| Discovery manifest | https://agentinteractioncontrol.vercel.app/.well-known/agent.json — **200** |
| Census page | https://claude.ai/code/artifact/a4bc346e-19be-434b-b135-415b2fa6c4c5 — private until shared |

**Target 2:55.** Opens on the live store so a judge knows what they are looking at within five
seconds, then a real agent calls the tools — not a console paste.

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

   **Approve the `chrome-devtools` server.** A project-scoped `.mcp.json` is not loaded until you
   do. Verify with `/mcp` — it must show as connected. If it isn't, the agent has no browser tools
   and will tell you it can't go shopping.

   Set `execute_webmcp_tool` to **always-allow**. **Deny `handle_dialog`** — that tool lets the
   agent answer its own confirmation prompt, which would defeat the entire demo.

3. **Smoke-test the agent before rolling:**

   > list the WebMCP tools on the current page

   Must return **16**. If it returns 3 you are logged out; if 0, the tab is not on localhost:3000.

4. Close notifications.

5. **Screen layout.** This display is 1707px wide, so true side-by-side leaves the terminal too
   narrow for the agent's tool-call output. Instead: **Chrome full width, agent terminal as a
   floating strip over the bottom third.** The storefront gets the full width for the cart drawer
   opening, which is the visual payoff, while the agent's trace scrolls underneath. Terminal font
   ~14pt — at 1080p that reads fine when a viewer full-screens the video.

6. **OBS:** one **Display Capture** source, 1920x1080, 30fps, MP4. Not Window Capture — the
   confirmation dialog is tab-modal and Window Capture can miss it. Set start/stop **hotkeys**;
   you have one monitor, so OBS will be buried behind the demo.

7. **Test-record 20 seconds** and play it back before the real take. Check three things: the confirm
   dialog is visible, your mic actually recorded, terminal text is legible.

---

## 0:00 — 0:15 · Open

**Screen:** the live storefront on localhost:3000, catalog visible, cart empty. Let it sit for a
beat before you speak.

> "This is a coffee equipment store — a real open-source demo app. It exposes sixteen tools to AI
> agents using WebMCP, the new browser API that lets a page tell an agent what it can do.
>
> In about a minute I'm going to turn an agent loose on it and let it spend my money. First, here's
> the problem we found. This is AIC — Agent Interaction Control."

Say the project name here. It is the only place in the video a judge reliably catches it.

## 0:15 — 0:33 · The sentence

**Screen:** https://github.com/vincanger/webmcp-espresso-store/blob/7dff5af/src/webmcp/WebMCPTools.tsx#L272-L287

> "Here's the checkout tool from that store. It charges a card, and the author knew it — they wrote
> 'Irreversible. Only call when the user explicitly asks to buy.'
>
> But a WebMCP tool descriptor has exactly two annotations: `readOnlyHint` and
> `untrustedContentHint`. That warning had nowhere to go except an English sentence. Nothing
> enforces it. No agent can check it before acting."

## 0:33 — 0:50 · The census

**Screen:** the census page — https://claude.ai/code/artifact/a4bc346e-19be-434b-b135-415b2fa6c4c5
The three counts, then the six-row field grid.

It is **private** until you share it. Fine for recording; share it before putting the link on
Devpost. Fallback if it misbehaves: `docs/evidence/webmcp-census.md` in the repo.

> "So we scanned every public WebMCP app we could find. Seventy-five tools. Forty-nine of them
> mutate state — `book_table`, `submit_order`, `delete_note`. Zero can tell an agent they're
> dangerous. Including Google's own demos. Not carelessness — the protocol has no field for it."

## 0:50 — 1:40 · The agent shops **(let it run — do not cut)**

**Screen:** agent terminal over the storefront.

> "So let's watch that happen. This is Claude Code driving the store through Chrome DevTools MCP. It
> discovers the tools itself — I've told it nothing about the app."

**Type into the agent:**

```
Using the WebMCP tools on the current page, do this for me: Bianca in white, plus a water filter that fits it, and use whatever discount I've got.
```

Name the page tools explicitly — a bare shopping request reads as off-topic for a coding session and
gets declined.

Let the trace play: `search_products` → `check_compatibility` → `get_my_coupons` → `add_to_cart` ×2
→ `apply_coupon`. The cart drawer opens on its own; total lands at €2,096.01.

> "Five tool calls. It searched, checked the filter actually fits the machine, found my coupon and
> filled the cart — and it never once asked my permission, because none of that is consequential.
> Applying a coupon moves money, but it's reversible, so we marked it `medium` and it runs freely."

## 1:40 — 2:10 · The gate **(the money shot)**

**Type into the agent:**

```
Now place the order using the checkout tool.
```

The agent calls `checkout`. **The confirmation dialog appears. Click Cancel.**

> "And there it stops. `checkout` is declared `critical`, so it needs a human. I said no."

**Show:** the cart drawer — both items still there. Let the agent report it could not complete.

> "The order was refused and the cart still has everything in it. That's not a polite message from
> the model. That's the database."

**Type again:** `Now place the order using the checkout tool.` — **this time click OK.**

> "Same agent, same tool, same call. The only thing that changed is that a human agreed. Now the
> order is placed and the cart is empty."

## 2:10 — 2:24 · Two of sixteen

**Screen:** `~/espresso-aic/src/webmcp/aic-contract.ts`

> "We governed two of the sixteen tools and left fourteen exactly as the author wrote them. Applying
> a coupon is `medium` and reversible. Checkout is `critical` and isn't. A layer that marked
> everything critical would be useless — the gradient is the product."

## 2:24 — 2:38 · Where the semantics live

**Screen:** the `agent.json` tab, scrolled to the `webmcp` block.

> "And the risk level isn't buried in our code. It's published in the discovery manifest, so an
> agent can read it *before* it calls anything — risk, required permission, whether a human has to
> confirm. Generated from the app, not hand-written."

## 2:38 — 2:55 · Close

**Screen:** terminal, then hold on the end card.

```bash
cd C:\demo
```

```bash
npx -y @aicorg/cli@alpha scan ./espresso-store --webmcp
```

The pristine espresso source is copied to `C:\demo\espresso-store` so the command reads cleanly on
camera. Verified output: `current_native_registrations: 16`, `governed_registrations: 0`.
`./src` on its own only works if you are already inside a project that has one.

> "One command against any WebMCP app. Sixteen tools, sixteen ungoverned — that's this store before
> we touched it.
>
> WebMCP made the web callable by agents. It didn't give a page any way to say *this one charges a
> card*. We think that belongs in the spec, and we've written the proposal. Until then, it's one npm
> install.
>
> That's AIC. Thanks for watching."

**End card, hold 4 seconds:**

```
AIC — Agent Interaction Control
github.com/VPAI-Grok/AIC
npm i @aicorg/webmcp
```

---

## Between takes

A completed checkout consumes the coupon and empties the cart. Reset, then reload the Chrome tab:

```bash
wsl -d Ubuntu-24.04 -- bash -lc 'export DATABASE_URL="postgresql://postgres:espresso@localhost:5432/espresso"; cd ~/espresso-aic && wasp db seed demoReset'
```

## If it misbehaves on camera

| Symptom | Cause |
|---|---|
| Agent says it has no browser access | `chrome-devtools` MCP server not approved. Run `/mcp` |
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
