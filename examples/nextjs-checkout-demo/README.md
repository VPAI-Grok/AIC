# Next.js Checkout: WebMCP and AIC Behavior Proof

This is the canonical end-to-end AIC example for a consequential action. It combines explicit React semantics, generated manifests, MCP discovery, native WebMCP registration, a shared checkout domain operation, and protocol-neutral behavior assurance.

## What it demonstrates

- stable AIC IDs, risk, entity, confirmation, execution, validation, recovery, and workflow metadata;
- read-only `get_checkout_summary` and critical `complete_checkout` WebMCP tools;
- progressive fallback when `document.modelContext` is unavailable;
- one `executeCheckoutDomainOperation` used by both human UI and WebMCP paths;
- an `aic.behavior/0.1` contract independent of either entrypoint;
- executed success, authorization-denial, and confirmation-decline scenarios; and
- a deterministic proof that the two surfaces produced equivalent behavior in the local harness.

The proof demonstrates this fixture and harness. It is not a signed or production-bound attestation.

## Key files

| File | Purpose |
|---|---|
| [`app/CheckoutDemoContent.tsx`](./app/CheckoutDemoContent.tsx) | Human UI and WebMCP entrypoints |
| [`app/checkout-operation.mjs`](./app/checkout-operation.mjs) | Shared validation, authorization, and domain operation |
| [`app/checkout-contract.mjs`](./app/checkout-contract.mjs) | AIC interaction metadata and semantic action contracts |
| [`aic-behavior-contract.json`](./aic-behavior-contract.json) | Protocol-neutral requirements and parity scenarios |
| [`aic-verification-harness.mjs`](./aic-verification-harness.mjs) | Trusted local observation collector |
| [`aic-proof.json`](./aic-proof.json) | Generated behavior proof fixture |
| [`aic.project.json`](./aic.project.json) | Project identity, permissions, and workflows |

## Run from the repository root

```bash
pnpm install
pnpm build
pnpm --dir examples/nextjs-checkout-demo run aic:doctor
pnpm --dir examples/nextjs-checkout-demo run aic:generate
pnpm --dir examples/nextjs-checkout-demo run aic:webmcp
pnpm --dir examples/nextjs-checkout-demo run aic:verify
pnpm --dir examples/nextjs-checkout-demo run dev
```

Open [http://localhost:3000](http://localhost:3000).

In a browser without `document.modelContext`, both WebMCP registrations report `unsupported` and the human checkout remains usable. In a compatible browser they report `registered` after the current adapter's authored-readiness gates pass.

## Inspect the proof

```bash
pnpm aic validate behavior ./examples/nextjs-checkout-demo/aic-behavior-contract.json
pnpm aic inspect ./examples/nextjs-checkout-demo/aic-proof.json
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

Use [Adopt AIC in an Existing App](../../docs/adopt-existing-app.md) for an owned application and [Behavior Assurance](../../docs/behavior-assurance.md) before making proof claims.
