import assert from "node:assert/strict";
import test from "node:test";

import { importWorkspaceModule, readJsonFile, resolveFromRepo } from "./helpers.mjs";

const spec = await importWorkspaceModule("packages/spec/dist/index.js");
const automation = await importWorkspaceModule("packages/automation-core/dist/automation-core/src/index.js");
const contract = {
  artifact_type: "aic_behavior_contract",
  spec: "aic.behavior/0.1",
  id: "policy.checkout.behavior",
  title: "Policy checkout fixture",
  description: "Stable policy fixture independent of evolving examples",
  action: { id: "checkout.complete", operation_id: "checkout.complete.domain", risk: "critical" },
  surfaces: [
    { id: "human", kind: "human_ui", label: "Human", entrypoint: "checkout.button" },
    { id: "agent", kind: "webmcp", label: "Agent", entrypoint: "checkout_tool" }
  ],
  requirements: [{ id: "result.correct", phase: "postcondition", description: "Expected result is produced" }],
  scenarios: [
    { id: "success", title: "Success", surfaces: ["human", "agent"], parity: "required", expected: { status: "succeeded", required_requirements: ["result.correct"], outcome: { result: "success" } } },
    { id: "authorization-denied", title: "Denied", surfaces: ["human", "agent"], parity: "required", expected: { status: "denied", required_requirements: ["result.correct"], outcome: { result: "denied" } } },
    { id: "confirmation-declined", title: "Declined", surfaces: ["human", "agent"], parity: "required", expected: { status: "cancelled", required_requirements: ["result.correct"], outcome: { result: "declined" } } }
  ]
};
const observations = {
  artifact_type: "aic_behavior_observation_set",
  contract_id: contract.id,
  generated_at: "2026-08-29T16:38:41.096Z",
  observations: contract.scenarios.flatMap((scenario) => scenario.surfaces.map((surfaceId) => ({
    artifact_type: "aic_behavior_observation",
    captured_at: "2026-08-29T16:38:41.096Z",
    checks: [{ actual: true, passed: true, requirement_id: "result.correct" }],
    contract_id: contract.id,
    mode: "executed",
    operation_id: contract.action.operation_id,
    outcome: scenario.expected.outcome,
    scenario_id: scenario.id,
    status: scenario.expected.status,
    surface_id: surfaceId
  })))
};
const GENERATED_AT = "2026-08-29T16:38:52.379Z";
const EVALUATED_AT = "2026-08-29T17:00:00.000Z";
const ORIGIN = "https://checkout.example";
const REVISION = "a".repeat(40);
const proof = automation.verifyAICBehavior({ contract, generatedAt: GENERATED_AT, observations });

function policy(requirements, extraRules = []) {
  return {
    artifact_type: "aic_assurance_policy",
    spec: "aic.policy/0.1",
    id: "test.policy",
    unmatched: "fail",
    rules: [
      { id: "critical", match: { risks: ["critical"] }, require: requirements },
      ...extraRules
    ]
  };
}

test("policy evaluation regenerates evidence and applies every matching rule", () => {
  const value = policy(
    {
      proof_status: "passed",
      allowed_evidence_levels: ["executed"],
      observations_required: true,
      maximum_observation_age_seconds: 3600,
      maximum_proof_age_seconds: 3600,
      parity: "all_required",
      required_surface_kinds: ["human_ui", "webmcp"]
    },
    [{ id: "checkout", match: { operation_ids: ["checkout.complete.domain"] }, require: { required_scenario_ids: ["success", "authorization-denied", "confirmation-declined"] } }]
  );
  assert.equal(spec.validateAICAssurancePolicy(value).ok, true);
  const result = automation.evaluateAICAssurancePolicy({ contract, evaluatedAt: EVALUATED_AT, observations, policy: value, proof });
  assert.equal(result.decision, "passed");
  assert.equal(spec.validateAICPolicyEvaluation(result).ok, true);
  assert.deepEqual(result.rules.map((rule) => rule.status), ["passed", "passed"]);

  const failing = structuredClone(value);
  failing.rules[1].require.required_scenario_ids.push("recovery");
  const failed = automation.evaluateAICAssurancePolicy({ contract, evaluatedAt: EVALUATED_AT, observations, policy: failing, proof });
  assert.equal(failed.decision, "failed");
  assert.equal(spec.validateAICPolicyEvaluation(failed).ok, true);
  assert.equal(failed.rules[0].status, "passed");
  assert.equal(failed.rules[1].status, "failed");
  assert.ok(failed.findings.some((finding) => finding.code === "scenario_required"));
});

test("policy fails unmatched contracts and evidence that cannot regenerate the proof", () => {
  const unmatched = policy({ proof_status: "passed" });
  unmatched.rules[0].match = { risks: ["low"] };
  const unmatchedResult = automation.evaluateAICAssurancePolicy({ contract, evaluatedAt: EVALUATED_AT, observations, policy: unmatched, proof });
  assert.equal(unmatchedResult.decision, "failed");
  assert.ok(unmatchedResult.findings.some((finding) => finding.code === "unmatched_policy"));

  const changed = structuredClone(observations);
  changed.observations[0].checks[0].actual = false;
  const mismatch = automation.evaluateAICAssurancePolicy({ contract, evaluatedAt: EVALUATED_AT, observations: changed, policy: policy({ observations_required: true }), proof });
  assert.equal(mismatch.decision, "failed");
  assert.ok(mismatch.findings.some((finding) => finding.code === "proof_regeneration_mismatch"));

  const absent = automation.evaluateAICAssurancePolicy({ contract, evaluatedAt: EVALUATED_AT, policy: policy({ proof_status: "passed" }), proof });
  assert.equal(absent.decision, "failed");
  assert.ok(absent.findings.some((finding) => finding.code === "observations_required"));
});

test("freshness uses exact boundaries and rejects future evidence", () => {
  const generated = "2026-08-29T16:59:00.000Z";
  const freshProof = automation.verifyAICBehavior({ contract, generatedAt: generated, observations });
  const exact = automation.evaluateAICAssurancePolicy({ contract, evaluatedAt: "2026-08-29T17:00:00.000Z", observations, policy: policy({ maximum_proof_age_seconds: 60 }), proof: freshProof });
  assert.equal(exact.decision, "passed");
  const stale = automation.evaluateAICAssurancePolicy({ contract, evaluatedAt: "2026-08-29T17:00:00.001Z", observations, policy: policy({ maximum_proof_age_seconds: 60 }), proof: freshProof });
  assert.ok(stale.findings.some((finding) => finding.code === "proof_age_exceeded"));
  const future = automation.evaluateAICAssurancePolicy({ contract, evaluatedAt: "2026-08-29T16:58:59.999Z", observations, policy: policy({ maximum_proof_age_seconds: 60 }), proof: freshProof });
  assert.ok(future.findings.some((finding) => finding.code === "future_evidence"));
});

test("reliance policy pins exact issuer key and runner identity in addition to trust bindings", () => {
  const keys = automation.generateAICTrustKeyPair({ allowedOrigins: [ORIGIN], generatedAt: "2026-08-29T15:00:00.000Z", issuerId: "independent.runner" });
  const attestation = automation.createAICSignedAttestation({
    contract,
    deployment: { deployed_at: "2026-08-29T16:00:00.000Z", deployment_id: "production-1", environment: "production", origin: ORIGIN, source_revision: REVISION },
    expiresAt: "2026-08-29T18:00:00.000Z",
    issuedAt: "2026-08-29T16:50:00.000Z",
    issuer: { id: "independent.runner", kind: "organization" },
    privateKeyPem: keys.private_key_pem,
    proof,
    runner: { id: "runner.us-east-1", kind: "remote" }
  });
  const trustedPolicy = policy({
    observations_required: true,
    attestation: {
      required: true,
      require_expiry: true,
      maximum_age_seconds: 3600,
      maximum_validity_seconds: 7200,
      allowed_issuer_ids: ["independent.runner"],
      allowed_key_ids: [keys.key_id],
      allowed_runner_ids: ["runner.us-east-1"],
      allowed_runner_kinds: ["remote"],
      require_expected_origin: true,
      require_expected_revision: true,
      observations_not_before_deployment: true
    }
  });
  const result = automation.evaluateAICAssurancePolicy({ attestation, contract, evaluatedAt: EVALUATED_AT, expectedOrigin: ORIGIN, expectedRevision: REVISION, observations, policy: trustedPolicy, proof, trustStore: keys.trust_store });
  assert.equal(result.decision, "passed");

  const wrongKey = structuredClone(trustedPolicy);
  wrongKey.rules[0].require.attestation.allowed_key_ids = [`sha256:${"f".repeat(64)}`];
  const refused = automation.evaluateAICAssurancePolicy({ attestation, contract, evaluatedAt: EVALUATED_AT, expectedOrigin: ORIGIN, expectedRevision: REVISION, observations, policy: wrongKey, proof, trustStore: keys.trust_store });
  assert.ok(refused.findings.some((finding) => finding.code === "attestation_key_disallowed"));
});

test("checked-in critical policy validates", async () => {
  const value = await readJsonFile(resolveFromRepo("policies/critical-assurance.json"));
  assert.equal(spec.validateAICAssurancePolicy(value).ok, true);
});

test("required transparency policy includes an explicit rollback defense", () => {
  const unsafe = policy({ transparency: { required: true } });
  const invalid = spec.validateAICAssurancePolicy(unsafe);
  assert.equal(invalid.ok, false);
  assert.ok(
    invalid.issues.some(
      (issue) => issue.rule === "policy.transparency_rollback_defense"
    )
  );
  unsafe.rules[0].require.transparency.maximum_checkpoint_age_seconds = 300;
  assert.equal(spec.validateAICAssurancePolicy(unsafe).ok, true);

  const zeroMinimum = policy({
    transparency: { maximum_checkpoint_age_seconds: 300, minimum_size: 0, required: true }
  });
  const zeroMinimumResult = spec.validateAICAssurancePolicy(zeroMinimum);
  assert.equal(zeroMinimumResult.ok, false);
  assert.ok(
    zeroMinimumResult.issues.some(
      (issue) =>
        issue.path.endsWith(".minimum_size") && issue.rule === "policy.positive_integer"
    )
  );

  const sizeOnly = policy({ transparency: { minimum_size: 42, required: true } });
  const sizeOnlyResult = spec.validateAICAssurancePolicy(sizeOnly);
  assert.equal(sizeOnlyResult.ok, false);
  assert.ok(
    sizeOnlyResult.issues.some(
      (issue) => issue.rule === "policy.transparency_rollback_defense"
    )
  );
});
