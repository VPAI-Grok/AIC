import { createHash } from "node:crypto";
import {
  appendFile,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertAICRelianceAllowed,
  evaluateAICReliance,
  validateAICRelianceDecision,
  type AICRelianceDecision,
  type AICRelianceReasonCode,
  type AICRelianceVerdict,
  type EvaluateAICRelianceInput
} from "@aicorg/rely";
import { isAICRfc3339DateTime, parseAICStrictJson } from "@aicorg/spec";

const MAX_JSON_BYTES = 10 * 1024 * 1024;
const MAX_PERSISTED_ALLOW_AGE_SECONDS = 5;
const FALLBACK_EVALUATION_TIME = "1970-01-01T00:00:00.000Z";
const CORE_DIGESTS = ["attestation", "contract", "observations", "policy", "proof", "trust_store"] as const;
const FILE_INPUT_NAMES = [
  "attestation-file",
  "contract-file",
  "observations-file",
  "policy-file",
  "proof-file",
  "transparency-index-file",
  "transparency-prior-index-file",
  "transparency-trust-store-file",
  "trust-store-file"
] as const;
const ALLOW_INFORMATIONAL_REASONS = new Set<AICRelianceReasonCode>([
  "requirements_satisfied",
  "evidence_freshness_not_checked",
  "transparency_external_receipt_not_checked"
]);

export class RelianceActionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RelianceActionError";
    this.code = code;
  }
}

interface ActionInputs {
  attestationFile: string;
  contractFile: string;
  decisionFile: string;
  expectedDeploymentId: string;
  expectedEnvironment: "development" | "production" | "staging" | "test";
  expectedIssuerId: string;
  expectedKeyId: string;
  expectedOperationId: string;
  expectedOrigin: string;
  expectedRevision: string;
  expectedRunnerId: string;
  minimumValiditySeconds: number;
  observationsFile: string;
  policyFile: string;
  policySha256: string;
  proofFile: string;
  transparencyIndexFile?: string;
  transparencyPriorIndexFile?: string;
  transparencyTrustStoreFile?: string;
  transparencyTrustStoreSha256?: string;
  trustStoreFile: string;
  trustStoreSha256: string;
}

interface JsonSnapshot {
  bytes: Buffer;
  path: string;
  value: unknown;
}

interface ArtifactSnapshots {
  attestation: JsonSnapshot;
  contract: JsonSnapshot;
  observations: JsonSnapshot;
  policy: JsonSnapshot;
  proof: JsonSnapshot;
  transparencyIndex?: JsonSnapshot;
  transparencyPriorIndex?: JsonSnapshot;
  transparencyTrustStore?: JsonSnapshot;
  trustStore: JsonSnapshot;
}

export interface RelianceActionResult {
  allowed: boolean;
  decision: AICRelianceDecision;
  decisionFile?: string;
  reasonCodes: AICRelianceReasonCode[];
  validUntil?: string;
  verdict: AICRelianceVerdict;
}

type ArtifactReader = (workspace: string, providedPath: string, label: string) => Promise<JsonSnapshot>;
type ActionOutputWriter = (path: string, content: string) => Promise<void>;

const appendActionOutput: ActionOutputWriter = async (path, content) => {
  await appendFile(path, content, "utf8");
};

function inputKeys(name: string): string[] {
  return [
    `INPUT_${name.replaceAll("-", "_").toUpperCase()}`,
    `INPUT_${name.toUpperCase()}`
  ];
}

function actionInput(environment: NodeJS.ProcessEnv, name: string): string | undefined {
  for (const key of inputKeys(name)) {
    const value = environment[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function requiredInput(environment: NodeJS.ProcessEnv, name: string): string {
  const value = actionInput(environment, name);
  if (!value) throw new RelianceActionError("input_missing", `Missing required action input: ${name}.`);
  return value;
}

function assertSha256(value: string, label: string): void {
  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new RelianceActionError("digest_unpinned", `${label} must be exactly 64 lowercase hexadecimal characters.`);
  }
}

function assertExpectedRevision(value: string): void {
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(value)) {
    throw new RelianceActionError(
      "revision_unpinned",
      "expected-revision must be a full 40- or 64-character lowercase hexadecimal source revision."
    );
  }
}

function assertExpectedOrigin(value: string, expectedEnvironment: ActionInputs["expectedEnvironment"]): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RelianceActionError("origin_invalid", "expected-origin must be an absolute canonical origin.");
  }
  if (url.origin !== value || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new RelianceActionError("origin_invalid", "expected-origin must contain only scheme, host, and optional port.");
  }
  const loopback = ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !(expectedEnvironment !== "production" && loopback && url.protocol === "http:")) {
    throw new RelianceActionError("origin_insecure", "expected-origin must use HTTPS, except loopback origins outside production.");
  }
}

function readMinimumValiditySeconds(environment: NodeJS.ProcessEnv): number {
  const raw = actionInput(environment, "minimum-validity-seconds") ?? "30";
  if (!/^(?:0|[1-9]\d?)$/.test(raw)) {
    throw new RelianceActionError(
      "input_minimum_validity_invalid",
      "minimum-validity-seconds must be a decimal integer from 0 through 60."
    );
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > 60) {
    throw new RelianceActionError(
      "input_minimum_validity_invalid",
      "minimum-validity-seconds must be a finite integer from 0 through 60."
    );
  }
  return value;
}

function readInputs(environment: NodeJS.ProcessEnv): ActionInputs {
  const expectedEnvironment = requiredInput(environment, "expected-environment");
  if (!["development", "production", "staging", "test"].includes(expectedEnvironment)) {
    throw new RelianceActionError("environment_invalid", "expected-environment is not an AIC deployment environment.");
  }
  const inputs: ActionInputs = {
    attestationFile: requiredInput(environment, "attestation-file"),
    contractFile: requiredInput(environment, "contract-file"),
    decisionFile: actionInput(environment, "decision-file") ?? ".aic/reliance-decision.json",
    expectedDeploymentId: requiredInput(environment, "expected-deployment-id"),
    expectedEnvironment: expectedEnvironment as ActionInputs["expectedEnvironment"],
    expectedIssuerId: requiredInput(environment, "expected-issuer-id"),
    expectedKeyId: requiredInput(environment, "expected-key-id"),
    expectedOperationId: requiredInput(environment, "expected-operation-id"),
    expectedOrigin: requiredInput(environment, "expected-origin"),
    expectedRevision: requiredInput(environment, "expected-revision"),
    expectedRunnerId: requiredInput(environment, "expected-runner-id"),
    minimumValiditySeconds: readMinimumValiditySeconds(environment),
    observationsFile: requiredInput(environment, "observations-file"),
    policyFile: requiredInput(environment, "policy-file"),
    policySha256: requiredInput(environment, "policy-sha256"),
    proofFile: requiredInput(environment, "proof-file"),
    transparencyIndexFile: actionInput(environment, "transparency-index-file"),
    transparencyPriorIndexFile: actionInput(environment, "transparency-prior-index-file"),
    transparencyTrustStoreFile: actionInput(environment, "transparency-trust-store-file"),
    transparencyTrustStoreSha256: actionInput(environment, "transparency-trust-store-sha256"),
    trustStoreFile: requiredInput(environment, "trust-store-file"),
    trustStoreSha256: requiredInput(environment, "trust-store-sha256")
  };
  assertSha256(inputs.policySha256, "policy-sha256");
  assertSha256(inputs.trustStoreSha256, "trust-store-sha256");
  assertExpectedRevision(inputs.expectedRevision);
  assertExpectedOrigin(inputs.expectedOrigin, inputs.expectedEnvironment);
  if (!/^sha256:[0-9a-f]{64}$/.test(inputs.expectedKeyId)) {
    throw new RelianceActionError("key_unpinned", "expected-key-id must be an exact sha256:<64 lowercase hex> key ID.");
  }
  const transparencyInputs = [
    inputs.transparencyIndexFile,
    inputs.transparencyTrustStoreFile,
    inputs.transparencyTrustStoreSha256
  ].filter(Boolean);
  if (transparencyInputs.length !== 0 && transparencyInputs.length !== 3) {
    throw new RelianceActionError(
      "transparency_inputs_incomplete",
      "transparency-index-file, transparency-trust-store-file, and transparency-trust-store-sha256 must be supplied together."
    );
  }
  if (inputs.transparencyPriorIndexFile && !inputs.transparencyIndexFile) {
    throw new RelianceActionError(
      "transparency_inputs_incomplete",
      "transparency-prior-index-file requires the current transparency index and pinned transparency trust store inputs."
    );
  }
  if (inputs.transparencyTrustStoreSha256) {
    assertSha256(inputs.transparencyTrustStoreSha256, "transparency-trust-store-sha256");
  }
  return inputs;
}

function insideWorkspace(workspace: string, candidate: string): boolean {
  const rel = relative(workspace, candidate);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function asWorkspaceRelative(workspace: string, path: string): string {
  return relative(workspace, path).split(sep).join("/");
}

export async function readJsonSnapshot(workspace: string, providedPath: string, label: string): Promise<JsonSnapshot> {
  const candidate = resolve(workspace, providedPath);
  if (!insideWorkspace(workspace, candidate)) {
    throw new RelianceActionError("input_path_outside_workspace", `${label} must resolve inside GITHUB_WORKSPACE.`);
  }
  const metadata = await lstat(candidate).catch(() => undefined);
  if (!metadata?.isFile() || metadata.isSymbolicLink()) {
    throw new RelianceActionError("input_file_invalid", `${label} must be a regular, non-symlink JSON file.`);
  }
  if (metadata.size > MAX_JSON_BYTES) {
    throw new RelianceActionError("input_file_too_large", `${label} exceeds the 10 MiB action limit.`);
  }
  const canonicalWorkspace = await realpath(workspace);
  const canonicalCandidate = await realpath(candidate);
  if (!insideWorkspace(canonicalWorkspace, canonicalCandidate)) {
    throw new RelianceActionError("input_path_outside_workspace", `${label} resolves outside GITHUB_WORKSPACE.`);
  }
  const bytes = await readFile(canonicalCandidate);
  let value: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    value = parseAICStrictJson(text);
  } catch {
    throw new RelianceActionError(
      "input_json_invalid",
      `${label} is not valid UTF-8 strict JSON (object member names must be unique).`
    );
  }
  return { bytes, path: canonicalCandidate, value };
}

async function resolveDecisionPath(workspace: string, providedPath: string): Promise<string> {
  if (/[\u0000-\u001f\u007f]/.test(providedPath)) {
    throw new RelianceActionError("output_path_control_character", "decision-file cannot contain control characters.");
  }
  const candidate = resolve(workspace, providedPath);
  const outputRoot = resolve(workspace, ".aic");
  if (!insideWorkspace(outputRoot, candidate)) {
    throw new RelianceActionError("output_path_outside_aic", "decision-file must be a descendant of GITHUB_WORKSPACE/.aic/.");
  }
  const outputRootMetadata = await lstat(outputRoot).catch(() => undefined);
  if (outputRootMetadata && (!outputRootMetadata.isDirectory() || outputRootMetadata.isSymbolicLink())) {
    throw new RelianceActionError("output_path_symlink", "GITHUB_WORKSPACE/.aic must be a real directory, not a symlink.");
  }
  if (!candidate.toLowerCase().endsWith(".json")) {
    throw new RelianceActionError("output_file_invalid", "decision-file must use a .json extension.");
  }
  const baseName = candidate.slice(candidate.lastIndexOf(sep) + 1).toLowerCase();
  const outputSegments = relative(outputRoot, candidate).split(sep).map((segment) => segment.toLowerCase());
  if (
    ["action.json", "package.json", "package-lock.json"].includes(baseName) ||
    outputSegments.some((segment) => [".github", "actions", "workflows"].includes(segment))
  ) {
    throw new RelianceActionError(
      "output_file_reserved",
      "decision-file cannot target an action, workflow, package manifest, or lockfile path."
    );
  }
  let cursor = dirname(candidate);
  const components: string[] = [];
  while (cursor !== outputRoot && insideWorkspace(outputRoot, cursor)) {
    components.push(cursor);
    cursor = dirname(cursor);
  }
  for (const component of components.reverse()) {
    const metadata = await lstat(component).catch(() => undefined);
    if (metadata?.isSymbolicLink()) {
      throw new RelianceActionError("output_path_symlink", "decision-file has a symlinked parent directory.");
    }
  }
  const target = await lstat(candidate).catch(() => undefined);
  if (target?.isSymbolicLink() || (target && !target.isFile())) {
    throw new RelianceActionError("output_file_invalid", "decision-file must be a regular, non-symlink file path.");
  }
  return target ? await realpath(candidate) : candidate;
}

function assertDecisionDoesNotAliasInputs(decisionPath: string, artifacts: ArtifactSnapshots): void {
  const inputPaths = [
    artifacts.attestation.path,
    artifacts.contract.path,
    artifacts.observations.path,
    artifacts.policy.path,
    artifacts.proof.path,
    artifacts.trustStore.path,
    artifacts.transparencyIndex?.path,
    artifacts.transparencyPriorIndex?.path,
    artifacts.transparencyTrustStore?.path
  ].filter((path): path is string => Boolean(path));
  if (inputPaths.some((path) => samePath(path, decisionPath))) {
    throw new RelianceActionError("output_aliases_input", "decision-file cannot alias any verifier input artifact.");
  }
}

function samePath(left: string, right: string): boolean {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

async function assertDecisionDoesNotAliasConfiguredInputs(
  workspace: string,
  decisionPath: string,
  environment: NodeJS.ProcessEnv
): Promise<void> {
  for (const name of FILE_INPUT_NAMES) {
    const providedPath = actionInput(environment, name);
    if (!providedPath) continue;
    const candidate = resolve(workspace, providedPath);
    if (samePath(candidate, decisionPath)) {
      throw new RelianceActionError("output_aliases_input", "decision-file cannot alias any verifier input artifact.");
    }
    const canonicalCandidate = await realpath(candidate).catch((error: NodeJS.ErrnoException) => {
      if (["ENOENT", "ENOTDIR"].includes(error.code ?? "")) return undefined;
      throw new RelianceActionError("input_path_uninspectable", `Unable to inspect ${name} before output invalidation.`);
    });
    if (canonicalCandidate && samePath(canonicalCandidate, decisionPath)) {
      throw new RelianceActionError("output_aliases_input", "decision-file cannot alias any verifier input artifact.");
    }
  }
}

async function invalidateDecisionPath(path: string): Promise<void> {
  await rm(path, { force: true });
  if (await lstat(path).catch(() => undefined)) {
    throw new RelianceActionError("output_invalidation_failed", "Unable to invalidate the preexisting decision-file.");
  }
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function matchingRule(ruleValue: unknown, contractValue: unknown, environment: string): boolean {
  const rule = object(ruleValue);
  const match = object(rule?.match) ?? {};
  const contract = object(contractValue);
  const action = object(contract?.action);
  const risks = strings(match.risks);
  const operations = strings(match.operation_ids);
  const environments = strings(match.environments);
  return (
    (risks.length === 0 || risks.includes(String(action?.risk))) &&
    (operations.length === 0 || operations.includes(String(action?.operation_id))) &&
    (environments.length === 0 || environments.includes(environment))
  );
}

function assertConsumerPins(inputs: ActionInputs, artifacts: ArtifactSnapshots): void {
  const policy = object(artifacts.policy.value);
  const contract = object(artifacts.contract.value);
  const contractAction = object(contract?.action);
  const attestation = object(artifacts.attestation.value);
  const statement = object(attestation?.statement);
  const subject = object(statement?.subject);
  const deployment = object(statement?.deployment);
  const issuer = object(statement?.issuer);
  const runner = object(statement?.runner);
  const signature = object(attestation?.signature);
  const trustStore = object(artifacts.trustStore.value);

  if (policy?.unmatched !== "fail" || !Array.isArray(policy.rules)) {
    throw new RelianceActionError("policy_not_fail_closed", "The consumer policy must set unmatched to fail and define rules.");
  }
  if (contractAction?.operation_id !== inputs.expectedOperationId || subject?.operation_id !== inputs.expectedOperationId) {
    throw new RelianceActionError("operation_mismatch", "The contract or attestation operation does not match expected-operation-id.");
  }
  const bindings: Array<[unknown, string, string]> = [
    [deployment?.origin, inputs.expectedOrigin, "origin_mismatch"],
    [deployment?.environment, inputs.expectedEnvironment, "environment_mismatch"],
    [deployment?.deployment_id, inputs.expectedDeploymentId, "deployment_mismatch"],
    [deployment?.source_revision, inputs.expectedRevision, "revision_mismatch"],
    [issuer?.id, inputs.expectedIssuerId, "issuer_mismatch"],
    [signature?.key_id, inputs.expectedKeyId, "key_mismatch"],
    [runner?.id, inputs.expectedRunnerId, "runner_mismatch"]
  ];
  for (const [actual, expected, code] of bindings) {
    if (actual !== expected) throw new RelianceActionError(code, `${code.replace("_mismatch", "")} does not match the explicit expectation.`);
  }

  const rules = policy.rules.filter((rule) => matchingRule(rule, contract, inputs.expectedEnvironment));
  if (rules.length === 0) {
    throw new RelianceActionError("policy_rule_unmatched", "No consumer policy rule matches the expected operation and environment.");
  }
  const identityPinned = rules.some((ruleValue) => {
    const rule = object(ruleValue);
    const requirement = object(object(rule?.require)?.attestation);
    return (
      requirement?.required === true &&
      requirement?.require_expected_origin === true &&
      requirement?.require_expected_revision === true &&
      strings(requirement?.allowed_issuer_ids).includes(inputs.expectedIssuerId) &&
      strings(requirement?.allowed_key_ids).includes(inputs.expectedKeyId) &&
      strings(requirement?.allowed_runner_ids).includes(inputs.expectedRunnerId)
    );
  });
  if (!identityPinned) {
    throw new RelianceActionError(
      "policy_identity_pins_missing",
      "A matching policy rule must require attestation, expected origin/revision, and the explicit issuer, key, and runner IDs."
    );
  }

  if (inputs.expectedEnvironment === "production") {
    const requirements = rules.map((ruleValue) => object(ruleValue)?.require).filter(Boolean).map((value) => object(value));
    const attestationRequirements = requirements
      .map((requirement) => object(requirement?.attestation))
      .filter((requirement): requirement is Record<string, unknown> => Boolean(requirement));
    const hasPositiveBound = (value: unknown): boolean =>
      typeof value === "number" && Number.isInteger(value) && value > 0;
    const productionFreshnessPinned =
      attestationRequirements.some(
        (requirement) =>
          requirement.required === true &&
          requirement.require_expiry === true &&
          hasPositiveBound(requirement.maximum_age_seconds) &&
          hasPositiveBound(requirement.maximum_validity_seconds)
      ) &&
      requirements.some((requirement) => hasPositiveBound(requirement?.maximum_proof_age_seconds)) &&
      requirements.some(
        (requirement) =>
          requirement?.observations_required === true &&
          hasPositiveBound(requirement.maximum_observation_age_seconds)
      );
    if (!productionFreshnessPinned) {
      throw new RelianceActionError(
        "policy_freshness_pins_missing",
        "Production policy must bound proof, observation, attestation age and validity, and require attestation expiry."
      );
    }
    const transparencyRequirements = requirements
      .map((requirement) => object(requirement?.transparency))
      .filter(
        (requirement): requirement is Record<string, unknown> =>
          Boolean(requirement) && requirement?.required === true
      );
    const transparencyIdentityUnpinned = transparencyRequirements.some(
      (requirement) =>
        strings(requirement.allowed_log_ids).length === 0 ||
        strings(requirement.allowed_key_ids).length === 0
    );
    if (transparencyIdentityUnpinned) {
      throw new RelianceActionError(
        "policy_transparency_pins_missing",
        "Every matching production rule that requires transparency must pin non-empty allowed log and signer-key IDs."
      );
    }
  }

  const trustedKey = Array.isArray(trustStore?.keys) && trustStore.keys.some((keyValue) => {
    const key = object(keyValue);
    return (
      key?.key_id === inputs.expectedKeyId &&
      key?.issuer_id === inputs.expectedIssuerId &&
      key?.status === "active" &&
      strings(key?.allowed_origins).includes(inputs.expectedOrigin)
    );
  });
  if (!trustedKey) {
    throw new RelianceActionError("trust_store_pin_missing", "The trust store lacks the expected active issuer/key/origin pin.");
  }
}

function canonicalFailure(error: unknown): { reason: AICRelianceReasonCode; verdict: "deny" | "indeterminate" } {
  const code = error instanceof RelianceActionError ? error.code : "action_error";
  const message = error instanceof Error ? error.message : String(error);
  if (["origin_invalid", "origin_insecure"].includes(code) || (code === "input_missing" && message.includes("expected-origin"))) {
    return { reason: "request_origin_invalid", verdict: "indeterminate" };
  }
  if (code === "input_missing" && message.includes("expected-operation-id")) {
    return { reason: "request_operation_id_invalid", verdict: "indeterminate" };
  }
  if (code === "environment_invalid" || (code === "input_missing" && message.includes("expected-environment"))) {
    return { reason: "request_environment_invalid", verdict: "indeterminate" };
  }
  if (code === "input_missing" && message.includes("expected-deployment-id")) {
    return { reason: "request_deployment_id_invalid", verdict: "indeterminate" };
  }
  if (code === "revision_unpinned" || (code === "input_missing" && message.includes("expected-revision"))) {
    return { reason: "request_revision_invalid", verdict: "indeterminate" };
  }
  if (code === "operation_mismatch") return { reason: "binding_operation_mismatch", verdict: "deny" };
  if (code === "origin_mismatch") return { reason: "binding_origin_mismatch", verdict: "deny" };
  if (["environment_mismatch", "deployment_mismatch"].includes(code)) return { reason: "binding_deployment_mismatch", verdict: "deny" };
  if (code === "revision_mismatch") return { reason: "binding_revision_mismatch", verdict: "deny" };
  if (["trust_store_digest_mismatch", "trust_store_pin_missing", "issuer_mismatch", "key_mismatch", "runner_mismatch"].includes(code)) {
    return { reason: "trust_untrusted", verdict: "deny" };
  }
  if (code === "transparency_trust_store_digest_mismatch") return { reason: "transparency_untrusted", verdict: "deny" };
  if (code === "policy_not_fail_closed") return { reason: "policy_not_fail_closed", verdict: "deny" };
  if (code === "policy_rule_unmatched") return { reason: "policy_rule_unmatched", verdict: "deny" };
  if (["policy_freshness_pins_missing", "policy_identity_pins_missing", "policy_transparency_pins_missing"].includes(code)) {
    return { reason: "policy_failed", verdict: "deny" };
  }
  if (code.startsWith("input_") || code.startsWith("output_") || ["digest_unpinned", "key_unpinned", "policy_digest_mismatch"].includes(code)) {
    return { reason: "artifacts_invalid", verdict: "indeterminate" };
  }
  return { reason: "policy_indeterminate", verdict: "indeterminate" };
}

function fallbackRequest(environment: NodeJS.ProcessEnv, inputs: ActionInputs | undefined): AICRelianceDecision["request"] {
  const environmentValue = inputs?.expectedEnvironment ?? actionInput(environment, "expected-environment");
  return {
    expected_deployment_id: inputs?.expectedDeploymentId ?? actionInput(environment, "expected-deployment-id") ?? "unavailable",
    expected_revision: inputs?.expectedRevision ?? actionInput(environment, "expected-revision") ?? "unavailable",
    operation_id: inputs?.expectedOperationId ?? actionInput(environment, "expected-operation-id") ?? "unavailable",
    origin: inputs?.expectedOrigin ?? actionInput(environment, "expected-origin") ?? "unavailable",
    ...(["development", "production", "staging", "test"].includes(String(environmentValue))
      ? { environment: environmentValue as ActionInputs["expectedEnvironment"] }
      : {})
  };
}

function fallbackDecision(
  environment: NodeJS.ProcessEnv,
  inputs: ActionInputs | undefined,
  error: unknown,
  evaluatedAt: string
): AICRelianceDecision {
  const failure = canonicalFailure(error);
  const checks: AICRelianceDecision["checks"] = {
    artifacts: "not_checked",
    policy: "not_checked",
    request_binding: "not_checked",
    transparency: "not_checked",
    trust: "not_checked"
  };
  if (failure.reason.startsWith("request_") || failure.reason.startsWith("binding_")) checks.request_binding = "failed";
  if (failure.reason === "artifacts_invalid") checks.artifacts = "failed";
  if (["trust_invalid", "trust_untrusted"].includes(failure.reason)) checks.trust = "failed";
  if (["policy_failed", "policy_not_fail_closed", "policy_rule_unmatched"].includes(failure.reason)) checks.policy = "failed";
  if (failure.reason.startsWith("transparency_")) checks.transparency = "failed";
  const decision: AICRelianceDecision = {
    artifact_digests: {},
    artifact_type: "aic_reliance_decision",
    checks,
    evaluated_at: evaluatedAt,
    evidence_freshness: { status: checks.artifacts === "failed" ? "invalid" : "not_checked" },
    reason_codes: [failure.reason],
    request: fallbackRequest(environment, inputs),
    spec: "aic.reliance/0.1",
    verdict: failure.verdict
  };
  const validation = validateAICRelianceDecision(decision);
  if (!validation.ok) {
    throw new Error(`Generated fallback reliance decision is invalid: ${validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }
  return validation.value;
}

function trustedEvaluationTime(clock: () => Date | string): string {
  const value = clock();
  if (!(value instanceof Date) && !isAICRfc3339DateTime(value)) {
    throw new RelianceActionError("clock_invalid", "The trusted action clock must return an RFC 3339 date-time.");
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new RelianceActionError("clock_invalid", "The trusted action clock returned an invalid date-time.");
  }
  return parsed.toISOString();
}

function relianceInput(
  inputs: ActionInputs,
  artifacts: ArtifactSnapshots,
  evaluatedAt?: string
): EvaluateAICRelianceInput {
  return {
    attestation: artifacts.attestation.value,
    contract: artifacts.contract.value,
    environment: inputs.expectedEnvironment,
    ...(evaluatedAt === undefined ? {} : { evaluated_at: evaluatedAt }),
    expected_deployment_id: inputs.expectedDeploymentId,
    expected_revision: inputs.expectedRevision,
    observations: artifacts.observations.value,
    operation_id: inputs.expectedOperationId,
    origin: inputs.expectedOrigin,
    policy: artifacts.policy.value,
    proof: artifacts.proof.value,
    ...(artifacts.transparencyIndex && artifacts.transparencyTrustStore
      ? {
          transparency: {
            index: artifacts.transparencyIndex.value,
            ...(artifacts.transparencyPriorIndex
              ? { prior_index: artifacts.transparencyPriorIndex.value }
              : {}),
            trust_store: artifacts.transparencyTrustStore.value
          }
        }
      : {}),
    trust_store: artifacts.trustStore.value
  };
}

function evaluateSnapshots(
  inputs: ActionInputs,
  artifacts: ArtifactSnapshots,
  evaluatedAt: string
): AICRelianceDecision {
  return evaluateAICReliance(relianceInput(inputs, artifacts, evaluatedAt));
}

function hasMinimumResidualValidity(
  decision: AICRelianceDecision,
  at: string,
  minimumValiditySeconds: number
): boolean {
  if (!decision.valid_until) return false;
  return Date.parse(decision.valid_until) - Date.parse(at) >= minimumValiditySeconds * 1000;
}

function hasFinalTemporalValidity(
  decision: AICRelianceDecision,
  at: string,
  minimumValiditySeconds: number
): boolean {
  const now = Date.parse(at);
  const evaluatedAt = Date.parse(decision.evaluated_at);
  const validUntil = decision.valid_until ? Date.parse(decision.valid_until) : Number.NaN;
  const attestationExpiry = decision.evidence_freshness.attestation_expires_at === undefined
    ? undefined
    : Date.parse(decision.evidence_freshness.attestation_expires_at);
  return (
    Number.isFinite(now) &&
    Number.isFinite(evaluatedAt) &&
    Number.isFinite(validUntil) &&
    now >= evaluatedAt &&
    now - evaluatedAt <= MAX_PERSISTED_ALLOW_AGE_SECONDS * 1000 &&
    now < validUntil &&
    validUntil - now >= minimumValiditySeconds * 1000 &&
    (attestationExpiry === undefined || (Number.isFinite(attestationExpiry) && now < attestationExpiry))
  );
}

function safeAllow(decision: AICRelianceDecision, inputs: ActionInputs, evaluatedAt: string): boolean {
  const validation = validateAICRelianceDecision(decision);
  if (!validation.ok || decision.verdict !== "allow" || decision.evaluated_at !== evaluatedAt) return false;
  if (
    decision.request.origin !== inputs.expectedOrigin ||
    decision.request.operation_id !== inputs.expectedOperationId ||
    decision.request.expected_deployment_id !== inputs.expectedDeploymentId ||
    decision.request.expected_revision !== inputs.expectedRevision ||
    decision.request.environment !== inputs.expectedEnvironment
  ) return false;
  if (!CORE_DIGESTS.every((field) => /^sha256:[0-9a-f]{64}$/.test(decision.artifact_digests[field] ?? ""))) return false;
  if (!["artifacts", "policy", "request_binding", "trust"].every((field) => decision.checks[field as keyof typeof decision.checks] === "passed")) return false;
  if (decision.checks.transparency === "failed") return false;
  if (!decision.policy_evaluation || decision.policy_evaluation.decision !== "passed") return false;
  if (
    inputs.expectedEnvironment === "production"
      ? decision.evidence_freshness.status !== "fresh"
      : !["fresh", "not_checked"].includes(decision.evidence_freshness.status)
  ) return false;
  return (
    decision.reason_codes.includes("requirements_satisfied") &&
    decision.reason_codes.every((reason) => ALLOW_INFORMATIONAL_REASONS.has(reason))
  );
}

async function writeDecision(path: string, decision: AICRelianceDecision): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(decision, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600
    });
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

function nonAuthorizingOutputBlock(result: RelianceActionResult): string {
  return [
    `verdict=${result.verdict}`,
    `decision-file=${result.decisionFile ?? ""}`,
    `valid-until=${result.validUntil ?? ""}`,
    `reason-codes=${JSON.stringify(result.reasonCodes)}`,
    ""
  ].join("\n");
}

async function emitOutputs(
  environment: NodeJS.ProcessEnv,
  result: RelianceActionResult,
  writeActionOutputs: ActionOutputWriter
): Promise<void> {
  if (environment.GITHUB_OUTPUT) {
    await writeActionOutputs(environment.GITHUB_OUTPUT, nonAuthorizingOutputBlock(result));
  }
  if (environment.GITHUB_STEP_SUMMARY) {
    const summary = result.allowed ? "ALLOW CANDIDATE (final publication check pending)" : "BLOCKED (fail closed)";
    try {
      await appendFile(
        environment.GITHUB_STEP_SUMMARY,
        `### AIC reliance: ${summary}\n\n- Verdict: \`${result.verdict}\`\n- Reasons: \`${result.reasonCodes.join(", ")}\`\n- Decision: \`${result.decisionFile ?? "not written"}\`\n- Valid until: \`${result.validUntil ?? "not applicable"}\`\n`,
        "utf8"
      );
    } catch (error) {
      // A human-readable summary is optional. Once canonical outputs are emitted,
      // a summary failure must not turn a successfully finalized gate into a failed step.
      console.error(`Unable to write optional AIC step summary: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (environment.GITHUB_OUTPUT) {
    // Authorization is the final publication write. No optional I/O follows it.
    await writeActionOutputs(environment.GITHUB_OUTPUT, `allowed=${result.allowed}\n`);
  }
}

async function emitFailClosedOverride(
  environment: NodeJS.ProcessEnv,
  result: RelianceActionResult,
  writeActionOutputs: ActionOutputWriter
): Promise<void> {
  if (!environment.GITHUB_OUTPUT) return;
  try {
    await writeActionOutputs(
      environment.GITHUB_OUTPUT,
      `${nonAuthorizingOutputBlock(result)}allowed=false\n`
    );
  } finally {
    // GitHub Actions resolves repeated output names to the final value. Repeat
    // false last so either successful override write leaves a fail-closed value.
    await writeActionOutputs(environment.GITHUB_OUTPUT, "allowed=false\n");
  }
}

async function loadSnapshots(workspace: string, inputs: ActionInputs, reader: ArtifactReader): Promise<ArtifactSnapshots> {
  const [policy, contract, proof, observations, attestation, trustStore] = await Promise.all([
    reader(workspace, inputs.policyFile, "policy-file"),
    reader(workspace, inputs.contractFile, "contract-file"),
    reader(workspace, inputs.proofFile, "proof-file"),
    reader(workspace, inputs.observationsFile, "observations-file"),
    reader(workspace, inputs.attestationFile, "attestation-file"),
    reader(workspace, inputs.trustStoreFile, "trust-store-file")
  ]);
  const transparencyIndex = inputs.transparencyIndexFile
    ? await reader(workspace, inputs.transparencyIndexFile, "transparency-index-file")
    : undefined;
  const transparencyPriorIndex = inputs.transparencyPriorIndexFile
    ? await reader(workspace, inputs.transparencyPriorIndexFile, "transparency-prior-index-file")
    : undefined;
  const transparencyTrustStore = inputs.transparencyTrustStoreFile
    ? await reader(workspace, inputs.transparencyTrustStoreFile, "transparency-trust-store-file")
    : undefined;
  return {
    attestation,
    contract,
    observations,
    policy,
    proof,
    transparencyIndex,
    transparencyPriorIndex,
    transparencyTrustStore,
    trustStore
  };
}

export async function runRelianceAction({
  environment = process.env,
  clock = () => new Date(),
  readArtifact = readJsonSnapshot,
  writeActionOutputs = appendActionOutput,
  writeDecisionFile = writeDecision
}: {
  environment?: NodeJS.ProcessEnv;
  clock?: () => Date | string;
  readArtifact?: ArtifactReader;
  writeActionOutputs?: ActionOutputWriter;
  writeDecisionFile?: typeof writeDecision;
} = {}): Promise<RelianceActionResult> {
  const workspace = resolve(environment.GITHUB_WORKSPACE || process.cwd());
  // Do not consult the injected clock until the approved output path has been
  // invalidated; even a broken clock must not leave a prior allow artifact behind.
  let evaluatedAt = FALLBACK_EVALUATION_TIME;
  let inputs: ActionInputs | undefined;
  let decisionPath = resolve(workspace, ".aic/reliance-decision.json");
  let decisionTargetApproved = false;
  let decisionPathInvalidated = false;
  let verifiedArtifacts: ArtifactSnapshots | undefined;
  let result: RelianceActionResult;

  try {
    decisionPath = await resolveDecisionPath(
      workspace,
      actionInput(environment, "decision-file") ?? ".aic/reliance-decision.json"
    );
    await assertDecisionDoesNotAliasConfiguredInputs(workspace, decisionPath, environment);
    decisionTargetApproved = true;
    await invalidateDecisionPath(decisionPath);
    decisionPathInvalidated = true;

    inputs = readInputs(environment);
    const artifacts = await loadSnapshots(workspace, inputs, readArtifact);
    assertDecisionDoesNotAliasInputs(decisionPath, artifacts);
    if (sha256(artifacts.policy.bytes) !== inputs.policySha256) {
      throw new RelianceActionError("policy_digest_mismatch", "policy-file does not match policy-sha256.");
    }
    if (sha256(artifacts.trustStore.bytes) !== inputs.trustStoreSha256) {
      throw new RelianceActionError("trust_store_digest_mismatch", "trust-store-file does not match trust-store-sha256.");
    }
    if (
      artifacts.transparencyTrustStore &&
      sha256(artifacts.transparencyTrustStore.bytes) !== inputs.transparencyTrustStoreSha256
    ) {
      throw new RelianceActionError(
        "transparency_trust_store_digest_mismatch",
        "transparency-trust-store-file does not match transparency-trust-store-sha256."
      );
    }
    assertConsumerPins(inputs, artifacts);
    verifiedArtifacts = artifacts;

    // From this point through evaluation, only the immutable in-memory snapshots above are used.
    // No workspace path is reopened after its pin and binding checks.
    evaluatedAt = trustedEvaluationTime(clock);
    let candidate = evaluateSnapshots(inputs, artifacts, evaluatedAt);
    const currentAt = trustedEvaluationTime(clock);
    if (currentAt !== evaluatedAt) {
      evaluatedAt = currentAt;
      candidate = evaluateSnapshots(inputs, artifacts, evaluatedAt);
    }
    const guardAt = trustedEvaluationTime(clock);
    if (guardAt !== evaluatedAt) {
      evaluatedAt = guardAt;
      candidate = evaluateSnapshots(inputs, artifacts, evaluatedAt);
    }
    const validation = validateAICRelianceDecision(candidate);
    if (!validation.ok) {
      throw new RelianceActionError("decision_invalid", "The bundled verifier produced a non-canonical reliance decision.");
    }
    let allowed = safeAllow(validation.value, inputs, evaluatedAt);
    if (allowed) {
      try {
        assertAICRelianceAllowed(validation.value, {
          clock: () => evaluatedAt,
          input: relianceInput(inputs, artifacts),
          max_decision_age_seconds: 0,
          max_future_skew_seconds: 0
        });
      } catch {
        allowed = false;
      }
    }
    const decision = allowed || validation.value.verdict !== "allow"
      ? validation.value
      : fallbackDecision(environment, inputs, new RelianceActionError("decision_invalid", "Unsafe allow decision."), evaluatedAt);
    result = {
      allowed,
      decision,
      reasonCodes: decision.reason_codes,
      verdict: decision.verdict
    };
  } catch (error) {
    const code = error instanceof RelianceActionError ? error.code : "action_error";
    console.error(`AIC reliance blocked [${code}]: ${error instanceof Error ? error.message : String(error)}`);
    const decision = fallbackDecision(environment, inputs, error, evaluatedAt);
    result = {
      allowed: false,
      decision,
      reasonCodes: decision.reason_codes,
      verdict: decision.verdict
    };
  }

  if (decisionTargetApproved) {
    try {
      if (!decisionPathInvalidated) {
        await invalidateDecisionPath(decisionPath);
        decisionPathInvalidated = true;
      }
      await writeDecisionFile(decisionPath, result.decision);
      if (result.allowed) {
        if (!inputs || !verifiedArtifacts) {
          throw new RelianceActionError(
            "decision_invalid",
            "An allow cannot be finalized without immutable consumer artifact bindings."
          );
        }
        const postWriteAt = trustedEvaluationTime(clock);
        let currentValidation: ReturnType<typeof validateAICRelianceDecision> | undefined;
        try {
          currentValidation = validateAICRelianceDecision(
            evaluateSnapshots(inputs, verifiedArtifacts, postWriteAt)
          );
        } catch {
          currentValidation = undefined;
        }
        const finalAt = trustedEvaluationTime(clock);
        evaluatedAt = finalAt;
        let finalValidation: ReturnType<typeof validateAICRelianceDecision> | undefined;
        try {
          finalValidation = validateAICRelianceDecision(
            evaluateSnapshots(inputs, verifiedArtifacts, finalAt)
          );
        } catch {
          finalValidation = undefined;
        }
        const assertionOptions = {
          clock: () => finalAt,
          input: relianceInput(inputs, verifiedArtifacts),
          max_decision_age_seconds: MAX_PERSISTED_ALLOW_AGE_SECONDS,
          max_future_skew_seconds: 0
        } as const;
        let persistedAllowIsCurrent = safeAllow(result.decision, inputs, result.decision.evaluated_at);
        let reevaluatedAllowIsCurrent =
          currentValidation?.ok === true && safeAllow(currentValidation.value, inputs, postWriteAt);
        let finalAllowIsCurrent =
          finalValidation?.ok === true && safeAllow(finalValidation.value, inputs, finalAt);
        try {
          if (
            !persistedAllowIsCurrent ||
            !hasMinimumResidualValidity(result.decision, finalAt, inputs.minimumValiditySeconds)
          ) {
            throw new Error("The persisted decision is not a safe allow with sufficient residual validity.");
          }
          assertAICRelianceAllowed(result.decision, assertionOptions);
        } catch {
          persistedAllowIsCurrent = false;
        }
        try {
          if (!reevaluatedAllowIsCurrent || !currentValidation?.ok) {
            throw new Error("The post-write decision is not a safe allow.");
          }
          assertAICRelianceAllowed(currentValidation.value, assertionOptions);
        } catch {
          reevaluatedAllowIsCurrent = false;
        }
        try {
          if (!finalAllowIsCurrent || !finalValidation?.ok) {
            throw new Error("The final-time decision is not a safe allow.");
          }
          assertAICRelianceAllowed(finalValidation.value, {
            ...assertionOptions,
            max_decision_age_seconds: 0
          });
        } catch {
          finalAllowIsCurrent = false;
        }

        if (!persistedAllowIsCurrent || !reevaluatedAllowIsCurrent || !finalAllowIsCurrent) {
          await invalidateDecisionPath(decisionPath);
          const currentDecision =
            finalValidation?.ok && finalValidation.value.verdict !== "allow"
              ? finalValidation.value
              : currentValidation?.ok && currentValidation.value.verdict !== "allow"
                ? currentValidation.value
              : fallbackDecision(
                  environment,
                  inputs,
                  new RelianceActionError(
                    "decision_not_current",
                    "The persisted allow was not current at the final trusted clock sample."
                  ),
                  evaluatedAt
                );
          result = {
            allowed: false,
            decision: currentDecision,
            reasonCodes: currentDecision.reason_codes,
            verdict: currentDecision.verdict
          };
          await writeDecisionFile(decisionPath, result.decision);
        }
      }
      result.decisionFile = asWorkspaceRelative(workspace, decisionPath);
      result.validUntil = result.allowed ? result.decision.valid_until : undefined;
    } catch (error) {
      console.error(`Unable to write AIC reliance decision: ${error instanceof Error ? error.message : String(error)}`);
      await invalidateDecisionPath(decisionPath).catch((invalidationError) => {
        console.error(
          `Unable to invalidate failed AIC reliance output: ${
            invalidationError instanceof Error ? invalidationError.message : String(invalidationError)
          }`
        );
      });
      result.decision = fallbackDecision(
        environment,
        inputs,
        new RelianceActionError("decision_write_failed", "Unable to write the canonical reliance decision."),
        evaluatedAt
      );
      result.allowed = false;
      result.verdict = result.decision.verdict;
      result.reasonCodes = result.decision.reason_codes;
      result.decisionFile = undefined;
    }
  }
  try {
    await emitOutputs(environment, result, writeActionOutputs);
    if (result.allowed) {
      let publicationIsCurrent = Boolean(inputs && verifiedArtifacts);
      try {
        if (!inputs || !verifiedArtifacts) {
          throw new Error("Publication lacks immutable consumer reliance inputs.");
        }
        const authorizedDecision = assertAICRelianceAllowed(result.decision, {
          // The shared assertion snapshots and fully reproduces the decision
          // before sampling this live clock. Do not freeze time before that
          // potentially expensive work.
          clock,
          input: relianceInput(inputs, verifiedArtifacts),
          max_decision_age_seconds: MAX_PERSISTED_ALLOW_AGE_SECONDS,
          max_future_skew_seconds: 0,
          minimum_validity_seconds: inputs.minimumValiditySeconds
        });
        // One last cheap trusted sample closes the boundary between the
        // assertion's post-reproduction sample and return. No hashing, crypto,
        // optional I/O, or awaited work may follow this check on success.
        const finalAuthorizationAt = trustedEvaluationTime(clock);
        evaluatedAt = finalAuthorizationAt;
        if (!hasFinalTemporalValidity(authorizedDecision, finalAuthorizationAt, inputs.minimumValiditySeconds)) {
          throw new Error("Publication is outside the final age, expiry, or residual-validity window.");
        }
      } catch (error) {
        publicationIsCurrent = false;
        console.error(
          `AIC allow became non-current during output publication: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      if (!publicationIsCurrent) {
        if (decisionTargetApproved) {
          await invalidateDecisionPath(decisionPath).catch((invalidationError) => {
            console.error(
              `Unable to invalidate non-current published AIC allow: ${
                invalidationError instanceof Error ? invalidationError.message : String(invalidationError)
              }`
            );
          });
        }
        const decision = fallbackDecision(
          environment,
          inputs,
          new RelianceActionError(
            "decision_not_current",
            "The allow was no longer current after output publication."
          ),
          evaluatedAt
        );
        result = {
          allowed: false,
          decision,
          reasonCodes: decision.reason_codes,
          verdict: decision.verdict
        };
        await emitFailClosedOverride(environment, result, writeActionOutputs).catch((overrideError) => {
          console.error(
            `Unable to append fail-closed AIC output overrides: ${
              overrideError instanceof Error ? overrideError.message : String(overrideError)
            }`
          );
        });
      }
    }
  } catch (error) {
    console.error(`Unable to emit canonical AIC action outputs: ${error instanceof Error ? error.message : String(error)}`);
    if (result.allowed && decisionTargetApproved) {
      await invalidateDecisionPath(decisionPath).catch((invalidationError) => {
        console.error(
          `Unable to invalidate AIC allow after output emission failure: ${
            invalidationError instanceof Error ? invalidationError.message : String(invalidationError)
          }`
        );
      });
    }
    const decision = fallbackDecision(
      environment,
      inputs,
      new RelianceActionError("output_emit_failed", "Unable to emit the canonical action outputs."),
      evaluatedAt
    );
    result = {
      allowed: false,
      decision,
      reasonCodes: decision.reason_codes,
      verdict: decision.verdict
    };
    await emitFailClosedOverride(environment, result, writeActionOutputs).catch((overrideError) => {
      console.error(
        `Unable to append fail-closed AIC output overrides: ${
          overrideError instanceof Error ? overrideError.message : String(overrideError)
        }`
      );
    });
  }
  return result;
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isEntrypoint) {
  const result = await runRelianceAction();
  if (!result.allowed) process.exitCode = 1;
}
