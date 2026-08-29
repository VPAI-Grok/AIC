# AIC Behavior Assurance

Behavior Assurance verifies that multiple ways of invoking one business action enforce the same important behavior.

> Standards describe. AIC proves.

WebMCP, MCP, OpenAPI, UI metadata, and future protocols can describe entrypoints. An AIC behavior contract sits below those protocols and records what must remain true: preconditions, authorization, confirmation, side effects, postconditions, recovery behavior, and cross-surface parity.

## Artifact model

The current `aic.behavior/0.1` model has three artifacts.

### Behavior contract

An `aic_behavior_contract` identifies:

- one action and stable domain `operation_id`;
- one or more surfaces such as `human_ui`, `webmcp`, `mcp`, `openapi`, or `custom`;
- reusable behavioral requirements grouped by phase;
- scenarios with expected status, confirmation result, error code, outcome, required checks, and forbidden behavior; and
- whether the scenario requires equivalent behavior across surfaces.

The domain `operation_id` is intentionally separate from a protocol tool name or UI element ID. A renamed WebMCP tool can still represent the same underlying operation.

### Observation set

An `aic_behavior_observation_set` contains evidence gathered for a contract. Each observation is scoped to one scenario and surface and records:

- the operation executed;
- final status and optional confirmation or error result;
- a JSON outcome;
- individual requirement checks;
- optional log, trace, receipt, screenshot, or other evidence references; and
- whether the observation was `executed` by the harness or `imported` from another system.

Imported observations are useful, but they do not become executed evidence merely because AIC validates them.

Every required behavior needs a `passed: true` check. Every forbidden behavior must also be checked explicitly and reported with `passed: false`; omitting the check fails verification.

### Behavior proof

`aic verify` emits an `aic_behavior_proof` with:

- pass/fail status;
- evidence level: `executed`, `imported`, `mixed`, or `none`;
- canonical SHA-256 digests for the validated contract and sorted observations;
- per-scenario and per-surface results;
- parity results; and
- precise findings for missing, invalid, conflicting, or divergent evidence.

Digests make accidental or undisclosed artifact changes detectable. They are not signatures and do not establish who ran the verification.

## Commands

Validate a contract:

```bash
aic validate behavior ./aic-behavior-contract.json
```

Run a local harness and write a proof:

```bash
aic verify ./aic-behavior-contract.json \
  --harness ./aic-verification-harness.mjs \
  --out-file ./public/aic-proof.json
```

Verify imported observations instead:

```bash
aic verify ./aic-behavior-contract.json \
  --observations ./observations.json \
  --out-file ./aic-proof.json
```

Inspect the result:

```bash
aic inspect ./aic-proof.json
```

The process exits with code `1` when the contract or observations are invalid or the proof fails.

## Harness contract

A harness is an ECMAScript module that exports:

```js
export async function collectAICBehaviorObservations({ contract }) {
  return {
    artifact_type: "aic_behavior_observation_set",
    contract_id: contract.id,
    generated_at: new Date().toISOString(),
    observations: []
  };
}
```

Harnesses are trusted local code. Importing one can execute arbitrary code with the CLI process's filesystem, environment, and network access. Review third-party harnesses and run them in isolated CI with least-privilege credentials.

The verifier does not require a particular runner. A harness can call pure domain functions, a browser test, an API client, an MCP client, or a remote test environment as long as it returns valid observations. Evidence quality should be stated honestly.

## What causes failure

A proof fails when any error finding exists, including:

- an invalid contract or observation set;
- a contract ID or domain operation mismatch;
- a missing or duplicate scenario/surface observation;
- an unknown scenario, surface, or requirement;
- status, confirmation, error-code, or outcome mismatch;
- a missing or failed required requirement;
- observed forbidden behavior; or
- required surfaces producing different statuses, confirmations, errors, outcomes, or check results.

Parity compares canonical JSON values, so object property order does not affect the result.

## Native-first protocol policy

AIC behavior contracts are protocol neutral. They should not copy protocol fields just to preserve an AIC-shaped wrapper.

- Use native WebMCP schemas and annotations for WebMCP discovery.
- Use the same domain operation for the human UI and agent entrypoints.
- Give that operation one stable AIC `operation_id`.
- Record only the business requirements and equivalence rules that need independent assurance.
- Add new surface adapters without changing the core behavior contract when the business operation is unchanged.

This is the layer that remains useful if WebMCP expands its metadata, confirmation, or lifecycle capabilities.

## Reference implementation

The [Next.js checkout example](../examples/nextjs-checkout-demo/README.md) contains:

- [`aic-behavior-contract.json`](../examples/nextjs-checkout-demo/aic-behavior-contract.json);
- [`aic-verification-harness.mjs`](../examples/nextjs-checkout-demo/aic-verification-harness.mjs);
- a shared checkout domain operation;
- six executed observations across three scenarios and two surfaces; and
- a checked-in [`aic-proof.json`](../examples/nextjs-checkout-demo/aic-proof.json).

The fixture proof is deterministic and useful for review. It demonstrates the local reference harness; it is not evidence about a deployed checkout.

## CI policy

The repository's `Behavior Assurance` workflow builds the verifier, runs the behavior-assurance tests, executes the checkout harness, and uploads the proof artifact.

A production project should decide which contracts block merging. A sensible starting policy is:

- require executed evidence for critical mutations;
- require success, denial, and confirmation-decline scenarios;
- require parity wherever human and agent surfaces invoke the same action;
- store proof artifacts with the commit or deployment they describe; and
- keep secrets and production side effects out of untrusted pull-request jobs.

## Current trust boundary

A passed proof means the supplied observations conformed to the supplied contract under this verifier version. It does not establish:

- that the contract itself is complete or correct;
- that the harness observed the real deployed surface;
- that evidence was not fabricated;
- that production has the same code or configuration;
- that no unmodeled behavior occurred; or
- that another verifier will interpret a future spec version identically.

Planned hardening can include signed proofs, remote runners, deployment binding, transparency logs, policy bundles, and independent conformance suites. Those capabilities are not claimed today.

## Schemas

- [`behavior-contract.schema.json`](../schemas/behavior-contract.schema.json)
- [`behavior-observation-set.schema.json`](../schemas/behavior-observation-set.schema.json)
- [`behavior-proof.schema.json`](../schemas/behavior-proof.schema.json)
