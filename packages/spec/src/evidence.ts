import {
  type AICBehaviorConfirmationResult,
  type AICBehaviorContract,
  type AICBehaviorObservationSet,
  type AICBehaviorResultStatus,
  validateAICBehaviorContract,
  validateAICBehaviorObservationSet
} from "./behavior.js";
import type {
  AICValidationIssue,
  AICValidationSeverity,
  JsonValue,
  ValidationResult
} from "./types.js";

export const AIC_EVIDENCE_SPEC = "aic.evidence/0.1";
export const AIC_REMOTE_SPEC = "aic.remote/0.1";
export const AIC_DEPLOYMENT_IDENTITY_SPEC = "aic.deployment/0.1";

export const AIC_EVIDENCE_PREDICATE_OPERATORS = [
  "absent",
  "equals",
  "exists",
  "falsy",
  "greater_than",
  "less_than",
  "not_equals",
  "truthy"
] as const;

export type AICEvidencePredicateOperator =
  (typeof AIC_EVIDENCE_PREDICATE_OPERATORS)[number];

export interface AICEvidenceContractReference {
  digest: string;
  id: string;
}

export interface AICEvidenceValueExpression {
  literal?: JsonValue;
  pointer?: string;
  source?: string;
}

export interface AICEvidencePredicate extends AICEvidenceValueExpression {
  operator: AICEvidencePredicateOperator;
  value?: JsonValue;
}

export interface AICEvidenceCheckProjection {
  actual?: AICEvidenceValueExpression;
  observed_when: AICEvidencePredicate;
  requirement_id: string;
}

export interface AICEvidenceObservationProjection {
  checks: AICEvidenceCheckProjection[];
  confirmation?: AICEvidenceValueExpression;
  error_code?: AICEvidenceValueExpression;
  outcome?: AICEvidenceValueExpression;
  status: AICEvidenceValueExpression;
}

export interface AICEvidenceHeaderSecretReference {
  secret_ref: string;
}

export type AICEvidenceHeaderValue = string | AICEvidenceHeaderSecretReference;

export interface AICHttpEvidenceRequest {
  body?: JsonValue;
  headers?: Record<string, AICEvidenceHeaderValue>;
  method?: "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT";
  path?: string;
  query?: Record<string, string | string[]>;
}

export interface AICHttpEvidenceProbe {
  id: string;
  phase: "after" | "before";
  request: AICHttpEvidenceRequest;
}

export interface AICHttpEvidenceScenarioPlan {
  mutates: boolean;
  probes?: AICHttpEvidenceProbe[];
  projection: AICEvidenceObservationProjection;
  request: AICHttpEvidenceRequest;
  scenario_id: string;
}

export interface AICOpenAPIEvidenceConfiguration {
  document: JsonValue;
  operation_id: string;
}

export interface AICHttpEvidenceSurfacePlan {
  adapter: "@aicorg/evidence-http";
  capture_response_body?: boolean;
  max_response_bytes?: number;
  openapi?: AICOpenAPIEvidenceConfiguration;
  scenarios: AICHttpEvidenceScenarioPlan[];
  surface_id: string;
  timeout_ms?: number;
}

export interface AICMcpEvidenceToolCall {
  arguments: Record<string, JsonValue>;
  tool_name: string;
}

export interface AICMcpEvidenceProbe extends AICMcpEvidenceToolCall {
  id: string;
  phase: "after" | "before";
}

export interface AICMcpEvidenceScenarioPlan extends AICMcpEvidenceToolCall {
  mutates: boolean;
  probes?: AICMcpEvidenceProbe[];
  projection: AICEvidenceObservationProjection;
  scenario_id: string;
}

export interface AICMcpEvidenceSurfacePlan {
  adapter: "@aicorg/evidence-mcp";
  endpoint: string;
  headers?: Record<string, AICEvidenceHeaderValue>;
  max_response_bytes?: number;
  scenarios: AICMcpEvidenceScenarioPlan[];
  surface_id: string;
  timeout_ms?: number;
}

export type AICEvidenceSurfacePlan =
  | AICHttpEvidenceSurfacePlan
  | AICMcpEvidenceSurfacePlan;

export interface AICEvidencePlan {
  artifact_type: "aic_evidence_plan";
  contract: AICEvidenceContractReference;
  id: string;
  spec: typeof AIC_EVIDENCE_SPEC;
  surfaces: AICEvidenceSurfacePlan[];
}

export interface AICEvidenceArtifact {
  content: JsonValue;
  digest: string;
  kind: "log" | "receipt" | "trace" | "other";
  media_type: "application/json";
  ref: string;
}

export interface AICEvidenceAdapterMetadata {
  id: string;
  protocol_version: string;
  version: string;
}

export interface AICEvidenceAdapterCollection {
  adapter: AICEvidenceAdapterMetadata;
  artifacts: AICEvidenceArtifact[];
  observations: AICBehaviorObservationSet;
  request_count: number;
}

export interface AICDeploymentIdentity {
  artifact_digest?: string;
  artifact_type: "aic_deployment_identity";
  deployed_at: string;
  deployment_id: string;
  environment: "development" | "production" | "staging" | "test";
  origin: string;
  source_repository?: string;
  source_revision: string;
  spec: typeof AIC_DEPLOYMENT_IDENTITY_SPEC;
}

export interface AICRemoteObservationPolicy {
  adapter_allowlist: string[];
  allow_destructive?: boolean;
  allow_mutations?: {
    canary_scope: string;
    operation_ids: string[];
  };
  max_identity_age_seconds?: number;
  max_response_bytes: number;
  max_run_ms: number;
  operation_allowlist: string[];
  public_network_only: true;
  require_https: true;
}

export interface AICRemoteObservationJob {
  artifact_type: "aic_remote_observation_job";
  contract: AICBehaviorContract;
  id: string;
  plan: AICEvidencePlan;
  policy: AICRemoteObservationPolicy;
  spec: typeof AIC_REMOTE_SPEC;
  target: {
    environment: "production";
    expected_deployment_id: string;
    expected_source_revision: string;
    identity_path: string;
    origin: string;
  };
}

export interface AICRemoteRunnerIdentity {
  id: string;
  software_name: string;
  software_revision: string;
  software_version: string;
}

export interface AICEvidenceReceipt {
  adapters: AICEvidenceAdapterMetadata[];
  artifact_type: "aic_evidence_receipt";
  completed_at: string;
  contract: AICEvidenceContractReference;
  deployment_identity_digest: string;
  evidence_manifest_digest: string;
  job_id: string;
  observations_digest: string;
  plan_digest: string;
  request_count: number;
  runner: AICRemoteRunnerIdentity;
  spec: typeof AIC_EVIDENCE_SPEC;
  started_at: string;
  target: {
    deployment_id: string;
    environment: "production";
    origin: string;
    source_revision: string;
  };
}

export interface AICProtectedSignature {
  algorithm: "ed25519";
  key_id: string;
  value: string;
}

export interface AICEvidenceBundle {
  artifact_type: "aic_evidence_bundle";
  artifacts: AICEvidenceArtifact[];
  contract: AICBehaviorContract;
  deployment_identity: AICDeploymentIdentity;
  generated_at: string;
  observations: AICBehaviorObservationSet;
  plan: AICEvidencePlan;
  receipt: AICEvidenceReceipt;
  receipt_digest: string;
  receipt_signature?: AICProtectedSignature;
  spec: typeof AIC_EVIDENCE_SPEC;
  status: "completed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || ["boolean", "number", "string"].includes(typeof value)) {
    return typeof value !== "number" || Number.isFinite(value);
  }
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item));
  return isRecord(value) && Object.values(value).every((item) => isJsonValue(item));
}

function isIsoDateTime(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function isSourceRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}([0-9a-f]{24})?$/.test(value);
}

function isCanonicalOrigin(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.origin === value &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

function isCanonicalHttpsOrigin(value: unknown): value is string {
  if (!isCanonicalOrigin(value)) return false;
  return new URL(value).protocol === "https:";
}

function isCanonicalBase64(value: unknown, byteLength?: number): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    return false;
  }
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const decodedLength = value.length / 4 * 3 - padding;
  return byteLength === undefined || decodedLength === byteLength;
}

function addIssue(
  issues: AICValidationIssue[],
  path: string,
  message: string,
  rule: string,
  severity: AICValidationSeverity = "error"
): void {
  issues.push({ message, path, rule, severity });
}

function result<T>(value: T, issues: AICValidationIssue[]): ValidationResult<T> {
  return issues.some((issue) => issue.severity === "error" || issue.severity === "fatal")
    ? { issues, ok: false }
    : { issues, ok: true, value };
}

function allowedKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: AICValidationIssue[]
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) addIssue(issues, `${path}.${key}`, `Unknown field: ${key}`, "evidence.unknown_field");
  }
}

function validateExpression(
  value: unknown,
  path: string,
  issues: AICValidationIssue[],
  extraAllowedKeys: string[] = []
): value is AICEvidenceValueExpression {
  if (!isRecord(value)) {
    addIssue(issues, path, "Expected an expression object", "evidence.expression.object");
    return false;
  }
  allowedKeys(value, ["literal", "pointer", "source", ...extraAllowedKeys], path, issues);
  const hasLiteral = Object.prototype.hasOwnProperty.call(value, "literal");
  const hasSource = isNonEmptyString(value.source);
  if (hasLiteral === hasSource) {
    addIssue(issues, path, "Expression must contain exactly one of literal or source", "evidence.expression.choice");
  }
  if (hasLiteral && !isJsonValue(value.literal)) {
    addIssue(issues, `${path}.literal`, "Expected a JSON value", "evidence.expression.literal");
  }
  if (value.pointer !== undefined && (!hasSource || typeof value.pointer !== "string" || (value.pointer !== "" && !value.pointer.startsWith("/")))) {
    addIssue(issues, `${path}.pointer`, "Pointer requires a source and must be an RFC 6901 pointer", "evidence.expression.pointer");
  }
  return true;
}

function validatePredicate(value: unknown, path: string, issues: AICValidationIssue[]): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "Expected a predicate object", "evidence.predicate.object");
    return;
  }
  validateExpression(value, path, issues, ["operator", "value"]);
  if (!(AIC_EVIDENCE_PREDICATE_OPERATORS as readonly unknown[]).includes(value.operator)) {
    addIssue(issues, `${path}.operator`, "Expected a supported predicate operator", "evidence.predicate.operator");
  }
  const valueOperators = new Set(["equals", "greater_than", "less_than", "not_equals"]);
  if (valueOperators.has(String(value.operator)) !== Object.prototype.hasOwnProperty.call(value, "value")) {
    addIssue(issues, `${path}.value`, "Predicate value is required only for comparison operators", "evidence.predicate.value");
  } else if (Object.prototype.hasOwnProperty.call(value, "value") && !isJsonValue(value.value)) {
    addIssue(issues, `${path}.value`, "Expected a JSON value", "evidence.predicate.value_json");
  }
}

function validateProjection(value: unknown, path: string, issues: AICValidationIssue[]): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "Expected a projection object", "evidence.projection.object");
    return;
  }
  allowedKeys(value, ["checks", "confirmation", "error_code", "outcome", "status"], path, issues);
  validateExpression(value.status, `${path}.status`, issues);
  for (const field of ["confirmation", "error_code", "outcome"] as const) {
    if (value[field] !== undefined) validateExpression(value[field], `${path}.${field}`, issues);
  }
  if (!Array.isArray(value.checks)) {
    addIssue(issues, `${path}.checks`, "Expected an array", "evidence.projection.checks");
    return;
  }
  const ids = new Set<string>();
  value.checks.forEach((check, index) => {
    const checkPath = `${path}.checks[${index}]`;
    if (!isRecord(check)) {
      addIssue(issues, checkPath, "Expected an object", "evidence.projection.check");
      return;
    }
    allowedKeys(check, ["actual", "observed_when", "requirement_id"], checkPath, issues);
    if (!isNonEmptyString(check.requirement_id)) {
      addIssue(issues, `${checkPath}.requirement_id`, "Expected a non-empty string", "evidence.projection.requirement_id");
    } else if (ids.has(check.requirement_id)) {
      addIssue(issues, `${checkPath}.requirement_id`, "Duplicate requirement projection", "evidence.projection.requirement_unique");
    } else {
      ids.add(check.requirement_id);
    }
    validatePredicate(check.observed_when, `${checkPath}.observed_when`, issues);
    if (check.actual !== undefined) validateExpression(check.actual, `${checkPath}.actual`, issues);
  });
}

function validateHeaders(value: unknown, path: string, issues: AICValidationIssue[]): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "Expected a header object", "evidence.headers.object");
    return;
  }
  for (const [name, header] of Object.entries(value)) {
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) {
      addIssue(issues, `${path}.${name}`, "Invalid HTTP header name", "evidence.headers.name");
    }
    if (typeof header === "string") continue;
    if (!isRecord(header)) {
      addIssue(issues, `${path}.${name}`, "Expected a string or secret reference", "evidence.headers.value");
      continue;
    }
    allowedKeys(header, ["secret_ref"], `${path}.${name}`, issues);
    if (!isNonEmptyString(header.secret_ref)) addIssue(issues, `${path}.${name}.secret_ref`, "Expected a non-empty string", "evidence.headers.secret_ref");
  }
}

function validateHttpRequest(value: unknown, path: string, issues: AICValidationIssue[]): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "Expected an HTTP request object", "evidence.http.request");
    return;
  }
  allowedKeys(value, ["body", "headers", "method", "path", "query"], path, issues);
  if (value.method !== undefined && !["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"].includes(String(value.method))) {
    addIssue(issues, `${path}.method`, "Expected a supported uppercase HTTP method", "evidence.http.method");
  }
  if (value.path !== undefined && (!isNonEmptyString(value.path) || !String(value.path).startsWith("/"))) {
    addIssue(issues, `${path}.path`, "Expected an origin-relative path", "evidence.http.path");
  }
  if (value.body !== undefined && !isJsonValue(value.body)) addIssue(issues, `${path}.body`, "Expected a JSON value", "evidence.http.body");
  if (value.headers !== undefined) validateHeaders(value.headers, `${path}.headers`, issues);
  if (value.query !== undefined && (!isRecord(value.query) || !Object.values(value.query).every((item) => typeof item === "string" || (Array.isArray(item) && item.every((part) => typeof part === "string"))))) {
    addIssue(issues, `${path}.query`, "Expected string or string-array query values", "evidence.http.query");
  }
}

function validateScenarioBase(value: Record<string, unknown>, path: string, issues: AICValidationIssue[]): void {
  if (!isNonEmptyString(value.scenario_id)) addIssue(issues, `${path}.scenario_id`, "Expected a non-empty string", "evidence.scenario.id");
  if (typeof value.mutates !== "boolean") addIssue(issues, `${path}.mutates`, "Expected a boolean", "evidence.scenario.mutates");
  validateProjection(value.projection, `${path}.projection`, issues);
}

export function validateAICEvidencePlan(value: unknown): ValidationResult<AICEvidencePlan> {
  const issues: AICValidationIssue[] = [];
  if (!isRecord(value)) {
    addIssue(issues, "$", "Expected an object", "evidence.plan.object", "fatal");
    return { issues, ok: false };
  }
  allowedKeys(value, ["artifact_type", "contract", "id", "spec", "surfaces"], "$", issues);
  if (value.artifact_type !== "aic_evidence_plan") addIssue(issues, "$.artifact_type", "Expected aic_evidence_plan", "evidence.plan.artifact_type");
  if (value.spec !== AIC_EVIDENCE_SPEC) addIssue(issues, "$.spec", `Expected ${AIC_EVIDENCE_SPEC}`, "evidence.plan.spec");
  if (!isNonEmptyString(value.id)) addIssue(issues, "$.id", "Expected a non-empty string", "evidence.plan.id");
  if (!isRecord(value.contract)) {
    addIssue(issues, "$.contract", "Expected an object", "evidence.plan.contract");
  } else {
    allowedKeys(value.contract, ["digest", "id"], "$.contract", issues);
    if (!isNonEmptyString(value.contract.id)) addIssue(issues, "$.contract.id", "Expected a non-empty string", "evidence.plan.contract_id");
    if (!isDigest(value.contract.digest)) addIssue(issues, "$.contract.digest", "Expected a SHA-256 digest", "evidence.plan.contract_digest");
  }
  if (!Array.isArray(value.surfaces) || value.surfaces.length === 0) {
    addIssue(issues, "$.surfaces", "Expected a non-empty array", "evidence.plan.surfaces");
    return result(value as unknown as AICEvidencePlan, issues);
  }
  const surfaceIds = new Set<string>();
  value.surfaces.forEach((surface, surfaceIndex) => {
    const path = `$.surfaces[${surfaceIndex}]`;
    if (!isRecord(surface)) {
      addIssue(issues, path, "Expected an object", "evidence.surface.object");
      return;
    }
    if (!isNonEmptyString(surface.surface_id)) addIssue(issues, `${path}.surface_id`, "Expected a non-empty string", "evidence.surface.id");
    else if (surfaceIds.has(surface.surface_id)) addIssue(issues, `${path}.surface_id`, "Duplicate surface plan", "evidence.surface.unique");
    else surfaceIds.add(surface.surface_id);
    const isHttp = surface.adapter === "@aicorg/evidence-http";
    const isMcp = surface.adapter === "@aicorg/evidence-mcp";
    if (!isHttp && !isMcp) {
      addIssue(issues, `${path}.adapter`, "Expected a built-in evidence adapter", "evidence.surface.adapter");
      return;
    }
    allowedKeys(
      surface,
      isHttp
        ? ["adapter", "capture_response_body", "max_response_bytes", "openapi", "scenarios", "surface_id", "timeout_ms"]
        : ["adapter", "endpoint", "headers", "max_response_bytes", "scenarios", "surface_id", "timeout_ms"],
      path,
      issues
    );
    for (const numeric of ["max_response_bytes", "timeout_ms"] as const) {
      if (surface[numeric] !== undefined && (!Number.isInteger(surface[numeric]) || Number(surface[numeric]) <= 0)) {
        addIssue(issues, `${path}.${numeric}`, "Expected a positive integer", `evidence.surface.${numeric}`);
      }
    }
    if (isHttp && surface.capture_response_body !== undefined && typeof surface.capture_response_body !== "boolean") {
      addIssue(issues, `${path}.capture_response_body`, "Expected a boolean", "evidence.http.capture_response_body");
    }
    if (isHttp && surface.openapi !== undefined) {
      if (!isRecord(surface.openapi)) addIssue(issues, `${path}.openapi`, "Expected an object", "evidence.openapi.object");
      else {
        allowedKeys(surface.openapi, ["document", "operation_id"], `${path}.openapi`, issues);
        if (!isJsonValue(surface.openapi.document)) addIssue(issues, `${path}.openapi.document`, "Expected an inline JSON document", "evidence.openapi.document");
        if (!isNonEmptyString(surface.openapi.operation_id)) addIssue(issues, `${path}.openapi.operation_id`, "Expected a non-empty operationId", "evidence.openapi.operation_id");
      }
    }
    if (isMcp) {
      if (!isNonEmptyString(surface.endpoint)) addIssue(issues, `${path}.endpoint`, "Expected an endpoint URL or origin-relative path", "evidence.mcp.endpoint");
      if (surface.headers !== undefined) validateHeaders(surface.headers, `${path}.headers`, issues);
    }
    if (!Array.isArray(surface.scenarios) || surface.scenarios.length === 0) {
      addIssue(issues, `${path}.scenarios`, "Expected a non-empty array", "evidence.surface.scenarios");
      return;
    }
    const scenarioIds = new Set<string>();
    surface.scenarios.forEach((scenario, scenarioIndex) => {
      const scenarioPath = `${path}.scenarios[${scenarioIndex}]`;
      if (!isRecord(scenario)) {
        addIssue(issues, scenarioPath, "Expected an object", "evidence.scenario.object");
        return;
      }
      allowedKeys(
        scenario,
        isHttp
          ? ["mutates", "probes", "projection", "request", "scenario_id"]
          : ["arguments", "mutates", "probes", "projection", "scenario_id", "tool_name"],
        scenarioPath,
        issues
      );
      validateScenarioBase(scenario, scenarioPath, issues);
      if (isNonEmptyString(scenario.scenario_id)) {
        if (scenarioIds.has(scenario.scenario_id)) addIssue(issues, `${scenarioPath}.scenario_id`, "Duplicate scenario plan", "evidence.scenario.unique");
        scenarioIds.add(scenario.scenario_id);
      }
      if (isHttp) validateHttpRequest(scenario.request, `${scenarioPath}.request`, issues);
      else {
        if (!isNonEmptyString(scenario.tool_name)) addIssue(issues, `${scenarioPath}.tool_name`, "Expected a non-empty tool name", "evidence.mcp.tool_name");
        if (!isRecord(scenario.arguments) || !Object.values(scenario.arguments).every((item) => isJsonValue(item))) addIssue(issues, `${scenarioPath}.arguments`, "Expected a JSON-valued object", "evidence.mcp.arguments");
      }
      if (scenario.probes !== undefined) {
        if (!Array.isArray(scenario.probes)) addIssue(issues, `${scenarioPath}.probes`, "Expected an array", "evidence.probes.array");
        else {
          const probeIds = new Set<string>();
          scenario.probes.forEach((probe, probeIndex) => {
            const probePath = `${scenarioPath}.probes[${probeIndex}]`;
            if (!isRecord(probe)) {
              addIssue(issues, probePath, "Expected an object", "evidence.probe.object");
              return;
            }
            allowedKeys(probe, isHttp ? ["id", "phase", "request"] : ["arguments", "id", "phase", "tool_name"], probePath, issues);
            if (!isNonEmptyString(probe.id)) addIssue(issues, `${probePath}.id`, "Expected a non-empty string", "evidence.probe.id");
            else if (probeIds.has(probe.id)) addIssue(issues, `${probePath}.id`, "Duplicate probe id", "evidence.probe.unique");
            else probeIds.add(probe.id);
            if (!['before', 'after'].includes(String(probe.phase))) addIssue(issues, `${probePath}.phase`, "Expected before or after", "evidence.probe.phase");
            if (isHttp) validateHttpRequest(probe.request, `${probePath}.request`, issues);
            else {
              if (!isNonEmptyString(probe.tool_name)) addIssue(issues, `${probePath}.tool_name`, "Expected a non-empty tool name", "evidence.mcp.probe_tool");
              if (!isRecord(probe.arguments) || !Object.values(probe.arguments).every((item) => isJsonValue(item))) addIssue(issues, `${probePath}.arguments`, "Expected a JSON-valued object", "evidence.mcp.probe_arguments");
            }
          });
        }
      }
    });
  });
  return result(value as unknown as AICEvidencePlan, issues);
}

export function validateAICDeploymentIdentity(value: unknown): ValidationResult<AICDeploymentIdentity> {
  const issues: AICValidationIssue[] = [];
  if (!isRecord(value)) {
    addIssue(issues, "$", "Expected an object", "deployment.object", "fatal");
    return { issues, ok: false };
  }
  allowedKeys(value, ["artifact_digest", "artifact_type", "deployed_at", "deployment_id", "environment", "origin", "source_repository", "source_revision", "spec"], "$", issues);
  if (value.artifact_type !== "aic_deployment_identity") addIssue(issues, "$.artifact_type", "Expected aic_deployment_identity", "deployment.artifact_type");
  if (value.spec !== AIC_DEPLOYMENT_IDENTITY_SPEC) addIssue(issues, "$.spec", `Expected ${AIC_DEPLOYMENT_IDENTITY_SPEC}`, "deployment.spec");
  if (!isIsoDateTime(value.deployed_at)) addIssue(issues, "$.deployed_at", "Expected an ISO date-time", "deployment.deployed_at");
  if (!isNonEmptyString(value.deployment_id)) addIssue(issues, "$.deployment_id", "Expected a non-empty string", "deployment.id");
  if (!["development", "production", "staging", "test"].includes(String(value.environment))) addIssue(issues, "$.environment", "Expected a supported environment", "deployment.environment");
  if (!isCanonicalOrigin(value.origin)) addIssue(issues, "$.origin", "Expected a canonical HTTP(S) origin", "deployment.origin");
  if (!isSourceRevision(value.source_revision)) addIssue(issues, "$.source_revision", "Expected a full 40- or 64-character source revision", "deployment.source_revision");
  if (value.source_repository !== undefined && !isNonEmptyString(value.source_repository)) addIssue(issues, "$.source_repository", "Expected a non-empty string", "deployment.source_repository");
  if (value.artifact_digest !== undefined && !isDigest(value.artifact_digest)) addIssue(issues, "$.artifact_digest", "Expected a SHA-256 digest", "deployment.artifact_digest");
  return result(value as unknown as AICDeploymentIdentity, issues);
}

export function validateAICRemoteObservationJob(value: unknown): ValidationResult<AICRemoteObservationJob> {
  const issues: AICValidationIssue[] = [];
  if (!isRecord(value)) {
    addIssue(issues, "$", "Expected an object", "remote_job.object", "fatal");
    return { issues, ok: false };
  }
  allowedKeys(value, ["artifact_type", "contract", "id", "plan", "policy", "spec", "target"], "$", issues);
  if (value.artifact_type !== "aic_remote_observation_job") addIssue(issues, "$.artifact_type", "Expected aic_remote_observation_job", "remote_job.artifact_type");
  if (value.spec !== AIC_REMOTE_SPEC) addIssue(issues, "$.spec", `Expected ${AIC_REMOTE_SPEC}`, "remote_job.spec");
  if (!isNonEmptyString(value.id)) addIssue(issues, "$.id", "Expected a non-empty string", "remote_job.id");
  const plan = validateAICEvidencePlan(value.plan);
  plan.issues.forEach((issue) => issues.push({ ...issue, path: `$.plan${issue.path === "$" ? "" : issue.path.slice(1)}` }));
  const contract = validateAICBehaviorContract(value.contract);
  contract.issues.forEach((issue) => issues.push({
    ...issue,
    path: `$.contract${issue.path === "$" ? "" : issue.path.slice(1)}`
  }));
  if (!isRecord(value.target)) addIssue(issues, "$.target", "Expected an object", "remote_job.target");
  else {
    allowedKeys(value.target, ["environment", "expected_deployment_id", "expected_source_revision", "identity_path", "origin"], "$.target", issues);
    if (value.target.environment !== "production") addIssue(issues, "$.target.environment", "Remote production jobs require production", "remote_job.environment");
    if (!isCanonicalHttpsOrigin(value.target.origin)) addIssue(issues, "$.target.origin", "Expected a canonical HTTPS origin", "remote_job.origin");
    if (!isNonEmptyString(value.target.expected_deployment_id)) addIssue(issues, "$.target.expected_deployment_id", "Expected a non-empty string", "remote_job.deployment_id");
    if (!isSourceRevision(value.target.expected_source_revision)) addIssue(issues, "$.target.expected_source_revision", "Expected a full source revision", "remote_job.source_revision");
    if (
      !isNonEmptyString(value.target.identity_path) ||
      !String(value.target.identity_path).startsWith("/") ||
      String(value.target.identity_path).startsWith("//")
    ) {
      addIssue(issues, "$.target.identity_path", "Expected an origin-relative identity path", "remote_job.identity_path");
    } else if (isCanonicalHttpsOrigin(value.target.origin)) {
      const identityUrl = new URL(String(value.target.identity_path), value.target.origin);
      if (identityUrl.origin !== value.target.origin) {
        addIssue(issues, "$.target.identity_path", "Identity path must stay on the target origin", "remote_job.identity_origin");
      }
    }
  }
  if (!isRecord(value.policy)) addIssue(issues, "$.policy", "Expected an object", "remote_job.policy");
  else {
    allowedKeys(value.policy, ["adapter_allowlist", "allow_destructive", "allow_mutations", "max_identity_age_seconds", "max_response_bytes", "max_run_ms", "operation_allowlist", "public_network_only", "require_https"], "$.policy", issues);
    for (const field of ["adapter_allowlist", "operation_allowlist"] as const) {
      if (!Array.isArray(value.policy[field]) || !value.policy[field].every((item) => isNonEmptyString(item))) addIssue(issues, `$.policy.${field}`, "Expected a string array", `remote_job.${field}`);
      else if (new Set(value.policy[field]).size !== value.policy[field].length) addIssue(issues, `$.policy.${field}`, "Expected unique values", `remote_job.${field}_unique`);
    }
    for (const field of ["max_response_bytes", "max_run_ms"] as const) {
      if (!Number.isInteger(value.policy[field]) || Number(value.policy[field]) <= 0) addIssue(issues, `$.policy.${field}`, "Expected a positive integer", `remote_job.${field}`);
    }
    if (value.policy.max_identity_age_seconds !== undefined && (!Number.isInteger(value.policy.max_identity_age_seconds) || Number(value.policy.max_identity_age_seconds) <= 0)) addIssue(issues, "$.policy.max_identity_age_seconds", "Expected a positive integer", "remote_job.max_identity_age_seconds");
    if (value.policy.require_https !== true) addIssue(issues, "$.policy.require_https", "Remote jobs must require HTTPS", "remote_job.require_https");
    if (value.policy.public_network_only !== true) addIssue(issues, "$.policy.public_network_only", "Remote jobs must require public networking", "remote_job.public_network_only");
    if (value.policy.allow_destructive !== undefined && typeof value.policy.allow_destructive !== "boolean") addIssue(issues, "$.policy.allow_destructive", "Expected a boolean", "remote_job.allow_destructive");
    if (value.policy.allow_mutations !== undefined) {
      if (!isRecord(value.policy.allow_mutations)) addIssue(issues, "$.policy.allow_mutations", "Expected an object", "remote_job.allow_mutations");
      else {
        allowedKeys(value.policy.allow_mutations, ["canary_scope", "operation_ids"], "$.policy.allow_mutations", issues);
        if (!isNonEmptyString(value.policy.allow_mutations.canary_scope)) addIssue(issues, "$.policy.allow_mutations.canary_scope", "Expected a non-empty canary scope", "remote_job.canary_scope");
        if (!Array.isArray(value.policy.allow_mutations.operation_ids) || !value.policy.allow_mutations.operation_ids.every((item) => isNonEmptyString(item)) || value.policy.allow_mutations.operation_ids.length === 0) addIssue(issues, "$.policy.allow_mutations.operation_ids", "Expected a non-empty operation id array", "remote_job.mutation_operations");
        else if (new Set(value.policy.allow_mutations.operation_ids).size !== value.policy.allow_mutations.operation_ids.length) addIssue(issues, "$.policy.allow_mutations.operation_ids", "Expected unique operation ids", "remote_job.mutation_operations_unique");
      }
    }
  }
  return result(value as unknown as AICRemoteObservationJob, issues);
}

function validateAdapterMetadata(
  value: unknown,
  path: string,
  issues: AICValidationIssue[]
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "Expected an adapter metadata object", "evidence_bundle.adapter");
    return;
  }
  allowedKeys(value, ["id", "protocol_version", "version"], path, issues);
  for (const field of ["id", "protocol_version", "version"] as const) {
    if (!isNonEmptyString(value[field])) {
      addIssue(issues, `${path}.${field}`, "Expected a non-empty string", `evidence_bundle.adapter_${field}`);
    }
  }
}

function validateRunnerIdentity(
  value: unknown,
  path: string,
  issues: AICValidationIssue[]
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "Expected a runner identity object", "evidence_bundle.runner");
    return;
  }
  allowedKeys(value, ["id", "software_name", "software_revision", "software_version"], path, issues);
  for (const field of ["id", "software_name", "software_version"] as const) {
    if (!isNonEmptyString(value[field])) {
      addIssue(issues, `${path}.${field}`, "Expected a non-empty string", `evidence_bundle.runner_${field}`);
    }
  }
  if (!isSourceRevision(value.software_revision)) {
    addIssue(issues, `${path}.software_revision`, "Expected a full 40- or 64-character source revision", "evidence_bundle.runner_revision");
  }
}

function validateEvidenceReceipt(
  value: unknown,
  path: string,
  issues: AICValidationIssue[]
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "Expected an evidence receipt", "evidence_bundle.receipt");
    return;
  }
  allowedKeys(
    value,
    [
      "adapters",
      "artifact_type",
      "completed_at",
      "contract",
      "deployment_identity_digest",
      "evidence_manifest_digest",
      "job_id",
      "observations_digest",
      "plan_digest",
      "request_count",
      "runner",
      "spec",
      "started_at",
      "target"
    ],
    path,
    issues
  );
  if (value.artifact_type !== "aic_evidence_receipt") {
    addIssue(issues, `${path}.artifact_type`, "Expected aic_evidence_receipt", "evidence_bundle.receipt_type");
  }
  if (value.spec !== AIC_EVIDENCE_SPEC) {
    addIssue(issues, `${path}.spec`, `Expected ${AIC_EVIDENCE_SPEC}`, "evidence_bundle.receipt_spec");
  }
  if (!isIsoDateTime(value.started_at)) {
    addIssue(issues, `${path}.started_at`, "Expected an ISO date-time", "evidence_bundle.started_at");
  }
  if (!isIsoDateTime(value.completed_at)) {
    addIssue(issues, `${path}.completed_at`, "Expected an ISO date-time", "evidence_bundle.completed_at");
  }
  if (
    isIsoDateTime(value.started_at) &&
    isIsoDateTime(value.completed_at) &&
    Date.parse(value.completed_at) < Date.parse(value.started_at)
  ) {
    addIssue(issues, `${path}.completed_at`, "Receipt completion cannot precede its start", "evidence_bundle.receipt_time_order");
  }
  if (!isNonEmptyString(value.job_id)) {
    addIssue(issues, `${path}.job_id`, "Expected a non-empty string", "evidence_bundle.job_id");
  }
  if (!Number.isSafeInteger(value.request_count) || Number(value.request_count) < 1) {
    addIssue(issues, `${path}.request_count`, "Expected a positive safe integer", "evidence_bundle.request_count");
  }
  if (!isRecord(value.contract)) {
    addIssue(issues, `${path}.contract`, "Expected a contract reference", "evidence_bundle.receipt_contract");
  } else {
    allowedKeys(value.contract, ["digest", "id"], `${path}.contract`, issues);
    if (!isNonEmptyString(value.contract.id)) {
      addIssue(issues, `${path}.contract.id`, "Expected a non-empty string", "evidence_bundle.receipt_contract_id");
    }
    if (!isDigest(value.contract.digest)) {
      addIssue(issues, `${path}.contract.digest`, "Expected a SHA-256 digest", "evidence_bundle.receipt_contract_digest");
    }
  }
  for (const field of [
    "deployment_identity_digest",
    "evidence_manifest_digest",
    "observations_digest",
    "plan_digest"
  ] as const) {
    if (!isDigest(value[field])) {
      addIssue(issues, `${path}.${field}`, "Expected a SHA-256 digest", `evidence_bundle.${field}`);
    }
  }
  if (!Array.isArray(value.adapters) || value.adapters.length === 0) {
    addIssue(issues, `${path}.adapters`, "Expected a non-empty adapter array", "evidence_bundle.adapters");
  } else {
    const adapterIds = new Set<string>();
    value.adapters.forEach((adapter, index) => {
      validateAdapterMetadata(adapter, `${path}.adapters[${index}]`, issues);
      if (isRecord(adapter) && isNonEmptyString(adapter.id)) {
        if (adapterIds.has(adapter.id)) {
          addIssue(issues, `${path}.adapters[${index}].id`, "Duplicate adapter id", "evidence_bundle.adapter_unique");
        }
        adapterIds.add(adapter.id);
      }
    });
  }
  validateRunnerIdentity(value.runner, `${path}.runner`, issues);
  if (!isRecord(value.target)) {
    addIssue(issues, `${path}.target`, "Expected a target identity", "evidence_bundle.target");
  } else {
    allowedKeys(value.target, ["deployment_id", "environment", "origin", "source_revision"], `${path}.target`, issues);
    if (!isNonEmptyString(value.target.deployment_id)) {
      addIssue(issues, `${path}.target.deployment_id`, "Expected a non-empty string", "evidence_bundle.target_deployment");
    }
    if (value.target.environment !== "production") {
      addIssue(issues, `${path}.target.environment`, "Expected production", "evidence_bundle.target_environment");
    }
    if (!isCanonicalHttpsOrigin(value.target.origin)) {
      addIssue(issues, `${path}.target.origin`, "Expected a canonical HTTPS origin", "evidence_bundle.target_origin");
    }
    if (!isSourceRevision(value.target.source_revision)) {
      addIssue(issues, `${path}.target.source_revision`, "Expected a full source revision", "evidence_bundle.target_revision");
    }
  }
}

export function validateAICEvidenceBundle(value: unknown): ValidationResult<AICEvidenceBundle> {
  const issues: AICValidationIssue[] = [];
  if (!isRecord(value)) {
    addIssue(issues, "$", "Expected an object", "evidence_bundle.object", "fatal");
    return { issues, ok: false };
  }
  allowedKeys(value, ["artifact_type", "artifacts", "contract", "deployment_identity", "generated_at", "observations", "plan", "receipt", "receipt_digest", "receipt_signature", "spec", "status"], "$", issues);
  if (value.artifact_type !== "aic_evidence_bundle") addIssue(issues, "$.artifact_type", "Expected aic_evidence_bundle", "evidence_bundle.artifact_type");
  if (value.spec !== AIC_EVIDENCE_SPEC) addIssue(issues, "$.spec", `Expected ${AIC_EVIDENCE_SPEC}`, "evidence_bundle.spec");
  if (value.status !== "completed") addIssue(issues, "$.status", "Expected completed", "evidence_bundle.status");
  if (!isIsoDateTime(value.generated_at)) addIssue(issues, "$.generated_at", "Expected an ISO date-time", "evidence_bundle.generated_at");
  if (!isDigest(value.receipt_digest)) addIssue(issues, "$.receipt_digest", "Expected a SHA-256 digest", "evidence_bundle.receipt_digest");
  const plan = validateAICEvidencePlan(value.plan);
  plan.issues.forEach((issue) => issues.push({ ...issue, path: `$.plan${issue.path === "$" ? "" : issue.path.slice(1)}` }));
  const identity = validateAICDeploymentIdentity(value.deployment_identity);
  identity.issues.forEach((issue) => issues.push({ ...issue, path: `$.deployment_identity${issue.path === "$" ? "" : issue.path.slice(1)}` }));
  const contract = validateAICBehaviorContract(value.contract);
  contract.issues.forEach((issue) => issues.push({ ...issue, path: `$.contract${issue.path === "$" ? "" : issue.path.slice(1)}` }));
  const observations = validateAICBehaviorObservationSet(value.observations);
  observations.issues.forEach((issue) => issues.push({ ...issue, path: `$.observations${issue.path === "$" ? "" : issue.path.slice(1)}` }));
  if (!Array.isArray(value.artifacts) || value.artifacts.length === 0) addIssue(issues, "$.artifacts", "Expected a non-empty array", "evidence_bundle.artifacts");
  else value.artifacts.forEach((artifact, index) => {
    const path = `$.artifacts[${index}]`;
    if (!isRecord(artifact)) {
      addIssue(issues, path, "Expected an object", "evidence_bundle.artifact");
      return;
    }
    allowedKeys(artifact, ["content", "digest", "kind", "media_type", "ref"], path, issues);
    if (!isJsonValue(artifact.content)) addIssue(issues, `${path}.content`, "Expected JSON content", "evidence_bundle.artifact_content");
    if (!isDigest(artifact.digest)) addIssue(issues, `${path}.digest`, "Expected a SHA-256 digest", "evidence_bundle.artifact_digest");
    if (!isNonEmptyString(artifact.ref)) addIssue(issues, `${path}.ref`, "Expected a non-empty reference", "evidence_bundle.artifact_ref");
    else if (isDigest(artifact.digest) && artifact.ref !== `urn:aic:evidence:${artifact.digest.slice("sha256:".length)}`) {
      addIssue(issues, `${path}.ref`, "Evidence ref must be derived from its digest", "evidence_bundle.artifact_ref_digest");
    }
    if (!["log", "receipt", "trace", "other"].includes(String(artifact.kind))) addIssue(issues, `${path}.kind`, "Expected a supported kind", "evidence_bundle.artifact_kind");
    if (artifact.media_type !== "application/json") addIssue(issues, `${path}.media_type`, "Expected application/json", "evidence_bundle.artifact_media_type");
  });
  if (Array.isArray(value.artifacts)) {
    const refs = new Set<string>();
    value.artifacts.forEach((artifact, index) => {
      if (!isRecord(artifact) || !isNonEmptyString(artifact.ref)) return;
      if (refs.has(artifact.ref)) addIssue(issues, `$.artifacts[${index}].ref`, "Duplicate evidence ref", "evidence_bundle.artifact_unique");
      refs.add(artifact.ref);
    });
  }
  validateEvidenceReceipt(value.receipt, "$.receipt", issues);
  if (value.receipt_signature !== undefined) {
    if (!isRecord(value.receipt_signature)) addIssue(issues, "$.receipt_signature", "Expected an object", "evidence_bundle.signature");
    else {
      allowedKeys(value.receipt_signature, ["algorithm", "key_id", "value"], "$.receipt_signature", issues);
      if (value.receipt_signature.algorithm !== "ed25519") addIssue(issues, "$.receipt_signature.algorithm", "Expected ed25519", "evidence_bundle.signature_algorithm");
      if (!isDigest(value.receipt_signature.key_id)) addIssue(issues, "$.receipt_signature.key_id", "Expected a SHA-256 key id", "evidence_bundle.signature_key_id");
      if (!isCanonicalBase64(value.receipt_signature.value, 64)) addIssue(issues, "$.receipt_signature.value", "Expected a canonical 64-byte Ed25519 signature", "evidence_bundle.signature_value");
    }
  }
  return result(value as unknown as AICEvidenceBundle, issues);
}

export function isAICBehaviorStatus(value: unknown): value is AICBehaviorResultStatus {
  return ["succeeded", "denied", "cancelled", "failed", "recovered"].includes(String(value));
}

export function isAICBehaviorConfirmation(value: unknown): value is AICBehaviorConfirmationResult {
  return ["accepted", "declined", "not_required", "not_reached"].includes(String(value));
}
