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
const evidence = await importWorkspaceModule(
  "packages/evidence-playwright/dist/index.js"
);
const contract = await readJsonFile(
  resolveFromRepo("examples/nextjs-checkout-demo/aic-behavior-contract.json")
);
const observations = await readJsonFile(
  resolveFromRepo("examples/nextjs-checkout-demo/aic-browser-observations.json")
);

test("browser evidence package exposes native WebMCP execution primitives", () => {
  assert.equal(typeof evidence.launchAICBrowserEvidence, "function");
  assert.equal(typeof evidence.inspectNativeWebMCP, "function");
  assert.equal(typeof evidence.probeNativeWebMCPArgumentEncoding, "function");
  assert.equal(typeof evidence.executeNativeWebMCPTool, "function");
});

test("checked-in checkout evidence proves browser-native human/WebMCP parity", async () => {
  const proof = automation.verifyAICBehavior({
    contract,
    generatedAt: observations.generated_at,
    observations
  });
  assert.equal(proof.status, "passed");
  assert.equal(proof.evidence_level, "executed");
  assert.equal(proof.summary.observations, 10);
  assert.deepEqual(proof.findings, []);

  const webmcp = observations.observations.filter(
    (observation) => observation.surface_id === "webmcp"
  );
  assert.equal(webmcp.length, 5);
  for (const observation of webmcp) {
    assert.equal(observation.environment.native_webmcp, "true");
    assert.equal(observation.environment.webmcp_api, "document.modelContext");
    assert.ok(
      ["object_native", "json_string_compat"].includes(
        observation.environment.argument_encoding
      )
    );
  }

  for (const observation of observations.observations) {
    assert.equal(observation.mode, "executed");
    assert.equal(observation.evidence.length, 1);
    const screenshot = observation.evidence[0];
    const bytes = await readFile(
      resolveFromRepo("examples/nextjs-checkout-demo", screenshot.ref)
    );
    const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    assert.equal(digest, screenshot.digest);
  }
});
