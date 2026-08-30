import assert from "node:assert/strict";
import test from "node:test";

import { importWorkspaceModule } from "./helpers.mjs";

const automation = await importWorkspaceModule("packages/automation-core/dist/automation-core/src/index.js");
const cli = await importWorkspaceModule("packages/cli/dist/cli/src/ecosystem.js");
const rely = await importWorkspaceModule("packages/rely/dist/rely/src/index.js");
const spec = await importWorkspaceModule("packages/spec/dist/index.js");

const EVALUATED_AT = "2026-08-29T17:00:00.000Z";
const ORIGIN = "https://checkout.example";
const DEPLOYMENT_ID = "production-2026-08-29";
const REVISION = "a".repeat(40);

const contract = {
  artifact_type: "aic_behavior_contract",
  spec: "aic.behavior/0.1",
  id: "rely.checkout.behavior",
  title: "Reliance checkout fixture",
  description: "A consequential operation exposed through human and agent surfaces",
  action: {
    id: "checkout.complete",
    operation_id: "checkout.complete.domain",
    risk: "critical"
  },
  surfaces: [
    { id: "human", kind: "human_ui", label: "Human", entrypoint: "checkout.button" },
    { id: "agent", kind: "webmcp", label: "Agent", entrypoint: "checkout_tool" }
  ],
  requirements: [
    { id: "result.correct", phase: "postcondition", description: "The expected outcome is produced" }
  ],
  scenarios: [
    {
      id: "success",
      title: "Success",
      surfaces: ["human", "agent"],
      parity: "required",
      expected: {
        status: "succeeded",
        required_requirements: ["result.correct"],
        outcome: { result: "success" }
      }
    },
    {
      id: "authorization-denied",
      title: "Authorization denied",
      surfaces: ["human", "agent"],
      parity: "required",
      expected: {
        status: "denied",
        required_requirements: ["result.correct"],
        outcome: { result: "denied" }
      }
    },
    {
      id: "confirmation-declined",
      title: "Confirmation declined",
      surfaces: ["human", "agent"],
      parity: "required",
      expected: {
        status: "cancelled",
        required_requirements: ["result.correct"],
        outcome: { result: "declined" }
      }
    }
  ]
};

const observations = {
  artifact_type: "aic_behavior_observation_set",
  contract_id: contract.id,
  generated_at: "2026-08-29T16:38:00.000Z",
  observations: contract.scenarios.flatMap((scenario) =>
    scenario.surfaces.map((surfaceId) => ({
      artifact_type: "aic_behavior_observation",
      captured_at: "2026-08-29T16:38:00.000Z",
      checks: [{ actual: true, passed: true, requirement_id: "result.correct" }],
      contract_id: contract.id,
      mode: "executed",
      operation_id: contract.action.operation_id,
      outcome: scenario.expected.outcome,
      scenario_id: scenario.id,
      status: scenario.expected.status,
      surface_id: surfaceId
    }))
  )
};

const proof = automation.verifyAICBehavior({
  contract,
  generatedAt: "2026-08-29T16:40:00.000Z",
  observations
});

const policy = {
  artifact_type: "aic_assurance_policy",
  spec: "aic.policy/0.1",
  id: "rely.critical.production",
  unmatched: "fail",
  rules: [
    {
      id: "critical-production",
      match: {
        environments: ["production"],
        operation_ids: [contract.action.operation_id],
        risks: ["critical"]
      },
      require: {
        allowed_evidence_levels: ["executed"],
        attestation: {
          allowed_issuer_ids: ["independent.runner"],
          allowed_runner_ids: ["runner.us-east-1"],
          allowed_runner_kinds: ["remote"],
          maximum_age_seconds: 3600,
          maximum_validity_seconds: 7200,
          observations_not_before_deployment: true,
          require_expected_origin: true,
          require_expected_revision: true,
          require_expiry: true,
          required: true
        },
        maximum_observation_age_seconds: 3600,
        maximum_proof_age_seconds: 3600,
        observations_required: true,
        parity: "all_required",
        proof_status: "passed",
        required_scenario_ids: ["success", "authorization-denied", "confirmation-declined"],
        required_surface_kinds: ["human_ui", "webmcp"]
      }
    }
  ]
};

function fixture(environment = "production") {
  const issuer = automation.generateAICTrustKeyPair({
    allowedOrigins: [ORIGIN],
    generatedAt: "2026-08-29T15:00:00.000Z",
    issuerId: "independent.runner"
  });
  policy.rules[0].require.attestation.allowed_key_ids = [issuer.key_id];
  const attestation = automation.createAICSignedAttestation({
    contract,
    deployment: {
      deployed_at: "2026-08-29T16:00:00.000Z",
      deployment_id: DEPLOYMENT_ID,
      environment,
      origin: ORIGIN,
      source_revision: REVISION
    },
    expiresAt: "2026-08-29T18:00:00.000Z",
    issuedAt: "2026-08-29T16:45:00.000Z",
    issuer: { id: "independent.runner", kind: "organization" },
    privateKeyPem: issuer.private_key_pem,
    proof,
    runner: { id: "runner.us-east-1", kind: "remote" }
  });
  return { attestation, issuer };
}

function input(overrides = {}) {
  const { attestation, issuer } = fixture();
  return {
    attestation,
    contract,
    environment: "production",
    evaluated_at: EVALUATED_AT,
    expected_deployment_id: DEPLOYMENT_ID,
    expected_revision: REVISION,
    observations,
    operation_id: contract.action.operation_id,
    origin: ORIGIN,
    policy: structuredClone(policy),
    proof,
    trust_store: issuer.trust_store,
    ...overrides
  };
}

function assertionOptions(value, clock = () => EVALUATED_AT) {
  return {
    clock,
    input: value
  };
}

test("local reliance allows only an exact, trusted, fresh, policy-passing deployment", () => {
  const result = rely.evaluateAICReliance(input());

  assert.equal(result.verdict, "allow");
  assert.deepEqual(result.checks, {
    artifacts: "passed",
    policy: "passed",
    request_binding: "passed",
    transparency: "not_checked",
    trust: "passed"
  });
  assert.equal(result.evidence_freshness.status, "fresh");
  assert.equal(result.evidence_freshness.proof_age_seconds, 1200);
  assert.ok(result.reason_codes.includes("requirements_satisfied"));
  assert.match(result.artifact_digests.attestation, /^sha256:[0-9a-f]{64}$/);
  assert.match(result.artifact_digests.policy, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.valid_until, "2026-08-29T17:01:00.000Z");
  assert.equal(spec.validateAICRelianceDecision(result).ok, true);
});

test("a missing consumer environment cannot select weaker signed-deployment policy", () => {
  const staging = fixture("staging");
  const weakerPolicy = structuredClone(policy);
  weakerPolicy.rules.push({
    id: "weaker-staging",
    match: {
      environments: ["staging"],
      operation_ids: [contract.action.operation_id],
      risks: ["critical"]
    },
    require: { proof_status: "passed" }
  });
  const withoutEnvironment = input({
    attestation: staging.attestation,
    policy: weakerPolicy,
    trust_store: staging.issuer.trust_store
  });
  delete withoutEnvironment.environment;
  const result = rely.evaluateAICReliance(withoutEnvironment);
  assert.equal(result.verdict, "indeterminate");
  assert.equal(result.request.environment, undefined);
  assert.equal(result.policy_evaluation, undefined);
  assert.ok(result.reason_codes.includes("request_environment_invalid"));
  assert.equal(spec.validateAICRelianceDecision(result).ok, true);
});

test("exact deployment and operation mismatches fail closed independently of policy", () => {
  const wrongDeployment = rely.evaluateAICReliance(input({ expected_deployment_id: "production-other" }));
  assert.equal(wrongDeployment.verdict, "deny");
  assert.equal(wrongDeployment.checks.request_binding, "failed");
  assert.ok(wrongDeployment.reason_codes.includes("binding_deployment_mismatch"));

  const wrongOperation = rely.evaluateAICReliance(input({ operation_id: "checkout.refund.domain" }));
  assert.equal(wrongOperation.verdict, "deny");
  assert.ok(wrongOperation.reason_codes.includes("binding_operation_mismatch"));
  assert.equal(spec.validateAICRelianceDecision(wrongOperation).ok, true);
});

test("malformed artifacts are indeterminate while untrusted valid artifacts are denied", () => {
  const malformed = rely.evaluateAICReliance(input({ trust_store: {} }));
  assert.equal(malformed.verdict, "indeterminate");
  assert.equal(malformed.checks.artifacts, "failed");
  assert.deepEqual(malformed.reason_codes, ["artifacts_invalid"]);

  const other = automation.generateAICTrustKeyPair({
    allowedOrigins: [ORIGIN],
    generatedAt: "2026-08-29T15:00:00.000Z",
    issuerId: "other.runner"
  });
  const untrusted = rely.evaluateAICReliance(input({ trust_store: other.trust_store }));
  assert.equal(untrusted.verdict, "deny");
  assert.equal(untrusted.checks.trust, "failed");
  assert.ok(untrusted.reason_codes.includes("trust_untrusted"));
});

test("malformed runtime options fail closed without throwing", () => {
  const base = input();
  const dispositionAccessor = {};
  Object.defineProperty(dispositionAccessor, "on_passed", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    }
  });
  for (const disposition of [
    { on_indeterminate: "allow" },
    { on_passed: "confirm", typo: true },
    Object.assign(Object.create({ inherited: true }), { on_passed: "confirm" }),
    dispositionAccessor
  ]) {
    const malformedDisposition = rely.evaluateAICReliance({ ...base, disposition });
    assert.equal(malformedDisposition.verdict, "indeterminate");
    assert.ok(malformedDisposition.reason_codes.includes("artifacts_invalid"));
  }

  const accessor = {};
  Object.defineProperty(accessor, "index", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    }
  });
  Object.defineProperty(accessor, "trust_store", {
    enumerable: true,
    value: base.trust_store
  });
  for (const transparency of [
    {},
    { index: undefined, trust_store: undefined },
    accessor
  ]) {
    const result = rely.evaluateAICReliance({ ...base, transparency });
    assert.notEqual(result.verdict, "allow");
    assert.ok(
      result.reason_codes.includes("artifacts_invalid") ||
        result.reason_codes.includes("transparency_invalid")
    );
  }
});

test("consumer freshness limits and attestation expiry produce a stable stale denial", () => {
  const stale = rely.evaluateAICReliance(input({ evaluated_at: "2026-08-29T18:00:00.000Z" }));

  assert.equal(stale.verdict, "deny");
  assert.equal(stale.evidence_freshness.status, "stale");
  assert.ok(stale.reason_codes.includes("evidence_stale"));
  assert.ok(stale.reason_codes.includes("policy_failed"));
  assert.equal(spec.validateAICRelianceDecision(stale).ok, true);
});

test("future evidence under a weak policy returns a denial instead of throwing", () => {
  const base = input();
  const weakPolicy = structuredClone(base.policy);
  delete weakPolicy.rules[0].require.maximum_observation_age_seconds;
  delete weakPolicy.rules[0].require.maximum_proof_age_seconds;
  delete weakPolicy.rules[0].require.attestation.maximum_age_seconds;
  delete weakPolicy.rules[0].require.attestation.require_expiry;

  const result = rely.evaluateAICReliance(
    { ...base, evaluated_at: "2026-08-29T16:30:00.000Z", policy: weakPolicy }
  );
  assert.equal(result.verdict, "deny");
  assert.equal(result.evidence_freshness.status, "future");
  assert.ok(result.reason_codes.includes("evidence_future"));
  assert.equal(spec.validateAICRelianceDecision(result).ok, true);
});

test("an unmatched allow policy can never authorize reliance", () => {
  const base = input();
  const unsafePolicy = structuredClone(base.policy);
  unsafePolicy.unmatched = "allow";
  unsafePolicy.rules[0].match.operation_ids = ["another.operation"];

  const result = rely.evaluateAICReliance({ ...base, policy: unsafePolicy });
  assert.equal(result.policy_evaluation.decision, "failed");
  assert.equal(result.checks.policy, "failed");
  assert.equal(result.verdict, "deny");
  assert.ok(result.reason_codes.includes("policy_not_fail_closed"));
  assert.ok(result.reason_codes.includes("policy_rule_unmatched"));
  assert.equal(spec.validateAICRelianceDecision(result).ok, true);
});

test("confirmation remains non-executable until a caller completes a real confirmation flow", async () => {
  const confirmationInput = input({ disposition: { on_passed: "confirm" } });
  const confirmation = rely.evaluateAICReliance(confirmationInput);
  assert.equal(confirmation.verdict, "confirm");
  assert.ok(confirmation.reason_codes.includes("confirmation_required"));
  assert.throws(
    () => rely.assertAICRelianceAllowed(confirmation, assertionOptions(confirmationInput)),
    (error) =>
      error instanceof rely.AICReliancePreflightError &&
      assert.deepEqual(error.result, confirmation) === undefined
  );

  const preflight = rely.createAICReliancePreflight(async () => input({ disposition: { on_passed: "confirm" } }));
  await assert.rejects(preflight({}), (error) => error instanceof rely.AICReliancePreflightError);
});

test("the exported allow guard rejects forged and contradictory decisions", () => {
  const relianceInput = input();
  assert.throws(
    () => rely.assertAICRelianceAllowed({ verdict: "allow" }, assertionOptions(relianceInput)),
    (error) =>
      error instanceof rely.AICInvalidRelianceDecisionError &&
      error.code === "AIC_RELIANCE_DECISION_INVALID"
  );

  const contradictory = structuredClone(rely.evaluateAICReliance(input()));
  assert.equal(contradictory.verdict, "allow");
  contradictory.checks.trust = "failed";
  contradictory.evidence_freshness.status = "stale";
  contradictory.reason_codes.push("evidence_stale");

  assert.throws(
    () => rely.assertAICRelianceAllowed(contradictory, assertionOptions(relianceInput)),
    (error) => error instanceof rely.AICInvalidRelianceDecisionError
  );
});

test("the allow guard snapshots raw decisions before validation and authorization", () => {
  const consumerInput = input();
  const malformedInput = { ...consumerInput, proof: {} };
  const indeterminate = rely.evaluateAICReliance(malformedInput);
  assert.equal(indeterminate.verdict, "indeterminate");
  assert.equal(indeterminate.checks.artifacts, "failed");

  let verdictReads = 0;
  const statefulDecision = new Proxy(indeterminate, {
    get(target, property, receiver) {
      if (property === "verdict") {
        verdictReads += 1;
        return verdictReads <= 5 ? "indeterminate" : "allow";
      }
      return Reflect.get(target, property, receiver);
    }
  });
  assert.throws(
    () => rely.assertAICRelianceAllowed(statefulDecision, assertionOptions(malformedInput)),
    (error) =>
      error instanceof rely.AICReliancePreflightError ||
      error instanceof rely.AICInvalidRelianceDecisionError
  );

  let accessorExecuted = false;
  const accessorDecision = structuredClone(indeterminate);
  Object.defineProperty(accessorDecision, "verdict", {
    enumerable: true,
    get() {
      accessorExecuted = true;
      return "allow";
    }
  });
  assert.throws(
    () => rely.assertAICRelianceAllowed(accessorDecision, assertionOptions(malformedInput)),
    (error) => error instanceof rely.AICInvalidRelianceDecisionError
  );
  assert.equal(accessorExecuted, false);

  const mutableInput = input();
  const mutableDecision = rely.evaluateAICReliance(mutableInput);
  const allowedSnapshot = rely.assertAICRelianceAllowed(mutableDecision, {
    clock() {
      mutableDecision.verdict = "deny";
      mutableInput.operation_id = "mutated.after.snapshot";
      return EVALUATED_AT;
    },
    input: mutableInput
  });
  assert.notEqual(allowedSnapshot, mutableDecision);
  assert.equal(allowedSnapshot.verdict, "allow");
  assert.equal(mutableDecision.verdict, "deny");
});

test("allow decisions bind their exact local policy evaluation and reject mutation", async () => {
  const relianceInput = input();
  const allowed = rely.evaluateAICReliance(relianceInput);
  rely.assertAICRelianceAllowed(allowed, assertionOptions(relianceInput));

  assert.throws(
    () => rely.assertAICRelianceAllowed(allowed),
    TypeError
  );

  const mutations = [
    (decision) => {
      decision.policy_evaluation.rules.forEach((rule) => {
        rule.status = "not_applicable";
      });
    },
    (decision) => {
      decision.policy_evaluation.evaluated_at = "2026-08-29T16:59:59.000Z";
    },
    (decision) => {
      decision.policy_evaluation.context.expected_origin = "https://other.example";
    },
    (decision) => {
      decision.policy_evaluation.policy.digest = `sha256:${"0".repeat(64)}`;
    },
    (decision) => {
      decision.policy_evaluation.subjects.proof_digest = `sha256:${"0".repeat(64)}`;
    }
  ];
  for (const mutate of mutations) {
    const forged = structuredClone(allowed);
    mutate(forged);
    assert.equal(spec.validateAICRelianceDecision(forged).ok, false);
    assert.throws(
      () => rely.assertAICRelianceAllowed(forged, assertionOptions(relianceInput)),
      (error) => error instanceof rely.AICInvalidRelianceDecisionError
    );
  }

  assert.throws(
    () =>
      rely.assertAICRelianceAllowed(allowed, {
        ...assertionOptions(
          relianceInput,
          () => "2026-08-29T18:00:00.000Z"
        ),
        max_decision_age_seconds: 7200
      }),
    (error) => error instanceof rely.AICRelianceDecisionNotCurrentError
  );

  const preflight = rely.createAICReliancePreflight(async () => input(), {
    clock: () => "2026-08-29T18:00:00.000Z"
  });
  await assert.rejects(
    preflight({}),
    (error) => error instanceof rely.AICReliancePreflightError
  );
});

test("local preflight rechecks trusted time after evaluation", async () => {
  const times = [
    "2026-08-29T17:00:00.000Z",
    "2026-08-29T18:00:00.000Z"
  ];
  const preflight = rely.createAICReliancePreflight(async () => input(), {
    clock: () => times.shift() ?? "2026-08-29T18:00:00.000Z"
  });
  await assert.rejects(
    preflight({}),
    (error) => error instanceof rely.AICReliancePreflightError
  );
});

test("consumer assertions reject artifact substitution and cross-audience replay", () => {
  const consumerInput = input();
  const producerChosenInput = input();
  const producerDecision = rely.evaluateAICReliance(producerChosenInput);
  assert.equal(producerDecision.verdict, "allow");
  assert.notEqual(
    producerDecision.artifact_digests.policy,
    rely.createAICRelianceArtifactDigests(consumerInput).policy
  );
  assert.throws(
    () =>
      rely.assertAICRelianceAllowed(
        producerDecision,
        assertionOptions(consumerInput)
      ),
    (error) => error instanceof rely.AICRelianceDecisionBindingError
  );

  const exact = assertionOptions(producerChosenInput);
  for (const [field, value] of [
    ["origin", "https://other.example"],
    ["operation_id", "checkout.refund.domain"],
    ["environment", "staging"]
  ]) {
    assert.throws(
      () =>
        rely.assertAICRelianceAllowed(producerDecision, {
          ...exact,
          input: {
            ...producerChosenInput,
            [field]: value
          }
        }),
      (error) => error instanceof rely.AICRelianceDecisionBindingError,
      field
    );
  }
});

test("portable allow deadlines close every policy freshness boundary", () => {
  const cases = [
    {
      deadline: "2026-08-29T17:00:00.001Z",
      mutate(value) {
        value.policy.rules[0].require.maximum_proof_age_seconds = 1200;
      },
      name: "proof"
    },
    {
      deadline: "2026-08-29T17:00:00.001Z",
      mutate(value) {
        value.policy.rules[0].require.maximum_observation_age_seconds = 1320;
      },
      name: "observations"
    },
    {
      deadline: "2026-08-29T17:00:00.001Z",
      mutate(value) {
        value.policy.rules[0].require.attestation.maximum_age_seconds = 900;
      },
      name: "attestation age"
    }
  ];

  for (const boundary of cases) {
    const value = input();
    boundary.mutate(value);
    const decision = rely.evaluateAICReliance(value);
    assert.equal(decision.verdict, "allow", boundary.name);
    assert.equal(decision.valid_until, boundary.deadline, boundary.name);
    rely.assertAICRelianceAllowed(decision, assertionOptions(value));
    assert.throws(
      () =>
        rely.assertAICRelianceAllowed(
          decision,
          assertionOptions(value, () => boundary.deadline)
        ),
      (error) => error instanceof rely.AICRelianceDecisionNotCurrentError,
      boundary.name
    );

    if (boundary.name === "proof") {
      const forgedDeadline = structuredClone(decision);
      forgedDeadline.valid_until = "2026-08-29T17:01:00.000Z";
      assert.equal(spec.validateAICRelianceDecision(forgedDeadline).ok, true);
      assert.throws(
        () =>
          rely.assertAICRelianceAllowed(
            forgedDeadline,
            assertionOptions(value, () => "2026-08-29T17:00:20.000Z")
          ),
        (error) => error instanceof rely.AICRelianceDecisionReproductionError
      );
    }
  }

  const expiring = input({ evaluated_at: "2026-08-29T17:59:59.000Z" });
  expiring.policy.rules[0].require.maximum_proof_age_seconds = 10_000;
  expiring.policy.rules[0].require.maximum_observation_age_seconds = 10_000;
  expiring.policy.rules[0].require.attestation.maximum_age_seconds = 10_000;
  const expiringDecision = rely.evaluateAICReliance(expiring);
  assert.equal(expiringDecision.verdict, "allow");
  assert.equal(expiringDecision.valid_until, "2026-08-29T18:00:00.000Z");
  assert.throws(
    () =>
      rely.assertAICRelianceAllowed(
        expiringDecision,
        assertionOptions(expiring, () => "2026-08-29T18:00:00.000Z")
      ),
    (error) => error instanceof rely.AICRelianceDecisionNotCurrentError
  );
});

test("allow assertions enforce residual validity at their post-reproduction clock sample", () => {
  const value = input();
  const decision = rely.evaluateAICReliance(value);
  assert.equal(decision.valid_until, "2026-08-29T17:01:00.000Z");

  assert.equal(
    rely.assertAICRelianceAllowed(decision, {
      ...assertionOptions(value, () => "2026-08-29T17:00:30.000Z"),
      minimum_validity_seconds: 30
    }).verdict,
    "allow"
  );
  assert.throws(
    () =>
      rely.assertAICRelianceAllowed(decision, {
        ...assertionOptions(value, () => "2026-08-29T17:00:30.001Z"),
        minimum_validity_seconds: 30
      }),
    (error) => error instanceof rely.AICRelianceDecisionNotCurrentError
  );

  for (const minimum_validity_seconds of [-1, 61, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () =>
        rely.assertAICRelianceAllowed(decision, {
          ...assertionOptions(value),
          minimum_validity_seconds
        }),
      TypeError
    );
  }

  let currentTime = EVALUATED_AT;
  const advancingInput = new Proxy(value, {
    ownKeys(target) {
      currentTime = "2026-08-29T17:00:30.001Z";
      return Reflect.ownKeys(target);
    }
  });
  assert.throws(
    () =>
      rely.assertAICRelianceAllowed(decision, {
        clock: () => currentTime,
        input: advancingInput,
        minimum_validity_seconds: 30
      }),
    (error) => error instanceof rely.AICRelianceDecisionNotCurrentError
  );
});

test("CLI allow publication invalidates a decision consumed by a slow write", async () => {
  const value = input();
  const decision = rely.evaluateAICReliance(value);
  const times = [EVALUATED_AT, "2026-08-29T17:00:31.000Z"];
  let published = false;
  let invalidated = false;
  const result = await cli.finalizeAICRelianceAllowPublication({
    clock: () => times.shift() ?? "2026-08-29T17:00:31.000Z",
    decision,
    input: value,
    invalidate: async () => {
      invalidated = true;
    },
    minimumValiditySeconds: 30,
    publish: async () => {
      published = true;
    }
  });
  assert.equal(published, true);
  assert.equal(invalidated, true);
  assert.equal(result.ok, false);
  assert.match(result.message, /less than 30 seconds of residual validity/);
});

test("a supplied transparency history must be separately trusted and contain the exact attestation", () => {
  const base = input();
  const log = automation.generateAICTrustKeyPair({
    generatedAt: "2026-08-29T15:00:00.000Z",
    issuerId: "independent.transparency.log"
  });
  const empty = automation.createAICTransparencyIndex({
    issuedAt: "2026-08-29T16:45:00.000Z",
    logId: "independent.transparency.log",
    privateKeyPem: log.private_key_pem
  });
  const requiredPolicy = structuredClone(base.policy);
  requiredPolicy.rules[0].require.transparency = {
    allowed_key_ids: [log.key_id],
    allowed_log_ids: ["independent.transparency.log"],
    maximum_checkpoint_age_seconds: 3600,
    required: true
  };
  const omitted = rely.evaluateAICReliance({ ...base, policy: requiredPolicy });
  assert.equal(omitted.verdict, "deny");
  assert.equal(omitted.checks.transparency, "failed");
  assert.ok(omitted.reason_codes.includes("transparency_required"));
  assert.ok(
    omitted.policy_evaluation.findings.some(
      (finding) => finding.code === "transparency_required"
    )
  );

  const missing = rely.evaluateAICReliance({
    ...base,
    policy: requiredPolicy,
    transparency: { index: empty, trust_store: log.trust_store }
  });
  assert.equal(missing.verdict, "deny");
  assert.ok(missing.reason_codes.includes("transparency_attestation_missing"));

  const index = automation.appendAICTransparencyEntry({
    artifact: base.attestation,
    expectedHead: null,
    expectedSize: 0,
    externalReceipts: [
      {
        artifact_digest: automation.createAICDigest(base.attestation),
        profile: "scitt-rfc9942",
        provider: "example-scitt",
        reference: "https://transparency.example/receipt/1"
      }
    ],
    index: empty,
    kind: "attestation",
    loggedAt: "2026-08-29T16:50:00.000Z",
    logTrustStore: log.trust_store,
    privateKeyPem: log.private_key_pem
  });
  const includedInput = {
    ...base,
    policy: requiredPolicy,
    transparency: { index, trust_store: log.trust_store }
  };
  const included = rely.evaluateAICReliance(includedInput);
  assert.equal(included.verdict, "allow");
  assert.equal(included.checks.transparency, "passed");
  assert.equal(
    included.policy_evaluation.subjects.transparency_index_digest,
    included.artifact_digests.transparency_index
  );
  assert.equal(
    included.policy_evaluation.subjects.transparency_trust_store_digest,
    included.artifact_digests.transparency_trust_store
  );
  assert.ok(included.reason_codes.includes("transparency_external_receipt_not_checked"));
  assert.equal(spec.validateAICRelianceDecision(included).ok, true);

  const checkpointBoundaryPolicy = structuredClone(requiredPolicy);
  checkpointBoundaryPolicy.rules[0].require.transparency.maximum_checkpoint_age_seconds = 600;
  const checkpointBoundaryInput = {
    ...base,
    policy: checkpointBoundaryPolicy,
    transparency: { index, trust_store: log.trust_store }
  };
  const checkpointBoundary = rely.evaluateAICReliance(
    checkpointBoundaryInput
  );
  assert.equal(checkpointBoundary.verdict, "allow");
  assert.equal(checkpointBoundary.valid_until, "2026-08-29T17:00:00.001Z");
  assert.throws(
    () =>
      rely.assertAICRelianceAllowed(
        checkpointBoundary,
        assertionOptions(
          checkpointBoundaryInput,
          () => "2026-08-29T17:00:00.001Z"
        )
      ),
    (error) => error instanceof rely.AICRelianceDecisionNotCurrentError
  );

  const wrongLogPolicy = structuredClone(requiredPolicy);
  wrongLogPolicy.rules[0].require.transparency.allowed_log_ids = ["another.log"];
  const wrongLog = rely.evaluateAICReliance({
    ...base,
    policy: wrongLogPolicy,
    transparency: { index, trust_store: log.trust_store }
  });
  assert.equal(wrongLog.verdict, "deny");
  assert.ok(wrongLog.reason_codes.includes("transparency_log_disallowed"));

  const successor = automation.appendAICTransparencyEntry({
    artifact: base.attestation,
    expectedHead: index.checkpoint.statement.head_entry_digest,
    expectedSize: 1,
    index,
    kind: "attestation",
    loggedAt: "2026-08-29T16:55:00.000Z",
    logTrustStore: log.trust_store,
    privateKeyPem: log.private_key_pem
  });
  const rollbackSafePolicy = structuredClone(requiredPolicy);
  rollbackSafePolicy.rules[0].require.transparency = {
    ...rollbackSafePolicy.rules[0].require.transparency,
    expected_checkpoint_digest: automation.createAICTransparencyCheckpointDigest(
      successor.checkpoint
    ),
    expected_prior_checkpoint_digest: automation.createAICTransparencyCheckpointDigest(
      index.checkpoint
    ),
    minimum_size: 2,
    require_consistency: true
  };
  const successorResult = rely.evaluateAICReliance({
    ...base,
    policy: rollbackSafePolicy,
    transparency: {
      index: successor,
      prior_index: index,
      trust_store: log.trust_store
    }
  });
  assert.equal(successorResult.verdict, "allow");

  const stateless = rely.evaluateAICReliance({
    ...base,
    policy: rollbackSafePolicy,
    transparency: { index: successor, trust_store: log.trust_store }
  });
  assert.equal(stateless.verdict, "deny");
  assert.ok(stateless.reason_codes.includes("transparency_consistency_required"));

  const rolledBack = rely.evaluateAICReliance({
    ...base,
    policy: rollbackSafePolicy,
    transparency: {
      index,
      prior_index: successor,
      trust_store: log.trust_store
    }
  });
  assert.equal(rolledBack.verdict, "deny");
  assert.ok(rolledBack.reason_codes.includes("transparency_inconsistent"));
  assert.ok(rolledBack.reason_codes.includes("transparency_checkpoint_mismatch"));
  assert.ok(rolledBack.reason_codes.includes("transparency_size_below_minimum"));

  const producerChosenOldPair = rely.evaluateAICReliance({
    ...base,
    policy: rollbackSafePolicy,
    transparency: {
      index,
      prior_index: empty,
      trust_store: log.trust_store
    }
  });
  assert.equal(producerChosenOldPair.verdict, "deny");
  assert.ok(
    producerChosenOldPair.reason_codes.includes(
      "transparency_prior_checkpoint_mismatch"
    )
  );
});
