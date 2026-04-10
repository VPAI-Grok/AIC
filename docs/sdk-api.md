# AIC SDK API

This document describes the current React-first surface that is stable enough for v1 examples and integrations.

## Core Provider

`@aicorg/sdk-react` exposes:

- `AICProvider`
- `useAICRegistry()`
- `useAICElement(...)`
- `createAICComponent(...)`
- `AIC.*` wrapped primitives

`AICProvider` supplies an `AICRegistry` instance to the tree. If no registry is passed, the provider creates one.

For framework-aware client boundaries:

- use `@aicorg/sdk-react/client` in Next.js or other React Server Components-aware apps
- use `@aicorg/sdk-react` in plain client-only React/Vite apps

## Element Annotation Props

The wrapped components and `useAICElement` hook currently revolve around explicit annotation props:

- `agentId`
- `agentDescription`
- `agentAction`
- `agentRisk`
- `agentRequiresConfirmation`

These annotations feed both runtime registration and build-time extraction.

## Wrapped Primitives

The default wrapped primitives are:

- `AIC.Button`
- `AIC.Input`
- `AIC.Select`
- `AIC.Form`
- `AIC.Table`

Compatibility aliases remain available for the earlier naming scheme:

- `AgentProvider`
- `useAgentRegistry`
- `Agent`
- `AICButton`
- `AICInput`
- `AICSelect`

## Runtime Helpers

`@aicorg/runtime` currently exposes:

- `AICRegistry`
- `createAICDataAttributes(...)`

`AICRegistry` is responsible for:

- register / update / unregister
- provenance-aware merging
- runtime manifest serialization
- discovery manifest generation
- permissions manifest generation
- `operate.txt` rendering
- action lifecycle events

## Devtools Bridge

`@aicorg/devtools` adds the development-time surfaces:

- `AICDevtoolsBridge`
- `AICDevtoolsOverlay`
- `useAICInspectorSnapshot(...)`
- `filterAICElements(...)`
- `diffRuntimeUiSnapshots(...)`
- authoring-plan export helpers

The bridge emits live registry snapshots to the extension or overlay. Repo mutation remains outside the extension and goes through the CLI apply flow.

For Next.js or other RSC-aware apps, import bridge/overlay usage from `@aicorg/devtools/client`.

`@aicorg/integrations-shadcn/client` is also available for explicit client-boundary imports when needed, while plain client-only apps can keep using `@aicorg/integrations-shadcn`.

The current integration layer is practical rather than exhaustive:

- `@aicorg/integrations-radix` covers common dialog, dropdown/menu, select, checkbox, switch, tabs, link, form, search, textarea, radio, and entity-action semantics through prop factories
- `@aicorg/integrations-shadcn` mirrors the same control families through thin wrapped components for common owned-app flows

## Extraction Boundaries

The current build-time extraction path is intentionally deterministic:

- string literals
- template literals with static same-file interpolations
- string/number `+` expressions over static same-file values
- no-substitution template literals
- same-file const alias chains
- same-file const object-member reads
- same-file object and array spreads over static same-file values
- same-file zero-arg helpers with a single static return expression

Dynamic expressions are skipped with diagnostics rather than inferred.

## Recommended Usage

Use explicit `agent*` props on critical paths and high-risk actions. Let the runtime registry and plugin scan layer generate artifacts from those annotations. Use devtools and the authoring-plan/apply flow to review or backfill annotations instead of hand-editing generated JSON.

The example apps show the intended depth for v1-owned React apps:

- the Next checkout example covers critical confirmation, async execution plus recovery, validation-bearing inputs, and entity-bound actions
- the Vite CRM example covers confirmation, entity identity, workflow references, validation-bearing operational inputs, and dropdown/select/dialog control semantics via the shadcn wrappers
