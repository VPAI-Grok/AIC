# Deploying the demo

The example is a pnpm-workspace Next.js app that depends on `workspace:*` packages, so it must be
built from the repository root, not from the example directory.

## Vercel

`vercel.json` at the repository root already sets the build, install, output directory, and the
JSON content-type headers for the discovery manifests. You should not need to configure anything in
the dashboard.

From the repository root:

```bash
npx vercel login
```

then:

```bash
npx vercel --prod
```

Accept the defaults when it asks to link a project; the root directory must stay `.` (the repository
root), **not** the example directory — the example depends on `workspace:*` packages that only
resolve from the root.

### If you configure it by hand instead

| Setting | Value |
|---|---|
| Root directory | `.` |
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm --filter "@aicorg/example-nextjs-checkout-demo..." build` |
| Output directory | `examples/nextjs-checkout-demo/.next` |
| Node version | 20.x or newer |

Two details that will bite otherwise:

- **The filter goes before `build`, not after.** `pnpm build --filter X` passes `--filter` through to
  `tsc`, which fails with `TS5023: Unknown compiler option '--filter'`. Verified the hard way.
- **The trailing `...` is load-bearing.** It builds the example *and its workspace dependencies*.
  Without it the example builds against missing `dist` output.

## After deploying, check these three URLs

1. `LIVE_URL/` — the checkout demo renders
2. `LIVE_URL/injection` — both panels present, counters at 0
3. `LIVE_URL/.well-known/agent.json` — contains the `webmcp` block with
   `"risk": "critical"` on `complete_checkout`

If (3) 404s, confirm `public/.well-known/agent.json` is committed — some deploy configs ignore
dotfile directories.

## Make WebMCP real for visitors: the origin trial

Without this, a visitor in ordinary Chrome falls back to the page's labelled compatibility shim. It
works and it is honest, but "real WebMCP, no flags" is a materially better demo.

1. Register the deployed origin for the **WebMCP origin trial** at
   <https://developer.chrome.com/origintrials> (the trial is open from Chrome 149; confirm it is
   still running before relying on it).
2. Add the token to `examples/nextjs-checkout-demo/app/layout.tsx`:

```tsx
export const metadata = {
  other: { "origin-trial": "YOUR_TOKEN_HERE" }
};
```

3. Redeploy, open in ordinary Chrome, and confirm the page shows **"Native WebMCP"** in the teal
   banner rather than the amber compatibility notice.

A token is bound to one origin. Register the production domain, not a preview URL — Vercel preview
deployments get generated hostnames the token will not cover.

## Sanity check from a phone

Open the live URL on a phone before submitting. The injection page is responsive, but the two panels
stack, and it is worth seeing that the counters are still legible.
