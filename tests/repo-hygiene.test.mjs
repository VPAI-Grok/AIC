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
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  "docs/release-checklist.md",
  "docs/coding-agents.md",
  "docs/supported-today.md",
  ".github/copilot-instructions.md",
  ".github/skills/aic-onboarding/SKILL.md",
  ".cursor/rules/aic.mdc",
  ".github/ISSUE_TEMPLATE/bug_report.md",
  ".github/ISSUE_TEMPLATE/feature_request.md",
  ".github/pull_request_template.md",
  "templates/agent-onboarding/AGENTS.md",
  "templates/agent-onboarding/CLAUDE.md",
  "templates/agent-onboarding/GEMINI.md",
  "templates/agent-onboarding/.github/copilot-instructions.md",
  "templates/agent-onboarding/.cursor/rules/aic.mdc",
  "templates/agent-onboarding/.github/skills/aic-onboarding/SKILL.md"
];

test("public launch files exist and README points to the public entrypoints", async () => {
  await Promise.all(
    requiredFiles.map(async (relativePath) => {
      await access(resolveFromRepo(relativePath), fsConstants.R_OK);
    })
  );

  const readme = await readFile(resolveFromRepo("README.md"), "utf8");
  assert.match(readme, /Start Here/);
  assert.match(readme, /Repo Status/);
  assert.match(readme, /supported-today\.md/);
  assert.match(readme, /reference-consumer\.test\.mjs/);
  assert.match(readme, /coding-agents\.md/);
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

      assert.equal(templateFile.contents, checkedInContents);
    })
  );
});
