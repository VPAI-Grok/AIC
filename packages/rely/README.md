# `@aicorg/rely`

`@aicorg/rely` turns local AIC artifacts and a consumer-owned assurance policy into a stable preflight verdict:

- `allow`
- `confirm`
- `deny`
- `indeterminate`

The package does not discover or download artifacts. A registry, resolver, or hosted service may help a consumer locate candidates, but the consumer must supply the artifacts and pinned trust stores used by `evaluateAICReliance`. Registry inclusion alone never produces an `allow` verdict.

```ts
import {
  assertAICRelianceAllowed,
  evaluateAICReliance,
  type EvaluateAICRelianceInput
} from "@aicorg/rely";

const relianceInput: EvaluateAICRelianceInput = {
  origin: "https://shop.example",
  operation_id: "checkout.complete",
  environment: "production",
  expected_deployment_id: "production-2026-08-29",
  expected_revision: "0123456789abcdef0123456789abcdef01234567",
  contract,
  proof,
  observations,
  policy,
  attestation,
  trust_store
};
const result = evaluateAICReliance(relianceInput);

const allowedDecision = assertAICRelianceAllowed(result, {
  input: relianceInput,
  minimum_validity_seconds: 30
});
```

An `allow` is impossible unless the caller supplies its expected environment and the signed attestation verifies against the supplied pinned trust store and binds the exact environment, origin, operation, deployment ID, source revision, contract, and proof. It also requires `unmatched: "fail"`, at least one applicable policy rule, a policy evaluation exactly bound to the decision and artifact digests, and any signed transparency log/key and rollback requirements declared by that policy. Required transparency must declare checkpoint freshness, an exact checkpoint digest, or consistency with a consumer-pinned prior checkpoint; `minimum_size` is only an additional floor. Supplying `prior_index` verifies monotonic extension. A `confirm` verdict is non-executable and can preserve passed, failed, or indeterminate reasons and checks until a separate real confirmation flow decides what to do. The full policy evaluation remains attached to the result for auditability when valid inputs permit one.

Use `createAICReliancePreflight` when a WebMCP or MCP client needs a small execution guard. It snapshots the loaded inputs, overwrites any supplied evaluation time with its trusted current clock, re-evaluates if trusted time advanced during evaluation, and asserts the exact request and every input artifact digest. It proceeds only on a current `allow`; `confirm`, `deny`, and `indeterminate` throw `AICReliancePreflightError`.

`assertAICRelianceAllowed` accepts an untrusted decision only together with the complete consumer-owned evaluation `input`. It snapshots the consumer input before touching the raw decision, canonical-clones the decision without evaluating accessors, derives the exact request and digest bindings, locally re-evaluates at the decision's claimed evaluation time, and requires the entire canonical result to match. It then samples trusted time after that potentially expensive reproduction and enforces currentness plus `minimum_validity_seconds`. Use the detached decision returned by the assertion, not the raw object supplied to it. A fabricated or stateful verdict, extended deadline, substituted policy, missing or extra artifact, or different request audience therefore fails. Every `allow` has a normative maximum portable lifetime of 60 seconds, and its deadline is shortened to the earliest proof, observation, attestation, expiry, or transparency-checkpoint policy boundary. Producer authentication can add provenance, but it is not execution authority and cannot replace local reproduction.
