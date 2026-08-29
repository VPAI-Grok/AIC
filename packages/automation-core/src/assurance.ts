import { createHash } from "node:crypto";
import {
  AIC_BEHAVIOR_PROOF_VERSION,
  type AICBehaviorContract,
  type AICBehaviorObservation,
  type AICBehaviorObservationSet,
  type AICBehaviorProof,
  type AICBehaviorProofFinding,
  type AICBehaviorProofFindingCode,
  type AICBehaviorProofScenarioResult,
  validateAICBehaviorContract,
  validateAICBehaviorObservationSet
} from "@aicorg/spec";

export interface AICBehaviorVerificationInput {
  contract: unknown;
  generatedAt?: string;
  observations: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }

  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

function normalizeObservationInput(contractId: string, value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return {
    artifact_type: "aic_behavior_observation_set",
    contract_id: contractId,
    generated_at: new Date().toISOString(),
    observations: value
  };
}

function addFinding(
  findings: AICBehaviorProofFinding[],
  code: AICBehaviorProofFindingCode,
  message: string,
  context: Partial<
    Pick<AICBehaviorProofFinding, "requirement_id" | "scenario_id" | "surface_id">
  > = {},
  severity: AICBehaviorProofFinding["severity"] = "error"
): void {
  findings.push({ code, message, severity, ...context });
}

function evidenceLevel(
  observations: AICBehaviorObservation[]
): AICBehaviorProof["evidence_level"] {
  if (observations.length === 0) {
    return "none";
  }

  const modes = new Set(observations.map((observation) => observation.mode));
  if (modes.size > 1) {
    return "mixed";
  }

  return modes.has("executed") ? "executed" : "imported";
}

function observationKey(scenarioId: string, surfaceId: string): string {
  return `${scenarioId}\u0000${surfaceId}`;
}

function parityValue(observation: AICBehaviorObservation): unknown {
  return {
    confirmation: observation.confirmation,
    error_code: observation.error_code,
    outcome: observation.outcome,
    requirements: observation.checks
      .map((check) => ({ passed: check.passed, requirement_id: check.requirement_id }))
      .sort((left, right) => left.requirement_id.localeCompare(right.requirement_id)),
    status: observation.status
  };
}

function createEmptyProof(
  contract: unknown,
  generatedAt: string,
  findings: AICBehaviorProofFinding[]
): AICBehaviorProof {
  const contractRecord = isRecord(contract) ? contract : {};

  return {
    artifact_type: "aic_behavior_proof",
    contract: {
      digest: digest(contract),
      id: typeof contractRecord.id === "string" ? contractRecord.id : "unknown",
      spec: typeof contractRecord.spec === "string" ? contractRecord.spec : "unknown"
    },
    evidence_level: "none",
    findings,
    generated_at: generatedAt,
    observations_digest: digest([]),
    proof_version: AIC_BEHAVIOR_PROOF_VERSION,
    scenarios: [],
    status: "failed",
    summary: {
      failed_scenarios: 0,
      observations: 0,
      passed_scenarios: 0,
      required_observations: 0,
      scenarios: 0
    }
  };
}

export function verifyAICBehavior(input: AICBehaviorVerificationInput): AICBehaviorProof {
  const requestedGeneratedAt = input.generatedAt;
  const generatedAtIsValid =
    requestedGeneratedAt === undefined || !Number.isNaN(Date.parse(requestedGeneratedAt));
  const generatedAt = generatedAtIsValid && requestedGeneratedAt
    ? requestedGeneratedAt
    : new Date().toISOString();
  const contractValidation = validateAICBehaviorContract(input.contract);
  const findings: AICBehaviorProofFinding[] = [];

  if (!generatedAtIsValid) {
    addFinding(
      findings,
      "generated_at_invalid",
      "generatedAt must be an ISO date-time string."
    );
  }

  if (!contractValidation.ok) {
    contractValidation.issues.forEach((issue) => {
      addFinding(findings, "contract_invalid", `${issue.path}: ${issue.message}`);
    });
    return createEmptyProof(input.contract, generatedAt, findings);
  }

  const contract = contractValidation.value;
  const normalizedObservations = normalizeObservationInput(contract.id, input.observations);
  const observationValidation = validateAICBehaviorObservationSet(normalizedObservations);
  let observationSet: AICBehaviorObservationSet;

  if (!observationValidation.ok) {
    observationValidation.issues.forEach((issue) => {
      addFinding(findings, "observation_invalid", `${issue.path}: ${issue.message}`);
    });
    observationSet = {
      artifact_type: "aic_behavior_observation_set",
      contract_id: contract.id,
      generated_at: generatedAt,
      observations: []
    };
  } else {
    observationSet = observationValidation.value;
  }

  if (observationSet.contract_id !== contract.id) {
    addFinding(
      findings,
      "observation_contract_mismatch",
      `Observation set targets ${observationSet.contract_id}, expected ${contract.id}.`
    );
  }

  const surfaceIds = new Set(contract.surfaces.map((surface) => surface.id));
  const requirementIds = new Set(contract.requirements.map((requirement) => requirement.id));
  const scenariosById = new Map(contract.scenarios.map((scenario) => [scenario.id, scenario]));
  const observationsByKey = new Map<string, AICBehaviorObservation>();

  observationSet.observations.forEach((observation) => {
    const context = {
      scenario_id: observation.scenario_id,
      surface_id: observation.surface_id
    };

    if (observation.contract_id !== contract.id) {
      addFinding(
        findings,
        "observation_contract_mismatch",
        `Observation targets ${observation.contract_id}, expected ${contract.id}.`,
        context
      );
    }

    const scenario = scenariosById.get(observation.scenario_id);
    if (!scenario) {
      addFinding(
        findings,
        "unknown_scenario",
        `Unknown scenario: ${observation.scenario_id}.`,
        context
      );
    }

    if (!surfaceIds.has(observation.surface_id) || !scenario?.surfaces.includes(observation.surface_id)) {
      addFinding(
        findings,
        "unknown_surface",
        `Surface ${observation.surface_id} is not required by scenario ${observation.scenario_id}.`,
        context
      );
    }

    if (observation.operation_id !== contract.action.operation_id) {
      addFinding(
        findings,
        "operation_mismatch",
        `Observed operation ${observation.operation_id}, expected ${contract.action.operation_id}.`,
        context
      );
    }

    observation.checks.forEach((check) => {
      if (!requirementIds.has(check.requirement_id)) {
        addFinding(
          findings,
          "unknown_requirement",
          `Unknown requirement: ${check.requirement_id}.`,
          { ...context, requirement_id: check.requirement_id }
        );
      }
    });

    const key = observationKey(observation.scenario_id, observation.surface_id);
    if (observationsByKey.has(key)) {
      addFinding(
        findings,
        "duplicate_observation",
        `More than one observation exists for ${observation.scenario_id}/${observation.surface_id}.`,
        context
      );
      return;
    }

    observationsByKey.set(key, observation);
  });

  const scenarioResults: AICBehaviorProofScenarioResult[] = contract.scenarios.map((scenario) => {
    const scenarioFindingStart = findings.length;
    const scenarioObservations: AICBehaviorObservation[] = [];
    const surfaceResults = scenario.surfaces.map((surfaceId) => {
      const surfaceFindingStart = findings.length;
      const context = { scenario_id: scenario.id, surface_id: surfaceId };
      const observation = observationsByKey.get(observationKey(scenario.id, surfaceId));

      if (!observation) {
        addFinding(
          findings,
          "missing_observation",
          `Missing observation for ${scenario.id}/${surfaceId}.`,
          context
        );
      } else {
        scenarioObservations.push(observation);
        if (observation.status !== scenario.expected.status) {
          addFinding(
            findings,
            "status_mismatch",
            `Observed status ${observation.status}, expected ${scenario.expected.status}.`,
            context
          );
        }

        if (
          scenario.expected.confirmation !== undefined &&
          observation.confirmation !== scenario.expected.confirmation
        ) {
          addFinding(
            findings,
            "confirmation_mismatch",
            `Observed confirmation ${observation.confirmation ?? "missing"}, expected ${scenario.expected.confirmation}.`,
            context
          );
        }

        if (
          scenario.expected.error_code !== undefined &&
          observation.error_code !== scenario.expected.error_code
        ) {
          addFinding(
            findings,
            "error_code_mismatch",
            `Observed error code ${observation.error_code ?? "missing"}, expected ${scenario.expected.error_code}.`,
            context
          );
        }

        if (
          scenario.expected.outcome !== undefined &&
          canonicalJson(observation.outcome) !== canonicalJson(scenario.expected.outcome)
        ) {
          addFinding(
            findings,
            "outcome_mismatch",
            "Observed outcome does not match the contract expectation.",
            context
          );
        }

        const checksByRequirement = new Map(
          observation.checks.map((check) => [check.requirement_id, check])
        );

        scenario.expected.required_requirements.forEach((requirementId) => {
          const check = checksByRequirement.get(requirementId);
          if (!check) {
            addFinding(
              findings,
              "required_requirement_missing",
              `Required check is missing: ${requirementId}.`,
              { ...context, requirement_id: requirementId }
            );
          } else if (!check.passed) {
            addFinding(
              findings,
              "required_requirement_failed",
              check.message ?? `Required check failed: ${requirementId}.`,
              { ...context, requirement_id: requirementId }
            );
          }
        });

        (scenario.expected.forbidden_requirements ?? []).forEach((requirementId) => {
          const check = checksByRequirement.get(requirementId);
          if (!check) {
            addFinding(
              findings,
              "forbidden_requirement_unchecked",
              `Forbidden behavior was not checked: ${requirementId}.`,
              { ...context, requirement_id: requirementId }
            );
          } else if (check.passed === true) {
            addFinding(
              findings,
              "forbidden_requirement_observed",
              `Forbidden behavior was observed: ${requirementId}.`,
              { ...context, requirement_id: requirementId }
            );
          }
        });

        observation.checks.forEach((check) => {
          if (
            requirementIds.has(check.requirement_id) &&
            !scenario.expected.required_requirements.includes(check.requirement_id) &&
            !(scenario.expected.forbidden_requirements ?? []).includes(check.requirement_id) &&
            !check.passed
          ) {
            addFinding(
              findings,
              "observation_check_failed",
              check.message ?? `Behavior check failed: ${check.requirement_id}.`,
              { ...context, requirement_id: check.requirement_id }
            );
          }
        });
      }

      return {
        finding_count: findings.length - surfaceFindingStart,
        observation_mode: observation?.mode,
        status: findings.length === surfaceFindingStart ? "passed" : "failed",
        surface_id: surfaceId
      } as const;
    });

    let parity: AICBehaviorProofScenarioResult["parity"] = "not_required";
    if (scenario.parity === "required") {
      const complete = scenarioObservations.length === scenario.surfaces.length;
      const reference = scenarioObservations[0];
      const matches =
        complete &&
        reference !== undefined &&
        scenarioObservations.every(
          (observation) => canonicalJson(parityValue(observation)) === canonicalJson(parityValue(reference))
        );

      if (matches) {
        parity = "passed";
      } else {
        parity = "failed";
        addFinding(
          findings,
          "parity_mismatch",
          `Required surfaces for ${scenario.id} did not produce equivalent behavior.`,
          { scenario_id: scenario.id }
        );
      }
    }

    return {
      finding_count: findings.length - scenarioFindingStart,
      parity,
      scenario_id: scenario.id,
      status: findings.length === scenarioFindingStart ? "passed" : "failed",
      surfaces: surfaceResults
    };
  });

  const sortedObservations = [...observationSet.observations].sort((left, right) => {
    return observationKey(left.scenario_id, left.surface_id).localeCompare(
      observationKey(right.scenario_id, right.surface_id)
    );
  });
  const failedScenarios = scenarioResults.filter((scenario) => scenario.status === "failed").length;

  return {
    artifact_type: "aic_behavior_proof",
    contract: {
      digest: digest(contract),
      id: contract.id,
      spec: contract.spec
    },
    evidence_level: evidenceLevel(observationSet.observations),
    findings,
    generated_at: generatedAt,
    observations_digest: digest(sortedObservations),
    proof_version: AIC_BEHAVIOR_PROOF_VERSION,
    scenarios: scenarioResults,
    status: findings.some((finding) => finding.severity === "error") ? "failed" : "passed",
    summary: {
      failed_scenarios: failedScenarios,
      observations: observationSet.observations.length,
      passed_scenarios: scenarioResults.length - failedScenarios,
      required_observations: contract.scenarios.reduce(
        (total, scenario) => total + scenario.surfaces.length,
        0
      ),
      scenarios: contract.scenarios.length
    }
  };
}
