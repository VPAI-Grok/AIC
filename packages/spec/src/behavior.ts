import type {
  AICEntityRef,
  AICRisk,
  AICValidationIssue,
  AICValidationSeverity,
  JsonValue,
  ValidationResult
} from "./types.js";

export const AIC_BEHAVIOR_SPEC = "aic.behavior/0.1";
export const AIC_BEHAVIOR_PROOF_VERSION = "0.1";

export const AIC_BEHAVIOR_SURFACE_KINDS = [
  "human_ui",
  "webmcp",
  "mcp",
  "openapi",
  "custom"
] as const;

export const AIC_BEHAVIOR_REQUIREMENT_PHASES = [
  "precondition",
  "invariant",
  "side_effect",
  "postcondition",
  "recovery"
] as const;

export const AIC_BEHAVIOR_RESULT_STATUSES = [
  "succeeded",
  "denied",
  "cancelled",
  "failed",
  "recovered"
] as const;

export const AIC_BEHAVIOR_CONFIRMATION_RESULTS = [
  "accepted",
  "declined",
  "not_required",
  "not_reached"
] as const;

export type AICBehaviorSurfaceKind = (typeof AIC_BEHAVIOR_SURFACE_KINDS)[number];
export type AICBehaviorRequirementPhase = (typeof AIC_BEHAVIOR_REQUIREMENT_PHASES)[number];
export type AICBehaviorResultStatus = (typeof AIC_BEHAVIOR_RESULT_STATUSES)[number];
export type AICBehaviorConfirmationResult =
  (typeof AIC_BEHAVIOR_CONFIRMATION_RESULTS)[number];

export interface AICBehaviorSurface {
  adapter?: string;
  entrypoint: string;
  id: string;
  kind: AICBehaviorSurfaceKind;
  label: string;
  protocol_version?: string;
}

export interface AICBehaviorRequirement {
  description: string;
  id: string;
  phase: AICBehaviorRequirementPhase;
}

export interface AICBehaviorExpectedResult {
  confirmation?: AICBehaviorConfirmationResult;
  error_code?: string;
  forbidden_requirements?: string[];
  outcome?: JsonValue;
  required_requirements: string[];
  status: AICBehaviorResultStatus;
}

export interface AICBehaviorScenario {
  description?: string;
  expected: AICBehaviorExpectedResult;
  id: string;
  parity: "independent" | "required";
  surfaces: string[];
  title: string;
}

export interface AICBehaviorContract {
  action: {
    entity?: AICEntityRef;
    id: string;
    operation_id: string;
    risk: AICRisk;
  };
  artifact_type: "aic_behavior_contract";
  description: string;
  id: string;
  requirements: AICBehaviorRequirement[];
  scenarios: AICBehaviorScenario[];
  spec: string;
  surfaces: AICBehaviorSurface[];
  title: string;
}

export interface AICBehaviorObservationCheck {
  actual?: JsonValue;
  message?: string;
  passed: boolean;
  requirement_id: string;
}

export interface AICBehaviorEvidenceReference {
  digest?: string;
  kind: "log" | "receipt" | "screenshot" | "trace" | "other";
  ref: string;
}

export interface AICBehaviorObservation {
  artifact_type: "aic_behavior_observation";
  captured_at: string;
  checks: AICBehaviorObservationCheck[];
  confirmation?: AICBehaviorConfirmationResult;
  contract_id: string;
  duration_ms?: number;
  environment?: Record<string, string>;
  error_code?: string;
  evidence?: AICBehaviorEvidenceReference[];
  mode: "executed" | "imported";
  operation_id: string;
  outcome?: JsonValue;
  scenario_id: string;
  status: AICBehaviorResultStatus;
  surface_id: string;
}

export interface AICBehaviorObservationSet {
  artifact_type: "aic_behavior_observation_set";
  contract_id: string;
  generated_at: string;
  observations: AICBehaviorObservation[];
}

export type AICBehaviorProofFindingCode =
  | "confirmation_mismatch"
  | "contract_invalid"
  | "duplicate_observation"
  | "error_code_mismatch"
  | "forbidden_requirement_observed"
  | "forbidden_requirement_unchecked"
  | "generated_at_invalid"
  | "missing_observation"
  | "observation_check_failed"
  | "observation_contract_mismatch"
  | "observation_invalid"
  | "operation_mismatch"
  | "outcome_mismatch"
  | "parity_mismatch"
  | "required_requirement_failed"
  | "required_requirement_missing"
  | "status_mismatch"
  | "unknown_requirement"
  | "unknown_scenario"
  | "unknown_surface";

export interface AICBehaviorProofFinding {
  code: AICBehaviorProofFindingCode;
  message: string;
  requirement_id?: string;
  scenario_id?: string;
  severity: "error" | "warning";
  surface_id?: string;
}

export interface AICBehaviorProofSurfaceResult {
  finding_count: number;
  observation_mode?: AICBehaviorObservation["mode"];
  status: "failed" | "passed";
  surface_id: string;
}

export interface AICBehaviorProofScenarioResult {
  finding_count: number;
  parity: "failed" | "not_required" | "passed";
  scenario_id: string;
  status: "failed" | "passed";
  surfaces: AICBehaviorProofSurfaceResult[];
}

export interface AICBehaviorProof {
  artifact_type: "aic_behavior_proof";
  contract: {
    digest: string;
    id: string;
    spec: string;
  };
  evidence_level: "executed" | "imported" | "mixed" | "none";
  findings: AICBehaviorProofFinding[];
  generated_at: string;
  observations_digest: string;
  proof_version: string;
  scenarios: AICBehaviorProofScenarioResult[];
  status: "failed" | "passed";
  summary: {
    failed_scenarios: number;
    observations: number;
    passed_scenarios: number;
    required_observations: number;
    scenarios: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item));
}

function isIsoDateTime(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function findDuplicateStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  });
  return [...duplicates];
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || ["boolean", "number", "string"].includes(typeof value)) {
    return typeof value !== "number" || Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item));
  }

  return isRecord(value) && Object.values(value).every((item) => isJsonValue(item));
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

function hasBlockingIssues(issues: AICValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error" || issue.severity === "fatal");
}

function createResult<T>(value: T, issues: AICValidationIssue[]): ValidationResult<T> {
  return hasBlockingIssues(issues) ? { issues, ok: false } : { issues, ok: true, value };
}

function validateAllowedKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: AICValidationIssue[],
  rule: string
): void {
  const allowedKeys = new Set(allowed);
  Object.keys(value).forEach((key) => {
    if (!allowedKeys.has(key)) {
      pushIssue(issues, "error", `${path}.${key}`, `Unknown field: ${key}`, rule);
    }
  });
}

function validateUniqueIds(
  values: unknown[],
  path: string,
  issues: AICValidationIssue[],
  rule: string
): Set<string> {
  const ids = new Set<string>();

  values.forEach((value, index) => {
    if (!isRecord(value) || !isNonEmptyString(value.id)) {
      pushIssue(issues, "error", `${path}[${index}].id`, "Expected a non-empty string", `${rule}.id`);
      return;
    }

    if (ids.has(value.id)) {
      pushIssue(issues, "error", `${path}[${index}].id`, `Duplicate id: ${value.id}`, `${rule}.unique_id`);
      return;
    }

    ids.add(value.id);
  });

  return ids;
}

export function validateAICBehaviorContract(
  value: unknown
): ValidationResult<AICBehaviorContract> {
  const issues: AICValidationIssue[] = [];

  if (!isRecord(value)) {
    pushIssue(issues, "fatal", "$", "Expected an object", "behavior.object");
    return { issues, ok: false };
  }

  validateAllowedKeys(
    value,
    ["action", "artifact_type", "description", "id", "requirements", "scenarios", "spec", "surfaces", "title"],
    "$",
    issues,
    "behavior.unknown_field"
  );

  if (value.artifact_type !== "aic_behavior_contract") {
    pushIssue(
      issues,
      "error",
      "$.artifact_type",
      "Expected aic_behavior_contract",
      "behavior.artifact_type"
    );
  }

  if (value.spec !== AIC_BEHAVIOR_SPEC) {
    pushIssue(issues, "error", "$.spec", `Expected ${AIC_BEHAVIOR_SPEC}`, "behavior.spec");
  }

  (["id", "title", "description"] as const).forEach((field) => {
    if (!isNonEmptyString(value[field])) {
      pushIssue(issues, "error", `$.${field}`, "Expected a non-empty string", `behavior.${field}`);
    }
  });

  if (!isRecord(value.action)) {
    pushIssue(issues, "error", "$.action", "Expected an object", "behavior.action");
  } else {
    const action = value.action;
    validateAllowedKeys(
      action,
      ["entity", "id", "operation_id", "risk"],
      "$.action",
      issues,
      "behavior.action.unknown_field"
    );
    (["id", "operation_id"] as const).forEach((field) => {
      if (!isNonEmptyString(action[field])) {
        pushIssue(
          issues,
          "error",
          `$.action.${field}`,
          "Expected a non-empty string",
          `behavior.action.${field}`
        );
      }
    });

    if (
      typeof action.risk !== "string" ||
      !["low", "medium", "high", "critical"].includes(action.risk)
    ) {
      pushIssue(
        issues,
        "error",
        "$.action.risk",
        "Expected a supported AIC risk",
        "behavior.action.risk"
      );
    }

    if (action.entity !== undefined) {
      const entity = action.entity;
      if (
        !isRecord(entity) ||
        !isNonEmptyString(entity.entity_id) ||
        !isNonEmptyString(entity.entity_type)
      ) {
        pushIssue(
          issues,
          "error",
          "$.action.entity",
          "Expected entity_id and entity_type",
          "behavior.action.entity"
        );
      } else {
        validateAllowedKeys(
          entity,
          ["backing_resource", "entity_id", "entity_label", "entity_type", "parent_entity_id", "row_key"],
          "$.action.entity",
          issues,
          "behavior.action.entity_unknown_field"
        );
      }
    }
  }

  if (!Array.isArray(value.surfaces) || value.surfaces.length === 0) {
    pushIssue(issues, "error", "$.surfaces", "Expected at least one surface", "behavior.surfaces");
  }
  const surfaces = Array.isArray(value.surfaces) ? value.surfaces : [];
  const surfaceIds = validateUniqueIds(surfaces, "$.surfaces", issues, "behavior.surface");
  surfaces.forEach((surface, index) => {
    if (!isRecord(surface)) {
      pushIssue(issues, "error", `$.surfaces[${index}]`, "Expected an object", "behavior.surface");
      return;
    }

    validateAllowedKeys(
      surface,
      ["adapter", "entrypoint", "id", "kind", "label", "protocol_version"],
      `$.surfaces[${index}]`,
      issues,
      "behavior.surface.unknown_field"
    );

    if (
      typeof surface.kind !== "string" ||
      !(AIC_BEHAVIOR_SURFACE_KINDS as readonly string[]).includes(surface.kind)
    ) {
      pushIssue(
        issues,
        "error",
        `$.surfaces[${index}].kind`,
        "Expected a supported surface kind",
        "behavior.surface.kind"
      );
    }

    (["label", "entrypoint"] as const).forEach((field) => {
      if (!isNonEmptyString(surface[field])) {
        pushIssue(
          issues,
          "error",
          `$.surfaces[${index}].${field}`,
          "Expected a non-empty string",
          `behavior.surface.${field}`
        );
      }
    });

    (["adapter", "protocol_version"] as const).forEach((field) => {
      if (surface[field] !== undefined && !isNonEmptyString(surface[field])) {
        pushIssue(
          issues,
          "error",
          `$.surfaces[${index}].${field}`,
          "Expected a non-empty string",
          `behavior.surface.${field}`
        );
      }
    });
  });

  if (!Array.isArray(value.requirements) || value.requirements.length === 0) {
    pushIssue(
      issues,
      "error",
      "$.requirements",
      "Expected at least one behavioral requirement",
      "behavior.requirements"
    );
  }
  const requirements = Array.isArray(value.requirements) ? value.requirements : [];
  const requirementIds = validateUniqueIds(
    requirements,
    "$.requirements",
    issues,
    "behavior.requirement"
  );
  requirements.forEach((requirement, index) => {
    if (!isRecord(requirement)) {
      pushIssue(
        issues,
        "error",
        `$.requirements[${index}]`,
        "Expected an object",
        "behavior.requirement"
      );
      return;
    }

    validateAllowedKeys(
      requirement,
      ["description", "id", "phase"],
      `$.requirements[${index}]`,
      issues,
      "behavior.requirement.unknown_field"
    );

    if (!isNonEmptyString(requirement.description)) {
      pushIssue(
        issues,
        "error",
        `$.requirements[${index}].description`,
        "Expected a non-empty string",
        "behavior.requirement.description"
      );
    }

    if (
      typeof requirement.phase !== "string" ||
      !(AIC_BEHAVIOR_REQUIREMENT_PHASES as readonly string[]).includes(requirement.phase)
    ) {
      pushIssue(
        issues,
        "error",
        `$.requirements[${index}].phase`,
        "Expected a supported requirement phase",
        "behavior.requirement.phase"
      );
    }
  });

  if (!Array.isArray(value.scenarios) || value.scenarios.length === 0) {
    pushIssue(issues, "error", "$.scenarios", "Expected at least one scenario", "behavior.scenarios");
  }
  const scenarios = Array.isArray(value.scenarios) ? value.scenarios : [];
  validateUniqueIds(scenarios, "$.scenarios", issues, "behavior.scenario");
  scenarios.forEach((scenario, index) => {
    if (!isRecord(scenario)) {
      pushIssue(issues, "error", `$.scenarios[${index}]`, "Expected an object", "behavior.scenario");
      return;
    }

    validateAllowedKeys(
      scenario,
      ["description", "expected", "id", "parity", "surfaces", "title"],
      `$.scenarios[${index}]`,
      issues,
      "behavior.scenario.unknown_field"
    );

    if (!isNonEmptyString(scenario.title)) {
      pushIssue(
        issues,
        "error",
        `$.scenarios[${index}].title`,
        "Expected a non-empty string",
        "behavior.scenario.title"
      );
    }

    if (scenario.description !== undefined && !isNonEmptyString(scenario.description)) {
      pushIssue(
        issues,
        "error",
        `$.scenarios[${index}].description`,
        "Expected a non-empty string",
        "behavior.scenario.description"
      );
    }

    if (!isStringArray(scenario.surfaces) || scenario.surfaces.length === 0) {
      pushIssue(
        issues,
        "error",
        `$.scenarios[${index}].surfaces`,
        "Expected at least one surface id",
        "behavior.scenario.surfaces"
      );
    } else {
      findDuplicateStrings(scenario.surfaces).forEach((surfaceId) => {
        pushIssue(
          issues,
          "error",
          `$.scenarios[${index}].surfaces`,
          `Duplicate surface: ${surfaceId}`,
          "behavior.scenario.surface_unique"
        );
      });
      scenario.surfaces.forEach((surfaceId, surfaceIndex) => {
        if (!surfaceIds.has(surfaceId)) {
          pushIssue(
            issues,
            "error",
            `$.scenarios[${index}].surfaces[${surfaceIndex}]`,
            `Unknown surface: ${surfaceId}`,
            "behavior.scenario.surface_ref"
          );
        }
      });
    }

    if (scenario.parity !== "required" && scenario.parity !== "independent") {
      pushIssue(
        issues,
        "error",
        `$.scenarios[${index}].parity`,
        "Expected required or independent",
        "behavior.scenario.parity"
      );
    } else if (scenario.parity === "required" && (scenario.surfaces as unknown[])?.length < 2) {
      pushIssue(
        issues,
        "error",
        `$.scenarios[${index}].surfaces`,
        "Parity requires at least two surfaces",
        "behavior.scenario.parity_surfaces"
      );
    }

    if (!isRecord(scenario.expected)) {
      pushIssue(
        issues,
        "error",
        `$.scenarios[${index}].expected`,
        "Expected an object",
        "behavior.scenario.expected"
      );
      return;
    }

    const expected = scenario.expected;
    validateAllowedKeys(
      expected,
      ["confirmation", "error_code", "forbidden_requirements", "outcome", "required_requirements", "status"],
      `$.scenarios[${index}].expected`,
      issues,
      "behavior.scenario.expected_unknown_field"
    );
    if (
      typeof expected.status !== "string" ||
      !(AIC_BEHAVIOR_RESULT_STATUSES as readonly string[]).includes(expected.status)
    ) {
      pushIssue(
        issues,
        "error",
        `$.scenarios[${index}].expected.status`,
        "Expected a supported result status",
        "behavior.scenario.status"
      );
    }

    if (
      expected.confirmation !== undefined &&
      (typeof expected.confirmation !== "string" ||
        !(AIC_BEHAVIOR_CONFIRMATION_RESULTS as readonly string[]).includes(expected.confirmation))
    ) {
      pushIssue(
        issues,
        "error",
        `$.scenarios[${index}].expected.confirmation`,
        "Expected a supported confirmation result",
        "behavior.scenario.confirmation"
      );
    }

    if (expected.outcome !== undefined && !isJsonValue(expected.outcome)) {
      pushIssue(
        issues,
        "error",
        `$.scenarios[${index}].expected.outcome`,
        "Expected a JSON value",
        "behavior.scenario.outcome"
      );
    }

    if (expected.error_code !== undefined && !isNonEmptyString(expected.error_code)) {
      pushIssue(
        issues,
        "error",
        `$.scenarios[${index}].expected.error_code`,
        "Expected a non-empty string",
        "behavior.scenario.error_code"
      );
    }

    if (!isStringArray(expected.required_requirements)) {
      pushIssue(
        issues,
        "error",
        `$.scenarios[${index}].expected.required_requirements`,
        "Expected an array of requirement ids",
        "behavior.scenario.required_requirements"
      );
    }
    const requiredRequirements = isStringArray(expected.required_requirements)
      ? expected.required_requirements
      : [];
    const forbiddenRequirements =
      expected.forbidden_requirements === undefined
        ? []
        : isStringArray(expected.forbidden_requirements)
          ? expected.forbidden_requirements
          : [];

    findDuplicateStrings(requiredRequirements).forEach((requirementId) => {
      pushIssue(
        issues,
        "error",
        `$.scenarios[${index}].expected.required_requirements`,
        `Duplicate requirement: ${requirementId}`,
        "behavior.scenario.required_requirement_unique"
      );
    });
    findDuplicateStrings(forbiddenRequirements).forEach((requirementId) => {
      pushIssue(
        issues,
        "error",
        `$.scenarios[${index}].expected.forbidden_requirements`,
        `Duplicate requirement: ${requirementId}`,
        "behavior.scenario.forbidden_requirement_unique"
      );
    });

    if (
      expected.forbidden_requirements !== undefined &&
      !isStringArray(expected.forbidden_requirements)
    ) {
      pushIssue(
        issues,
        "error",
        `$.scenarios[${index}].expected.forbidden_requirements`,
        "Expected an array of requirement ids",
        "behavior.scenario.forbidden_requirements"
      );
    }

    [...requiredRequirements, ...forbiddenRequirements].forEach((requirementId) => {
      if (!requirementIds.has(requirementId)) {
        pushIssue(
          issues,
          "error",
          `$.scenarios[${index}].expected`,
          `Unknown requirement: ${requirementId}`,
          "behavior.scenario.requirement_ref"
        );
      }
    });

    requiredRequirements.forEach((requirementId) => {
      if (forbiddenRequirements.includes(requirementId)) {
        pushIssue(
          issues,
          "error",
          `$.scenarios[${index}].expected`,
          `Requirement cannot be both required and forbidden: ${requirementId}`,
          "behavior.scenario.requirement_conflict"
        );
      }
    });
  });

  return createResult(value as unknown as AICBehaviorContract, issues);
}

export function validateAICBehaviorObservationSet(
  value: unknown
): ValidationResult<AICBehaviorObservationSet> {
  const issues: AICValidationIssue[] = [];

  if (!isRecord(value)) {
    pushIssue(issues, "fatal", "$", "Expected an object", "behavior_observations.object");
    return { issues, ok: false };
  }

  validateAllowedKeys(
    value,
    ["artifact_type", "contract_id", "generated_at", "observations"],
    "$",
    issues,
    "behavior_observations.unknown_field"
  );

  if (value.artifact_type !== "aic_behavior_observation_set") {
    pushIssue(
      issues,
      "error",
      "$.artifact_type",
      "Expected aic_behavior_observation_set",
      "behavior_observations.artifact_type"
    );
  }

  if (!isNonEmptyString(value.contract_id)) {
    pushIssue(
      issues,
      "error",
      "$.contract_id",
      "Expected a non-empty string",
      "behavior_observations.contract_id"
    );
  }

  if (!isIsoDateTime(value.generated_at)) {
    pushIssue(
      issues,
      "error",
      "$.generated_at",
      "Expected an ISO date-time string",
      "behavior_observations.generated_at"
    );
  }

  if (!Array.isArray(value.observations)) {
    pushIssue(
      issues,
      "fatal",
      "$.observations",
      "Expected an array",
      "behavior_observations.observations"
    );
    return { issues, ok: false };
  }

  value.observations.forEach((observation, index) => {
    const path = `$.observations[${index}]`;
    if (!isRecord(observation)) {
      pushIssue(issues, "error", path, "Expected an object", "behavior_observation.object");
      return;
    }

    validateAllowedKeys(
      observation,
      [
        "artifact_type",
        "captured_at",
        "checks",
        "confirmation",
        "contract_id",
        "duration_ms",
        "environment",
        "error_code",
        "evidence",
        "mode",
        "operation_id",
        "outcome",
        "scenario_id",
        "status",
        "surface_id"
      ],
      path,
      issues,
      "behavior_observation.unknown_field"
    );

    if (observation.artifact_type !== "aic_behavior_observation") {
      pushIssue(
        issues,
        "error",
        `${path}.artifact_type`,
        "Expected aic_behavior_observation",
        "behavior_observation.artifact_type"
      );
    }

    (["captured_at", "contract_id", "operation_id", "scenario_id", "surface_id"] as const).forEach(
      (field) => {
        if (!isNonEmptyString(observation[field])) {
          pushIssue(
            issues,
            "error",
            `${path}.${field}`,
            "Expected a non-empty string",
            `behavior_observation.${field}`
          );
        }
      }
    );

    if (isNonEmptyString(observation.captured_at) && !isIsoDateTime(observation.captured_at)) {
      pushIssue(
        issues,
        "error",
        `${path}.captured_at`,
        "Expected an ISO date-time string",
        "behavior_observation.captured_at"
      );
    }

    if (
      observation.duration_ms !== undefined &&
      (typeof observation.duration_ms !== "number" ||
        !Number.isFinite(observation.duration_ms) ||
        observation.duration_ms < 0)
    ) {
      pushIssue(
        issues,
        "error",
        `${path}.duration_ms`,
        "Expected a finite non-negative number",
        "behavior_observation.duration_ms"
      );
    }

    if (observation.mode !== "executed" && observation.mode !== "imported") {
      pushIssue(
        issues,
        "error",
        `${path}.mode`,
        "Expected executed or imported",
        "behavior_observation.mode"
      );
    }

    if (
      typeof observation.status !== "string" ||
      !(AIC_BEHAVIOR_RESULT_STATUSES as readonly string[]).includes(observation.status)
    ) {
      pushIssue(
        issues,
        "error",
        `${path}.status`,
        "Expected a supported result status",
        "behavior_observation.status"
      );
    }

    if (
      observation.confirmation !== undefined &&
      (typeof observation.confirmation !== "string" ||
        !(AIC_BEHAVIOR_CONFIRMATION_RESULTS as readonly string[]).includes(
          observation.confirmation
        ))
    ) {
      pushIssue(
        issues,
        "error",
        `${path}.confirmation`,
        "Expected a supported confirmation result",
        "behavior_observation.confirmation"
      );
    }

    if (observation.outcome !== undefined && !isJsonValue(observation.outcome)) {
      pushIssue(
        issues,
        "error",
        `${path}.outcome`,
        "Expected a JSON value",
        "behavior_observation.outcome"
      );
    }

    if (observation.error_code !== undefined && !isNonEmptyString(observation.error_code)) {
      pushIssue(
        issues,
        "error",
        `${path}.error_code`,
        "Expected a non-empty string",
        "behavior_observation.error_code"
      );
    }

    if (
      observation.environment !== undefined &&
      (!isRecord(observation.environment) ||
        !Object.values(observation.environment).every((item) => typeof item === "string"))
    ) {
      pushIssue(
        issues,
        "error",
        `${path}.environment`,
        "Expected a string-valued object",
        "behavior_observation.environment"
      );
    }

    if (observation.evidence !== undefined) {
      if (!Array.isArray(observation.evidence)) {
        pushIssue(
          issues,
          "error",
          `${path}.evidence`,
          "Expected an array",
          "behavior_observation.evidence"
        );
      } else {
        observation.evidence.forEach((evidence, evidenceIndex) => {
          if (isRecord(evidence)) {
            validateAllowedKeys(
              evidence,
              ["digest", "kind", "ref"],
              `${path}.evidence[${evidenceIndex}]`,
              issues,
              "behavior_observation.evidence_unknown_field"
            );
          }
          if (
            !isRecord(evidence) ||
            !["log", "receipt", "screenshot", "trace", "other"].includes(
              typeof evidence.kind === "string" ? evidence.kind : ""
            ) ||
            !isNonEmptyString(evidence.ref) ||
            (evidence.digest !== undefined && !isNonEmptyString(evidence.digest))
          ) {
            pushIssue(
              issues,
              "error",
              `${path}.evidence[${evidenceIndex}]`,
              "Expected a supported kind, ref, and optional digest",
              "behavior_observation.evidence_item"
            );
          }
        });
      }
    }

    if (!Array.isArray(observation.checks)) {
      pushIssue(
        issues,
        "error",
        `${path}.checks`,
        "Expected an array",
        "behavior_observation.checks"
      );
    } else {
      observation.checks.forEach((check, checkIndex) => {
        if (isRecord(check)) {
          validateAllowedKeys(
            check,
            ["actual", "message", "passed", "requirement_id"],
            `${path}.checks[${checkIndex}]`,
            issues,
            "behavior_observation.check_unknown_field"
          );
        }
        if (
          !isRecord(check) ||
          !isNonEmptyString(check.requirement_id) ||
          typeof check.passed !== "boolean"
        ) {
          pushIssue(
            issues,
            "error",
            `${path}.checks[${checkIndex}]`,
            "Expected requirement_id and boolean passed",
            "behavior_observation.check"
          );
        } else if (check.actual !== undefined && !isJsonValue(check.actual)) {
          pushIssue(
            issues,
            "error",
            `${path}.checks[${checkIndex}].actual`,
            "Expected a JSON value",
            "behavior_observation.check_actual"
          );
        } else if (check.message !== undefined && !isNonEmptyString(check.message)) {
          pushIssue(
            issues,
            "error",
            `${path}.checks[${checkIndex}].message`,
            "Expected a non-empty string",
            "behavior_observation.check_message"
          );
        }
      });

      const checkIds = new Set<string>();
      observation.checks.forEach((check, checkIndex) => {
        if (!isRecord(check) || !isNonEmptyString(check.requirement_id)) {
          return;
        }

        if (checkIds.has(check.requirement_id)) {
          pushIssue(
            issues,
            "error",
            `${path}.checks[${checkIndex}].requirement_id`,
            `Duplicate requirement check: ${check.requirement_id}`,
            "behavior_observation.check_unique"
          );
        }
        checkIds.add(check.requirement_id);
      });
    }
  });

  return createResult(value as unknown as AICBehaviorObservationSet, issues);
}
