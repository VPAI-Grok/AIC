# ADR 0005: Put AIC in the Agent Reliance Path

- Status: accepted
- Date: 2026-08-29

## Context

AIC can already describe important application operations, collect protocol-neutral evidence, regenerate behavior proofs, bind proofs to exact deployments, verify signed claims, apply consumer policy, and publish portable registry and transparency artifacts.

Those primitives do not by themselves make AIC infrastructure. An application can publish evidence without an agent consulting it, and a hosted dashboard can display a passing claim without affecting execution. The missing system boundary is the relying party: an agent, gateway, or release system must be able to make one local, reproducible decision before a consequential operation starts.

WebMCP remains the browser-native description and execution layer. MCP and HTTP/OpenAPI remain native execution surfaces for their domains. AIC must not duplicate their protocol conformance or become another generic tool registry.

## Decision

AIC will add an open Trust Fabric centered on a protocol-neutral reliance decision.

1. `@aicorg/rely` is the canonical consumer SDK. It accepts an exact origin, stable domain `operation_id`, deployment identity, source revision, local assurance artifacts, and a relying-party policy.
2. The SDK verifies artifacts, signatures, trust anchors, exact request bindings, proof freshness, policy, and optional transparency history locally before returning a machine-readable verdict. Portable `allow` assertions require the complete consumer-owned evaluation input and exact local reproduction of the full canonical decision; producer authentication alone cannot authorize producer-chosen results.
3. `allow`, `confirm`, `deny`, and `indeterminate` are distinct outcomes. Missing or invalid inputs never become `allow`. A consumer may require confirmation for an otherwise valid action, but cannot use disposition settings to convert invalid evidence into an allowed action.
4. Agent and protocol integrations are thin preflight adapters around the same decision API. They do not create a new invocation protocol.
5. A public resolver is an untrusted discovery and history convenience. Its records are exportable and mirrorable, and its decisions can be reproduced with the open SDK and CLI. The resolver never becomes an implicit AIC trust root.
6. Every portable `allow` has an exclusive, policy-derived `valid_until` no later than 60 seconds after evaluation. Consumers and gates must re-evaluate instead of persisting a boolean permission beyond that deadline.
6. Remote jobs remain data-only. The resolver and CI action do not execute application-supplied modules, scripts, or shell commands.
7. Production assurance records are short-lived and bound to exact origin, operation, deployment, revision, policy, evidence, issuer, runner, expiry, and revocation state.
8. Independence is an operational property. A runner operated by AIC or the application owner cannot satisfy an independently operated runner requirement merely because it uses the open runner package.
9. Production preflight uses a relying-party-trusted current clock. Portable decisions are short-lived and exact-request-bound; schema validation alone does not make a stale or remotely produced decision safe to replay. The time bound does not replace application idempotency or provide a single-use nonce.
10. The repository GitHub gate bundles the open verifier and accepts bounded JSON data rather than downloading a mutable verifier or executing submitted modules during the enforcement job.

## Trust boundary

The resolver may locate candidate records, but the consumer chooses trust anchors and policy and verifies locally. A valid signature proves who signed exact content. A passing policy result proves that the supplied artifacts met that policy at the recorded evaluation time. Neither fact alone proves general application safety, present reachability, operator independence, or certification.

Transparency receipts prove recording or consistency according to their provider-specific verification rules. They do not prove that the underlying behavioral assertion is true. AIC combines verified receipts with regenerated behavioral evidence and consumer policy; it does not replace standardized transparency systems.

## Milestone completion

Repository implementation is only the first portion of Trust Fabric v1. The milestone is complete only after all of these external outcomes exist:

1. three production applications controlled by unrelated maintainers publish current claims for consequential operations;
2. two separately controlled runner operators produce independently verifiable evidence, with at least one unaffiliated with AIC and the observed application;
3. two external agent or gateway consumers call AIC in their normal pre-execution path and fail closed for stale, tampered, revoked, wrong-origin, wrong-deployment, wrong-revision, and unmatched-policy claims;
4. one independently maintained verifier passes the compatibility vectors;
5. a public resolver and an independently hosted mirror expose 30 days of portable history without making network availability necessary for valid cached local verification; and
6. production claims carry provider-verified standardized or independently operated transparency receipts.

Examples, AIC-owned fixtures, self-signed demos, downloads, stars, and registry logos do not satisfy these gates.

## Consequences

- Agents receive one safe decision API instead of needing to understand every AIC artifact.
- Applications gain a reason to publish evidence when agent consumers prefer or require verified operations.
- Independent runners and verifier implementations make claims more credible and reduce project-owner control.
- Hosted operation can add convenience and service levels without making the evidence format or verifier proprietary.
- WebMCP can continue to absorb richer native capabilities without making cross-surface behavior proof or independent reliance policy redundant.

## Non-goals

- a replacement for WebMCP, MCP, OpenAPI, browser permissions, authentication, or application authorization;
- arbitrary automation of third-party websites;
- execution of generated, inferred, or placeholder action contracts;
- an AIC-owned universal trust root;
- a hosted-only verifier or evidence format; or
- a public certification badge before independent production evidence and governance exist.
