import assert from "node:assert/strict";
import test from "node:test";

import { importWorkspaceModule, readJsonFile, resolveFromRepo } from "./helpers.mjs";

const server = await importWorkspaceModule(
  "packages/reliance-server/dist/reliance-server/src/index.js"
);
const rely = await importWorkspaceModule("packages/rely/dist/rely/src/index.js");
const verify = await importWorkspaceModule(
  "packages/verify-core/dist/verify-core/src/index.js"
);
const interop = await readJsonFile(
  resolveFromRepo("interop/aic-trust-0.1/valid/bundle.json")
);

const ORIGIN = "https://shop.example";
const OPERATION_ID = "checkout.submit";
const DEPLOYMENT_ID = "shop-production-2026-08-29";
const REVISION = "a".repeat(40);
const OTHER_REVISION = "b".repeat(40);
const DIGEST = `sha256:${"c".repeat(64)}`;

function record({
  id = "checkout-current",
  indexedAt = "2026-08-29T12:00:00.000Z",
  deploymentId = DEPLOYMENT_ID,
  revision = REVISION
} = {}) {
  return {
    artifact_type: "aic_reliance_record",
    artifacts: {
      attestation: {
        digest: DIGEST,
        media_type: "application/json",
        uri: `https://evidence.example/${id}/attestation.json`
      },
      proof: {
        digest: DIGEST,
        uri: `https://evidence.example/${id}/proof.json`
      }
    },
    binding: {
      deployment_id: deploymentId,
      operation_id: OPERATION_ID,
      origin: ORIGIN,
      source_revision: revision
    },
    id,
    indexed_at: indexedAt,
    spec: "aic.reliance-record/0.1"
  };
}

function snapshot(records = [record()]) {
  return {
    artifact_type: "aic_reliance_snapshot",
    id: "public-mirror",
    records,
    spec: "aic.reliance-snapshot/0.1",
    updated_at: "2026-08-29T12:01:00.000Z"
  };
}

function exactQuery(overrides = {}) {
  const params = new URLSearchParams({
    deployment_id: DEPLOYMENT_ID,
    operation_id: OPERATION_ID,
    origin: ORIGIN,
    revision: REVISION,
    ...overrides
  });
  return `https://resolver.example/v1/assurance?${params}`;
}

function evaluationBody(overrides = {}) {
  return {
    attestation: { artifact_type: "aic_signed_attestation" },
    contract: { artifact_type: "aic_behavior_contract" },
    environment: "production",
    expected_deployment_id: DEPLOYMENT_ID,
    expected_revision: REVISION,
    observations: { artifact_type: "aic_behavior_observation_set" },
    operation_id: OPERATION_ID,
    origin: ORIGIN,
    policy: { artifact_type: "aic_assurance_policy" },
    proof: { artifact_type: "aic_behavior_proof" },
    trust_store: { artifact_type: "aic_trust_store" },
    ...overrides
  };
}

function allowDecision({ deploymentId = DEPLOYMENT_ID } = {}) {
  const evaluatedAt = "2026-08-29T12:02:00.000Z";
  return {
    artifact_digests: {
      attestation: DIGEST,
      contract: DIGEST,
      observations: DIGEST,
      policy: DIGEST,
      proof: DIGEST,
      trust_store: DIGEST
    },
    artifact_type: "aic_reliance_decision",
    checks: {
      artifacts: "passed",
      policy: "passed",
      request_binding: "passed",
      transparency: "not_checked",
      trust: "passed"
    },
    evaluated_at: evaluatedAt,
    evidence_freshness: { status: "fresh" },
    policy_evaluation: {
      artifact_type: "aic_policy_evaluation",
      context: {
        environment: "production",
        expected_origin: ORIGIN,
        expected_revision: REVISION
      },
      decision: "passed",
      evaluated_at: evaluatedAt,
      findings: [],
      policy: { digest: DIGEST, id: "consumer.policy" },
      rules: [{ findings: [], id: "exact-binding", status: "passed" }],
      spec: "aic.policy/0.1",
      subjects: {
        attestation_digest: DIGEST,
        contract_digest: DIGEST,
        observations_digest: DIGEST,
        proof_digest: DIGEST
      }
    },
    reason_codes: ["requirements_satisfied"],
    request: {
      environment: "production",
      expected_deployment_id: deploymentId,
      expected_revision: REVISION,
      operation_id: OPERATION_ID,
      origin: ORIGIN
    },
    spec: "aic.reliance/0.1",
    valid_until: "2026-08-29T12:03:00.000Z",
    verdict: "allow"
  };
}

function allowDecisionForInput(input, options = {}) {
  const decision = allowDecision(options);
  decision.evaluated_at = input.evaluated_at;
  decision.policy_evaluation.evaluated_at = input.evaluated_at;
  decision.valid_until = new Date(
    Date.parse(input.evaluated_at) + 60_000
  ).toISOString();
  decision.request = {
    environment: input.environment,
    expected_deployment_id: options.deploymentId ?? input.expected_deployment_id,
    expected_revision: input.expected_revision,
    operation_id: input.operation_id,
    origin: input.origin
  };
  decision.policy_evaluation.context = {
    environment: input.environment,
    expected_origin: input.origin,
    expected_revision: input.expected_revision
  };
  decision.artifact_digests = {
    attestation: verify.createAICDigest(input.attestation),
    contract: verify.createAICDigest(input.contract),
    observations: verify.createAICDigest(input.observations),
    policy: verify.createAICDigest(input.policy),
    proof: verify.createAICDigest(input.proof),
    trust_store: verify.createAICDigest(input.trust_store)
  };
  decision.policy_evaluation.policy.digest = decision.artifact_digests.policy;
  decision.policy_evaluation.subjects = {
    attestation_digest: decision.artifact_digests.attestation,
    contract_digest: decision.artifact_digests.contract,
    observations_digest: decision.artifact_digests.observations,
    proof_digest: decision.artifact_digests.proof
  };
  return decision;
}

async function json(response) {
  return JSON.parse(await response.text());
}

test("memory store validates JSON-only records and exports independent portable snapshots", async () => {
  const input = snapshot();
  const store = server.createMemoryRelianceStore(input);
  input.records[0].id = "mutated-input";

  const first = await store.exportSnapshot();
  assert.equal(first.records[0].id, "checkout-current");
  first.records[0].id = "mutated-output";
  const second = await store.exportSnapshot();
  assert.equal(second.records[0].id, "checkout-current");

  const executable = record();
  executable.artifacts.proof.inline = { callback: () => "never" };
  assert.throws(
    () => server.createMemoryRelianceStore(snapshot([executable])),
    /finite, plain JSON data/
  );

  const executableReference = record();
  executableReference.artifacts.proof.uri = "javascript:alert(1)";
  assert.throws(
    () => server.createMemoryRelianceStore(snapshot([executableReference])),
    /relative, HTTP\(S\), IPFS, or URN reference/
  );

  const datePayload = record();
  datePayload.artifacts.proof.inline = new Date();
  assert.throws(
    () => server.createMemoryRelianceStore(snapshot([datePayload])),
    /finite, plain JSON data/
  );

  const mismatchedInline = record();
  mismatchedInline.artifacts.proof.inline = { status: "passed" };
  assert.throws(
    () => server.createMemoryRelianceStore(snapshot([mismatchedInline])),
    /Digest does not match the canonical inline artifact/
  );
});

test("health and exact lookup are read-only, explicitly unverified, and cache correctly", async () => {
  const handler = server.createAICRelianceHandler({
    cors: { allowed_origins: "*" },
    store: server.createMemoryRelianceStore(snapshot())
  });

  const health = await handler(new Request("https://resolver.example/healthz"));
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.equal(health.headers.get("access-control-allow-origin"), "*");
  assert.deepEqual(await json(health), {
    artifact_type: "aic_reliance_health",
    mode: "discovery_only",
    read_only: true,
    records: 1,
    spec: "aic.reliance-server/0.1",
    status: "ok"
  });

  const lookup = await handler(new Request(exactQuery()));
  assert.equal(lookup.status, 200);
  assert.match(lookup.headers.get("cache-control"), /^public, max-age=60/);
  const lookupBody = await json(lookup);
  assert.equal(lookupBody.record.id, "checkout-current");
  assert.equal(lookupBody.trust_status, "unverified_discovery");

  const mismatch = await handler(
    new Request(exactQuery({ revision: OTHER_REVISION }))
  );
  assert.equal(mismatch.status, 404);
  assert.equal((await json(mismatch)).code, "assurance_not_found");

  const nonCanonical = await handler(
    new Request(exactQuery({ origin: `${ORIGIN}/` }))
  );
  assert.equal(nonCanonical.status, 400);
  assert.equal((await json(nonCanonical)).code, "invalid_binding");
});

test("history is deterministic, filterable, and paginated without changing storage", async () => {
  const records = [
    record({ id: "older", indexedAt: "2026-08-27T12:00:00.000Z" }),
    record({ id: "newest", indexedAt: "2026-08-29T12:00:00.000Z" }),
    record({
      id: "other-deployment",
      indexedAt: "2026-08-28T12:00:00.000Z",
      deploymentId: "shop-production-previous",
      revision: OTHER_REVISION
    })
  ];
  const handler = server.createAICRelianceHandler({
    store: server.createMemoryRelianceStore(snapshot(records))
  });
  const params = new URLSearchParams({
    limit: "2",
    offset: "0",
    operation_id: OPERATION_ID,
    origin: ORIGIN
  });
  const response = await handler(
    new Request(`https://resolver.example/v1/assurance/history?${params}`)
  );
  const body = await json(response);
  assert.equal(body.total, 3);
  assert.equal(body.next_offset, 2);
  assert.deepEqual(body.records.map((item) => item.id), ["newest", "other-deployment"]);
  assert.equal(body.trust_status, "unverified_discovery");

  params.set("deployment_id", DEPLOYMENT_ID);
  params.set("limit", "20");
  const filtered = await json(
    await handler(new Request(`https://resolver.example/v1/assurance/history?${params}`))
  );
  assert.deepEqual(filtered.records.map((item) => item.id), ["newest", "older"]);
});

test("registry discovery alone never yields an actionable reliance verdict", async () => {
  const handler = server.createAICRelianceHandler({
    store: server.createMemoryRelianceStore(snapshot())
  });
  const response = await handler(
    new Request("https://resolver.example/v1/rely", {
      body: JSON.stringify(evaluationBody()),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await json(response);
  assert.equal(body.discovery.status, "found");
  assert.equal(body.discovery.trust_status, "unverified_discovery");
  assert.equal(body.mode, "discovery_only");
  assert.equal(body.verdict, "indeterminate");
  assert.deepEqual(body.evaluation.reason_codes, ["local_verifier_unavailable"]);
});

test("only a valid local verifier result controls the verdict", async () => {
  let received;
  const handler = server.createAICRelianceHandler({
    clock: () => "2026-08-29T12:02:00.000Z",
    evaluator(input) {
      received = input;
      return allowDecisionForInput(input);
    },
    rely_rate_limit: () => true,
    store: server.createMemoryRelianceStore(snapshot([]))
  });
  const response = await handler(
    new Request("https://resolver.example/v1/rely", {
      body: JSON.stringify(evaluationBody()),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
  );
  const body = await json(response);
  assert.equal(body.discovery.status, "not_found");
  assert.equal(body.mode, "local_verification");
  assert.equal(body.verdict, "allow");
  assert.equal(received.expected_deployment_id, DEPLOYMENT_ID);
  assert.equal(received.expected_revision, REVISION);
  assert.equal(received.evaluated_at, "2026-08-29T12:02:00.000Z");

  const invalidHandler = server.createAICRelianceHandler({
    evaluator() {
      return { verdict: "allow" };
    },
    rely_rate_limit: () => true,
    store: server.createMemoryRelianceStore(snapshot())
  });
  const invalid = await json(
    await invalidHandler(
      new Request("https://resolver.example/v1/rely", {
        body: JSON.stringify(evaluationBody()),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    )
  );
  assert.equal(invalid.verdict, "indeterminate");
  assert.deepEqual(invalid.evaluation.reason_codes, ["local_verifier_invalid_result"]);

  const wrongBindingHandler = server.createAICRelianceHandler({
    clock: () => "2026-08-29T12:02:00.000Z",
    evaluator(input) {
      return allowDecisionForInput(input, { deploymentId: "another-deployment" });
    },
    rely_rate_limit: () => true,
    store: server.createMemoryRelianceStore(snapshot())
  });
  const wrongBinding = await json(
    await wrongBindingHandler(
      new Request("https://resolver.example/v1/rely", {
        body: JSON.stringify(evaluationBody()),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    )
  );
  assert.equal(wrongBinding.verdict, "indeterminate");
  assert.deepEqual(wrongBinding.evaluation.reason_codes, [
    "local_verifier_binding_mismatch"
  ]);

  for (const evaluator of [
    (input) => {
      const decision = allowDecisionForInput(input);
      decision.artifact_digests.policy = DIGEST;
      decision.policy_evaluation.policy.digest = DIGEST;
      return decision;
    },
    (input) => {
      input.origin = "https://attacker.example";
      return allowDecisionForInput(input);
    }
  ]) {
    const hardenedHandler = server.createAICRelianceHandler({
      clock: () => "2026-08-29T12:02:00.000Z",
      evaluator,
      rely_rate_limit: () => true,
      store: server.createMemoryRelianceStore(snapshot([]))
    });
    const hardened = await json(
      await hardenedHandler(
        new Request("https://resolver.example/v1/rely", {
          body: JSON.stringify(evaluationBody()),
          headers: { "content-type": "application/json" },
          method: "POST"
        })
      )
    );
    assert.equal(hardened.verdict, "indeterminate");
    assert.deepEqual(hardened.evaluation.reason_codes, [
      "local_verifier_binding_mismatch"
    ]);
  }

  const droppedTransparencyHandler = server.createAICRelianceHandler({
    clock: () => "2026-08-29T12:02:00.000Z",
    evaluator(input) {
      return allowDecisionForInput(input);
    },
    rely_rate_limit: () => true,
    store: server.createMemoryRelianceStore(snapshot([]))
  });
  const droppedTransparency = await json(
    await droppedTransparencyHandler(
      new Request("https://resolver.example/v1/rely", {
        body: JSON.stringify(
          evaluationBody({
            transparency: {
              index: { artifact_type: "aic_transparency_index" },
              prior_index: { artifact_type: "aic_transparency_index" },
              trust_store: { artifact_type: "aic_transparency_trust_store" }
            }
          })
        ),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    )
  );
  assert.equal(droppedTransparency.verdict, "indeterminate");
  assert.deepEqual(droppedTransparency.evaluation.reason_codes, [
    "local_verifier_binding_mismatch"
  ]);
});

test("the resolver validates disposition and cannot downgrade confirmation to allow", async () => {
  const handler = server.createAICRelianceHandler({
    clock: () => "2026-08-29T12:02:00.000Z",
    evaluator(input) {
      return allowDecisionForInput(input);
    },
    rely_rate_limit: () => true,
    store: server.createMemoryRelianceStore(snapshot([]))
  });

  const invalidRequest = await handler(
    new Request("https://resolver.example/v1/rely", {
      body: JSON.stringify(
        evaluationBody({ disposition: { on_passed: "allow", unknown: true } })
      ),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
  );
  assert.equal(invalidRequest.status, 400);
  assert.equal((await json(invalidRequest)).code, "invalid_evaluation_request");

  const confirmation = await json(
    await handler(
      new Request("https://resolver.example/v1/rely", {
        body: JSON.stringify(
          evaluationBody({ disposition: { on_passed: "confirm" } })
        ),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    )
  );
  assert.equal(confirmation.verdict, "indeterminate");
  assert.deepEqual(confirmation.evaluation.reason_codes, [
    "local_verifier_binding_mismatch"
  ]);
});

test("evaluation enforces media type, exact binding, body limits, and explicit CORS", async () => {
  const handler = server.createAICRelianceHandler({
    cors: { allowed_origins: ["https://agent.example"] },
    max_request_bytes: 128,
    store: server.createMemoryRelianceStore(snapshot())
  });
  const wrongType = await handler(
    new Request("https://resolver.example/v1/rely", {
      body: "{}",
      headers: { "content-type": "text/plain" },
      method: "POST"
    })
  );
  assert.equal(wrongType.status, 400);

  const tooLarge = await handler(
    new Request("https://resolver.example/v1/rely", {
      body: JSON.stringify(evaluationBody({ padding: "x".repeat(256) })),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
  );
  assert.equal(tooLarge.status, 413);

  let cancelled = false;
  const chunkedBody = new ReadableStream({
    cancel() {
      cancelled = true;
    },
    pull(controller) {
      controller.enqueue(new TextEncoder().encode("x".repeat(96)));
    }
  });
  const chunkedTooLarge = await handler(
    new Request("https://resolver.example/v1/rely", {
      body: chunkedBody,
      duplex: "half",
      headers: { "content-type": "application/json" },
      method: "POST"
    })
  );
  assert.equal(chunkedTooLarge.status, 413);
  assert.equal(cancelled, true);

  const invalidBindingHandler = server.createAICRelianceHandler({
    store: server.createMemoryRelianceStore(snapshot())
  });
  const invalidBinding = await invalidBindingHandler(
    new Request("https://resolver.example/v1/rely", {
      body: JSON.stringify(evaluationBody({ expected_revision: "main" })),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
  );
  assert.equal(invalidBinding.status, 400);
  assert.equal((await json(invalidBinding)).code, "invalid_evaluation_request");

  const callerControlledTime = await invalidBindingHandler(
    new Request("https://resolver.example/v1/rely", {
      body: JSON.stringify(
        evaluationBody({ evaluated_at: "2020-01-01T00:00:00.000Z" })
      ),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
  );
  assert.equal(callerControlledTime.status, 400);
  assert.match(
    (await json(callerControlledTime)).message,
    /request\.evaluated_at is not supported/
  );

  const preflight = await handler(
    new Request("https://resolver.example/v1/rely", {
      headers: { origin: "https://agent.example" },
      method: "OPTIONS"
    })
  );
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://agent.example");

  const denied = await handler(
    new Request("https://resolver.example/v1/rely", {
      headers: { origin: "https://other.example" },
      method: "OPTIONS"
    })
  );
  assert.equal(denied.status, 403);
});

test("enabling local verification requires and enforces an operator rate limit", async () => {
  assert.throws(
    () =>
      server.createAICRelianceHandler({
        evaluator: () => allowDecision(),
        store: server.createMemoryRelianceStore(snapshot())
      }),
    /rely_rate_limit is required/
  );

  let evaluated = false;
  const handler = server.createAICRelianceHandler({
    evaluator() {
      evaluated = true;
      return allowDecision();
    },
    rely_rate_limit: () => false,
    store: server.createMemoryRelianceStore(snapshot())
  });
  const response = await handler(
    new Request("https://resolver.example/v1/rely", {
      body: JSON.stringify(evaluationBody()),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
  );
  assert.equal(response.status, 429);
  assert.equal((await json(response)).code, "rate_limit_exceeded");
  assert.equal(evaluated, false);
});

test("the resolver rejects duplicate JSON members before evaluation", async () => {
  let evaluated = false;
  const handler = server.createAICRelianceHandler({
    evaluator() {
      evaluated = true;
      return allowDecision();
    },
    rely_rate_limit: () => true,
    store: server.createMemoryRelianceStore(snapshot([]))
  });
  const original = JSON.stringify(evaluationBody());
  const duplicated = original.replace(
    '"origin":"https://shop.example"',
    '"origin":"https://shop.example","origin":"https://attacker.example"'
  );
  const response = await handler(
    new Request("https://resolver.example/v1/rely", {
      body: duplicated,
      headers: { "content-type": "application/json" },
      method: "POST"
    })
  );
  assert.equal(response.status, 400);
  assert.equal((await json(response)).code, "invalid_json");
  assert.equal(evaluated, false);
});

test("the resolver bounds JSON depth and node cardinality before evaluation", async () => {
  let evaluated = false;
  const handler = server.createAICRelianceHandler({
    evaluator() {
      evaluated = true;
      return allowDecision();
    },
    max_json_depth: 8,
    max_json_nodes: 32,
    rely_rate_limit: () => true,
    store: server.createMemoryRelianceStore(snapshot([]))
  });
  const tooDeep = `${'{"next":'.repeat(9)}null${"}".repeat(9)}`;
  const depthResponse = await handler(
    new Request("https://resolver.example/v1/rely", {
      body: tooDeep,
      headers: { "content-type": "application/json" },
      method: "POST"
    })
  );
  assert.equal(depthResponse.status, 400);
  assert.equal((await json(depthResponse)).code, "invalid_json");

  const tooMany = JSON.stringify(Array.from({ length: 32 }, () => null));
  const nodeResponse = await handler(
    new Request("https://resolver.example/v1/rely", {
      body: tooMany,
      headers: { "content-type": "application/json" },
      method: "POST"
    })
  );
  assert.equal(nodeResponse.status, 400);
  assert.equal((await json(nodeResponse)).code, "invalid_json");
  assert.equal(evaluated, false);
});

test("the resolver uses trusted time and denies a nonmatching allow-by-default policy", async () => {
  const statement = interop.attestation.statement;
  const unsafePolicy = {
    artifact_type: "aic_assurance_policy",
    id: "unsafe.allow-by-default",
    rules: [
      {
        id: "another-operation",
        match: { operation_ids: ["another.operation"] },
        require: { proof_status: "passed" }
      }
    ],
    spec: "aic.policy/0.1",
    unmatched: "allow"
  };
  const handler = server.createAICRelianceHandler({
    clock: () => "2026-08-29T12:05:00.000Z",
    evaluator: rely.evaluateAICReliance,
    rely_rate_limit: () => true,
    store: server.createMemoryRelianceStore(snapshot([]))
  });
  const response = await handler(
    new Request("https://resolver.example/v1/rely", {
      body: JSON.stringify({
        attestation: interop.attestation,
        contract: interop.contract,
        environment: statement.deployment.environment,
        expected_deployment_id: statement.deployment.deployment_id,
        expected_revision: statement.deployment.source_revision,
        observations: interop.observations,
        operation_id: statement.subject.operation_id,
        origin: statement.deployment.origin,
        policy: unsafePolicy,
        proof: interop.proof,
        trust_store: interop.trust_store
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
  );
  const body = await json(response);
  assert.equal(body.verdict, "deny");
  assert.equal(body.evaluation.evaluated_at, "2026-08-29T12:05:00.000Z");
  assert.ok(body.evaluation.reason_codes.includes("policy_not_fail_closed"));
  assert.ok(body.evaluation.reason_codes.includes("policy_rule_unmatched"));
});

test("the resolver rejects stale, expired, and timed-out evaluator results", async () => {
  const run = async ({ after, expiry, timeout = false }) => {
    let clockCalls = 0;
    const handler = server.createAICRelianceHandler({
      clock: () =>
        clockCalls++ < 2 ? "2026-08-29T12:02:00.000Z" : after,
      evaluator(input, context) {
        if (timeout) {
          return new Promise((_resolve, reject) => {
            context.signal.addEventListener("abort", () => reject(new Error("aborted")));
          });
        }
        const decision = allowDecisionForInput(input);
        if (expiry) decision.evidence_freshness.attestation_expires_at = expiry;
        return decision;
      },
      async_evaluator_timeout_ms: timeout ? 10 : 1000,
      max_decision_age_seconds: 60,
      rely_rate_limit: () => true,
      store: server.createMemoryRelianceStore(snapshot([]))
    });
    const response = await handler(
      new Request("https://resolver.example/v1/rely", {
        body: JSON.stringify(evaluationBody()),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    );
    return json(response);
  };

  const stale = await run({ after: "2026-08-29T12:03:01.000Z" });
  assert.equal(stale.verdict, "indeterminate");
  assert.deepEqual(stale.evaluation.reason_codes, ["local_verifier_stale_result"]);

  const expired = await run({
    after: "2026-08-29T12:02:31.000Z",
    expiry: "2026-08-29T12:02:30.000Z"
  });
  assert.equal(expired.verdict, "indeterminate");
  assert.deepEqual(expired.evaluation.reason_codes, ["local_verifier_stale_result"]);

  const timedOut = await run({
    after: "2026-08-29T12:02:00.000Z",
    timeout: true
  });
  assert.equal(timedOut.verdict, "indeterminate");
  assert.deepEqual(timedOut.evaluation.reason_codes, ["local_verifier_timeout"]);
});

test("the async evaluator timeout does not claim to preempt synchronous CPU work", async () => {
  const handler = server.createAICRelianceHandler({
    async_evaluator_timeout_ms: 1,
    clock: () => "2026-08-29T12:02:00.000Z",
    evaluator(input) {
      const stopAt = Date.now() + 10;
      while (Date.now() < stopAt) {
        // Deliberately block the event loop to prove this limit is async-only.
      }
      return allowDecisionForInput(input);
    },
    rely_rate_limit: () => true,
    store: server.createMemoryRelianceStore(snapshot([]))
  });
  const response = await handler(
    new Request("https://resolver.example/v1/rely", {
      body: JSON.stringify(evaluationBody()),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
  );
  assert.equal((await json(response)).verdict, "allow");
});

test("local store failures produce a stable fail-closed service response", async () => {
  const handler = server.createAICRelianceHandler({
    store: {
      exportSnapshot() {
        throw new Error("private storage detail");
      },
      query() {
        throw new Error("private storage detail");
      }
    }
  });
  const response = await handler(new Request(exactQuery()));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await json(response), {
    artifact_type: "aic_reliance_error",
    code: "resolver_unavailable",
    message: "The resolver could not complete the local request.",
    spec: "aic.reliance-server/0.1"
  });
});
