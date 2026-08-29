# Release Status

## Current position

AIC is alpha software: usable for evaluation and owned-app pilots, strongest on React/Next/Vite, and still allowed to make breaking changes.

The durable product direction is behavioral assurance for agent-operated software. WebMCP is a native execution surface; AIC verifies business behavior across WebMCP, human UI, MCP, API, and future surfaces.

## Published alpha

The existing npm alpha includes the core spec, runtime, React SDK, automation, CLI, framework plugins, component integrations, bootstrap providers, devtools, and MCP server. See [npm Packages](./npm-packages.md) for the exact published matrix.

## Implemented in this repository for the next release

- `@aicorg/webmcp` compatibility adapter, declarative props, readiness analysis, and tests;
- `aic.behavior/0.1` contract and observation types;
- `verifyAICBehavior` in `@aicorg/automation-core`;
- `aic validate behavior` and `aic verify`;
- behavior-contract, observation-set, and proof schemas;
- checkout human UI/WebMCP deterministic and native-browser proofs;
- `@aicorg/evidence-playwright` native browser/WebMCP evidence primitives;
- `aic.trust/0.1` statements, signed attestations, trust stores, and registry schemas;
- Ed25519 signing, independent verification, well-known discovery, and trust/registry CLI commands; and
- the `Behavior Assurance` GitHub Actions gate with signed claims and GitHub artifact provenance.

Do not describe repository-only additions as published npm capabilities until the next alpha publish succeeds.

## Verification surfaces

Workspace verification:

```bash
pnpm check
pnpm build
pnpm test
pnpm test:goldens
pnpm smoke:init
pnpm smoke:adoption
pnpm smoke:mcp
pnpm smoke:mcp:stdio
```

Behavior assurance:

```bash
pnpm --dir examples/nextjs-checkout-demo run aic:verify
pnpm --dir examples/nextjs-checkout-demo run aic:verify:browser
```

Both checkout fixtures produce six executed observations across three parity scenarios with no findings. The browser fixture uses native `document.modelContext` in Chrome and retains digest-addressed screenshots. It is still local development evidence; AIC signatures can bind the claim, but do not independently prove a production deployment.

## Best fit

- teams that own their app and domain code;
- teams adopting WebMCP or MCP for consequential workflows;
- teams willing to author stable semantics and behavioral expectations; and
- teams that want CI to catch divergence between human and agent paths.

AIC is not yet the best fit for arbitrary websites, unreviewed inferred contracts, non-React production fleets, or buyers requiring GA stability, independent production certification, or a mature external trust network.

## Evaluation path

1. Read [Supported Today](./supported-today.md).
2. Run the [Next.js checkout example](../examples/nextjs-checkout-demo/README.md).
3. Review [Behavior Assurance](./behavior-assurance.md) and [AIC Verified Trust Layer](./trust-layer.md).
4. Follow [Adopt AIC in an Existing App](./adopt-existing-app.md).
5. Run every applicable gate in [Release Checklist](./release-checklist.md).
