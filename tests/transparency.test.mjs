import assert from "node:assert/strict";
import { sign } from "node:crypto";
import test from "node:test";

import { createForeignSigningKey } from "./crypto-fixtures.mjs";
import { importWorkspaceModule, readJsonFile, resolveFromRepo } from "./helpers.mjs";

const automation = await importWorkspaceModule("packages/automation-core/dist/automation-core/src/index.js");
const spec = await importWorkspaceModule("packages/spec/dist/index.js");
const interop = await readJsonFile(resolveFromRepo("interop/aic-trust-0.1/valid/bundle.json"));
const { contract, proof } = interop;
const LOGGED_AT = "2026-08-29T18:00:00.000Z";
const REVISION = "c".repeat(40);

function fixture() {
  const log = automation.generateAICTrustKeyPair({ generatedAt: "2026-08-29T17:00:00.000Z", issuerId: "aic.reference.log" });
  const issuer = automation.generateAICTrustKeyPair({ allowedOrigins: ["https://checkout.example"], generatedAt: "2026-08-29T17:00:00.000Z", issuerId: "checkout.issuer" });
  const attestation = automation.createAICSignedAttestation({
    contract,
    deployment: { deployment_id: "prod-1", environment: "production", origin: "https://checkout.example", source_revision: REVISION },
    issuedAt: "2026-08-29T17:30:00.000Z",
    issuer: { id: "checkout.issuer", kind: "organization" },
    privateKeyPem: issuer.private_key_pem,
    proof,
    runner: { id: "remote-1", kind: "remote" }
  });
  const empty = automation.createAICTransparencyIndex({ issuedAt: "2026-08-29T17:30:00.000Z", logId: "aic.reference.log", privateKeyPem: log.private_key_pem });
  return { attestation, empty, issuer, log };
}

test("pinned signed checkpoints verify and append exactly one domain-separated entry", () => {
  const value = fixture();
  assert.equal(automation.verifyAICTransparencyIndex({ index: value.empty, logTrustStore: value.log.trust_store, verifiedAt: LOGGED_AT }).status, "trusted");
  const index = automation.appendAICTransparencyEntry({
    artifact: value.attestation,
    expectedHead: null,
    expectedSize: 0,
    externalReceipts: [{ artifact_digest: automation.createAICDigest(value.attestation), profile: "scitt-rfc9942", provider: "example-scitt", reference: "https://transparency.example/receipt/1" }],
    index: value.empty,
    kind: "attestation",
    loggedAt: LOGGED_AT,
    logTrustStore: value.log.trust_store,
    privateKeyPem: value.log.private_key_pem
  });
  assert.equal(index.entries.length, 1);
  assert.equal(index.entries[0].previous_entry_digest, null);
  assert.equal(index.checkpoint.statement.head_entry_digest, index.entries[0].entry_digest);
  const verification = automation.verifyAICTransparencyIndex({ index, logTrustStore: value.log.trust_store, verifiedAt: LOGGED_AT });
  assert.equal(verification.status, "trusted");
  assert.equal(verification.checks.external_receipts, "not_checked");
  assert.ok(verification.findings.some((finding) => finding.code === "external_receipt_not_checked" && finding.severity === "warning"));
});

test("entry replacement, deletion, reordering, and stale-head append fail closed", () => {
  const value = fixture();
  const first = automation.appendAICTransparencyEntry({ artifact: value.attestation, expectedHead: null, expectedSize: 0, index: value.empty, kind: "attestation", loggedAt: LOGGED_AT, logTrustStore: value.log.trust_store, privateKeyPem: value.log.private_key_pem });
  assert.throws(() => automation.appendAICTransparencyEntry({ artifact: value.attestation, expectedHead: null, expectedSize: 0, index: first, kind: "attestation", loggedAt: "2026-08-29T18:01:00.000Z", logTrustStore: value.log.trust_store, privateKeyPem: value.log.private_key_pem }), /changed since/);

  const replaced = structuredClone(first);
  replaced.entries[0].artifact.statement.deployment.deployment_id = "forged";
  assert.notEqual(automation.verifyAICTransparencyIndex({ index: replaced, logTrustStore: value.log.trust_store, verifiedAt: LOGGED_AT }).status, "trusted");

  const deleted = structuredClone(first);
  deleted.entries = [];
  assert.equal(automation.verifyAICTransparencyIndex({ index: deleted, logTrustStore: value.log.trust_store, verifiedAt: LOGGED_AT }).status, "invalid");
});

test("consistency accepts an append-only prefix and detects valid split histories", () => {
  const value = fixture();
  const branchA = automation.appendAICTransparencyEntry({ artifact: value.attestation, expectedHead: null, expectedSize: 0, index: value.empty, kind: "attestation", loggedAt: LOGGED_AT, logTrustStore: value.log.trust_store, privateKeyPem: value.log.private_key_pem });
  const otherArtifact = structuredClone(value.attestation);
  otherArtifact.statement.deployment.deployment_id = "branch-b";
  otherArtifact.signature.value = value.attestation.signature.value;
  // The transparency profile validates attestation shape; issuer signature trust remains a separate verifier concern.
  const branchB = automation.appendAICTransparencyEntry({ artifact: otherArtifact, expectedHead: null, expectedSize: 0, index: value.empty, kind: "attestation", loggedAt: LOGGED_AT, logTrustStore: value.log.trust_store, privateKeyPem: value.log.private_key_pem });
  assert.equal(automation.verifyAICTransparencyConsistency({ from: value.empty, logTrustStore: value.log.trust_store, to: branchA, verifiedAt: LOGGED_AT }).status, "consistent");
  assert.equal(automation.verifyAICTransparencyConsistency({ from: branchA, logTrustStore: value.log.trust_store, to: branchB, verifiedAt: LOGGED_AT }).status, "inconsistent");
  assert.equal(automation.verifyAICTransparencyIndex({ index: branchA, logTrustStore: value.log.trust_store, verifiedAt: LOGGED_AT }).status, "trusted");
  assert.equal(automation.verifyAICTransparencyIndex({ index: branchB, logTrustStore: value.log.trust_store, verifiedAt: LOGGED_AT }).status, "trusted");
});

test("consistency rejects a multi-entry extension with a regressed checkpoint time", () => {
  const value = fixture();
  const first = automation.appendAICTransparencyEntry({ artifact: value.attestation, expectedHead: null, expectedSize: 0, index: value.empty, kind: "attestation", loggedAt: "2026-08-29T17:40:00.000Z", logTrustStore: value.log.trust_store, privateKeyPem: value.log.private_key_pem });
  const second = automation.appendAICTransparencyEntry({ artifact: value.attestation, expectedHead: first.entries[0].entry_digest, expectedSize: 1, index: first, kind: "attestation", loggedAt: "2026-08-29T17:41:00.000Z", logTrustStore: value.log.trust_store, privateKeyPem: value.log.private_key_pem });
  const laterPrior = automation.createAICTransparencyIndex({ issuedAt: "2026-08-29T17:59:00.000Z", logId: "aic.reference.log", privateKeyPem: value.log.private_key_pem });

  assert.equal(automation.verifyAICTransparencyIndex({ index: laterPrior, logTrustStore: value.log.trust_store, verifiedAt: LOGGED_AT }).status, "trusted");
  assert.equal(automation.verifyAICTransparencyIndex({ index: second, logTrustStore: value.log.trust_store, verifiedAt: LOGGED_AT }).status, "trusted");
  const consistency = automation.verifyAICTransparencyConsistency({ from: laterPrior, logTrustStore: value.log.trust_store, to: second, verifiedAt: LOGGED_AT });
  assert.equal(consistency.status, "inconsistent");
  assert.ok(consistency.findings.some((finding) => finding.code === "time_order_invalid"));
});

test("checkpoint signer must be separately pinned", () => {
  const value = fixture();
  const otherLog = automation.generateAICTrustKeyPair({ generatedAt: "2026-08-29T17:00:00.000Z", issuerId: "other.log" });
  const result = automation.verifyAICTransparencyIndex({ index: value.empty, logTrustStore: otherLog.trust_store, verifiedAt: LOGGED_AT });
  assert.equal(result.status, "untrusted");
  assert.ok(result.findings.some((finding) => finding.code === "checkpoint_signer_untrusted"));
});

test("checkpoint verification rejects RSA and P-256 keys mislabeled as Ed25519", () => {
  const value = fixture();

  for (const kind of ["rsa", "ec"]) {
    const foreign = createForeignSigningKey(kind);
    const index = structuredClone(value.empty);
    index.checkpoint.signature.key_id = foreign.key_id;
    index.checkpoint.signature.value = sign(
      null,
      Buffer.from(
        `aic-transparency-checkpoint-v1\0${automation.createAICCanonicalJson(index.checkpoint.statement)}`,
        "utf8"
      ),
      foreign.private_key
    ).toString("base64");
    const trustStore = structuredClone(value.log.trust_store);
    trustStore.keys[0].key_id = foreign.key_id;
    trustStore.keys[0].public_key_pem = foreign.public_key_pem;

    const result = automation.verifyAICTransparencyIndex({
      index,
      logTrustStore: trustStore,
      verifiedAt: LOGGED_AT
    });
    assert.equal(result.status, "untrusted", kind);
    assert.ok(
      result.findings.some(
        (finding) => finding.code === "checkpoint_signer_untrusted"
      ),
      kind
    );
  }
});

test("runtime validation rejects empty external receipt arrays like the public schema", () => {
  const value = fixture();
  const index = automation.appendAICTransparencyEntry({ artifact: value.attestation, expectedHead: null, expectedSize: 0, index: value.empty, kind: "attestation", loggedAt: LOGGED_AT, logTrustStore: value.log.trust_store, privateKeyPem: value.log.private_key_pem });
  index.entries[0].external_receipts = [];
  const validation = spec.validateAICTransparencyIndex(index);
  assert.equal(validation.ok, false);
  assert.ok(validation.issues.some((issue) => issue.rule === "transparency.receipts_empty"));
});
