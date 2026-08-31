# Release Status

## Current position

AIC is alpha software: usable for evaluation and owned-app pilots, strongest on React/Next/Vite, and still allowed to make breaking changes.

The durable product direction is behavioral assurance plus consumer-owned reliance for agent-operated software. WebMCP is a native execution surface; AIC verifies business behavior across WebMCP, human UI, MCP, API, and future surfaces, then lets a relying agent or gateway fail closed on one canonical decision for the exact deployed operation.

## Published alpha

The current npm alpha contains all 24 reviewed public packages: the core spec, runtime, React SDK, automation, CLI, framework plugins, component integrations, bootstrap providers, devtools, MCP server, WebMCP adapter, evidence adapters, remote runner, conformance packs, minimal verifier, and Trust Fabric reliance packages. Exact versions, `alpha` dist-tags, registry integrity, and SLSA provenance were verified after the August 31, 2026 release. See [npm Packages](./npm-packages.md) for the exact matrix.

## Published WebMCP, assurance, and Trust Fabric surface

- `@aicorg/webmcp` compatibility adapter, declarative props, readiness analysis, and tests;
- `aic.behavior/0.1` contract and observation types;
- `verifyAICBehavior` in `@aicorg/automation-core`;
- `aic validate behavior` and `aic verify`;
- behavior-contract, observation-set, and proof schemas;
- checkout human UI/WebMCP deterministic and native-browser proofs;
- `@aicorg/evidence-playwright` native browser/WebMCP evidence primitives;
- `aic.trust/0.1` statements, signed attestations, trust stores, and registry schemas;
- Ed25519 signing, independent verification, well-known discovery, and trust/registry CLI commands;
- the `Behavior Assurance` GitHub Actions gate with signed claims and GitHub artifact provenance;
- `@aicorg/evidence-core`, `@aicorg/evidence-http`, and `@aicorg/evidence-mcp` using one observation model;
- `@aicorg/runner-remote` with public-network, deployment-identity, operator-capability, and bounded-execution controls;
- `@aicorg/conformance-packs` with five consequential-operation pack families;
- cumulative `aic.policy/0.1` evaluation with proof regeneration and pinned trust requirements;
- portable verifier compatibility vectors, signed transparency checkpoints, and dual-signed scheduled key transitions;
- ecosystem-conformance gates in the `Behavior Assurance` workflow plus an evidence-first external adopter submission kit;
- canonical reliance-decision, reliance-record, and reliance-snapshot specs and schemas;
- `@aicorg/rely` with exact request binding, local trust and cumulative-policy evaluation, optional policy-required signed transparency, and trusted-clock bounded-replay checks;
- `@aicorg/verify-core`, the minimal verifier dependency used by reliance gates without the scanner/compiler runtime;
- `aic rely evaluate`, which writes the canonical decision and exits successfully only for `allow`;
- the bundled offline `actions/aic-rely` GitHub action for pinned, fail-closed consumer enforcement; and
- `@aicorg/reliance-server`, a read-only, exportable, mirrorable reference resolver that keeps discovery untrusted.

These package and CLI surfaces are now published under the npm `alpha` tag. The bundled GitHub action remains repository-distributed rather than an npm package.

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
node --test tests/conformance-packs.test.mjs tests/evidence-protocols.test.mjs tests/remote-runner.test.mjs tests/policy.test.mjs tests/interop.test.mjs tests/transparency.test.mjs tests/key-rotation.test.mjs
node --test tests/rely.test.mjs tests/reliance-spec.test.mjs tests/reliance-server.test.mjs tests/aic-rely-action.test.mjs tests/canonical-json-security.test.mjs
npm --prefix actions/aic-rely run check:bundle
```

The checkout fixtures cover success, authorization denial, confirmation decline, business failure, and safe recovery across human UI and native WebMCP. The browser fixture uses native `document.modelContext` in Chrome and retains digest-addressed screenshots. It is still project-operated evidence; AIC signatures can bind the claim, but do not independently prove a production deployment or independent operation.

## Best fit

- teams that own their app and domain code;
- teams adopting WebMCP or MCP for consequential workflows;
- teams willing to author stable semantics and behavioral expectations;
- teams that want CI to catch divergence between human and agent paths; and
- agent, gateway, and release-system teams that want a local, portable pre-execution policy gate.

AIC is not yet the best fit for arbitrary websites, unreviewed inferred contracts, non-React production fleets, or buyers requiring GA stability, independent production certification, or a mature external trust network. The Trust Fabric packages are published, but no public hosted resolver is claimed. Three unrelated production adopters, two separately controlled runner operators, two external enforcing consumers, an independent verifier, a public resolver plus independent mirror with durable history, and provider-verified transparency receipts remain external gates.

## Evaluation path

1. Read [Supported Today](./supported-today.md).
2. Run the [Next.js checkout example](../examples/nextjs-checkout-demo/README.md).
3. Review [Behavior Assurance](./behavior-assurance.md) and [AIC Verified Trust Layer](./trust-layer.md).
4. Select a [Conformance Pack](./conformance-packs.md) and [Assurance Policy](./assurance-policy.md).
5. Put the resulting decision in a real pre-execution path using [AIC Trust Fabric](./trust-fabric.md).
6. Follow [Adopt AIC in an Existing App](./adopt-existing-app.md).
7. Run every applicable gate in [Release Checklist](./release-checklist.md).
