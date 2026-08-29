# Next.js Checkout: WebMCP, Browser Evidence, and AIC Verified

This is the canonical end-to-end AIC example for a consequential action. It combines explicit React semantics, generated manifests, MCP discovery, native WebMCP registration, a shared checkout domain operation, and protocol-neutral behavior assurance.

## What it demonstrates

- stable AIC IDs, risk, entity, confirmation, execution, validation, recovery, and workflow metadata;
- read-only `get_checkout_summary` and critical `complete_checkout` WebMCP tools;
- progressive fallback when `document.modelContext` is unavailable;
- one `executeCheckoutDomainOperation` used by both human UI and WebMCP paths;
- an `aic.behavior/0.1` contract independent of either entrypoint;
- executed success, authorization-denial, and confirmation-decline scenarios;
- a deterministic domain proof;
- a real Chrome proof that drives rendered human controls and native `document.modelContext` tools; and
- digest-addressed screenshot evidence plus `/.well-known/aic-trust` registry discovery.

The checked-in browser proof demonstrates this local fixture in Chrome `152.0.7977.65`. The CI workflow additionally creates a revision-bound signed claim and GitHub provenance bundle. Neither is independent proof that a production deployment is live.

## Key files

| File | Purpose |
|---|---|
| [`app/CheckoutDemoContent.tsx`](./app/CheckoutDemoContent.tsx) | Human UI and WebMCP entrypoints |
| [`app/checkout-operation.mjs`](./app/checkout-operation.mjs) | Shared validation, authorization, and domain operation |
| [`app/checkout-contract.mjs`](./app/checkout-contract.mjs) | AIC interaction metadata and semantic action contracts |
| [`aic-behavior-contract.json`](./aic-behavior-contract.json) | Protocol-neutral requirements and parity scenarios |
| [`aic-verification-harness.mjs`](./aic-verification-harness.mjs) | Trusted local observation collector |
| [`aic-proof.json`](./aic-proof.json) | Generated behavior proof fixture |
| [`aic-browser-verification-harness.mjs`](./aic-browser-verification-harness.mjs) | Real rendered UI and native WebMCP collector |
| [`aic-browser-observations.json`](./aic-browser-observations.json) | Six browser observations with environment and screenshot references |
| [`aic-browser-proof.json`](./aic-browser-proof.json) | Passed native browser parity proof |
| [`aic-browser-evidence/`](./aic-browser-evidence/) | Screenshot evidence with recorded SHA-256 digests |
| [`aic.project.json`](./aic.project.json) | Project identity, permissions, and workflows |

## Run from the repository root

```bash
pnpm install
pnpm build
pnpm --dir examples/nextjs-checkout-demo run aic:doctor
pnpm --dir examples/nextjs-checkout-demo run aic:generate
pnpm --dir examples/nextjs-checkout-demo run aic:webmcp
pnpm --dir examples/nextjs-checkout-demo run aic:verify
pnpm --dir examples/nextjs-checkout-demo run aic:verify:browser
pnpm --dir examples/nextjs-checkout-demo run dev
```

Open [http://localhost:3000](http://localhost:3000).

In a browser without `document.modelContext`, both WebMCP registrations report `unsupported` and the human checkout remains usable. In a compatible browser they report `registered` after the current adapter's authored-readiness gates pass.

## Inspect the proof

```bash
pnpm aic validate behavior ./examples/nextjs-checkout-demo/aic-behavior-contract.json
pnpm aic inspect ./examples/nextjs-checkout-demo/aic-proof.json
pnpm aic inspect ./examples/nextjs-checkout-demo/aic-browser-proof.json
```

Expected summary:

```text
Status: passed
Evidence: executed
Scenarios: 3/3 passed
Observations: 6/6
Findings: 0
```

The behavior test suite also mutates the WebMCP success outcome and asserts that both outcome conformance and parity fail.

The browser-evidence test recomputes every screenshot digest and verifies that each native WebMCP observation records `document.modelContext`, the exact browser version, and the actual draft argument encoding.

## Discovery endpoints

With the app running:

- `/aic-proof` returns the deterministic proof;
- `/aic-browser-proof` returns the native browser proof;
- `/aic-browser-observations` returns the raw observation set; and
- `/.well-known/aic-trust` returns the open registry artifact.

The checked-in registry is intentionally empty until a real issuer claim is added. CI-generated signed claims and trust stores are uploaded with the workflow evidence bundle rather than committed with an unsafe private key.

## Readiness versus proof

These commands are intentionally different:

```bash
pnpm --dir examples/nextjs-checkout-demo run aic:webmcp
pnpm --dir examples/nextjs-checkout-demo run aic:webmcp-plan
pnpm --dir examples/nextjs-checkout-demo run aic:qa-readiness
pnpm --dir examples/nextjs-checkout-demo run aic:qa-plan
pnpm --dir examples/nextjs-checkout-demo run aic:verify
```

- WebMCP readiness finds source and compatibility gaps.
- QA readiness measures interaction-metadata coverage.
- `aic verify` evaluates actual supplied observations against behavior scenarios.
- `aic trust verify` separately validates who signed exact proof/deployment bindings.

## MCP discovery simulation

With the dev server running:

```bash
node ./examples/nextjs-checkout-demo/simulate-mcp-client.mjs
```

The script uses the same handlers as `@aicorg/mcp-server` and writes `mcp-simulation-result.json`. For real stdio transport verification, run:

```bash
pnpm smoke:mcp:stdio
```

Override the app URL with `AIC_BASE_URL` when needed.

## Adoption path

Use [Adopt AIC in an Existing App](../../docs/adopt-existing-app.md) for an owned application, [Behavior Assurance](../../docs/behavior-assurance.md) for proof semantics, and [AIC Verified Trust Layer](../../docs/trust-layer.md) before making signed-claim or deployment claims.
