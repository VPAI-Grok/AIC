# Agent Interaction Control: Vite CRM Demo

This is the canonical Vite starter for AIC interaction metadata. It demonstrates shadcn-style integration, runtime manifests, devtools surfaces, and generated project artifacts.

It does not currently ship a behavior contract. Use the [Next.js checkout example](../nextjs-checkout-demo/README.md) when you need human/WebMCP parity proof.

If you are adopting AIC into an existing app instead of exploring this starter, use [Adopt AIC in an Existing App](../../docs/adopt-existing-app.md).

## Getting Started

1. Install dependencies from the repository root:
   ```bash
   pnpm install
   ```

2. Generate AIC artifacts:
   ```bash
   pnpm --dir examples/react-basic run aic:generate
   ```

3. Audit readiness:
   ```bash
   pnpm --dir examples/react-basic run aic:doctor
   ```

4. Start the app:
   ```bash
   pnpm --dir examples/react-basic run dev
   ```

## Useful Commands

```bash
pnpm aic --help
pnpm --dir examples/react-basic run aic:doctor
pnpm --dir examples/react-basic run aic:generate
pnpm --dir examples/react-basic run aic:inspect
```

These commands prove generated metadata and readiness, not executed business behavior. Add an `aic.behavior/0.1` contract and run `aic verify` for consequential actions exposed through multiple surfaces. See [Behavior Assurance](../../docs/behavior-assurance.md).
