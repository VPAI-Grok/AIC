import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  importWorkspaceModule,
  readJsonFile,
  resolveFromRepo
} from "./helpers.mjs";

const automation = await importWorkspaceModule(
  "packages/automation-core/dist/automation-core/src/index.js"
);
const packs = await importWorkspaceModule(
  "packages/conformance-packs/dist/conformance-packs/src/index.js"
);
const spec = await importWorkspaceModule("packages/spec/dist/index.js");
const harness = await importWorkspaceModule(
  "examples/nextjs-checkout-demo/aic-verification-harness.mjs"
);

const fixturePath = (...segments) =>
  resolveFromRepo("examples/nextjs-checkout-demo", ...segments);

const contract = await readJsonFile(fixturePath("aic-behavior-contract.json"));
const mapping = await readJsonFile(fixturePath("aic-conformance-mapping.json"));
const binding = await readJsonFile(fixturePath("aic-conformance-binding.json"));
const deterministicProof = await readJsonFile(fixturePath("aic-proof.json"));
const deterministicResult = await readJsonFile(fixturePath("aic-conformance-result.json"));
const browserObservations = await readJsonFile(fixturePath("aic-browser-observations.json"));
const browserProof = await readJsonFile(fixturePath("aic-browser-proof.json"));
const browserResult = await readJsonFile(fixturePath("aic-browser-conformance-result.json"));
const checkoutPack = packs.getAICBuiltInConformancePack("aic.pack.checkout");

function observation(scenarioId, surfaceId) {
  return browserObservations.observations.find(
    (candidate) =>
      candidate.scenario_id === scenarioId && candidate.surface_id === surfaceId
  );
}

function check(observationValue, requirementId) {
  return observationValue.checks.find(
    (candidate) => candidate.requirement_id === requirementId
  );
}

test("checkout authored mapping regenerates its digest-bound complete-profile binding", () => {
  assert.ok(checkoutPack);
  assert.equal(spec.validateAICBehaviorContract(contract).ok, true);
  assert.equal(spec.validateAICConformanceBinding(binding).ok, true);

  const regenerated = automation.createAICConformanceBinding({
    contract,
    pack: checkoutPack,
    profileId: "complete",
    requirementMap: mapping.requirement_map,
    scenarioMap: mapping.scenario_map,
    surfaceRoles: mapping.surface_roles
  });

  assert.deepEqual(regenerated, binding);
  assert.equal(binding.authored, true);
  assert.deepEqual(Object.keys(binding.scenario_map).sort(), [
    "authorization_denial",
    "business_failure",
    "confirmation_decline",
    "recovery",
    "success"
  ]);
  assert.deepEqual(binding.surface_roles, {
    agent: ["webmcp"],
    human: ["human-ui"]
  });
});

test("checkout deterministic proof passes all five scenario classes and complete conformance", async () => {
  const observations = await harness.collectAICBehaviorObservations({ contract });
  const regeneratedProof = automation.verifyAICBehavior({
    contract,
    generatedAt: deterministicProof.generated_at,
    observations
  });
  assert.deepEqual(regeneratedProof, deterministicProof);
  assert.equal(regeneratedProof.status, "passed");
  assert.equal(regeneratedProof.summary.scenarios, 5);
  assert.equal(regeneratedProof.summary.observations, 10);
  assert.ok(regeneratedProof.scenarios.every((scenario) => scenario.parity === "passed"));

  const regeneratedResult = automation.verifyAICConformance({
    binding,
    contract,
    generatedAt: deterministicResult.generated_at,
    pack: checkoutPack,
    proof: deterministicProof
  });
  assert.deepEqual(regeneratedResult, deterministicResult);
  assert.equal(regeneratedResult.status, "passed");
  assert.equal(regeneratedResult.level, "proof");
  assert.deepEqual(regeneratedResult.findings, []);
  assert.deepEqual(regeneratedResult.summary, {
    errors: 0,
    requirement_obligations: 11,
    scenario_obligations: 5,
    warnings: 0
  });
});

test("rendered human and native WebMCP checkout evidence passes the same complete profile", async () => {
  assert.equal(browserObservations.observations.length, 10);
  assert.deepEqual(
    [...new Set(browserObservations.observations.map((item) => item.scenario_id))],
    [
      "success",
      "authorization-denied",
      "confirmation-declined",
      "business-failure",
      "recovery"
    ]
  );

  const regeneratedProof = automation.verifyAICBehavior({
    contract,
    generatedAt: browserProof.generated_at,
    observations: browserObservations
  });
  assert.deepEqual(regeneratedProof, browserProof);
  assert.equal(regeneratedProof.status, "passed");
  assert.equal(regeneratedProof.summary.observations, 10);

  const regeneratedResult = automation.verifyAICConformance({
    binding,
    contract,
    generatedAt: browserResult.generated_at,
    pack: checkoutPack,
    proof: browserProof
  });
  assert.deepEqual(regeneratedResult, browserResult);
  assert.equal(regeneratedResult.status, "passed");
  assert.deepEqual(regeneratedResult.findings, []);

  for (const surfaceId of ["human-ui", "webmcp"]) {
    const failed = observation("business-failure", surfaceId);
    assert.ok(failed);
    assert.equal(failed.status, "failed");
    assert.equal(failed.error_code, "payment_provider_unavailable");
    assert.equal(check(failed, "execution.failure_isolated").passed, true);
    assert.deepEqual(check(failed, "execution.failure_isolated").actual, {
      attempt_count: 1,
      audit_count: 0,
      charge_count: 0,
      error_code: "payment_provider_unavailable"
    });

    const recovered = observation("recovery", surfaceId);
    assert.ok(recovered);
    assert.equal(recovered.status, "recovered");
    assert.equal(check(recovered, "payment.idempotent").passed, true);
    assert.deepEqual(check(recovered, "payment.idempotent").actual, {
      attempt_count: 2,
      audit_count: 1,
      charge_count: 1
    });
    assert.equal(check(recovered, "checkout.safe_recovery").passed, true);
  }

  for (const item of browserObservations.observations) {
    assert.equal(item.mode, "executed");
    assert.equal(item.evidence.length, 1);
    if (item.surface_id === "webmcp") {
      assert.equal(item.environment.native_webmcp, "true");
      assert.equal(item.environment.webmcp_api, "document.modelContext");
    }
    const screenshot = item.evidence[0];
    const bytes = await readFile(fixturePath(screenshot.ref));
    assert.equal(
      screenshot.digest,
      `sha256:${createHash("sha256").update(bytes).digest("hex")}`
    );
  }
});
