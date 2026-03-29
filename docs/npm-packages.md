# npm Packages

This repo is preparing an alpha npm release for the core `@aicorg/*` packages.

## Planned Alpha Publish Wave

| Package | Purpose |
| --- | --- |
| `@aicorg/spec` | Manifest types, validators, and diff helpers |
| `@aicorg/runtime` | Runtime registry and manifest serialization |
| `@aicorg/sdk-react` | React SDK for explicit AIC annotations |
| `@aicorg/automation-core` | Deterministic scanning, artifact generation, init, and doctor helpers |
| `@aicorg/cli` | `aic` command-line interface |
| `@aicorg/plugin-vite` | Vite scanning and artifact generation helpers |
| `@aicorg/plugin-next` | Next.js scanning and artifact generation helpers |
| `@aicorg/integrations-radix` | Radix UI helper factories |
| `@aicorg/integrations-shadcn` | shadcn/ui wrapper components |
| `@aicorg/ai-bootstrap` | Bootstrap prompt and review tooling |
| `@aicorg/ai-bootstrap-http` | Generic HTTP bootstrap provider adapter |
| `@aicorg/ai-bootstrap-openai` | OpenAI bootstrap provider adapter |

## Deferred From The First npm Wave

- `@aicorg/devtools`
  Remains repo-only for now because its extension-shell packaging needs a separate release story.
- `examples/*`
  Stay private as demos, proof surfaces, and test fixtures.

## Install Targets After The First Alpha Publish

Core runtime and React adoption:

```bash
pnpm add @aicorg/spec @aicorg/runtime @aicorg/sdk-react
```

CLI-driven onboarding and artifact generation:

```bash
pnpm add -D @aicorg/cli
```

Framework and integration helpers:

```bash
pnpm add @aicorg/plugin-vite @aicorg/plugin-next @aicorg/integrations-radix @aicorg/integrations-shadcn
```

Bootstrap providers:

```bash
pnpm add @aicorg/ai-bootstrap @aicorg/ai-bootstrap-http @aicorg/ai-bootstrap-openai
```

## Release Notes

- The first npm release is intended to use an alpha tag.
- Workspace examples and deferred packages are intentionally not published.
- Package tarballs are validated with local smoke tests before any publish step runs in CI.
