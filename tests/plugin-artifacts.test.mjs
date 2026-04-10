import assert from "node:assert/strict";
import test from "node:test";

import {
  assertGoldenProjectFixture,
  generateGoldenProjectFixture
} from "./golden-artifacts.mjs";
import { importWorkspaceModule, resolveFromRepo } from "./helpers.mjs";

const pluginNext = await importWorkspaceModule("packages/plugin-next/dist/plugin-next/src/index.js");
const pluginVite = await importWorkspaceModule("packages/plugin-vite/dist/plugin-vite/src/index.js");
const spec = await importWorkspaceModule("packages/spec/dist/index.js");

const fixtureRoot = resolveFromRepo("tests/fixtures/plugin-app");

test("Vite scan ignores build output directories and extracts explicit AIC annotations", async () => {
  const matches = await pluginVite.scanViteProjectForAICAnnotations(fixtureRoot);
  const analyzed = await pluginVite.analyzeViteProjectForAICAnnotations(fixtureRoot);

  assert.deepEqual(
    matches.map((match) => match.agentId),
    [
      "customer.actions",
      "customer.actions.menu",
      "customer.archive",
      "customer.archive.dialog",
      "customer.view"
    ]
  );
  assert.deepEqual(
    matches.map((match) => match.file),
    ["src/App.tsx", "src/App.tsx", "src/App.tsx", "src/App.tsx", "src/App.tsx"]
  );
  assert.ok(matches.every((match) => !match.file.includes("dist")));
  assert.equal(analyzed.diagnostics.length, 3);
  assert.equal(analyzed.source_inventory.length, 9);
  assert.deepEqual(
    analyzed.diagnostics.map((diagnostic) => diagnostic.code),
    [
      "unsupported_import_reference",
      "unsupported_call_expression",
      "unsupported_expression"
    ]
  );
  assert.ok(analyzed.diagnostics.every((diagnostic) => diagnostic.attribute === "agentId"));
  assert.ok(analyzed.diagnostics.every((diagnostic) => diagnostic.file === "src/App.tsx"));
});

test("Vite artifact generation produces valid manifests from scan results", async () => {
  const { artifacts, files } = await generateGoldenProjectFixture("vite");

  assert.equal(artifacts.discovery.framework, "vite");
  assert.equal(artifacts.matches.length, 5);
  assert.equal(artifacts.diagnostics.length, 3);
  assert.equal(artifacts.source_inventory.length, 9);
  assert.deepEqual(
    artifacts.ui.elements.map((element) => element.id),
    [
      "customer.actions",
      "customer.actions.menu",
      "customer.archive",
      "customer.archive.dialog",
      "customer.view"
    ]
  );
  assert.equal(spec.validateRuntimeUiManifest(artifacts.ui).ok, true);
  assert.equal(spec.validateSemanticActionsManifest(artifacts.actions).ok, true);
  await assertGoldenProjectFixture("vite", files);
});

test("Next scan ignores framework output directories and extracts explicit AIC annotations", async () => {
  const matches = await pluginNext.scanNextProjectForAICAnnotations(fixtureRoot);
  const analyzed = await pluginNext.analyzeNextProjectForAICAnnotations(fixtureRoot);

  assert.deepEqual(
    matches.map((match) => match.agentId),
    [
      "customer.actions",
      "customer.actions.menu",
      "customer.archive",
      "customer.archive.dialog",
      "customer.view"
    ]
  );
  assert.deepEqual(
    matches.map((match) => match.file),
    ["src/App.tsx", "src/App.tsx", "src/App.tsx", "src/App.tsx", "src/App.tsx"]
  );
  assert.ok(matches.every((match) => !match.file.includes(".next")));
  assert.equal(analyzed.diagnostics.length, 3);
  assert.equal(analyzed.source_inventory.length, 9);
  assert.deepEqual(
    analyzed.diagnostics.map((diagnostic) => diagnostic.code),
    [
      "unsupported_import_reference",
      "unsupported_call_expression",
      "unsupported_expression"
    ]
  );
  assert.ok(analyzed.diagnostics.every((diagnostic) => diagnostic.attribute === "agentId"));
  assert.ok(analyzed.diagnostics.every((diagnostic) => diagnostic.file === "src/App.tsx"));
});

test("Next artifact generation produces valid manifests from scan results", async () => {
  const { artifacts, files } = await generateGoldenProjectFixture("next");

  assert.equal(artifacts.discovery.framework, "nextjs");
  assert.equal(artifacts.matches.length, 5);
  assert.equal(artifacts.diagnostics.length, 3);
  assert.equal(artifacts.source_inventory.length, 9);
  assert.deepEqual(
    artifacts.actions.actions.map((action) => action.target),
    [
      "customer.actions",
      "customer.actions.menu",
      "customer.archive",
      "customer.archive.dialog",
      "customer.view"
    ]
  );
  assert.equal(spec.validateRuntimeUiManifest(artifacts.ui).ok, true);
  assert.equal(spec.validateSemanticActionsManifest(artifacts.actions).ok, true);
  await assertGoldenProjectFixture("next", files);
});
