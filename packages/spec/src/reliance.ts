import type { AICPolicyEvaluation } from "./policy.js";
import { validateAICPolicyEvaluation } from "./policy.js";
import { validateAICSignedAttestation, type AICTrustEnvironment } from "./trust.js";
import { isAICRfc3339DateTime as isDateTime } from "./date-time.js";
import type { JsonValue } from "./types.js";
import type { AICValidationIssue, ValidationResult } from "./types.js";

export const AIC_RELIANCE_SPEC = "aic.reliance/0.1";
/** Maximum portable lifetime of an allow decision, measured from evaluated_at. */
export const AIC_RELIANCE_MAX_VALIDITY_SECONDS = 60;

export type AICRelianceVerdict = "allow" | "confirm" | "deny" | "indeterminate";
export type AICRelianceCheck = "passed" | "failed" | "not_checked";
export type AICRelianceFreshnessStatus = "fresh" | "stale" | "future" | "not_checked" | "invalid";

export const AIC_RELIANCE_REASON_CODES = [
  "requirements_satisfied",
  "confirmation_required",
  "request_origin_invalid",
  "request_operation_id_invalid",
  "request_deployment_id_invalid",
  "request_revision_invalid",
  "request_environment_invalid",
  "artifacts_invalid",
  "binding_origin_mismatch",
  "binding_operation_mismatch",
  "binding_deployment_mismatch",
  "binding_revision_mismatch",
  "trust_invalid",
  "trust_untrusted",
  "policy_failed",
  "policy_indeterminate",
  "policy_not_fail_closed",
  "policy_rule_unmatched",
  "evidence_stale",
  "evidence_future",
  "evidence_freshness_not_checked",
  "transparency_invalid",
  "transparency_untrusted",
  "transparency_attestation_missing",
  "transparency_checkpoint_stale",
  "transparency_checkpoint_mismatch",
  "transparency_consistency_required",
  "transparency_inconsistent",
  "transparency_required",
  "transparency_size_below_minimum",
  "transparency_log_disallowed",
  "transparency_prior_checkpoint_mismatch",
  "transparency_key_disallowed",
  "transparency_external_receipt_not_checked"
] as const;

export type AICRelianceReasonCode = (typeof AIC_RELIANCE_REASON_CODES)[number];

export interface AICRelianceRequestBinding {
  environment?: AICTrustEnvironment;
  expected_deployment_id: string;
  expected_revision: string;
  operation_id: string;
  origin: string;
}

export interface AICRelianceArtifactDigests {
  attestation?: string;
  contract?: string;
  observations?: string;
  policy?: string;
  proof?: string;
  transparency_index?: string;
  transparency_prior_index?: string;
  transparency_trust_store?: string;
  trust_store?: string;
}

export interface AICRelianceEvidenceFreshness {
  attestation_age_seconds?: number;
  attestation_expires_at?: string;
  oldest_observation_age_seconds?: number;
  proof_age_seconds?: number;
  status: AICRelianceFreshnessStatus;
}

export interface AICRelianceChecks {
  artifacts: AICRelianceCheck;
  policy: AICRelianceCheck;
  request_binding: AICRelianceCheck;
  transparency: AICRelianceCheck;
  trust: AICRelianceCheck;
}

export interface AICRelianceDecision {
  artifact_digests: AICRelianceArtifactDigests;
  artifact_type: "aic_reliance_decision";
  checks: AICRelianceChecks;
  evaluated_at: string;
  evidence_freshness: AICRelianceEvidenceFreshness;
  policy_evaluation?: AICPolicyEvaluation;
  reason_codes: AICRelianceReasonCode[];
  request: AICRelianceRequestBinding;
  spec: typeof AIC_RELIANCE_SPEC;
  /** Exclusive consumer-use deadline. Required for allow decisions. */
  valid_until?: string;
  verdict: AICRelianceVerdict;
}

export const AIC_RELIANCE_RECORD_SPEC = "aic.reliance-record/0.1";
export const AIC_RELIANCE_SNAPSHOT_SPEC = "aic.reliance-snapshot/0.1";

export interface AICRelianceRecordBinding {
  deployment_id: string;
  operation_id: string;
  origin: string;
  source_revision: string;
}

export interface AICRelianceArtifactLocator {
  digest: string;
  inline?: JsonValue;
  media_type?: string;
  uri?: string;
}

export interface AICRelianceValidationOptions {
  /** Compute the AIC canonical SHA-256 digest for inline JSON artifacts. */
  createDigest: (value: JsonValue) => string;
}

export interface AICRelianceRecord {
  artifact_type: "aic_reliance_record";
  artifacts: Record<string, AICRelianceArtifactLocator>;
  binding: AICRelianceRecordBinding;
  id: string;
  indexed_at: string;
  spec: typeof AIC_RELIANCE_RECORD_SPEC;
}

export interface AICRelianceSnapshot {
  artifact_type: "aic_reliance_snapshot";
  id: string;
  records: AICRelianceRecord[];
  spec: typeof AIC_RELIANCE_SNAPSHOT_SPEC;
  updated_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function add(
  issues: AICValidationIssue[],
  path: string,
  message: string,
  rule: string
): void {
  issues.push({ message, path, rule, severity: "error" });
}

function allowed(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  issues: AICValidationIssue[]
): void {
  const allowedKeys = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      add(issues, `${path}.${key}`, `Unknown field: ${key}`, "reliance.unknown_field");
    }
  }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function isJsonValue(value: unknown, seen = new Set<object>()): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) return false;
    const keys = Object.keys(value);
    if (
      keys.length !== value.length ||
      keys.some((key, index) => key !== String(index))
    ) return false;
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
  }
  if (Object.getOwnPropertySymbols(value).length > 0) return false;
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const valid = Object.entries(descriptors).every(([key, descriptor]) => {
    if (Array.isArray(value) && key === "length") return true;
    return descriptor.enumerable === true && "value" in descriptor && isJsonValue(descriptor.value, seen);
  });
  seen.delete(value);
  return valid;
}

function canonicalOrigin(value: unknown): string | undefined {
  if (!nonEmptyString(value)) return undefined;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.origin === value &&
      url.username === "" &&
      url.password === ""
    )
      ? url.origin
      : undefined;
  } catch {
    return undefined;
  }
}

function isArtifactReference(value: unknown): value is string {
  if (!nonEmptyString(value)) return false;
  if (value.startsWith("./") || value.startsWith("../") || value.startsWith("/")) return true;
  try {
    return ["http:", "https:", "ipfs:", "urn:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function validateRecordBinding(
  value: unknown,
  path: string,
  issues: AICValidationIssue[]
): void {
  if (!isRecord(value)) {
    add(issues, path, "Expected an object", "reliance_record.binding");
    return;
  }
  allowed(value, ["deployment_id", "operation_id", "origin", "source_revision"], path, issues);
  if (!canonicalOrigin(value.origin)) {
    add(issues, `${path}.origin`, "Expected a canonical HTTP(S) origin", "reliance_record.origin");
  }
  for (const field of ["deployment_id", "operation_id"] as const) {
    if (!nonEmptyString(value[field])) {
      add(issues, `${path}.${field}`, "Expected a non-empty string", `reliance_record.${field}`);
    }
  }
  if (typeof value.source_revision !== "string" || !/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(value.source_revision)) {
    add(issues, `${path}.source_revision`, "Expected a full lowercase source revision", "reliance_record.source_revision");
  }
}

function validateArtifactLocator(
  value: unknown,
  path: string,
  issues: AICValidationIssue[],
  options: AICRelianceValidationOptions
): void {
  if (!isRecord(value)) {
    add(issues, path, "Expected an object", "reliance_record.locator");
    return;
  }
  allowed(value, ["digest", "inline", "media_type", "uri"], path, issues);
  if (!isDigest(value.digest)) {
    add(issues, `${path}.digest`, "Expected a SHA-256 digest", "reliance_record.locator_digest");
  }
  if (value.inline === undefined && value.uri === undefined) {
    add(issues, path, "Expected inline JSON data or a URI reference", "reliance_record.locator_source");
  }
  if (value.inline !== undefined) {
    if (!isJsonValue(value.inline)) {
      add(issues, `${path}.inline`, "Expected finite, acyclic JSON data", "reliance_record.locator_inline");
    } else if (isDigest(value.digest)) {
      try {
        const actualDigest = options.createDigest(value.inline);
        if (!isDigest(actualDigest) || actualDigest !== value.digest) {
          add(
            issues,
            `${path}.digest`,
            "Digest does not match the canonical inline artifact",
            "reliance_record.locator_digest_mismatch"
          );
        }
      } catch {
        add(
          issues,
          `${path}.inline`,
          "Inline artifact could not be canonically digested",
          "reliance_record.locator_digest_error"
        );
      }
    }
  }
  if (value.uri !== undefined && !isArtifactReference(value.uri)) {
    add(issues, `${path}.uri`, "Expected a relative, HTTP(S), IPFS, or URN reference", "reliance_record.locator_uri");
  }
  if (value.media_type !== undefined && !nonEmptyString(value.media_type)) {
    add(issues, `${path}.media_type`, "Expected a non-empty string", "reliance_record.locator_media_type");
  }
}

function validateRelianceRecordInto(
  value: unknown,
  path: string,
  issues: AICValidationIssue[],
  options: AICRelianceValidationOptions
): void {
  if (!isRecord(value)) {
    add(issues, path, "Expected an object", "reliance_record.object");
    return;
  }
  allowed(value, ["artifact_type", "artifacts", "binding", "id", "indexed_at", "spec"], path, issues);
  if (value.artifact_type !== "aic_reliance_record") {
    add(issues, `${path}.artifact_type`, "Expected aic_reliance_record", "reliance_record.artifact_type");
  }
  if (value.spec !== AIC_RELIANCE_RECORD_SPEC) {
    add(issues, `${path}.spec`, `Expected ${AIC_RELIANCE_RECORD_SPEC}`, "reliance_record.spec");
  }
  if (!nonEmptyString(value.id)) {
    add(issues, `${path}.id`, "Expected a non-empty string", "reliance_record.id");
  }
  if (!isDateTime(value.indexed_at)) {
    add(issues, `${path}.indexed_at`, "Expected an ISO date-time", "reliance_record.indexed_at");
  }
  validateRecordBinding(value.binding, `${path}.binding`, issues);
  if (!isRecord(value.artifacts) || Object.keys(value.artifacts).length === 0) {
    add(issues, `${path}.artifacts`, "Expected at least one artifact locator", "reliance_record.artifacts");
    return;
  }
  for (const [name, locator] of Object.entries(value.artifacts)) {
    const locatorPath = `${path}.artifacts.${name}`;
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      add(issues, locatorPath, "Expected a stable snake_case artifact name", "reliance_record.artifact_name");
    }
    validateArtifactLocator(locator, locatorPath, issues, options);
  }

  const attestationLocator = value.artifacts.attestation;
  if (isRecord(attestationLocator) && attestationLocator.inline !== undefined) {
    const attestation = validateAICSignedAttestation(attestationLocator.inline);
    if (!attestation.ok) {
      add(
        issues,
        `${path}.artifacts.attestation.inline`,
        "Recognized inline attestation is invalid",
        "reliance_record.attestation_invalid"
      );
    } else if (isRecord(value.binding)) {
      const statement = attestation.value.statement;
      if (
        statement.deployment.origin !== value.binding.origin ||
        statement.subject.operation_id !== value.binding.operation_id ||
        statement.deployment.deployment_id !== value.binding.deployment_id ||
        statement.deployment.source_revision !== value.binding.source_revision
      ) {
        add(
          issues,
          `${path}.artifacts.attestation.inline`,
          "Inline attestation does not match the reliance record binding",
          "reliance_record.attestation_binding"
        );
      }
    }
  }
}

export function validateAICRelianceRecord(
  value: unknown,
  options: AICRelianceValidationOptions
): ValidationResult<AICRelianceRecord> {
  const issues: AICValidationIssue[] = [];
  validateRelianceRecordInto(value, "$", issues, options);
  return issues.length > 0
    ? { issues, ok: false }
    : { issues, ok: true, value: value as AICRelianceRecord };
}

export function validateAICRelianceSnapshot(
  value: unknown,
  options: AICRelianceValidationOptions
): ValidationResult<AICRelianceSnapshot> {
  const issues: AICValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      issues: [{ message: "Expected an object", path: "$", rule: "reliance_snapshot.object", severity: "fatal" }],
      ok: false
    };
  }
  allowed(value, ["artifact_type", "id", "records", "spec", "updated_at"], "$", issues);
  if (value.artifact_type !== "aic_reliance_snapshot") {
    add(issues, "$.artifact_type", "Expected aic_reliance_snapshot", "reliance_snapshot.artifact_type");
  }
  if (value.spec !== AIC_RELIANCE_SNAPSHOT_SPEC) {
    add(issues, "$.spec", `Expected ${AIC_RELIANCE_SNAPSHOT_SPEC}`, "reliance_snapshot.spec");
  }
  if (!nonEmptyString(value.id)) {
    add(issues, "$.id", "Expected a non-empty string", "reliance_snapshot.id");
  }
  if (!isDateTime(value.updated_at)) {
    add(issues, "$.updated_at", "Expected an ISO date-time", "reliance_snapshot.updated_at");
  }
  if (!Array.isArray(value.records)) {
    add(issues, "$.records", "Expected an array", "reliance_snapshot.records");
  } else {
    const ids = new Set<string>();
    for (const [index, record] of value.records.entries()) {
      const path = `$.records[${index}]`;
      validateRelianceRecordInto(record, path, issues, options);
      if (isRecord(record) && nonEmptyString(record.id)) {
        if (ids.has(record.id)) {
          add(issues, `${path}.id`, `Duplicate record id: ${record.id}`, "reliance_snapshot.record_id_unique");
        }
        ids.add(record.id);
      }
      if (
        isDateTime(value.updated_at) &&
        isRecord(record) &&
        isDateTime(record.indexed_at) &&
        Date.parse(record.indexed_at) > Date.parse(value.updated_at)
      ) {
        add(issues, `${path}.indexed_at`, "Record is newer than the snapshot", "reliance_snapshot.time_order");
      }
    }
  }
  return issues.length > 0
    ? { issues, ok: false }
    : { issues, ok: true, value: value as unknown as AICRelianceSnapshot };
}

function validateRequest(
  value: unknown,
  issues: AICValidationIssue[]
): void {
  if (!isRecord(value)) {
    add(issues, "$.request", "Expected an object", "reliance.request");
    return;
  }
  allowed(
    value,
    ["environment", "expected_deployment_id", "expected_revision", "operation_id", "origin"],
    "$.request",
    issues
  );
  for (const field of ["expected_deployment_id", "expected_revision", "operation_id", "origin"] as const) {
    if (typeof value[field] !== "string") {
      add(issues, `$.request.${field}`, "Expected a string", `reliance.request_${field}`);
    }
  }
  if (
    value.environment !== undefined &&
    !["production", "staging", "test", "development"].includes(String(value.environment))
  ) {
    add(issues, "$.request.environment", "Expected a supported environment", "reliance.request_environment");
  }
}

function validateDigests(value: unknown, issues: AICValidationIssue[]): void {
  if (!isRecord(value)) {
    add(issues, "$.artifact_digests", "Expected an object", "reliance.artifact_digests");
    return;
  }
  const fields = [
    "attestation",
    "contract",
    "observations",
    "policy",
    "proof",
    "transparency_index",
    "transparency_prior_index",
    "transparency_trust_store",
    "trust_store"
  ] as const;
  allowed(value, fields, "$.artifact_digests", issues);
  for (const field of fields) {
    if (value[field] !== undefined && !isDigest(value[field])) {
      add(issues, `$.artifact_digests.${field}`, "Expected a SHA-256 digest", "reliance.artifact_digest");
    }
  }
}

function validateFreshness(value: unknown, issues: AICValidationIssue[]): void {
  if (!isRecord(value)) {
    add(issues, "$.evidence_freshness", "Expected an object", "reliance.evidence_freshness");
    return;
  }
  const fields = [
    "attestation_age_seconds",
    "attestation_expires_at",
    "oldest_observation_age_seconds",
    "proof_age_seconds",
    "status"
  ] as const;
  allowed(value, fields, "$.evidence_freshness", issues);
  if (!["fresh", "stale", "future", "not_checked", "invalid"].includes(String(value.status))) {
    add(issues, "$.evidence_freshness.status", "Expected a supported freshness status", "reliance.freshness_status");
  }
  for (const field of ["attestation_age_seconds", "oldest_observation_age_seconds", "proof_age_seconds"] as const) {
    if (value[field] !== undefined && (typeof value[field] !== "number" || !Number.isFinite(value[field]))) {
      add(issues, `$.evidence_freshness.${field}`, "Expected a finite number", "reliance.freshness_age");
    }
  }
  if (value.attestation_expires_at !== undefined && !isDateTime(value.attestation_expires_at)) {
    add(issues, "$.evidence_freshness.attestation_expires_at", "Expected an ISO date-time", "reliance.freshness_expiry");
  }
}

function validateChecks(value: unknown, issues: AICValidationIssue[]): void {
  if (!isRecord(value)) {
    add(issues, "$.checks", "Expected an object", "reliance.checks");
    return;
  }
  const fields = ["artifacts", "policy", "request_binding", "transparency", "trust"] as const;
  allowed(value, fields, "$.checks", issues);
  for (const field of fields) {
    if (!["passed", "failed", "not_checked"].includes(String(value[field]))) {
      add(issues, `$.checks.${field}`, "Expected passed, failed, or not_checked", "reliance.check");
    }
  }
}

export function validateAICRelianceDecision(
  value: unknown
): ValidationResult<AICRelianceDecision> {
  const issues: AICValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      issues: [{ message: "Expected an object", path: "$", rule: "reliance.object", severity: "fatal" }],
      ok: false
    };
  }

  allowed(
    value,
    [
      "artifact_digests",
      "artifact_type",
      "checks",
      "evaluated_at",
      "evidence_freshness",
      "policy_evaluation",
      "reason_codes",
      "request",
      "spec",
      "valid_until",
      "verdict"
    ],
    "$",
    issues
  );

  if (value.artifact_type !== "aic_reliance_decision") {
    add(issues, "$.artifact_type", "Expected aic_reliance_decision", "reliance.artifact_type");
  }
  if (value.spec !== AIC_RELIANCE_SPEC) {
    add(issues, "$.spec", `Expected ${AIC_RELIANCE_SPEC}`, "reliance.spec");
  }
  if (!["allow", "confirm", "deny", "indeterminate"].includes(String(value.verdict))) {
    add(issues, "$.verdict", "Expected allow, confirm, deny, or indeterminate", "reliance.verdict");
  }
  if (!isDateTime(value.evaluated_at)) {
    add(issues, "$.evaluated_at", "Expected an ISO date-time", "reliance.evaluated_at");
  }
  if (value.valid_until !== undefined && !isDateTime(value.valid_until)) {
    add(issues, "$.valid_until", "Expected an RFC 3339 date-time", "reliance.valid_until");
  }

  validateRequest(value.request, issues);
  validateDigests(value.artifact_digests, issues);
  validateFreshness(value.evidence_freshness, issues);
  validateChecks(value.checks, issues);

  if (!Array.isArray(value.reason_codes) || value.reason_codes.length === 0) {
    add(issues, "$.reason_codes", "Expected at least one reason code", "reliance.reason_codes");
  } else {
    const seen = new Set<string>();
    for (const [index, code] of value.reason_codes.entries()) {
      if (!(AIC_RELIANCE_REASON_CODES as readonly unknown[]).includes(code)) {
        add(issues, `$.reason_codes[${index}]`, "Expected a supported reason code", "reliance.reason_code");
      } else if (seen.has(String(code))) {
        add(issues, `$.reason_codes[${index}]`, "Duplicate reason code", "reliance.reason_code_unique");
      }
      seen.add(String(code));
    }
  }

  const reasonCodes = new Set(
    Array.isArray(value.reason_codes)
      ? value.reason_codes.filter(
          (code): code is AICRelianceReasonCode =>
            (AIC_RELIANCE_REASON_CODES as readonly unknown[]).includes(code)
        )
      : []
  );

  if (value.policy_evaluation !== undefined) {
    const validation = validateAICPolicyEvaluation(value.policy_evaluation);
    for (const issue of validation.issues) {
      add(
        issues,
        `$.policy_evaluation${issue.path === "$" ? "" : issue.path.slice(1)}`,
        issue.message,
        `reliance.${issue.rule}`
      );
    }
  }

  if (value.verdict === "allow") {
    if (!isDateTime(value.valid_until)) {
      add(
        issues,
        "$.valid_until",
        "An allow decision requires an exclusive validity deadline",
        "reliance.allow_valid_until"
      );
    } else if (
      isDateTime(value.evaluated_at) &&
      Date.parse(value.valid_until) <= Date.parse(value.evaluated_at)
    ) {
      add(
        issues,
        "$.valid_until",
        "An allow decision validity deadline must be after its evaluation time",
        "reliance.allow_valid_until_order"
      );
    } else if (
      isDateTime(value.evaluated_at) &&
      Date.parse(value.valid_until) >
        Date.parse(value.evaluated_at) +
          AIC_RELIANCE_MAX_VALIDITY_SECONDS * 1000
    ) {
      add(
        issues,
        "$.valid_until",
        `An allow decision cannot remain portable for more than ${AIC_RELIANCE_MAX_VALIDITY_SECONDS} seconds`,
        "reliance.allow_valid_until_maximum"
      );
    }
    if (!Array.isArray(value.reason_codes) || !value.reason_codes.includes("requirements_satisfied")) {
      add(issues, "$.reason_codes", "An allow decision requires requirements_satisfied", "reliance.allow_reason");
    }
    if (isRecord(value.checks)) {
      for (const field of ["artifacts", "policy", "request_binding", "trust"] as const) {
        if (value.checks[field] !== "passed") {
          add(issues, `$.checks.${field}`, "An allow decision requires this check to pass", "reliance.allow_check");
        }
      }
      if (value.checks.transparency === "failed") {
        add(issues, "$.checks.transparency", "An allow decision cannot have failed transparency", "reliance.allow_check");
      }
    }
    const allowedInformationalCodes = new Set<AICRelianceReasonCode>([
      "requirements_satisfied",
      "evidence_freshness_not_checked",
      "transparency_external_receipt_not_checked"
    ]);
    for (const code of reasonCodes) {
      if (!allowedInformationalCodes.has(code)) {
        add(issues, "$.reason_codes", `An allow decision cannot contain ${code}`, "reliance.allow_reason_consistency");
      }
    }
    if (
      isRecord(value.evidence_freshness) &&
      ["future", "invalid", "stale"].includes(String(value.evidence_freshness.status))
    ) {
      add(issues, "$.evidence_freshness.status", "An allow decision cannot use failed freshness", "reliance.allow_freshness");
    }
    if (isRecord(value.evidence_freshness)) {
      const freshnessNotChecked = value.evidence_freshness.status === "not_checked";
      if (freshnessNotChecked !== reasonCodes.has("evidence_freshness_not_checked")) {
        add(
          issues,
          "$.evidence_freshness.status",
          "Freshness status and evidence_freshness_not_checked must agree",
          "reliance.allow_freshness_consistency"
        );
      }
      for (const field of [
        "attestation_age_seconds",
        "oldest_observation_age_seconds",
        "proof_age_seconds"
      ] as const) {
        if (
          typeof value.evidence_freshness[field] === "number" &&
          value.evidence_freshness[field] < 0
        ) {
          add(
            issues,
            `$.evidence_freshness.${field}`,
            "An allow decision cannot contain a negative evidence age",
            "reliance.allow_freshness_age"
          );
        }
      }
      if (
        isDateTime(value.evidence_freshness.attestation_expires_at) &&
        isDateTime(value.evaluated_at) &&
        Date.parse(value.evidence_freshness.attestation_expires_at) <=
          Date.parse(value.evaluated_at)
      ) {
        add(
          issues,
          "$.evidence_freshness.attestation_expires_at",
          "An allow decision requires attestation expiry after evaluation time",
          "reliance.allow_freshness_expiry"
        );
      }
    }
    if (!isRecord(value.policy_evaluation)) {
      add(issues, "$.policy_evaluation", "An allow decision requires a policy evaluation", "reliance.allow_policy");
    } else if (value.policy_evaluation.decision !== "passed") {
      add(issues, "$.policy_evaluation.decision", "An allow decision requires a passing policy evaluation", "reliance.allow_policy");
    } else {
      if (
        !Array.isArray(value.policy_evaluation.rules) ||
        !value.policy_evaluation.rules.some(
          (rule) => isRecord(rule) && rule.status === "passed"
        )
      ) {
        add(issues, "$.policy_evaluation.rules", "An allow decision requires at least one passed policy rule", "reliance.allow_policy_rule");
      }
      if (value.policy_evaluation.evaluated_at !== value.evaluated_at) {
        add(issues, "$.policy_evaluation.evaluated_at", "Policy evaluation time must match the reliance decision", "reliance.allow_policy_binding");
      }
      if (isRecord(value.policy_evaluation.policy) && isRecord(value.artifact_digests)) {
        if (value.policy_evaluation.policy.digest !== value.artifact_digests.policy) {
          add(issues, "$.policy_evaluation.policy.digest", "Policy evaluation must bind the decision policy digest", "reliance.allow_policy_binding");
        }
      }
      if (isRecord(value.policy_evaluation.context) && isRecord(value.request)) {
        const contextBindings = [
          ["expected_origin", "origin"],
          ["expected_revision", "expected_revision"]
        ] as const;
        for (const [contextField, requestField] of contextBindings) {
          if (value.policy_evaluation.context[contextField] !== value.request[requestField]) {
            add(issues, `$.policy_evaluation.context.${contextField}`, "Policy evaluation context must match the reliance request", "reliance.allow_policy_binding");
          }
        }
        const requestEnvironment = value.request.environment;
        if (
          !["production", "staging", "test", "development"].includes(
            String(requestEnvironment)
          )
        ) {
          add(
            issues,
            "$.request.environment",
            "An allow decision requires a supported environment",
            "reliance.allow_environment"
          );
        }
        if (value.policy_evaluation.context.environment !== requestEnvironment) {
          add(
            issues,
            "$.policy_evaluation.context.environment",
            "Policy evaluation environment must match the reliance request",
            "reliance.allow_policy_binding"
          );
        }
      }
      if (isRecord(value.policy_evaluation.subjects) && isRecord(value.artifact_digests)) {
        const subjectBindings: Array<[string, string]> = [
          ["attestation_digest", "attestation"],
          ["contract_digest", "contract"],
          ["observations_digest", "observations"],
          ["proof_digest", "proof"]
        ];
        if (isRecord(value.checks) && value.checks.transparency === "passed") {
          subjectBindings.push(
            ["transparency_index_digest", "transparency_index"],
            ["transparency_trust_store_digest", "transparency_trust_store"]
          );
          if (
            value.policy_evaluation.subjects.transparency_prior_index_digest !== undefined ||
            value.artifact_digests.transparency_prior_index !== undefined
          ) {
            subjectBindings.push([
              "transparency_prior_index_digest",
              "transparency_prior_index"
            ]);
          }
        }
        for (const [subjectField, digestField] of subjectBindings) {
          if (value.policy_evaluation.subjects[subjectField] !== value.artifact_digests[digestField]) {
            add(issues, `$.policy_evaluation.subjects.${subjectField}`, "Policy evaluation subject must match the reliance artifact digest", "reliance.allow_policy_binding");
          }
        }
      }
    }
    if (isRecord(value.artifact_digests)) {
      for (const field of ["attestation", "contract", "observations", "policy", "proof", "trust_store"] as const) {
        if (!isDigest(value.artifact_digests[field])) {
          add(issues, `$.artifact_digests.${field}`, "An allow decision requires this bound digest", "reliance.allow_digest");
        }
      }
      if (isRecord(value.checks) && value.checks.transparency === "passed") {
        for (const field of ["transparency_index", "transparency_trust_store"] as const) {
          if (!isDigest(value.artifact_digests[field])) {
            add(
              issues,
              `$.artifact_digests.${field}`,
              "Passed transparency requires this bound digest",
              "reliance.allow_transparency_digest"
            );
          }
        }
      }
    }
    if (isRecord(value.request)) {
      if (!canonicalOrigin(value.request.origin)) {
        add(issues, "$.request.origin", "An allow decision requires a canonical HTTP(S) origin", "reliance.allow_origin");
      }
      if (
        typeof value.request.expected_revision !== "string" ||
        !/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(value.request.expected_revision)
      ) {
        add(issues, "$.request.expected_revision", "An allow decision requires a full lowercase source revision", "reliance.allow_revision");
      }
      for (const field of ["expected_deployment_id", "operation_id"] as const) {
        if (!nonEmptyString(value.request[field])) {
          add(issues, `$.request.${field}`, "An allow decision requires a non-empty binding", "reliance.allow_request_binding");
        }
      }
    }
  }

  if (
    reasonCodes.has("transparency_external_receipt_not_checked") &&
    (!isRecord(value.checks) || value.checks.transparency !== "passed")
  ) {
    add(
      issues,
      "$.reason_codes",
      "The external-receipt warning requires passed transparency",
      "reliance.transparency_receipt_consistency"
    );
  }

  if (value.verdict === "confirm") {
    if (!reasonCodes.has("confirmation_required")) {
      add(issues, "$.reason_codes", "A confirm decision requires confirmation_required", "reliance.confirm_reason");
    }
  } else if (reasonCodes.has("confirmation_required")) {
    add(issues, "$.reason_codes", "confirmation_required is valid only for a confirm decision", "reliance.confirm_reason_consistency");
  }

  if (
    (value.verdict === "deny" || value.verdict === "indeterminate") &&
    reasonCodes.has("requirements_satisfied")
  ) {
    add(issues, "$.reason_codes", "A denied or indeterminate decision cannot satisfy requirements", "reliance.denial_reason_consistency");
  }

  if (isRecord(value.checks) && isRecord(value.policy_evaluation)) {
    if (value.checks.policy === "passed" && value.policy_evaluation.decision !== "passed") {
      add(issues, "$.checks.policy", "A passed policy check requires a passing policy evaluation", "reliance.policy_check_consistency");
    }
    if (value.policy_evaluation.decision !== "passed" && value.checks.policy !== "failed") {
      add(issues, "$.checks.policy", "Policy check does not match policy evaluation", "reliance.policy_check_consistency");
    }
  }

  return issues.length > 0
    ? { issues, ok: false }
    : { issues, ok: true, value: value as unknown as AICRelianceDecision };
}
