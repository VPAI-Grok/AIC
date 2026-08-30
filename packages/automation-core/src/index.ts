import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve } from "node:path";
import ts from "typescript";
import { AICRegistry } from "@aicorg/runtime";
import {
  type AICAgentOnboardingFileStatus,
  type AICAgentOnboardingReport,
  type AICAgentOnboardingWarning,
  type AICDoctorFinding,
  type AICDoctorReport,
  type AICAuthoringApplyResult,
  type AICAuthoringPatchPlan,
  type AICAuthoringProjectReport,
  type AICAuthoringSourceInventoryEntry,
  diffAICManifestDetailed,
  diffAICManifestSummary,
  type AICCollectionDiffEntry,
  type AICDetailedCollectionDiffEntry,
  type AICDetailedManifestDiff,
  AICActionContract,
  AICDiscoveryManifest,
  AICElementManifest,
  type AICFieldDiffEntry,
  type AICInitFileResult,
  type AICInitResult,
  type AICManifestDiff,
  type AICManifestKind,
  AICPermissionsManifest,
  type AICRole,
  type AICValidationIssue,
  AICRuntimeUiManifest,
  AICSemanticActionsManifest,
  AICWorkflowManifest,
  validateDiscoveryManifest,
  validatePermissionsManifest,
  validateRuntimeUiManifest,
  validateSemanticActionsManifest,
  validateWorkflowManifest
} from "@aicorg/spec";

export * from "./assurance.js";
export * from "./trust.js";
export * from "./conformance.js";
export * from "./policy.js";
export * from "./transparency.js";
export * from "./key-rotation.js";
export * from "./interop.js";

export type AICAutomationSeverity = "warning" | "error";
export type AICAutomationManifestKind = AICManifestKind;

export interface AICExtractionDiagnostic {
  attribute?: string;
  code:
    | "cyclic_static_reference"
    | "missing_value"
    | "unresolved_identifier"
    | "unsupported_call_expression"
    | "unsupported_expression"
    | "unsupported_import_reference"
    | "unsupported_member_expression";
  column: number;
  file: string;
  line: number;
  message: string;
  severity: AICAutomationSeverity;
}

export interface AICSourceScanMatch {
  action?: string;
  agentContractRef?: string;
  agentDescription?: string;
  agentId: string;
  column: number;
  file: string;
  line: number;
  role: AICRole;
  risk?: string;
  source_key: string;
  tagName: string;
}

export interface AICFileScanResult {
  diagnostics: AICExtractionDiagnostic[];
  file: string;
  matches: AICSourceScanMatch[];
  records?: ParsedJsxElementRecord[];
  source_inventory: AICAuthoringSourceInventoryEntry[];
}

export interface AICProjectScanResult {
  diagnostics: AICExtractionDiagnostic[];
  files: string[];
  matches: AICSourceScanMatch[];
  records?: ParsedJsxElementRecord[];
  source_inventory: AICAuthoringSourceInventoryEntry[];
}

export interface AICProjectArtifactsOptions {
  appName: string;
  appVersion?: string;
  framework: string;
  generatedAt?: string;
  notes?: string[];
  operateNotes?: string[];
  permissions?: Partial<AICPermissionsManifest>;
  projectRoot?: string;
  updatedAt?: string;
  viewId?: string;
  viewUrl?: string;
  workflows?: AICWorkflowManifest["workflows"];
}

export interface AICProjectArtifacts {
  actions: AICSemanticActionsManifest;
  diagnostics: AICExtractionDiagnostic[];
  discovery: AICDiscoveryManifest;
  files: Record<string, string>;
  matches: AICSourceScanMatch[];
  operate: string;
  permissions: AICPermissionsManifest;
  scan: {
    filesScanned: number;
  };
  source_inventory: AICAuthoringSourceInventoryEntry[];
  ui: AICRuntimeUiManifest;
  workflows: AICWorkflowManifest;
}

export type {
  AICCollectionDiffEntry,
  AICDetailedCollectionDiffEntry,
  AICDetailedManifestDiff,
  AICFieldDiffEntry,
  AICManifestDiff
};

export type AICProjectArtifactReport = AICAuthoringProjectReport;

export const AIC_AGENT_ONBOARDING_TEMPLATE_VERSION = "5";

export type AICQAReadinessGrade = "pilot_ready" | "review_needed" | "not_ready";

export interface AICQAReadinessFinding {
  code:
    | "critical_action_missing_confirmation"
    | "extraction_diagnostics_present"
    | "generated_manifest_invalid"
    | "high_risk_action_missing_confirmation"
    | "high_value_action_missing_entity"
    | "missing_runtime_ui_manifest"
    | "no_explicit_workflows"
    | "workflow_ref_unresolved";
  element_id?: string;
  fix_hint: string;
  message: string;
  severity: "blocker" | "warning";
}

export interface AICQAReadinessCoverageSummary {
  covered: number;
  missing: number;
  rate: number;
  total: number;
}

export interface AICQAReadinessReport {
  artifact_type: "aic_qa_readiness_report";
  coverage: {
    confirmation: AICQAReadinessCoverageSummary;
    entity: AICQAReadinessCoverageSummary;
    execution: AICQAReadinessCoverageSummary;
    recovery: AICQAReadinessCoverageSummary;
    stable_ids: AICQAReadinessCoverageSummary;
    validation: AICQAReadinessCoverageSummary;
    workflow: AICQAReadinessCoverageSummary;
  };
  findings: AICQAReadinessFinding[];
  framework: string;
  generated_at: string;
  inputs: {
    actions_manifest: boolean;
    permissions_manifest: boolean;
    project_report: boolean;
    runtime_ui_manifest: boolean;
    workflows_manifest: boolean;
  };
  next_actions: string[];
  summary: {
    blockers: number;
    grade: AICQAReadinessGrade;
    high_or_critical_actions: number;
    score: number;
    total_elements: number;
    warnings: number;
    workflows: number;
  };
}

export interface AICQAReadinessInputs {
  actions?: AICSemanticActionsManifest;
  generatedAt?: string;
  permissions?: AICPermissionsManifest;
  projectReport: AICProjectArtifactReport;
  ui?: AICRuntimeUiManifest;
  workflows?: AICWorkflowManifest;
}

export interface AICQATestPlanStep {
  action: string;
  expected: string;
  requires_confirmation: boolean;
  target: string;
}

export interface AICQATestPlanScenario {
  id: string;
  max_risk: string;
  safety_path: boolean;
  steps: AICQATestPlanStep[];
  title: string;
}

export interface AICQATestPlan {
  artifact_type: "aic_qa_test_plan";
  generated_at: string;
  playwright_skeleton: string;
  scenarios: AICQATestPlanScenario[];
  source: "workflows" | "runtime_ui";
}

export interface AICQATestPlanInputs {
  generatedAt?: string;
  ui: AICRuntimeUiManifest;
  workflows?: AICWorkflowManifest;
}

export type AICWebMCPSourceFindingCode =
  | "declarative_autosubmit_requires_review"
  | "direct_native_registration"
  | "obsolete_webmcp_api"
  | "webmcp_not_detected";

export interface AICWebMCPSourceFinding {
  code: AICWebMCPSourceFindingCode;
  column?: number;
  file?: string;
  fix_hint: string;
  line?: number;
  message: string;
  severity: "error" | "info" | "warning";
}

export interface AICWebMCPSourceReadinessReport {
  artifact_type: "aic_webmcp_readiness_report";
  baseline: {
    api: "document.modelContext";
    draft: "2026-08-26";
    types: "0.1.5";
  };
  files: string[];
  findings: AICWebMCPSourceFinding[];
  generated_at: string;
  next_actions: string[];
  status: "blocked" | "not_detected" | "ready" | "review_needed";
  summary: {
    current_native_registrations: number;
    declarative_tools: number;
    direct_native_registrations: number;
    files_scanned: number;
    governed_registrations: number;
    obsolete_api_usages: number;
  };
}

export interface AICWebMCPImplementationPlan {
  acceptance_criteria: string[];
  artifact_type: "aic_webmcp_implementation_plan";
  baseline: AICWebMCPSourceReadinessReport["baseline"];
  generated_at: string;
  source_status: AICWebMCPSourceReadinessReport["status"];
  workstreams: Array<{
    actions: string[];
    id: string;
    priority: "now" | "next";
    title: string;
  }>;
}

export type AICSupportedInitFramework = "nextjs" | "react" | "vite";

export interface AICAgentOnboardingTemplateFile {
  contents: string;
  kind: AICAgentOnboardingFileStatus["kind"];
  path: string;
  recommended: boolean;
  template_version: string;
}

export interface AICInitializeProjectOptions {
  appName?: string;
  dryRun?: boolean;
  force?: boolean;
  framework?: AICSupportedInitFramework;
  now?: string;
  projectRoot?: string;
  viewId?: string;
  viewUrl?: string;
}

export interface AICDoctorOptions {
  configFile?: string;
  projectRoot?: string;
}

export const AIC_AGENT_ONBOARDING_TEMPLATE_FILES: AICAgentOnboardingTemplateFile[] = [
  {
    contents: `<!-- AIC_AGENT_ONBOARDING_TEMPLATE_VERSION: 5 -->
# AIC Agent Onboarding

Use AIC when this repo needs reliable interaction semantics and behavioral assurance for AI agents.

## Implementation Order

1. Identify important flows, risky actions, entities, and every human or agent entrypoint.
2. Add explicit \`agent*\` metadata to important controls.
3. Add or update \`aic.project.json\`.
4. Generate and inspect AIC artifacts.
5. Fix review findings before treating interaction metadata as ready.
6. Add behavior contracts and executable scenarios for consequential multi-surface actions.
7. Run \`aic verify\` before claiming behavioral parity.
8. Use rendered/native evidence and a deployment-bound signed claim before asking other systems to rely on the proof.
9. Bind consequential operations to an open conformance pack and enforce the applicable assurance policy in CI.
10. Immediately before consequential execution, produce a fresh canonical reliance decision from the consumer's own policy, pinned trust stores, trusted clock, and exact target bindings. Proceed only on \`allow\`.

## Rules

- stable IDs first
- explicit metadata over inference
- confirmation on critical actions
- entity metadata on record-scoped actions
- workflow, validation, execution, and recovery metadata where the app supports them
- one stable domain \`operation_id\` for surfaces that perform the same business action
- native protocol fields before duplicate AIC fields
- readiness and executed proof are separate claims
- a signed issuer claim is not independent production certification
- registries are untrusted discovery and require a separately pinned trust store
- remote mutation evidence requires separate operator capability and exact canary scope
- transparency indexes are locally signed append-only evidence, not automatic global transparency
- key transitions must be verified against the pinned prior trust store before application
- reliance decisions are short-lived and exact-request-bound; recompute locally when practical and reject stale, future, expired, or mismatched decisions
- resolver and registry records are untrusted discovery, not universal trust roots
- consumer policy, trust stores, identity pins, trusted current time, and final disposition belong to the relying party
- generated JSON stays generated

## WebMCP Rules

- treat WebMCP as the browser execution layer and AIC as the protocol-neutral assurance layer
- prefer native WebMCP fields and lifecycle controls when equivalent
- use the current \`document.modelContext\` API through explicit, feature-detected integration
- register only task-level tools backed by authored \`execution_ready\` action contracts
- reuse the human UI's application/domain function
- never expose inferred, AI-suggested, generated, or placeholder contracts as executable tools
- run \`aic scan <path> --webmcp\` and \`aic doctor <path> --webmcp\`

## Verification

- \`aic scan <path>\`
- \`aic generate project <config-file> --out-dir <dir>\`
- \`aic inspect <dir>/report.json\`
- \`aic validate <kind> <file>\`
- \`aic validate behavior <behavior-contract-file>\`
- \`aic verify <behavior-contract-file> --harness <module> --out-file <proof-file>\`
- \`aic trust verify <attestation-file> --trust-store <file> --contract <contract-file> --proof <proof-file> --expect-origin <origin> --expect-revision <revision>\`
- \`aic registry verify <registry-file> --trust-store <file>\`
- \`aic conformance verify <pack-id-or-file> <binding> <contract> --proof <proof-file>\`
- \`aic policy evaluate <policy> <contract> <proof> --observations <file>\`
- \`aic rely evaluate <policy> <contract> <proof> --observations <file> --attestation <file> --trust-store <file> --origin <origin> --operation-id <id> --deployment-id <id> --expect-revision <revision> --environment <environment>\`
- \`aic interop verify <suite>\`
- \`aic evidence verify <bundle> --runner-public-key <file> --runner-key-id <id>\`

## Reliance Rules

- use \`@aicorg/rely\` or \`aic rely evaluate\` immediately before WebMCP, MCP, HTTP, browser, or release execution
- require valid artifacts, exact bindings, a trusted signed attestation, regenerated proof, and every matching fail-closed policy rule before \`allow\`
- route \`confirm\` to a real confirmation flow; stop on \`deny\` or \`indeterminate\`
- use the caller's trusted current clock and a short replay window; do not trust an artifact-supplied timestamp for production preflight
- keep protocol-native authorization and application idempotency; a time-bounded decision is not a single-use nonce
- when policy requires transparency, verify the signed index with a separately pinned log trust store and exact attestation inclusion
- external receipt references remain unchecked until a provider-specific verifier succeeds
- mirror resolver snapshots freely, but reproduce the decision with consumer-owned trust and policy
`,
    kind: "canonical",
    path: "AGENTS.md",
    recommended: true,
    template_version: AIC_AGENT_ONBOARDING_TEMPLATE_VERSION
  },
  {
    contents: `<!-- AIC_AGENT_ONBOARDING_TEMPLATE_VERSION: 5 -->
# Claude Code Wrapper

Read \`AGENTS.md\` first and treat it as the canonical AIC policy for this repo.
`,
    kind: "wrapper",
    path: "CLAUDE.md",
    recommended: true,
    template_version: AIC_AGENT_ONBOARDING_TEMPLATE_VERSION
  },
  {
    contents: `<!-- AIC_AGENT_ONBOARDING_TEMPLATE_VERSION: 5 -->
# Gemini Wrapper

Read \`AGENTS.md\` first and follow it as the canonical AIC policy for this repo.
`,
    kind: "wrapper",
    path: "GEMINI.md",
    recommended: true,
    template_version: AIC_AGENT_ONBOARDING_TEMPLATE_VERSION
  },
  {
    contents: `<!-- AIC_AGENT_ONBOARDING_TEMPLATE_VERSION: 5 -->
# GitHub Copilot AIC Instructions

Use \`AGENTS.md\` as the canonical AIC instruction file for this repo.
`,
    kind: "copilot_instructions",
    path: ".github/copilot-instructions.md",
    recommended: true,
    template_version: AIC_AGENT_ONBOARDING_TEMPLATE_VERSION
  },
  {
    contents: `---
description: AIC implementation guidance for app code
globs:
  - "app/**"
  - "src/**"
  - "components/**"
  - "pages/**"
  - "lib/**"
alwaysApply: false
---
<!-- AIC_AGENT_ONBOARDING_TEMPLATE_VERSION: 5 -->

# AIC Cursor Rule

Follow \`AGENTS.md\` as the canonical AIC policy.
`,
    kind: "cursor_rule",
    path: ".cursor/rules/aic.mdc",
    recommended: true,
    template_version: AIC_AGENT_ONBOARDING_TEMPLATE_VERSION
  },
  {
    contents: `<!-- AIC_AGENT_ONBOARDING_TEMPLATE_VERSION: 5 -->
# AIC Onboarding

Use this skill when asked to make a React, Next.js, or Vite app AIC-ready.

Read \`AGENTS.md\`, add explicit metadata first, update \`aic.project.json\`, generate and inspect interaction artifacts, then add and verify behavior contracts for consequential multi-surface actions. Bind critical operations to a conformance pack, enforce assurance policy in CI, and independently verify origin/revision-bound signed claims before external reliance.
`,
    kind: "wrapper",
    path: ".github/skills/aic-onboarding/SKILL.md",
    recommended: false,
    template_version: AIC_AGENT_ONBOARDING_TEMPLATE_VERSION
  }
];

function getAICAgentOnboardingReport(projectRoot: string): AICAgentOnboardingReport {
  const files: AICAgentOnboardingFileStatus[] = [];
  const warnings: AICAgentOnboardingWarning[] = [];
  const versionPattern = /AIC_AGENT_ONBOARDING_TEMPLATE_VERSION:\s*([^\s>]+)/;

  for (const expectedFile of AIC_AGENT_ONBOARDING_TEMPLATE_FILES) {
    const resolvedPath = resolve(projectRoot, expectedFile.path);
    let status: AICAgentOnboardingFileStatus["status"] = "missing";
    let templateVersion: string | undefined;

    if (existsSync(resolvedPath)) {
      status = "present";

      try {
        const contents = readFileSync(resolvedPath, "utf8");
        const versionMatch = contents.match(versionPattern);

        if (versionMatch) {
          templateVersion = versionMatch[1];

          if (templateVersion !== AIC_AGENT_ONBOARDING_TEMPLATE_VERSION) {
            status = "stale";
          }
        }
      } catch {
        status = "stale";
      }
    }

    files.push({
      kind: expectedFile.kind,
      path: expectedFile.path,
      recommended: expectedFile.recommended,
      status,
      template_version: templateVersion
    });

    if (!expectedFile.recommended) {
      continue;
    }

    if (status === "missing") {
      warnings.push({
        code: "missing_agent_onboarding_file",
        file: expectedFile.path,
        message: `Recommended AIC agent onboarding file is missing: ${expectedFile.path}`,
        severity: "warning"
      });
    }

    if (status === "stale") {
      warnings.push({
        code: "stale_agent_onboarding_file",
        file: expectedFile.path,
        message: `AIC onboarding template marker in ${expectedFile.path} is stale. Expected version ${AIC_AGENT_ONBOARDING_TEMPLATE_VERSION}.`,
        severity: "warning"
      });
    }
  }

  return {
    files,
    summary: {
      missing: files.filter((file) => file.recommended && file.status === "missing").length,
      present: files.filter((file) => file.recommended && file.status === "present").length,
      recommended: files.filter((file) => file.recommended).length,
      stale: files.filter((file) => file.recommended && file.status === "stale").length,
      warnings: warnings.length
    },
    template_version: AIC_AGENT_ONBOARDING_TEMPLATE_VERSION,
    warnings
  };
}

interface AICProjectConfigInput {
  appName?: string;
  appVersion?: string;
  framework?: string;
  generatedAt?: string;
  hmr?: boolean;
  notes?: string[];
  permissions?: Partial<AICPermissionsManifest>;
  projectRoot?: string;
  updatedAt?: string;
  viewId?: string;
  viewUrl?: string;
  workflows?: AICWorkflowManifest["workflows"];
}

type AICValidatedProjectConfig = AICProjectConfigInput & {
  appName: string;
};

function isSupportedInitFramework(value: string | undefined): value is AICSupportedInitFramework {
  return value === "nextjs" || value === "react" || value === "vite";
}

async function readPackageJson(projectRoot: string): Promise<Record<string, unknown> | undefined> {
  const filePath = resolve(projectRoot, "package.json");

  try {
    const value = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function readPackageDependencyNames(packageJson: Record<string, unknown> | undefined): Set<string> {
  const names = new Set<string>();

  for (const key of ["dependencies", "devDependencies", "peerDependencies"]) {
    const bucket = packageJson?.[key];

    if (!bucket || typeof bucket !== "object") {
      continue;
    }

    for (const name of Object.keys(bucket as Record<string, unknown>)) {
      names.add(name);
    }
  }

  return names;
}

export async function detectAICProjectFramework(
  projectRoot: string
): Promise<AICSupportedInitFramework | undefined> {
  const packageJson = await readPackageJson(projectRoot);
  const dependencyNames = readPackageDependencyNames(packageJson);

  if (dependencyNames.has("next")) {
    return "nextjs";
  }

  if (dependencyNames.has("vite")) {
    return "vite";
  }

  if (dependencyNames.has("react")) {
    return "react";
  }

  return undefined;
}

function inferAICAppName(
  packageJson: Record<string, unknown> | undefined,
  projectRoot: string
): string {
  const packageName = packageJson?.name;

  if (typeof packageName === "string" && packageName.trim().length > 0) {
    return packageName.trim();
  }

  return basename(projectRoot);
}

function defaultViewUrlForFramework(framework: AICSupportedInitFramework): string {
  return framework === "vite" ? "http://localhost:5173" : "http://localhost:3000";
}

function createInitProjectConfig(
  options: Required<Pick<AICInitializeProjectOptions, "appName" | "viewId" | "viewUrl">> & {
    framework: AICSupportedInitFramework;
    now: string;
  }
): AICProjectConfigInput {
  return {
    appName: options.appName,
    framework: options.framework,
    generatedAt: options.now,
    ...(options.framework === "vite" ? { hmr: true } : {}),
    notes: ["initialized by aic init"],
    permissions: {},
    projectRoot: ".",
    updatedAt: options.now,
    viewId: options.viewId,
    viewUrl: options.viewUrl,
    workflows: []
  };
}

function summarizeInitFiles(files: AICInitFileResult[]): AICInitResult["summary"] {
  return {
    created: files.filter((file) => file.status === "created").length,
    overwritten: files.filter((file) => file.status === "overwritten").length,
    planned: files.filter((file) => file.status === "planned").length,
    skipped: files.filter((file) => file.status === "skipped").length,
    total: files.length
  };
}

export async function initializeAICProject(
  options: AICInitializeProjectOptions = {}
): Promise<AICInitResult> {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const packageJson = await readPackageJson(projectRoot);
  const detectedFramework = await detectAICProjectFramework(projectRoot);
  const framework = options.framework ?? detectedFramework;

  if (!framework) {
    throw new Error(
      "Unable to detect a supported framework for this repo. Pass --framework <nextjs|vite|react>."
    );
  }

  const appName = options.appName ?? inferAICAppName(packageJson, projectRoot);
  const now = options.now ?? new Date().toISOString();
  const viewId = options.viewId ?? `${framework}.root`;
  const viewUrl = options.viewUrl ?? defaultViewUrlForFramework(framework);
  const configContents = `${JSON.stringify(
    createInitProjectConfig({
      appName,
      framework,
      now,
      viewId,
      viewUrl
    }),
    null,
    2
  )}\n`;
  const fileDefinitions: Array<{
    contents: string;
    kind: AICInitFileResult["kind"];
    path: string;
    template_version?: string;
  }> = [
    {
      contents: configContents,
      kind: "project_config",
      path: "aic.project.json"
    },
    ...AIC_AGENT_ONBOARDING_TEMPLATE_FILES.map((file) => ({
      contents: file.contents,
      kind: file.kind,
      path: file.path,
      template_version: file.template_version
    }))
  ];

  const files: AICInitFileResult[] = [];

  for (const file of fileDefinitions) {
    const resolvedPath = resolve(projectRoot, file.path);
    const exists = existsSync(resolvedPath);
    const action: AICInitFileResult["action"] = exists
      ? options.force
        ? "overwrite"
        : "skip"
      : "create";

    let status: AICInitFileResult["status"];

    if (action === "skip") {
      status = "skipped";
    } else if (options.dryRun) {
      status = "planned";
    } else {
      await mkdir(dirname(resolvedPath), { recursive: true });
      await writeFile(resolvedPath, file.contents, "utf8");
      status = action === "create" ? "created" : "overwritten";
    }

    files.push({
      action,
      kind: file.kind,
      path: file.path,
      status,
      template_version: file.template_version
    });
  }

  return {
    app_name: appName,
    artifact_type: "aic_init_result",
    config_file: "aic.project.json",
    dry_run: options.dryRun ?? false,
    files,
    framework,
    next_steps: [
      "Add explicit agent* metadata to critical flows.",
      "Run `aic doctor` to audit onboarding, config, and manifest readiness.",
      "Run `aic generate project aic.project.json --out-dir .aic` once source metadata is in place."
    ],
    project_root: projectRoot,
    summary: summarizeInitFiles(files)
  };
}

function createDoctorFinding(
  finding: AICDoctorFinding
): AICDoctorFinding {
  return finding;
}

function summarizeDoctorFindings(findings: AICDoctorFinding[]): AICDoctorReport["summary"] {
  return {
    errors: findings.filter((finding) => finding.severity === "error").length,
    findings: findings.length,
    warnings: findings.filter((finding) => finding.severity === "warning").length
  };
}

function createEmptyDoctorScanSummary(): AICDoctorReport["scan"] {
  return {
    diagnostics: 0,
    files_scanned: 0,
    matches: 0,
    source_inventory: 0
  };
}

function isProjectConfigInput(value: unknown): value is AICValidatedProjectConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.appName === "string" && record.appName.trim().length > 0;
}

export async function createAICDoctorReport(
  options: AICDoctorOptions = {}
): Promise<AICDoctorReport> {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const onboarding = getAICAgentOnboardingReport(projectRoot);
  const findings: AICDoctorFinding[] = onboarding.warnings.map((warning) =>
    createDoctorFinding({
      code: warning.code,
      file: warning.file,
      fix_hint: `Run \`aic init ${projectRoot}\` or copy the matching onboarding template into place.`,
      message: warning.message,
      severity: warning.severity
    })
  );
  const configFilePath = options.configFile
    ? resolve(process.cwd(), options.configFile)
    : resolve(projectRoot, "aic.project.json");
  const packageDetectedFramework = await detectAICProjectFramework(projectRoot);
  const scan = createEmptyDoctorScanSummary();

  if (!existsSync(configFilePath)) {
    findings.unshift(
      createDoctorFinding({
        code: "missing_project_config",
        file: toPortablePath(relative(projectRoot, configFilePath) || "aic.project.json"),
        fix_hint: "Run `aic init` to scaffold aic.project.json, then update the app-specific fields.",
        message: "AIC project config is missing.",
        severity: "error"
      })
    );

    return {
      artifact_type: "aic_doctor_report",
      config_file: toPortablePath(relative(projectRoot, configFilePath) || "aic.project.json"),
      detected_framework: packageDetectedFramework,
      findings,
      framework: packageDetectedFramework,
      onboarding,
      project_root: projectRoot,
      scan,
      summary: summarizeDoctorFindings(findings)
    };
  }

  let configValue: unknown;

  try {
    configValue = JSON.parse(await readFile(configFilePath, "utf8"));
  } catch (error) {
    findings.unshift(
      createDoctorFinding({
        code: "invalid_project_config",
        file: toPortablePath(relative(projectRoot, configFilePath) || "aic.project.json"),
        fix_hint: "Fix the JSON syntax in aic.project.json.",
        message: error instanceof Error ? error.message : "Unable to read AIC project config JSON.",
        severity: "error"
      })
    );

    return {
      artifact_type: "aic_doctor_report",
      config_file: toPortablePath(relative(projectRoot, configFilePath) || "aic.project.json"),
      detected_framework: packageDetectedFramework,
      findings,
      framework: packageDetectedFramework,
      onboarding,
      project_root: projectRoot,
      scan,
      summary: summarizeDoctorFindings(findings)
    };
  }

  if (!isProjectConfigInput(configValue)) {
    findings.unshift(
      createDoctorFinding({
        code: "invalid_project_config",
        file: toPortablePath(relative(projectRoot, configFilePath) || "aic.project.json"),
        fix_hint: "Ensure aic.project.json contains at least a non-empty appName string.",
        message: "AIC project config must be an object with a non-empty appName.",
        severity: "error"
      })
    );

    return {
      artifact_type: "aic_doctor_report",
      config_file: toPortablePath(relative(projectRoot, configFilePath) || "aic.project.json"),
      detected_framework: packageDetectedFramework,
      findings,
      framework: packageDetectedFramework,
      onboarding,
      project_root: projectRoot,
      scan,
      summary: summarizeDoctorFindings(findings)
    };
  }

  const config = configValue;
  const framework = config.framework ?? packageDetectedFramework;

  if (!isSupportedInitFramework(framework)) {
    findings.unshift(
      createDoctorFinding({
        code: "unsupported_framework",
        file: toPortablePath(relative(projectRoot, configFilePath) || "aic.project.json"),
        fix_hint: "Set framework to nextjs, vite, or react, or run `aic init --framework <value>`.",
        message: "AIC adoption automation currently supports nextjs, vite, and react repos only.",
        severity: "error"
      })
    );

    return {
      artifact_type: "aic_doctor_report",
      config_file: toPortablePath(relative(projectRoot, configFilePath) || "aic.project.json"),
      detected_framework: packageDetectedFramework,
      findings,
      onboarding,
      project_root: projectRoot,
      scan,
      summary: summarizeDoctorFindings(findings)
    };
  }

  const configProjectRoot = resolve(dirname(configFilePath), config.projectRoot ?? ".");

  try {
    const projectRootStats = await stat(configProjectRoot);

    if (!projectRootStats.isDirectory()) {
      throw new Error("Configured projectRoot is not a directory.");
    }
  } catch (error) {
    findings.unshift(
      createDoctorFinding({
        code: "unreadable_project_root",
        file: toPortablePath(relative(projectRoot, configProjectRoot) || "."),
        fix_hint: "Update projectRoot in aic.project.json to point at a readable source directory.",
        message:
          error instanceof Error ? error.message : "Configured projectRoot is not readable.",
        severity: "error"
      })
    );

    return {
      artifact_type: "aic_doctor_report",
      config_file: toPortablePath(relative(projectRoot, configFilePath) || "aic.project.json"),
      detected_framework: packageDetectedFramework,
      findings,
      framework,
      onboarding,
      project_root: projectRoot,
      scan,
      summary: summarizeDoctorFindings(findings)
    };
  }

  const artifacts = await generateProjectArtifacts({
    appName: config.appName,
    appVersion: config.appVersion,
    framework,
    generatedAt: config.generatedAt,
    notes: config.notes,
    operateNotes:
      framework === "vite"
        ? [
            ...(config.notes ?? []),
            config.hmr === false ? "HMR metadata refresh disabled." : "HMR metadata refresh enabled."
          ]
        : config.notes,
    permissions: config.permissions,
    projectRoot: configProjectRoot,
    updatedAt: config.updatedAt,
    viewId: config.viewId,
    viewUrl: config.viewUrl,
    workflows: config.workflows
  });

  scan.diagnostics = artifacts.diagnostics.length;
  scan.files_scanned = artifacts.scan.filesScanned;
  scan.matches = artifacts.matches.length;
  scan.source_inventory = artifacts.source_inventory.length;

  if (artifacts.matches.length === 0) {
    findings.push(
      createDoctorFinding({
        code: "no_aic_annotations_found",
        file: toPortablePath(relative(projectRoot, configProjectRoot) || "."),
        fix_hint: "Add explicit agent* props to critical controls before generating production artifacts.",
        message: "No explicit AIC annotations were found in the configured project root.",
        severity: "warning"
      })
    );
  }

  if (artifacts.diagnostics.length > 0) {
    findings.push(
      createDoctorFinding({
        code: "extraction_diagnostics_present",
        file: toPortablePath(relative(projectRoot, configProjectRoot) || "."),
        fix_hint: "Review `aic scan` output and replace unsupported dynamic patterns with deterministic metadata where practical.",
        message: "Build-time extraction produced diagnostics that should be reviewed.",
        related_count: artifacts.diagnostics.length,
        severity: "warning"
      })
    );
  }

  if ((config.workflows?.length ?? 0) === 0) {
    findings.push(
      createDoctorFinding({
        code: "no_workflows_configured",
        file: toPortablePath(relative(projectRoot, configFilePath) || "aic.project.json"),
        fix_hint: "Add at least one workflow definition for meaningful multi-step flows.",
        message: "No workflows are configured in aic.project.json.",
        severity: "warning"
      })
    );
  }

  if (Object.keys(config.permissions?.actionPolicies ?? {}).length === 0) {
    findings.push(
      createDoctorFinding({
        code: "no_permission_policies_configured",
        file: toPortablePath(relative(projectRoot, configFilePath) || "aic.project.json"),
        fix_hint: "Add actionPolicies for risky or role-restricted actions.",
        message: "No explicit permission policies are configured in aic.project.json.",
        severity: "warning"
      })
    );
  }

  const manifestValidationResults = [
    ["discovery", validateDiscoveryManifest(artifacts.discovery)],
    ["ui", validateRuntimeUiManifest(artifacts.ui)],
    ["actions", validateSemanticActionsManifest(artifacts.actions)],
    ["permissions", validatePermissionsManifest(artifacts.permissions)],
    ["workflows", validateWorkflowManifest(artifacts.workflows)]
  ] as const;

  for (const [kind, result] of manifestValidationResults) {
    if (!result.ok) {
      const topIssue = result.issues[0];
      findings.push(
        createDoctorFinding({
          code: "invalid_generated_manifest",
          file: toPortablePath(relative(projectRoot, configFilePath) || "aic.project.json"),
          fix_hint: `Run \`aic generate project ${toPortablePath(relative(projectRoot, configFilePath) || "aic.project.json")} --out-dir .aic\` and inspect the ${kind} manifest issues.`,
          manifest_kind: kind,
          message: `${kind} manifest validation failed for generated artifacts.`,
          related_count: result.issues.length,
          top_issue: topIssue
            ? {
                message: topIssue.message,
                path: topIssue.path,
                rule: topIssue.rule
              }
            : undefined,
          severity: "error"
        })
      );
    }
  }

  return {
    artifact_type: "aic_doctor_report",
    config_file: toPortablePath(relative(projectRoot, configFilePath) || "aic.project.json"),
    detected_framework: packageDetectedFramework,
    findings,
    framework,
    onboarding,
    project_root: projectRoot,
    scan,
    summary: summarizeDoctorFindings(findings)
  };
}

interface ParsedJsxElementRecord {
  action?: string;
  agentContractRef?: string;
  agentDescription?: string;
  agentId?: string;
  attributes: Map<string, ts.JsxAttribute>;
  column: number;
  confirmation?: AICElementManifest["confirmation"];
  diagnostics: AICExtractionDiagnostic[];
  duplicateAicProps: string[];
  effects?: AICElementManifest["effects"];
  entity_ref?: AICElementManifest["entity_ref"];
  examples?: AICElementManifest["examples"];
  execution?: AICElementManifest["execution"];
  file: string;
  hasSpreadAttributes: boolean;
  label?: string;
  line: number;
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement;
  notes?: AICElementManifest["notes"];
  opening_tag_signature: string;
  permissions?: AICElementManifest["permissions"];
  recovery?: AICElementManifest["recovery"];
  requires_confirmation?: AICElementManifest["requires_confirmation"];
  risk?: string;
  role: AICRole;
  selectors: {
    testId?: string;
    text?: string;
  };
  sourceFile: ts.SourceFile;
  source_key: string;
  state?: AICElementManifest["state"];
  tagName: string;
  unsupportedAicProps: string[];
  validation?: AICElementManifest["validation"];
  workflow_ref?: AICElementManifest["workflow_ref"];
}

interface ParsedSourceAnalysis {
  diagnostics: AICExtractionDiagnostic[];
  matches: AICSourceScanMatch[];
  records: ParsedJsxElementRecord[];
  source_inventory: AICAuthoringSourceInventoryEntry[];
}

interface ApplyParsedFile {
  staticResolver: StaticValueResolverContext;
  records: ParsedJsxElementRecord[];
  source: string;
  sourceFile: ts.SourceFile;
}

type StaticValue =
  | {
      kind: "array";
      values: StaticValue[];
    }
  | {
      kind: "boolean";
      value: boolean;
    }
  | {
      kind: "number";
      value: number;
    }
  | {
      kind: "object";
      properties: Map<string, StaticValue>;
    }
  | {
      kind: "string";
      value: string;
    };

type StaticNamedDeclaration =
  | {
      expression: ts.Expression;
      kind: "value";
    }
  | {
      kind: "helper";
      node: ts.ArrowFunction | ts.FunctionDeclaration | ts.FunctionExpression;
    };

interface StaticValueResolverContext {
  declarations: Map<string, StaticNamedDeclaration>;
  importedNames: Set<string>;
  maxDepth: number;
  sourceFile: ts.SourceFile;
}

interface StaticResolutionError {
  code: AICExtractionDiagnostic["code"];
  message: string;
  node: ts.Node;
}

type StaticResolutionResult =
  | {
      ok: true;
      value: StaticValue;
    }
  | {
      error: StaticResolutionError;
      ok: false;
    };

type StaticStringResolutionResult =
  | {
      ok: true;
      value: string;
    }
  | {
      error: StaticResolutionError;
      ok: false;
    };

const IGNORED_DIRECTORIES = new Set([".git", ".next", "dist", "node_modules"]);
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const MUTABLE_STRING_AIC_PROP_NAMES = [
  "agentAction",
  "agentContractRef",
  "agentDescription",
  "agentEntityId",
  "agentEntityLabel",
  "agentEntityType",
  "agentId",
  "agentRisk",
  "agentRole",
  "agentWorkflowStep"
] as const;
const MUTABLE_BOOLEAN_AIC_PROP_NAMES = ["agentRequiresConfirmation"] as const;
const STATIC_AIC_PROP_NAMES = [
  "agentAliases",
  "agentConfirmation",
  "agentEffects",
  "agentExamples",
  "agentExecution",
  "agentNotes",
  "agentPermissions",
  "agentRecovery",
  "agentValidation",
  "state"
] as const;
const MUTABLE_AIC_PROP_NAMES = new Set<string>([
  ...MUTABLE_STRING_AIC_PROP_NAMES,
  ...MUTABLE_BOOLEAN_AIC_PROP_NAMES,
  ...STATIC_AIC_PROP_NAMES
]);

type MutableStringAicPropName = (typeof MUTABLE_STRING_AIC_PROP_NAMES)[number];
type MutableBooleanAicPropName = (typeof MUTABLE_BOOLEAN_AIC_PROP_NAMES)[number];
type StaticAicPropName = (typeof STATIC_AIC_PROP_NAMES)[number];
type MutableAicPropName = MutableBooleanAicPropName | MutableStringAicPropName | StaticAicPropName;
type DesiredMutableAicProps = Partial<Record<MutableAicPropName, string | boolean>>;

function isConstVariableDeclaration(node: ts.VariableDeclaration): boolean {
  return ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const) !== 0;
}

function getLineColumn(sourceFile: ts.SourceFile, node: ts.Node): { column: number; line: number } {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    column: position.character + 1,
    line: position.line + 1
  };
}

function createDiagnostic(
  sourceFile: ts.SourceFile,
  file: string,
  node: ts.Node,
  severity: AICAutomationSeverity,
  code: AICExtractionDiagnostic["code"],
  message: string,
  attribute?: string
): AICExtractionDiagnostic {
  const location = getLineColumn(sourceFile, node);
  return {
    attribute,
    code,
    column: location.column,
    file,
    line: location.line,
    message,
    severity
  };
}

function readLiteralString(node: ts.Expression | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  return undefined;
}

function isBooleanLiteralExpression(node: ts.Expression | undefined): node is ts.BooleanLiteral {
  if (!node) {
    return false;
  }

  return node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword;
}

function unwrapStaticExpression(expression: ts.Expression): ts.Expression {
  let current = expression;

  while (
    ts.isAsExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}

function createStaticResolutionError(
  code: AICExtractionDiagnostic["code"],
  node: ts.Node,
  message: string
): StaticResolutionResult {
  return {
    error: {
      code,
      message,
      node
    },
    ok: false
  };
}

function createStaticValueResolver(sourceFile: ts.SourceFile): StaticValueResolverContext {
  const declarations = new Map<string, StaticNamedDeclaration>();
  const importedNames = new Set<string>();
  const duplicates = new Set<string>();

  const unregister = (name: string) => {
    declarations.delete(name);
    importedNames.delete(name);
  };

  const registerDeclaration = (name: string, declaration: StaticNamedDeclaration) => {
    if (duplicates.has(name)) {
      return;
    }

    if (declarations.has(name) || importedNames.has(name)) {
      duplicates.add(name);
      unregister(name);
      return;
    }

    declarations.set(name, declaration);
  };

  const registerImport = (name: string) => {
    if (duplicates.has(name)) {
      return;
    }

    if (declarations.has(name) || importedNames.has(name)) {
      duplicates.add(name);
      unregister(name);
      return;
    }

    importedNames.add(name);
  };

  const visit = (node: ts.Node) => {
    if (ts.isImportClause(node) && node.name) {
      registerImport(node.name.text);
    }

    if (ts.isImportEqualsDeclaration(node)) {
      registerImport(node.name.text);
    }

    if (ts.isNamespaceImport(node) || ts.isImportSpecifier(node)) {
      registerImport(node.name.text);
    }

    if (ts.isFunctionDeclaration(node) && node.name) {
      registerDeclaration(node.name.text, {
        kind: "helper",
        node
      });
    }

    if (ts.isVariableDeclaration(node) && isConstVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const identifier = node.name.text;
      const initializer = node.initializer ? unwrapStaticExpression(node.initializer) : undefined;

      if (!initializer) {
        ts.forEachChild(node, visit);
        return;
      }

      if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
        registerDeclaration(identifier, {
          kind: "helper",
          node: initializer
        });
      } else {
        registerDeclaration(identifier, {
          expression: initializer,
          kind: "value"
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return {
    declarations,
    importedNames,
    maxDepth: 12,
    sourceFile
  };
}

function getObjectPropertyKey(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }

  return undefined;
}

function cloneStaticValue(value: StaticValue): StaticValue {
  switch (value.kind) {
    case "string":
    case "boolean":
    case "number":
      return value;
    case "array":
      return {
        kind: "array",
        values: value.values.map((entry) => cloneStaticValue(entry))
      };
    case "object":
      return {
        kind: "object",
        properties: new Map(
          Array.from(value.properties.entries()).map(([key, entry]) => [key, cloneStaticValue(entry)])
        )
      };
  }
}

function readStaticPrimitive(value: StaticValue): string | number | boolean | undefined {
  switch (value.kind) {
    case "string":
    case "boolean":
    case "number":
      return value.value;
    default:
      return undefined;
  }
}

function getHelperReturnExpression(
  helper: ts.ArrowFunction | ts.FunctionDeclaration | ts.FunctionExpression
): ts.Expression | undefined {
  if (helper.parameters.length !== 0) {
    return undefined;
  }

  if (ts.isArrowFunction(helper) && !ts.isBlock(helper.body)) {
    return unwrapStaticExpression(helper.body);
  }

  const body = helper.body;
  if (!body || !ts.isBlock(body) || body.statements.length !== 1) {
    return undefined;
  }

  const [statement] = body.statements;
  if (!ts.isReturnStatement(statement) || !statement.expression) {
    return undefined;
  }

  return unwrapStaticExpression(statement.expression);
}

function resolveStaticValue(
  expression: ts.Expression,
  resolver: StaticValueResolverContext,
  contextLabel: string,
  state: { depth: number; seen: Set<string> }
): StaticResolutionResult {
  const currentExpression = unwrapStaticExpression(expression);

  if (state.depth > resolver.maxDepth) {
    return createStaticResolutionError(
      "cyclic_static_reference",
      currentExpression,
      `${contextLabel} exceeded the same-file static resolution depth limit.`
    );
  }

  const literal = readLiteralString(currentExpression);
  if (literal !== undefined) {
    return {
      ok: true,
      value: {
        kind: "string",
        value: literal
      }
    };
  }

  if (isBooleanLiteralExpression(currentExpression)) {
    return {
      ok: true,
      value: {
        kind: "boolean",
        value: currentExpression.kind === ts.SyntaxKind.TrueKeyword
      }
    };
  }

  if (ts.isNumericLiteral(currentExpression)) {
    return {
      ok: true,
      value: {
        kind: "number",
        value: Number(currentExpression.text)
      }
    };
  }

  if (ts.isIdentifier(currentExpression)) {
    const identifier = currentExpression.text;

    if (resolver.importedNames.has(identifier)) {
      return createStaticResolutionError(
        "unsupported_import_reference",
        currentExpression,
        `${contextLabel} references imported symbol "${identifier}", which is outside same-file deterministic extraction.`
      );
    }

    const declaration = resolver.declarations.get(identifier);
    if (!declaration) {
      return createStaticResolutionError(
        "unresolved_identifier",
        currentExpression,
        `${contextLabel} references "${identifier}", which is not a same-file deterministic static value.`
      );
    }

    if (declaration.kind === "helper") {
      return createStaticResolutionError(
        "unsupported_call_expression",
        currentExpression,
        `${contextLabel} references helper "${identifier}" without invoking it. Use a same-file zero-arg helper call instead.`
      );
    }

    const seenKey = `value:${identifier}`;
    if (state.seen.has(seenKey)) {
      return createStaticResolutionError(
        "cyclic_static_reference",
        currentExpression,
        `${contextLabel} contains a cyclic same-file static reference through "${identifier}".`
      );
    }

    const nextSeen = new Set(state.seen);
    nextSeen.add(seenKey);
    return resolveStaticValue(declaration.expression, resolver, contextLabel, {
      depth: state.depth + 1,
      seen: nextSeen
    });
  }

  if (ts.isObjectLiteralExpression(currentExpression)) {
    const properties = new Map<string, StaticValue>();

    for (const property of currentExpression.properties) {
      if (ts.isSpreadAssignment(property)) {
        const resolvedSpread = resolveStaticValue(property.expression, resolver, contextLabel, state);
        if (!resolvedSpread.ok) {
          return resolvedSpread;
        }

        if (resolvedSpread.value.kind !== "object") {
          return createStaticResolutionError(
            "unsupported_member_expression",
            property.expression,
            `${contextLabel} spreads a non-object static value. Use same-file const object literals only.`
          );
        }

        resolvedSpread.value.properties.forEach((entry, key) => {
          properties.set(key, cloneStaticValue(entry));
        });
        continue;
      }

      if (!ts.isPropertyAssignment(property)) {
        return createStaticResolutionError(
          "unsupported_member_expression",
          property,
          `${contextLabel} uses an unsupported object literal member. Use plain same-file const object literals without spreads, methods, or shorthand.`
        );
      }

      const propertyName = getObjectPropertyKey(property.name);
      if (!propertyName) {
        return createStaticResolutionError(
          "unsupported_member_expression",
          property.name,
          `${contextLabel} uses an unsupported object literal key. Use identifier or string-literal keys only.`
        );
      }

      const resolvedProperty = resolveStaticValue(
        property.initializer,
        resolver,
        contextLabel,
        state
      );
      if (!resolvedProperty.ok) {
        return resolvedProperty;
      }

      properties.set(propertyName, resolvedProperty.value);
    }

    return {
      ok: true,
      value: {
        kind: "object",
        properties
      }
    };
  }

  if (ts.isArrayLiteralExpression(currentExpression)) {
    const values: StaticValue[] = [];

    for (const element of currentExpression.elements) {
      if (ts.isSpreadElement(element)) {
        const resolvedSpread = resolveStaticValue(element.expression, resolver, contextLabel, state);
        if (!resolvedSpread.ok) {
          return resolvedSpread;
        }

        if (resolvedSpread.value.kind !== "array") {
          return createStaticResolutionError(
            "unsupported_expression",
            element.expression,
            `${contextLabel} spreads a non-array static value. Use plain same-file array literals only.`
          );
        }

        values.push(...resolvedSpread.value.values.map((entry) => cloneStaticValue(entry)));
        continue;
      }

      const resolvedElement = resolveStaticValue(element, resolver, contextLabel, state);
      if (!resolvedElement.ok) {
        return resolvedElement;
      }

      values.push(resolvedElement.value);
    }

    return {
      ok: true,
      value: {
        kind: "array",
        values
      }
    };
  }

  if (ts.isPropertyAccessExpression(currentExpression) || ts.isElementAccessExpression(currentExpression)) {
    const objectExpression = currentExpression.expression;
    const resolvedObject = resolveStaticValue(objectExpression, resolver, contextLabel, state);

    if (!resolvedObject.ok) {
      return resolvedObject;
    }

    if (resolvedObject.value.kind !== "object") {
      return createStaticResolutionError(
        "unsupported_member_expression",
        currentExpression,
        `${contextLabel} uses a member expression on a non-object static value.`
      );
    }

    const propertyName = ts.isPropertyAccessExpression(currentExpression)
      ? currentExpression.name.text
      : readLiteralString(
          currentExpression.argumentExpression
            ? unwrapStaticExpression(currentExpression.argumentExpression)
            : undefined
        );

    if (!propertyName) {
      return createStaticResolutionError(
        "unsupported_member_expression",
        currentExpression,
        `${contextLabel} uses an unsupported member expression. Use plain property access or string-literal bracket access only.`
      );
    }

    const resolvedProperty = resolvedObject.value.properties.get(propertyName);
    if (!resolvedProperty) {
      return createStaticResolutionError(
        "unsupported_member_expression",
        currentExpression,
        `${contextLabel} references member "${propertyName}", which is not available on a same-file const object literal.`
      );
    }

    return {
      ok: true,
      value: resolvedProperty
    };
  }

  if (ts.isTemplateExpression(currentExpression)) {
    let text = currentExpression.head.text;

    for (const span of currentExpression.templateSpans) {
      const resolvedSpan = resolveStaticValue(span.expression, resolver, contextLabel, state);
      if (!resolvedSpan.ok) {
        return resolvedSpan;
      }

      const primitive = readStaticPrimitive(resolvedSpan.value);
      if (primitive === undefined) {
        return createStaticResolutionError(
          "unsupported_expression",
          span.expression,
          `${contextLabel} uses a template interpolation that does not resolve to a static primitive value.`
        );
      }

      text += String(primitive);
      text += span.literal.text;
    }

    return {
      ok: true,
      value: {
        kind: "string",
        value: text
      }
    };
  }

  if (ts.isBinaryExpression(currentExpression) && currentExpression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const resolvedLeft = resolveStaticValue(currentExpression.left, resolver, contextLabel, state);
    if (!resolvedLeft.ok) {
      return resolvedLeft;
    }

    const resolvedRight = resolveStaticValue(currentExpression.right, resolver, contextLabel, state);
    if (!resolvedRight.ok) {
      return resolvedRight;
    }

    const leftPrimitive = readStaticPrimitive(resolvedLeft.value);
    const rightPrimitive = readStaticPrimitive(resolvedRight.value);

    if (leftPrimitive === undefined || rightPrimitive === undefined) {
      return createStaticResolutionError(
        "unsupported_expression",
        currentExpression,
        `${contextLabel} uses "+" on non-primitive static values.`
      );
    }

    if (typeof leftPrimitive === "string" || typeof rightPrimitive === "string") {
      return {
        ok: true,
        value: {
          kind: "string",
          value: String(leftPrimitive) + String(rightPrimitive)
        }
      };
    }

    if (typeof leftPrimitive === "number" && typeof rightPrimitive === "number") {
      return {
        ok: true,
        value: {
          kind: "number",
          value: leftPrimitive + rightPrimitive
        }
      };
    }

    return createStaticResolutionError(
      "unsupported_expression",
      currentExpression,
      `${contextLabel} uses "+" with unsupported primitive types.`
    );
  }

  if (ts.isCallExpression(currentExpression)) {
    if (!ts.isIdentifier(currentExpression.expression)) {
      return createStaticResolutionError(
        "unsupported_call_expression",
        currentExpression,
        `${contextLabel} uses an unsupported helper call. Use a same-file zero-arg helper identifier.`
      );
    }

    const helperName = currentExpression.expression.text;
    if (resolver.importedNames.has(helperName)) {
      return createStaticResolutionError(
        "unsupported_import_reference",
        currentExpression.expression,
        `${contextLabel} references imported helper "${helperName}", which is outside same-file deterministic extraction.`
      );
    }

    if (currentExpression.arguments.length > 0) {
      return createStaticResolutionError(
        "unsupported_call_expression",
        currentExpression,
        `${contextLabel} uses helper "${helperName}" with arguments. Use a same-file zero-arg helper with a single static return expression.`
      );
    }

    const declaration = resolver.declarations.get(helperName);
    if (!declaration || declaration.kind !== "helper") {
      return createStaticResolutionError(
        "unsupported_call_expression",
        currentExpression,
        `${contextLabel} uses helper "${helperName}", which is not a supported same-file zero-arg helper.`
      );
    }

    const helperExpression = getHelperReturnExpression(declaration.node);
    if (!helperExpression) {
      return createStaticResolutionError(
        "unsupported_call_expression",
        currentExpression,
        `${contextLabel} uses helper "${helperName}", which must have a single static return expression and no parameters.`
      );
    }

    const seenKey = `helper:${helperName}`;
    if (state.seen.has(seenKey)) {
      return createStaticResolutionError(
        "cyclic_static_reference",
        currentExpression,
        `${contextLabel} contains a cyclic same-file static helper reference through "${helperName}".`
      );
    }

    const nextSeen = new Set(state.seen);
    nextSeen.add(seenKey);
    return resolveStaticValue(helperExpression, resolver, contextLabel, {
      depth: state.depth + 1,
      seen: nextSeen
    });
  }

  return createStaticResolutionError(
    "unsupported_expression",
    currentExpression,
    `${contextLabel} uses an unsupported dynamic expression. Use a string literal, template literal, or supported same-file deterministic expression.`
  );
}

function resolveStaticStringExpression(
  expression: ts.Expression,
  resolver: StaticValueResolverContext,
  contextLabel: string
): StaticStringResolutionResult {
  const resolved = resolveStaticValue(expression, resolver, contextLabel, {
    depth: 0,
    seen: new Set<string>()
  });

  if (!resolved.ok) {
    return {
      error: resolved.error,
      ok: false
    };
  }

  if (resolved.value.kind !== "string") {
    return {
      error: {
        code: "unsupported_expression",
        message: `${contextLabel} must resolve to a static string value.`,
        node: expression
      },
      ok: false
    };
  }

  return {
    ok: true,
    value: resolved.value.value
  };
}

function staticValueToRuntimeValue(value: StaticValue): unknown {
  switch (value.kind) {
    case "string":
    case "boolean":
    case "number":
      return value.value;
    case "array":
      return value.values.map((entry) => staticValueToRuntimeValue(entry));
    case "object":
      return Object.fromEntries(
        Array.from(value.properties.entries()).map(([key, entry]) => [key, staticValueToRuntimeValue(entry)])
      );
  }
}

function pushStaticResolutionDiagnostic(
  sourceFile: ts.SourceFile,
  file: string,
  diagnostics: AICExtractionDiagnostic[],
  result: StaticResolutionResult | StaticStringResolutionResult,
  attribute?: string
): void {
  if (result.ok) {
    return;
  }

  diagnostics.push(
    createDiagnostic(
      sourceFile,
      file,
      result.error.node,
      "warning",
      result.error.code,
      result.error.message,
      attribute
    )
  );
}

function readJsxAttributeValue(
  attribute: ts.JsxAttribute,
  sourceFile: ts.SourceFile,
  file: string,
  staticResolver: StaticValueResolverContext,
  diagnostics: AICExtractionDiagnostic[]
): string | undefined {
  const initializer = attribute.initializer;
  const attributeName = ts.isIdentifier(attribute.name) ? attribute.name.text : attribute.name.getText(sourceFile);

  if (!initializer) {
    diagnostics.push(
      createDiagnostic(
        sourceFile,
        file,
        attribute,
        "warning",
        "missing_value",
        `${attributeName} must use a string literal, template literal, or supported same-file deterministic expression.`,
        attributeName
      )
    );
    return undefined;
  }

  if (ts.isStringLiteral(initializer)) {
    return initializer.text;
  }

  if (!ts.isJsxExpression(initializer) || !initializer.expression) {
    diagnostics.push(
      createDiagnostic(
        sourceFile,
        file,
        attribute,
        "warning",
        "missing_value",
        `${attributeName} must evaluate to a static string value.`,
        attributeName
      )
    );
    return undefined;
  }

  const resolved = resolveStaticStringExpression(
    initializer.expression,
    staticResolver,
    attributeName
  );

  if (!resolved.ok) {
    pushStaticResolutionDiagnostic(sourceFile, file, diagnostics, resolved, attributeName);
    return undefined;
  }

  return resolved.value;
}

function readJsxBooleanAttributeValue(
  attribute: ts.JsxAttribute,
  sourceFile: ts.SourceFile,
  file: string,
  diagnostics: AICExtractionDiagnostic[]
): boolean | undefined {
  const initializer = attribute.initializer;
  const attributeName = ts.isIdentifier(attribute.name) ? attribute.name.text : attribute.name.getText(sourceFile);

  if (!initializer) {
    return true;
  }

  if (!ts.isJsxExpression(initializer) || !initializer.expression) {
    diagnostics.push(
      createDiagnostic(
        sourceFile,
        file,
        attribute,
        "warning",
        "missing_value",
        `${attributeName} must use a boolean literal or shorthand form.`,
        attributeName
      )
    );
    return undefined;
  }

  if (initializer.expression.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (initializer.expression.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  diagnostics.push(
    createDiagnostic(
      sourceFile,
      file,
      initializer.expression,
      "warning",
      "unsupported_expression",
      `${attributeName} uses an unsupported dynamic expression. Use a boolean literal or shorthand form.`,
      attributeName
    )
  );
  return undefined;
}

function readJsxAttributeName(attribute: ts.JsxAttribute): string {
  return ts.isIdentifier(attribute.name) ? attribute.name.text : attribute.name.getText();
}

function readElementLabel(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  file: string,
  attributeMap: Map<string, ts.JsxAttribute>,
  staticResolver: StaticValueResolverContext,
  diagnostics: AICExtractionDiagnostic[]
): string | undefined {
  const attributeLabel =
    attributeMap.get("agentLabel") ??
    attributeMap.get("aria-label") ??
    attributeMap.get("title") ??
    attributeMap.get("value") ??
    attributeMap.get("placeholder");

  if (attributeLabel) {
    return readJsxAttributeValue(attributeLabel, sourceFile, file, staticResolver, diagnostics)?.trim();
  }

  if (ts.isJsxSelfClosingElement(node)) {
    return undefined;
  }

  const parent = node.parent;
  if (!ts.isJsxElement(parent)) {
    return undefined;
  }

  const textParts: string[] = [];
  let hasDynamicContent = false;
  let firstDynamicError: StaticStringResolutionResult | undefined;

  parent.children.forEach((child) => {
    if (ts.isJsxText(child)) {
      const value = child.getText(sourceFile).replace(/\s+/g, " ").trim();
      if (value) {
        textParts.push(value);
      }
      return;
    }

    if (ts.isJsxExpression(child) && child.expression) {
      const resolved = resolveStaticStringExpression(
        child.expression,
        staticResolver,
        "Element label"
      );

      if (resolved.ok) {
        const value = resolved.value.replace(/\s+/g, " ").trim();
        if (value) {
          textParts.push(value);
        }
        return;
      }

      if (!firstDynamicError) {
        firstDynamicError = resolved;
      }

      const literal = readLiteralString(child.expression);
      if (literal !== undefined) {
        const value = literal.replace(/\s+/g, " ").trim();
        if (value) {
          textParts.push(value);
        }
        return;
      }
    }

    hasDynamicContent = true;
  });

  if (textParts.length > 0) {
    return textParts.join(" ").replace(/\s+/g, " ").trim();
  }

  if (hasDynamicContent) {
    if (firstDynamicError && !firstDynamicError.ok) {
      pushStaticResolutionDiagnostic(sourceFile, file, diagnostics, firstDynamicError);
    } else {
      diagnostics.push(
        createDiagnostic(
          sourceFile,
          file,
          node,
          "warning",
          "unsupported_expression",
          "Element label uses unsupported dynamic content. Use literal child text or a supported same-file deterministic string expression."
        )
      );
    }
  }

  return undefined;
}

function inferRoleFromTag(tagName: string): AICElementManifest["role"] {
  switch (tagName.toLowerCase()) {
    case "button":
      return "button";
    case "a":
      return "link";
    case "input":
      return "input";
    case "select":
      return "select";
    case "form":
      return "form";
    case "table":
      return "table";
    default:
      return "generic";
  }
}

function normalizeRole(value: string | undefined, tagName: string): AICRole {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "button":
    case "link":
    case "searchbox":
    case "input":
    case "textarea":
    case "select":
    case "option":
    case "checkbox":
    case "radio":
    case "switch":
    case "tab":
    case "tabpanel":
    case "menu":
    case "menuitem":
    case "dialog_trigger":
    case "dialog":
    case "form":
    case "upload":
    case "grid":
    case "row":
    case "cell":
    case "listbox":
    case "combobox":
    case "table":
    case "generic":
      return normalized;
    case "textbox":
      return "input";
    default:
      return inferRoleFromTag(tagName);
  }
}

function isSourceInventoryCandidate(tagName: string, explicitRole: string | undefined): boolean {
  const normalizedTag = tagName.toLowerCase();

  return (
    ["a", "button", "input", "select", "textarea"].includes(normalizedTag) ||
    typeof explicitRole === "string"
  );
}

function createSourceKey(file: string, line: number, column: number, tagName: string): string {
  return `${file}:${line}:${column}:${tagName}`;
}

function getOpeningTagSignature(
  source: string,
  sourceFile: ts.SourceFile,
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement
): string {
  return source
    .slice(node.getStart(sourceFile), node.end)
    .replace(/\s+/g, " ")
    .trim();
}

function buildAttributeInventory(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement
): {
  attributes: Map<string, ts.JsxAttribute>;
  duplicateAicProps: string[];
  hasSpreadAttributes: boolean;
} {
  const attributes = new Map<string, ts.JsxAttribute>();
  const duplicateAicProps = new Set<string>();
  let hasSpreadAttributes = false;

  node.attributes.properties.forEach((attribute) => {
    if (ts.isJsxSpreadAttribute(attribute)) {
      hasSpreadAttributes = true;
      return;
    }

    const attributeName = readJsxAttributeName(attribute);
    if (attributes.has(attributeName)) {
      if (attributeName.startsWith("agent")) {
        duplicateAicProps.add(attributeName);
      }
      return;
    }

    attributes.set(attributeName, attribute);
  });

  return {
    attributes,
    duplicateAicProps: Array.from(duplicateAicProps).sort(),
    hasSpreadAttributes
  };
}

function readJsxAttributeStaticValue(
  attribute: ts.JsxAttribute,
  sourceFile: ts.SourceFile,
  file: string,
  staticResolver: StaticValueResolverContext,
  diagnostics: AICExtractionDiagnostic[]
): unknown | undefined {
  if (!attribute.initializer) {
    return true;
  }

  if (ts.isStringLiteral(attribute.initializer)) {
    return attribute.initializer.text;
  }

  if (!ts.isJsxExpression(attribute.initializer) || !attribute.initializer.expression) {
    diagnostics.push(
      createDiagnostic(
        sourceFile,
        file,
        attribute,
        "warning",
        "unsupported_expression",
        `${readJsxAttributeName(attribute)} uses an unsupported expression. Use a same-file deterministic literal or object.`,
        readJsxAttributeName(attribute)
      )
    );
    return undefined;
  }

  const resolution = resolveStaticValue(
    attribute.initializer.expression,
    staticResolver,
    readJsxAttributeName(attribute),
    {
      depth: 0,
      seen: new Set<string>()
    }
  );

  if (!resolution.ok) {
    diagnostics.push(
      createDiagnostic(
        sourceFile,
        file,
        resolution.error.node,
        "warning",
        resolution.error.code,
        resolution.error.message,
        readJsxAttributeName(attribute)
      )
    );
    return undefined;
  }

  return staticValueToRuntimeValue(resolution.value);
}

function readMutableAicAttributeValue(
  attributeName: MutableAicPropName,
  attribute: ts.JsxAttribute,
  sourceFile: ts.SourceFile,
  file: string,
  staticResolver: StaticValueResolverContext,
  diagnostics: AICExtractionDiagnostic[]
): string | boolean | undefined {
  if (attributeName === "agentRequiresConfirmation") {
    return readJsxBooleanAttributeValue(attribute, sourceFile, file, diagnostics);
  }

  if ((STATIC_AIC_PROP_NAMES as readonly string[]).includes(attributeName)) {
    return readJsxAttributeStaticValue(attribute, sourceFile, file, staticResolver, diagnostics) as
      | string
      | boolean
      | undefined;
  }

  return readJsxAttributeValue(attribute, sourceFile, file, staticResolver, diagnostics);
}

function collectUnsupportedMutableAicProps(
  attributes: Map<string, ts.JsxAttribute>,
  sourceFile: ts.SourceFile,
  file: string,
  staticResolver: StaticValueResolverContext
): string[] {
  const unsupported = new Set<string>();

  MUTABLE_AIC_PROP_NAMES.forEach((attributeName) => {
    const attribute = attributes.get(attributeName);

    if (!attribute) {
      return;
    }

    const diagnostics: AICExtractionDiagnostic[] = [];
    const value = readMutableAicAttributeValue(
      attributeName as MutableAicPropName,
      attribute,
      sourceFile,
      file,
      staticResolver,
      diagnostics
    );

    if (value === undefined) {
      unsupported.add(attributeName);
    }
  });

  return Array.from(unsupported).sort();
}

function normalizeRisk(risk: string | undefined): AICElementManifest["risk"] {
  return risk === "low" || risk === "medium" || risk === "high" || risk === "critical"
    ? risk
    : "medium";
}

function humanizeAgentId(agentId: string): string {
  return agentId.split(".").at(-1)?.replaceAll("_", " ") ?? agentId;
}

function createElements(records: ParsedJsxElementRecord[]): AICElementManifest[] {
  return records
    .filter((record): record is ParsedJsxElementRecord & { agentId: string } => Boolean(record.agentId))
    .map((record) => ({
      id: record.agentId,
      label: record.agentDescription ?? humanizeAgentId(record.agentId),
      description: record.agentDescription,
      role: record.role,
      actions: [
        {
          name: record.action ?? "click",
          contract_ref: record.agentContractRef,
          target: record.agentId,
          type: record.agentContractRef ? "semantic_action" : "element_action"
        }
      ],
      confirmation: record.confirmation,
      effects: record.effects,
      entity_ref: record.entity_ref,
      examples: record.examples,
      execution: record.execution,
      notes: [...(record.notes ?? []), `Extracted from ${record.file}:${record.line}`],
      permissions: record.permissions,
      recovery: record.recovery,
      requires_confirmation: record.requires_confirmation,
      risk: normalizeRisk(record.risk),
      state: record.state ?? {
        visible: true
      },
      validation: record.validation,
      workflow_ref: record.workflow_ref
    }));
}

function createActionContracts(matches: AICSourceScanMatch[]): AICActionContract[] {
  return matches.map((match) => ({
    name: match.agentContractRef ?? match.agentId,
    title: match.agentDescription ?? match.agentId,
    target: match.agentId,
    preconditions: [],
    postconditions: [],
    side_effects: [],
    idempotent: false,
    undoable: false,
    estimated_latency_ms: 0,
    execution_readiness: {
      blockers: [
        "Author and review preconditions, postconditions, side effects, completion signals, and failure modes before executable exposure."
      ],
      source: "inferred",
      status: "review_required"
    },
    completion_signal: {
      type: "custom",
      value: "review_required"
    },
    failure_modes: ["review_required"]
  }));
}

function toPortablePath(pathValue: string): string {
  return pathValue.replaceAll("\\", "/");
}

export async function collectSourceFiles(rootDir: string): Promise<string[]> {
  const fullPath = resolve(rootDir);
  const targetStat = await stat(fullPath);

  if (targetStat.isFile()) {
    return SOURCE_EXTENSIONS.has(extname(fullPath)) ? [fullPath] : [];
  }

  const entries = await readdir(fullPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = `${fullPath}/${entry.name}`;

      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) {
          return [];
        }

        return collectSourceFiles(entryPath);
      }

      return SOURCE_EXTENSIONS.has(extname(entryPath)) ? [entryPath] : [];
    })
  );

  return files.flat().sort();
}

function parseSourceAnalysis(source: string, file: string): ParsedSourceAnalysis {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const staticResolver = createStaticValueResolver(sourceFile);
  const diagnostics: AICExtractionDiagnostic[] = [];
  const records: ParsedJsxElementRecord[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const attributeInventory = buildAttributeInventory(node);
      const attributeMap = attributeInventory.attributes;
      const explicitRoleAttribute =
        (attributeMap.get("agentRole") as ts.JsxAttribute | undefined) ??
        (attributeMap.get("role") as ts.JsxAttribute | undefined);
      const explicitRole = explicitRoleAttribute
        ? readJsxAttributeValue(explicitRoleAttribute, sourceFile, file, staticResolver, diagnostics)
        : undefined;
      const tagName = node.tagName.getText(sourceFile);
      const role = normalizeRole(explicitRole, tagName);
      const location = getLineColumn(sourceFile, node);
      const opening_tag_signature = getOpeningTagSignature(source, sourceFile, node);
      const agentIdAttribute = attributeMap.get("agentId");
      const shouldInspectLabel = Boolean(agentIdAttribute) || isSourceInventoryCandidate(tagName, explicitRole);
      const label = shouldInspectLabel
        ? readElementLabel(node, sourceFile, file, attributeMap, staticResolver, diagnostics)
        : undefined;
      const source_key = createSourceKey(file, location.line, location.column, tagName);
      const agentId = agentIdAttribute
        ? readJsxAttributeValue(agentIdAttribute, sourceFile, file, staticResolver, diagnostics)
        : undefined;
      const action = attributeMap.get("agentAction")
        ? readJsxAttributeValue(attributeMap.get("agentAction") as ts.JsxAttribute, sourceFile, file, staticResolver, diagnostics)
        : undefined;
      const agentContractRef = attributeMap.get("agentContractRef")
        ? readJsxAttributeValue(
            attributeMap.get("agentContractRef") as ts.JsxAttribute,
            sourceFile,
            file,
            staticResolver,
            diagnostics
          )
        : undefined;
      const agentDescription = attributeMap.get("agentDescription")
        ? readJsxAttributeValue(
            attributeMap.get("agentDescription") as ts.JsxAttribute,
            sourceFile,
            file,
            staticResolver,
            diagnostics
          )
        : undefined;
      const risk = attributeMap.get("agentRisk")
        ? readJsxAttributeValue(attributeMap.get("agentRisk") as ts.JsxAttribute, sourceFile, file, staticResolver, diagnostics)
        : undefined;
      const unsupportedAicProps = collectUnsupportedMutableAicProps(
        attributeMap,
        sourceFile,
        file,
        staticResolver
      );
      const selectors = {
        testId:
          (attributeMap.get("data-testid") &&
            readJsxAttributeValue(
              attributeMap.get("data-testid") as ts.JsxAttribute,
              sourceFile,
              file,
              staticResolver,
              diagnostics
            )) ||
          (attributeMap.get("data-test-id") &&
            readJsxAttributeValue(
              attributeMap.get("data-test-id") as ts.JsxAttribute,
              sourceFile,
              file,
              staticResolver,
              diagnostics
            )) ||
          undefined,
        text: label
      };
      const confirmation = attributeMap.get("agentConfirmation")
        ? (readJsxAttributeStaticValue(
            attributeMap.get("agentConfirmation") as ts.JsxAttribute,
            sourceFile,
            file,
            staticResolver,
            diagnostics
          ) as AICElementManifest["confirmation"])
        : undefined;
      const effects = attributeMap.get("agentEffects")
        ? (readJsxAttributeStaticValue(
            attributeMap.get("agentEffects") as ts.JsxAttribute,
            sourceFile,
            file,
            staticResolver,
            diagnostics
          ) as AICElementManifest["effects"])
        : undefined;
      const examples = attributeMap.get("agentExamples")
        ? (readJsxAttributeStaticValue(
            attributeMap.get("agentExamples") as ts.JsxAttribute,
            sourceFile,
            file,
            staticResolver,
            diagnostics
          ) as AICElementManifest["examples"])
        : undefined;
      const execution = attributeMap.get("agentExecution")
        ? (readJsxAttributeStaticValue(
            attributeMap.get("agentExecution") as ts.JsxAttribute,
            sourceFile,
            file,
            staticResolver,
            diagnostics
          ) as AICElementManifest["execution"])
        : undefined;
      const notes = attributeMap.get("agentNotes")
        ? (readJsxAttributeStaticValue(
            attributeMap.get("agentNotes") as ts.JsxAttribute,
            sourceFile,
            file,
            staticResolver,
            diagnostics
          ) as AICElementManifest["notes"])
        : undefined;
      const permissions = attributeMap.get("agentPermissions")
        ? (readJsxAttributeStaticValue(
            attributeMap.get("agentPermissions") as ts.JsxAttribute,
            sourceFile,
            file,
            staticResolver,
            diagnostics
          ) as AICElementManifest["permissions"])
        : undefined;
      const recovery = attributeMap.get("agentRecovery")
        ? (readJsxAttributeStaticValue(
            attributeMap.get("agentRecovery") as ts.JsxAttribute,
            sourceFile,
            file,
            staticResolver,
            diagnostics
          ) as AICElementManifest["recovery"])
        : undefined;
      const requires_confirmation = attributeMap.get("agentRequiresConfirmation")
        ? (readJsxAttributeStaticValue(
            attributeMap.get("agentRequiresConfirmation") as ts.JsxAttribute,
            sourceFile,
            file,
            staticResolver,
            diagnostics
          ) as boolean | undefined)
        : undefined;
      const state = attributeMap.get("state")
        ? (readJsxAttributeStaticValue(
            attributeMap.get("state") as ts.JsxAttribute,
            sourceFile,
            file,
            staticResolver,
            diagnostics
          ) as AICElementManifest["state"])
        : undefined;
      const validation = attributeMap.get("agentValidation")
        ? (readJsxAttributeStaticValue(
            attributeMap.get("agentValidation") as ts.JsxAttribute,
            sourceFile,
            file,
            staticResolver,
            diagnostics
          ) as AICElementManifest["validation"])
        : undefined;
      const workflow_ref = attributeMap.get("agentWorkflowStep")
        ? readJsxAttributeValue(
            attributeMap.get("agentWorkflowStep") as ts.JsxAttribute,
            sourceFile,
            file,
            staticResolver,
            diagnostics
          )
        : undefined;
      const entityId = attributeMap.get("agentEntityId")
        ? readJsxAttributeValue(
            attributeMap.get("agentEntityId") as ts.JsxAttribute,
            sourceFile,
            file,
            staticResolver,
            diagnostics
          )
        : undefined;
      const entityType = attributeMap.get("agentEntityType")
        ? readJsxAttributeValue(
            attributeMap.get("agentEntityType") as ts.JsxAttribute,
            sourceFile,
            file,
            staticResolver,
            diagnostics
          )
        : undefined;
      const entityLabel = attributeMap.get("agentEntityLabel")
        ? readJsxAttributeValue(
            attributeMap.get("agentEntityLabel") as ts.JsxAttribute,
            sourceFile,
            file,
            staticResolver,
            diagnostics
          )
        : undefined;
      const entity_ref =
        entityId && entityType
          ? {
              entity_id: entityId,
              entity_label: entityLabel,
              entity_type: entityType
            }
          : undefined;

      if (agentId || (label && isSourceInventoryCandidate(tagName, explicitRole))) {
        records.push({
          action,
          agentContractRef,
          agentDescription,
          agentId,
          attributes: attributeMap,
          column: location.column,
          confirmation,
          diagnostics,
          duplicateAicProps: attributeInventory.duplicateAicProps,
          effects,
          entity_ref,
          examples,
          execution,
          file,
          hasSpreadAttributes: attributeInventory.hasSpreadAttributes,
          label,
          line: location.line,
          node,
          notes,
          opening_tag_signature,
          permissions,
          recovery,
          requires_confirmation,
          risk,
          role,
          selectors,
          sourceFile,
          source_key,
          state,
          tagName,
          unsupportedAicProps,
          validation,
          workflow_ref
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return {
    diagnostics,
    matches: records
      .filter((record) => record.agentId)
      .map((record) => ({
        action: record.action,
        ...(record.agentContractRef ? { agentContractRef: record.agentContractRef } : {}),
        agentDescription: record.agentDescription,
        agentId: record.agentId as string,
        column: record.column,
        file: record.file,
        line: record.line,
        role: record.role,
        risk: record.risk,
        source_key: record.source_key,
        tagName: record.tagName
      })),
    records,
    source_inventory: records.map((record) => ({
      annotated_agent_id: record.agentId,
      column: record.column,
      duplicate_aic_props: record.duplicateAicProps.length > 0 ? record.duplicateAicProps : undefined,
      file: record.file,
      has_spread_attributes: record.hasSpreadAttributes || undefined,
      label: record.label ?? record.agentDescription ?? humanizeAgentId(record.agentId ?? record.source_key),
      line: record.line,
      opening_tag_signature: record.opening_tag_signature,
      role: record.role,
      selectors: record.selectors,
      source_key: record.source_key,
      tagName: record.tagName,
      unsupported_aic_props: record.unsupportedAicProps.length > 0 ? record.unsupportedAicProps : undefined
    }))
  };
}

function parseSourceFileForApply(source: string, file: string): ApplyParsedFile {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const staticResolver = createStaticValueResolver(sourceFile);
  const diagnostics: AICExtractionDiagnostic[] = [];
  const records: ParsedJsxElementRecord[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const attributeInventory = buildAttributeInventory(node);
      const attributeMap = attributeInventory.attributes;
      const tagName = node.tagName.getText(sourceFile);
      const explicitRoleAttribute =
        (attributeMap.get("agentRole") as ts.JsxAttribute | undefined) ??
        (attributeMap.get("role") as ts.JsxAttribute | undefined);
      const explicitRole = explicitRoleAttribute
        ? readJsxAttributeValue(explicitRoleAttribute, sourceFile, file, staticResolver, diagnostics)
        : undefined;
      const location = getLineColumn(sourceFile, node);
      const shouldInspectLabel =
        Boolean(attributeMap.get("agentId")) || isSourceInventoryCandidate(tagName, explicitRole);
      const label = shouldInspectLabel
        ? readElementLabel(node, sourceFile, file, attributeMap, staticResolver, diagnostics)
        : undefined;
      const opening_tag_signature = getOpeningTagSignature(source, sourceFile, node);
      const unsupportedAicProps = collectUnsupportedMutableAicProps(
        attributeMap,
        sourceFile,
        file,
        staticResolver
      );

      records.push({
        action: attributeMap.get("agentAction")
          ? readJsxAttributeValue(attributeMap.get("agentAction") as ts.JsxAttribute, sourceFile, file, staticResolver, diagnostics)
          : undefined,
        agentDescription: attributeMap.get("agentDescription")
          ? readJsxAttributeValue(
              attributeMap.get("agentDescription") as ts.JsxAttribute,
              sourceFile,
              file,
              staticResolver,
              diagnostics
            )
          : undefined,
        agentId: attributeMap.get("agentId")
          ? readJsxAttributeValue(attributeMap.get("agentId") as ts.JsxAttribute, sourceFile, file, staticResolver, diagnostics)
          : undefined,
        attributes: attributeMap,
        column: location.column,
        diagnostics,
        duplicateAicProps: attributeInventory.duplicateAicProps,
        file,
        hasSpreadAttributes: attributeInventory.hasSpreadAttributes,
        label,
        line: location.line,
        node,
        opening_tag_signature,
        risk: attributeMap.get("agentRisk")
          ? readJsxAttributeValue(attributeMap.get("agentRisk") as ts.JsxAttribute, sourceFile, file, staticResolver, diagnostics)
          : undefined,
        role: normalizeRole(explicitRole, tagName),
        selectors: {
          testId:
            (attributeMap.get("data-testid") &&
              readJsxAttributeValue(
                attributeMap.get("data-testid") as ts.JsxAttribute,
                sourceFile,
                file,
                staticResolver,
                diagnostics
              )) ||
            (attributeMap.get("data-test-id") &&
              readJsxAttributeValue(
                attributeMap.get("data-test-id") as ts.JsxAttribute,
                sourceFile,
                file,
                staticResolver,
                diagnostics
              )) ||
            undefined,
          text: label
        },
        sourceFile,
        source_key: createSourceKey(file, location.line, location.column, tagName),
        tagName,
        unsupportedAicProps
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return {
    staticResolver,
    records,
    source,
    sourceFile
  };
}

export function scanSourceForAICAnnotations(source: string, file = "<memory>"): AICFileScanResult {
  const parsed = parseSourceAnalysis(source, file);
  return {
    diagnostics: parsed.diagnostics,
    file,
    matches: parsed.matches,
    records: parsed.records,
    source_inventory: parsed.source_inventory
  };
}

export async function analyzeProjectForAICAnnotations(projectRoot: string): Promise<AICProjectScanResult> {
  const resolvedRoot = resolve(projectRoot);
  const files = await collectSourceFiles(resolvedRoot);
  const fileResults = await Promise.all(
    files.map(async (file) => {
      const displayFile = toPortablePath(relative(resolvedRoot, file) || file);
      return scanSourceForAICAnnotations(await readFile(file, "utf8"), displayFile);
    })
  );

  return {
    diagnostics: fileResults.flatMap((result) => result.diagnostics),
    files: fileResults.map((result) => result.file),
    matches: fileResults.flatMap((result) => result.matches),
    records: fileResults.flatMap((result) => result.records ?? []),
    source_inventory: fileResults.flatMap((result) => result.source_inventory)
  };
}

interface AICWebMCPFileScanResult {
  currentNativeRegistrations: number;
  declarativeTools: number;
  directNativeRegistrations: number;
  findings: AICWebMCPSourceFinding[];
  governedRegistrations: number;
  obsoleteApiUsages: number;
}

function sourceLocation(
  sourceFile: ts.SourceFile,
  node: ts.Node
): { column: number; line: number } {
  const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    column: location.character + 1,
    line: location.line + 1
  };
}

function createWebMCPSourceFinding(
  sourceFile: ts.SourceFile,
  file: string,
  node: ts.Node,
  finding: Omit<AICWebMCPSourceFinding, "column" | "file" | "line">
): AICWebMCPSourceFinding {
  return {
    ...finding,
    ...sourceLocation(sourceFile, node),
    file
  };
}

function scanSourceForWebMCP(source: string, file: string): AICWebMCPFileScanResult {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const governedFunctionNames = new Set<string>();
  const governedNamespaceNames = new Set<string>();
  const findings: AICWebMCPSourceFinding[] = [];
  let currentNativeRegistrations = 0;
  let declarativeTools = 0;
  let directNativeRegistrations = 0;
  let governedRegistrations = 0;
  let obsoleteApiUsages = 0;

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }

    if (
      statement.moduleSpecifier.text !== "@aicorg/webmcp" &&
      statement.moduleSpecifier.text !== "@aicorg/webmcp/react"
    ) {
      continue;
    }

    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      governedNamespaceNames.add(bindings.name.text);
    }

    if (bindings && ts.isNamedImports(bindings)) {
      for (const specifier of bindings.elements) {
        if (
          ["registerAICWebMCPTool", "useAICWebMCPTool"].includes(
            specifier.propertyName?.text ?? specifier.name.text
          )
        ) {
          governedFunctionNames.add(specifier.name.text);
        }
      }
    }
  }

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callPath = node.expression
        .getText(sourceFile)
        .replaceAll("?.", ".")
        .replace(/\s+/g, "");
      const governedDirect = ts.isIdentifier(node.expression) && governedFunctionNames.has(node.expression.text);
      const governedNamespaced = Array.from(governedNamespaceNames).some(
        (namespaceName) =>
          callPath === `${namespaceName}.registerAICWebMCPTool` ||
          callPath === `${namespaceName}.useAICWebMCPTool`
      );

      if (governedDirect || governedNamespaced) {
        governedRegistrations += 1;
      } else if (callPath === "document.modelContext.registerTool") {
        currentNativeRegistrations += 1;
        directNativeRegistrations += 1;
        findings.push(
          createWebMCPSourceFinding(sourceFile, file, node, {
            code: "direct_native_registration",
            fix_hint:
              "Wrap the tool with registerAICWebMCPTool and bind it to an authored, execution-ready AIC action contract.",
            message:
              "Native WebMCP registration is current, but it bypasses AIC risk, confirmation, entity, verification, and recovery guards.",
            severity: "warning"
          })
        );
      } else if (
        callPath === "navigator.modelContext.registerTool" ||
        callPath === "navigator.modelContext.provideContext" ||
        callPath === "document.modelContext.provideContext" ||
        callPath.endsWith(".provideContext")
      ) {
        obsoleteApiUsages += 1;
        findings.push(
          createWebMCPSourceFinding(sourceFile, file, node, {
            code: "obsolete_webmcp_api",
            fix_hint:
              "Migrate to document.modelContext.registerTool or the AIC registerAICWebMCPTool adapter.",
            message: `Obsolete or non-current WebMCP API usage detected: ${callPath}.`,
            severity: "error"
          })
        );
      }
    }

    if (ts.isJsxAttribute(node)) {
      const attributeName = node.name.getText(sourceFile);
      if (attributeName === "toolname" || attributeName === "webMCPToolName") {
        declarativeTools += 1;
      }

      if (attributeName === "toolautosubmit" || attributeName === "webMCPToolAutoSubmit") {
        findings.push(
          createWebMCPSourceFinding(sourceFile, file, node, {
            code: "declarative_autosubmit_requires_review",
            fix_hint:
              "Keep auto-submit limited to low-risk, non-confirmed forms and verify the emitted runtime attributes.",
            message: "Declarative WebMCP auto-submit requires an explicit AIC risk review.",
            severity: "warning"
          })
        );
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return {
    currentNativeRegistrations,
    declarativeTools,
    directNativeRegistrations,
    findings,
    governedRegistrations,
    obsoleteApiUsages
  };
}

function createWebMCPNextActions(
  findings: AICWebMCPSourceFinding[],
  governedRegistrations: number
): string[] {
  const actions: string[] = [];

  if (findings.some((finding) => finding.code === "obsolete_webmcp_api")) {
    actions.push(
      "Replace obsolete WebMCP APIs with the current document.modelContext contract before browser testing."
    );
  }

  if (findings.some((finding) => finding.code === "direct_native_registration")) {
    actions.push(
      "Bind direct WebMCP tools to authored AIC action contracts through @aicorg/webmcp."
    );
  }

  if (findings.some((finding) => finding.code === "declarative_autosubmit_requires_review")) {
    actions.push(
      "Review declarative auto-submit forms and remove auto-submit from any action above low risk."
    );
  }

  if (governedRegistrations === 0) {
    actions.push(
      "Select one task-level tool and implement an explicit AIC-governed WebMCP binding as the pilot."
    );
  }

  actions.push(
    "Run browser tests with WebMCP enabled and verify that unsupported browsers degrade without changing the human flow."
  );
  return actions.slice(0, 5);
}

export async function analyzeProjectForWebMCPReadiness(
  targetPath: string,
  generatedAt = new Date().toISOString()
): Promise<AICWebMCPSourceReadinessReport> {
  const resolvedTarget = resolve(targetPath);
  const targetStats = await stat(resolvedTarget);
  const displayRoot = targetStats.isDirectory() ? resolvedTarget : dirname(resolvedTarget);
  const files = await collectSourceFiles(resolvedTarget);
  const results = await Promise.all(
    files.map(async (file) => {
      const displayFile = toPortablePath(relative(displayRoot, file) || basename(file));
      return {
        file: displayFile,
        result: scanSourceForWebMCP(await readFile(file, "utf8"), displayFile)
      };
    })
  );
  const findings = results.flatMap(({ result }) => result.findings);
  const currentNativeRegistrations = results.reduce(
    (total, { result }) => total + result.currentNativeRegistrations,
    0
  );
  const declarativeTools = results.reduce(
    (total, { result }) => total + result.declarativeTools,
    0
  );
  const directNativeRegistrations = results.reduce(
    (total, { result }) => total + result.directNativeRegistrations,
    0
  );
  const governedRegistrations = results.reduce(
    (total, { result }) => total + result.governedRegistrations,
    0
  );
  const obsoleteApiUsages = results.reduce(
    (total, { result }) => total + result.obsoleteApiUsages,
    0
  );
  const detected = governedRegistrations + currentNativeRegistrations + declarativeTools > 0;
  let status: AICWebMCPSourceReadinessReport["status"];

  if (obsoleteApiUsages > 0) {
    status = "blocked";
  } else if (!detected) {
    status = "not_detected";
    findings.push({
      code: "webmcp_not_detected",
      fix_hint:
        "Start with one explicit, task-level @aicorg/webmcp binding instead of converting every UI control.",
      message: "No current WebMCP integration was detected.",
      severity: "info"
    });
  } else if (findings.some((finding) => finding.severity === "warning")) {
    status = "review_needed";
  } else {
    status = "ready";
  }

  return {
    artifact_type: "aic_webmcp_readiness_report",
    baseline: {
      api: "document.modelContext",
      draft: "2026-08-26",
      types: "0.1.5"
    },
    files: results.map(({ file }) => file),
    findings,
    generated_at: generatedAt,
    next_actions: createWebMCPNextActions(findings, governedRegistrations),
    status,
    summary: {
      current_native_registrations: currentNativeRegistrations,
      declarative_tools: declarativeTools,
      direct_native_registrations: directNativeRegistrations,
      files_scanned: files.length,
      governed_registrations: governedRegistrations,
      obsolete_api_usages: obsoleteApiUsages
    }
  };
}

export function createWebMCPImplementationPlan(
  report: AICWebMCPSourceReadinessReport,
  generatedAt = new Date().toISOString()
): AICWebMCPImplementationPlan {
  const workstreams: AICWebMCPImplementationPlan["workstreams"] = [];

  if (report.summary.obsolete_api_usages > 0) {
    workstreams.push({
      actions: [
        "Replace navigator.modelContext and provideContext usage.",
        "Pin implementation checks to document.modelContext and the recorded draft baseline."
      ],
      id: "migrate-current-api",
      priority: "now",
      title: "Migrate obsolete WebMCP APIs"
    });
  }

  if (report.summary.direct_native_registrations > 0) {
    workstreams.push({
      actions: [
        "Create authored execution-ready AIC action contracts for each task-level tool.",
        "Replace direct registerTool calls with registerAICWebMCPTool."
      ],
      id: "add-aic-governance",
      priority: "now",
      title: "Add AIC governance to native tools"
    });
  }

  if (report.summary.governed_registrations === 0) {
    workstreams.push({
      actions: [
        "Choose one high-value task rather than exposing individual UI controls.",
        "Author input validation, authorization, confirmation, execution, verification, and recovery behavior."
      ],
      id: "pilot-tool",
      priority: "now",
      title: "Implement the first governed WebMCP tool"
    });
  }

  if (report.summary.declarative_tools > 0) {
    workstreams.push({
      actions: [
        "Review form risk and confirmation semantics.",
        "Use AIC declarative props and allow toolautosubmit only for low-risk non-confirmed flows."
      ],
      id: "review-declarative-forms",
      priority: "next",
      title: "Harden declarative WebMCP forms"
    });
  }

  workstreams.push({
    actions: [
      "Test current Chromium support and the unsupported-browser path.",
      "Verify identical domain behavior for human and WebMCP execution.",
      "Re-run aic doctor --webmcp when the draft or webmcp-types baseline changes."
    ],
    id: "verify-and-maintain",
    priority: "next",
    title: "Verify browser behavior and draft compatibility"
  });

  return {
    acceptance_criteria: [
      "No obsolete WebMCP API usage remains.",
      "Every mutating tool is backed by an authored execution-ready AIC action contract.",
      "Critical tools enforce authorization, entity scope, structured confirmation, and post-execution verification.",
      "Unsupported browsers preserve the human workflow without errors.",
      "Browser tests cover success, denial, cancellation, verification failure, and lifecycle disposal."
    ],
    artifact_type: "aic_webmcp_implementation_plan",
    baseline: report.baseline,
    generated_at: generatedAt,
    source_status: report.status,
    workstreams
  };
}

export async function generateProjectArtifacts(
  options: AICProjectArtifactsOptions
): Promise<AICProjectArtifacts> {
  const registry = new AICRegistry();
  const scanResult = options.projectRoot
    ? await analyzeProjectForAICAnnotations(options.projectRoot)
    : { diagnostics: [], files: [], matches: [], records: [], source_inventory: [] };
  const timestamp = options.generatedAt ?? new Date().toISOString();
  const updatedAt = options.updatedAt ?? timestamp;
  const discovery = registry.createDiscoveryManifest({
    appName: options.appName,
    appVersion: options.appVersion,
    framework: options.framework,
    generated_at: timestamp,
    notes: options.notes
  });
  const permissions = registry.createPermissionsManifest(options.permissions);
  permissions.generated_at = timestamp;
  const workflows = registry.serializeWorkflows(options.workflows ?? []);
  workflows.generated_at = timestamp;
  const operate = registry.renderOperateText({
    appName: options.appName,
    endpoints: discovery.endpoints,
    notes: options.operateNotes ?? options.notes
  });
  const ui: AICRuntimeUiManifest = {
    spec: discovery.spec,
    manifest_version: discovery.manifest_version,
    updated_at: updatedAt,
    page: {
      url: options.viewUrl ?? "http://localhost:3000"
    },
    view: {
      view_id: options.viewId ?? `${options.framework}.root`
    },
    elements: createElements(scanResult.records ?? [])
  };
  const actions: AICSemanticActionsManifest = {
    spec: discovery.spec,
    manifest_version: discovery.manifest_version,
    generated_at: timestamp,
    actions: createActionContracts(scanResult.matches)
  };

  return {
    actions,
    diagnostics: scanResult.diagnostics,
    discovery,
    files: {
      "/.well-known/agent.json": JSON.stringify(discovery, null, 2),
      "/.well-known/agent/ui": `${JSON.stringify(ui, null, 2)}\n`,
      "/.well-known/agent/actions": `${JSON.stringify(actions, null, 2)}\n`,
      "/agent-permissions.json": JSON.stringify(permissions, null, 2),
      "/agent-workflows.json": JSON.stringify(workflows, null, 2),
      "/operate.txt": operate
    },
    matches: scanResult.matches,
    operate,
    permissions,
    scan: {
      filesScanned: scanResult.files.length
    },
    source_inventory: scanResult.source_inventory,
    ui,
    workflows
  };
}

export async function writeArtifactFiles(
  outDir: string,
  files: Record<string, string>
): Promise<void> {
  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const filePath = resolve(outDir, relativePath.replace(/^\/+/, ""));
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, contents, "utf8");
    })
  );
}

export function createProjectArtifactReport(
  framework: string,
  artifacts: Pick<
    AICProjectArtifacts,
    "actions" | "diagnostics" | "discovery" | "matches" | "permissions" | "scan" | "source_inventory" | "ui" | "workflows"
  >,
  options: {
    projectRoot?: string;
  } = {}
): AICProjectArtifactReport {
  type GeneratedManifestFinding = NonNullable<AICProjectArtifactReport["generated_manifests"]>["findings"][number];

  const generatedManifestFindings: GeneratedManifestFinding[] = [];
  const manifestValidationResults: Array<{
    manifest_kind: GeneratedManifestFinding["manifest_kind"];
    result: {
      issues: AICValidationIssue[];
      ok: boolean;
    };
  }> = [
    { manifest_kind: "discovery", result: validateDiscoveryManifest(artifacts.discovery) },
    { manifest_kind: "ui", result: validateRuntimeUiManifest(artifacts.ui) },
    { manifest_kind: "actions", result: validateSemanticActionsManifest(artifacts.actions) },
    { manifest_kind: "permissions", result: validatePermissionsManifest(artifacts.permissions) },
    { manifest_kind: "workflows", result: validateWorkflowManifest(artifacts.workflows) }
  ];

  for (const { manifest_kind, result } of manifestValidationResults) {
    if (!result.ok) {
      const topIssue = result.issues[0];
      generatedManifestFindings.push({
        issue_count: result.issues.length,
        manifest_kind,
        top_issue: topIssue
          ? {
              message: topIssue.message,
              path: topIssue.path,
              rule: topIssue.rule
            }
          : undefined
      });
    }
  }

  generatedManifestFindings.sort(
    (left, right) => right.issue_count - left.issue_count || left.manifest_kind.localeCompare(right.manifest_kind)
  );

  return {
    agent_onboarding: getAICAgentOnboardingReport(options.projectRoot ?? process.cwd()),
    diagnostics: artifacts.diagnostics,
    filesScanned: artifacts.scan.filesScanned,
    framework,
    generated_manifests: {
      findings: generatedManifestFindings,
      summary: {
        invalid: generatedManifestFindings.length
      }
    },
    matches: artifacts.matches,
    source_inventory: artifacts.source_inventory
  };
}

function createCoverageSummary(total: number, covered: number): AICQAReadinessCoverageSummary {
  const safeCovered = Math.min(total, Math.max(0, covered));
  const rate = total === 0 ? 1 : Number((safeCovered / total).toFixed(2));

  return {
    covered: safeCovered,
    missing: Math.max(0, total - safeCovered),
    rate,
    total
  };
}

function hasStructuredConfirmation(element: Pick<AICElementManifest, "confirmation" | "requires_confirmation">): boolean {
  return element.requires_confirmation === true && Boolean(element.confirmation?.type);
}

function hasEntityMetadata(element: Pick<AICElementManifest, "entity_ref">): boolean {
  return Boolean(
    element.entity_ref?.entity_id &&
      element.entity_ref.entity_type &&
      element.entity_ref.entity_label
  );
}

function isHighValueEntityCandidate(element: Pick<AICElementManifest, "actions" | "id" | "risk">): boolean {
  const actionNames = element.actions.map((action) => action.name.toLowerCase());
  const targetText = [element.id, ...actionNames].join(" ").toLowerCase();

  return (
    element.risk === "high" ||
    element.risk === "critical" ||
    /\b(archive|cancel|charge|checkout|create|delete|destroy|edit|remove|submit|update)\b/.test(targetText)
  );
}

function uniqueWorkflowStepIds(workflows: AICWorkflowManifest | undefined): Set<string> {
  const ids = new Set<string>();

  for (const workflow of workflows?.workflows ?? []) {
    ids.add(workflow.id);
    for (const step of workflow.steps) {
      ids.add(step.id);
    }
  }

  return ids;
}

function createQAReadinessNextActions(findings: AICQAReadinessFinding[]): string[] {
  const orderedCodes: AICQAReadinessFinding["code"][] = [
    "missing_runtime_ui_manifest",
    "generated_manifest_invalid",
    "critical_action_missing_confirmation",
    "high_risk_action_missing_confirmation",
    "workflow_ref_unresolved",
    "no_explicit_workflows",
    "high_value_action_missing_entity",
    "extraction_diagnostics_present"
  ];
  const actions: string[] = [];

  for (const code of orderedCodes) {
    const finding = findings.find((candidate) => candidate.code === code);
    if (!finding || actions.includes(finding.fix_hint)) {
      continue;
    }

    actions.push(finding.fix_hint);
    if (actions.length >= 5) {
      break;
    }
  }

  return actions;
}

export function createQAReadinessReport(inputs: AICQAReadinessInputs): AICQAReadinessReport {
  const generatedAt = inputs.generatedAt ?? new Date().toISOString();
  const elements = inputs.ui?.elements ?? [];
  const highOrCriticalElements = elements.filter(
    (element) => element.risk === "high" || element.risk === "critical"
  );
  const highValueEntityCandidates = elements.filter(isHighValueEntityCandidate);
  const workflowIds = uniqueWorkflowStepIds(inputs.workflows);
  const findings: AICQAReadinessFinding[] = [];

  if (!inputs.ui) {
    findings.push({
      code: "missing_runtime_ui_manifest",
      fix_hint: "Regenerate project artifacts and keep the runtime UI manifest next to report.json before selling QA readiness.",
      message: "No sibling runtime UI manifest was available, so rich element readiness could not be scored.",
      severity: "blocker"
    });
  }

  for (const finding of inputs.projectReport.generated_manifests?.findings ?? []) {
    if (finding.issue_count <= 0) {
      continue;
    }

    findings.push({
      code: "generated_manifest_invalid",
      fix_hint: "Fix generated manifest validation issues, then rerun `aic generate project` and `aic inspect qa-readiness`.",
      message: `${finding.manifest_kind} manifest has ${finding.issue_count} validation issue(s).`,
      severity: "blocker"
    });
  }

  if (inputs.projectReport.diagnostics.length > 0) {
    findings.push({
      code: "extraction_diagnostics_present",
      fix_hint: "Replace unsupported dynamic AIC props with deterministic metadata on pilot-critical controls.",
      message: `${inputs.projectReport.diagnostics.length} extraction diagnostic(s) should be reviewed before a customer pilot.`,
      severity: "warning"
    });
  }

  for (const element of highOrCriticalElements) {
    if (hasStructuredConfirmation(element)) {
      continue;
    }

    findings.push({
      code:
        element.risk === "critical"
          ? "critical_action_missing_confirmation"
          : "high_risk_action_missing_confirmation",
      element_id: element.id,
      fix_hint: "Add `agentRequiresConfirmation` plus structured `agentConfirmation` metadata on high and critical actions.",
      message: `${element.id} is ${element.risk} risk but does not expose structured confirmation metadata.`,
      severity: element.risk === "critical" ? "blocker" : "warning"
    });
  }

  for (const element of highValueEntityCandidates) {
    if (hasEntityMetadata(element)) {
      continue;
    }

    findings.push({
      code: "high_value_action_missing_entity",
      element_id: element.id,
      fix_hint: "Add `agentEntityId`, `agentEntityType`, and `agentEntityLabel` on record-scoped pilot actions.",
      message: `${element.id} looks like a high-value or record-scoped action but does not expose complete entity metadata.`,
      severity: "warning"
    });
  }

  if ((inputs.workflows?.workflows.length ?? 0) === 0) {
    findings.push({
      code: "no_explicit_workflows",
      fix_hint: "Add at least one workflow definition for each paid-pilot regression flow.",
      message: "No explicit workflows are available for QA agents to plan multi-step regression coverage.",
      severity: "warning"
    });
  }

  for (const element of elements) {
    if (!element.workflow_ref || workflowIds.has(element.workflow_ref)) {
      continue;
    }

    findings.push({
      code: "workflow_ref_unresolved",
      element_id: element.id,
      fix_hint: "Align `agentWorkflowStep` values with generated workflow IDs or step IDs.",
      message: `${element.id} references workflow step ${element.workflow_ref}, but no generated workflow or step matches it.`,
      severity: "blocker"
    });
  }

  const blockers = findings.filter((finding) => finding.severity === "blocker").length;
  const warnings = findings.filter((finding) => finding.severity === "warning").length;
  const stableIds = createCoverageSummary(elements.length, elements.filter((element) => Boolean(element.id)).length);
  const confirmation = createCoverageSummary(
    highOrCriticalElements.length,
    highOrCriticalElements.filter(hasStructuredConfirmation).length
  );
  const entity = createCoverageSummary(
    highValueEntityCandidates.length,
    highValueEntityCandidates.filter(hasEntityMetadata).length
  );
  const workflow = createCoverageSummary(
    elements.length,
    elements.filter((element) => Boolean(element.workflow_ref) && workflowIds.has(element.workflow_ref ?? "")).length
  );
  const validation = createCoverageSummary(
    elements.length,
    elements.filter((element) => Boolean(element.validation)).length
  );
  const execution = createCoverageSummary(
    elements.length,
    elements.filter((element) => Boolean(element.execution)).length
  );
  const recovery = createCoverageSummary(
    highOrCriticalElements.length,
    highOrCriticalElements.filter((element) => Boolean(element.recovery)).length
  );

  const score = Math.max(
    0,
    Math.round(
      100 -
        blockers * 25 -
        warnings * 5 -
        inputs.projectReport.diagnostics.length * 3 -
        (inputs.projectReport.generated_manifests?.summary.invalid ?? 0) * 15
    )
  );
  const grade: AICQAReadinessGrade =
    blockers > 0 || score < 60 ? "not_ready" : warnings > 0 || score < 85 ? "review_needed" : "pilot_ready";

  return {
    artifact_type: "aic_qa_readiness_report",
    coverage: {
      confirmation,
      entity,
      execution,
      recovery,
      stable_ids: stableIds,
      validation,
      workflow
    },
    findings,
    framework: inputs.projectReport.framework,
    generated_at: generatedAt,
    inputs: {
      actions_manifest: Boolean(inputs.actions),
      permissions_manifest: Boolean(inputs.permissions),
      project_report: true,
      runtime_ui_manifest: Boolean(inputs.ui),
      workflows_manifest: Boolean(inputs.workflows)
    },
    next_actions: createQAReadinessNextActions(findings),
    summary: {
      blockers,
      grade,
      high_or_critical_actions: highOrCriticalElements.length,
      score,
      total_elements: elements.length,
      warnings,
      workflows: inputs.workflows?.workflows.length ?? 0
    }
  };
}

function riskRank(risk: string): number {
  return { critical: 3, high: 2, low: 0, medium: 1 }[risk] ?? 0;
}

function maxRiskForElements(elements: AICElementManifest[]): string {
  return elements
    .map((element) => element.risk)
    .sort((left, right) => riskRank(right) - riskRank(left))[0] ?? "low";
}

function createPlanStep(
  element: AICElementManifest,
  actionName?: string,
  requiresConfirmation?: boolean
): AICQATestPlanStep {
  return {
    action: actionName ?? element.actions[0]?.name ?? "click",
    expected: element.execution?.settled_when?.[0] ?? element.execution?.ready_when?.[0] ?? `${element.id}.completed = true`,
    requires_confirmation: requiresConfirmation ?? hasStructuredConfirmation(element),
    target: element.id
  };
}

function renderPlaywrightSkeleton(pageUrl: string, scenarios: AICQATestPlanScenario[]): string {
  const lines = [
    "import { test, expect } from '@playwright/test';",
    "",
    "// Generated from AIC manifests. Resolve elements by AIC runtime IDs before falling back to selectors.",
    "async function clickAic(page, id) {",
    "  await page.locator(`[data-agent-id=\"${id}\"]`).click();",
    "}",
    ""
  ];

  for (const scenario of scenarios) {
    lines.push(`test('${scenario.id}', async ({ page }) => {`);
    lines.push(`  await page.goto('${pageUrl}');`);
    for (const step of scenario.steps) {
      lines.push(`  // ${step.action}: ${step.target}`);
      lines.push(`  await clickAic(page, '${step.target}');`);
      if (step.requires_confirmation) {
        lines.push("  // Confirm or cancel according to the scenario's safety-path expectation.");
      }
    }
    lines.push("  await expect(page).toBeTruthy();");
    lines.push("});");
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function createQAAgentTestPlan(inputs: AICQATestPlanInputs): AICQATestPlan {
  const elementsById = new Map(inputs.ui.elements.map((element) => [element.id, element]));
  const scenarios: AICQATestPlanScenario[] = [];

  for (const workflow of inputs.workflows?.workflows ?? []) {
    const stepElements = workflow.steps
      .map((step) => {
        const target = step.target ?? step.action ?? step.id;
        const element = target ? elementsById.get(target) : undefined;
        return element ? { element, step } : undefined;
      })
      .filter((value): value is { element: AICElementManifest; step: AICWorkflowManifest["workflows"][number]["steps"][number] } =>
        Boolean(value)
      );

    if (stepElements.length === 0) {
      continue;
    }

    const elements = stepElements.map(({ element }) => element);
    scenarios.push({
      id: workflow.id,
      max_risk: maxRiskForElements(elements),
      safety_path: stepElements.some(({ element, step }) => step.requires_confirmation === true || hasStructuredConfirmation(element)),
      steps: stepElements.map(({ element, step }) =>
        createPlanStep(element, step.action, step.requires_confirmation)
      ),
      title: workflow.title
    });
  }

  if (scenarios.length === 0) {
    const candidates = inputs.ui.elements.filter((element) => isHighValueEntityCandidate(element));
    for (const element of candidates) {
      scenarios.push({
        id: `${element.id}.qa`,
        max_risk: element.risk,
        safety_path: hasStructuredConfirmation(element),
        steps: [createPlanStep(element)],
        title: element.label
      });
    }
  }

  return {
    artifact_type: "aic_qa_test_plan",
    generated_at: inputs.generatedAt ?? new Date().toISOString(),
    playwright_skeleton: renderPlaywrightSkeleton(inputs.ui.page.url, scenarios),
    scenarios,
    source: (inputs.workflows?.workflows.length ?? 0) > 0 ? "workflows" : "runtime_ui"
  };
}

export interface AICAuthoringApplyOptions {
  projectRoot?: string;
  write?: boolean;
}

function escapeJsxAttributeValue(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function formatJsxAttribute(name: string, value: string | boolean): string {
  if (typeof value === "boolean") {
    return value ? name : `${name}={false}`;
  }

  return `${name}="${escapeJsxAttributeValue(value)}"`;
}

function getTagInsertIndex(source: string, node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): number {
  let index = node.end - 1;

  while (index > node.getStart(node.getSourceFile()) && /\s/.test(source[index - 1] ?? "")) {
    index -= 1;
  }

  if (source[index - 1] === "/") {
    return index - 1;
  }

  return index;
}

function getAttributeIndentation(
  source: string,
  sourceFile: ts.SourceFile,
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement
): { indent: string; multiline: boolean } {
  const openingText = source.slice(node.getStart(sourceFile), node.end);

  if (!openingText.includes("\n")) {
    return {
      indent: " ",
      multiline: false
    };
  }

  const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
  if (attributes.length > 0) {
    const attributeStart = attributes[0].getStart(sourceFile);
    const lineStart = source.lastIndexOf("\n", attributeStart - 1) + 1;
    return {
      indent: source.slice(lineStart, attributeStart),
      multiline: true
    };
  }

  const nodeStart = node.getStart(sourceFile);
  const lineStart = source.lastIndexOf("\n", nodeStart - 1) + 1;
  const baseIndent = source.slice(lineStart, nodeStart).match(/^\s*/)?.[0] ?? "";
  return {
    indent: `${baseIndent}  `,
    multiline: true
  };
}

function applyEdits(
  source: string,
  edits: Array<{ end: number; start: number; text: string }>
): string {
  return edits
    .sort((left, right) => right.start - left.start)
    .reduce((currentSource, edit) => {
      return `${currentSource.slice(0, edit.start)}${edit.text}${currentSource.slice(edit.end)}`;
    }, source);
}

function normalizeText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function recordMatchesProposalIdentity(
  record: ParsedJsxElementRecord,
  proposal: AICAuthoringPatchPlan["proposals"][number]
): boolean {
  const applyTarget = proposal.apply_target;

  if (!applyTarget) {
    return false;
  }

  if (applyTarget.match_kind === "agent_id_exact") {
    return record.agentId === proposal.recommended_props.agentId;
  }

  if (record.agentId) {
    return false;
  }

  const expectedLabel =
    proposal.evidence.dom_candidate?.label ??
    proposal.evidence.snapshot_element?.label ??
    proposal.recommended_props.agentDescription;
  const expectedRole =
    proposal.evidence.dom_candidate?.role ?? proposal.evidence.snapshot_element?.role;

  return normalizeText(record.label) === normalizeText(expectedLabel) && record.role === expectedRole;
}

function resolveApplyRecord(
  records: ParsedJsxElementRecord[],
  proposal: AICAuthoringPatchPlan["proposals"][number]
): {
  ambiguous_signature_match?: boolean;
  record?: ParsedJsxElementRecord;
  resolved_via_signature?: boolean;
} {
  const applyTarget = proposal.apply_target;

  if (!applyTarget) {
    return {};
  }

  const exactSourceKeyMatches = records.filter(
    (record) => record.source_key === applyTarget.source_key && recordMatchesProposalIdentity(record, proposal)
  );

  if (exactSourceKeyMatches.length === 1) {
    return {
      record: exactSourceKeyMatches[0],
      resolved_via_signature: false
    };
  }

  if (exactSourceKeyMatches.length > 1) {
    return {
      ambiguous_signature_match: true
    };
  }

  if (!applyTarget.opening_tag_signature) {
    return {};
  }

  const signatureMatches = records.filter(
    (record) =>
      record.opening_tag_signature === applyTarget.opening_tag_signature &&
      recordMatchesProposalIdentity(record, proposal)
  );

  if (signatureMatches.length === 1) {
    return {
      record: signatureMatches[0],
      resolved_via_signature: true
    };
  }

  if (signatureMatches.length > 1) {
    return {
      ambiguous_signature_match: true
    };
  }

  return {};
}

function buildDesiredProps(
  proposal: AICAuthoringPatchPlan["proposals"][number]
): DesiredMutableAicProps {
  const desiredProps: DesiredMutableAicProps = {
    agentAction: proposal.recommended_props.agentAction,
    agentDescription: proposal.recommended_props.agentDescription,
    agentId: proposal.recommended_props.agentId,
    agentRisk: proposal.recommended_props.agentRisk
  };

  if (proposal.recommended_optional_props?.agentEntityId) {
    desiredProps.agentEntityId = proposal.recommended_optional_props.agentEntityId;
  }

  if (proposal.recommended_optional_props?.agentEntityLabel) {
    desiredProps.agentEntityLabel = proposal.recommended_optional_props.agentEntityLabel;
  }

  if (proposal.recommended_optional_props?.agentEntityType) {
    desiredProps.agentEntityType = proposal.recommended_optional_props.agentEntityType;
  }

  if (proposal.recommended_optional_props?.agentRequiresConfirmation) {
    desiredProps.agentRequiresConfirmation = true;
  }

  if (proposal.recommended_optional_props?.agentRole) {
    desiredProps.agentRole = proposal.recommended_optional_props.agentRole;
  }

  if (proposal.recommended_optional_props?.agentWorkflowStep) {
    desiredProps.agentWorkflowStep = proposal.recommended_optional_props.agentWorkflowStep;
  }

  return desiredProps;
}

function getRecordApplyBlockReason(
  record: ParsedJsxElementRecord,
  proposal: AICAuthoringPatchPlan["proposals"][number]
): AICAuthoringPatchPlan["proposals"][number]["apply_block_reason"] | undefined {
  if (record.hasSpreadAttributes) {
    return "spread_attributes_present";
  }

  if (record.duplicateAicProps.length > 0) {
    return "duplicate_aic_props";
  }

  const desiredPropNames = new Set(Object.keys(buildDesiredProps(proposal)));
  if (record.unsupportedAicProps.some((attributeName) => desiredPropNames.has(attributeName))) {
    return "dynamic_existing_aic_prop";
  }

  return undefined;
}

function formatApplyBlockMessage(
  reason: AICAuthoringPatchPlan["proposals"][number]["apply_block_reason"] | undefined
): string {
  switch (reason) {
    case "ignored":
      return "Proposal is ignored and will not be applied.";
    case "not_ready":
      return "Proposal is not ready for apply.";
    case "review_only_source_match":
      return "Proposal only has review-only source candidates and requires an exact source match.";
    case "ambiguous_exact_source_match":
      return "Proposal has multiple exact source matches and requires review.";
    case "spread_attributes_present":
      return "Guarded apply skipped this source because the opening tag uses JSX spread attributes.";
    case "duplicate_aic_props":
      return "Guarded apply skipped this source because the opening tag contains duplicate AIC props.";
    case "dynamic_existing_aic_prop":
      return "Guarded apply skipped this source because existing AIC props use unsupported dynamic expressions.";
    default:
      return "Proposal does not have an exact source match.";
  };
}

function applyPropsToRecord(
  parsedFile: ApplyParsedFile,
  currentSource: string,
  record: ParsedJsxElementRecord,
  desiredProps: DesiredMutableAicProps
): { changed_fields: string[]; source: string } {
  const updates: Array<{ end: number; start: number; text: string }> = [];
  const missingAttributes: string[] = [];
  const changedFields: string[] = [];

  (Object.entries(desiredProps) as Array<[MutableAicPropName, string | boolean]>).forEach(
    ([attributeName, desiredValue]) => {
      const attribute = record.attributes.get(attributeName);

      if (!attribute) {
        missingAttributes.push(formatJsxAttribute(attributeName, desiredValue));
        changedFields.push(attributeName);
        return;
      }

      const currentValue = readMutableAicAttributeValue(
        attributeName,
        attribute,
        parsedFile.sourceFile,
        record.file,
        parsedFile.staticResolver,
        []
      );

      if (currentValue === desiredValue) {
        return;
      }

      updates.push({
        end: attribute.end,
        start: attribute.getStart(parsedFile.sourceFile),
        text: formatJsxAttribute(attributeName, desiredValue)
      });
      changedFields.push(attributeName);
    }
  );

  if (missingAttributes.length > 0) {
    const insertionIndex = getTagInsertIndex(currentSource, record.node);
    const indentation = getAttributeIndentation(currentSource, parsedFile.sourceFile, record.node);
    updates.push({
      end: insertionIndex,
      start: insertionIndex,
      text: indentation.multiline
        ? missingAttributes.map((attribute) => `\n${indentation.indent}${attribute}`).join("")
        : ` ${missingAttributes.join(" ")}`
    });
  }

  if (updates.length === 0) {
    return {
      changed_fields: [],
      source: currentSource
    };
  }

  return {
    changed_fields: changedFields,
    source: applyEdits(currentSource, updates)
  };
}

export async function applyAuthoringPatchPlan(
  plan: AICAuthoringPatchPlan,
  options: AICAuthoringApplyOptions = {}
): Promise<AICAuthoringApplyResult> {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const dryRun = options.write !== true;
  const outcomes: AICAuthoringApplyResult["outcomes"] = [];
  const eligibleProposals = new Map<string, Array<AICAuthoringPatchPlan["proposals"][number]>>();

  plan.proposals.forEach((proposal) => {
    if (proposal.apply_status !== "eligible" || !proposal.apply_target) {
      outcomes.push({
        changed_fields: [],
        file: proposal.apply_target?.file,
        message: formatApplyBlockMessage(proposal.apply_block_reason),
        proposal_key: proposal.key,
        source_key: proposal.apply_target?.source_key,
        status: "skipped"
      });
      return;
    }

    const group = eligibleProposals.get(proposal.apply_target.file) ?? [];
    group.push(proposal);
    eligibleProposals.set(proposal.apply_target.file, group);
  });

  const changedFiles = new Set<string>();

  for (const [relativeFile, fileProposals] of eligibleProposals) {
    const resolvedFile = resolve(projectRoot, relativeFile);
    let originalSource: string;

    try {
      originalSource = await readFile(resolvedFile, "utf8");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to read source file.";
      fileProposals.forEach((proposal) => {
        outcomes.push({
          changed_fields: [],
          file: relativeFile,
          message,
          proposal_key: proposal.key,
          source_key: proposal.apply_target?.source_key,
          status: "failed"
        });
      });
      continue;
    }

    const parsedFile = parseSourceFileForApply(originalSource, relativeFile);
    const resolvedEntries = fileProposals
      .map((proposal) => {
        const resolution = resolveApplyRecord(parsedFile.records, proposal);
        return {
          proposal,
          ...resolution
        };
      })
      .sort((left, right) => {
        const leftStart = left.record?.node.getStart(parsedFile.sourceFile) ?? -1;
        const rightStart = right.record?.node.getStart(parsedFile.sourceFile) ?? -1;
        return rightStart - leftStart;
      });

    let nextSource = originalSource;
    const successfulOutcomes: Array<{
      changed_fields: string[];
      proposal: AICAuthoringPatchPlan["proposals"][number];
      resolved_via_signature?: boolean;
    }> = [];

    for (const entry of resolvedEntries) {
      if (entry.ambiguous_signature_match) {
        outcomes.push({
          changed_fields: [],
          file: relativeFile,
          message:
            "Recorded source target drifted and the opening tag signature matched multiple current locations.",
          proposal_key: entry.proposal.key,
          source_key: entry.proposal.apply_target?.source_key,
          status: "skipped"
        });
        continue;
      }

      if (!entry.record) {
        outcomes.push({
          changed_fields: [],
          file: relativeFile,
          message: "Recorded source target no longer matches the current file.",
          proposal_key: entry.proposal.key,
          source_key: entry.proposal.apply_target?.source_key,
          status: "skipped"
        });
        continue;
      }

      const applyBlockReason = getRecordApplyBlockReason(entry.record, entry.proposal);
      if (applyBlockReason) {
        outcomes.push({
          changed_fields: [],
          file: relativeFile,
          message: formatApplyBlockMessage(applyBlockReason),
          proposal_key: entry.proposal.key,
          source_key: entry.proposal.apply_target?.source_key,
          status: "skipped"
        });
        continue;
      }

      const applied = applyPropsToRecord(parsedFile, nextSource, entry.record, buildDesiredProps(entry.proposal));
      nextSource = applied.source;
      const signatureRecoveryPrefix = entry.resolved_via_signature
        ? "Recovered source by opening tag signature. "
        : "";

      if (applied.changed_fields.length === 0) {
        outcomes.push({
          changed_fields: [],
          file: relativeFile,
          message: `${signatureRecoveryPrefix}Source already matches the recommended props.`,
          proposal_key: entry.proposal.key,
          source_key: entry.proposal.apply_target?.source_key,
          status: "skipped"
        });
        continue;
      }

      successfulOutcomes.push({
        changed_fields: applied.changed_fields,
        proposal: entry.proposal,
        resolved_via_signature: entry.resolved_via_signature
      });
    }

    if (successfulOutcomes.length === 0) {
      continue;
    }

    if (!dryRun) {
      try {
        await writeFile(resolvedFile, nextSource, "utf8");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to write source file.";
        successfulOutcomes.forEach((entry) => {
          outcomes.push({
            changed_fields: entry.changed_fields,
            file: relativeFile,
            message,
            proposal_key: entry.proposal.key,
            source_key: entry.proposal.apply_target?.source_key,
            status: "failed"
          });
        });
        continue;
      }
    }

    changedFiles.add(relativeFile);
    successfulOutcomes.forEach((entry) => {
      const signatureRecoveryPrefix = entry.resolved_via_signature
        ? "Recovered source by opening tag signature. "
        : "";
      outcomes.push({
        changed_fields: entry.changed_fields,
        file: relativeFile,
        message: dryRun
          ? `${signatureRecoveryPrefix}Dry run: would apply ${entry.changed_fields.join(", ")}.`
          : `${signatureRecoveryPrefix}Applied ${entry.changed_fields.join(", ")}.`,
        proposal_key: entry.proposal.key,
        source_key: entry.proposal.apply_target?.source_key,
        status: "applied"
      });
    });
  }

  return {
    artifact_type: "aic_authoring_apply_result",
    dry_run: dryRun,
    generated_at: new Date().toISOString(),
    outcomes,
    plan_generated_at: plan.generated_at,
    project_root: projectRoot,
    summary: {
      applied: outcomes.filter((outcome) => outcome.status === "applied").length,
      changed_files: changedFiles.size,
      failed: outcomes.filter((outcome) => outcome.status === "failed").length,
      skipped: outcomes.filter((outcome) => outcome.status === "skipped").length,
      total: outcomes.length
    }
  };
}

export function diffManifestValues(
  kind: AICAutomationManifestKind,
  before: unknown,
  after: unknown
): AICManifestDiff {
  return diffAICManifestSummary(kind, before, after);
}

export function diffManifestValuesDetailed(
  kind: AICAutomationManifestKind,
  before: unknown,
  after: unknown
): AICDetailedManifestDiff {
  return diffAICManifestDetailed(kind, before, after);
}
