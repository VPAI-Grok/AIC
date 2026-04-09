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

## 6. Connect An Agent

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

If your app is already protected by an auth layer like Auth0, keep AIC auth-agnostic and let the authenticated app session protect access to manifests and APIs. See [Auth0 For AI Agents With AIC](/mnt/c/users/vatsa/agentinteractioncontrol/docs/auth0-ai-agents.md).

## Copyable Starter Paths

- Next.js starter: [examples/nextjs-checkout-demo](/mnt/c/users/vatsa/agentinteractioncontrol/examples/nextjs-checkout-demo)
- Vite starter: [examples/react-basic](/mnt/c/users/vatsa/agentinteractioncontrol/examples/react-basic)
- MCP setup: [docs/mcp-server.md](/mnt/c/users/vatsa/agentinteractioncontrol/docs/mcp-server.md)
- Coding-agent onboarding: [docs/coding-agents.md](/mnt/c/users/vatsa/agentinteractioncontrol/docs/coding-agents.md)

## Done Criteria

You are done with the first slice when:
- one real workflow is explicitly annotated
- risky actions have confirmation metadata
- entity-scoped actions have entity identity
- `doctor` has no errors
- generated artifacts are current
- an agent can resolve the slice through AIC instead of guessing from text or selectors

Expected output after the first slice:
- a valid `aic.project.json`
- onboarding files for coding agents
- current discovery/UI/actions/permissions/workflows artifacts
- an MCP-readable contract for the workflow you instrumented
