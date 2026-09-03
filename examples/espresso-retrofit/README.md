# Retrofitting a real WebMCP app

**Subject:** [`vincanger/webmcp-espresso-store`](https://github.com/vincanger/webmcp-espresso-store) —
a Wasp 0.25 coffee-equipment storefront with 16 hand-written WebMCP tools, a product catalog, cart,
coupons and order history.

**Used with the author's permission.** The repository carries no LICENSE file; the author has
confirmed it is free to use and modify. Nothing here is redistributed — this directory holds the
changed files and the verification harness, not a fork.

**Result:** `passed` — 8/8 checks against Google Chrome 152.0.7977.75 with native
`document.modelContext`. Raw output: [`espresso-aic-result.json`](./espresso-aic-result.json).

---

## Why this and not our own demo

Our checkout example registers two tools against a fixed fake order. That is enough to prove a gate
fires, and not enough to show anyone what governance feels like in an app with real state. This one
has 31 seeded products, a working cart, a coupon a user actually owns, and an order table — so
"checkout was blocked" is observable as *the cart still has items in it*.

## What was changed

Three files, plus two dependencies.

| Change | Detail |
|---|---|
| `src/webmcp/aic-contract.ts` | New. Action contracts and element manifests for the two governed tools. |
| `src/webmcp/WebMCPTools.tsx` | `checkout` and `apply_coupon` swapped from `useWebMCP` to `useAICWebMCPTool`. The other 14 registrations are untouched. |
| `src/App.tsx` | `<WebMCPTools />` wrapped in `<AICProvider>`. |
| `.npmrc` | `min-release-age-exclude` for the `@aicorg/*` scope — see below. |
| `package.json` | `@aicorg/webmcp` and `@aicorg/sdk-react`. |

### 2 of 16, deliberately

| Tool | Risk | Confirmation | Verified by |
|---|---|---|---|
| `checkout` | `critical` | required | `orderId` returned, and the cart is empty afterwards |
| `apply_coupon` | `medium` | none | the returned cart carries the requested coupon code |
| the other 14 | — | — | left exactly as the author wrote them |

The gradient is the point. `apply_coupon` moves money and is reversible; `checkout` charges and is
not. A layer that marked all 16 critical would be unusable, and AIC's own policy is to govern
task-level operations rather than every control.

Both governed tools call the **same** Wasp operation the human UI calls — `placeOrder` and
`applyCoupon` from `wasp/client/operations`. The retrofit adds a gate in front of the agent path; it
does not fork the domain logic.

### The verify assertions are real

`placeOrder` (`src/server/cart.ts:283`) returns `{ orderId, totalCents }`, creates the `Order` and
its items, marks the coupon used, and deletes every `CartItem` for the user. So the declared
postcondition — *order created and cart emptied* — is checkable against what the operation actually
returns and does, rather than asserted.

## Verification

```bash
# in WSL, with Postgres running
cd ~/espresso-aic && wasp db seed demoReset && wasp start

# from the repo
node examples/espresso-retrofit/verify-espresso-aic.mjs http://localhost:3000
```

| Check | Result |
|---|---|
| all 16 tools still register | pass |
| both governed tools present | pass |
| untouched read-only tool still works | pass |
| cart seeded through the ungoverned `add_to_cart` | pass |
| `apply_coupon` (governed, medium) succeeds | pass |
| **`checkout` with confirmation declined → refused, cart lines 1 → 1** | pass |
| confirmation prompt came from the AIC contract, no unrendered placeholders | pass |
| **`checkout` with confirmation approved → order #4, €404.10, cart 1 → 0** | pass |

The last two rows are the demonstration: same tool, same page, same browser, same agent call. The
only variable is whether a human said yes.

Re-run `wasp db seed demoReset` between runs — a successful checkout consumes the `BARISTA10`
coupon, so a second run without a reset will correctly fail `apply_coupon`.

## Two things this surfaced that a toy demo would not

**Their supply-chain guard blocked us, correctly.** The repo ships `min-release-age=7` in `.npmrc`,
so npm refused `@aicorg/*` packages published hours earlier. Rather than removing the author's
protection we appended `min-release-age-exclude` naming only the four AIC packages. Brand-new
packages are invisible to well-run projects, which is a real adoption cost worth knowing about.

**Governed and ungoverned tools return different shapes.** The community `use-webmcp-tool` hook wraps
results in an MCP `{ content: [{ type: "text", text }] }` envelope; the AIC adapter returns the
payload directly. On a page with both, a caller has to handle both — see `parseToolResult` in the
harness. Worth fixing in the adapter for envelope parity.

## Setup notes

Wasp 0.25 needs Linux or macOS — the `@wasp.sh/wasp-cli` npm package declares `os: [linux, darwin]`,
so on Windows it runs under WSL2. Postgres was installed via apt rather than Docker, which the
project's README assumes; `DATABASE_URL` is set explicitly instead of using `wasp start db`.

`wasp db migrate-dev --name init` will hang on a repo that already has a migration — it waits on an
interactive prompt that never arrives when stdin is redirected. Use
`prisma migrate deploy --schema .wasp/out/db/schema.prisma` instead, then seed through Wasp.
