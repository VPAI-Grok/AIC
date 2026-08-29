# npm Packages

The core `@aicorg/*` packages are now published to npm under the `alpha` tag.

## Published Alpha Wave

| Package | Purpose |
| --- | --- |
| `@aicorg/spec` | Published interaction manifest types and validators |
| `@aicorg/runtime` | Runtime registry and manifest serialization |
| `@aicorg/sdk-react` | React SDK for explicit AIC annotations |
| `@aicorg/automation-core` | Published deterministic scanning, generation, and readiness analysis |
| `@aicorg/cli` | Published onboarding, generation, validation, and inspection commands |
| `@aicorg/plugin-vite` | Vite scanning and artifact generation helpers |
| `@aicorg/plugin-next` | Next.js scanning and artifact generation helpers |
| `@aicorg/integrations-radix` | Radix UI helper factories |
| `@aicorg/integrations-shadcn` | shadcn/ui wrapper components |
| `@aicorg/ai-bootstrap` | Bootstrap prompt and review tooling |
| `@aicorg/ai-bootstrap-http` | Generic HTTP bootstrap provider adapter |
| `@aicorg/ai-bootstrap-openai` | OpenAI bootstrap provider adapter |
| `@aicorg/devtools` | Browser devtools bridge, overlay, and inspector helpers |
| `@aicorg/mcp-server` | MCP server exposing AIC manifests to AI agents |

## Deferred From The First npm Wave

- `examples/*`
  Stay private as demos, proof surfaces, and test fixtures.

## Next Alpha Wave

`@aicorg/webmcp`, `@aicorg/evidence-playwright`, and the behavior/trust additions to `@aicorg/spec`, `@aicorg/automation-core`, and `@aicorg/cli` are implemented in the repository. They are not claimed as published until the next npm alpha release completes.

The next wave adds protocol-neutral behavior artifacts, deterministic and native-browser parity proof generation, `aic.trust/0.1` signed claims and registries, and the related CLI commands. The verifier and trust engine remain in `@aicorg/automation-core`; browser collection is the focused `@aicorg/evidence-playwright` package.

## Install Targets

### Most Common: Existing App Adoption

For a React, Next.js, or Vite app that you own:

```bash
pnpm add @aicorg/spec @aicorg/runtime @aicorg/sdk-react
pnpm add -D @aicorg/cli
```

Add framework helpers if you want project generation and scanning support:

```bash
pnpm add @aicorg/plugin-vite @aicorg/plugin-next
```

### Runtime And React SDK

```bash
pnpm add @aicorg/spec @aicorg/runtime @aicorg/sdk-react
```

### WebMCP Browser Tools

```bash
# Inside this monorepo
pnpm add @aicorg/webmcp@workspace:*

# After the next npm alpha release
pnpm add @aicorg/webmcp@alpha
pnpm add -D webmcp-types@0.1.5
```

Use this only for explicit task-level tools. Generated and inferred AIC contracts remain review-only and cannot be registered by the adapter.

### Native Browser Evidence

```bash
# Inside this monorepo
pnpm add -D @aicorg/evidence-playwright@workspace:*

# After the next npm alpha release
pnpm add -D @aicorg/evidence-playwright@alpha
```

The package launches Chromium-family browsers, inspects native `document.modelContext`, safely probes draft argument encoding through a confirmed read-only tool, and executes consequential tools once with explicit evidence metadata.

### CLI-Driven Onboarding And Artifact Generation

```bash
pnpm add -D @aicorg/cli
```

### Framework And Integration Helpers

```bash
pnpm add @aicorg/plugin-vite @aicorg/plugin-next @aicorg/integrations-radix @aicorg/integrations-shadcn
```

### Devtools And Inspector Helpers

```bash
pnpm add @aicorg/devtools
```

### MCP Consumer Path

For AI-agent integration without changing your app runtime dependencies:

```bash
npx @aicorg/mcp-server
```

### Bootstrap Providers

```bash
pnpm add @aicorg/ai-bootstrap @aicorg/ai-bootstrap-http @aicorg/ai-bootstrap-openai
```

## Release Notes

- The current npm release uses the `alpha` tag.
- Workspace examples and deferred packages are intentionally not published.
- Package tarballs are validated with local smoke tests before any publish step runs in CI.
- `@aicorg/devtools` is part of the publishable alpha package surface.
