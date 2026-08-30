# AIC Trust Fabric

The Trust Fabric puts AIC in the relying party's pre-execution path.

WebMCP, MCP, HTTP/OpenAPI, and a human UI describe or invoke an operation. AIC answers a different question for an agent, gateway, or release system:

> Does the evidence for this exact deployed operation satisfy my policy strongly enough to proceed?

The decision is protocol-neutral and locally verifiable. A hosted resolver can make records easier to discover, but it is never an implicit trust root.

> [!IMPORTANT]
> The Trust Fabric packages, schemas, CLI command, reference resolver, and GitHub action are implemented in this repository. They are not yet claimed as published npm additions, an AIC-operated public resolver, an independent mirror, or externally adopted infrastructure.

## Reliance decision

`@aicorg/rely` consumes only caller-supplied data. It performs no hidden network, filesystem, environment-variable, or registry discovery. The relying consumer must supply its expected environment; AIC never derives that policy selector from the producer's signed deployment claim.

```ts
import {
  assertAICRelianceAllowed,
  evaluateAICReliance,
  type EvaluateAICRelianceInput
} from "@aicorg/rely";

const relianceInput: EvaluateAICRelianceInput = {
  origin: "https://shop.example",
  operation_id: "checkout.complete.domain",
  expected_deployment_id: "shop-production-2026-08-29",
  expected_revision: "0123456789abcdef0123456789abcdef01234567",
  environment: "production",
  policy,
  contract,
  observations,
  proof,
  attestation,
  trust_store: consumerTrustStore
};
const decision = evaluateAICReliance(relianceInput);

const allowedDecision = assertAICRelianceAllowed(decision, {
  input: relianceInput,
  minimum_validity_seconds: 30
});
```

The returned `aic_reliance_decision` includes:

- the exact request binding;
- `allow`, `confirm`, `deny`, or `indeterminate`;
- stable reason codes;
- policy, contract, evidence, attestation, trust-store, and optional transparency digests;
- artifact, binding, trust, policy, and transparency checks;
- evidence age and freshness;
- an exclusive `valid_until` deadline on every `allow`; and
- the full policy evaluation when valid inputs allow one to be produced.

An `allow` result requires valid artifacts, exact request bindings, a locally trusted signed attestation, and a passing consumer policy. Missing or malformed inputs are indeterminate by default. Valid but mismatched, untrusted, expired, revoked, or policy-failing claims are denied by default. A consumer can route a result to human confirmation, but no disposition setting can convert a failed or indeterminate result into `allow`.

Use the public JSON Schema for structural interchange screening, then use the `@aicorg/spec` runtime validator or CLI for the normative semantic check:

```bash
aic validate reliance-decision ./reliance-decision.json
```

Schema acceptance is never an execution permission. JSON Schema cannot express digest equality, request-to-policy equality, timestamp ordering, inline attestation binding, or every paired transparency invariant. Runtime validation enforces those relationships; reliance-record and snapshot validation also recomputes every inline locator digest with the AIC canonical digest implementation.

## CLI preflight

The CLI evaluates the same local decision and exits nonzero unless the verdict is `allow`:

```bash
aic rely evaluate \
  ./policy.json \
  ./behavior-contract.json \
  ./behavior-proof.json \
  --observations ./observations.json \
  --attestation ./attestation.json \
  --trust-store ./consumer-trust-store.json \
  --origin https://shop.example \
  --operation-id checkout.complete.domain \
  --deployment-id shop-production-2026-08-29 \
  --expect-revision 0123456789abcdef0123456789abcdef01234567 \
  --environment production \
  --out-file ./reliance-decision.json
```

Optional `--on-passed`, `--on-failed`, and `--on-indeterminate` settings can route results to confirmation. Optional transparency inputs are supplied as a pair:

```bash
--transparency-index ./transparency-index.json \
--transparency-prior-index ./last-trusted-transparency-index.json \
--transparency-trust-store ./transparency-log-trust-store.json
```

The reference linear history verifies its signed checkpoint and exact attestation inclusion. Policy must also choose at least one rollback defense: maximum checkpoint age, an exact checkpoint digest, or consistency with a separately consumer-pinned `--transparency-prior-index`. `minimum_size` can add a positive floor but is not sufficient by itself. Supplying a prior index always checks that the current history consistently extends it. Stateless inclusion alone cannot detect an older valid prefix or a split view. External receipt references remain explicitly unchecked until a provider-specific verifier validates them.

## Agent integration

Use the decision immediately before invocation, after the agent has selected the exact operation and target deployment:

```ts
import {
  createAICReliancePreflight,
  type EvaluateAICRelianceInput
} from "@aicorg/rely";

const preflight = createAICReliancePreflight<{ operationId: string }>(
  async ({ operationId }): Promise<EvaluateAICRelianceInput> =>
    loadPinnedArtifactsFor(operationId)
);

await preflight({ operationId: "checkout.complete.domain" });
await invokeNativeWebMCPTool();
```

The same preflight belongs before MCP `tools/call`, HTTP mutation, browser action, or release promotion. It is not application authorization and does not replace protocol-native confirmation or browser permission controls.

### Trusted time and replay protection

`createAICReliancePreflight` canonical-snapshots its inputs, overwrites any supplied evaluation time with the caller's trusted current clock, re-evaluates if time advanced during evaluation, and reproduces the exact decision from the loaded artifacts before returning. `assertAICRelianceAllowed` snapshots the consumer's complete evaluation input before touching an untrusted portable decision, canonical-clones the raw decision without invoking accessors, and returns only the detached reproduced result. It samples trusted time after reproduction and can enforce `minimum_validity_seconds`. It rejects:

- every verdict other than `allow`;
- a decision older than the configured replay window (60 seconds by default);
- a decision dated beyond the configured future-skew allowance (zero by default; configure a nonzero allowance only for justified cross-clock tolerance);
- a decision at or beyond its exclusive `valid_until`, which can never be more than 60 seconds after evaluation and is shortened by applicable evidence and checkpoint deadlines;
- an attestation that expired after the decision was produced; and
- any missing, extra, or mismatched policy, trust-store, evidence, attestation, transparency, origin, operation, deployment, revision, or environment binding; and
- any fabricated or modified verdict, check, policy evaluation, freshness result, reason, or deadline that the local verifier does not reproduce exactly.

A remotely produced or resolver-returned decision may carry authenticated provenance for audit, but provenance alone is insufficient: an authenticated producer can still choose a different policy, trust store, artifact set, or deadline. Execution requires local reproduction from the consumer's pinned inputs.

The time window limits stale replay; it does not make a decision a single-use token. Keep protocol-native authorization and confirmation, and use application idempotency or a consumer-managed nonce when duplicate execution matters.

## Bundled GitHub gate

[`actions/aic-rely`](../actions/aic-rely) packages the verifier as a checked-in Node.js action bundle, so an enforcement job does not download a verifier or execute repository-supplied modules. The action reads bounded regular JSON files inside the workspace, rejects symlinks and unsafe output paths, verifies the exact byte digests of the consumer policy and trust store, and requires explicit issuer, key, runner, origin, environment, deployment, operation, and revision expectations.

Pin the action to a full commit SHA and protect changes to the relying policy, trust stores, their digests, and workflow. The runner's current clock is authoritative. The job succeeds only for a locally reproduced canonical `allow` that still has the configured residual validity (`minimum-validity-seconds`, 30 by default) at finalization. The `valid-until` output is an exclusive deadline, not a transferable permission: delayed or cross-job consumers must re-run the gate or reassert the decision from the complete pinned input and a trusted current clock. `confirm`, `deny`, `indeterminate`, malformed output, insufficient residual validity, or verifier failure writes a decision where safely possible and fails closed.

## Resolver boundary

The open reference resolver is a read-only distribution layer for candidate records and history:

1. operators load and publish JSON artifacts, never executable modules;
2. the resolver indexes exact origin and operation bindings;
3. clients fetch an exportable record;
4. clients choose their own trust store and policy; and
5. clients reproduce the decision locally with `@aicorg/rely`.

Resolver responses, badges, and directory listings are discovery hints. A client must not treat the resolver operator, DNS host, or an AIC-owned key as universally trusted.

The portable `aic_reliance_record` and `aic_reliance_snapshot` contracts make a resolver's public history exportable. The reference Fetch API server never fetches artifact locators or executes publisher content. Exact lookup and history responses are explicitly `unverified_discovery`; an optional evaluation endpoint uses only an operator-configured local evaluator, validates caller disposition, binds the evaluator result to an immutable request envelope, re-evaluates after a clock advance, and requires an external rate-limit callback.

Remote evaluation sends the supplied policy, trust store, contract, observations, proof, and attestation to that resolver operator. Prefer `@aicorg/rely` locally, and never send private keys, implicit secrets, or sensitive artifacts to an operator you do not trust.

## What counts as completion

The repository implementation is necessary but insufficient. Trust Fabric v1 requires real external reliance:

- three production applications controlled by unrelated maintainers;
- two separately controlled runner operators;
- two external agent or gateway consumers that enforce AIC before execution;
- one independently maintained verifier passing the compatibility vectors;
- a public resolver plus an independently hosted mirror with 30 days of history; and
- provider-verified transparency receipts for production claims.

See [ADR 0005](./adr/0005-trust-fabric-reliance-network.md), [AIC Verified Trust Layer](./trust-layer.md), [Assurance Policy](./assurance-policy.md), and [Protocol Evidence and Remote Observation](./evidence-adapters.md).
