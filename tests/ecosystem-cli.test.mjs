import assert from "node:assert/strict";
import { access, rm } from "node:fs/promises";
import test from "node:test";

import {
  createTempDir,
  readJsonFile,
  resolveFromRepo,
  runCli,
  writeJsonFile
} from "./helpers.mjs";

const checkoutContract = resolveFromRepo(
  "examples/nextjs-checkout-demo/aic-behavior-contract.json"
);
const checkoutMapping = resolveFromRepo(
  "examples/nextjs-checkout-demo/aic-conformance-mapping.json"
);
const checkoutProof = resolveFromRepo("examples/nextjs-checkout-demo/aic-proof.json");
const checkoutBrowserProof = resolveFromRepo(
  "examples/nextjs-checkout-demo/aic-browser-proof.json"
);
const checkoutBrowserObservations = resolveFromRepo(
  "examples/nextjs-checkout-demo/aic-browser-observations.json"
);
const criticalAssurancePolicy = resolveFromRepo("policies/critical-assurance.json");

async function generateCliKeyPair({
  generatedAt,
  issuerId,
  origin,
  stem,
  tempDir
}) {
  const privateKey = `${tempDir}/${stem}-private.pem`;
  const publicKey = `${tempDir}/${stem}-public.pem`;
  const trustStore = `${tempDir}/${stem}-trust-store.json`;
  const keygen = await runCli([
    "trust",
    "keygen",
    "--issuer-id",
    issuerId,
    "--private-key",
    privateKey,
    "--public-key",
    publicKey,
    "--trust-store",
    trustStore,
    ...(origin ? ["--origin", origin] : []),
    "--generated-at",
    generatedAt
  ]);
  assert.equal(keygen.code, 0, keygen.stderr);
  return {
    keyId: JSON.parse(keygen.stdout).key_id,
    privateKey,
    publicKey,
    trustStore
  };
}

test("ecosystem CLI binds and verifies the checkout conformance pack", async (t) => {
  const tempDir = await createTempDir("aic-ecosystem-cli-");
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const bindingFile = `${tempDir}/binding.json`;
  const resultFile = `${tempDir}/result.json`;
  const list = await runCli(["conformance", "list"]);
  assert.equal(list.code, 0, list.stderr);
  assert.deepEqual(
    JSON.parse(list.stdout).packs.map((pack) => pack.id),
    [
      "aic.pack.checkout",
      "aic.pack.billing-mutation",
      "aic.pack.account-deletion",
      "aic.pack.admin-mutation",
      "aic.pack.record-crud"
    ]
  );

  const missingOutput = await runCli([
    "conformance",
    "bind",
    "aic.pack.checkout",
    "complete",
    checkoutContract,
    checkoutMapping
  ]);
  assert.equal(missingOutput.code, 1);
  assert.match(missingOutput.stderr, /Missing required option: --out-file/);

  const bind = await runCli([
    "conformance",
    "bind",
    "aic.pack.checkout",
    "complete",
    checkoutContract,
    checkoutMapping,
    "--out-file",
    bindingFile
  ]);
  assert.equal(bind.code, 0, bind.stderr);
  assert.equal((await readJsonFile(bindingFile)).pack.profile, "complete");

  const verify = await runCli([
    "conformance",
    "verify",
    "aic.pack.checkout",
    bindingFile,
    checkoutContract,
    "--proof",
    checkoutProof,
    "--generated-at",
    "2026-08-29T20:00:00.000Z",
    "--out-file",
    resultFile
  ]);
  assert.equal(verify.code, 0, verify.stderr);
  assert.equal((await readJsonFile(resultFile)).status, "passed");

  const validation = await runCli(["validate", "conformance-result", resultFile]);
  assert.equal(validation.code, 0, validation.stderr);
  assert.match(validation.stdout, /conformance-result is valid/);
});

test("ecosystem CLI resolves and verifies the public interoperability suite", async (t) => {
  const tempDir = await createTempDir("aic-interop-cli-");
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const resultFile = `${tempDir}/result.json`;
  const result = await runCli([
    "interop",
    "verify",
    resolveFromRepo("interop/aic-trust-0.1/manifest.json"),
    "--out-file",
    resultFile
  ]);
  assert.equal(result.code, 0, result.stderr);
  const payload = await readJsonFile(resultFile);
  assert.equal(payload.status, "passed");
  assert.equal(payload.failed, 0);
  assert.equal(payload.passed, payload.cases.length);
  assert.ok(payload.cases.length > 0);
});

test("ecosystem CLI validates the checked-in critical assurance policy", async () => {
  const result = await runCli([
    "validate",
    "assurance-policy",
    resolveFromRepo("policies/critical-assurance.json")
  ]);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /assurance-policy is valid/);
});

test("ecosystem CLI evaluates the five-scenario checkout evidence with a short-lived signed attestation", async (t) => {
  const tempDir = await createTempDir("aic-policy-cli-");
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const origin = "https://checkout.example";
  const sourceRevision = "d".repeat(40);
  const issuerId = "github:VPAI-Grok/AIC:behavior-assurance";
  const keys = await generateCliKeyPair({
    generatedAt: "2026-08-28T23:00:00.000Z",
    issuerId,
    origin,
    stem: "policy-issuer",
    tempDir
  });
  const attestationFile = `${tempDir}/checkout-attestation.json`;
  const evaluationFile = `${tempDir}/policy-evaluation.json`;
  const attest = await runCli([
    "trust",
    "attest",
    checkoutContract,
    checkoutBrowserProof,
    "--private-key",
    keys.privateKey,
    "--origin",
    origin,
    "--environment",
    "production",
    "--deployment-id",
    "checkout-production-2026-08-29",
    "--deployed-at",
    "2026-08-28T23:55:00.000Z",
    "--source-revision",
    sourceRevision,
    "--issuer-id",
    issuerId,
    "--issuer-kind",
    "github_actions",
    "--runner-id",
    "github:VPAI-Grok/AIC:behavior-assurance",
    "--runner-kind",
    "github_actions",
    "--issued-at",
    "2026-08-29T00:10:00.000Z",
    "--expires-at",
    "2026-08-29T00:50:00.000Z",
    "--out-file",
    attestationFile
  ]);
  assert.equal(attest.code, 0, attest.stderr);

  const evaluate = await runCli([
    "policy",
    "evaluate",
    criticalAssurancePolicy,
    checkoutContract,
    checkoutBrowserProof,
    "--observations",
    checkoutBrowserObservations,
    "--attestation",
    attestationFile,
    "--trust-store",
    keys.trustStore,
    "--environment",
    "production",
    "--expect-origin",
    origin,
    "--expect-revision",
    sourceRevision,
    "--evaluated-at",
    "2026-08-29T00:30:00.000Z",
    "--out-file",
    evaluationFile
  ]);
  assert.equal(evaluate.code, 0, evaluate.stderr);
  const evaluation = await readJsonFile(evaluationFile);
  assert.equal(evaluation.decision, "passed");
  assert.deepEqual(
    evaluation.rules.map((rule) => [rule.id, rule.status]),
    [
      ["critical-executed-parity", "passed"],
      ["checkout-required-scenarios", "passed"]
    ]
  );
  assert.equal(evaluation.findings.length, 0);
  assert.equal(typeof evaluation.subjects.attestation_digest, "string");
});

test("ecosystem CLI initializes, appends, verifies, and checks a pinned transparency history", async (t) => {
  const tempDir = await createTempDir("aic-transparency-cli-");
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const logId = "aic.cli.reference-log";
  const keys = await generateCliKeyPair({
    generatedAt: "2026-08-29T17:00:00.000Z",
    issuerId: logId,
    stem: "log",
    tempDir
  });
  const emptyIndex = `${tempDir}/transparency-empty.json`;
  const appendedIndex = `${tempDir}/transparency-appended.json`;
  const artifactFile = `${tempDir}/interop-attestation.json`;
  const interop = await readJsonFile(
    resolveFromRepo("interop/aic-trust-0.1/valid/bundle.json")
  );
  await writeJsonFile(artifactFile, interop.attestation);

  const init = await runCli([
    "transparency",
    "init",
    "--log-id",
    logId,
    "--private-key",
    keys.privateKey,
    "--issued-at",
    "2026-08-29T17:30:00.000Z",
    "--out-file",
    emptyIndex
  ]);
  assert.equal(init.code, 0, init.stderr);
  const checkpointFile = `${tempDir}/transparency-checkpoint.json`;
  const initialized = await readJsonFile(emptyIndex);
  await writeJsonFile(checkpointFile, initialized.checkpoint);
  const validateCheckpoint = await runCli([
    "validate",
    "transparency-checkpoint",
    checkpointFile
  ]);
  assert.equal(validateCheckpoint.code, 0, validateCheckpoint.stderr);
  assert.match(validateCheckpoint.stdout, /transparency-checkpoint is valid/);

  const append = await runCli([
    "transparency",
    "append",
    emptyIndex,
    "attestation",
    artifactFile,
    "--expect-size",
    "0",
    "--expect-head",
    "null",
    "--trust-store",
    keys.trustStore,
    "--private-key",
    keys.privateKey,
    "--logged-at",
    "2026-08-29T18:00:00.000Z",
    "--out-file",
    appendedIndex
  ]);
  assert.equal(append.code, 0, append.stderr);
  const appended = await readJsonFile(appendedIndex);
  assert.equal(appended.entries.length, 1);
  assert.equal(appended.entries[0].previous_entry_digest, null);
  assert.equal(
    appended.checkpoint.statement.head_entry_digest,
    appended.entries[0].entry_digest
  );

  const verify = await runCli([
    "transparency",
    "verify",
    appendedIndex,
    "--trust-store",
    keys.trustStore,
    "--verified-at",
    "2026-08-29T18:01:00.000Z"
  ]);
  assert.equal(verify.code, 0, verify.stderr);
  assert.equal(JSON.parse(verify.stdout).status, "trusted");

  const consistency = await runCli([
    "transparency",
    "consistency",
    emptyIndex,
    appendedIndex,
    "--trust-store",
    keys.trustStore,
    "--verified-at",
    "2026-08-29T18:01:00.000Z"
  ]);
  assert.equal(consistency.code, 0, consistency.stderr);
  assert.equal(JSON.parse(consistency.stdout).status, "consistent");
});

test("ecosystem CLI validates rotation outputs before preparing, verifying, and applying a transition", async (t) => {
  const tempDir = await createTempDir("aic-rotation-cli-");
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const issuerId = "aic.cli.rotation";
  const origin = "https://checkout.example";
  const retiring = await generateCliKeyPair({
    generatedAt: "2026-08-01T00:00:00.000Z",
    issuerId,
    origin,
    stem: "retiring",
    tempDir
  });
  const successor = await generateCliKeyPair({
    generatedAt: "2026-08-29T11:00:00.000Z",
    issuerId: "unused-successor-fixture",
    origin,
    stem: "successor",
    tempDir
  });
  const nextTrustStore = `${tempDir}/trust-store-next.json`;
  const transitionFile = `${tempDir}/key-transition.json`;
  const appliedTrustStore = `${tempDir}/trust-store-applied.json`;
  const rotationArgs = [
    "trust",
    "rotate",
    "prepare",
    "--prior-trust-store",
    retiring.trustStore,
    "--retiring-private-key",
    retiring.privateKey,
    "--successor-private-key",
    successor.privateKey,
    "--issuer-id",
    issuerId,
    "--transition-id",
    "rotation-2026-08-cli",
    "--issued-at",
    "2026-08-29T12:00:00.000Z",
    "--effective-at",
    "2026-08-30T00:00:00.000Z",
    "--retire-at",
    "2026-08-31T00:00:00.000Z"
  ];

  const missingTransitionOutput = await runCli([
    ...rotationArgs,
    "--next-trust-store",
    nextTrustStore
  ]);
  assert.equal(missingTransitionOutput.code, 1);
  assert.match(missingTransitionOutput.stderr, /Missing required option: --transition-out/);
  await assert.rejects(access(nextTrustStore), { code: "ENOENT" });
  await assert.rejects(access(transitionFile), { code: "ENOENT" });

  const prepare = await runCli([
    ...rotationArgs,
    "--next-trust-store",
    nextTrustStore,
    "--transition-out",
    transitionFile
  ]);
  assert.equal(prepare.code, 0, prepare.stderr);

  const verify = await runCli([
    "trust",
    "transition",
    "verify",
    "--prior-trust-store",
    retiring.trustStore,
    "--next-trust-store",
    nextTrustStore,
    "--transition",
    transitionFile,
    "--verified-at",
    "2026-08-29T12:00:00.000Z"
  ]);
  assert.equal(verify.code, 0, verify.stderr);
  assert.equal(JSON.parse(verify.stdout).status, "trusted");

  const apply = await runCli([
    "trust",
    "transition",
    "apply",
    "--prior-trust-store",
    retiring.trustStore,
    "--next-trust-store",
    nextTrustStore,
    "--transition",
    transitionFile,
    "--verified-at",
    "2026-08-29T12:00:00.000Z",
    "--out-file",
    appliedTrustStore
  ]);
  assert.equal(apply.code, 0, apply.stderr);
  const next = await readJsonFile(nextTrustStore);
  assert.deepEqual(await readJsonFile(appliedTrustStore), next);
  assert.equal(next.keys.length, 2);
  assert.equal(
    next.keys.find((key) => key.key_id === retiring.keyId).valid_until,
    "2026-08-31T00:00:00.000Z"
  );
  assert.equal(
    next.keys.find((key) => key.key_id === successor.keyId).valid_from,
    "2026-08-30T00:00:00.000Z"
  );
});
