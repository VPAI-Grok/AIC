import assert from "node:assert/strict";
import test from "node:test";

import {
  createTempDir,
  importWorkspaceModule,
  readJsonFile,
  resolveFromRepo,
  runCli,
  writeJsonFile
} from "./helpers.mjs";

const spec = await importWorkspaceModule("packages/spec/dist/index.js");
const automation = await importWorkspaceModule(
  "packages/automation-core/dist/automation-core/src/index.js"
);
const harness = await importWorkspaceModule(
  "examples/nextjs-checkout-demo/aic-verification-harness.mjs"
);
const contractPath = resolveFromRepo(
  "examples/nextjs-checkout-demo/aic-behavior-contract.json"
);
const harnessPath = resolveFromRepo(
  "examples/nextjs-checkout-demo/aic-verification-harness.mjs"
);
const contract = await readJsonFile(contractPath);

test("checkout behavior contract is valid and produces executed parity proof", async () => {
  const validation = spec.validateAICBehaviorContract(contract);
  assert.equal(validation.ok, true);

  const observations = await harness.collectAICBehaviorObservations({ contract });
  const proof = automation.verifyAICBehavior({
    contract,
    generatedAt: "2026-08-28T00:00:00.000Z",
    observations
  });

  assert.equal(proof.status, "passed");
  assert.equal(proof.evidence_level, "executed");
  assert.equal(proof.summary.scenarios, 3);
  assert.equal(proof.summary.observations, 6);
  assert.equal(proof.summary.required_observations, 6);
  assert.deepEqual(proof.findings, []);
  assert.ok(proof.scenarios.every((scenario) => scenario.parity === "passed"));
});

test("behavior verification fails when a WebMCP outcome diverges from the human UI", async () => {
  const observations = await harness.collectAICBehaviorObservations({ contract });
  const divergent = structuredClone(observations);
  const webmcpSuccess = divergent.observations.find(
    (observation) =>
      observation.scenario_id === "success" && observation.surface_id === "webmcp"
  );
  webmcpSuccess.outcome.payment_status = "unpaid";

  const proof = automation.verifyAICBehavior({ contract, observations: divergent });

  assert.equal(proof.status, "failed");
  assert.ok(proof.findings.some((finding) => finding.code === "outcome_mismatch"));
  assert.ok(proof.findings.some((finding) => finding.code === "parity_mismatch"));
});

test("behavior verification requires explicit evidence that forbidden behavior did not occur", async () => {
  const observations = await harness.collectAICBehaviorObservations({ contract });
  const incomplete = structuredClone(observations);
  const webmcpDenied = incomplete.observations.find(
    (observation) =>
      observation.scenario_id === "authorization-denied" &&
      observation.surface_id === "webmcp"
  );
  webmcpDenied.checks = webmcpDenied.checks.filter(
    (check) => check.requirement_id !== "payment.charge"
  );

  const proof = automation.verifyAICBehavior({ contract, observations: incomplete });

  assert.equal(proof.status, "failed");
  assert.ok(
    proof.findings.some(
      (finding) =>
        finding.code === "forbidden_requirement_unchecked" &&
        finding.requirement_id === "payment.charge"
    )
  );
});

test("aic verify runs a trusted local harness and writes an inspectable proof", async () => {
  const tempDir = await createTempDir("aic-behavior-");
  const proofPath = resolveFromRepo(tempDir, "aic-proof.json");
  const result = await runCli([
    "verify",
    contractPath,
    "--harness",
    harnessPath,
    "--out-file",
    proofPath,
    "--generated-at",
    "2026-08-28T00:00:00.000Z"
  ]);

  assert.equal(result.code, 0, result.stderr);
  const proof = await readJsonFile(proofPath);
  assert.equal(proof.artifact_type, "aic_behavior_proof");
  assert.equal(proof.status, "passed");
  assert.equal(proof.generated_at, "2026-08-28T00:00:00.000Z");

  const inspection = await runCli(["inspect", proofPath]);
  assert.equal(inspection.code, 0, inspection.stderr);
  assert.match(inspection.stdout, /Status: passed/);
  assert.match(inspection.stdout, /Observations: 6\/6/);
});

test("CLI validates behavior contracts and verifies imported observation files", async () => {
  const validation = await runCli(["validate", "behavior", contractPath]);
  assert.equal(validation.code, 0, validation.stderr);
  assert.match(validation.stdout, /behavior contract is valid/);

  const tempDir = await createTempDir("aic-observations-");
  const observationsPath = resolveFromRepo(tempDir, "observations.json");
  const proofPath = resolveFromRepo(tempDir, "proof.json");
  const observations = await harness.collectAICBehaviorObservations({ contract });
  observations.observations.forEach((observation) => {
    observation.mode = "imported";
  });
  await writeJsonFile(observationsPath, observations);

  const verification = await runCli([
    "verify",
    contractPath,
    "--observations",
    observationsPath,
    "--out-file",
    proofPath,
    "--generated-at",
    "2026-08-28T00:00:00.000Z"
  ]);

  assert.equal(verification.code, 0, verification.stderr);
  const proof = await readJsonFile(proofPath);
  assert.equal(proof.status, "passed");
  assert.equal(proof.evidence_level, "imported");
});

test("behavior validators reject unknown fields and duplicate observation checks", async () => {
  const invalidContract = { ...structuredClone(contract), undocumented_policy: true };
  const contractValidation = spec.validateAICBehaviorContract(invalidContract);
  assert.equal(contractValidation.ok, false);
  assert.ok(
    contractValidation.issues.some((issue) => issue.rule === "behavior.unknown_field")
  );

  const observations = await harness.collectAICBehaviorObservations({ contract });
  observations.observations[0].checks.push(
    structuredClone(observations.observations[0].checks[0])
  );
  const observationValidation = spec.validateAICBehaviorObservationSet(observations);
  assert.equal(observationValidation.ok, false);
  assert.ok(
    observationValidation.issues.some(
      (issue) => issue.rule === "behavior_observation.check_unique"
    )
  );
});
