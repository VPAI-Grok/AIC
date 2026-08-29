# Supported Today

AIC targets owned React, Next.js, and Vite applications where the team can author and review the interaction contract and execute meaningful test scenarios.

## Interaction description

Supported now:

- explicit `agent*` metadata and stable IDs in React source;
- runtime UI semantics plus generated discovery, actions, permissions, and workflows;
- deterministic static extraction with diagnostics for unsupported dynamic values;
- `aic init`, `doctor`, `scan`, `generate`, `validate`, `inspect`, `diff`, and guarded authoring-plan apply;
- devtools inspection and proposal export;
- review-assisted bootstrap from saved or Playwright captures; and
- a read-only MCP server for manifest discovery.

## WebMCP

Supported in the repository:

- experimental WebMCP compatibility pinned to the `2026-08-26` draft;
- fail-closed imperative registration for authored, `execution_ready` actions;
- React lifecycle cleanup and unsupported-browser fallback;
- declarative WebMCP props with risky auto-submit suppression; and
- readiness scanning, doctor findings, and implementation-plan generation.

The policy is native first: use WebMCP's own capabilities when equivalent and keep AIC focused on independent assurance.

## Behavior assurance

Supported in the repository:

- `aic.behavior/0.1` contracts and validators;
- executed or imported observation sets;
- protocol surfaces for human UI, WebMCP, MCP, OpenAPI, and custom entrypoints;
- expected status, confirmation, error, JSON outcome, required behavior, and forbidden behavior;
- cross-surface parity verification;
- canonical contract and observation digests;
- `aic validate behavior`, `aic verify`, and proof inspection; and
- a checkout reference harness plus a dedicated CI proof workflow.

## Not guaranteed

- operation of arbitrary third-party sites;
- zero-touch onboarding or trustworthy dynamic inference;
- full non-React production support;
- stable browser behavior while WebMCP is experimental;
- automatic promotion of generated or inferred actions to executable tools;
- correctness or completeness of a user-authored behavior contract;
- authenticity of imported evidence;
- binding between a local proof and a deployed production build; or
- signed attestations, transparency logs, or hosted policy enforcement.

## Reading AIC claims

There are now three distinct evidence levels:

1. Generated manifests show that semantics were authored or extracted.
2. QA readiness shows that selected metadata is present and structurally usable.
3. Behavior proof shows that supplied observations passed explicit scenarios and parity rules.

None should be described as stronger than the evidence it contains. See [Behavior Assurance](./behavior-assurance.md) and [Threat Model](./threat-model.md).
