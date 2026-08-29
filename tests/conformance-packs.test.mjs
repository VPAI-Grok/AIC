import assert from "node:assert/strict";
import test from "node:test";

import {
  createAICConformanceBinding,
  verifyAICConformance
} from "../packages/automation-core/dist/automation-core/src/conformance.js";
import { createAICDigest } from "../packages/automation-core/dist/automation-core/src/trust.js";
import {
  AIC_BUILTIN_CONFORMANCE_PACK_IDS,
  getAICBuiltInConformancePack,
  listAICBuiltInConformancePacks
} from "../packages/conformance-packs/dist/conformance-packs/src/index.js";
import {
  validateAICConformanceBinding,
  validateAICConformancePack,
  validateAICConformanceResult
} from "../packages/spec/dist/conformance.js";
import {
  readJsonFile,
  resolveFromRepo
} from "./helpers.mjs";

const GENERATED_AT = "2026-08-29T18:00:00.000Z";

function clone(value) {
  return structuredClone(value);
}

function createContractArtifacts(pack, profileId) {
  const profile = pack.profiles.find((candidate) => candidate.id === profileId);
  assert.ok(profile, `Unknown fixture profile: ${profileId}`);

  const requirementMap = Object.fromEntries(
    profile.requirements.map((obligation) => [obligation.id, [`contract.${obligation.id}`]])
  );
  const scenarioMap = Object.fromEntries(
    profile.scenarios.map((obligation) => [obligation.id, [`scenario.${obligation.id}`]])
  );
  const contract = {
    action: {
      id: `fixture.${profile.id}`,
      operation_id: `fixture.${profile.id}.domain`,
      risk: "critical"
    },
    artifact_type: "aic_behavior_contract",
    description: `Synthetic contract satisfying ${pack.id}/${profile.id}.`,
    id: `fixture.${profile.id}.behavior`,
    requirements: profile.requirements.map((obligation) => ({
      description: obligation.description,
      id: requirementMap[obligation.id][0],
      phase: obligation.phase
    })),
    scenarios: profile.scenarios.map((obligation) => ({
      expected: {
        ...(obligation.allowed_confirmations
          ? { confirmation: obligation.allowed_confirmations[0] }
          : {}),
        ...(obligation.forbidden_requirement_refs
          ? {
              forbidden_requirements: obligation.forbidden_requirement_refs.flatMap(
                (reference) => requirementMap[reference]
              )
            }
          : {}),
        required_requirements: obligation.requirement_refs.flatMap(
          (reference) => requirementMap[reference]
        ),
        status: obligation.allowed_statuses[0]
      },
      id: scenarioMap[obligation.id][0],
      parity: obligation.parity,
      surfaces: ["human-ui", "agent-tool"],
      title: `${obligation.class} fixture`
    })),
    spec: "aic.behavior/0.1",
    surfaces: [
      {
        entrypoint: "fixture.button",
        id: "human-ui",
        kind: "human_ui",
        label: "Fixture human control"
      },
      {
        entrypoint: "fixture_tool",
        id: "agent-tool",
        kind: "webmcp",
        label: "Fixture agent tool"
      }
    ],
    title: `${profile.title} fixture`
  };
  const binding = createAICConformanceBinding({
    contract,
    pack,
    profileId,
    requirementMap,
    scenarioMap,
    surfaceRoles: {
      agent: ["agent-tool"],
      human: ["human-ui"]
    }
  });
  const proofScenarios = contract.scenarios.map((scenario) => ({
    finding_count: 0,
    parity: scenario.parity === "required" ? "passed" : "not_required",
    scenario_id: scenario.id,
    status: "passed",
    surfaces: scenario.surfaces.map((surfaceId) => ({
      finding_count: 0,
      observation_mode: "executed",
      status: "passed",
      surface_id: surfaceId
    }))
  }));
  const proof = {
    artifact_type: "aic_behavior_proof",
    contract: {
      digest: createAICDigest(contract),
      id: contract.id,
      spec: contract.spec
    },
    evidence_level: "executed",
    findings: [],
    generated_at: GENERATED_AT,
    observations_digest: `sha256:${"1".repeat(64)}`,
    proof_version: "0.1",
    scenarios: proofScenarios,
    status: "passed",
    summary: {
      failed_scenarios: 0,
      observations: contract.scenarios.length * contract.surfaces.length,
      passed_scenarios: contract.scenarios.length,
      required_observations: contract.scenarios.length * contract.surfaces.length,
      scenarios: contract.scenarios.length
    }
  };

  return { binding, contract, pack, profile, proof, requirementMap, scenarioMap };
}

test("all built-in conformance packs validate and expose required scenario classes", () => {
  assert.deepEqual(AIC_BUILTIN_CONFORMANCE_PACK_IDS, [
    "aic.pack.checkout",
    "aic.pack.billing-mutation",
    "aic.pack.account-deletion",
    "aic.pack.admin-mutation",
    "aic.pack.record-crud"
  ]);
  const packs = listAICBuiltInConformancePacks();
  assert.equal(packs.length, 5);
  for (const pack of packs) {
    const validation = validateAICConformancePack(pack);
    assert.equal(validation.ok, true, `${pack.id}: ${JSON.stringify(validation.issues)}`);
    for (const profile of pack.profiles) {
      const represented = new Set(profile.scenarios.map((scenario) => scenario.class));
      for (const requiredClass of profile.required_scenario_classes) {
        assert.equal(represented.has(requiredClass), true, `${pack.id}/${profile.id}/${requiredClass}`);
      }
    }
  }
  assert.deepEqual(
    getAICBuiltInConformancePack("aic.pack.record-crud").profiles.map((profile) => profile.id),
    ["create", "read", "update", "delete"]
  );
  assert.equal(getAICBuiltInConformancePack("missing"), undefined);
});

test("authored digest-bound checkout binding passes contract and proof verification", () => {
  const pack = getAICBuiltInConformancePack("aic.pack.checkout");
  const fixture = createContractArtifacts(pack, "complete");

  const bindingValidation = validateAICConformanceBinding(fixture.binding);
  assert.equal(bindingValidation.ok, true, JSON.stringify(bindingValidation.issues));

  const contractResult = verifyAICConformance({
    binding: fixture.binding,
    contract: fixture.contract,
    generatedAt: GENERATED_AT,
    pack
  });
  assert.equal(contractResult.status, "passed");
  assert.equal(contractResult.level, "contract");
  assert.equal(contractResult.proof_digest, undefined);
  assert.equal(validateAICConformanceResult(contractResult).ok, true);

  const proofResult = verifyAICConformance({
    binding: fixture.binding,
    contract: fixture.contract,
    generatedAt: GENERATED_AT,
    pack,
    proof: fixture.proof
  });
  assert.equal(proofResult.status, "passed");
  assert.equal(proofResult.level, "proof");
  assert.equal(proofResult.pack_digest, createAICDigest(pack));
  assert.equal(proofResult.binding_digest, createAICDigest(fixture.binding));
  assert.equal(proofResult.contract_digest, createAICDigest(fixture.contract));
  assert.equal(proofResult.proof_digest, createAICDigest(fixture.proof));
  assert.equal(validateAICConformanceResult(proofResult).ok, true);
  assert.deepEqual(
    verifyAICConformance({
      binding: fixture.binding,
      contract: fixture.contract,
      generatedAt: GENERATED_AT,
      pack,
      proof: fixture.proof
    }),
    proofResult
  );
});

test("conformance verification fails closed for missing mappings and stale digests", () => {
  const pack = getAICBuiltInConformancePack("aic.pack.checkout");
  const fixture = createContractArtifacts(pack, "complete");
  const incomplete = clone(fixture.binding);
  delete incomplete.requirement_map.safe_recovery;
  delete incomplete.scenario_map.recovery;
  incomplete.pack.digest = `sha256:${"0".repeat(64)}`;

  const result = verifyAICConformance({
    binding: incomplete,
    contract: fixture.contract,
    generatedAt: GENERATED_AT,
    pack
  });
  assert.equal(result.status, "failed");
  const codes = new Set(result.findings.map((finding) => finding.code));
  assert.equal(codes.has("pack_binding_mismatch"), true);
  assert.equal(codes.has("requirement_obligation_missing"), true);
  assert.equal(codes.has("scenario_obligation_missing"), true);
});

test("conformance verification checks phases, confirmations, and surface roles", () => {
  const pack = getAICBuiltInConformancePack("aic.pack.checkout");
  const fixture = createContractArtifacts(pack, "complete");

  const wrongPhaseBinding = clone(fixture.binding);
  wrongPhaseBinding.requirement_map.exact_scope = [
    fixture.requirementMap.authorization_allowed[0]
  ];
  const phaseResult = verifyAICConformance({
    binding: wrongPhaseBinding,
    contract: fixture.contract,
    generatedAt: GENERATED_AT,
    pack
  });
  assert.equal(
    phaseResult.findings.some((finding) => finding.code === "requirement_phase_mismatch"),
    true
  );

  const weakContract = clone(fixture.contract);
  weakContract.scenarios.find(
    (scenario) => scenario.id === fixture.scenarioMap.confirmation_decline[0]
  ).expected.confirmation = "accepted";
  const weakBinding = createAICConformanceBinding({
    contract: weakContract,
    pack,
    profileId: "complete",
    requirementMap: fixture.requirementMap,
    scenarioMap: fixture.scenarioMap,
    surfaceRoles: { agent: ["agent-tool"], human: ["human-ui"] }
  });
  const confirmationResult = verifyAICConformance({
    binding: weakBinding,
    contract: weakContract,
    generatedAt: GENERATED_AT,
    pack
  });
  assert.equal(
    confirmationResult.findings.some((finding) => finding.code === "scenario_confirmation_mismatch"),
    true
  );

  const wrongRoles = createAICConformanceBinding({
    contract: fixture.contract,
    pack,
    profileId: "complete",
    requirementMap: fixture.requirementMap,
    scenarioMap: fixture.scenarioMap,
    surfaceRoles: { agent: ["human-ui"], human: [] }
  });
  const roleResult = verifyAICConformance({
    binding: wrongRoles,
    contract: fixture.contract,
    generatedAt: GENERATED_AT,
    pack
  });
  const roleCodes = new Set(roleResult.findings.map((finding) => finding.code));
  assert.equal(roleCodes.has("surface_role_invalid"), true);
  assert.equal(roleCodes.has("scenario_surface_role_mismatch"), true);
});

test("proof-level verification requires passed scenarios and parity", () => {
  const pack = getAICBuiltInConformancePack("aic.pack.checkout");
  const fixture = createContractArtifacts(pack, "complete");
  const failedProof = clone(fixture.proof);
  failedProof.status = "failed";
  failedProof.scenarios[0].status = "failed";
  failedProof.scenarios[0].parity = "failed";
  failedProof.scenarios[0].finding_count = 1;
  failedProof.scenarios[0].surfaces[0].status = "failed";
  failedProof.scenarios[0].surfaces[0].finding_count = 1;
  failedProof.findings.push({
    code: "parity_mismatch",
    message: "Fixture parity failure.",
    scenario_id: failedProof.scenarios[0].scenario_id,
    severity: "error"
  });
  failedProof.summary.failed_scenarios = 1;
  failedProof.summary.passed_scenarios -= 1;

  const result = verifyAICConformance({
    binding: fixture.binding,
    contract: fixture.contract,
    generatedAt: GENERATED_AT,
    pack,
    proof: failedProof
  });
  const codes = new Set(result.findings.map((finding) => finding.code));
  assert.equal(result.status, "failed");
  assert.equal(codes.has("proof_status_failed"), true);
  assert.equal(codes.has("proof_scenario_failed"), true);
  assert.equal(codes.has("proof_parity_failed"), true);
});

test("strict validators reject inferred bindings, unknown fields, and inconsistent results", () => {
  const pack = getAICBuiltInConformancePack("aic.pack.checkout");
  const fixture = createContractArtifacts(pack, "complete");

  const inferredBinding = { ...clone(fixture.binding), authored: false };
  assert.equal(validateAICConformanceBinding(inferredBinding).ok, false);
  assert.equal(validateAICConformancePack({ ...clone(pack), inferred: true }).ok, false);

  const passed = verifyAICConformance({
    binding: fixture.binding,
    contract: fixture.contract,
    generatedAt: GENERATED_AT,
    pack
  });
  const inconsistent = { ...clone(passed), status: "failed" };
  assert.equal(validateAICConformanceResult(inconsistent).ok, false);
});

test("an incomplete checkout binding reports missing failure and recovery coverage", async () => {
  const pack = getAICBuiltInConformancePack("aic.pack.checkout");
  const contract = await readJsonFile(
    resolveFromRepo("examples", "nextjs-checkout-demo", "aic-behavior-contract.json")
  );
  const binding = createAICConformanceBinding({
    contract,
    pack,
    profileId: "complete",
    requirementMap: {
      audit_evidence: ["order.submitted", "payment.charged"],
      authorization_allowed: ["authorization.allowed"],
      authorization_denied: ["authorization.denied"],
      confirmation_accepted: ["confirmation.accepted"],
      confirmation_declined: ["confirmation.declined"],
      exact_scope: ["order.is_draft"],
      mutation_committed: ["payment.charge"],
      unchanged_when_stopped: ["order.unchanged"]
    },
    scenarioMap: {
      authorization_denial: ["authorization-denied"],
      confirmation_decline: ["confirmation-declined"],
      success: ["success"]
    },
    surfaceRoles: {
      agent: ["webmcp"],
      human: ["human-ui"]
    }
  });
  const result = verifyAICConformance({
    binding,
    contract,
    generatedAt: GENERATED_AT,
    pack
  });
  assert.equal(result.status, "failed");
  const codes = new Set(result.findings.map((finding) => finding.code));
  assert.equal(codes.has("requirement_obligation_missing"), true);
  assert.equal(codes.has("scenario_obligation_missing"), true);
});
