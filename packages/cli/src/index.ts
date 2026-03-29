#!/usr/bin/env node

import { writeSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { format } from "node:util";
import {
  analyzeProjectForAICAnnotations,
  applyAuthoringPatchPlan,
  createAICDoctorReport,
  createProjectArtifactReport,
  diffManifestValues,
  diffManifestValuesDetailed,
  generateProjectArtifacts,
  initializeAICProject,
  scanSourceForAICAnnotations,
  writeArtifactFiles,
  type AICAutomationManifestKind
} from "@aicorg/automation-core";
import {
  isAICBootstrapProviderError,
  createBootstrapSuggestionPrompt,
  createStaticBootstrapSuggestionProvider,
  capturePagesWithPlaywright,
  createBootstrapCrawlerPlan,
  generateBootstrapDraft,
  generateBootstrapReview,
  renderBootstrapReport,
  renderBootstrapReviewReport,
  type AICBootstrapPageCapture
} from "@aicorg/ai-bootstrap";
import { createHttpBootstrapSuggestionProvider } from "@aicorg/ai-bootstrap-http";
import { createOpenAIBootstrapSuggestionProvider } from "@aicorg/ai-bootstrap-openai";
import { AICRegistry } from "@aicorg/runtime";
import {
  type AICAuthoringApplyResult,
  buildAICAuthoringPatchPlan,
  MANIFEST_VERSION,
  SPEC_VERSION,
  renderAICAuthoringPatchPlanSummary,
  validateDiscoveryManifest,
  validatePermissionsManifest,
  validateRuntimeUiManifest,
  validateSemanticActionsManifest,
  validateWorkflowManifest,
  type AICAuthoringInputs,
  type AICAuthoringPatchPlan,
  type AICDoctorReport,
  type AICDiscoveryManifest,
  type AICElementManifest,
  type AICInitResult,
  type AICPermissionsManifest,
  type AICRuntimeUiManifest,
  type AICSemanticActionsManifest,
  type AICValidationIssue,
  type AICWorkflowManifest
} from "@aicorg/spec";

console.log = (...args: unknown[]) => {
  writeSync(process.stdout.fd, `${format(...args)}\n`);
};

console.error = (...args: unknown[]) => {
  writeSync(process.stderr.fd, `${format(...args)}\n`);
};

type ManifestKind = AICAutomationManifestKind;

type ValidationMap = {
  [K in ManifestKind]: (value: unknown) => {
    issues: AICValidationIssue[];
    ok: boolean;
  };
};

const validators: ValidationMap = {
  actions: validateSemanticActionsManifest,
  discovery: validateDiscoveryManifest,
  permissions: validatePermissionsManifest,
  ui: validateRuntimeUiManifest,
  workflows: validateWorkflowManifest
};

async function readJson<T>(filePath: string): Promise<T> {
  const contents = await readFile(resolve(process.cwd(), filePath), "utf8");
  return JSON.parse(contents) as T;
}

function resolveConfigRelativePath(configFile: string, candidatePath: string | undefined): string | undefined {
  if (!candidatePath) {
    return undefined;
  }

  if (candidatePath.startsWith("/")) {
    return candidatePath;
  }

  return resolve(dirname(resolve(process.cwd(), configFile)), candidatePath);
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortObject(item));
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortObject((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }

  return value;
}

function printUsage(): void {
  console.log(`AIC CLI

Usage:
  aic scan <file-or-directory>
  aic init [project-root] [--framework <nextjs|vite|react>] [--app-name <name>] [--view-id <id>] [--view-url <url>] [--dry-run] [--force]
  aic doctor [project-root] [--config <file>] [--report-file <file>]
  aic validate <discovery|ui|permissions|workflows|actions> <file>
  aic bootstrap <url> [routes-csv] [--app-name <name>] [--captures-file <file>] [--suggestions-file <file>] [--provider-kind <http|openai>] [--provider-endpoint <url>] [--provider-model <name>] [--provider-header <k=v>] [--provider-selector <path>] [--provider-bearer-env <env>] [--provider-timeout-ms <ms>] [--provider-retries <n>] [--openai-api-key-env <env>] [--openai-base-url <url>] [--draft-file <file>] [--review-file <file>] [--report-file <file>] [--prompt-file <file>] [--min-confidence <0-1>] [--max-suggestions <n>] [--print-prompt]
  aic generate discovery <config-file>
  aic generate ui <elements-file> <url> <view-id>
  aic generate permissions <config-file>
  aic generate operate <config-file>
  aic generate project <config-file> [--out-dir <dir>]
  aic generate authoring-plan <snapshot-file> [--dom-candidates <file>] [--report <file>] [--bootstrap-review <file>]
  aic apply authoring-plan <plan-file> [--project-root <dir>] [--write] [--report-file <file>]
  aic diff <discovery|ui|permissions|workflows|actions> <before-file> <after-file> [--format <summary|detailed>]
  aic inspect <file>
`);
}

function printIssues(issues: AICValidationIssue[]): void {
  issues.forEach((issue) => {
    console.error(`[${issue.severity}] ${issue.path}: ${issue.message}`);
  });
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

async function writeTextFile(filePath: string, contents: string): Promise<void> {
  const resolvedPath = resolve(process.cwd(), filePath);
  await mkdir(dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, contents, "utf8");
}

async function scanPath(targetPath: string): Promise<number> {
  const fullPath = resolve(process.cwd(), targetPath);
  const result =
    targetPath.endsWith(".js") ||
    targetPath.endsWith(".jsx") ||
    targetPath.endsWith(".ts") ||
    targetPath.endsWith(".tsx")
      ? (() => {
          return readFile(fullPath, "utf8").then((contents) => {
            const fileResult = scanSourceForAICAnnotations(contents, fullPath);
            return {
              diagnostics: fileResult.diagnostics,
              files: [fullPath],
              matches: fileResult.matches,
              source_inventory: fileResult.source_inventory
            };
          });
        })()
      : analyzeProjectForAICAnnotations(fullPath);

  const scan = await result;
  printJson({
    diagnostics: scan.diagnostics,
    matches: scan.matches,
    source_inventory: scan.source_inventory,
    summary: {
      extractedElements: scan.matches.length,
      filesScanned: scan.files.length,
      sourceInventoryEntries: scan.source_inventory.length,
      warnings: scan.diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length
    }
  });
  return 0;
}

async function validate(kind: ManifestKind, filePath: string): Promise<number> {
  const manifest = await readJson<unknown>(filePath);
  const result = validators[kind](manifest);

  if (!result.ok) {
    printIssues(result.issues);
    return 1;
  }

  printIssues(result.issues);
  console.log(`${kind} manifest is valid.`);
  return 0;
}

async function generateDiscovery(filePath: string): Promise<number> {
  const config = await readJson<{
    appName: string;
    appVersion?: string;
    framework?: string;
    notes?: string[];
  }>(filePath);
  const registry = new AICRegistry();
  const manifest = registry.createDiscoveryManifest(config);
  printJson(manifest);
  return 0;
}

async function generateUi(filePath: string, url?: string, viewId?: string): Promise<number> {
  const elements = await readJson<AICElementManifest[]>(filePath);
  const manifest: AICRuntimeUiManifest = {
    spec: SPEC_VERSION,
    manifest_version: MANIFEST_VERSION,
    updated_at: new Date().toISOString(),
    page: {
      url: url ?? "http://localhost:3000"
    },
    view: {
      view_id: viewId ?? "root"
    },
    elements
  };
  const result = validateRuntimeUiManifest(manifest);

  if (!result.ok) {
    printIssues(result.issues);
    return 1;
  }

  printJson(manifest);
  return 0;
}

async function generatePermissions(filePath: string): Promise<number> {
  const overrides = await readJson<Partial<AICPermissionsManifest>>(filePath);
  const registry = new AICRegistry();
  printJson(registry.createPermissionsManifest(overrides));
  return 0;
}

async function generateOperate(filePath: string): Promise<number> {
  const config = await readJson<{
    appName: string;
    endpoints?: AICDiscoveryManifest["endpoints"];
    notes?: string[];
  }>(filePath);
  const registry = new AICRegistry();
  console.log(
    registry.renderOperateText({
      appName: config.appName,
      endpoints: config.endpoints,
      notes: config.notes
    })
  );
  return 0;
}

function unwrapRuntimeUiManifest(value: unknown): AICRuntimeUiManifest | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (Array.isArray(record.elements) && record.page && record.view) {
    return value as AICRuntimeUiManifest;
  }

  if (record.manifest && typeof record.manifest === "object") {
    const nested = record.manifest as Record<string, unknown>;

    if (Array.isArray(nested.elements) && nested.page && nested.view) {
      return nested as unknown as AICRuntimeUiManifest;
    }
  }

  return undefined;
}

function readOptionValue(args: string[], optionName: string): string | undefined {
  const prefixed = `${optionName}=`;
  const inlineMatch = args.find((arg) => arg.startsWith(prefixed));

  if (inlineMatch) {
    return inlineMatch.slice(prefixed.length);
  }

  const optionIndex = args.indexOf(optionName);
  return optionIndex >= 0 ? args[optionIndex + 1] : undefined;
}

function readPositionalArgs(args: string[]): string[] {
  const positional: string[] = [];
  const valueLessFlags = new Set(["--print-prompt", "--write"]);

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value.startsWith("--")) {
      if (
        !value.includes("=") &&
        !valueLessFlags.has(value) &&
        args[index + 1] &&
        !args[index + 1].startsWith("--")
      ) {
        index += 1;
      }
      continue;
    }

    positional.push(value);
  }

  return positional;
}

function readOptionValues(args: string[], optionName: string): string[] {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value === optionName) {
      const nextValue = args[index + 1];
      if (nextValue && !nextValue.startsWith("--")) {
        values.push(nextValue);
        index += 1;
      }
      continue;
    }

    const prefixed = `${optionName}=`;
    if (value.startsWith(prefixed)) {
      values.push(value.slice(prefixed.length));
    }
  }

  return values;
}

function hasFlag(args: string[], flagName: string): boolean {
  return args.includes(flagName);
}

function parseNumberOption(
  args: string[],
  optionName: string
): number | undefined {
  const value = readOptionValue(args, optionName);

  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseHeaderEntries(values: string[]): Record<string, string> {
  return values.reduce<Record<string, string>>((headers, entry) => {
    const separatorIndex = entry.indexOf("=");

    if (separatorIndex <= 0) {
      return headers;
    }

    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();

    if (key.length > 0) {
      headers[key] = value;
    }

    return headers;
  }, {});
}

async function initProject(args: string[]): Promise<number> {
  const positional = readPositionalArgs(args);
  const projectRoot = positional[0];
  const framework = readOptionValue(args, "--framework");
  const appName = readOptionValue(args, "--app-name");
  const viewId = readOptionValue(args, "--view-id");
  const viewUrl = readOptionValue(args, "--view-url");
  const dryRun = hasFlag(args, "--dry-run");
  const force = hasFlag(args, "--force");

  if (framework && !["nextjs", "react", "vite"].includes(framework)) {
    console.error('--framework must be one of "nextjs", "vite", or "react".');
    return 1;
  }

  try {
    const result = await initializeAICProject({
      appName,
      dryRun,
      force,
      framework: framework as "nextjs" | "react" | "vite" | undefined,
      projectRoot,
      viewId,
      viewUrl
    });
    printJson(result);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initialize AIC project.";
    console.error(message);
    return 1;
  }
}

async function doctorProject(args: string[]): Promise<number> {
  const positional = readPositionalArgs(args);
  const projectRoot = positional[0];
  const configFile = readOptionValue(args, "--config");
  const reportFile = readOptionValue(args, "--report-file");
  const result = await createAICDoctorReport({
    configFile,
    projectRoot
  });

  if (reportFile) {
    await writeTextFile(reportFile, `${JSON.stringify(result, null, 2)}\n`);
  }

  printJson(result);
  return result.summary.errors > 0 ? 1 : 0;
}

async function generateProject(filePath: string, args: string[]): Promise<number> {
  const config = await readJson<{
    appName: string;
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
  }>(filePath);
  const outDir = readOptionValue(args, "--out-dir");
  const framework = config.framework ?? "vite";
  const projectRoot = resolveConfigRelativePath(filePath, config.projectRoot) ?? process.cwd();
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
    projectRoot,
    updatedAt: config.updatedAt,
    viewId: config.viewId,
    viewUrl: config.viewUrl,
    workflows: config.workflows
  });
  const frameworkReport = createProjectArtifactReport(framework, artifacts, {
    projectRoot
  });

  if (outDir) {
    await writeArtifactFiles(resolve(process.cwd(), outDir), {
      ...artifacts.files,
      "/report.json": `${JSON.stringify(sortObject(frameworkReport), null, 2)}\n`
    });
  }

  printJson({
    actions: artifacts.actions,
    agent_onboarding: frameworkReport.agent_onboarding,
    diagnostics: artifacts.diagnostics,
    discovery: artifacts.discovery,
    files: Object.keys(artifacts.files),
    framework,
    matches: artifacts.matches,
    operate: artifacts.operate,
    outDir: outDir ? resolve(process.cwd(), outDir) : undefined,
    permissions: artifacts.permissions,
    scan: artifacts.scan,
    source_inventory: artifacts.source_inventory,
    ui: artifacts.ui,
    workflows: artifacts.workflows
  });
  return 0;
}

async function generateAuthoringPlan(
  snapshotFile: string,
  args: string[]
): Promise<number> {
  const snapshotValue = await readJson<unknown>(snapshotFile);
  const snapshot = unwrapRuntimeUiManifest(snapshotValue);

  if (!snapshot) {
    console.error("The snapshot file must be a runtime UI manifest or a devtools snapshot envelope.");
    return 1;
  }

  const domCandidatesFile = readOptionValue(args, "--dom-candidates");
  const reportFile = readOptionValue(args, "--report");
  const bootstrapReviewFile = readOptionValue(args, "--bootstrap-review");
  const inputs: AICAuthoringInputs = {
    snapshot
  };

  if (domCandidatesFile) {
    const domCandidates = await readJson<unknown>(domCandidatesFile);

    if (!Array.isArray(domCandidates)) {
      console.error("--dom-candidates must point to a JSON array.");
      return 1;
    }

    inputs.dom_candidates = domCandidates as AICAuthoringInputs["dom_candidates"];
  }

  if (reportFile) {
    inputs.project_report = await readJson<AICAuthoringInputs["project_report"]>(reportFile);
  }

  if (bootstrapReviewFile) {
    inputs.bootstrap_review = await readJson<AICAuthoringInputs["bootstrap_review"]>(bootstrapReviewFile);
  }

  const plan = buildAICAuthoringPatchPlan(inputs);
  printJson(plan);
  return 0;
}

async function applyAuthoringPlanCommand(
  planFile: string,
  args: string[]
): Promise<number> {
  const value = await readJson<unknown>(planFile);

  if (!isAuthoringPatchPlan(value)) {
    console.error("The plan file must be an AIC authoring patch plan.");
    return 1;
  }

  const projectRoot = readOptionValue(args, "--project-root");
  const reportFile = readOptionValue(args, "--report-file");
  const result = await applyAuthoringPatchPlan(value, {
    projectRoot: projectRoot ? resolve(process.cwd(), projectRoot) : process.cwd(),
    write: hasFlag(args, "--write")
  });

  if (reportFile) {
    await writeTextFile(reportFile, `${JSON.stringify(result, null, 2)}\n`);
  }

  printJson(result);
  return result.summary.failed > 0 ? 1 : 0;
}

async function bootstrap(args: string[]): Promise<number> {
  const positional = readPositionalArgs(args);
  const targetUrl = positional[0];
  const routesCsv = positional[1];

  if (!targetUrl) {
    printUsage();
    return 1;
  }

  const routes = routesCsv ? routesCsv.split(",").map((route) => route.trim()) : undefined;
  const capturesFile = readOptionValue(args, "--captures-file");
  const suggestionsFile = readOptionValue(args, "--suggestions-file");
  const providerKind = readOptionValue(args, "--provider-kind");
  const providerEndpoint = readOptionValue(args, "--provider-endpoint");
  const providerModel = readOptionValue(args, "--provider-model");
  const providerSelector = readOptionValue(args, "--provider-selector");
  const providerBearerEnv = readOptionValue(args, "--provider-bearer-env");
  const providerTimeoutMs = parseNumberOption(args, "--provider-timeout-ms");
  const providerRetries = parseNumberOption(args, "--provider-retries");
  const openaiApiKeyEnv = readOptionValue(args, "--openai-api-key-env") ?? "OPENAI_API_KEY";
  const openaiBaseUrl = readOptionValue(args, "--openai-base-url");
  const draftFile = readOptionValue(args, "--draft-file");
  const reviewFile = readOptionValue(args, "--review-file");
  const reportFile = readOptionValue(args, "--report-file");
  const promptFile = readOptionValue(args, "--prompt-file");
  const minConfidence = parseNumberOption(args, "--min-confidence");
  const maxSuggestions = parseNumberOption(args, "--max-suggestions");
  const printPrompt = hasFlag(args, "--print-prompt");
  const providerHeaders = parseHeaderEntries(readOptionValues(args, "--provider-header"));
  const bootstrapOptions = {
    appName: readOptionValue(args, "--app-name") ?? "Bootstrap Draft",
    routes,
    targetUrl
  };
  const plan = createBootstrapCrawlerPlan(bootstrapOptions);

  if (minConfidence !== undefined && (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1)) {
    console.error("--min-confidence must be a number between 0 and 1.");
    return 1;
  }

  if (
    maxSuggestions !== undefined &&
    (!Number.isFinite(maxSuggestions) || maxSuggestions <= 0 || !Number.isInteger(maxSuggestions))
  ) {
    console.error("--max-suggestions must be a positive integer.");
    return 1;
  }

  if (
    providerTimeoutMs !== undefined &&
    (!Number.isFinite(providerTimeoutMs) ||
      providerTimeoutMs <= 0 ||
      !Number.isInteger(providerTimeoutMs))
  ) {
    console.error("--provider-timeout-ms must be a positive integer.");
    return 1;
  }

  if (
    providerRetries !== undefined &&
    (!Number.isFinite(providerRetries) || providerRetries < 0 || !Number.isInteger(providerRetries))
  ) {
    console.error("--provider-retries must be a non-negative integer.");
    return 1;
  }

  try {
    const captures = capturesFile
      ? await readJson<AICBootstrapPageCapture[]>(capturesFile)
      : await capturePagesWithPlaywright({
          ...bootstrapOptions,
          headless: true
        });
    const promptPayload = createBootstrapSuggestionPrompt(bootstrapOptions, captures);

    if (promptFile) {
      await writeTextFile(promptFile, JSON.stringify(promptPayload, null, 2));
    }

    if (printPrompt) {
      printJson(promptPayload);
      return 0;
    }

    const provider = suggestionsFile
      ? createStaticBootstrapSuggestionProvider(await readJson<unknown>(suggestionsFile), "file-model")
      : providerKind === "openai" && providerModel
        ? createOpenAIBootstrapSuggestionProvider({
            apiKey: process.env[openaiApiKeyEnv],
            baseUrl: openaiBaseUrl,
            headers: providerHeaders,
            model: providerModel,
            providerName: `openai:${providerModel}`,
            retries: providerRetries,
            timeoutMs: providerTimeoutMs
          })
        : providerEndpoint && providerModel
          ? createHttpBootstrapSuggestionProvider({
              bearerToken: providerBearerEnv ? process.env[providerBearerEnv] : undefined,
              endpoint: providerEndpoint,
              headers: providerHeaders,
              model: providerModel,
              providerName: `http:${providerModel}`,
              responseSelector: providerSelector,
              retries: providerRetries,
              timeoutMs: providerTimeoutMs
            })
          : undefined;
    const review = await generateBootstrapReview(bootstrapOptions, captures, provider, {
      maxSuggestions,
      minConfidence
    });
    const draft = review.draft;
    const report = renderBootstrapReviewReport(review);

    if (draftFile) {
      await writeTextFile(draftFile, JSON.stringify(draft, null, 2));
    }

    if (reviewFile) {
      await writeTextFile(reviewFile, JSON.stringify(review, null, 2));
    }

    if (reportFile) {
      await writeTextFile(reportFile, `${report}\n`);
    }

    console.log(report);
    return 0;
  } catch (error) {
    console.error(`Bootstrap capture failed after planning routes: ${plan.join(", ")}`);
    if (isAICBootstrapProviderError(error)) {
      const statusSuffix = error.status !== undefined ? ` (status ${error.status})` : "";
      const attemptsSuffix =
        error.attempts !== undefined ? ` after ${error.attempts} attempt(s)` : "";
      console.error(`Provider: ${error.provider}`);
      console.error(`Failure kind: ${error.kind}${statusSuffix}`);
      console.error(`Retryable: ${error.retryable ? "yes" : "no"}${attemptsSuffix}`);
      if (error.cause_message) {
        console.error(`Cause: ${error.cause_message}`);
      }
      console.error(error.message);
      return 1;
    }

    const message = error instanceof Error ? error.message : "Unknown bootstrap failure";
    console.error(message);
    return 1;
  }
}

async function diffManifests(
  kind: ManifestKind,
  beforeFile: string,
  afterFile: string,
  args: string[]
): Promise<number> {
  const beforeManifest = await readJson<unknown>(beforeFile);
  const afterManifest = await readJson<unknown>(afterFile);
  const format = readOptionValue(args, "--format") ?? "summary";

  if (format !== "summary" && format !== "detailed") {
    console.error(`Unsupported diff format "${format}". Use "summary" or "detailed".`);
    return 1;
  }

  printJson(
    format === "detailed"
      ? diffManifestValuesDetailed(kind, beforeManifest, afterManifest)
      : diffManifestValues(kind, beforeManifest, afterManifest)
  );
  return 0;
}

function detectManifestKind(value: unknown): ManifestKind | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (Array.isArray(record.elements)) {
    return "ui";
  }

  if (Array.isArray(record.actions)) {
    return "actions";
  }

  if (Array.isArray(record.workflows)) {
    return "workflows";
  }

  if (record.riskBands) {
    return "permissions";
  }

  if (record.app && record.endpoints) {
    return "discovery";
  }

  return undefined;
}

function isAuthoringPatchPlan(value: unknown): value is AICAuthoringPatchPlan {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.artifact_type === "aic_authoring_patch_plan" &&
    Array.isArray(record.proposals) &&
    typeof record.summary === "object" &&
    record.summary !== null
  );
}

function isAuthoringApplyResult(value: unknown): value is AICAuthoringApplyResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.artifact_type === "aic_authoring_apply_result" &&
    Array.isArray(record.outcomes) &&
    typeof record.summary === "object" &&
    record.summary !== null
  );
}

function isBootstrapReview(value: unknown): value is {
  artifact_type?: string;
  draft: AICRuntimeUiManifest | Record<string, unknown>;
  provider_name?: string;
  summary: {
    accepted_suggestions?: number;
    capture_count?: number;
    filtered_suggestions?: number;
    review_required_suggestions?: number;
    validation_issue_count?: number;
  };
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.artifact_type === "aic_bootstrap_review" &&
    typeof record.summary === "object" &&
    record.summary !== null &&
    typeof record.draft === "object" &&
    record.draft !== null
  );
}

function isBootstrapDraft(value: unknown): value is {
  discovery: AICDiscoveryManifest;
  provider_name?: string;
  suggestions: Array<{ review_required?: boolean }>;
  ui: AICRuntimeUiManifest[];
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return Array.isArray(record.ui) && Array.isArray(record.suggestions) && typeof record.discovery === "object";
}

function isProjectArtifactReport(value: unknown): value is AICAuthoringInputs["project_report"] {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.framework === "string" &&
    typeof record.filesScanned === "number" &&
    Array.isArray(record.matches) &&
    Array.isArray(record.diagnostics)
  );
}

function isInitResult(value: unknown): value is AICInitResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.artifact_type === "aic_init_result" &&
    Array.isArray(record.files) &&
    typeof record.project_root === "string" &&
    typeof record.summary === "object" &&
    record.summary !== null
  );
}

function isDoctorReport(value: unknown): value is AICDoctorReport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.artifact_type === "aic_doctor_report" &&
    Array.isArray(record.findings) &&
    typeof record.project_root === "string" &&
    typeof record.summary === "object" &&
    record.summary !== null
  );
}

async function inspect(filePath: string): Promise<number> {
  const value = await readJson<unknown>(filePath);
  if (isInitResult(value)) {
    console.log("AIC init result");
    console.log(`Project root: ${value.project_root}`);
    console.log(`Framework: ${value.framework}`);
    console.log(`App: ${value.app_name}`);
    console.log(`Planned: ${value.summary.planned}`);
    console.log(`Created: ${value.summary.created}`);
    console.log(`Overwritten: ${value.summary.overwritten}`);
    console.log(`Skipped: ${value.summary.skipped}`);
    return 0;
  }

  if (isDoctorReport(value)) {
    console.log("AIC doctor report");
    console.log(`Project root: ${value.project_root}`);
    console.log(`Framework: ${value.framework ?? value.detected_framework ?? "unknown"}`);
    console.log(`Findings: ${value.summary.findings}`);
    console.log(`Errors: ${value.summary.errors}`);
    console.log(`Warnings: ${value.summary.warnings}`);
    console.log(`Files scanned: ${value.scan.files_scanned}`);
    console.log(`Matches: ${value.scan.matches}`);
    console.log(`Diagnostics: ${value.scan.diagnostics}`);
    console.log(
      `Agent onboarding: ${value.onboarding.summary.present}/${value.onboarding.summary.recommended} recommended present`
    );
    return 0;
  }

  if (isAuthoringPatchPlan(value)) {
    console.log("AIC authoring patch plan");
    console.log(`Proposals: ${value.summary.total_proposals}`);
    console.log(`Ready: ${value.summary.ready}`);
    console.log(`Apply ready: ${value.summary.apply_ready}`);
    console.log(`Blocked by JSX pattern: ${value.summary.blocked_by_jsx_pattern}`);
    console.log(`Needs source match: ${value.summary.needs_source_match}`);
    console.log(`Needs ID review: ${value.summary.needs_id_review}`);
    console.log(`Ignored: ${value.summary.ignored}`);
    console.log(`Source resolved: ${value.summary.source_resolved_proposals}`);
    console.log(`Review-only metadata: ${value.summary.review_only_metadata}`);
    console.log(`Bootstrap backed: ${value.summary.bootstrap_backed_proposals}`);
    console.log("");
    console.log(renderAICAuthoringPatchPlanSummary(value));
    return 0;
  }

  if (isAuthoringApplyResult(value)) {
    console.log("AIC authoring apply result");
    console.log(`Mode: ${value.dry_run ? "dry-run" : "write"}`);
    console.log(`Project root: ${value.project_root}`);
    console.log(`Applied: ${value.summary.applied}`);
    console.log(`Skipped: ${value.summary.skipped}`);
    console.log(`Failed: ${value.summary.failed}`);
    console.log(`Changed files: ${value.summary.changed_files}`);
    return 0;
  }

  if (isProjectArtifactReport(value)) {
    const report = value as NonNullable<AICAuthoringInputs["project_report"]>;
    console.log(`AIC project report for ${report.framework}`);
    console.log(`Files scanned: ${report.filesScanned}`);
    console.log(`Matches: ${report.matches.length}`);
    console.log(`Diagnostics: ${report.diagnostics.length}`);

    if (report.agent_onboarding) {
      console.log(
        `Agent onboarding: ${report.agent_onboarding.summary.present}/${report.agent_onboarding.summary.recommended} recommended present`
      );
      console.log(`Onboarding warnings: ${report.agent_onboarding.summary.warnings}`);
    }

    return 0;
  }

  if (isBootstrapReview(value)) {
    const draft = value.draft as { discovery?: { app?: { name?: string } } };
    const summary = value.summary;
    console.log(`Bootstrap review for ${draft.discovery?.app?.name ?? "unknown app"}`);
    console.log(`Suggestion provider: ${value.provider_name ?? "heuristic"}`);
    console.log(`Captures: ${summary.capture_count ?? 0}`);
    console.log(
      `Suggestions: ${summary.accepted_suggestions ?? 0} accepted, ${summary.filtered_suggestions ?? 0} filtered`
    );
    console.log(`Suggestions requiring review: ${summary.review_required_suggestions ?? 0}`);
    console.log(`Validation issues: ${summary.validation_issue_count ?? 0}`);
    return 0;
  }

  if (isBootstrapDraft(value)) {
    console.log(`Bootstrap draft for ${value.discovery.app.name}`);
    console.log(`Suggestion provider: ${value.provider_name ?? "heuristic"}`);
    console.log(`Suggestions: ${value.suggestions.length}`);
    console.log(
      `Suggestions requiring review: ${value.suggestions.filter((suggestion) => suggestion.review_required).length}`
    );
    return 0;
  }

  const kind = detectManifestKind(value);

  if (!kind) {
    console.error("Unable to determine manifest kind.");
    return 1;
  }

  switch (kind) {
    case "discovery": {
      const manifest = value as AICDiscoveryManifest;
      console.log(`Discovery manifest for ${manifest.app.name}`);
      console.log(`Spec: ${manifest.spec}`);
      console.log(`Endpoints: ${Object.keys(manifest.endpoints).join(", ")}`);
      return 0;
    }
    case "ui": {
      const manifest = value as AICRuntimeUiManifest;
      console.log(`Runtime UI manifest for ${manifest.view.view_id}`);
      console.log(`Elements: ${manifest.elements.length}`);
      console.log(`Page: ${manifest.page.url}`);
      return 0;
    }
    case "permissions": {
      const manifest = value as AICPermissionsManifest;
      console.log(`Permissions manifest with ${Object.keys(manifest.riskBands).length} risk band(s)`);
      return 0;
    }
    case "workflows": {
      const manifest = value as AICWorkflowManifest;
      console.log(`Workflow manifest with ${manifest.workflows.length} workflow(s)`);
      return 0;
    }
    case "actions": {
      const manifest = value as AICSemanticActionsManifest;
      console.log(`Semantic action manifest with ${manifest.actions.length} action contract(s)`);
      return 0;
    }
  }
}

async function main(): Promise<void> {
  const [command, kind, ...args] = process.argv.slice(2);
  const firstArg = args[0];
  const secondArg = args[1];
  const thirdArg = args[2];

  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (command === "scan" && kind) {
    process.exitCode = await scanPath(kind);
    return;
  }

  if (command === "init") {
    process.exitCode = await initProject([kind, ...args].filter((value): value is string => Boolean(value)));
    return;
  }

  if (command === "doctor") {
    process.exitCode = await doctorProject([kind, ...args].filter((value): value is string => Boolean(value)));
    return;
  }

  if (
    command === "validate" &&
    kind &&
    ["actions", "discovery", "permissions", "ui", "workflows"].includes(kind) &&
    firstArg
  ) {
    process.exitCode = await validate(kind as ManifestKind, firstArg);
    return;
  }

  if (command === "bootstrap") {
    process.exitCode = await bootstrap([kind, ...args].filter((value): value is string => Boolean(value)));
    return;
  }

  if (command === "generate" && kind === "discovery" && firstArg) {
    process.exitCode = await generateDiscovery(firstArg);
    return;
  }

  if (command === "generate" && kind === "ui" && firstArg) {
    process.exitCode = await generateUi(firstArg, secondArg, thirdArg);
    return;
  }

  if (command === "generate" && kind === "permissions" && firstArg) {
    process.exitCode = await generatePermissions(firstArg);
    return;
  }

  if (command === "generate" && kind === "operate" && firstArg) {
    process.exitCode = await generateOperate(firstArg);
    return;
  }

  if (command === "generate" && kind === "project" && firstArg) {
    process.exitCode = await generateProject(firstArg, args);
    return;
  }

  if (command === "generate" && kind === "authoring-plan" && firstArg) {
    process.exitCode = await generateAuthoringPlan(firstArg, args);
    return;
  }

  if (command === "apply" && kind === "authoring-plan" && firstArg) {
    process.exitCode = await applyAuthoringPlanCommand(firstArg, args);
    return;
  }

  if (
    command === "diff" &&
    kind &&
    ["actions", "discovery", "permissions", "ui", "workflows"].includes(kind) &&
    firstArg &&
    secondArg
  ) {
    process.exitCode = await diffManifests(kind as ManifestKind, firstArg, secondArg, args.slice(2));
    return;
  }

  if (command === "inspect" && kind) {
    process.exitCode = await inspect(kind);
    return;
  }

  printUsage();
  process.exitCode = 1;
}

await main();
