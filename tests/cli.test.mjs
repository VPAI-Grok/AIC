import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { rm } from "node:fs/promises";
import test from "node:test";

import {
  readDirectoryFileMap,
  readExpectedGoldenProjectFixture
} from "./golden-artifacts.mjs";
import {
  createTempDir,
  importWorkspaceModule,
  readJsonFile,
  resolveFromRepo,
  runCli,
  writeTextFile,
  writeJsonFile
} from "./helpers.mjs";

const automationCore = await importWorkspaceModule(
  "packages/automation-core/dist/automation-core/src/index.js"
);
const spec = await importWorkspaceModule("packages/spec/dist/index.js");
const fixtureRoot = resolveFromRepo("tests/fixtures/plugin-app");
const capturesFile = resolveFromRepo("tests/fixtures/bootstrap/captures.json");
const diffFixtureRoot = resolveFromRepo("tests/fixtures/diffs");
const exampleViteConfig = resolveFromRepo("examples/react-basic/aic.project.json");
const projectNextConfig = resolveFromRepo("tests/fixtures/plugin-app/project.next.json");
const projectViteConfig = resolveFromRepo("tests/fixtures/plugin-app/project.vite.json");
const projectReportFixture = await readJsonFile(
  resolveFromRepo("tests/fixtures/plugin-app/expected/vite/report.json")
);
const suggestionsFile = resolveFromRepo("tests/fixtures/bootstrap/suggestions.json");
const expectedActionsDetailed = await readJsonFile(
  resolveFromRepo("tests/fixtures/diffs/expected/actions-detailed.json")
);
const expectedActionsSummary = await readJsonFile(
  resolveFromRepo("tests/fixtures/diffs/expected/actions-summary.json")
);
const expectedDiscoveryDetailed = await readJsonFile(
  resolveFromRepo("tests/fixtures/diffs/expected/discovery-detailed.json")
);
const expectedPermissionsDetailed = await readJsonFile(
  resolveFromRepo("tests/fixtures/diffs/expected/permissions-detailed.json")
);
const expectedUiSummary = await readJsonFile(
  resolveFromRepo("tests/fixtures/diffs/expected/ui-summary.json")
);
const expectedWorkflowSummary = await readJsonFile(
  resolveFromRepo("tests/fixtures/diffs/expected/workflows-summary.json")
);

test("CLI scan reports annotated elements from source files", async () => {
  const result = await runCli(["scan", fixtureRoot]);

  assert.equal(result.code, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.summary.filesScanned, 1);
  assert.equal(payload.summary.extractedElements, 5);
  assert.equal(payload.summary.sourceInventoryEntries, 9);
  assert.equal(payload.summary.warnings, 3);
  assert.deepEqual(
    payload.matches.map((match) => match.agentId),
    [
      "customer.actions",
      "customer.actions.menu",
      "customer.archive",
      "customer.archive.dialog",
      "customer.view"
    ]
  );
  assert.equal(payload.source_inventory.length, 9);
  assert.deepEqual(
    payload.diagnostics.map((diagnostic) => diagnostic.code),
    [
      "unsupported_import_reference",
      "unsupported_call_expression",
      "unsupported_expression"
    ]
  );
  assert.ok(payload.diagnostics.every((diagnostic) => diagnostic.file === "src/App.tsx"));
});

test("CLI validate surfaces manifest errors for invalid runtime UI", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const invalidUiFile = `${tempDir}/invalid-ui.json`;
  await writeJsonFile(invalidUiFile, {
    spec: "aic/0.1",
    updated_at: "2026-03-28T00:00:00.000Z",
    page: {
      url: "https://demo.example"
    },
    view: {
      view_id: "customers.list"
    },
    elements: [
      {
        id: "customer.archive",
        label: "Archive customer",
        role: "button",
        actions: [
          {
            name: "click"
          }
        ],
        risk: "critical",
        state: {
          visible: true
        }
      }
    ]
  });

  const result = await runCli(["validate", "ui", invalidUiFile]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Critical actions require structured confirmation details/);
});

test("CLI validate and inspect surface discovery endpoint capability drift", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const discoveryFile = `${tempDir}/invalid-discovery.json`;
  await writeJsonFile(discoveryFile, {
    spec: spec.SPEC_VERSION,
    manifest_version: spec.MANIFEST_VERSION,
    generated_at: "2026-04-11T00:00:00.000Z",
    app: {
      name: "Discovery Drift Demo"
    },
    capabilities: {
      runtimeUiTree: true,
      semanticActions: true,
      permissions: false,
      workflows: true
    },
    endpoints: {
      ui: "/.well-known/agent/ui",
      actions: "/.well-known/agent/actions",
      permissions: "/agent-permissions.json"
    }
  });

  const validateResult = await runCli(["validate", "discovery", discoveryFile]);
  const inspectResult = await runCli(["inspect", discoveryFile]);

  assert.equal(validateResult.code, 1);
  assert.match(validateResult.stderr, /Expected an endpoint for advertised workflows capability/);
  assert.match(validateResult.stderr, /Endpoint is present but permissions capability is disabled/);
  assert.equal(inspectResult.code, 0);
  assert.match(inspectResult.stdout, /Discovery manifest for Discovery Drift Demo/);
  assert.match(inspectResult.stdout, /Capabilities: runtimeUiTree, semanticActions, workflows/);
  assert.match(inspectResult.stdout, /- permissions: \/agent-permissions\.json/);
  assert.match(inspectResult.stdout, /- workflows: \(missing\)/);
  assert.match(inspectResult.stdout, /Validation issues: 2/);
});

test("CLI generate and diff commands produce stable machine-readable output", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const discoveryConfig = `${tempDir}/discovery.json`;
  const operateConfig = `${tempDir}/operate.json`;

  await writeJsonFile(discoveryConfig, {
    appName: "Demo App",
    framework: "vite",
    notes: ["fixture config"]
  });
  await writeJsonFile(operateConfig, {
    appName: "Demo App"
  });

  const discoveryResult = await runCli(["generate", "discovery", discoveryConfig]);
  const operateResult = await runCli(["generate", "operate", operateConfig]);
  const diffResult = await runCli([
    "diff",
    "ui",
    `${diffFixtureRoot}/ui-before.json`,
    `${diffFixtureRoot}/ui-after.json`
  ]);
  const actionDiffResult = await runCli([
    "diff",
    "actions",
    `${diffFixtureRoot}/actions-before.json`,
    `${diffFixtureRoot}/actions-after.json`
  ]);
  const actionDetailedResult = await runCli([
    "diff",
    "actions",
    `${diffFixtureRoot}/actions-before.json`,
    `${diffFixtureRoot}/actions-after.json`,
    "--format",
    "detailed"
  ]);
  const discoveryDetailedResult = await runCli([
    "diff",
    "discovery",
    `${diffFixtureRoot}/discovery-before.json`,
    `${diffFixtureRoot}/discovery-after.json`,
    "--format",
    "detailed"
  ]);
  const permissionsDetailedResult = await runCli([
    "diff",
    "permissions",
    `${diffFixtureRoot}/permissions-before.json`,
    `${diffFixtureRoot}/permissions-after.json`,
    "--format",
    "detailed"
  ]);
  const workflowDiffResult = await runCli([
    "diff",
    "workflows",
    `${diffFixtureRoot}/workflows-before.json`,
    `${diffFixtureRoot}/workflows-after.json`
  ]);

  assert.equal(discoveryResult.code, 0);
  assert.equal(operateResult.code, 0);
  assert.equal(diffResult.code, 0);
  assert.equal(actionDiffResult.code, 0);
  assert.equal(actionDetailedResult.code, 0);
  assert.equal(discoveryDetailedResult.code, 0);
  assert.equal(permissionsDetailedResult.code, 0);
  assert.equal(workflowDiffResult.code, 0);

  const discovery = JSON.parse(discoveryResult.stdout);
  assert.equal(discovery.app.name, "Demo App");
  assert.equal(discovery.framework, "vite");
  assert.match(operateResult.stdout, /AIC is enabled for Demo App\./);
  assert.deepEqual(JSON.parse(diffResult.stdout), expectedUiSummary);
  assert.deepEqual(JSON.parse(actionDiffResult.stdout), expectedActionsSummary);
  assert.deepEqual(JSON.parse(actionDetailedResult.stdout), expectedActionsDetailed);
  assert.deepEqual(JSON.parse(discoveryDetailedResult.stdout), expectedDiscoveryDetailed);
  assert.deepEqual(JSON.parse(permissionsDetailedResult.stdout), expectedPermissionsDetailed);
  assert.deepEqual(JSON.parse(workflowDiffResult.stdout), expectedWorkflowSummary);
});

test("CLI generate project emits the full artifact set and writes generated files", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const viteOutDir = `${tempDir}/vite`;
  const nextOutDir = `${tempDir}/next`;
  const viteResult = await runCli([
    "generate",
    "project",
    projectViteConfig,
    "--out-dir",
    viteOutDir
  ]);
  const nextResult = await runCli([
    "generate",
    "project",
    projectNextConfig,
    "--out-dir",
    nextOutDir
  ]);

  assert.equal(viteResult.code, 0);
  assert.equal(nextResult.code, 0);

  const vitePayload = JSON.parse(viteResult.stdout);
  const nextPayload = JSON.parse(nextResult.stdout);
  const expectedVite = await readExpectedGoldenProjectFixture("vite");
  const expectedNext = await readExpectedGoldenProjectFixture("next");
  const viteFiles = await readDirectoryFileMap(viteOutDir);
  const nextFiles = await readDirectoryFileMap(nextOutDir);

  assert.equal(nextPayload.framework, "nextjs");
  assert.equal(nextPayload.diagnostics.length, 3);
  assert.equal(nextPayload.generated_manifests.summary.invalid, 0);
  assert.equal(vitePayload.source_inventory.length, 9);
  assert.equal(vitePayload.agent_onboarding.summary.recommended, 5);
  assert.equal(vitePayload.agent_onboarding.summary.missing, 5);
  assert.equal(vitePayload.agent_onboarding.summary.warnings, 5);
  assert.equal(vitePayload.generated_manifests.summary.invalid, 0);
  assert.ok(vitePayload.outDir.endsWith(viteOutDir));
  assert.ok(nextPayload.outDir.endsWith(nextOutDir));
  assert.deepEqual(viteFiles, expectedVite.files);
  assert.deepEqual(nextFiles, expectedNext.files);
});

test("CLI project report and inspect summarize recommended onboarding files", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const outDir = `${tempDir}/example-vite`;
  const result = await runCli([
    "generate",
    "project",
    exampleViteConfig,
    "--out-dir",
    outDir
  ]);

  assert.equal(result.code, 0);

  const payload = JSON.parse(result.stdout);
  const report = await readJsonFile(`${outDir}/report.json`);
  const inspectResult = await runCli(["inspect", `${outDir}/report.json`]);

  assert.equal(payload.agent_onboarding.summary.recommended, 5);
  assert.equal(payload.agent_onboarding.summary.present, 5);
  assert.equal(payload.agent_onboarding.summary.missing, 0);
  assert.equal(report.generated_manifests.summary.invalid, 0);
  assert.equal(report.agent_onboarding.summary.warnings, 0);
  assert.equal(report.agent_onboarding.files[0].path, "AGENTS.md");
  assert.equal(inspectResult.code, 0);
  assert.match(inspectResult.stdout, /AIC project report for vite/);
  assert.match(inspectResult.stdout, /High-risk matches: 1/);
  assert.match(inspectResult.stdout, /High-risk IDs: customer.archive/);
  assert.match(inspectResult.stdout, /Agent onboarding: 5\/5 recommended present/);
  assert.match(inspectResult.stdout, /Next actions:/);
  assert.match(
    inspectResult.stdout,
    /1\. Review confirmation and risk metadata for high-risk actions: customer\.archive\./
  );
});

test("CLI inspect project report surfaces onboarding and extraction next actions", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const reportFile = `${tempDir}/project-report.json`;
  await writeJsonFile(reportFile, projectReportFixture);

  const inspectResult = await runCli(["inspect", reportFile]);

  assert.equal(inspectResult.code, 0);
  assert.match(inspectResult.stdout, /AIC project report for vite/);
  assert.match(inspectResult.stdout, /Top diagnostic codes: unsupported_/);
  assert.match(inspectResult.stdout, /Agent onboarding: 0\/5 recommended present/);
  assert.match(inspectResult.stdout, /Onboarding warnings: 5/);
  assert.match(inspectResult.stdout, /Next actions:/);
  assert.match(
    inspectResult.stdout,
    /1\. Add or refresh the recommended agent onboarding files so repo instructions stay aligned for AI operators\./
  );
  assert.match(
    inspectResult.stdout,
    /2\. Replace unsupported dynamic AIC props with same-file deterministic values, then rerun `aic scan` or `aic generate project`\./
  );
  assert.match(
    inspectResult.stdout,
    /3\. Review confirmation and risk metadata for high-risk actions: customer\.archive\./
  );
});

test("CLI inspect project report surfaces invalid generated manifest summaries", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  await writeJsonFile(`${tempDir}/package.json`, {
    dependencies: {
      react: "^19.0.0",
      vite: "^6.4.1"
    },
    name: "invalid-project-report-demo"
  });

  await writeJsonFile(`${tempDir}/aic.project.json`, {
    appName: "Invalid Project Report Demo",
    framework: "vite",
    projectRoot: ".",
    viewId: "customers.list",
    viewUrl: "https://demo.example/customers"
  });

  await writeTextFile(
    `${tempDir}/src/App.tsx`,
    `export function App() {
  return (
    <main>
      <button
        agentId="duplicate.action"
        agentDescription="Duplicate action one"
        agentAction="click"
        agentRisk="medium"
      >
        First duplicate
      </button>
      <button
        agentId="duplicate.action"
        agentDescription="Duplicate action two"
        agentAction="click"
        agentRisk="medium"
      >
        Second duplicate
      </button>
    </main>
  );
}
`
  );

  const outDir = `${tempDir}/generated`;
  const result = await runCli([
    "generate",
    "project",
    `${tempDir}/aic.project.json`,
    "--out-dir",
    outDir
  ]);

  assert.equal(result.code, 0);

  const payload = JSON.parse(result.stdout);
  const report = await readJsonFile(`${outDir}/report.json`);
  const inspectResult = await runCli(["inspect", `${outDir}/report.json`]);

  assert.ok(payload.generated_manifests.summary.invalid >= 1);
  const uiFinding = report.generated_manifests.findings.find(
    (finding) => finding.manifest_kind === "ui" && finding.issue_count >= 1
  );
  assert.ok(uiFinding);
  assert.equal(typeof uiFinding.top_issue?.path, "string");
  assert.equal(typeof uiFinding.top_issue?.message, "string");
  assert.equal(inspectResult.code, 0);
  assert.match(inspectResult.stdout, /Invalid generated manifests: .*ui \([1-9]\d*\)/);
  assert.match(inspectResult.stdout, /Generated manifest issues: ui: \$\./);
  assert.match(inspectResult.stdout, /Next actions:/);
  assert.match(
    inspectResult.stdout,
    /Regenerate and inspect invalid generated manifests before review: ui: \$\./
  );
});

test("CLI init scaffolds onboarding files and config with dry-run, write, skip, and force modes", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  await writeJsonFile(`${tempDir}/package.json`, {
    dependencies: {
      react: "^19.0.0",
      vite: "^6.4.1"
    },
    name: "fresh-vite-app"
  });

  const dryRunResult = await runCli(["init", tempDir, "--dry-run"]);
  assert.equal(dryRunResult.code, 0);

  const dryRunPayload = JSON.parse(dryRunResult.stdout);
  assert.equal(dryRunPayload.artifact_type, "aic_init_result");
  assert.equal(dryRunPayload.framework, "vite");
  assert.equal(dryRunPayload.app_name, "fresh-vite-app");
  assert.equal(dryRunPayload.summary.planned, 7);
  assert.ok(dryRunPayload.files.every((file) => file.status === "planned"));

  const writeResult = await runCli(["init", tempDir]);
  assert.equal(writeResult.code, 0);

  const writePayload = JSON.parse(writeResult.stdout);
  assert.equal(writePayload.summary.created, 7);
  assert.equal(writePayload.summary.skipped, 0);

  const config = await readJsonFile(`${tempDir}/aic.project.json`);
  assert.equal(config.appName, "fresh-vite-app");
  assert.equal(config.framework, "vite");
  assert.equal(config.hmr, true);
  assert.equal(config.viewId, "vite.root");
  assert.equal(config.viewUrl, "http://localhost:5173");

  const skipResult = await runCli(["init", tempDir]);
  assert.equal(skipResult.code, 0);
  assert.equal(JSON.parse(skipResult.stdout).summary.skipped, 7);

  const forceResult = await runCli(["init", tempDir, "--force"]);
  assert.equal(forceResult.code, 0);
  const forcePayload = JSON.parse(forceResult.stdout);
  assert.equal(forcePayload.summary.overwritten, 7);

  const initResultFile = `${tempDir}/init-result.json`;
  await writeJsonFile(initResultFile, forcePayload);

  const inspectResult = await runCli(["inspect", initResultFile]);
  assert.equal(inspectResult.code, 0);
  assert.match(inspectResult.stdout, /AIC init result/);
  assert.match(inspectResult.stdout, /Framework: vite/);
  assert.match(inspectResult.stdout, /Overwritten: 7/);
});

test("CLI doctor reports missing config, warning-only repos, and inspect summaries", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  await writeJsonFile(`${tempDir}/package.json`, {
    dependencies: {
      next: "^15.0.0",
      react: "^19.0.0"
    },
    name: "doctor-next-app"
  });

  const missingConfigResult = await runCli(["doctor", tempDir]);
  assert.equal(missingConfigResult.code, 1);
  const missingConfigPayload = JSON.parse(missingConfigResult.stdout);
  assert.equal(missingConfigPayload.artifact_type, "aic_doctor_report");
  assert.equal(missingConfigPayload.detected_framework, "nextjs");
  assert.ok(
    missingConfigPayload.findings.some((finding) => finding.code === "missing_project_config")
  );

  await runCli(["init", tempDir]);

  const reportFile = `${tempDir}/doctor-report.json`;
  const doctorResult = await runCli(["doctor", tempDir, "--report-file", reportFile]);
  assert.equal(doctorResult.code, 0);

  const doctorPayload = JSON.parse(doctorResult.stdout);
  assert.equal(doctorPayload.summary.errors, 0);
  assert.ok(
    doctorPayload.findings.some((finding) => finding.code === "no_aic_annotations_found")
  );
  assert.ok(
    doctorPayload.findings.some((finding) => finding.code === "no_workflows_configured")
  );
  assert.ok(
    doctorPayload.findings.some((finding) => finding.code === "no_permission_policies_configured")
  );

  const writtenReport = await readJsonFile(reportFile);
  assert.equal(writtenReport.artifact_type, "aic_doctor_report");

  const inspectResult = await runCli(["inspect", reportFile]);
  assert.equal(inspectResult.code, 0);
  assert.match(inspectResult.stdout, /AIC doctor report/);
  assert.match(inspectResult.stdout, /Framework: nextjs/);
  assert.match(inspectResult.stdout, /Errors: 0/);
  assert.match(
    inspectResult.stdout,
    /Top finding codes: no_aic_annotations_found \(1\), no_permission_policies_configured \(1\), no_workflows_configured \(1\)/
  );
  assert.match(inspectResult.stdout, /Next actions:/);
  assert.match(
    inspectResult.stdout,
    /1\. Add explicit agent\* props to critical controls before generating production artifacts\./
  );
  assert.match(
    inspectResult.stdout,
    /2\. Add actionPolicies for risky or role-restricted actions\./
  );
  assert.match(
    inspectResult.stdout,
    /3\. Add at least one workflow definition for meaningful multi-step flows\./
  );
});

test("CLI doctor fails for invalid config JSON and invalid generated manifest output", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  await writeJsonFile(`${tempDir}/package.json`, {
    dependencies: {
      react: "^19.0.0",
      vite: "^6.4.1"
    },
    name: "broken-app"
  });

  await writeTextFile(`${tempDir}/aic.project.json`, "{\n");
  const invalidJsonResult = await runCli(["doctor", tempDir]);
  assert.equal(invalidJsonResult.code, 1);
  assert.ok(
    JSON.parse(invalidJsonResult.stdout).findings.some(
      (finding) => finding.code === "invalid_project_config"
    )
  );

  await writeJsonFile(`${tempDir}/aic.project.json`, {
    appName: "Broken App",
    framework: "vite",
    permissions: {},
    projectRoot: ".",
    workflows: []
  });
  await writeTextFile(
    `${tempDir}/src/App.tsx`,
    `export function App() {
  return (
    <main>
      <button
        agentId="duplicate.action"
        agentDescription="Duplicate action one"
        agentAction="click"
        agentRisk="medium"
      >
        First duplicate
      </button>
      <button
        agentId="duplicate.action"
        agentDescription="Duplicate action two"
        agentAction="click"
        agentRisk="medium"
      >
        Second duplicate
      </button>
    </main>
  );
}
`
  );

  const invalidManifestResult = await runCli(["doctor", tempDir]);
  assert.equal(invalidManifestResult.code, 1);
  const invalidManifestPayload = JSON.parse(invalidManifestResult.stdout);
  const invalidManifestFinding = invalidManifestPayload.findings.find(
    (finding) =>
      finding.code === "invalid_generated_manifest" && finding.manifest_kind === "ui"
  );
  assert.ok(invalidManifestFinding);
  assert.equal(typeof invalidManifestFinding.top_issue?.path, "string");
  assert.equal(typeof invalidManifestFinding.top_issue?.message, "string");

  const invalidManifestReportFile = `${tempDir}/invalid-manifest-report.json`;
  await writeJsonFile(invalidManifestReportFile, invalidManifestPayload);
  const inspectInvalidManifestResult = await runCli(["inspect", invalidManifestReportFile]);
  assert.equal(inspectInvalidManifestResult.code, 0);
  assert.match(inspectInvalidManifestResult.stdout, /Invalid generated manifests: ui \(1\)/);
  assert.match(inspectInvalidManifestResult.stdout, /Generated manifest issues: ui: \$\./);
  assert.match(inspectInvalidManifestResult.stdout, /Next actions:/);
  assert.match(
    inspectInvalidManifestResult.stdout,
    /1\. Run `aic generate project aic\.project\.json --out-dir \.aic` and inspect the ui manifest issues\. Top issue: ui: \$\./
  );
});

test("CLI bootstrap writes prompt, draft, review, and report artifacts from offline fixtures", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const promptFile = `${tempDir}/prompt.json`;
  const draftFile = `${tempDir}/draft.json`;
  const reviewFile = `${tempDir}/review.json`;
  const reportFile = `${tempDir}/report.txt`;

  const result = await runCli([
    "bootstrap",
    "https://demo.example",
    "--app-name",
    "Demo Bootstrap",
    "--captures-file",
    capturesFile,
    "--suggestions-file",
    suggestionsFile,
    "--prompt-file",
    promptFile,
    "--draft-file",
    draftFile,
    "--review-file",
    reviewFile,
    "--report-file",
    reportFile
  ]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Bootstrap review for Demo Bootstrap/);

  const prompt = await readJsonFile(promptFile);
  const draft = await readJsonFile(draftFile);
  const review = await readJsonFile(reviewFile);
  const report = await readFile(reportFile, "utf8");

  assert.equal(prompt.input.app.name, "Demo Bootstrap");
  assert.equal(draft.provider_name, "file-model");
  assert.equal(draft.suggestions[0].target, "customer.archive");
  assert.equal(review.artifact_type, "aic_bootstrap_review");
  assert.equal(review.summary.accepted_suggestions, 2);
  assert.equal(review.summary.filtered_suggestions, 0);
  assert.match(report, /Suggestion provider: file-model/);
  assert.match(report, /Accepted suggestions: 2/);

  const inspectResult = await runCli(["inspect", reviewFile]);

  assert.equal(inspectResult.code, 0);
  assert.match(inspectResult.stdout, /Bootstrap review for Demo Bootstrap/);
  assert.match(inspectResult.stdout, /Suggestions: 2 accepted, 0 filtered/);

  const promptOnlyResult = await runCli([
    "bootstrap",
    "https://demo.example",
    "--app-name",
    "Demo Bootstrap",
    "--captures-file",
    capturesFile,
    "--print-prompt"
  ]);

  assert.equal(promptOnlyResult.code, 0);
  assert.equal(JSON.parse(promptOnlyResult.stdout).input.app.name, "Demo Bootstrap");
});

test("CLI bootstrap applies max-suggestion filtering deterministically", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const reviewFile = `${tempDir}/review.json`;
  const result = await runCli([
    "bootstrap",
    "https://demo.example",
    "--app-name",
    "Demo Bootstrap",
    "--captures-file",
    capturesFile,
    "--suggestions-file",
    suggestionsFile,
    "--review-file",
    reviewFile,
    "--min-confidence",
    "0.5",
    "--max-suggestions",
    "1"
  ]);

  assert.equal(result.code, 0);

  const review = await readJsonFile(reviewFile);

  assert.equal(review.summary.accepted_suggestions, 1);
  assert.equal(review.summary.filtered_suggestions, 1);
  assert.equal(review.draft.suggestions[0].target, "customer.archive");
  assert.equal(review.suggestions[1].status, "filtered_out");
  assert.equal(review.suggestions[1].issues[0].code, "exceeds_max_suggestions");
});

test("CLI bootstrap validates provider timeout and retry flags", async () => {
  const invalidTimeout = await runCli([
    "bootstrap",
    "https://demo.example",
    "--captures-file",
    capturesFile,
    "--provider-timeout-ms",
    "0",
    "--print-prompt"
  ]);
  assert.equal(invalidTimeout.code, 1);
  assert.match(invalidTimeout.stderr, /--provider-timeout-ms must be a positive integer/);

  const invalidRetries = await runCli([
    "bootstrap",
    "https://demo.example",
    "--captures-file",
    capturesFile,
    "--provider-retries",
    "-1",
    "--print-prompt"
  ]);
  assert.equal(invalidRetries.code, 1);
  assert.match(invalidRetries.stderr, /--provider-retries must be a non-negative integer/);
});

test("CLI bootstrap surfaces normalized provider failures with retry context", async () => {
  const result = await runCli([
    "bootstrap",
    "https://demo.example",
    "--app-name",
    "Demo Bootstrap",
    "--captures-file",
    capturesFile,
    "--provider-endpoint",
    "http://127.0.0.1:9/suggest",
    "--provider-model",
    "fixture-model",
    "--provider-retries",
    "1",
    "--provider-timeout-ms",
    "250"
  ]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Bootstrap capture failed after planning routes: \//);
  assert.match(result.stderr, /Provider: http:http:\/\/127\.0\.0\.1:9\/suggest/);
  assert.match(result.stderr, /Failure kind: network/);
  assert.match(result.stderr, /Retryable: yes after 2 attempt\(s\)/);
  assert.match(result.stderr, /Provider request failed before a response was received/);
});

test("CLI generate authoring-plan emits a shared patch-plan artifact and inspect summarizes it", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const snapshotFile = `${tempDir}/snapshot.json`;
  const domCandidatesFile = `${tempDir}/dom-candidates.json`;
  const bootstrapReviewFile = `${tempDir}/bootstrap-review.json`;

  await writeJsonFile(snapshotFile, {
    spec: "aic/0.1",
    updated_at: "2026-03-28T00:00:00.000Z",
    page: {
      url: "https://demo.example/customers"
    },
    view: {
      route_pattern: "/customers",
      view_id: "customers.list"
    },
    elements: [
      {
        id: "customer.archive",
        label: "Archive customer",
        role: "button",
        actions: [
          {
            name: "click",
            target: "customer.archive",
            type: "element_action"
          }
        ],
        risk: "high",
        state: {
          visible: true
        }
      }
    ]
  });
  await writeJsonFile(domCandidatesFile, [
    {
      key: "/customers::button::send_renewal_email",
      label: "Send renewal email",
      page_url: "https://demo.example/customers",
      role: "button",
      route_pattern: "/customers",
      selectors: {
        text: "Send renewal email"
      },
      tag_name: "button"
    }
  ]);
  await writeJsonFile(bootstrapReviewFile, {
    artifact_type: "aic_bootstrap_review",
    suggestions: [
      {
        status: "accepted",
        suggestion: {
          action: "click",
          confidence_score: 0.88,
          label: "Send renewal email",
          review_required: false,
          risk: "medium",
          role: "button",
          route: "/customers",
          target: "customer.send_renewal_email"
        }
      }
    ]
  });

  const result = await runCli([
    "generate",
    "authoring-plan",
    snapshotFile,
    "--dom-candidates",
    domCandidatesFile,
    "--report",
    resolveFromRepo("tests/fixtures/plugin-app/expected/vite/report.json"),
    "--bootstrap-review",
    bootstrapReviewFile
  ]);

  assert.equal(result.code, 0);

  const plan = JSON.parse(result.stdout);

  assert.equal(plan.artifact_type, "aic_authoring_patch_plan");
  assert.equal(plan.summary.total_proposals, 2);
  assert.equal(plan.summary.ready, 2);
  assert.equal(plan.summary.apply_ready, 2);
  assert.equal(plan.summary.needs_source_match, 0);

  const inspectFile = `${tempDir}/authoring-plan.json`;
  await writeJsonFile(inspectFile, plan);

  const inspectResult = await runCli(["inspect", inspectFile]);

  assert.equal(inspectResult.code, 0);
  assert.match(inspectResult.stdout, /AIC authoring patch plan/);
  assert.match(inspectResult.stdout, /Proposals: 2/);
  assert.match(inspectResult.stdout, /Apply ready: 2/);
  assert.match(inspectResult.stdout, /Needs source match: 0/);
});

test("CLI apply authoring-plan supports dry-run and write modes with guarded exact source edits", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const sourceFile = `${tempDir}/src/App.tsx`;
  await writeTextFile(
    sourceFile,
    `export function App() {
  return (
    <main>
      <button
        agentId="customer.archive"
        agentDescription="Archive customer"
        agentAction="click"
        agentRisk="high"
      >
        Archive customer
      </button>
      <button data-testid="send-renewal">Send renewal email</button>
    </main>
  );
}
`
  );

  const artifacts = await automationCore.generateProjectArtifacts({
    appName: "Apply Fixture",
    framework: "vite",
    projectRoot: tempDir,
    viewId: "customers.list",
    viewUrl: "https://demo.example/customers"
  });
  const report = automationCore.createProjectArtifactReport("vite", artifacts, {
    projectRoot: tempDir
  });
  const plan = spec.buildAICAuthoringPatchPlan({
    bootstrap_review: {
      artifact_type: "aic_bootstrap_review",
      suggestions: [
        {
          status: "accepted",
          suggestion: {
            action: "click",
            confidence_score: 0.95,
            label: "Send renewal email",
            review_required: false,
            risk: "medium",
            role: "button",
            route: "/customers",
            target: "customer.send_renewal_email"
          }
        }
      ]
    },
    dom_candidates: [
      {
        key: "/customers::button::send_renewal_email",
        label: "Send renewal email",
        page_url: "https://demo.example/customers",
        role: "button",
        route_pattern: "/customers",
        selectors: {
          testId: "send-renewal",
          text: "Send renewal email"
        },
        tag_name: "button"
      }
    ],
    project_report: report,
    snapshot: {
      spec: "aic/0.1",
      updated_at: "2026-03-28T00:00:00.000Z",
      page: {
        url: "https://demo.example/customers"
      },
      view: {
        route_pattern: "/customers",
        view_id: "customers.list"
      },
      elements: [
        {
          id: "customer.archive",
          label: "Archive customer",
          description: "Archive selected customer",
          role: "menuitem",
          actions: [
            {
              name: "click",
              target: "customer.archive",
              type: "element_action"
            }
          ],
          confirmation: {
            type: "human_review"
          },
          entity_ref: {
            entity_id: "cust_123",
            entity_label: "Acme Co",
            entity_type: "customer"
          },
          requires_confirmation: true,
          risk: "critical",
          state: {
            visible: true
          },
          workflow_ref: "customer.archive"
        }
      ]
    }
  });

  const archiveProposal = plan.proposals.find((proposal) => proposal.key === "existing:customer.archive");
  assert.ok(archiveProposal);
  assert.deepEqual(archiveProposal.recommended_optional_props, {
    agentEntityId: "cust_123",
    agentEntityLabel: "Acme Co",
    agentEntityType: "customer",
    agentRequiresConfirmation: true,
    agentRole: "menuitem",
    agentWorkflowStep: "customer.archive"
  });
  assert.equal(plan.summary.review_only_metadata, 1);

  const planFile = `${tempDir}/authoring-plan.json`;
  const dryRunReportFile = `${tempDir}/apply-dry-run.json`;
  await writeJsonFile(planFile, plan);

  const dryRunResult = await runCli([
    "apply",
    "authoring-plan",
    planFile,
    "--project-root",
    tempDir,
    "--report-file",
    dryRunReportFile
  ]);

  assert.equal(dryRunResult.code, 0);
  const dryRunPayload = JSON.parse(dryRunResult.stdout);
  assert.equal(dryRunPayload.artifact_type, "aic_authoring_apply_result");
  assert.equal(dryRunPayload.dry_run, true);
  assert.equal(dryRunPayload.summary.applied, 2);
  assert.equal(dryRunPayload.summary.changed_files, 1);
  assert.equal((await readJsonFile(dryRunReportFile)).summary.applied, 2);

  const sourceAfterDryRun = await readFile(sourceFile, "utf8");
  assert.match(sourceAfterDryRun, /agentDescription="Archive customer"/);
  assert.doesNotMatch(sourceAfterDryRun, /customer\.send_renewal_email/);

  const writeResult = await runCli([
    "apply",
    "authoring-plan",
    planFile,
    "--project-root",
    tempDir,
    "--write"
  ]);

  assert.equal(writeResult.code, 0);
  const writePayload = JSON.parse(writeResult.stdout);
  assert.equal(writePayload.dry_run, false);
  assert.equal(writePayload.summary.applied, 2);

  const updatedSource = await readFile(sourceFile, "utf8");
  assert.match(updatedSource, /agentDescription="Archive selected customer"/);
  assert.match(updatedSource, /agentRisk="critical"/);
  assert.match(updatedSource, /agentRole="menuitem"/);
  assert.match(updatedSource, /agentRequiresConfirmation/);
  assert.match(updatedSource, /agentEntityId="cust_123"/);
  assert.match(updatedSource, /agentEntityType="customer"/);
  assert.match(updatedSource, /agentEntityLabel="Acme Co"/);
  assert.match(updatedSource, /agentWorkflowStep="customer\.archive"/);
  assert.match(updatedSource, /agentId="customer\.send_renewal_email"/);
  assert.match(updatedSource, /agentAction="click"/);

  const inspectResult = await runCli(["inspect", dryRunReportFile]);
  assert.equal(inspectResult.code, 0);
  assert.match(inspectResult.stdout, /AIC authoring apply result/);
  assert.match(inspectResult.stdout, /Applied: 2/);
});

test("CLI apply authoring-plan recovers drifted line numbers by opening tag signature", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const sourceFile = `${tempDir}/src/App.tsx`;
  await writeTextFile(
    sourceFile,
    `export function App() {
  return <button data-testid="send-renewal">Send renewal email</button>;
}
`
  );

  const artifacts = await automationCore.generateProjectArtifacts({
    appName: "Signature Recovery Fixture",
    framework: "vite",
    projectRoot: tempDir,
    viewId: "customers.list",
    viewUrl: "https://demo.example/customers"
  });
  const report = automationCore.createProjectArtifactReport("vite", artifacts, {
    projectRoot: tempDir
  });
  const plan = spec.buildAICAuthoringPatchPlan({
    bootstrap_review: {
      artifact_type: "aic_bootstrap_review",
      suggestions: [
        {
          status: "accepted",
          suggestion: {
            action: "click",
            confidence_score: 0.95,
            label: "Send renewal email",
            review_required: false,
            risk: "medium",
            role: "button",
            route: "/customers",
            target: "customer.send_renewal_email"
          }
        }
      ]
    },
    dom_candidates: [
      {
        key: "/customers::button::send_renewal_email",
        label: "Send renewal email",
        page_url: "https://demo.example/customers",
        role: "button",
        route_pattern: "/customers",
        selectors: {
          testId: "send-renewal",
          text: "Send renewal email"
        },
        tag_name: "button"
      }
    ],
    project_report: report,
    snapshot: {
      spec: "aic/0.1",
      updated_at: "2026-03-28T00:00:00.000Z",
      page: {
        url: "https://demo.example/customers"
      },
      view: {
        route_pattern: "/customers",
        view_id: "customers.list"
      },
      elements: []
    }
  });

  const proposal = plan.proposals.find((entry) => entry.key === "dom:/customers::button::send_renewal_email");
  assert.ok(proposal?.apply_target?.opening_tag_signature);

  const planFile = `${tempDir}/authoring-plan.json`;
  await writeJsonFile(planFile, plan);
  await writeTextFile(
    sourceFile,
    `\nexport function App() {
  return <button data-testid="send-renewal">Send renewal email</button>;
}
`
  );

  const result = await runCli([
    "apply",
    "authoring-plan",
    planFile,
    "--project-root",
    tempDir,
    "--write"
  ]);

  assert.equal(result.code, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.summary.applied, 1);
  assert.match(payload.outcomes[0].message, /Recovered source by opening tag signature/);

  const updatedSource = await readFile(sourceFile, "utf8");
  assert.match(updatedSource, /agentId="customer\.send_renewal_email"/);
});

test("CLI apply authoring-plan blocks spread-attribute targets", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const sourceFile = `${tempDir}/src/App.tsx`;
  await writeTextFile(
    sourceFile,
    `export function App(props) {
  return <button {...props} data-testid="send-renewal">Send renewal email</button>;
}
`
  );

  const artifacts = await automationCore.generateProjectArtifacts({
    appName: "Spread Block Fixture",
    framework: "vite",
    projectRoot: tempDir,
    viewId: "customers.list",
    viewUrl: "https://demo.example/customers"
  });
  const report = automationCore.createProjectArtifactReport("vite", artifacts, {
    projectRoot: tempDir
  });
  const plan = spec.buildAICAuthoringPatchPlan({
    bootstrap_review: {
      artifact_type: "aic_bootstrap_review",
      suggestions: [
        {
          status: "accepted",
          suggestion: {
            action: "click",
            confidence_score: 0.95,
            label: "Send renewal email",
            review_required: false,
            risk: "medium",
            role: "button",
            route: "/customers",
            target: "customer.send_renewal_email"
          }
        }
      ]
    },
    dom_candidates: [
      {
        key: "/customers::button::send_renewal_email",
        label: "Send renewal email",
        page_url: "https://demo.example/customers",
        role: "button",
        route_pattern: "/customers",
        selectors: {
          testId: "send-renewal",
          text: "Send renewal email"
        },
        tag_name: "button"
      }
    ],
    project_report: report,
    snapshot: {
      spec: "aic/0.1",
      updated_at: "2026-03-28T00:00:00.000Z",
      page: {
        url: "https://demo.example/customers"
      },
      view: {
        route_pattern: "/customers",
        view_id: "customers.list"
      },
      elements: []
    }
  });

  const proposal = plan.proposals.find((entry) => entry.key === "dom:/customers::button::send_renewal_email");
  assert.equal(proposal?.apply_status, "blocked");
  assert.equal(proposal?.apply_block_reason, "spread_attributes_present");
  assert.ok(proposal?.apply_target);

  const planFile = `${tempDir}/authoring-plan.json`;
  await writeJsonFile(planFile, plan);
  const result = await runCli([
    "apply",
    "authoring-plan",
    planFile,
    "--project-root",
    tempDir
  ]);

  assert.equal(result.code, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.summary.applied, 0);
  assert.equal(payload.summary.skipped, 1);
  assert.match(payload.outcomes[0].message, /JSX spread attributes/);
});

test("CLI apply authoring-plan blocks duplicate AIC props on exact matches", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const sourceFile = `${tempDir}/src/App.tsx`;
  await writeTextFile(
    sourceFile,
    `export function App() {
  return (
    <button
      agentId="customer.archive"
      agentDescription="Archive customer"
      agentDescription="Archive legacy customer"
      agentAction="click"
      agentRisk="high"
    >
      Archive customer
    </button>
  );
}
`
  );

  const artifacts = await automationCore.generateProjectArtifacts({
    appName: "Duplicate Prop Fixture",
    framework: "vite",
    projectRoot: tempDir,
    viewId: "customers.list",
    viewUrl: "https://demo.example/customers"
  });
  const report = automationCore.createProjectArtifactReport("vite", artifacts, {
    projectRoot: tempDir
  });
  const plan = spec.buildAICAuthoringPatchPlan({
    project_report: report,
    snapshot: {
      spec: "aic/0.1",
      updated_at: "2026-03-28T00:00:00.000Z",
      page: {
        url: "https://demo.example/customers"
      },
      view: {
        route_pattern: "/customers",
        view_id: "customers.list"
      },
      elements: [
        {
          id: "customer.archive",
          label: "Archive customer",
          description: "Archive selected customer",
          role: "button",
          actions: [
            {
              name: "click",
              target: "customer.archive",
              type: "element_action"
            }
          ],
          risk: "critical",
          state: {
            visible: true
          }
        }
      ]
    }
  });

  const proposal = plan.proposals.find((entry) => entry.key === "existing:customer.archive");
  assert.equal(proposal?.apply_status, "blocked");
  assert.equal(proposal?.apply_block_reason, "duplicate_aic_props");

  const planFile = `${tempDir}/authoring-plan.json`;
  await writeJsonFile(planFile, plan);
  const result = await runCli([
    "apply",
    "authoring-plan",
    planFile,
    "--project-root",
    tempDir
  ]);

  assert.equal(result.code, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.summary.applied, 0);
  assert.equal(payload.summary.skipped, 1);
  assert.match(payload.outcomes[0].message, /duplicate AIC props/);
});

test("CLI apply authoring-plan blocks dynamic existing AIC props on exact matches", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const sourceFile = `${tempDir}/src/App.tsx`;
  await writeTextFile(
    sourceFile,
    `export function App(customer) {
  return (
    <button
      agentId="customer.archive"
      agentDescription={customer.name}
      agentAction="click"
      agentRisk="high"
    >
      Archive customer
    </button>
  );
}
`
  );

  const artifacts = await automationCore.generateProjectArtifacts({
    appName: "Dynamic Prop Fixture",
    framework: "vite",
    projectRoot: tempDir,
    viewId: "customers.list",
    viewUrl: "https://demo.example/customers"
  });
  const report = automationCore.createProjectArtifactReport("vite", artifacts, {
    projectRoot: tempDir
  });
  const plan = spec.buildAICAuthoringPatchPlan({
    project_report: report,
    snapshot: {
      spec: "aic/0.1",
      updated_at: "2026-03-28T00:00:00.000Z",
      page: {
        url: "https://demo.example/customers"
      },
      view: {
        route_pattern: "/customers",
        view_id: "customers.list"
      },
      elements: [
        {
          id: "customer.archive",
          label: "Archive customer",
          description: "Archive selected customer",
          role: "button",
          actions: [
            {
              name: "click",
              target: "customer.archive",
              type: "element_action"
            }
          ],
          risk: "critical",
          state: {
            visible: true
          }
        }
      ]
    }
  });

  const proposal = plan.proposals.find((entry) => entry.key === "existing:customer.archive");
  assert.equal(proposal?.apply_status, "blocked");
  assert.equal(proposal?.apply_block_reason, "dynamic_existing_aic_prop");

  const planFile = `${tempDir}/authoring-plan.json`;
  await writeJsonFile(planFile, plan);
  const result = await runCli([
    "apply",
    "authoring-plan",
    planFile,
    "--project-root",
    tempDir
  ]);

  assert.equal(result.code, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.summary.applied, 0);
  assert.equal(payload.summary.skipped, 1);
  assert.match(payload.outcomes[0].message, /unsupported dynamic expressions/);
});

test("CLI apply authoring-plan skips proposals whose recorded source target drifted", async (t) => {
  const tempDir = await createTempDir();
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const sourceFile = `${tempDir}/src/App.tsx`;
  await writeTextFile(
    sourceFile,
    `export function App() {
  return <button data-testid="send-renewal">Send renewal email</button>;
}
`
  );

  const artifacts = await automationCore.generateProjectArtifacts({
    appName: "Drift Fixture",
    framework: "vite",
    projectRoot: tempDir,
    viewId: "customers.list",
    viewUrl: "https://demo.example/customers"
  });
  const report = automationCore.createProjectArtifactReport("vite", artifacts, {
    projectRoot: tempDir
  });
  const plan = spec.buildAICAuthoringPatchPlan({
    bootstrap_review: {
      artifact_type: "aic_bootstrap_review",
      suggestions: [
        {
          status: "accepted",
          suggestion: {
            action: "click",
            confidence_score: 0.95,
            label: "Send renewal email",
            review_required: false,
            risk: "medium",
            role: "button",
            route: "/customers",
            target: "customer.send_renewal_email"
          }
        }
      ]
    },
    dom_candidates: [
      {
        key: "/customers::button::send_renewal_email",
        label: "Send renewal email",
        page_url: "https://demo.example/customers",
        role: "button",
        route_pattern: "/customers",
        selectors: {
          testId: "send-renewal",
          text: "Send renewal email"
        },
        tag_name: "button"
      }
    ],
    project_report: report,
    snapshot: {
      spec: "aic/0.1",
      updated_at: "2026-03-28T00:00:00.000Z",
      page: {
        url: "https://demo.example/customers"
      },
      view: {
        route_pattern: "/customers",
        view_id: "customers.list"
      },
      elements: []
    }
  });

  const planFile = `${tempDir}/authoring-plan.json`;
  await writeJsonFile(planFile, plan);
  await writeTextFile(
    sourceFile,
    `\nexport function App() {
  return <button className="primary" data-testid="send-renewal">Send renewal email</button>;
}
`
  );

  const result = await runCli([
    "apply",
    "authoring-plan",
    planFile,
    "--project-root",
    tempDir
  ]);

  assert.equal(result.code, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.summary.applied, 0);
  assert.equal(payload.summary.skipped, 1);
  assert.match(payload.outcomes[0].message, /Recorded source target no longer matches/);
});
