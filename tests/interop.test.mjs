import assert from "node:assert/strict";
import test from "node:test";

import { createTempDir, importWorkspaceModule, resolveFromRepo, writeJsonFile } from "./helpers.mjs";

const automation = await importWorkspaceModule("packages/automation-core/dist/automation-core/src/index.js");
const manifestPath = resolveFromRepo("interop/aic-trust-0.1/manifest.json");

test("public trust fixtures freeze canonical JSON, digests, signatures, and stable checks", async () => {
  const suite = await automation.loadAICInteropSuite(manifestPath);
  const result = automation.verifyAICInteropSuite(suite);
  assert.equal(result.status, "passed");
  assert.equal(result.passed, 6);
  assert.equal(result.failed, 0);
});

test("tampered signed fixture exposes a stable signature_invalid code", async () => {
  const suite = await automation.loadAICInteropSuite(manifestPath);
  const fixture = structuredClone(suite.cases.find((item) => item.operation === "verify_attestation"));
  fixture.input.attestation.statement.deployment.deployment_id = "tampered";
  const actual = automation.executeAICInteropCase(fixture);
  assert.equal(actual.status, "untrusted");
  assert.ok(actual.finding_codes.includes("signature_invalid"));
  assert.equal(actual.checks.signature, "failed");
});

test("interop suites reject vacuous success, duplicates, and unknown fields", () => {
  const empty = { artifact_type: "aic_interop_suite", canonicalization: "aic-canonical-json/0.1", cases: [], id: "empty", spec: "aic.interop/0.1" };
  assert.throws(() => automation.verifyAICInteropSuite(empty), /Invalid AIC interoperability suite header/);
  const duplicate = {
    ...empty,
    cases: [
      { id: "same", operation: "digest", input: { value: {} }, expected: { digest: "x" } },
      { id: "same", operation: "digest", input: { value: {} }, expected: { digest: "x" } }
    ]
  };
  assert.throws(() => automation.verifyAICInteropSuite(duplicate), /Invalid AIC interoperability case/);
  assert.throws(() => automation.verifyAICInteropSuite({ ...duplicate, cases: [duplicate.cases[0]], extra: true }), /Invalid AIC interoperability suite header/);
});

test("fixture loader refuses references outside the suite directory", async () => {
  const directory = await createTempDir("aic-interop-");
  const manifest = resolveFromRepo(directory, "suite", "manifest.json");
  await writeJsonFile(resolveFromRepo(directory, "outside.json"), { secret: true });
  await writeJsonFile(manifest, {
    artifact_type: "aic_interop_suite",
    canonicalization: "aic-canonical-json/0.1",
    cases: [{ expected: { digest: "x" }, id: "escape", input: { value: { $ref: "../outside.json" } }, operation: "digest" }],
    id: "escape",
    spec: "aic.interop/0.1"
  });
  await assert.rejects(() => automation.loadAICInteropSuite(manifest), /must stay below/);
});
