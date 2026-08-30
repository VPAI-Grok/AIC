import type {
  AICRisk,
  AICValidationIssue,
  ValidationResult
} from "./types.js";
import type {
  AICBehaviorSurfaceKind
} from "./behavior.js";
import type {
  AICTrustEnvironment,
  AICTrustRunnerKind
} from "./trust.js";
import { isAICRfc3339DateTime } from "./date-time.js";

export const AIC_POLICY_SPEC = "aic.policy/0.1";

export type AICPolicyEvidenceLevel = "executed" | "imported" | "mixed" | "none";

export interface AICPolicyRuleMatch {
  environments?: AICTrustEnvironment[];
  operation_ids?: string[];
  risks?: AICRisk[];
}

export interface AICPolicyAttestationRequirements {
  allowed_issuer_ids?: string[];
  allowed_key_ids?: string[];
  allowed_runner_ids?: string[];
  allowed_runner_kinds?: AICTrustRunnerKind[];
  maximum_age_seconds?: number;
  maximum_validity_seconds?: number;
  observations_not_before_deployment?: boolean;
  require_expected_origin?: boolean;
  require_expected_revision?: boolean;
  require_expiry?: boolean;
  required: boolean;
}

export interface AICPolicyTransparencyRequirements {
  allowed_key_ids?: string[];
  allowed_log_ids?: string[];
  expected_checkpoint_digest?: string;
  expected_prior_checkpoint_digest?: string;
  maximum_checkpoint_age_seconds?: number;
  minimum_size?: number;
  require_consistency?: boolean;
  required: boolean;
}

export interface AICPolicyRequirements {
  allowed_evidence_levels?: AICPolicyEvidenceLevel[];
  attestation?: AICPolicyAttestationRequirements;
  maximum_observation_age_seconds?: number;
  maximum_proof_age_seconds?: number;
  observations_required?: boolean;
  parity?: "all_required";
  proof_status?: "passed";
  required_scenario_ids?: string[];
  required_surface_kinds?: AICBehaviorSurfaceKind[];
  transparency?: AICPolicyTransparencyRequirements;
}

export interface AICAssurancePolicyRule {
  id: string;
  match: AICPolicyRuleMatch;
  require: AICPolicyRequirements;
}

export interface AICAssurancePolicy {
  artifact_type: "aic_assurance_policy";
  id: string;
  rules: AICAssurancePolicyRule[];
  spec: string;
  unmatched: "allow" | "fail";
}

export type AICPolicyFindingCode =
  | "artifact_invalid"
  | "attestation_age_exceeded"
  | "attestation_expiry_required"
  | "attestation_issuer_disallowed"
  | "attestation_key_disallowed"
  | "attestation_lifetime_exceeded"
  | "attestation_required"
  | "attestation_runner_disallowed"
  | "attestation_untrusted"
  | "binding_mismatch"
  | "evidence_level_disallowed"
  | "expected_origin_required"
  | "expected_revision_required"
  | "future_evidence"
  | "observation_age_exceeded"
  | "observation_before_deployment"
  | "observations_required"
  | "parity_required"
  | "proof_age_exceeded"
  | "proof_regeneration_mismatch"
  | "proof_status_required"
  | "policy_not_fail_closed"
  | "scenario_required"
  | "surface_kind_required"
  | "transparency_attestation_missing"
  | "transparency_checkpoint_age_exceeded"
  | "transparency_checkpoint_mismatch"
  | "transparency_consistency_required"
  | "transparency_inconsistent"
  | "transparency_invalid"
  | "transparency_key_disallowed"
  | "transparency_log_disallowed"
  | "transparency_prior_checkpoint_mismatch"
  | "transparency_required"
  | "transparency_size_below_minimum"
  | "transparency_untrusted"
  | "unmatched_policy";

export const AIC_POLICY_FINDING_CODES: readonly AICPolicyFindingCode[] = [
  "artifact_invalid",
  "attestation_age_exceeded",
  "attestation_expiry_required",
  "attestation_issuer_disallowed",
  "attestation_key_disallowed",
  "attestation_lifetime_exceeded",
  "attestation_required",
  "attestation_runner_disallowed",
  "attestation_untrusted",
  "binding_mismatch",
  "evidence_level_disallowed",
  "expected_origin_required",
  "expected_revision_required",
  "future_evidence",
  "observation_age_exceeded",
  "observation_before_deployment",
  "observations_required",
  "parity_required",
  "proof_age_exceeded",
  "proof_regeneration_mismatch",
  "proof_status_required",
  "policy_not_fail_closed",
  "scenario_required",
  "surface_kind_required",
  "transparency_attestation_missing",
  "transparency_checkpoint_age_exceeded",
  "transparency_checkpoint_mismatch",
  "transparency_consistency_required",
  "transparency_inconsistent",
  "transparency_invalid",
  "transparency_key_disallowed",
  "transparency_log_disallowed",
  "transparency_prior_checkpoint_mismatch",
  "transparency_required",
  "transparency_size_below_minimum",
  "transparency_untrusted",
  "unmatched_policy"
];

export interface AICPolicyFinding {
  code: AICPolicyFindingCode;
  message: string;
  rule_id?: string;
}

export interface AICPolicyRuleEvaluation {
  findings: AICPolicyFinding[];
  id: string;
  status: "failed" | "not_applicable" | "passed";
}

export interface AICPolicyEvaluation {
  artifact_type: "aic_policy_evaluation";
  context: {
    environment?: AICTrustEnvironment;
    expected_origin?: string;
    expected_revision?: string;
  };
  decision: "failed" | "indeterminate" | "passed";
  evaluated_at: string;
  findings: AICPolicyFinding[];
  policy: {
    digest: string;
    id: string;
  };
  rules: AICPolicyRuleEvaluation[];
  spec: string;
  subjects: {
    attestation_digest?: string;
    contract_digest?: string;
    observations_digest?: string;
    proof_digest?: string;
    transparency_index_digest?: string;
    transparency_prior_index_digest?: string;
    transparency_trust_store_digest?: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function add(issues: AICValidationIssue[], path: string, message: string, rule: string): void {
  issues.push({ message, path, rule, severity: "error" });
}

function allowed(
  value: Record<string, unknown>,
  keys: string[],
  path: string,
  issues: AICValidationIssue[]
): void {
  const set = new Set(keys);
  Object.keys(value).forEach((key) => {
    if (!set.has(key)) add(issues, `${path}.${key}`, `Unknown field: ${key}`, "policy.unknown_field");
  });
}

function stringArray(
  value: unknown,
  path: string,
  issues: AICValidationIssue[],
  accepted?: readonly string[]
): void {
  if (!Array.isArray(value) || value.length === 0) {
    add(issues, path, "Expected a non-empty array", "policy.array");
    return;
  }
  const seen = new Set<string>();
  value.forEach((item, index) => {
    if (!isString(item) || (accepted && !accepted.includes(item))) {
      add(issues, `${path}[${index}]`, "Expected a supported non-empty string", "policy.array_item");
    } else if (seen.has(item)) {
      add(issues, `${path}[${index}]`, `Duplicate value: ${item}`, "policy.array_unique");
    } else {
      seen.add(item);
    }
  });
}

function positiveInteger(value: unknown, path: string, issues: AICValidationIssue[]): void {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    add(issues, path, "Expected a positive safe integer", "policy.positive_integer");
  }
}

function nonNegativeInteger(value: unknown, path: string, issues: AICValidationIssue[]): void {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    add(issues, path, "Expected a non-negative safe integer", "policy.non_negative_integer");
  }
}

export function validateAICAssurancePolicy(value: unknown): ValidationResult<AICAssurancePolicy> {
  const issues: AICValidationIssue[] = [];
  if (!isRecord(value)) {
    return { issues: [{ message: "Expected an object", path: "$", rule: "policy.object", severity: "fatal" }], ok: false };
  }
  allowed(value, ["artifact_type", "id", "rules", "spec", "unmatched"], "$", issues);
  if (value.artifact_type !== "aic_assurance_policy") add(issues, "$.artifact_type", "Expected aic_assurance_policy", "policy.artifact_type");
  if (value.spec !== AIC_POLICY_SPEC) add(issues, "$.spec", `Expected ${AIC_POLICY_SPEC}`, "policy.spec");
  if (!isString(value.id)) add(issues, "$.id", "Expected a non-empty string", "policy.id");
  if (value.unmatched !== "fail" && value.unmatched !== "allow") add(issues, "$.unmatched", "Expected fail or allow", "policy.unmatched");
  if (!Array.isArray(value.rules) || value.rules.length === 0) {
    add(issues, "$.rules", "Expected at least one rule", "policy.rules");
  }
  const ids = new Set<string>();
  for (const [index, ruleValue] of (Array.isArray(value.rules) ? value.rules : []).entries()) {
    const path = `$.rules[${index}]`;
    if (!isRecord(ruleValue)) {
      add(issues, path, "Expected an object", "policy.rule");
      continue;
    }
    allowed(ruleValue, ["id", "match", "require"], path, issues);
    if (!isString(ruleValue.id)) add(issues, `${path}.id`, "Expected a non-empty string", "policy.rule_id");
    else if (ids.has(ruleValue.id)) add(issues, `${path}.id`, `Duplicate rule id: ${ruleValue.id}`, "policy.rule_unique");
    else ids.add(ruleValue.id);

    if (!isRecord(ruleValue.match)) add(issues, `${path}.match`, "Expected an object", "policy.match");
    else {
      allowed(ruleValue.match, ["environments", "operation_ids", "risks"], `${path}.match`, issues);
      if (ruleValue.match.environments !== undefined) stringArray(ruleValue.match.environments, `${path}.match.environments`, issues, ["production", "staging", "test", "development"]);
      if (ruleValue.match.operation_ids !== undefined) stringArray(ruleValue.match.operation_ids, `${path}.match.operation_ids`, issues);
      if (ruleValue.match.risks !== undefined) stringArray(ruleValue.match.risks, `${path}.match.risks`, issues, ["low", "medium", "high", "critical"]);
    }

    if (!isRecord(ruleValue.require)) {
      add(issues, `${path}.require`, "Expected an object", "policy.require");
      continue;
    }
    const req = ruleValue.require;
    allowed(req, ["allowed_evidence_levels", "attestation", "maximum_observation_age_seconds", "maximum_proof_age_seconds", "observations_required", "parity", "proof_status", "required_scenario_ids", "required_surface_kinds", "transparency"], `${path}.require`, issues);
    if (req.allowed_evidence_levels !== undefined) stringArray(req.allowed_evidence_levels, `${path}.require.allowed_evidence_levels`, issues, ["executed", "imported", "mixed", "none"]);
    if (req.maximum_observation_age_seconds !== undefined) positiveInteger(req.maximum_observation_age_seconds, `${path}.require.maximum_observation_age_seconds`, issues);
    if (req.maximum_proof_age_seconds !== undefined) positiveInteger(req.maximum_proof_age_seconds, `${path}.require.maximum_proof_age_seconds`, issues);
    if (req.observations_required !== undefined && typeof req.observations_required !== "boolean") add(issues, `${path}.require.observations_required`, "Expected a boolean", "policy.boolean");
    if (req.parity !== undefined && req.parity !== "all_required") add(issues, `${path}.require.parity`, "Expected all_required", "policy.parity");
    if (req.proof_status !== undefined && req.proof_status !== "passed") add(issues, `${path}.require.proof_status`, "Expected passed", "policy.proof_status");
    if (req.required_scenario_ids !== undefined) stringArray(req.required_scenario_ids, `${path}.require.required_scenario_ids`, issues);
    if (req.required_surface_kinds !== undefined) stringArray(req.required_surface_kinds, `${path}.require.required_surface_kinds`, issues, ["human_ui", "webmcp", "mcp", "openapi", "custom"]);
    if (req.transparency !== undefined) {
      if (!isRecord(req.transparency)) add(issues, `${path}.require.transparency`, "Expected an object", "policy.transparency");
      else {
        const transparency = req.transparency;
        allowed(transparency, ["allowed_key_ids", "allowed_log_ids", "expected_checkpoint_digest", "expected_prior_checkpoint_digest", "maximum_checkpoint_age_seconds", "minimum_size", "require_consistency", "required"], `${path}.require.transparency`, issues);
        if (typeof transparency.required !== "boolean") add(issues, `${path}.require.transparency.required`, "Expected a boolean", "policy.transparency_required");
        if (transparency.allowed_log_ids !== undefined) stringArray(transparency.allowed_log_ids, `${path}.require.transparency.allowed_log_ids`, issues);
        if (transparency.allowed_key_ids !== undefined) {
          stringArray(transparency.allowed_key_ids, `${path}.require.transparency.allowed_key_ids`, issues);
          (Array.isArray(transparency.allowed_key_ids) ? transparency.allowed_key_ids : []).forEach((keyId, keyIndex) => {
            if (typeof keyId !== "string" || !/^sha256:[0-9a-f]{64}$/.test(keyId)) add(issues, `${path}.require.transparency.allowed_key_ids[${keyIndex}]`, "Expected a SHA-256 key id", "policy.key_id");
          });
        }
        if (transparency.expected_checkpoint_digest !== undefined && !/^sha256:[0-9a-f]{64}$/.test(String(transparency.expected_checkpoint_digest))) {
          add(issues, `${path}.require.transparency.expected_checkpoint_digest`, "Expected a SHA-256 checkpoint digest", "policy.digest");
        }
        if (transparency.expected_prior_checkpoint_digest !== undefined && !/^sha256:[0-9a-f]{64}$/.test(String(transparency.expected_prior_checkpoint_digest))) {
          add(issues, `${path}.require.transparency.expected_prior_checkpoint_digest`, "Expected a SHA-256 prior checkpoint digest", "policy.digest");
        }
        if (transparency.maximum_checkpoint_age_seconds !== undefined) positiveInteger(transparency.maximum_checkpoint_age_seconds, `${path}.require.transparency.maximum_checkpoint_age_seconds`, issues);
        if (transparency.minimum_size !== undefined) positiveInteger(transparency.minimum_size, `${path}.require.transparency.minimum_size`, issues);
        if (transparency.require_consistency !== undefined && typeof transparency.require_consistency !== "boolean") {
          add(issues, `${path}.require.transparency.require_consistency`, "Expected a boolean", "policy.boolean");
        }
        const rollbackFields = [
          "allowed_log_ids",
          "allowed_key_ids",
          "expected_checkpoint_digest",
          "expected_prior_checkpoint_digest",
          "maximum_checkpoint_age_seconds",
          "minimum_size",
          "require_consistency"
        ];
        if (transparency.required === false && rollbackFields.some((field) => transparency[field] !== undefined)) {
          add(issues, `${path}.require.transparency.required`, "Transparency pins require required=true", "policy.transparency_consistency");
        }
        if (
          transparency.required === true &&
          transparency.expected_checkpoint_digest === undefined &&
          transparency.maximum_checkpoint_age_seconds === undefined &&
          !(
            transparency.require_consistency === true &&
            transparency.expected_prior_checkpoint_digest !== undefined
          )
        ) {
          add(
            issues,
            `${path}.require.transparency`,
            "Required transparency needs checkpoint freshness, an exact checkpoint digest, or consumer-pinned prior consistency; minimum_size alone is not a rollback defense",
            "policy.transparency_rollback_defense"
          );
        }
        if (
          transparency.require_consistency === true &&
          transparency.expected_prior_checkpoint_digest === undefined
        ) {
          add(
            issues,
            `${path}.require.transparency.expected_prior_checkpoint_digest`,
            "Consistency requires a consumer-pinned prior checkpoint digest",
            "policy.transparency_prior_pin"
          );
        }
        if (
          transparency.expected_prior_checkpoint_digest !== undefined &&
          transparency.require_consistency !== true
        ) {
          add(
            issues,
            `${path}.require.transparency.require_consistency`,
            "A prior checkpoint digest requires require_consistency=true",
            "policy.transparency_prior_pin"
          );
        }
      }
    }
    if (req.attestation !== undefined) {
      if (!isRecord(req.attestation)) add(issues, `${path}.require.attestation`, "Expected an object", "policy.attestation");
      else {
        const att = req.attestation;
        allowed(att, ["allowed_issuer_ids", "allowed_key_ids", "allowed_runner_ids", "allowed_runner_kinds", "maximum_age_seconds", "maximum_validity_seconds", "observations_not_before_deployment", "require_expected_origin", "require_expected_revision", "require_expiry", "required"], `${path}.require.attestation`, issues);
        if (typeof att.required !== "boolean") add(issues, `${path}.require.attestation.required`, "Expected a boolean", "policy.attestation_required");
        if (att.allowed_issuer_ids !== undefined) stringArray(att.allowed_issuer_ids, `${path}.require.attestation.allowed_issuer_ids`, issues);
        if (att.allowed_key_ids !== undefined) {
          stringArray(att.allowed_key_ids, `${path}.require.attestation.allowed_key_ids`, issues);
          (Array.isArray(att.allowed_key_ids) ? att.allowed_key_ids : []).forEach((keyId, keyIndex) => {
            if (typeof keyId !== "string" || !/^sha256:[0-9a-f]{64}$/.test(keyId)) add(issues, `${path}.require.attestation.allowed_key_ids[${keyIndex}]`, "Expected a SHA-256 key id", "policy.key_id");
          });
        }
        if (att.allowed_runner_ids !== undefined) stringArray(att.allowed_runner_ids, `${path}.require.attestation.allowed_runner_ids`, issues);
        if (att.allowed_runner_kinds !== undefined) stringArray(att.allowed_runner_kinds, `${path}.require.attestation.allowed_runner_kinds`, issues, ["github_actions", "ci", "local", "remote"]);
        if (att.maximum_age_seconds !== undefined) positiveInteger(att.maximum_age_seconds, `${path}.require.attestation.maximum_age_seconds`, issues);
        if (att.maximum_validity_seconds !== undefined) positiveInteger(att.maximum_validity_seconds, `${path}.require.attestation.maximum_validity_seconds`, issues);
        ["observations_not_before_deployment", "require_expected_origin", "require_expected_revision", "require_expiry"].forEach((field) => {
          if (att[field] !== undefined && typeof att[field] !== "boolean") add(issues, `${path}.require.attestation.${field}`, "Expected a boolean", "policy.boolean");
        });
      }
    }
  }
  return issues.length > 0 ? { issues, ok: false } : { issues, ok: true, value: value as unknown as AICAssurancePolicy };
}

export function validateAICPolicyEvaluation(value: unknown): ValidationResult<AICPolicyEvaluation> {
  const issues: AICValidationIssue[] = [];
  if (!isRecord(value)) {
    return { issues: [{ message: "Expected an object", path: "$", rule: "policy_evaluation.object", severity: "fatal" }], ok: false };
  }
  allowed(value, ["artifact_type", "context", "decision", "evaluated_at", "findings", "policy", "rules", "spec", "subjects"], "$", issues);
  if (value.artifact_type !== "aic_policy_evaluation") add(issues, "$.artifact_type", "Expected aic_policy_evaluation", "policy_evaluation.artifact_type");
  if (value.spec !== AIC_POLICY_SPEC) add(issues, "$.spec", `Expected ${AIC_POLICY_SPEC}`, "policy_evaluation.spec");
  if (!isAICRfc3339DateTime(value.evaluated_at)) add(issues, "$.evaluated_at", "Expected an ISO date-time", "policy_evaluation.time");
  if (!["passed", "failed", "indeterminate"].includes(String(value.decision))) add(issues, "$.decision", "Expected passed, failed, or indeterminate", "policy_evaluation.decision");
  if (!isRecord(value.policy)) add(issues, "$.policy", "Expected an object", "policy_evaluation.policy");
  else {
    allowed(value.policy, ["digest", "id"], "$.policy", issues);
    if (!isString(value.policy.id)) add(issues, "$.policy.id", "Expected a non-empty string", "policy_evaluation.policy_id");
    if (!/^sha256:[0-9a-f]{64}$/.test(String(value.policy.digest))) add(issues, "$.policy.digest", "Expected a SHA-256 digest", "policy_evaluation.policy_digest");
  }
  if (!isRecord(value.context)) add(issues, "$.context", "Expected an object", "policy_evaluation.context");
  else {
    allowed(value.context, ["environment", "expected_origin", "expected_revision"], "$.context", issues);
    if (value.context.environment !== undefined && !["production", "staging", "test", "development"].includes(String(value.context.environment))) add(issues, "$.context.environment", "Expected a supported environment", "policy_evaluation.environment");
    if (value.context.expected_origin !== undefined && !isString(value.context.expected_origin)) add(issues, "$.context.expected_origin", "Expected a non-empty string", "policy_evaluation.origin");
    if (value.context.expected_revision !== undefined && !/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(String(value.context.expected_revision))) add(issues, "$.context.expected_revision", "Expected a full source revision", "policy_evaluation.revision");
  }
  if (!isRecord(value.subjects)) add(issues, "$.subjects", "Expected an object", "policy_evaluation.subjects");
  else {
    allowed(value.subjects, ["attestation_digest", "contract_digest", "observations_digest", "proof_digest", "transparency_index_digest", "transparency_prior_index_digest", "transparency_trust_store_digest"], "$.subjects", issues);
    Object.entries(value.subjects).forEach(([field, digest]) => {
      if (!/^sha256:[0-9a-f]{64}$/.test(String(digest))) add(issues, `$.subjects.${field}`, "Expected a SHA-256 digest", "policy_evaluation.subject_digest");
    });
  }
  const validateFinding = (finding: unknown, path: string): void => {
    if (!isRecord(finding)) { add(issues, path, "Expected an object", "policy_evaluation.finding"); return; }
    allowed(finding, ["code", "message", "rule_id"], path, issues);
    if (typeof finding.code !== "string" || !(AIC_POLICY_FINDING_CODES as readonly string[]).includes(finding.code)) add(issues, `${path}.code`, "Expected a supported finding code", "policy_evaluation.finding_code");
    if (!isString(finding.message)) add(issues, `${path}.message`, "Expected a non-empty string", "policy_evaluation.finding_message");
    if (finding.rule_id !== undefined && !isString(finding.rule_id)) add(issues, `${path}.rule_id`, "Expected a non-empty string", "policy_evaluation.finding_rule");
  };
  if (!Array.isArray(value.findings)) add(issues, "$.findings", "Expected an array", "policy_evaluation.findings");
  else value.findings.forEach((finding, index) => validateFinding(finding, `$.findings[${index}]`));
  if (!Array.isArray(value.rules)) add(issues, "$.rules", "Expected an array", "policy_evaluation.rules");
  else {
    const ruleIds = new Set<string>();
    value.rules.forEach((rule, index) => {
      const path = `$.rules[${index}]`;
      if (!isRecord(rule)) { add(issues, path, "Expected an object", "policy_evaluation.rule"); return; }
      allowed(rule, ["findings", "id", "status"], path, issues);
      if (!isString(rule.id)) add(issues, `${path}.id`, "Expected a non-empty string", "policy_evaluation.rule_id");
      else if (ruleIds.has(rule.id)) add(issues, `${path}.id`, `Duplicate rule id: ${rule.id}`, "policy_evaluation.rule_unique");
      else ruleIds.add(rule.id);
      if (!["passed", "failed", "not_applicable"].includes(String(rule.status))) add(issues, `${path}.status`, "Expected passed, failed, or not_applicable", "policy_evaluation.rule_status");
      if (!Array.isArray(rule.findings)) add(issues, `${path}.findings`, "Expected an array", "policy_evaluation.rule_findings");
      else {
        rule.findings.forEach((finding, findingIndex) => validateFinding(finding, `${path}.findings[${findingIndex}]`));
        if (rule.status === "passed" && rule.findings.length > 0) add(issues, `${path}.status`, "A passed rule cannot contain findings", "policy_evaluation.rule_consistency");
        if (rule.status === "failed" && rule.findings.length === 0) add(issues, `${path}.status`, "A failed rule must contain a finding", "policy_evaluation.rule_consistency");
      }
    });
  }
  const hasFindings = Array.isArray(value.findings) && value.findings.length > 0;
  const hasFailedRule = Array.isArray(value.rules) && value.rules.some((rule) => isRecord(rule) && rule.status === "failed");
  if (value.decision === "passed" && (hasFindings || hasFailedRule)) add(issues, "$.decision", "A passed decision cannot contain findings or failed rules", "policy_evaluation.decision_consistency");
  if (value.decision === "failed" && !hasFindings && !hasFailedRule) add(issues, "$.decision", "A failed decision must contain a finding or failed rule", "policy_evaluation.decision_consistency");
  return issues.length > 0 ? { issues, ok: false } : { issues, ok: true, value: value as unknown as AICPolicyEvaluation };
}
