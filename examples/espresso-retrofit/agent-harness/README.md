# Driving the retrofit with a real agent

You were right that a DevTools console paste is me play-acting an agent. This is the real thing: a
separate Claude Code session with no knowledge of the app, discovering the WebMCP tools through
`chrome-devtools-mcp` and calling them itself.

**Verified working 2026-09-03.** Chrome 152.0.7977.75 on debugging port 9333 reports
`modelContext present: true` and **16 tools** once logged in.

## The Chrome window is already open and logged in

Launched with the WebMCP flag *and* remote debugging, on a dedicated profile so it does not touch
your normal browsing:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9333 `
  --user-data-dir="$env:TEMP\chrome-webmcp-demo2" `
  --enable-features=WebMCPTesting,DevToolsWebMCPSupport `
  --no-first-run --no-default-browser-check `
  http://localhost:3000
```

Port **9333**, not the usual 9222 — two existing Chrome instances already hold 9222 on this machine
and the conflict makes `/json/version` return 404.

Confirm it is alive before recording:

```bash
curl -s http://127.0.0.1:9333/json/version
```

## Start the agent

In a **second terminal**:

```bash
cd examples/espresso-retrofit/agent-harness
claude
```

The `.mcp.json` here connects Claude Code to that Chrome. Approve the `chrome-devtools` server when
prompted, and set `execute_webmcp_tool` to always-allow so approvals do not interrupt the take.

Check the agent can see the page:

> list the WebMCP tools available on the current page

Expect 16, including `checkout` and `apply_coupon`.

## The two prompts

These are the espresso author's own scripted prompts from their README, so the traces are known.

### Prompt 1 — the agent shops, and stops short of buying

> Bianca in white, plus a water filter that fits it, and use whatever discount I've got.

Expected trace: `search_products` → `check_compatibility` → `get_my_coupons` → `add_to_cart` ×2 →
`apply_coupon` — and **no `checkout`**. The cart drawer opens by itself; total lands at €2,096.01
after the BARISTA10 discount.

Nothing is gated here. `apply_coupon` is governed at `medium` risk and runs without a prompt, because
it is reversible. That is the point of the risk gradient — governance is not a speed bump on
everything.

### Prompt 2 — the agent tries to buy, and hits the gate

> Place the order.

The agent calls `checkout`. **The AIC confirmation dialog appears.**

- **Click Cancel** → the call is refused and the cart still holds both items. The agent reports it
  could not complete the order.
- **Run it again, click OK** → the order is placed and the cart empties.

Same tool, same agent, same call. The only variable is whether a human agreed.

## Why this is the shot worth having

The agent is genuinely autonomous up to the moment money moves. It searched, checked compatibility,
found a coupon and filled a cart without asking permission for any of it — because none of those are
consequential. Then it hit one tool that declares `risk: critical`, and stopped.

That is the argument: not "agents are dangerous", but "the page should be able to say which of its
own actions need a person, and today it cannot."

## Between takes

A completed checkout consumes the coupon and empties the cart:

```bash
wsl -d Ubuntu-24.04 -- bash -lc 'export DATABASE_URL="postgresql://postgres:espresso@localhost:5432/espresso"; cd ~/espresso-aic && wasp db seed demoReset'
```

Then reload the Chrome tab so the client re-reads state.

## If the agent cannot see the tools

- **0 tools** → the tab is not on `localhost:3000`, or the page has not finished mounting.
- **3 tools** → you are logged out. 13 of the 16 are gated on auth. Log in as `vince` /
  `espresso123`, typed by hand — a pasted trailing space returns "Invalid credentials".
- **connection refused** → the Chrome window with `--remote-debugging-port=9333` was closed. Relaunch
  with the command above.

## Security note

`--remote-debugging-port` opens a control channel any local process can attach to. It is on a
throwaway profile here and should be closed after recording.
