# Adopt AIC In An Existing App

Use this when you already have a React, Next.js, or Vite app and want the shortest path to an AIC-ready slice.

This is the canonical adopter path for the current repo.

## Scope

Supported today:

- owned React apps
- owned Next.js apps
- owned Vite apps
- explicit `agent*` metadata in source

Not the target for this guide:

- third-party sites
- zero-touch inference
- non-React stacks

## 1. Install The CLI

Outside this repo:

```bash
npx @aicorg/cli@alpha init ./my-app
```

Inside this repo:

```bash
pnpm aic init ./my-app
```

That scaffolds:

- `aic.project.json`
- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `.github/copilot-instructions.md`
- `.cursor/rules/aic.mdc`

## 2. Mount AIC In The App

### React / Vite

```tsx
import { AICProvider } from "@aicorg/sdk-react";

export function AppShell() {
  return (
    <AICProvider>
      <App />
    </AICProvider>
  );
}
```

### Next.js App Router

```tsx
import { AICProvider } from "@aicorg/sdk-react/client";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AICProvider>{children}</AICProvider>
      </body>
    </html>
  );
}
```

In development, mount devtools next to the provider when useful:

```tsx
import { AICDevtoolsBridge } from "@aicorg/devtools/client";
```

If you want the visual inspector overlay in a plain client app, install and mount:

```tsx
import { AICDevtoolsOverlay } from "@aicorg/devtools";
```

## 3. Annotate One Real Flow

Start with a risky or business-critical control, not every button on the page.

```tsx
<button
  agentId="checkout.submit_order"
  agentAction="submit"
  agentDescription="Completes checkout and charges the selected payment method"
  agentRisk="critical"
  agentRequiresConfirmation
  agentConfirmation={{
    type: "human_review",
    prompt_template: "Charge {{payment_method}} for {{order_total}} and submit order {{order_id}}?",
    summary_fields: ["order_total", "payment_method"]
  }}
>
  Submit order
</button>
```

For entity-scoped actions, add identity:

```tsx
<button
  agentId="invoice.archive.inv_123"
  agentAction="click"
  agentDescription="Archives the selected invoice"
  agentRisk="high"
  agentEntityId="inv_123"
  agentEntityType="invoice"
  agentEntityLabel="Invoice #123"
>
  Archive invoice
</button>
```

Add richer metadata where the app already knows it:

- `agentWorkflowStep`
- `agentValidation`
- `agentExecution`
- `agentRecovery`

## 4. Keep The Project Config Honest

`aic.project.json` should describe the app identity and any top-level permissions/workflows you want generated.

Minimum fields to review after `init`:

- `appName`
- `framework`
- `viewId`
- `viewUrl`

## 5. Run The Review Loop

Outside this repo:

```bash
npx @aicorg/cli@alpha doctor ./my-app
npx @aicorg/cli@alpha scan ./my-app/src
npx @aicorg/cli@alpha generate project ./my-app/aic.project.json --out-dir ./my-app/public
npx @aicorg/cli@alpha inspect ./my-app/public/report.json
```

Inside this repo:

```bash
pnpm aic doctor ./my-app
pnpm aic scan ./my-app/src
pnpm aic generate project ./my-app/aic.project.json --out-dir ./my-app/public
pnpm aic inspect ./my-app/public/report.json
```

What good looks like:

- `doctor` has no errors
- generated UI/actions/permissions/workflows are current
- the report has no onboarding or extraction surprises you want to block on

Optional backfill loop for partially annotated apps:

```bash
npx @aicorg/cli@alpha bootstrap https://demo.example --captures-file ./captures.json --review-file ./bootstrap-review.json
npx @aicorg/cli@alpha generate authoring-plan ./runtime-snapshot.json --report ./my-app/public/report.json --bootstrap-review ./bootstrap-review.json
npx @aicorg/cli@alpha apply authoring-plan ./aic-authoring-plan.json --project-root ./my-app --write
```

Use that flow when you want AI-suggested review bundles and guarded source edits, but keep authored metadata as the final source of truth.

## 6. Prove Consequential Multi-Surface Behavior

If a critical operation is available through both the human UI and WebMCP, MCP, or an API, route those entrypoints to one domain operation and define an `aic.behavior/0.1` contract.

```bash
aic validate behavior ./aic-behavior-contract.json
aic verify ./aic-behavior-contract.json \
  --harness ./aic-verification-harness.mjs \
  --out-file ./aic-proof.json
```

Cover success, denial, confirmation decline, declared failures, recovery, and required parity in proportion to the action's risk. See [Behavior Assurance](./behavior-assurance.md).

The conformance, protocol-evidence, policy, interoperability, transparency, and key-transition commands below are implemented in this repository and targeted for the next npm alpha wave. Use the workspace CLI here; outside the monorepo, use them only after that release is verified as published.

## 7. Apply A Reusable Conformance Profile

For checkout, billing mutation, account deletion, admin mutation, or record CRUD, inspect the matching versioned pack and author an explicit mapping from its obligations to the real contract:

```bash
aic conformance list
aic conformance show aic.pack.checkout

aic conformance bind aic.pack.checkout complete \
  ./aic-behavior-contract.json ./aic-conformance-mapping.json \
  --out-file ./aic-conformance-binding.json

aic conformance verify aic.pack.checkout \
  ./aic-conformance-binding.json ./aic-behavior-contract.json \
  --proof ./aic-proof.json \
  --out-file ./aic-conformance-result.json
```

Review the mapping as application semantics. Digest binding detects later substitution of the pack, profile, contract, or mapping; it does not prove that the mapping was correct and it is not certification. See [Conformance Packs](./conformance-packs.md).

## 8. Collect Portable Evidence

Use the adapter that matches the real surface:

- `@aicorg/evidence-playwright` for rendered human UI and native WebMCP;
- `@aicorg/evidence-http` for bounded HTTP/OpenAPI observations; and
- `@aicorg/evidence-mcp` for MCP observations.

All adapters emit the same protocol-neutral observation model. Evidence plans and remote jobs are data-only and must declare exact projections. Validate them before collection:

```bash
aic validate evidence-plan ./aic-evidence-plan.json
aic validate remote-job ./aic-remote-job.json
```

For separately hosted production collection, use the open remote-runner package with an exact deployment identity and no mutation grants unless the observation genuinely requires a canary-scoped mutation:

```bash
aic evidence run-remote ./aic-remote-job.json \
  --runner-id independent.example.runner \
  --runner-revision 0123456789abcdef0123456789abcdef01234567 \
  --out-file ./aic-evidence-bundle.json

aic evidence verify ./aic-evidence-bundle.json \
  --runner-public-key ./runner-public.pem \
  --runner-key-id sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

Mutation is denied by default, requires both job and operator grants for the exact operation and canary, and is never retried after an uncertain outcome. The package is independently operable, but AIC does not currently operate an independent hosted runner. A signature proves control of the pinned runner key, not who operated it. See [Protocol Evidence and Remote Observation](./evidence-adapters.md).

## 9. Bind High-Value Claims

For a proof you intend other systems to rely on, collect rendered browser or remote evidence, bind the passed proof to the exact origin/deployment/revision, and sign it with a protected issuer key.

```bash
aic trust attest ./aic-behavior-contract.json ./aic-browser-proof.json \
  --private-key "$AIC_ISSUER_PRIVATE_KEY_FILE" \
  --origin https://app.example.com \
  --environment production \
  --deployment-id deploy_001 \
  --source-revision 0123456789abcdef0123456789abcdef01234567 \
  --issuer-id example.release \
  --runner-id production-evidence \
  --runner-kind remote \
  --out-file ./checkout-attestation.json
```

Consumers should verify with a separately pinned trust store and explicit origin/revision expectations. See [AIC Verified Trust Layer](./trust-layer.md). A signature proves the issuer's exact claim, not independent production reachability.

## 10. Apply Consumer Assurance Policy

Evaluate reliance with a fail-closed consumer policy after the observations, regenerated proof, conformance result, and any required signed attestation are available. The evaluator regenerates the proof from raw observations, applies every matching rule cumulatively, and rejects unmatched operations:

```bash
aic policy evaluate ./policies/production-critical.json \
  ./aic-behavior-contract.json ./aic-proof.json \
  --observations ./aic-observations.json \
  --attestation ./checkout-attestation.json \
  --trust-store ./consumer-trust-store.json \
  --environment production \
  --expect-origin https://app.example.com \
  --expect-revision 0123456789abcdef0123456789abcdef01234567 \
  --out-file ./aic-policy-result.json
```

For production reliance, pin allowed issuer, key, and runner identities in addition to a runner kind. See [Assurance Policy](./assurance-policy.md).

## 11. Maintain Reference History And Scheduled Keys

If a relying workflow needs a portable local history, create and verify the signed reference transparency index:

```bash
aic transparency init --log-id example.transparency \
  --private-key ./log-private.pem \
  --out-file ./transparency-index.json

aic transparency verify ./transparency-index.json \
  --trust-store ./log-trust-store.json
```

The index is an offline/reference linear hash chain, not a globally witnessed public log. External receipt references are bound as metadata but remain `not_checked` until a provider-specific verifier checks them.

For planned issuer-key maintenance, prepare and verify a transition signed by both the retiring and successor keys:

```bash
aic trust rotate prepare \
  --prior-trust-store ./trust-store.json \
  --retiring-private-key ./old-private.pem \
  --successor-private-key ./new-private.pem \
  --issuer-id example.release \
  --transition-id rotate-2026-09 \
  --effective-at 2026-09-01T00:00:00.000Z \
  --retire-at 2026-09-08T00:00:00.000Z \
  --next-trust-store ./trust-store.next.json \
  --transition-out ./key-transition.json

aic trust transition verify \
  --prior-trust-store ./trust-store.json \
  --next-trust-store ./trust-store.next.json \
  --transition ./key-transition.json
```

Use scheduled rotation only for a healthy retiring key. Suspected compromise requires revocation and an out-of-band recovery decision. See [Transparency and Key Rotation](./transparency-and-key-rotation.md).

Third-party verifier authors can run `aic interop verify <suite> --out-file <result>` against the portable canonical JSON, digest, signature, registry, and stable-code vectors. Normal app adoption does not require authoring a new compatibility suite.

## 12. Connect An Agent

For MCP-compatible tools like Claude Desktop or Cursor:

```json
{
  "mcpServers": {
    "aic": {
      "command": "npx",
      "args": ["-y", "@aicorg/mcp-server"]
    }
  }
}
```

Then the agent can read:

- discovery
- UI state
- actions
- permissions
- workflows

If your app is already protected by an auth layer like Auth0, keep AIC auth-agnostic and let the authenticated app session protect access to manifests and APIs. See [Auth0 for AI Agents with AIC](./auth0-ai-agents.md).

## Copyable Starter Paths

- Next.js starter: [examples/nextjs-checkout-demo](../examples/nextjs-checkout-demo)
- Vite starter: [examples/react-basic](../examples/react-basic)
- MCP setup: [docs/mcp-server.md](./mcp-server.md)
- Coding-agent onboarding: [docs/coding-agents.md](./coding-agents.md)

## Done Criteria

You are done with the first slice when:

- one real workflow is explicitly annotated
- risky actions have confirmation metadata
- entity-scoped actions have entity identity
- `doctor` has no errors
- generated artifacts are current
- an agent can resolve the slice through AIC instead of guessing from text or selectors
- consequential multi-surface actions have passing behavior scenarios and required parity evidence
- applicable conformance profiles pass against a reviewed digest-bound mapping
- consumer policy regenerates proof from observations, matches at least one rule, and passes every applicable rule
- externally relied-on claims are signed, deployment-bound, and verified against pinned issuer, key, runner, origin, and revision expectations as required
- remote evidence is described as independent only when a genuinely separate operator controlled the run and key

Expected output after the first slice:

- a valid `aic.project.json`
- onboarding files for coding agents
- current discovery/UI/actions/permissions/workflows artifacts
- an MCP-readable contract for the workflow you instrumented
- a reviewed behavior contract and proof when the workflow has multiple execution surfaces
- an optional conformance binding/result and assurance-policy result for consequential operations
- an optional verified evidence bundle for HTTP/OpenAPI, MCP, rendered browser, or remotely observed surfaces
- an optional signed trust claim and well-known registry for consumers that need deployment-bound verification
- optional reference transparency and scheduled key-transition artifacts when the relying workflow needs them
