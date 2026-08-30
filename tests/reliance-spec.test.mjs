import assert from "node:assert/strict";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

import { importWorkspaceModule, readJsonFile, resolveFromRepo } from "./helpers.mjs";

const spec = await importWorkspaceModule("packages/spec/dist/index.js");
const verify = await importWorkspaceModule(
  "packages/verify-core/dist/verify-core/src/index.js"
);
const interop = await readJsonFile(
  resolveFromRepo("interop/aic-trust-0.1/valid/bundle.json")
);
const DIGEST = `sha256:${"a".repeat(64)}`;

function allowDecision() {
  const evaluatedAt = "2026-08-29T12:00:02.000Z";
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
        expected_origin: "https://interop.example",
        expected_revision: "a".repeat(40)
      },
      decision: "passed",
      evaluated_at: evaluatedAt,
      findings: [],
      policy: { digest: DIGEST, id: "consumer.policy" },
      rules: [{ findings: [], id: "interop", status: "passed" }],
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
      expected_deployment_id: "interop-1",
      expected_revision: "a".repeat(40),
      operation_id: "record.read.domain",
      origin: "https://interop.example"
    },
    spec: "aic.reliance/0.1",
    valid_until: "2026-08-29T12:01:02.000Z",
    verdict: "allow"
  };
}

function attestationRecord() {
  const statement = interop.attestation.statement;
  const inlineAttestation = structuredClone(interop.attestation);
  return {
    artifact_type: "aic_reliance_record",
    artifacts: {
      attestation: {
        digest: verify.createAICDigest(inlineAttestation),
        inline: inlineAttestation,
        media_type: "application/json"
      },
      proof: {
        digest: `sha256:${"b".repeat(64)}`,
        uri: "./proof.json"
      }
    },
    binding: {
      deployment_id: statement.deployment.deployment_id,
      operation_id: statement.subject.operation_id,
      origin: statement.deployment.origin,
      source_revision: statement.deployment.source_revision
    },
    id: "interop-record",
    indexed_at: "2026-08-29T12:00:00.000Z",
    spec: "aic.reliance-record/0.1"
  };
}

test("reliance record and snapshot validators preserve exact portable bindings", () => {
  const record = attestationRecord();
  assert.equal(
    spec.validateAICRelianceRecord(record, { createDigest: verify.createAICDigest }).ok,
    true
  );

  const snapshot = {
    artifact_type: "aic_reliance_snapshot",
    id: "mirror.example",
    records: [record],
    spec: "aic.reliance-snapshot/0.1",
    updated_at: "2026-08-29T12:01:00.000Z"
  };
  assert.equal(
    spec.validateAICRelianceSnapshot(snapshot, { createDigest: verify.createAICDigest }).ok,
    true
  );
});

test("reliance records reject an inline attestation bound to another deployment", () => {
  const record = attestationRecord();
  record.binding.deployment_id = "substituted-deployment";
  const result = spec.validateAICRelianceRecord(record, {
    createDigest: verify.createAICDigest
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.rule === "reliance_record.attestation_binding"));
});

test("reliance records reject non-plain or executable JSON lookalikes", () => {
  class Payload {
    value = "class-instance";
  }
  const accessor = {};
  Object.defineProperty(accessor, "value", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    }
  });
  const hiddenToJson = { value: "visible" };
  Object.defineProperty(hiddenToJson, "toJSON", {
    enumerable: false,
    value() {
      throw new Error("must not execute");
    }
  });

  for (const inline of [new Date(), new Payload(), accessor, hiddenToJson, new Array(2)]) {
    const record = attestationRecord();
    record.artifacts.proof.inline = inline;
    const result = spec.validateAICRelianceRecord(record, {
      createDigest: verify.createAICDigest
    });
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((issue) => issue.rule === "reliance_record.locator_inline"));
  }
});

test("reliance snapshots reject duplicate IDs and records newer than the snapshot", () => {
  const record = attestationRecord();
  const result = spec.validateAICRelianceSnapshot({
    artifact_type: "aic_reliance_snapshot",
    id: "mirror.example",
    records: [record, structuredClone(record)],
    spec: "aic.reliance-snapshot/0.1",
    updated_at: "2026-08-29T11:59:59.000Z"
  }, { createDigest: verify.createAICDigest });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.rule === "reliance_snapshot.record_id_unique"));
  assert.ok(result.issues.some((issue) => issue.rule === "reliance_snapshot.time_order"));
});

test("reliance records bind every inline artifact to its canonical digest", () => {
  const record = attestationRecord();
  record.artifacts.attestation.digest = DIGEST;
  const mismatch = spec.validateAICRelianceRecord(record, {
    createDigest: verify.createAICDigest
  });
  assert.equal(mismatch.ok, false);
  assert.ok(
    mismatch.issues.some(
      (issue) => issue.rule === "reliance_record.locator_digest_mismatch"
    )
  );

  const invalidAttestation = attestationRecord();
  invalidAttestation.artifacts.attestation.inline = {
    artifact_type: "aic_signed_attestation"
  };
  invalidAttestation.artifacts.attestation.digest = verify.createAICDigest(
    invalidAttestation.artifacts.attestation.inline
  );
  const invalid = spec.validateAICRelianceRecord(invalidAttestation, {
    createDigest: verify.createAICDigest
  });
  assert.equal(invalid.ok, false);
  assert.ok(
    invalid.issues.some(
      (issue) => issue.rule === "reliance_record.attestation_invalid"
    )
  );
});

test("allow decisions reject contradictory failure reasons", () => {
  const valid = allowDecision();
  assert.equal(spec.validateAICRelianceDecision(valid).ok, true);
  valid.reason_codes.push("trust_untrusted");
  const result = spec.validateAICRelianceDecision(valid);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.rule === "reliance.allow_reason_consistency"));
});

test("allow decisions require policy and artifact binding invariants", () => {
  const mutations = [
    (decision) => {
      delete decision.valid_until;
    },
    (decision) => {
      decision.valid_until = decision.evaluated_at;
    },
    (decision) => {
      decision.valid_until = "2026-08-29T12:01:02.001Z";
    },
    (decision) => {
      decision.artifact_digests = {};
    },
    (decision) => {
      decision.evidence_freshness.status = "stale";
    },
    (decision) => {
      decision.request.origin = "x";
    },
    (decision) => {
      decision.request.expected_revision = "main";
    },
    (decision) => {
      decision.policy_evaluation.rules[0].status = "not_applicable";
    },
    (decision) => {
      decision.policy_evaluation.subjects.contract_digest = `sha256:${"b".repeat(64)}`;
    },
    (decision) => {
      decision.evidence_freshness.proof_age_seconds = -1;
    },
    (decision) => {
      decision.evidence_freshness.status = "not_checked";
    },
    (decision) => {
      decision.evidence_freshness.attestation_expires_at = decision.evaluated_at;
    },
    (decision) => {
      delete decision.request.environment;
      delete decision.policy_evaluation.context.environment;
    }
  ];
  for (const mutate of mutations) {
    const decision = allowDecision();
    mutate(decision);
    assert.equal(spec.validateAICRelianceDecision(decision).ok, false);
  }
});

test("passed transparency must bind its index, trust store, and receipt warning", () => {
  const decision = allowDecision();
  decision.checks.transparency = "passed";
  decision.artifact_digests.transparency_index = DIGEST;
  decision.artifact_digests.transparency_trust_store = DIGEST;
  decision.policy_evaluation.subjects.transparency_index_digest = DIGEST;
  decision.policy_evaluation.subjects.transparency_trust_store_digest = DIGEST;
  decision.reason_codes.push("transparency_external_receipt_not_checked");
  assert.equal(spec.validateAICRelianceDecision(decision).ok, true);

  for (const mutate of [
    (value) => delete value.artifact_digests.transparency_index,
    (value) => delete value.policy_evaluation.subjects.transparency_trust_store_digest,
    (value) => {
      value.checks.transparency = "not_checked";
    }
  ]) {
    const invalid = structuredClone(decision);
    mutate(invalid);
    assert.equal(spec.validateAICRelianceDecision(invalid).ok, false);
  }
});

test("the public reliance schema encodes fail-closed allow and confirmation branches", async () => {
  const schema = await readJsonFile(resolveFromRepo("schemas/reliance-decision.schema.json"));
  const allowBranch = schema.allOf.find(
    (branch) => branch.if?.properties?.verdict?.const === "allow"
  );
  const confirmBranch = schema.allOf.find(
    (branch) => branch.if?.properties?.verdict?.const === "confirm"
  );
  assert.ok(allowBranch.then.required.includes("policy_evaluation"));
  assert.ok(allowBranch.then.required.includes("valid_until"));
  assert.ok(allowBranch.then.properties.request.required.includes("environment"));
  assert.ok(
    allowBranch.then.properties.policy_evaluation.properties.context.required.includes(
      "environment"
    )
  );
  assert.deepEqual(allowBranch.then.properties.evidence_freshness.properties.status.enum, [
    "fresh",
    "not_checked"
  ]);
  assert.ok(
    allowBranch.then.properties.artifact_digests.required.includes("attestation")
  );
  assert.equal(
    confirmBranch.then.properties.reason_codes.contains.const,
    "confirmation_required"
  );
});

test("structural-valid runtime-invalid reliance corpus keeps schemas non-authoritative", async () => {
  const [recordSchema, decisionSchema, policyEvaluationSchema] = await Promise.all([
    readJsonFile(resolveFromRepo("schemas/reliance-record.schema.json")),
    readJsonFile(resolveFromRepo("schemas/reliance-decision.schema.json")),
    readJsonFile(resolveFromRepo("schemas/policy-evaluation.schema.json"))
  ]);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajv.addFormat("date-time", {
    type: "string",
    validate: spec.isAICRfc3339DateTime
  });
  ajv.addSchema(policyEvaluationSchema);
  const validateRecordSchema = ajv.compile(recordSchema);
  const validateDecisionSchema = ajv.compile(decisionSchema);

  const digestMismatch = attestationRecord();
  digestMismatch.artifacts.attestation.digest = DIGEST;
  const invalidTypedInline = attestationRecord();
  invalidTypedInline.artifacts.attestation.inline = {
    artifact_type: "aic_signed_attestation"
  };
  invalidTypedInline.artifacts.attestation.digest = verify.createAICDigest(
    invalidTypedInline.artifacts.attestation.inline
  );

  for (const [id, record, expectedRule] of [
    ["inline-digest-mismatch", digestMismatch, "reliance_record.locator_digest_mismatch"],
    ["invalid-recognized-attestation", invalidTypedInline, "reliance_record.attestation_invalid"]
  ]) {
    assert.equal(validateRecordSchema(record), true, `${id}: ${ajv.errorsText(validateRecordSchema.errors)}`);
    const runtime = spec.validateAICRelianceRecord(record, {
      createDigest: verify.createAICDigest
    });
    assert.equal(runtime.ok, false, id);
    assert.ok(runtime.issues.some((issue) => issue.rule === expectedRule), id);
  }

  const wrongEvaluationTime = allowDecision();
  wrongEvaluationTime.policy_evaluation.evaluated_at = "2026-08-29T12:00:03.000Z";
  const wrongSubjectDigest = allowDecision();
  wrongSubjectDigest.policy_evaluation.subjects.contract_digest = `sha256:${"b".repeat(64)}`;
  const expiredAtEvaluation = allowDecision();
  expiredAtEvaluation.evidence_freshness.attestation_expires_at =
    expiredAtEvaluation.evaluated_at;
  const validityTooLong = allowDecision();
  validityTooLong.valid_until = "2026-08-29T12:01:02.001Z";

  for (const [id, decision] of [
    ["evaluation-time-binding", wrongEvaluationTime],
    ["policy-subject-binding", wrongSubjectDigest],
    ["expiry-ordering", expiredAtEvaluation],
    ["validity-maximum", validityTooLong]
  ]) {
    assert.equal(validateDecisionSchema(decision), true, `${id}: ${ajv.errorsText(validateDecisionSchema.errors)}`);
    assert.equal(spec.validateAICRelianceDecision(decision).ok, false, id);
  }

  assert.match(recordSchema.$comment, /never establishes trust or permission/);
  assert.match(decisionSchema.$comment, /never authorizes execution/);
});
