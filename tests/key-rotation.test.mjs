import assert from "node:assert/strict";
import { sign } from "node:crypto";
import test from "node:test";

import { createForeignSigningKey } from "./crypto-fixtures.mjs";
import { importWorkspaceModule, readJsonFile, resolveFromRepo } from "./helpers.mjs";

const automation = await importWorkspaceModule("packages/automation-core/dist/automation-core/src/index.js");
const spec = await importWorkspaceModule("packages/spec/dist/index.js");
const interop = await readJsonFile(resolveFromRepo("interop/aic-trust-0.1/valid/bundle.json"));
const { contract, proof } = interop;
const ORIGIN = "https://checkout.example";
const REVISION = "b".repeat(40);
const ISSUED = "2026-08-29T12:00:00.000Z";
const EFFECTIVE = "2026-08-30T00:00:00.000Z";
const RETIRE = "2026-08-31T00:00:00.000Z";

function fixture() {
  const retiring = automation.generateAICTrustKeyPair({ allowedOrigins: [ORIGIN], generatedAt: "2026-08-01T00:00:00.000Z", issuerId: "issuer.example" });
  const successor = automation.generateAICTrustKeyPair({ allowedOrigins: [ORIGIN], generatedAt: ISSUED, issuerId: "unused" });
  return {
    retiring,
    successor,
    ...automation.prepareAICScheduledKeyRotation({ effectiveAt: EFFECTIVE, issuedAt: ISSUED, issuerId: "issuer.example", priorTrustStore: retiring.trust_store, retireAt: RETIRE, retiringPrivateKeyPem: retiring.private_key_pem, successorPrivateKeyPem: successor.private_key_pem, transitionId: "rotation-2026-08" })
  };
}

test("scheduled rotation is dual-signed and produces an existing-format trust store", () => {
  const value = fixture();
  assert.equal(spec.validateAICSignedKeyTransition(value.transition).ok, true);
  assert.equal(spec.validateAICTrustStore(value.next_trust_store).ok, true);
  const verification = automation.verifyAICScheduledKeyTransition({ nextTrustStore: value.next_trust_store, priorTrustStore: value.retiring.trust_store, transition: value.transition, verifiedAt: ISSUED });
  assert.equal(verification.status, "trusted");
  assert.deepEqual(automation.applyAICScheduledKeyTransition({ nextTrustStore: value.next_trust_store, priorTrustStore: value.retiring.trust_store, transition: value.transition, verifiedAt: ISSUED }), value.next_trust_store);
  const old = value.next_trust_store.keys.find((key) => key.key_id === value.retiring.key_id);
  assert.equal(old.status, "active");
  assert.equal(old.valid_until, RETIRE);
});

test("old and successor attestations verify inside their issuance windows", () => {
  const value = fixture();
  const make = (privateKeyPem, issuedAt, id) => automation.createAICSignedAttestation({
    contract,
    deployment: { deployment_id: id, environment: "production", origin: ORIGIN, source_revision: REVISION },
    issuedAt,
    issuer: { id: "issuer.example", kind: "organization" },
    privateKeyPem,
    proof,
    runner: { id: "release", kind: "ci" }
  });
  const oldClaim = make(value.retiring.private_key_pem, "2026-08-30T12:00:00.000Z", "old");
  const newClaim = make(value.successor.private_key_pem, EFFECTIVE, "new");
  assert.equal(automation.verifyAICSignedAttestation({ attestation: oldClaim, trustStore: value.next_trust_store, verifiedAt: "2026-09-01T00:00:00.000Z" }).status, "trusted");
  assert.equal(automation.verifyAICSignedAttestation({ attestation: newClaim, trustStore: value.next_trust_store, verifiedAt: EFFECTIVE }).status, "trusted");
});

test("rotation rejects missing proof of possession, origin broadening, and compromise automation", () => {
  const value = fixture();
  const missing = structuredClone(value.transition);
  missing.signatures = missing.signatures.filter((item) => item.role !== "proof_of_possession");
  assert.equal(automation.verifyAICScheduledKeyTransition({ nextTrustStore: value.next_trust_store, priorTrustStore: value.retiring.trust_store, transition: missing, verifiedAt: ISSUED }).status, "invalid");

  const broadened = structuredClone(value.next_trust_store);
  broadened.keys.find((key) => key.key_id === value.successor.key_id).allowed_origins.push("https://admin.example");
  const broadening = automation.verifyAICScheduledKeyTransition({ nextTrustStore: broadened, priorTrustStore: value.retiring.trust_store, transition: value.transition, verifiedAt: ISSUED });
  assert.ok(broadening.findings.some((finding) => finding.code === "origin_broadening"));

  const compromise = structuredClone(value.transition);
  compromise.statement.reason = "compromise";
  assert.equal(spec.validateAICSignedKeyTransition(compromise).ok, false);
});

test("rotation cannot revoke the old key or alter unrelated pinned keys", () => {
  const value = fixture();
  const revoked = structuredClone(value.next_trust_store);
  revoked.keys.find((key) => key.key_id === value.retiring.key_id).status = "revoked";
  const result = automation.verifyAICScheduledKeyTransition({ nextTrustStore: revoked, priorTrustStore: value.retiring.trust_store, transition: value.transition, verifiedAt: ISSUED });
  assert.ok(result.findings.some((finding) => finding.code === "key_policy_invalid"));
});

test("rotation verification rejects RSA and P-256 keys mislabeled as Ed25519", () => {
  const value = fixture();

  for (const kind of ["rsa", "ec"]) {
    const retiring = createForeignSigningKey(kind);
    const successor = createForeignSigningKey(kind);
    const priorTrustStore = structuredClone(value.retiring.trust_store);
    priorTrustStore.keys[0].key_id = retiring.key_id;
    priorTrustStore.keys[0].public_key_pem = retiring.public_key_pem;

    const nextTrustStore = structuredClone(value.next_trust_store);
    nextTrustStore.keys[0].key_id = retiring.key_id;
    nextTrustStore.keys[0].public_key_pem = retiring.public_key_pem;
    nextTrustStore.keys[1].key_id = successor.key_id;
    nextTrustStore.keys[1].public_key_pem = successor.public_key_pem;

    const transition = structuredClone(value.transition);
    transition.statement.retiring_key_id = retiring.key_id;
    transition.statement.successor_key_id = successor.key_id;
    transition.statement.prior_trust_store_digest =
      automation.createAICDigest(priorTrustStore);
    transition.statement.next_trust_store_digest =
      automation.createAICDigest(nextTrustStore);
    const bytes = Buffer.from(
      `aic-key-transition-v1\0${automation.createAICCanonicalJson(transition.statement)}`,
      "utf8"
    );
    transition.signatures = [
      {
        role: "authorizing",
        signature: {
          algorithm: "ed25519",
          key_id: retiring.key_id,
          value: sign(null, bytes, retiring.private_key).toString("base64")
        }
      },
      {
        role: "proof_of_possession",
        signature: {
          algorithm: "ed25519",
          key_id: successor.key_id,
          value: sign(null, bytes, successor.private_key).toString("base64")
        }
      }
    ];

    assert.equal(spec.validateAICSignedKeyTransition(transition).ok, true, kind);
    const result = automation.verifyAICScheduledKeyTransition({
      nextTrustStore,
      priorTrustStore,
      transition,
      verifiedAt: ISSUED
    });
    assert.equal(result.status, "untrusted", kind);
    assert.ok(
      result.findings.some((finding) => finding.code === "signature_invalid"),
      kind
    );
  }
});
