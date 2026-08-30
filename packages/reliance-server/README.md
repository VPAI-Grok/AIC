# `@aicorg/reliance-server`

A small, read-only reference resolver for AIC assurance records. It depends on the AIC spec
and minimal verifier, uses Node.js cryptography, and exposes a standard Fetch API handler for
Node.js and Node-compatible serverless runtimes without requiring a proprietary storage or
trust service. A generic WebCrypto edge-runtime entry is not currently shipped or claimed.

The resolver is deliberately not a trust root. Discovery records are untrusted data.
An `allow` or `confirm` verdict can only come from a locally configured verifier such as
`evaluateAICReliance` from `@aicorg/rely`. Without one, `POST /v1/rely` returns an honest
`indeterminate` result. The service never fetches artifact references and never evaluates
code, modules, commands, callbacks, or other executable content supplied in a request.
Operators should publish only public assurance artifacts; snapshots are intentionally
exportable and `GET /v1/snapshot` does not provide access control.

```ts
import { evaluateAICReliance } from "@aicorg/rely";
import {
  createAICRelianceHandler,
  createMemoryRelianceStore
} from "@aicorg/reliance-server";

const store = createMemoryRelianceStore({
  artifact_type: "aic_reliance_snapshot",
  id: "public-mirror",
  records: [],
  spec: "aic.reliance-snapshot/0.1",
  updated_at: "2026-08-29T00:00:00.000Z"
});

export const fetch = createAICRelianceHandler({
  evaluator: evaluateAICReliance,
  async_evaluator_timeout_ms: 10_000,
  max_json_depth: 64,
  max_json_nodes: 50_000,
  max_decision_age_seconds: 60,
  // Back this with your gateway or distributed limiter. Return false to emit 429.
  rely_rate_limit: async (request) => consumeRelianceQuota(request),
  store
});
```

## HTTP API

- `GET /healthz` reports service mode and record count (`Cache-Control: no-store`).
- `GET /v1/assurance` performs an exact origin, operation, deployment, and revision lookup.
- `GET /v1/assurance/history` returns deterministically ordered matching records for an origin and operation. Append-only durability or immutability is a property an operator must enforce in its backing store; resolver records remain untrusted discovery data.
- `GET /v1/snapshot` exports a portable snapshot for independent mirroring.
- `POST /v1/rely` evaluates caller-supplied local artifact data with the configured verifier.

Discovery routes are publicly cacheable for 60 seconds by default. Evaluation and error
responses are never cached. CORS is disabled by default and can be enabled with an explicit
origin allowlist or `"*"`; credentials are never enabled by this package.

Because `/v1/rely` performs signature, transparency, and policy checks, enabling an
`evaluator` also requires a `rely_rate_limit` callback. Connect it to a distributed gateway
or external limiter appropriate to the deployment; the reference package deliberately does not
pretend that an in-memory counter is a safe distributed rate limit.

The evaluation endpoint rejects caller-supplied `evaluated_at`, requires an explicit
deployment environment, validates disposition fields, and supplies the evaluator with a trusted server clock. It snapshots the accepted request, binds the returned decision to the exact request and artifact-digest key set, and refuses an evaluator result that turns `on_passed: "confirm"` into `allow`. A `clock`
callback may be injected for deterministic tests; production deployments should leave it
unset so the runtime clock is used. Request bodies are streamed into a hard byte limit before
strict duplicate-member-rejecting JSON parsing with explicit depth and node limits, and store snapshots accept only finite, plain JSON data. The service rereads trusted time after asynchronous evaluation, re-evaluates the immutable snapshot when time advanced, and rejects a stale, expired, or `valid_until`-crossed result at its final clock sample. `async_evaluator_timeout_ms` bounds each asynchronous evaluator settlement and provides an abort signal; synchronous CPU work must be isolated or bounded by the deployment runtime because JavaScript timers cannot preempt it.

Even a valid resolver evaluation is not a bearer authorization. A consumer accepting it across a process boundary must call `assertAICRelianceAllowed` with the complete pinned evaluation input and a current trusted clock; the guard locally reproduces the entire canonical result. Producer authentication remains useful provenance, not execution authority.
