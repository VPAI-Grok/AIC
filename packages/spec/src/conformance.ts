import type {
  AICBehaviorConfirmationResult,
  AICBehaviorRequirementPhase,
  AICBehaviorResultStatus
} from "./behavior.js";
import type {
  AICValidationIssue,
  AICValidationSeverity,
  ValidationResult
} from "./types.js";
import { isAICRfc3339DateTime as isIsoDateTime } from "./date-time.js";

export const AIC_CONFORMANCE_SPEC = "aic.conformance/0.1";

export const AIC_CONFORMANCE_SCENARIO_CLASSES = [
  "success",
  "authorization_denial",
  "confirmation_decline",
  "business_failure",
  "recovery"
] as const;

export const AIC_CONFORMANCE_SURFACE_ROLES = ["human", "agent"] as const;
export const AIC_CONFORMANCE_RESULT_LEVELS = ["contract", "proof"] as const;

export type AICConformanceScenarioClass =
  (typeof AIC_CONFORMANCE_SCENARIO_CLASSES)[number];
export type AICConformanceSurfaceRole =
  (typeof AIC_CONFORMANCE_SURFACE_ROLES)[number];
export type AICConformanceResultLevel =
  (typeof AIC_CONFORMANCE_RESULT_LEVELS)[number];

export interface AICConformanceRequirementObligation {
  description: string;
  id: string;
  minimum_bindings: number;
  phase: AICBehaviorRequirementPhase;
}

export interface AICConformanceScenarioObligation {
  allowed_confirmations?: AICBehaviorConfirmationResult[];
  allowed_statuses: AICBehaviorResultStatus[];
  class: AICConformanceScenarioClass;
  forbidden_requirement_refs?: string[];
  id: string;
  parity: "independent" | "required";
  requirement_refs: string[];
  surface_roles: AICConformanceSurfaceRole[];
}

export interface AICConformanceProfile {
  description: string;
  id: string;
  required_scenario_classes: AICConformanceScenarioClass[];
  requirements: AICConformanceRequirementObligation[];
  scenarios: AICConformanceScenarioObligation[];
  title: string;
}

export interface AICConformancePack {
  artifact_type: "aic_conformance_pack";
  description: string;
  id: string;
  profiles: AICConformanceProfile[];
  spec: string;
  title: string;
  version: string;
}

export interface AICConformanceBinding {
  artifact_type: "aic_conformance_binding";
  authored: true;
  contract: {
    digest: string;
    id: string;
  };
  pack: {
    digest: string;
    id: string;
    profile: string;
    version: string;
  };
  requirement_map: Record<string, string[]>;
  scenario_map: Record<string, string[]>;
  spec: string;
  surface_roles: Record<AICConformanceSurfaceRole, string[]>;
}

export const AIC_CONFORMANCE_FINDING_CODES = [
  "authored_binding_required",
  "binding_invalid",
  "contract_binding_mismatch",
  "contract_invalid",
  "mapping_reused",
  "mapping_unknown",
  "pack_binding_mismatch",
  "pack_invalid",
  "proof_contract_mismatch",
  "proof_invalid",
  "proof_parity_failed",
  "proof_scenario_failed",
  "proof_scenario_missing",
  "proof_status_failed",
  "requirement_binding_count",
  "requirement_obligation_missing",
  "requirement_phase_mismatch",
  "scenario_confirmation_mismatch",
  "scenario_forbidden_requirement_mismatch",
  "scenario_obligation_missing",
  "scenario_parity_mismatch",
  "scenario_requirement_mismatch",
  "scenario_status_mismatch",
  "scenario_surface_role_mismatch",
  "surface_role_invalid",
  "unknown_profile"
] as const;

export type AICConformanceFindingCode =
  (typeof AIC_CONFORMANCE_FINDING_CODES)[number];

export interface AICConformanceFinding {
  code: AICConformanceFindingCode;
  message: string;
  obligation_id?: string;
  severity: "error" | "warning";
}

export interface AICConformanceResult {
  artifact_type: "aic_conformance_result";
  binding_digest: string;
  contract_digest: string;
  findings: AICConformanceFinding[];
  generated_at: string;
  level: AICConformanceResultLevel;
  pack_digest: string;
  profile_id: string;
  proof_digest?: string;
  spec: string;
  status: "failed" | "passed";
  summary: {
    errors: number;
    requirement_obligations: number;
    scenario_obligations: number;
    warnings: number;
  };
}

const REQUIREMENT_PHASES = [
  "precondition",
  "invariant",
  "side_effect",
  "postcondition",
  "recovery"
] as const;
const RESULT_STATUSES = ["succeeded", "denied", "cancelled", "failed", "recovered"] as const;
const CONFIRMATION_RESULTS = ["accepted", "declined", "not_required", "not_reached"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStableId(value: unknown): value is string {
  return isNonEmptyString(value) && /^[a-z0-9][a-z0-9._-]*$/i.test(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function pushIssue(
  issues: AICValidationIssue[],
  severity: AICValidationSeverity,
  path: string,
  message: string,
  rule: string
): void {
  issues.push({ message, path, rule, severity });
}

function createResult<T>(value: T, issues: AICValidationIssue[]): ValidationResult<T> {
  const blocked = issues.some((issue) => issue.severity === "error" || issue.severity === "fatal");
  return blocked ? { issues, ok: false } : { issues, ok: true, value };
}

function validateAllowedKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: AICValidationIssue[],
  rule: string
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      pushIssue(issues, "error", `${path}.${key}`, `Unknown field: ${key}`, rule);
    }
  }
}

function validateStringField(
  value: Record<string, unknown>,
  field: string,
  path: string,
  issues: AICValidationIssue[],
  rule: string,
  stable = false
): void {
  if (!(stable ? isStableId(value[field]) : isNonEmptyString(value[field]))) {
    pushIssue(
      issues,
      "error",
      `${path}.${field}`,
      stable ? "Expected a stable identifier" : "Expected a non-empty string",
      rule
    );
  }
}

function validateUniqueStringArray(
  value: unknown,
  path: string,
  issues: AICValidationIssue[],
  rule: string,
  options: { allowEmpty?: boolean; allowed?: readonly string[]; stable?: boolean } = {}
): string[] {
  if (!Array.isArray(value) || (!options.allowEmpty && value.length === 0)) {
    pushIssue(
      issues,
      "error",
      path,
      options.allowEmpty ? "Expected an array" : "Expected at least one item",
      rule
    );
    return [];
  }

  const result: string[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const validString = options.stable ? isStableId(item) : isNonEmptyString(item);
    if (!validString) {
      pushIssue(issues, "error", `${path}[${index}]`, "Expected a non-empty string", `${rule}.item`);
      return;
    }
    if (options.allowed && !options.allowed.includes(item)) {
      pushIssue(issues, "error", `${path}[${index}]`, `Unsupported value: ${item}`, `${rule}.allowed`);
      return;
    }
    if (seen.has(item)) {
      pushIssue(issues, "error", `${path}[${index}]`, `Duplicate value: ${item}`, `${rule}.unique`);
      return;
    }
    seen.add(item);
    result.push(item);
  });
  return result;
}

function validateMap(
  value: unknown,
  path: string,
  issues: AICValidationIssue[],
  rule: string
): Record<string, string[]> {
  if (!isRecord(value)) {
    pushIssue(issues, "error", path, "Expected an object", rule);
    return {};
  }
  const result: Record<string, string[]> = {};
  for (const [key, mapped] of Object.entries(value)) {
    if (!isStableId(key)) {
      pushIssue(issues, "error", `${path}.${key}`, "Expected a stable mapping key", `${rule}.key`);
      continue;
    }
    result[key] = validateUniqueStringArray(mapped, `${path}.${key}`, issues, `${rule}.values`);
  }
  return result;
}

function validateScenarioClassSemantics(
  scenario: Record<string, unknown>,
  path: string,
  statuses: string[],
  confirmations: string[],
  issues: AICValidationIssue[]
): void {
  const scenarioClass = scenario.class;
  const expectedStatus: Partial<Record<AICConformanceScenarioClass, AICBehaviorResultStatus>> = {
    authorization_denial: "denied",
    business_failure: "failed",
    confirmation_decline: "cancelled",
    recovery: "recovered",
    success: "succeeded"
  };
  if (
    typeof scenarioClass === "string" &&
    (AIC_CONFORMANCE_SCENARIO_CLASSES as readonly string[]).includes(scenarioClass) &&
    !statuses.includes(expectedStatus[scenarioClass as AICConformanceScenarioClass] as string)
  ) {
    pushIssue(
      issues,
      "error",
      `${path}.allowed_statuses`,
      `${scenarioClass} must allow status ${expectedStatus[scenarioClass as AICConformanceScenarioClass]}`,
      "conformance.scenario.class_status"
    );
  }
  if (scenarioClass === "confirmation_decline" && !confirmations.includes("declined")) {
    pushIssue(
      issues,
      "error",
      `${path}.allowed_confirmations`,
      "confirmation_decline must explicitly allow declined confirmation",
      "conformance.scenario.class_confirmation"
    );
  }
}

export function validateAICConformancePack(
  value: unknown
): ValidationResult<AICConformancePack> {
  const issues: AICValidationIssue[] = [];
  if (!isRecord(value)) {
    pushIssue(issues, "fatal", "$", "Expected an object", "conformance_pack.object");
    return { issues, ok: false };
  }

  validateAllowedKeys(
    value,
    ["artifact_type", "description", "id", "profiles", "spec", "title", "version"],
    "$",
    issues,
    "conformance_pack.unknown_field"
  );
  if (value.artifact_type !== "aic_conformance_pack") {
    pushIssue(issues, "error", "$.artifact_type", "Expected aic_conformance_pack", "conformance_pack.artifact_type");
  }
  if (value.spec !== AIC_CONFORMANCE_SPEC) {
    pushIssue(issues, "error", "$.spec", `Expected ${AIC_CONFORMANCE_SPEC}`, "conformance_pack.spec");
  }
  validateStringField(value, "id", "$", issues, "conformance_pack.id", true);
  validateStringField(value, "title", "$", issues, "conformance_pack.title");
  validateStringField(value, "description", "$", issues, "conformance_pack.description");
  if (!isNonEmptyString(value.version) || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value.version)) {
    pushIssue(issues, "error", "$.version", "Expected a semantic version", "conformance_pack.version");
  }
  if (!Array.isArray(value.profiles) || value.profiles.length === 0) {
    pushIssue(issues, "error", "$.profiles", "Expected at least one profile", "conformance_pack.profiles");
  }

  const profileIds = new Set<string>();
  for (const [profileIndex, profileValue] of (Array.isArray(value.profiles) ? value.profiles : []).entries()) {
    const profilePath = `$.profiles[${profileIndex}]`;
    if (!isRecord(profileValue)) {
      pushIssue(issues, "error", profilePath, "Expected an object", "conformance_pack.profile");
      continue;
    }
    validateAllowedKeys(
      profileValue,
      ["description", "id", "required_scenario_classes", "requirements", "scenarios", "title"],
      profilePath,
      issues,
      "conformance_pack.profile_unknown_field"
    );
    validateStringField(profileValue, "id", profilePath, issues, "conformance_pack.profile_id", true);
    validateStringField(profileValue, "title", profilePath, issues, "conformance_pack.profile_title");
    validateStringField(profileValue, "description", profilePath, issues, "conformance_pack.profile_description");
    if (isStableId(profileValue.id)) {
      if (profileIds.has(profileValue.id)) {
        pushIssue(issues, "error", `${profilePath}.id`, `Duplicate profile id: ${profileValue.id}`, "conformance_pack.profile_unique");
      }
      profileIds.add(profileValue.id);
    }

    const requiredClasses = validateUniqueStringArray(
      profileValue.required_scenario_classes,
      `${profilePath}.required_scenario_classes`,
      issues,
      "conformance_pack.required_scenario_classes",
      { allowed: AIC_CONFORMANCE_SCENARIO_CLASSES }
    );

    if (!Array.isArray(profileValue.requirements) || profileValue.requirements.length === 0) {
      pushIssue(issues, "error", `${profilePath}.requirements`, "Expected at least one requirement obligation", "conformance_pack.requirements");
    }
    const requirementIds = new Set<string>();
    for (const [requirementIndex, requirementValue] of (Array.isArray(profileValue.requirements) ? profileValue.requirements : []).entries()) {
      const requirementPath = `${profilePath}.requirements[${requirementIndex}]`;
      if (!isRecord(requirementValue)) {
        pushIssue(issues, "error", requirementPath, "Expected an object", "conformance_pack.requirement");
        continue;
      }
      validateAllowedKeys(
        requirementValue,
        ["description", "id", "minimum_bindings", "phase"],
        requirementPath,
        issues,
        "conformance_pack.requirement_unknown_field"
      );
      validateStringField(requirementValue, "id", requirementPath, issues, "conformance_pack.requirement_id", true);
      validateStringField(requirementValue, "description", requirementPath, issues, "conformance_pack.requirement_description");
      if (isStableId(requirementValue.id)) {
        if (requirementIds.has(requirementValue.id)) {
          pushIssue(issues, "error", `${requirementPath}.id`, `Duplicate requirement id: ${requirementValue.id}`, "conformance_pack.requirement_unique");
        }
        requirementIds.add(requirementValue.id);
      }
      if (!(REQUIREMENT_PHASES as readonly unknown[]).includes(requirementValue.phase)) {
        pushIssue(issues, "error", `${requirementPath}.phase`, "Expected a supported requirement phase", "conformance_pack.requirement_phase");
      }
      if (!Number.isInteger(requirementValue.minimum_bindings) || Number(requirementValue.minimum_bindings) < 1) {
        pushIssue(issues, "error", `${requirementPath}.minimum_bindings`, "Expected an integer of at least 1", "conformance_pack.minimum_bindings");
      }
    }

    if (!Array.isArray(profileValue.scenarios) || profileValue.scenarios.length === 0) {
      pushIssue(issues, "error", `${profilePath}.scenarios`, "Expected at least one scenario obligation", "conformance_pack.scenarios");
    }
    const scenarioIds = new Set<string>();
    const representedClasses = new Set<string>();
    for (const [scenarioIndex, scenarioValue] of (Array.isArray(profileValue.scenarios) ? profileValue.scenarios : []).entries()) {
      const scenarioPath = `${profilePath}.scenarios[${scenarioIndex}]`;
      if (!isRecord(scenarioValue)) {
        pushIssue(issues, "error", scenarioPath, "Expected an object", "conformance_pack.scenario");
        continue;
      }
      validateAllowedKeys(
        scenarioValue,
        ["allowed_confirmations", "allowed_statuses", "class", "forbidden_requirement_refs", "id", "parity", "requirement_refs", "surface_roles"],
        scenarioPath,
        issues,
        "conformance_pack.scenario_unknown_field"
      );
      validateStringField(scenarioValue, "id", scenarioPath, issues, "conformance_pack.scenario_id", true);
      if (isStableId(scenarioValue.id)) {
        if (scenarioIds.has(scenarioValue.id)) {
          pushIssue(issues, "error", `${scenarioPath}.id`, `Duplicate scenario id: ${scenarioValue.id}`, "conformance_pack.scenario_unique");
        }
        scenarioIds.add(scenarioValue.id);
      }
      if (!(AIC_CONFORMANCE_SCENARIO_CLASSES as readonly unknown[]).includes(scenarioValue.class)) {
        pushIssue(issues, "error", `${scenarioPath}.class`, "Expected a supported scenario class", "conformance_pack.scenario_class");
      } else {
        representedClasses.add(String(scenarioValue.class));
      }
      const statuses = validateUniqueStringArray(
        scenarioValue.allowed_statuses,
        `${scenarioPath}.allowed_statuses`,
        issues,
        "conformance_pack.allowed_statuses",
        { allowed: RESULT_STATUSES }
      );
      const confirmations = scenarioValue.allowed_confirmations === undefined
        ? []
        : validateUniqueStringArray(
            scenarioValue.allowed_confirmations,
            `${scenarioPath}.allowed_confirmations`,
            issues,
            "conformance_pack.allowed_confirmations",
            { allowed: CONFIRMATION_RESULTS }
          );
      const requiredRefs = validateUniqueStringArray(
        scenarioValue.requirement_refs,
        `${scenarioPath}.requirement_refs`,
        issues,
        "conformance_pack.requirement_refs",
        { stable: true }
      );
      const forbiddenRefs = scenarioValue.forbidden_requirement_refs === undefined
        ? []
        : validateUniqueStringArray(
            scenarioValue.forbidden_requirement_refs,
            `${scenarioPath}.forbidden_requirement_refs`,
            issues,
            "conformance_pack.forbidden_requirement_refs",
            { stable: true }
          );
      [...requiredRefs, ...forbiddenRefs].forEach((reference) => {
        if (!requirementIds.has(reference)) {
          pushIssue(issues, "error", scenarioPath, `Unknown requirement reference: ${reference}`, "conformance_pack.requirement_reference");
        }
      });
      forbiddenRefs.forEach((reference) => {
        if (requiredRefs.includes(reference)) {
          pushIssue(issues, "error", `${scenarioPath}.forbidden_requirement_refs`, `Requirement cannot be both required and forbidden: ${reference}`, "conformance_pack.requirement_reference_overlap");
        }
      });
      validateUniqueStringArray(
        scenarioValue.surface_roles,
        `${scenarioPath}.surface_roles`,
        issues,
        "conformance_pack.surface_roles",
        { allowed: AIC_CONFORMANCE_SURFACE_ROLES }
      );
      if (scenarioValue.parity !== "independent" && scenarioValue.parity !== "required") {
        pushIssue(issues, "error", `${scenarioPath}.parity`, "Expected independent or required", "conformance_pack.parity");
      }
      validateScenarioClassSemantics(scenarioValue, scenarioPath, statuses, confirmations, issues);
    }
    requiredClasses.forEach((scenarioClass) => {
      if (!representedClasses.has(scenarioClass)) {
        pushIssue(
          issues,
          "error",
          `${profilePath}.required_scenario_classes`,
          `Required scenario class is not represented: ${scenarioClass}`,
          "conformance_pack.required_scenario_class_missing"
        );
      }
    });
  }

  return createResult(value as unknown as AICConformancePack, issues);
}

export function validateAICConformanceBinding(
  value: unknown
): ValidationResult<AICConformanceBinding> {
  const issues: AICValidationIssue[] = [];
  if (!isRecord(value)) {
    pushIssue(issues, "fatal", "$", "Expected an object", "conformance_binding.object");
    return { issues, ok: false };
  }
  validateAllowedKeys(
    value,
    ["artifact_type", "authored", "contract", "pack", "requirement_map", "scenario_map", "spec", "surface_roles"],
    "$",
    issues,
    "conformance_binding.unknown_field"
  );
  if (value.artifact_type !== "aic_conformance_binding") {
    pushIssue(issues, "error", "$.artifact_type", "Expected aic_conformance_binding", "conformance_binding.artifact_type");
  }
  if (value.spec !== AIC_CONFORMANCE_SPEC) {
    pushIssue(issues, "error", "$.spec", `Expected ${AIC_CONFORMANCE_SPEC}`, "conformance_binding.spec");
  }
  if (value.authored !== true) {
    pushIssue(issues, "error", "$.authored", "An explicitly authored binding is required", "conformance_binding.authored");
  }

  if (!isRecord(value.pack)) {
    pushIssue(issues, "error", "$.pack", "Expected an object", "conformance_binding.pack");
  } else {
    validateAllowedKeys(value.pack, ["digest", "id", "profile", "version"], "$.pack", issues, "conformance_binding.pack_unknown_field");
    validateStringField(value.pack, "id", "$.pack", issues, "conformance_binding.pack_id", true);
    validateStringField(value.pack, "profile", "$.pack", issues, "conformance_binding.profile_id", true);
    validateStringField(value.pack, "version", "$.pack", issues, "conformance_binding.pack_version");
    if (!isDigest(value.pack.digest)) {
      pushIssue(issues, "error", "$.pack.digest", "Expected sha256:<64 lowercase hex characters>", "conformance_binding.pack_digest");
    }
  }
  if (!isRecord(value.contract)) {
    pushIssue(issues, "error", "$.contract", "Expected an object", "conformance_binding.contract");
  } else {
    validateAllowedKeys(value.contract, ["digest", "id"], "$.contract", issues, "conformance_binding.contract_unknown_field");
    validateStringField(value.contract, "id", "$.contract", issues, "conformance_binding.contract_id");
    if (!isDigest(value.contract.digest)) {
      pushIssue(issues, "error", "$.contract.digest", "Expected sha256:<64 lowercase hex characters>", "conformance_binding.contract_digest");
    }
  }
  validateMap(value.requirement_map, "$.requirement_map", issues, "conformance_binding.requirement_map");
  validateMap(value.scenario_map, "$.scenario_map", issues, "conformance_binding.scenario_map");

  if (!isRecord(value.surface_roles)) {
    pushIssue(issues, "error", "$.surface_roles", "Expected an object", "conformance_binding.surface_roles");
  } else {
    validateAllowedKeys(value.surface_roles, AIC_CONFORMANCE_SURFACE_ROLES, "$.surface_roles", issues, "conformance_binding.surface_roles_unknown_field");
    const human = validateUniqueStringArray(value.surface_roles.human, "$.surface_roles.human", issues, "conformance_binding.human_surfaces", { allowEmpty: true });
    const agent = validateUniqueStringArray(value.surface_roles.agent, "$.surface_roles.agent", issues, "conformance_binding.agent_surfaces", { allowEmpty: true });
    if (human.length + agent.length === 0) {
      pushIssue(issues, "error", "$.surface_roles", "Expected at least one bound surface", "conformance_binding.surface_roles_empty");
    }
    const overlap = human.filter((surfaceId) => agent.includes(surfaceId));
    if (overlap.length > 0) {
      pushIssue(issues, "error", "$.surface_roles", `Surface roles overlap: ${overlap.join(", ")}`, "conformance_binding.surface_roles_overlap");
    }
  }
  return createResult(value as unknown as AICConformanceBinding, issues);
}

export function validateAICConformanceResult(
  value: unknown
): ValidationResult<AICConformanceResult> {
  const issues: AICValidationIssue[] = [];
  if (!isRecord(value)) {
    pushIssue(issues, "fatal", "$", "Expected an object", "conformance_result.object");
    return { issues, ok: false };
  }
  validateAllowedKeys(
    value,
    ["artifact_type", "binding_digest", "contract_digest", "findings", "generated_at", "level", "pack_digest", "profile_id", "proof_digest", "spec", "status", "summary"],
    "$",
    issues,
    "conformance_result.unknown_field"
  );
  if (value.artifact_type !== "aic_conformance_result") {
    pushIssue(issues, "error", "$.artifact_type", "Expected aic_conformance_result", "conformance_result.artifact_type");
  }
  if (value.spec !== AIC_CONFORMANCE_SPEC) {
    pushIssue(issues, "error", "$.spec", `Expected ${AIC_CONFORMANCE_SPEC}`, "conformance_result.spec");
  }
  if (!isIsoDateTime(value.generated_at)) {
    pushIssue(issues, "error", "$.generated_at", "Expected an ISO date-time", "conformance_result.generated_at");
  }
  if (!(AIC_CONFORMANCE_RESULT_LEVELS as readonly unknown[]).includes(value.level)) {
    pushIssue(issues, "error", "$.level", "Expected contract or proof", "conformance_result.level");
  }
  if (value.status !== "passed" && value.status !== "failed") {
    pushIssue(issues, "error", "$.status", "Expected passed or failed", "conformance_result.status");
  }
  validateStringField(value, "profile_id", "$", issues, "conformance_result.profile_id", true);
  ["pack_digest", "binding_digest", "contract_digest"].forEach((field) => {
    if (!isDigest(value[field])) {
      pushIssue(issues, "error", `$.${field}`, "Expected sha256:<64 lowercase hex characters>", `conformance_result.${field}`);
    }
  });
  if (value.proof_digest !== undefined && !isDigest(value.proof_digest)) {
    pushIssue(issues, "error", "$.proof_digest", "Expected sha256:<64 lowercase hex characters>", "conformance_result.proof_digest");
  }
  if (value.level === "proof" && value.proof_digest === undefined) {
    pushIssue(issues, "error", "$.proof_digest", "Proof-level results require a proof digest", "conformance_result.proof_required");
  }
  if (value.level === "contract" && value.proof_digest !== undefined) {
    pushIssue(issues, "error", "$.proof_digest", "Contract-level results cannot include a proof digest", "conformance_result.proof_forbidden");
  }

  let errors = 0;
  let warnings = 0;
  if (!Array.isArray(value.findings)) {
    pushIssue(issues, "error", "$.findings", "Expected an array", "conformance_result.findings");
  } else {
    value.findings.forEach((findingValue, index) => {
      const path = `$.findings[${index}]`;
      if (!isRecord(findingValue)) {
        pushIssue(issues, "error", path, "Expected an object", "conformance_result.finding");
        return;
      }
      validateAllowedKeys(findingValue, ["code", "message", "obligation_id", "severity"], path, issues, "conformance_result.finding_unknown_field");
      if (!(AIC_CONFORMANCE_FINDING_CODES as readonly unknown[]).includes(findingValue.code)) {
        pushIssue(issues, "error", `${path}.code`, "Expected a supported conformance finding code", "conformance_result.finding_code");
      }
      validateStringField(findingValue, "message", path, issues, "conformance_result.finding_message");
      if (findingValue.obligation_id !== undefined && !isStableId(findingValue.obligation_id)) {
        pushIssue(issues, "error", `${path}.obligation_id`, "Expected a stable identifier", "conformance_result.finding_obligation");
      }
      if (findingValue.severity === "error") errors += 1;
      else if (findingValue.severity === "warning") warnings += 1;
      else pushIssue(issues, "error", `${path}.severity`, "Expected error or warning", "conformance_result.finding_severity");
    });
  }

  if (!isRecord(value.summary)) {
    pushIssue(issues, "error", "$.summary", "Expected an object", "conformance_result.summary");
  } else {
    const summary = value.summary;
    validateAllowedKeys(summary, ["errors", "requirement_obligations", "scenario_obligations", "warnings"], "$.summary", issues, "conformance_result.summary_unknown_field");
    ["errors", "warnings", "requirement_obligations", "scenario_obligations"].forEach((field) => {
      if (!Number.isInteger(summary[field]) || Number(summary[field]) < 0) {
        pushIssue(issues, "error", `$.summary.${field}`, "Expected a non-negative integer", `conformance_result.summary_${field}`);
      }
    });
    if (summary.errors !== errors || summary.warnings !== warnings) {
      pushIssue(issues, "error", "$.summary", "Finding counts do not match the summary", "conformance_result.summary_counts");
    }
  }
  if ((errors === 0 && value.status !== "passed") || (errors > 0 && value.status !== "failed")) {
    pushIssue(issues, "error", "$.status", "Status does not match error findings", "conformance_result.status_consistency");
  }
  return createResult(value as unknown as AICConformanceResult, issues);
}
