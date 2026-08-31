# npm Packages

All 24 reviewed `@aicorg/*` packages are published to npm under the `alpha` tag. Registry downloads, exact dist-tags, integrity metadata, and SLSA provenance were independently verified after [Publish Packages run 33408392192](https://github.com/VPAI-Grok/AIC/actions/runs/33408392192) completed from source revision `e52df5f9e8e742034960f06d3bbfa22f34492a0f` on August 31, 2026.

The `alpha` tag resolves to `0.1.0-alpha.2` for every package except `@aicorg/devtools`, which resolves to `0.1.0-alpha.1`.

## Published Alpha Packages

| Package | Purpose |
| --- | --- |
| `@aicorg/spec` | Interaction manifest types and validators |
| `@aicorg/runtime` | Runtime registry and manifest serialization |
| `@aicorg/sdk-react` | React SDK for explicit AIC annotations |
| `@aicorg/automation-core` | Deterministic scanning, generation, and readiness analysis |
| `@aicorg/cli` | Onboarding, generation, validation, and inspection commands |
| `@aicorg/plugin-vite` | Vite scanning and artifact generation helpers |
| `@aicorg/plugin-next` | Next.js scanning and artifact generation helpers |
| `@aicorg/integrations-radix` | Radix UI helper factories |
| `@aicorg/integrations-shadcn` | shadcn/ui wrapper components |
| `@aicorg/ai-bootstrap` | Bootstrap prompt and review tooling |
| `@aicorg/ai-bootstrap-http` | Generic HTTP bootstrap provider adapter |
| `@aicorg/ai-bootstrap-openai` | OpenAI bootstrap provider adapter |
| `@aicorg/devtools` | Browser devtools bridge, overlay, and inspector helpers |
| `@aicorg/mcp-server` | MCP server exposing AIC manifests to AI agents |
| `@aicorg/webmcp` | Guarded native `document.modelContext` registration for authored, execution-ready tools |
| `@aicorg/evidence-core` | Data-only evidence plans, strict projections, deployment identities, receipts, and bundle verification |
| `@aicorg/evidence-http` | Fail-closed HTTP and OpenAPI observation collection |
| `@aicorg/evidence-mcp` | Stateless MCP `2026-07-28` observation collection with an injected caller |
| `@aicorg/evidence-playwright` | Rendered human-UI and native WebMCP browser evidence |
| `@aicorg/runner-remote` | Self-hostable, data-only remote evidence execution with exact mutation grants |
| `@aicorg/conformance-packs` | Versioned checkout, billing mutation, account deletion, admin mutation, and record CRUD profiles |
| `@aicorg/verify-core` | Minimal trust, proof, policy, and transparency verification without scanner/compiler runtime dependencies |
| `@aicorg/rely` | Local consumer-owned assurance evaluation with mandatory exact artifact/request assertions and policy-derived deadlines |
| `@aicorg/reliance-server` | Read-only, exportable, mirrorable assurance-record discovery with optional local evaluation |

This alpha extends `@aicorg/spec`, `@aicorg/automation-core`, and `@aicorg/cli` with behavior and trust artifacts, cumulative assurance policy, compatibility vectors, signed reference transparency checkpoints, scheduled dual-signed key transitions, canonical reliance decisions and resolver records, and `aic rely evaluate`. The open remote-runner and resolver packages can be operated by separate parties, but AIC does not currently operate or claim an independent hosted runner, public resolver, or resolver mirror.

Workspace examples remain private demos, proof surfaces, and test fixtures rather than published packages.

## Install Targets

### Most Common: Existing App Adoption

For a React, Next.js, or Vite app that you own:

```bash
pnpm add @aicorg/spec@alpha @aicorg/runtime@alpha @aicorg/sdk-react@alpha
pnpm add -D @aicorg/cli@alpha
```

Add framework helpers if you want project generation and scanning support:

```bash
pnpm add @aicorg/plugin-vite@alpha @aicorg/plugin-next@alpha
```

### Runtime And React SDK

```bash
pnpm add @aicorg/spec@alpha @aicorg/runtime@alpha @aicorg/sdk-react@alpha
```

### WebMCP Browser Tools

```bash
pnpm add @aicorg/webmcp@alpha
pnpm add -D webmcp-types@0.1.5
```

Use this only for explicit task-level tools. Generated and inferred AIC contracts remain review-only and cannot be registered by the adapter.

### Native Browser Evidence

```bash
pnpm add -D @aicorg/evidence-playwright@alpha
```

The package launches Chromium-family browsers, inspects native `document.modelContext`, safely probes draft argument encoding through a confirmed read-only tool, and executes consequential tools once with explicit evidence metadata.

### Protocol Evidence Adapters

```bash
pnpm add @aicorg/evidence-core@alpha @aicorg/evidence-http@alpha @aicorg/evidence-mcp@alpha
```

Evidence plans are data, not executable plugins. HTTP/OpenAPI and MCP adapters validate their inputs, capture only declared projections, and emit protocol-neutral observations for proof regeneration.

### Conformance Packs

```bash
pnpm add @aicorg/conformance-packs@alpha
```

Pack selection does not certify an application. The application supplies a reviewed mapping from its authored contract to a versioned profile, and AIC binds the pack, profile, contract, and mapping digests before verification.

### Self-Hosted Remote Evidence Runner

```bash
pnpm add @aicorg/runner-remote@alpha
```

The runner accepts only validated data-only jobs, revalidates public-network targets and redirects, denies mutation by default, and requires exact operation/canary grants. Installing or self-hosting the package does not establish operator independence.

### Assurance, Interoperability, Transparency, And Rotation

The validators live in `@aicorg/spec`. The minimal trust, proof-regeneration, assurance-policy, and transparency verifier lives in `@aicorg/verify-core`, so reliance consumers do not load or install the scanner/compiler toolchain. Compatibility-suite, key-transition, scanning, and authoring operations remain available through `@aicorg/automation-core` and `@aicorg/cli`.

```bash
pnpm add @aicorg/spec@alpha @aicorg/verify-core@alpha @aicorg/automation-core@alpha
pnpm add -D @aicorg/cli@alpha
```

### Local Agent Reliance

`@aicorg/rely` consumes caller-supplied evidence and pinned trust data only. It performs no implicit registry, resolver, network, filesystem, or environment discovery. Its preflight helper uses a caller-trusted current clock, binds the exact operation and deployment request, and rejects non-`allow`, stale, future-dated, expired, request-mismatched, or out-of-window decisions.

```bash
pnpm add @aicorg/rely@alpha
```

The matching command is available from the published alpha CLI:

```bash
npx @aicorg/cli@alpha rely evaluate <policy> <contract> <proof> \
  --observations <file> \
  --attestation <file> \
  --trust-store <file> \
  --origin <origin> \
  --operation-id <id> \
  --deployment-id <id> \
  --expect-revision <full-sha> \
  --environment <development|test|staging|production>
```

Optional transparency inputs verify the signed reference index and exact attestation inclusion only when both its index and separately pinned trust store are supplied. A matching consumer policy can require that verification and restrict log and key identities. External receipt references still need their provider-specific verifier.

### Self-Hosted Reliance Resolver

```bash
pnpm add @aicorg/reliance-server@alpha
```

The reference server exposes a Fetch API handler for exact assurance lookup, history, and portable snapshot export. It does not fetch artifact references or execute submitted code. Resolver results are untrusted discovery; clients choose their own trust stores and policy and can reproduce decisions locally with `@aicorg/rely`. Installing this package does not create a hosted public resolver or independent mirror.

### Bundled GitHub Reliance Gate

[`actions/aic-rely`](../actions/aic-rely) is a repository action, not an npm package. Its checked-in Node.js bundle evaluates regular JSON inputs without downloading a verifier at runtime. Pin the action to a full commit SHA, pin the consumer policy and trust-store file digests, and provide exact issuer, key, runner, origin, environment, deployment, operation, and revision expectations. It fails the workflow for `confirm`, `deny`, and `indeterminate` as well as malformed output.

### CLI-Driven Onboarding And Artifact Generation

```bash
pnpm add -D @aicorg/cli@alpha
```

### Framework And Integration Helpers

```bash
pnpm add @aicorg/plugin-vite@alpha @aicorg/plugin-next@alpha @aicorg/integrations-radix@alpha @aicorg/integrations-shadcn@alpha
```

### Devtools And Inspector Helpers

```bash
pnpm add @aicorg/devtools@alpha
```

### MCP Consumer Path

For AI-agent integration without changing your app runtime dependencies:

```bash
npx @aicorg/mcp-server@alpha
```

### Bootstrap Providers

```bash
pnpm add @aicorg/ai-bootstrap@alpha @aicorg/ai-bootstrap-http@alpha @aicorg/ai-bootstrap-openai@alpha
```

## Release Notes

- The current npm release uses the `alpha` tag.
- Alpha publication uses a [no-OIDC verification and immutable-packaging job followed by a protected, OIDC-only publishing job](./npm-trusted-publishing.md). The GitHub `npm-alpha` environment and npm Trusted Publisher bindings are external prerequisites; the workflow does not accept a static npm token.
- All 24 reviewed packages and `aic rely evaluate` are available through the `alpha` tag; `workspace:*` remains an internal monorepo development protocol rather than an external install target.
- Workspace examples remain private demos, proof surfaces, and test fixtures.
- Package tarballs are validated with local smoke tests before any publish step runs in CI.
- `@aicorg/devtools` is part of the publishable alpha package surface.
- Package or action availability does not demonstrate an external adopter or enforcing agent consumer, an independently operated runner, a public resolver or independent mirror, provider-verified external receipts, or certification.
