import assert from "node:assert/strict";
import { sign } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  createTempDir,
  importWorkspaceModule,
  readJsonFile,
  resolveFromRepo,
  runCli,
  writeJsonFile
} from "./helpers.mjs";
import { createForeignSigningKey } from "./crypto-fixtures.mjs";

const spec = await importWorkspaceModule("packages/spec/dist/index.js");
const automation = await importWorkspaceModule(
  "packages/automation-core/dist/automation-core/src/index.js"
);
const contractPath = resolveFromRepo("examples/nextjs-checkout-demo/aic-behavior-contract.json");
const proofPath = resolveFromRepo("examples/nextjs-checkout-demo/aic-proof.json");
const contract = await readJsonFile(contractPath);
const proof = await readJsonFile(proofPath);
const publicRegistry = await readJsonFile(resolveFromRepo("registry/index.json"));
const SOURCE_REVISION = "a".repeat(40);
const ISSUED_AT = "2026-08-29T12:00:00.000Z";
const ORIGIN = "http://localhost:3000";

function createFixture() {
  const keys = automation.generateAICTrustKeyPair({
    allowedOrigins: [ORIGIN],
    generatedAt: ISSUED_AT,
    issuerId: "aic.fixture"
  });
  const attestation = automation.createAICSignedAttestation({
    contract,
    deployment: {
      deployment_id: "checkout-demo-local",
      environment: "development",
      origin: ORIGIN,
      source_repository: "https://github.com/VPAI-Grok/AIC",
      source_revision: SOURCE_REVISION
    },
    issuedAt: ISSUED_AT,
    issuer: { id: "aic.fixture", kind: "developer" },
    privateKeyPem: keys.private_key_pem,
    proof,
    references: {
      contract: "./aic-behavior-contract.json",
      proof: "./aic-proof.json"
    },
    runner: { id: "local-test", kind: "local" }
  });
  return { attestation, keys };
}

test("AIC signs a passed proof and verifies every supplied binding", () => {
  const { attestation, keys } = createFixture();

  assert.equal(spec.validateAICSignedAttestation(attestation).ok, true);
  assert.equal(spec.validateAICTrustStore(keys.trust_store).ok, true);

  const result = automation.verifyAICSignedAttestation({
    attestation,
    contract,
    expectedOrigin: ORIGIN,
    expectedRevision: SOURCE_REVISION,
    proof,
    trustStore: keys.trust_store,
    verifiedAt: ISSUED_AT
  });

  assert.equal(result.status, "trusted");
  assert.equal(result.assurance_class, "local_signed_claim");
  assert.deepEqual(result.findings, []);
  assert.ok(Object.values(result.checks).every((check) => check === "passed"));
});

test("proof binding rejects signed subject metadata that contradicts the exact proof", () => {
  const { attestation, keys } = createFixture();

  for (const mutate of [
    (statement) => {
      statement.subject.generated_at = "2026-08-28T00:00:01.000Z";
    },
    (statement) => {
      statement.subject.evidence_level = "imported";
    }
  ]) {
    const statement = structuredClone(attestation.statement);
    mutate(statement);
    const contradictory = automation.signAICTrustStatement({
      privateKeyPem: keys.private_key_pem,
      statement
    });
    const result = automation.verifyAICSignedAttestation({
      attestation: contradictory,
      proof,
      trustStore: keys.trust_store,
      verifiedAt: ISSUED_AT
    });
    assert.equal(result.status, "untrusted");
    assert.equal(result.checks.proof_binding, "failed");
    assert.ok(
      result.findings.some((finding) => finding.code === "proof_binding_mismatch")
    );
  }
});

test("attestation verification rejects RSA and P-256 keys mislabeled as Ed25519", () => {
  const { attestation, keys } = createFixture();

  for (const kind of ["rsa", "ec"]) {
    const foreign = createForeignSigningKey(kind);
    const forged = structuredClone(attestation);
    forged.signature.key_id = foreign.key_id;
    forged.signature.value = sign(
      null,
      Buffer.from(automation.createAICCanonicalJson(forged.statement)),
      foreign.private_key
    ).toString("base64");
    const trustStore = structuredClone(keys.trust_store);
    trustStore.keys[0].key_id = foreign.key_id;
    trustStore.keys[0].public_key_pem = foreign.public_key_pem;

    const result = automation.verifyAICSignedAttestation({
      attestation: forged,
      proof,
      trustStore,
      verifiedAt: ISSUED_AT
    });
    assert.equal(result.status, "untrusted", kind);
    assert.equal(result.checks.issuer_trust, "failed", kind);
    assert.equal(result.checks.signature, "failed", kind);
    assert.ok(
      result.findings.some((finding) => finding.code === "key_type_mismatch"),
      kind
    );
  }
});

test("independent runner revision is bound separately from the deployed app revision", () => {
  const keys = automation.generateAICTrustKeyPair({
    allowedOrigins: [ORIGIN],
    generatedAt: ISSUED_AT,
    issuerId: "aic.remote-observer"
  });
  const runnerRevision = "b".repeat(40);
  const attestation = automation.createAICSignedAttestation({
    contract,
    deployment: {
      deployment_id: "checkout-demo-remote",
      environment: "development",
      origin: ORIGIN,
      source_revision: SOURCE_REVISION
    },
    issuedAt: ISSUED_AT,
    issuer: { id: "aic.remote-observer", kind: "organization" },
    privateKeyPem: keys.private_key_pem,
    proof,
    runner: {
      commit_sha: runnerRevision,
      id: "independent-runner",
      kind: "remote",
      repository: "independent/example-runner"
    }
  });

  assert.equal(spec.validateAICSignedAttestation(attestation).ok, true);
  assert.equal(attestation.statement.deployment.source_revision, SOURCE_REVISION);
  assert.equal(attestation.statement.runner.commit_sha, runnerRevision);
  assert.equal(
    automation.verifyAICSignedAttestation({
      attestation,
      expectedOrigin: ORIGIN,
      expectedRevision: SOURCE_REVISION,
      trustStore: keys.trust_store,
      verifiedAt: ISSUED_AT
    }).status,
    "trusted"
  );
});

test("public registry starts as valid, honest empty discovery data", () => {
  const validation = spec.validateAICTrustRegistry(publicRegistry);
  assert.equal(validation.ok, true);
  assert.deepEqual(publicRegistry.entries, []);

  const verification = automation.verifyAICTrustRegistry({
    registry: publicRegistry,
    trustStore: {}
  });
  assert.equal(verification.status, "invalid");
  assert.ok(verification.findings.some((finding) => finding.code === "trust_store_invalid"));
});

test("AIC rejects statement tampering and verifier expectation mismatches", () => {
  const { attestation, keys } = createFixture();
  const tampered = structuredClone(attestation);
  tampered.statement.deployment.deployment_id = "forged-deployment";

  const tamperResult = automation.verifyAICSignedAttestation({
    attestation: tampered,
    trustStore: keys.trust_store,
    verifiedAt: ISSUED_AT
  });
  assert.equal(tamperResult.status, "untrusted");
  assert.equal(tamperResult.checks.signature, "failed");
  assert.ok(tamperResult.findings.some((finding) => finding.code === "signature_invalid"));

  const originResult = automation.verifyAICSignedAttestation({
    attestation,
    expectedOrigin: "https://example.com",
    trustStore: keys.trust_store,
    verifiedAt: ISSUED_AT
  });
  assert.equal(originResult.status, "untrusted");
  assert.equal(originResult.checks.deployment_binding, "failed");

  const futureResult = automation.verifyAICSignedAttestation({
    attestation,
    trustStore: keys.trust_store,
    verifiedAt: "2026-08-29T11:59:59.000Z"
  });
  assert.equal(futureResult.status, "untrusted");
  assert.ok(futureResult.findings.some((finding) => finding.code === "attestation_not_yet_valid"));

  const malformedTimestamp = structuredClone(attestation.statement);
  malformedTimestamp.issued_at = "2026-08-29";
  assert.equal(spec.validateAICTrustStatement(malformedTimestamp).ok, false);
});

test("AIC treats the exact expiration instant as expired", () => {
  const { attestation, keys } = createFixture();
  const expiringStatement = structuredClone(attestation.statement);
  expiringStatement.expires_at = "2026-08-29T12:01:00.000Z";
  const expiringAttestation = automation.signAICTrustStatement({
    privateKeyPem: keys.private_key_pem,
    statement: expiringStatement
  });

  const result = automation.verifyAICSignedAttestation({
    attestation: expiringAttestation,
    trustStore: keys.trust_store,
    verifiedAt: expiringStatement.expires_at
  });
  assert.equal(result.status, "untrusted");
  assert.ok(result.findings.some((finding) => finding.code === "expired_attestation"));
});

test("AIC refuses to sign a structurally inconsistent passed proof", () => {
  const keys = automation.generateAICTrustKeyPair({
    allowedOrigins: [ORIGIN],
    generatedAt: ISSUED_AT,
    issuerId: "aic.fixture"
  });
  const malformedProof = structuredClone(proof);
  malformedProof.summary.scenarios = 999;

  assert.throws(
    () =>
      automation.createAICSignedAttestation({
        contract,
        deployment: {
          deployment_id: "invalid-proof",
          environment: "development",
          origin: ORIGIN,
          source_revision: SOURCE_REVISION
        },
        issuedAt: ISSUED_AT,
        issuer: { id: "aic.fixture", kind: "developer" },
        privateKeyPem: keys.private_key_pem,
        proof: malformedProof,
        runner: { id: "local-test", kind: "local" }
      }),
    /proof is invalid/
  );
});

test("AIC builds a self-verifiable registry and detects derived-field tampering", () => {
  const { attestation, keys } = createFixture();
  const registry = automation.buildAICTrustRegistry({
    attestations: [attestation],
    id: "aic.reference",
    trustStore: keys.trust_store,
    updatedAt: ISSUED_AT
  });

  assert.equal(spec.validateAICTrustRegistry(registry).ok, true);
  assert.equal(
    automation.verifyAICTrustRegistry({
      registry,
      trustStore: keys.trust_store,
      verifiedAt: ISSUED_AT
    }).status,
    "trusted"
  );
  assert.equal(
    automation.queryAICTrustRegistry({ origin: ORIGIN, registry }).length,
    1
  );

  const tampered = structuredClone(registry);
  tampered.entries[0].id = "forged-entry-id";
  const result = automation.verifyAICTrustRegistry({
    registry: tampered,
    trustStore: keys.trust_store,
    verifiedAt: ISSUED_AT
  });
  assert.equal(result.status, "invalid");
  assert.ok(result.findings.some((finding) => finding.code === "registry_entry_mismatch"));
});

test("CLI creates keys, attests a proof, verifies it, and publishes a registry", async () => {
  const tempDir = await createTempDir("aic-trust-");
  const privateKey = resolve(tempDir, "issuer-private.pem");
  const publicKey = resolve(tempDir, "issuer-public.pem");
  const trustStore = resolve(tempDir, "trust-store.json");
  const attestation = resolve(tempDir, "checkout-attestation.json");
  const attestationsDir = resolve(tempDir, "attestations");
  const registry = resolve(tempDir, "registry.json");

  const keygen = await runCli([
    "trust",
    "keygen",
    "--issuer-id",
    "aic.cli-fixture",
    "--private-key",
    privateKey,
    "--public-key",
    publicKey,
    "--trust-store",
    trustStore,
    "--origin",
    ORIGIN,
    "--generated-at",
    ISSUED_AT
  ]);
  assert.equal(keygen.code, 0, keygen.stderr);

  const attest = await runCli([
    "trust",
    "attest",
    contractPath,
    proofPath,
    "--private-key",
    privateKey,
    "--origin",
    ORIGIN,
    "--environment",
    "development",
    "--deployment-id",
    "checkout-demo-cli",
    "--source-revision",
    SOURCE_REVISION,
    "--issuer-id",
    "aic.cli-fixture",
    "--issuer-kind",
    "developer",
    "--runner-id",
    "cli-test",
    "--runner-kind",
    "local",
    "--issued-at",
    ISSUED_AT,
    "--out-file",
    attestation
  ]);
  assert.equal(attest.code, 0, attest.stderr);

  const verification = await runCli([
    "trust",
    "verify",
    attestation,
    "--trust-store",
    trustStore,
    "--contract",
    contractPath,
    "--proof",
    proofPath,
    "--expect-origin",
    ORIGIN,
    "--expect-revision",
    SOURCE_REVISION,
    "--verified-at",
    ISSUED_AT
  ]);
  assert.equal(verification.code, 0, verification.stderr);
  assert.match(verification.stdout, /"status": "trusted"/);

  const proofValidation = await runCli(["validate", "behavior-proof", proofPath]);
  assert.equal(proofValidation.code, 0, proofValidation.stderr);
  assert.match(proofValidation.stdout, /behavior proof is valid/);

  await mkdir(attestationsDir, { recursive: true });
  await writeJsonFile(resolve(attestationsDir, "checkout.json"), await readJsonFile(attestation));
  const build = await runCli([
    "registry",
    "build",
    attestationsDir,
    "--trust-store",
    trustStore,
    "--registry-id",
    "aic.cli-fixture",
    "--out-file",
    registry,
    "--updated-at",
    ISSUED_AT
  ]);
  assert.equal(build.code, 0, build.stderr);

  const query = await runCli([
    "registry",
    "query",
    registry,
    "--origin",
    ORIGIN,
    "--operation-id",
    "checkout.complete.domain"
  ]);
  assert.equal(query.code, 0, query.stderr);
  assert.match(query.stdout, /"matches": 1/);
});
