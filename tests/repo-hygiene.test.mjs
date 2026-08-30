import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

import { importWorkspaceModule, resolveFromRepo } from "./helpers.mjs";

const requiredFiles = [
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  "CHANGELOG.md",
  "ADOPTERS.md",
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  "docs/release-checklist.md",
  "docs/behavior-assurance.md",
  "docs/conformance-packs.md",
  "docs/coding-agents.md",
  "docs/evidence-adapters.md",
  "docs/npm-packages.md",
  "docs/npm-trusted-publishing.md",
  "docs/assurance-policy.md",
  "docs/supported-today.md",
  "docs/transparency-and-key-rotation.md",
  "docs/trust-layer.md",
  ".github/copilot-instructions.md",
  ".github/skills/aic-onboarding/SKILL.md",
  ".cursor/rules/aic.mdc",
  ".github/ISSUE_TEMPLATE/bug_report.md",
  ".github/ISSUE_TEMPLATE/feature_request.md",
  ".github/pull_request_template.md",
  ".github/workflows/publish-packages.yml",
  ".github/workflows/behavior-assurance.yml",
  "schemas/behavior-contract.schema.json",
  "schemas/behavior-observation-set.schema.json",
  "schemas/behavior-proof.schema.json",
  "schemas/assurance-policy.schema.json",
  "schemas/conformance-binding.schema.json",
  "schemas/conformance-pack.schema.json",
  "schemas/conformance-result.schema.json",
  "schemas/deployment-identity.schema.json",
  "schemas/evidence-bundle.schema.json",
  "schemas/evidence-plan.schema.json",
  "schemas/key-transition.schema.json",
  "schemas/policy-evaluation.schema.json",
  "schemas/remote-observation-job.schema.json",
  "schemas/reliance-decision.schema.json",
  "schemas/reliance-record.schema.json",
  "schemas/reliance-snapshot.schema.json",
  "schemas/signed-attestation.schema.json",
  "schemas/transparency-checkpoint.schema.json",
  "schemas/transparency-index.schema.json",
  "schemas/trust-registry.schema.json",
  "schemas/trust-statement.schema.json",
  "schemas/trust-store.schema.json",
  "registry/index.json",
  "registry/README.md",
  "registry/submissions/README.md",
  "interop/aic-trust-0.1/manifest.json",
  "policies/critical-assurance.json",
  "transparency/README.md",
  "packages/conformance-packs/package.json",
  "packages/evidence-core/package.json",
  "packages/evidence-http/package.json",
  "packages/evidence-mcp/package.json",
  "packages/evidence-playwright/package.json",
  "packages/runner-remote/package.json",
  "packages/verify-core/package.json",
  "packages/rely/package.json",
  "packages/reliance-server/package.json",
  "templates/agent-onboarding/AGENTS.md",
  "templates/agent-onboarding/CLAUDE.md",
  "templates/agent-onboarding/GEMINI.md",
  "templates/agent-onboarding/.github/copilot-instructions.md",
  "templates/agent-onboarding/.cursor/rules/aic.mdc",
  "templates/agent-onboarding/.github/skills/aic-onboarding/SKILL.md"
];

const publicSchemaFiles = requiredFiles.filter((file) => file.startsWith("schemas/"));

function normalizeLineEndings(value) {
  return value.replaceAll("\r\n", "\n");
}

test("public launch files exist and README points to the public entrypoints", async () => {
  await Promise.all(
    requiredFiles.map(async (relativePath) => {
      await access(resolveFromRepo(relativePath), fsConstants.R_OK);
    })
  );

  const readme = await readFile(resolveFromRepo("README.md"), "utf8");
  assert.match(readme, /Quick start/i);
  assert.match(readme, /Behavior Assurance/);
  assert.match(readme, /AIC Verified/);
  assert.match(readme, /trust-layer\.md/);
  assert.match(readme, /Standards describe\. AIC proves\./);
  assert.match(readme, /release-status\.md/);
  assert.match(readme, /supported-today\.md/);
  assert.match(readme, /coding-agents\.md/);
  assert.match(readme, /npm-packages\.md/);
  assert.doesNotMatch(readme, /\]\(\/mnt\//);
  assert.doesNotMatch(readme, /\]\([A-Za-z]:\//);
});

test("agent onboarding wrappers point back to the canonical AGENTS file", async () => {
  const claude = await readFile(resolveFromRepo("CLAUDE.md"), "utf8");
  const gemini = await readFile(resolveFromRepo("GEMINI.md"), "utf8");
  const copilot = await readFile(resolveFromRepo(".github/copilot-instructions.md"), "utf8");
  const cursorRule = await readFile(resolveFromRepo(".cursor/rules/aic.mdc"), "utf8");
  const skill = await readFile(resolveFromRepo(".github/skills/aic-onboarding/SKILL.md"), "utf8");

  assert.match(claude, /AGENTS\.md/);
  assert.match(gemini, /AGENTS\.md/);
  assert.match(copilot, /AGENTS\.md/);
  assert.match(cursorRule, /AGENTS\.md/);
  assert.match(skill, /AGENTS\.md/);
});

test("public JSON Schema artifacts parse and declare stable canonical ids", async () => {
  await Promise.all(
    publicSchemaFiles.map(async (relativePath) => {
      const schema = JSON.parse(await readFile(resolveFromRepo(relativePath), "utf8"));
      assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
      assert.equal(schema.$id, `https://aic.dev/${relativePath.replaceAll("\\", "/")}`);
      assert.equal(schema.type, "object");
    })
  );
});

test("automation-core onboarding templates stay in sync with checked-in template files", async () => {
  const automationCore = await importWorkspaceModule(
    "packages/automation-core/dist/automation-core/src/index.js"
  );

  await Promise.all(
    automationCore.AIC_AGENT_ONBOARDING_TEMPLATE_FILES.map(async (templateFile) => {
      const checkedInContents = await readFile(
        resolveFromRepo("templates/agent-onboarding", templateFile.path),
        "utf8"
      );

      assert.equal(
        normalizeLineEndings(templateFile.contents),
        normalizeLineEndings(checkedInContents)
      );
    })
  );
});

test("CI installs the isolated action toolchain and enforces source-bundle reproducibility", async () => {
  const [ci, rootPackage] = await Promise.all([
    readFile(resolveFromRepo(".github/workflows/ci.yml"), "utf8"),
    readFile(resolveFromRepo("package.json"), "utf8").then(JSON.parse)
  ]);

  assert.match(
    ci,
    /npm --prefix actions\/aic-rely ci --ignore-scripts --no-audit --no-fund/u
  );
  assert.match(ci, /pnpm verify:action-bundle/u);
  assert.equal(
    rootPackage.scripts["verify:action-bundle"],
    "npm --prefix actions/aic-rely run check:bundle"
  );
  assert.equal(rootPackage.scripts["test:contracts"], "node --test tests/*.test.mjs");
});
