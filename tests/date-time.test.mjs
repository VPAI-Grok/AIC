import assert from "node:assert/strict";
import test from "node:test";

import { importWorkspaceModule, readJsonFile, resolveFromRepo } from "./helpers.mjs";

const spec = await importWorkspaceModule("packages/spec/dist/index.js");
const verify = await importWorkspaceModule(
  "packages/verify-core/dist/verify-core/src/index.js"
);
const rely = await importWorkspaceModule("packages/rely/dist/rely/src/index.js");
const server = await importWorkspaceModule(
  "packages/reliance-server/dist/reliance-server/src/index.js"
);
const interop = await readJsonFile(
  resolveFromRepo("interop/aic-trust-0.1/valid/bundle.json")
);

const DIGEST = `sha256:${"c".repeat(64)}`;
const REVISION = "a".repeat(40);

test("strict RFC 3339 validation checks calendar, clock, and offset fields", () => {
  for (const value of [
    "0000-02-29T00:00:00Z",
    "2000-02-29T23:59:59.123456Z",
    "2024-02-29t23:59:59z",
    "2026-08-29T12:00:00-00:00",
    "2026-08-29T12:00:00+23:59"
  ]) {
    assert.equal(spec.isAICRfc3339DateTime(value), true, value);
    assert.equal(spec.parseAICRfc3339DateTime(value), Date.parse(value), value);
  }

  for (const value of [
    "1900-02-29T00:00:00Z",
    "2023-02-29T00:00:00Z",
    "2024-00-01T00:00:00Z",
    "2024-04-31T00:00:00Z",
    "2024-13-01T00:00:00Z",
    "2026-02-31T12:00:00Z",
    "2026-08-29T24:00:00Z",
    "2026-08-29T23:60:00Z",
    "2026-08-29T23:59:60Z",
    "2026-08-29T12:00:00+24:00",
    "2026-08-29T12:00:00+12:60",
    "2026-08-29 12:00:00Z",
    "2026-08-29T12:00:00",
    "2026-08-29",
    null,
    0,
    new Date("2026-08-29T12:00:00Z")
  ]) {
    assert.equal(spec.isAICRfc3339DateTime(value), false, String(value));
    assert.equal(spec.parseAICRfc3339DateTime(value), undefined, String(value));
  }
});

test("public artifact validators reject impossible dates instead of Date.parse normalization", () => {
  const observations = structuredClone(interop.observations);
  observations.generated_at = "2026-02-31T12:00:00Z";
  assert.equal(spec.validateAICBehaviorObservationSet(observations).ok, false);

  const proof = structuredClone(interop.proof);
  proof.generated_at = "2023-02-29T12:00:00Z";
  assert.equal(spec.validateAICBehaviorProof(proof).ok, false);

  const attestation = structuredClone(interop.attestation);
  attestation.statement.issued_at = "2026-08-29T24:00:00Z";
  assert.equal(spec.validateAICSignedAttestation(attestation).ok, false);

  const trustStore = structuredClone(interop.trust_store);
  trustStore.updated_at = "2026-08-29T12:00:00+24:00";
  assert.equal(spec.validateAICTrustStore(trustStore).ok, false);

  const record = {
    artifact_type: "aic_reliance_record",
    artifacts: {
      attestation: { digest: DIGEST, uri: "https://evidence.example/attestation.json" },
      proof: { digest: DIGEST, uri: "https://evidence.example/proof.json" }
    },
    binding: {
      deployment_id: "production-1",
      operation_id: "checkout.submit",
      origin: "https://checkout.example",
      source_revision: REVISION
    },
    id: "strict-date-record",
    indexed_at: "2026-04-31T12:00:00Z",
    spec: "aic.reliance-record/0.1"
  };
  assert.equal(spec.validateAICRelianceRecord(record).ok, false);
});

test("verifier and reliance entrypoints fail closed on impossible caller times", async () => {
  const proof = verify.verifyAICBehavior({
    contract: interop.contract,
    generatedAt: "2026-02-31T12:00:00Z",
    observations: interop.observations
  });
  assert.equal(proof.status, "failed");
  assert.ok(proof.findings.some((finding) => finding.code === "generated_at_invalid"));

  assert.throws(
    () => verify.generateAICTrustKeyPair({
      generatedAt: "2023-02-29T12:00:00Z",
      issuerId: "strict-date-test"
    }),
    /ISO date-time/
  );
  assert.throws(
    () => verify.evaluateAICAssurancePolicy({
      contract: {},
      evaluatedAt: "2026-08-29T24:00:00Z",
      policy: {},
      proof: {}
    }),
    /ISO date-time/
  );

  const decision = rely.evaluateAICReliance({
    attestation: {},
    contract: {},
    environment: "production",
    evaluated_at: "2026-08-29T12:00:00+24:00",
    expected_deployment_id: "production-1",
    expected_revision: REVISION,
    observations: {},
    operation_id: "checkout.submit",
    origin: "https://checkout.example",
    policy: {},
    proof: {},
    trust_store: {}
  });
  assert.equal(decision.verdict, "indeterminate");
  assert.ok(decision.reason_codes.includes("artifacts_invalid"));

  const preflight = rely.createAICReliancePreflight(
    async () => ({
      attestation: {},
      contract: {},
      expected_deployment_id: "production-1",
      expected_revision: REVISION,
      observations: {},
      operation_id: "checkout.submit",
      origin: "https://checkout.example",
      policy: {},
      proof: {},
      trust_store: {}
    }),
    { clock: () => "2026-02-31T12:00:00Z" }
  );
  await assert.rejects(preflight({}), /clock must return a valid time/);
});

test("resolver rejects a non-RFC3339 string returned by its trusted clock", async () => {
  let evaluatorCalled = false;
  const handler = server.createAICRelianceHandler({
    clock: () => "2026-02-31T12:00:00Z",
    evaluator() {
      evaluatorCalled = true;
      throw new Error("must not execute");
    },
    rely_rate_limit: () => true,
    store: server.createMemoryRelianceStore({
      artifact_type: "aic_reliance_snapshot",
      id: "strict-date-snapshot",
      records: [],
      spec: "aic.reliance-snapshot/0.1",
      updated_at: "2026-08-29T12:00:00Z"
    })
  });
  const response = await handler(new Request("https://resolver.example/v1/rely", {
    body: JSON.stringify({
      attestation: {},
      contract: {},
      environment: "production",
      expected_deployment_id: "production-1",
      expected_revision: REVISION,
      observations: {},
      operation_id: "checkout.submit",
      origin: "https://checkout.example",
      policy: {},
      proof: {},
      trust_store: {}
    }),
    headers: { "content-type": "application/json" },
    method: "POST"
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.verdict, "indeterminate");
  assert.deepEqual(body.evaluation.reason_codes, ["local_verifier_error"]);
  assert.equal(evaluatorCalled, false);
});
