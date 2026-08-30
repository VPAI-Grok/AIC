import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  readJsonSnapshot,
  runRelianceAction
} from "../actions/aic-rely/dist/index.js";
import { validateAICRelianceDecision } from "../packages/spec/dist/reliance.js";
import { validateAICAssurancePolicy } from "../packages/spec/dist/policy.js";
import {
  appendAICTransparencyEntry,
  createAICDigest,
  createAICSignedAttestation,
  createAICTransparencyCheckpointDigest,
  createAICTransparencyIndex,
  generateAICTrustKeyPair
} from "../packages/verify-core/dist/verify-core/src/index.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const actionRoot = resolve(repositoryRoot, "actions/aic-rely");
const evaluatedAt = "2026-08-29T12:30:00.000Z";
const operationId = "record.read.domain";
const origin = "https://interop.example";
const environmentName = "test";
const deploymentId = "interop-1";
const revision = "0123456789abcdef0123456789abcdef01234567";
const issuerId = "interop.fixture";
const runnerId = "interop-runner";

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function assertCanonical(decision) {
  const validation = validateAICRelianceDecision(decision);
  assert.equal(validation.ok, true, JSON.stringify(validation.issues));
}

function policyFor(keyId) {
  return {
    artifact_type: "aic_assurance_policy",
    id: "external.consumer.record-read",
    spec: "aic.policy/0.1",
    unmatched: "fail",
    rules: [
      {
        id: "trusted-record-read",
        match: {
          environments: [environmentName],
          operation_ids: [operationId],
          risks: ["low"]
        },
        require: {
          allowed_evidence_levels: ["executed"],
          attestation: {
            allowed_issuer_ids: [issuerId],
            allowed_key_ids: [keyId],
            allowed_runner_ids: [runnerId],
            allowed_runner_kinds: ["remote"],
            maximum_age_seconds: 3600,
            maximum_validity_seconds: 90000,
            require_expected_origin: true,
            require_expected_revision: true,
            require_expiry: true,
            required: true
          },
          maximum_observation_age_seconds: 3600,
          maximum_proof_age_seconds: 3600,
          observations_required: true,
          proof_status: "passed",
          required_scenario_ids: ["success"],
          required_surface_kinds: ["openapi"]
        }
      }
    ]
  };
}

async function fixture(t) {
  const workspace = await mkdtemp(resolve(tmpdir(), "aic-rely-action-test-"));
  t.after(() => rm(workspace, { force: true, recursive: true }));
  const bundle = JSON.parse(
    await readFile(resolve(repositoryRoot, "interop/aic-trust-0.1/valid/bundle.json"), "utf8")
  );
  const keyId = bundle.attestation.signature.key_id;
  const values = {
    attestation: structuredClone(bundle.attestation),
    contract: structuredClone(bundle.contract),
    observations: structuredClone(bundle.observations),
    policy: policyFor(keyId),
    proof: structuredClone(bundle.proof),
    trustStore: structuredClone(bundle.trust_store)
  };
  const paths = {
    attestation: resolve(workspace, "evidence/attestation.json"),
    contract: resolve(workspace, "evidence/contract.json"),
    observations: resolve(workspace, "evidence/observations.json"),
    policy: resolve(workspace, ".aic/policy.json"),
    proof: resolve(workspace, "evidence/proof.json"),
    trustStore: resolve(workspace, ".aic/trust-store.json")
  };
  const githubOutput = resolve(workspace, "github-output.txt");
  const githubSummary = resolve(workspace, "github-summary.md");
  await Promise.all([
    mkdir(resolve(workspace, ".aic"), { recursive: true }),
    mkdir(resolve(workspace, "evidence"), { recursive: true })
  ]);
  for (const [name, path] of Object.entries(paths)) {
    await writeFile(path, jsonBytes(values[name]));
  }
  await Promise.all([
    writeFile(githubOutput, "", "utf8"),
    writeFile(githubSummary, "", "utf8")
  ]);
  const environment = {
    GITHUB_OUTPUT: githubOutput,
    GITHUB_STEP_SUMMARY: githubSummary,
    GITHUB_WORKSPACE: workspace,
    INPUT_ATTESTATION_FILE: "evidence/attestation.json",
    INPUT_CONTRACT_FILE: "evidence/contract.json",
    INPUT_DECISION_FILE: ".aic/reliance-decision.json",
    INPUT_EXPECTED_DEPLOYMENT_ID: deploymentId,
    INPUT_EXPECTED_ENVIRONMENT: environmentName,
    INPUT_EXPECTED_ISSUER_ID: issuerId,
    INPUT_EXPECTED_KEY_ID: keyId,
    INPUT_EXPECTED_OPERATION_ID: operationId,
    INPUT_EXPECTED_ORIGIN: origin,
    INPUT_EXPECTED_REVISION: revision,
    INPUT_EXPECTED_RUNNER_ID: runnerId,
    INPUT_OBSERVATIONS_FILE: "evidence/observations.json",
    INPUT_POLICY_FILE: ".aic/policy.json",
    INPUT_POLICY_SHA256: digest(jsonBytes(values.policy)),
    INPUT_PROOF_FILE: "evidence/proof.json",
    INPUT_TRUST_STORE_FILE: ".aic/trust-store.json",
    INPUT_TRUST_STORE_SHA256: digest(jsonBytes(values.trustStore))
  };

  async function rewrite(name, value, { updateDigest = true } = {}) {
    values[name] = value;
    await writeFile(paths[name], jsonBytes(value));
    if (name === "policy" && updateDigest) environment.INPUT_POLICY_SHA256 = digest(jsonBytes(value));
    if (name === "trustStore" && updateDigest) environment.INPUT_TRUST_STORE_SHA256 = digest(jsonBytes(value));
  }

  async function addTransparency({ includePrior = false } = {}) {
    const logId = "independent.transparency.log";
    const log = generateAICTrustKeyPair({
      generatedAt: "2026-08-29T11:30:00.000Z",
      issuerId: logId
    });
    const prior = createAICTransparencyIndex({
      issuedAt: "2026-08-29T12:00:00.000Z",
      logId,
      privateKeyPem: log.private_key_pem
    });
    const index = appendAICTransparencyEntry({
      artifact: values.attestation,
      expectedHead: null,
      expectedSize: 0,
      index: prior,
      kind: "attestation",
      loggedAt: "2026-08-29T12:10:00.000Z",
      logTrustStore: log.trust_store,
      privateKeyPem: log.private_key_pem
    });
    paths.transparencyIndex = resolve(workspace, "evidence/transparency-index.json");
    paths.transparencyPriorIndex = resolve(workspace, "evidence/transparency-prior-index.json");
    paths.transparencyTrustStore = resolve(workspace, ".aic/transparency-trust-store.json");
    await Promise.all([
      writeFile(paths.transparencyIndex, jsonBytes(index)),
      writeFile(paths.transparencyPriorIndex, jsonBytes(prior)),
      writeFile(paths.transparencyTrustStore, jsonBytes(log.trust_store))
    ]);
    environment.INPUT_TRANSPARENCY_INDEX_FILE = "evidence/transparency-index.json";
    environment.INPUT_TRANSPARENCY_TRUST_STORE_FILE = ".aic/transparency-trust-store.json";
    environment.INPUT_TRANSPARENCY_TRUST_STORE_SHA256 = digest(jsonBytes(log.trust_store));
    if (includePrior) {
      environment.INPUT_TRANSPARENCY_PRIOR_INDEX_FILE = "evidence/transparency-prior-index.json";
    }
    return {
      index,
      keyId: log.key_id,
      logId,
      prior,
      priorCheckpointDigest: createAICTransparencyCheckpointDigest(prior.checkpoint)
    };
  }

  async function makeProduction() {
    const productionIssuerId = "independent.production.runner";
    const productionRunnerId = "runner.production.primary";
    const productionDeploymentId = "production-2026-08-29.1";
    const issuer = generateAICTrustKeyPair({
      allowedOrigins: [origin],
      generatedAt: "2026-08-29T11:00:00.000Z",
      issuerId: productionIssuerId
    });
    const attestation = createAICSignedAttestation({
      contract: values.contract,
      deployment: {
        deployed_at: "2026-08-29T11:30:00.000Z",
        deployment_id: productionDeploymentId,
        environment: "production",
        origin,
        source_revision: revision
      },
      expiresAt: "2026-08-29T13:30:00.000Z",
      issuedAt: "2026-08-29T12:00:02.000Z",
      issuer: { id: productionIssuerId, kind: "organization" },
      privateKeyPem: issuer.private_key_pem,
      proof: values.proof,
      runner: { id: productionRunnerId, kind: "remote" }
    });
    const policy = structuredClone(values.policy);
    policy.rules[0].match.environments = ["production"];
    policy.rules[0].require.attestation.allowed_issuer_ids = [productionIssuerId];
    policy.rules[0].require.attestation.allowed_key_ids = [issuer.key_id];
    policy.rules[0].require.attestation.allowed_runner_ids = [productionRunnerId];
    await rewrite("attestation", attestation);
    await rewrite("trustStore", issuer.trust_store);
    await rewrite("policy", policy);
    environment.INPUT_EXPECTED_DEPLOYMENT_ID = productionDeploymentId;
    environment.INPUT_EXPECTED_ENVIRONMENT = "production";
    environment.INPUT_EXPECTED_ISSUER_ID = productionIssuerId;
    environment.INPUT_EXPECTED_KEY_ID = issuer.key_id;
    environment.INPUT_EXPECTED_RUNNER_ID = productionRunnerId;
  }

  return { addTransparency, environment, githubOutput, makeProduction, paths, rewrite, values, workspace };
}

test("the committed action runs one offline self-contained bundle", async (t) => {
  const action = await readFile(resolve(actionRoot, "action.yml"), "utf8");
  const build = await readFile(resolve(actionRoot, "build.mjs"), "utf8");
  const bundle = await readFile(resolve(actionRoot, "dist/index.js"), "utf8");
  assert.match(action, /using:\s*node24/);
  assert.match(action, /main:\s*dist\/index\.js/);
  assert.doesNotMatch(action, /cli-(?:version|integrity)|npm|node_modules|registry/i);
  assert.match(build, /@aicorg\/verify-core/);
  assert.doesNotMatch(build, /@aicorg\/automation-core/);
  assert.doesNotMatch(bundle, /node:child_process|registry\.npmjs\.org|\bnpm\s+(?:ci|install|pack)\b/i);

  const run = await fixture(t);
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("Network access is forbidden in the bundled verifier.");
  };
  try {
    const result = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });
    assert.equal(result.allowed, true);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a trusted current bundle emits the canonical bound allow decision", async (t) => {
  const run = await fixture(t);
  const result = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });

  assert.equal(result.allowed, true);
  assert.equal(result.verdict, "allow");
  assert.equal(result.decisionFile, ".aic/reliance-decision.json");
  assert.equal(result.validUntil, result.decision.valid_until);
  assert.match(result.validUntil, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(result.decision.evaluated_at, evaluatedAt);
  assertCanonical(result.decision);
  assert.equal(result.decision.policy_evaluation.decision, "passed");
  assert.ok(result.decision.policy_evaluation.rules.some((rule) => rule.status === "passed"));
  assert.equal(result.decision.policy_evaluation.evaluated_at, evaluatedAt);
  assert.equal(result.decision.policy_evaluation.context.expected_origin, origin);
  assert.equal(result.decision.policy_evaluation.context.expected_revision, revision);
  assert.equal(result.decision.policy_evaluation.context.environment, environmentName);
  assert.equal(result.decision.policy_evaluation.policy.digest, result.decision.artifact_digests.policy);
  for (const field of ["attestation", "contract", "observations", "policy", "proof", "trust_store"]) {
    assert.match(result.decision.artifact_digests[field], /^sha256:[0-9a-f]{64}$/);
  }
  for (const [field, value] of [
    ["attestation", run.values.attestation],
    ["contract", run.values.contract],
    ["observations", run.values.observations],
    ["policy", run.values.policy],
    ["proof", run.values.proof],
    ["trust_store", run.values.trustStore]
  ]) {
    assert.equal(result.decision.artifact_digests[field], createAICDigest(value));
  }
  for (const [subject, artifact] of [
    ["attestation_digest", "attestation"],
    ["contract_digest", "contract"],
    ["observations_digest", "observations"],
    ["proof_digest", "proof"]
  ]) {
    assert.equal(result.decision.policy_evaluation.subjects[subject], result.decision.artifact_digests[artifact]);
  }
  const persisted = JSON.parse(await readFile(resolve(run.workspace, result.decisionFile), "utf8"));
  assert.deepEqual(persisted, result.decision);
  const outputs = await readFile(run.githubOutput, "utf8");
  assert.match(outputs, /^allowed=true$/m);
  assert.match(outputs, /^verdict=allow$/m);
  assert.match(outputs, /^decision-file=\.aic\/reliance-decision\.json$/m);
  assert.match(outputs, new RegExp(`^valid-until=${result.validUntil.replaceAll(".", "\\.")}$`, "m"));
});

test("the latest pre-write trusted clock sample becomes the exact decision evaluation time", async (t) => {
  const run = await fixture(t);
  const times = [
    "2026-08-29T12:20:00.000Z",
    "2026-08-29T12:30:00.000Z",
    "2026-08-29T12:35:00.000Z"
  ];
  let calls = 0;
  const result = await runRelianceAction({
    environment: run.environment,
    clock: () => times[Math.min(calls++, times.length - 1)]
  });
  assert.equal(calls, 7);
  assert.equal(result.allowed, true);
  assert.equal(result.decision.evaluated_at, times.at(-1));
  assert.equal(result.decision.policy_evaluation.evaluated_at, times.at(-1));
  assertCanonical(result.decision);
});

test("attestation expiry during input reads or evaluation cannot produce allow", async (t) => {
  const beforeExpiry = "2026-08-30T11:59:59.000Z";
  const atExpiry = "2026-08-30T12:00:00.000Z";
  for (const times of [
    [beforeExpiry, atExpiry, atExpiry],
    [beforeExpiry, beforeExpiry, atExpiry]
  ]) {
    const run = await fixture(t);
    const policy = structuredClone(run.values.policy);
    delete policy.rules[0].require.attestation.maximum_age_seconds;
    delete policy.rules[0].require.maximum_observation_age_seconds;
    delete policy.rules[0].require.maximum_proof_age_seconds;
    await run.rewrite("policy", policy);
    let calls = 0;
    const result = await runRelianceAction({
      environment: run.environment,
      clock: () => times[Math.min(calls++, times.length - 1)]
    });
    assert.equal(calls, 3);
    assert.equal(result.allowed, false);
    assert.notEqual(result.verdict, "allow");
    assert.equal(result.decision.evaluated_at, atExpiry);
    assertCanonical(result.decision);
  }
});

test("an allow that expires during the output write is replaced before success", async (t) => {
  const run = await fixture(t);
  const policy = structuredClone(run.values.policy);
  delete policy.rules[0].require.attestation.maximum_age_seconds;
  delete policy.rules[0].require.maximum_observation_age_seconds;
  delete policy.rules[0].require.maximum_proof_age_seconds;
  await run.rewrite("policy", policy);
  const beforeExpiry = "2026-08-30T11:59:59.000Z";
  const atExpiry = "2026-08-30T12:00:00.000Z";
  const times = [beforeExpiry, beforeExpiry, beforeExpiry, atExpiry, atExpiry];
  let calls = 0;
  let writes = 0;
  const result = await runRelianceAction({
    environment: run.environment,
    clock: () => times[Math.min(calls++, times.length - 1)],
    writeDecisionFile: async (path, decision) => {
      writes += 1;
      await writeFile(path, jsonBytes(decision));
    }
  });
  assert.equal(calls, 5);
  assert.equal(writes, 2);
  assert.equal(result.allowed, false);
  assert.notEqual(result.verdict, "allow");
  assert.equal(result.decision.evaluated_at, atExpiry);
  assert.deepEqual(JSON.parse(await readFile(resolve(run.workspace, result.decisionFile), "utf8")), result.decision);
  assertCanonical(result.decision);
});

test("an allow that expires at the final post-write sample is replaced before success", async (t) => {
  const run = await fixture(t);
  const policy = structuredClone(run.values.policy);
  delete policy.rules[0].require.attestation.maximum_age_seconds;
  delete policy.rules[0].require.maximum_observation_age_seconds;
  delete policy.rules[0].require.maximum_proof_age_seconds;
  await run.rewrite("policy", policy);
  const beforeExpiry = "2026-08-30T11:59:59.000Z";
  const laterBeforeExpiry = "2026-08-30T11:59:59.500Z";
  const atExpiry = "2026-08-30T12:00:00.000Z";
  const times = [
    beforeExpiry,
    beforeExpiry,
    beforeExpiry,
    laterBeforeExpiry,
    atExpiry
  ];
  let calls = 0;
  let writes = 0;
  const result = await runRelianceAction({
    environment: run.environment,
    clock: () => times[Math.min(calls++, times.length - 1)],
    writeDecisionFile: async (path, decision) => {
      writes += 1;
      await writeFile(path, jsonBytes(decision));
    }
  });
  assert.equal(calls, 5);
  assert.equal(writes, 2);
  assert.equal(result.allowed, false);
  assert.notEqual(result.verdict, "allow");
  assert.equal(result.decision.evaluated_at, atExpiry);
  assert.deepEqual(JSON.parse(await readFile(resolve(run.workspace, result.decisionFile), "utf8")), result.decision);
  assertCanonical(result.decision);
});

test("proof freshness crossing at the final post-write sample is evaluated and denied", async (t) => {
  const run = await fixture(t);
  const policy = structuredClone(run.values.policy);
  policy.rules[0].require.attestation.maximum_age_seconds = 7200;
  policy.rules[0].require.maximum_observation_age_seconds = 7200;
  policy.rules[0].require.maximum_proof_age_seconds = 3600;
  await run.rewrite("policy", policy);
  const beforeProofBoundary = "2026-08-29T13:00:00.999Z";
  const afterProofBoundary = "2026-08-29T13:00:01.001Z";
  const times = [
    beforeProofBoundary,
    beforeProofBoundary,
    beforeProofBoundary,
    beforeProofBoundary,
    afterProofBoundary
  ];
  let calls = 0;
  let writes = 0;
  const result = await runRelianceAction({
    environment: run.environment,
    clock: () => times[Math.min(calls++, times.length - 1)],
    writeDecisionFile: async (path, decision) => {
      writes += 1;
      await writeFile(path, jsonBytes(decision));
    }
  });
  assert.equal(calls, 5);
  assert.equal(writes, 2);
  assert.equal(result.allowed, false);
  assert.equal(result.verdict, "deny");
  assert.ok(result.reasonCodes.includes("evidence_stale"));
  assert.equal(result.decision.evaluated_at, afterProofBoundary);
  assert.deepEqual(JSON.parse(await readFile(resolve(run.workspace, result.decisionFile), "utf8")), result.decision);
  assertCanonical(result.decision);
});

test("a final allow with less than the default residual validity cannot publish allowed=true", async (t) => {
  const run = await fixture(t);
  const policy = structuredClone(run.values.policy);
  policy.rules[0].require.attestation.maximum_age_seconds = 7200;
  policy.rules[0].require.maximum_observation_age_seconds = 7200;
  policy.rules[0].require.maximum_proof_age_seconds = 3600;
  await run.rewrite("policy", policy);
  const beforeBoundary = "2026-08-29T13:00:00.000Z";
  const finalAt = "2026-08-29T13:00:00.500Z";
  const times = [beforeBoundary, beforeBoundary, beforeBoundary, beforeBoundary, finalAt];
  let calls = 0;
  let writes = 0;
  const result = await runRelianceAction({
    environment: run.environment,
    clock: () => times[Math.min(calls++, times.length - 1)],
    writeDecisionFile: async (path, decision) => {
      writes += 1;
      await writeFile(path, jsonBytes(decision));
    }
  });
  assert.equal(calls, 5);
  assert.equal(writes, 2);
  assert.equal(result.allowed, false);
  assert.equal(result.verdict, "indeterminate");
  assert.equal(result.validUntil, undefined);
  assert.deepEqual(result.reasonCodes, ["policy_indeterminate"]);
  const outputs = await readFile(run.githubOutput, "utf8");
  assert.match(outputs, /^allowed=false$/m);
  assert.match(outputs, /^valid-until=$/m);
  assert.doesNotMatch(outputs, /^allowed=true$/m);
  assertCanonical(result.decision);
});

test("a delayed output write appends fail-closed overrides when publication residual falls below the minimum", async (t) => {
  const run = await fixture(t);
  const policy = structuredClone(run.values.policy);
  policy.rules[0].require.attestation.maximum_age_seconds = 7200;
  policy.rules[0].require.maximum_observation_age_seconds = 7200;
  policy.rules[0].require.maximum_proof_age_seconds = 3600;
  await run.rewrite("policy", policy);
  run.environment.INPUT_MINIMUM_VALIDITY_SECONDS = "1";
  const beforePublication = "2026-08-29T13:00:00.000Z";
  const assertionAtExactMinimum = "2026-08-29T13:00:00.001Z";
  const finalAtBelowMinimum = "2026-08-29T13:00:00.002Z";
  const times = [
    beforePublication,
    beforePublication,
    beforePublication,
    beforePublication,
    beforePublication,
    assertionAtExactMinimum,
    finalAtBelowMinimum
  ];
  let calls = 0;
  let outputWrites = 0;
  const result = await runRelianceAction({
    environment: run.environment,
    clock: () => times[Math.min(calls++, times.length - 1)],
    writeActionOutputs: async (path, content) => {
      outputWrites += 1;
      await Promise.resolve();
      await appendFile(path, content, "utf8");
    }
  });
  assert.equal(calls, 7);
  assert.equal(outputWrites, 4);
  assert.equal(result.allowed, false);
  assert.equal(result.verdict, "indeterminate");
  assert.equal(result.decisionFile, undefined);
  assert.equal(result.validUntil, undefined);
  assert.deepEqual(result.reasonCodes, ["policy_indeterminate"]);
  await assert.rejects(readFile(resolve(run.workspace, ".aic/reliance-decision.json"), "utf8"), { code: "ENOENT" });
  const outputLines = (await readFile(run.githubOutput, "utf8")).trim().split("\n");
  assert.equal(outputLines.filter((line) => line === "allowed=true").length, 1);
  assert.ok(outputLines.filter((line) => line === "allowed=false").length >= 1);
  assert.equal(outputLines.filter((line) => line.startsWith("allowed=")).at(-1), "allowed=false");
  assert.equal(outputLines.filter((line) => line.startsWith("valid-until=")).at(-1), "valid-until=");
  assert.equal(outputLines.filter((line) => line.startsWith("decision-file=")).at(-1), "decision-file=");
  assertCanonical(result.decision);
});

test("ordinary millisecond clock advancement remains live within the explicit currentness bound", async (t) => {
  const run = await fixture(t);
  const times = [
    "2026-08-29T12:30:00.000Z",
    "2026-08-29T12:30:00.001Z",
    "2026-08-29T12:30:00.002Z",
    "2026-08-29T12:30:00.003Z",
    "2026-08-29T12:30:00.004Z",
    "2026-08-29T12:30:00.005Z",
    "2026-08-29T12:30:00.006Z"
  ];
  let calls = 0;
  let writes = 0;
  const result = await runRelianceAction({
    environment: run.environment,
    clock: () => times[Math.min(calls++, times.length - 1)],
    writeDecisionFile: async (path, decision) => {
      writes += 1;
      await writeFile(path, jsonBytes(decision));
    }
  });
  assert.equal(calls, 7);
  assert.equal(writes, 1);
  assert.equal(result.allowed, true);
  assert.equal(result.verdict, "allow");
  assert.equal(result.decision.evaluated_at, times[2]);
  assert.deepEqual(JSON.parse(await readFile(resolve(run.workspace, result.decisionFile), "utf8")), result.decision);
  assertCanonical(result.decision);
});

test("a write outside the five-second decision-age bound is replaced fail closed", async (t) => {
  const run = await fixture(t);
  const beforeWrite = "2026-08-29T12:30:00.000Z";
  const afterWrite = "2026-08-29T12:30:06.000Z";
  const times = [beforeWrite, beforeWrite, beforeWrite, afterWrite, afterWrite];
  let calls = 0;
  let writes = 0;
  const result = await runRelianceAction({
    environment: run.environment,
    clock: () => times[Math.min(calls++, times.length - 1)],
    writeDecisionFile: async (path, decision) => {
      writes += 1;
      await writeFile(path, jsonBytes(decision));
    }
  });
  assert.equal(calls, 5);
  assert.equal(writes, 2);
  assert.equal(result.allowed, false);
  assert.equal(result.verdict, "indeterminate");
  assert.deepEqual(result.reasonCodes, ["policy_indeterminate"]);
  assert.deepEqual(JSON.parse(await readFile(resolve(run.workspace, result.decisionFile), "utf8")), result.decision);
  assertCanonical(result.decision);
});

test("a stale bundle cannot produce allow", async (t) => {
  const run = await fixture(t);
  const result = await runRelianceAction({
    environment: run.environment,
    clock: () => "2026-08-29T14:30:00.000Z"
  });
  assert.equal(result.allowed, false);
  assert.equal(result.verdict, "deny");
  assert.ok(result.reasonCodes.includes("evidence_stale"));
  assertCanonical(result.decision);
});

test("future-dated evidence cannot produce allow", async (t) => {
  const run = await fixture(t);
  const result = await runRelianceAction({
    environment: run.environment,
    clock: () => "2026-08-29T11:30:00.000Z"
  });
  assert.equal(result.allowed, false);
  assert.notEqual(result.verdict, "allow");
  assert.ok(result.reasonCodes.includes("evidence_future"));
  assertCanonical(result.decision);
});

test("evaluation uses the already-read snapshots across the async invalidation boundary", async (t) => {
  const run = await fixture(t);
  const reads = new Map();
  const mutatingReader = async (workspace, providedPath, label) => {
    const snapshot = await readJsonSnapshot(workspace, providedPath, label);
    reads.set(snapshot.path, (reads.get(snapshot.path) ?? 0) + 1);
    await writeFile(snapshot.path, "{}\n", "utf8");
    return snapshot;
  };
  const result = await runRelianceAction({
    environment: run.environment,
    clock: () => evaluatedAt,
    readArtifact: mutatingReader
  });
  assert.equal(result.allowed, true);
  assert.equal(reads.size, 6);
  assert.ok([...reads.values()].every((count) => count === 1));
  assertCanonical(result.decision);
});

test("a changed consumer policy digest fails closed", async (t) => {
  const run = await fixture(t);
  const changedPolicy = structuredClone(run.values.policy);
  changedPolicy.id = "changed-after-pin";
  await run.rewrite("policy", changedPolicy, { updateDigest: false });
  const result = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });
  assert.equal(result.allowed, false);
  assert.equal(result.verdict, "indeterminate");
  assert.deepEqual(result.reasonCodes, ["artifacts_invalid"]);
  assertCanonical(result.decision);
});

test("duplicate and escaped-duplicate JSON members are rejected before evaluation", async (t) => {
  const duplicateMembers = [
    '"unmatched": "pass",\n  "unmatched": "fail",',
    '"unmatched": "pass",\n  "unmatch\\u0065d": "fail",'
  ];
  for (const duplicate of duplicateMembers) {
    const run = await fixture(t);
    const original = jsonBytes(run.values.policy).toString("utf8");
    const ambiguous = Buffer.from(original.replace('"unmatched": "fail",', duplicate), "utf8");
    assert.equal(JSON.parse(ambiguous.toString("utf8")).unmatched, "fail");
    await writeFile(run.paths.policy, ambiguous);
    run.environment.INPUT_POLICY_SHA256 = digest(ambiguous);
    const result = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });
    assert.equal(result.allowed, false);
    assert.equal(result.verdict, "indeterminate");
    assert.equal(result.decisionFile, ".aic/reliance-decision.json");
    assert.deepEqual(result.reasonCodes, ["artifacts_invalid"]);
    assertCanonical(result.decision);
    assert.notEqual(
      JSON.parse(await readFile(resolve(run.workspace, result.decisionFile), "utf8")).verdict,
      "allow"
    );
  }
});

test("artifact snapshots reject malformed UTF-8 instead of replacement-decoding it into valid JSON", async (t) => {
  const workspace = await mkdtemp(resolve(tmpdir(), "aic-rely-invalid-utf8-test-"));
  t.after(() => rm(workspace, { force: true, recursive: true }));
  const path = resolve(workspace, "artifact.json");
  // Buffer.toString("utf8") turns 0x80 into U+FFFD, making this a valid JSON string.
  await writeFile(path, Buffer.from([0x22, 0x80, 0x22]));
  await assert.rejects(
    readJsonSnapshot(workspace, "artifact.json", "artifact-file"),
    (error) => error?.code === "input_json_invalid" && /valid UTF-8 strict JSON/.test(error.message)
  );
});

test("date-only and invalid-calendar trusted clocks fail closed after invalidating a prior allow", async (t) => {
  for (const invalidClock of ["2026-08-29", "2026-02-30T12:00:00Z"]) {
    const run = await fixture(t);
    const target = resolve(run.workspace, ".aic/reliance-decision.json");
    await writeFile(target, '{"artifact_type":"aic_reliance_decision","verdict":"allow"}\n', "utf8");
    const result = await runRelianceAction({
      environment: run.environment,
      clock: () => invalidClock
    });
    assert.equal(result.allowed, false, invalidClock);
    assert.equal(result.verdict, "indeterminate", invalidClock);
    assert.deepEqual(result.reasonCodes, ["policy_indeterminate"], invalidClock);
    assert.equal(result.decision.evaluated_at, "1970-01-01T00:00:00.000Z", invalidClock);
    const persisted = JSON.parse(await readFile(target, "utf8"));
    assert.notEqual(persisted.verdict, "allow", invalidClock);
    assert.deepEqual(persisted, result.decision, invalidClock);
    assertCanonical(result.decision);
  }
});

test("minimum-validity-seconds accepts only decimal integers from zero through sixty", async (t) => {
  for (const invalidValue of ["-1", "61", "1.5", "Infinity", "01"]) {
    const run = await fixture(t);
    run.environment.INPUT_MINIMUM_VALIDITY_SECONDS = invalidValue;
    const result = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });
    assert.equal(result.allowed, false, invalidValue);
    assert.equal(result.verdict, "indeterminate", invalidValue);
    assert.equal(result.validUntil, undefined, invalidValue);
    assert.deepEqual(result.reasonCodes, ["artifacts_invalid"], invalidValue);
    assert.match(await readFile(run.githubOutput, "utf8"), /^valid-until=$/m, invalidValue);
    assertCanonical(result.decision);
  }
});

test("missing or invalid expected environment uses the canonical environment reason", async (t) => {
  for (const environmentValue of [undefined, "prod"]) {
    const run = await fixture(t);
    if (environmentValue === undefined) delete run.environment.INPUT_EXPECTED_ENVIRONMENT;
    else run.environment.INPUT_EXPECTED_ENVIRONMENT = environmentValue;
    const result = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });
    assert.equal(result.allowed, false, String(environmentValue));
    assert.equal(result.verdict, "indeterminate", String(environmentValue));
    assert.deepEqual(result.reasonCodes, ["request_environment_invalid"], String(environmentValue));
    assertCanonical(result.decision);
  }
});

test("consumer policy must be fail closed and have an applicable rule", async (t) => {
  const unsafe = await fixture(t);
  const passUnmatched = structuredClone(unsafe.values.policy);
  passUnmatched.unmatched = "pass";
  await unsafe.rewrite("policy", passUnmatched);
  const unsafeResult = await runRelianceAction({ environment: unsafe.environment, clock: () => evaluatedAt });
  assert.equal(unsafeResult.allowed, false);
  assert.equal(unsafeResult.verdict, "deny");
  assert.deepEqual(unsafeResult.reasonCodes, ["policy_not_fail_closed"]);
  assertCanonical(unsafeResult.decision);

  const unmatched = await fixture(t);
  const unmatchedPolicy = structuredClone(unmatched.values.policy);
  unmatchedPolicy.rules[0].match.operation_ids = ["record.other.domain"];
  await unmatched.rewrite("policy", unmatchedPolicy);
  const unmatchedResult = await runRelianceAction({ environment: unmatched.environment, clock: () => evaluatedAt });
  assert.equal(unmatchedResult.allowed, false);
  assert.equal(unmatchedResult.verdict, "deny");
  assert.deepEqual(unmatchedResult.reasonCodes, ["policy_rule_unmatched"]);
  assertCanonical(unmatchedResult.decision);
});

test("matching policy must pin the expected runner identity", async (t) => {
  const run = await fixture(t);
  const policy = structuredClone(run.values.policy);
  delete policy.rules[0].require.attestation.allowed_runner_ids;
  await run.rewrite("policy", policy);
  const result = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });
  assert.equal(result.allowed, false);
  assert.equal(result.verdict, "deny");
  assert.deepEqual(result.reasonCodes, ["policy_failed"]);
  assertCanonical(result.decision);
});

test("production allow requires explicit proof, observation, and attestation freshness bounds", async (t) => {
  const run = await fixture(t);
  await run.makeProduction();
  const strongResult = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });
  assert.equal(strongResult.allowed, true);
  assert.equal(strongResult.decision.evidence_freshness.status, "fresh");
  assertCanonical(strongResult.decision);

  const weakPolicy = structuredClone(run.values.policy);
  delete weakPolicy.rules[0].require.maximum_proof_age_seconds;
  await run.rewrite("policy", weakPolicy);
  const weakResult = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });
  assert.equal(weakResult.allowed, false);
  assert.equal(weakResult.verdict, "deny");
  assert.deepEqual(weakResult.reasonCodes, ["policy_failed"]);
  assertCanonical(weakResult.decision);
});

test("every applicable production transparency rule must pin log and signer-key identities", async (t) => {
  const run = await fixture(t);
  await run.makeProduction();
  const transparency = await run.addTransparency();
  const secondLog = generateAICTrustKeyPair({
    generatedAt: "2026-08-29T11:45:00.000Z",
    issuerId: "independent.transparency.second-log"
  });
  const transparencyTrustStore = JSON.parse(await readFile(run.paths.transparencyTrustStore, "utf8"));
  transparencyTrustStore.keys.push(...secondLog.trust_store.keys);
  await writeFile(run.paths.transparencyTrustStore, jsonBytes(transparencyTrustStore));
  run.environment.INPUT_TRANSPARENCY_TRUST_STORE_SHA256 = digest(jsonBytes(transparencyTrustStore));
  assert.ok(transparencyTrustStore.keys.length >= 2);

  const policy = structuredClone(run.values.policy);
  policy.rules[0].require.transparency = {
    allowed_key_ids: [transparency.keyId],
    allowed_log_ids: [transparency.logId],
    maximum_checkpoint_age_seconds: 3600,
    minimum_size: 1,
    required: true
  };
  const unpinnedRule = structuredClone(policy.rules[0]);
  unpinnedRule.id = "required-transparency-without-log-or-key-pins";
  delete unpinnedRule.require.transparency.allowed_key_ids;
  delete unpinnedRule.require.transparency.allowed_log_ids;
  policy.rules.push(unpinnedRule);
  const validation = validateAICAssurancePolicy(policy);
  assert.equal(validation.ok, true, JSON.stringify(validation.issues));
  await run.rewrite("policy", policy);

  const result = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });
  assert.equal(result.allowed, false);
  assert.equal(result.verdict, "deny");
  assert.deepEqual(result.reasonCodes, ["policy_failed"]);
  assertCanonical(result.decision);
});

test("a required transparency proof is enforced by the bundled evaluator", async (t) => {
  const run = await fixture(t);
  const policy = structuredClone(run.values.policy);
  policy.rules[0].require.transparency = {
    maximum_checkpoint_age_seconds: 3600,
    required: true
  };
  await run.rewrite("policy", policy);
  const result = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });
  assert.equal(result.allowed, false);
  assert.equal(result.verdict, "deny");
  assert.equal(result.decision.checks.transparency, "failed");
  assert.ok(result.reasonCodes.includes("transparency_required"));
  assertCanonical(result.decision);
});

test("consistency-required transparency needs and verifies the prior checkpoint", async (t) => {
  const withoutPrior = await fixture(t);
  const missingPriorTransparency = await withoutPrior.addTransparency();
  const missingPriorPolicy = structuredClone(withoutPrior.values.policy);
  missingPriorPolicy.rules[0].require.transparency = {
    allowed_key_ids: [missingPriorTransparency.keyId],
    allowed_log_ids: [missingPriorTransparency.logId],
    expected_prior_checkpoint_digest: missingPriorTransparency.priorCheckpointDigest,
    maximum_checkpoint_age_seconds: 3600,
    minimum_size: 1,
    require_consistency: true,
    required: true
  };
  const missingPriorPolicyValidation = validateAICAssurancePolicy(missingPriorPolicy);
  assert.equal(missingPriorPolicyValidation.ok, true, JSON.stringify(missingPriorPolicyValidation.issues));
  await withoutPrior.rewrite("policy", missingPriorPolicy);
  const missingPriorResult = await runRelianceAction({
    environment: withoutPrior.environment,
    clock: () => evaluatedAt
  });
  assert.equal(missingPriorResult.allowed, false);
  assert.equal(missingPriorResult.verdict, "deny");
  assert.ok(missingPriorResult.reasonCodes.includes("transparency_consistency_required"));
  assertCanonical(missingPriorResult.decision);

  const withPrior = await fixture(t);
  const consistentTransparency = await withPrior.addTransparency({ includePrior: true });
  const consistentPolicy = structuredClone(withPrior.values.policy);
  consistentPolicy.rules[0].require.transparency = {
    allowed_key_ids: [consistentTransparency.keyId],
    allowed_log_ids: [consistentTransparency.logId],
    expected_prior_checkpoint_digest: consistentTransparency.priorCheckpointDigest,
    maximum_checkpoint_age_seconds: 3600,
    minimum_size: 1,
    require_consistency: true,
    required: true
  };
  await withPrior.rewrite("policy", consistentPolicy);
  const consistentResult = await runRelianceAction({
    environment: withPrior.environment,
    clock: () => evaluatedAt
  });
  assert.equal(consistentResult.allowed, true);
  assert.equal(consistentResult.verdict, "allow");
  assert.equal(consistentResult.decision.checks.transparency, "passed");
  assert.match(consistentResult.decision.artifact_digests.transparency_prior_index, /^sha256:[0-9a-f]{64}$/);
  assertCanonical(consistentResult.decision);
});

test("decision-file must remain beneath the dedicated .aic directory", async (t) => {
  const run = await fixture(t);
  run.environment.INPUT_DECISION_FILE = "decision.json";
  const result = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });
  assert.equal(result.allowed, false);
  assert.equal(result.decisionFile, undefined);
  assert.deepEqual(result.reasonCodes, ["artifacts_invalid"]);
  assert.equal(await readFile(run.githubOutput, "utf8").then((text) => /^decision-file=$/m.test(text)), true);
});

test("decision-file rejects control characters and reserved package or workflow paths", async (t) => {
  for (const invalidPath of [
    ".aic/bad\nname.json",
    ".aic/package.json",
    ".aic/workflows/result.json"
  ]) {
    const run = await fixture(t);
    run.environment.INPUT_DECISION_FILE = invalidPath;
    const result = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });
    assert.equal(result.allowed, false, invalidPath);
    assert.equal(result.decisionFile, undefined, invalidPath);
    assert.deepEqual(result.reasonCodes, ["artifacts_invalid"], invalidPath);
  }
});

test("decision-file cannot alias and overwrite any verifier input", async (t) => {
  const aliases = [
    ".aic/policy.json",
    ...(process.platform === "win32" ? [".aic/POLICY.JSON"] : [])
  ];
  for (const alias of aliases) {
    const run = await fixture(t);
    const originalPolicy = await readFile(run.paths.policy, "utf8");
    run.environment.INPUT_DECISION_FILE = alias;
    const result = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });
    assert.equal(result.allowed, false, alias);
    assert.equal(result.decisionFile, undefined, alias);
    assert.deepEqual(result.reasonCodes, ["artifacts_invalid"], alias);
    assert.equal(await readFile(run.paths.policy, "utf8"), originalPolicy, alias);
    assert.match(await readFile(run.githubOutput, "utf8"), /^decision-file=$/m, alias);
  }
});

test("a final write failure cannot leave or expose a stale allow file", async (t) => {
  const run = await fixture(t);
  const target = resolve(run.workspace, ".aic/reliance-decision.json");
  await writeFile(target, '{"artifact_type":"aic_reliance_decision","verdict":"allow"}\n', "utf8");
  const result = await runRelianceAction({
    environment: run.environment,
    clock: () => evaluatedAt,
    writeDecisionFile: async (path) => {
      await writeFile(path, '{"artifact_type":"aic_reliance_decision","verdict":"allow"}\n', "utf8");
      throw new Error("simulated final write failure");
    }
  });
  assert.equal(result.allowed, false);
  assert.equal(result.verdict, "indeterminate");
  assert.deepEqual(result.reasonCodes, ["policy_indeterminate"]);
  assert.equal(result.decisionFile, undefined);
  await assert.rejects(readFile(target, "utf8"), { code: "ENOENT" });
  assert.match(await readFile(run.githubOutput, "utf8"), /^decision-file=$/m);
  assertCanonical(result.decision);
});

test("a canonical GitHub output failure invalidates the persisted allow and returns fail closed", async (t) => {
  const run = await fixture(t);
  const target = resolve(run.workspace, ".aic/reliance-decision.json");
  const invalidOutput = resolve(run.workspace, "github-output-directory");
  await mkdir(invalidOutput);
  run.environment.GITHUB_OUTPUT = invalidOutput;
  const result = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });
  assert.equal(result.allowed, false);
  assert.equal(result.verdict, "indeterminate");
  assert.equal(result.decisionFile, undefined);
  assert.deepEqual(result.reasonCodes, ["artifacts_invalid"]);
  await assert.rejects(readFile(target, "utf8"), { code: "ENOENT" });
  assertCanonical(result.decision);
});

test("a failure after appending allowed=true is overridden by a final allowed=false", async (t) => {
  const run = await fixture(t);
  const target = resolve(run.workspace, ".aic/reliance-decision.json");
  let outputWrites = 0;
  const result = await runRelianceAction({
    environment: run.environment,
    clock: () => evaluatedAt,
    writeActionOutputs: async (path, content) => {
      outputWrites += 1;
      await appendFile(path, content, "utf8");
      if (outputWrites === 2) throw new Error("simulated failure after authorization append");
    }
  });
  assert.equal(outputWrites, 4);
  assert.equal(result.allowed, false);
  assert.equal(result.verdict, "indeterminate");
  assert.equal(result.decisionFile, undefined);
  assert.equal(result.validUntil, undefined);
  assert.deepEqual(result.reasonCodes, ["artifacts_invalid"]);
  await assert.rejects(readFile(target, "utf8"), { code: "ENOENT" });
  const allowedLines = (await readFile(run.githubOutput, "utf8"))
    .trim()
    .split("\n")
    .filter((line) => line.startsWith("allowed="));
  assert.equal(allowedLines[0], "allowed=true");
  assert.equal(allowedLines.at(-1), "allowed=false");
  assertCanonical(result.decision);
});

test("an optional step-summary failure cannot reverse a successfully finalized allow", async (t) => {
  const run = await fixture(t);
  const invalidSummary = resolve(run.workspace, "github-summary-directory");
  await mkdir(invalidSummary);
  run.environment.GITHUB_STEP_SUMMARY = invalidSummary;
  const result = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });
  assert.equal(result.allowed, true);
  assert.equal(result.verdict, "allow");
  assert.equal(result.decisionFile, ".aic/reliance-decision.json");
  assert.match(await readFile(run.githubOutput, "utf8"), /^allowed=true$/m);
  assert.equal(
    JSON.parse(await readFile(resolve(run.workspace, result.decisionFile), "utf8")).verdict,
    "allow"
  );
});

test("a missing evidence file cannot leave a preexisting allow decision", async (t) => {
  const run = await fixture(t);
  const target = resolve(run.workspace, ".aic/reliance-decision.json");
  await writeFile(target, '{"artifact_type":"aic_reliance_decision","verdict":"allow"}\n', "utf8");
  run.environment.INPUT_PROOF_FILE = "evidence/missing-proof.json";
  const result = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });
  assert.equal(result.allowed, false);
  assert.equal(result.verdict, "indeterminate");
  assert.equal(result.decisionFile, ".aic/reliance-decision.json");
  const persisted = JSON.parse(await readFile(target, "utf8"));
  assert.notEqual(persisted.verdict, "allow");
  assert.deepEqual(persisted, result.decision);
  assertCanonical(result.decision);
});

test("workspace traversal in any input is rejected without executing submitted code", async (t) => {
  const run = await fixture(t);
  run.environment.INPUT_PROOF_FILE = "../outside.json";
  const result = await runRelianceAction({ environment: run.environment, clock: () => evaluatedAt });
  assert.equal(result.allowed, false);
  assert.equal(result.decisionFile, ".aic/reliance-decision.json");
  assert.deepEqual(result.reasonCodes, ["artifacts_invalid"]);
  assertCanonical(result.decision);
});
