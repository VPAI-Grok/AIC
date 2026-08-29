import {
  AIC_CONFORMANCE_SPEC,
  type AICBehaviorContract,
  type AICBehaviorProof,
  type AICConformanceBinding,
  type AICConformanceFinding,
  type AICConformanceFindingCode,
  type AICConformancePack,
  type AICConformanceProfile,
  type AICConformanceResult,
  type AICConformanceSurfaceRole,
  validateAICBehaviorContract,
  validateAICBehaviorProof,
  validateAICConformanceBinding,
  validateAICConformancePack,
  validateAICConformanceResult
} from "@aicorg/spec";
import { createAICDigest } from "./trust.js";

export interface CreateAICConformanceBindingInput {
  contract: unknown;
  pack: unknown;
  profileId: string;
  requirementMap: Record<string, string[]>;
  scenarioMap: Record<string, string[]>;
  surfaceRoles: Record<AICConformanceSurfaceRole, string[]>;
}

export interface VerifyAICConformanceInput {
  binding: unknown;
  contract: unknown;
  generatedAt: string;
  pack: unknown;
  proof?: unknown;
}

function assertIsoDateTime(value: string, field: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new Error(`${field} must be an ISO date-time string.`);
  }
}

function formatValidationIssues(
  issues: Array<{ message: string; path: string }>
): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
}

function stableFallbackId(value: unknown): string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9._-]*$/i.test(value)
    ? value
    : "unknown";
}

function readNestedRecord(value: unknown, key: string): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const nested = (value as Record<string, unknown>)[key];
  return typeof nested === "object" && nested !== null && !Array.isArray(nested)
    ? nested as Record<string, unknown>
    : undefined;
}

function addFinding(
  findings: AICConformanceFinding[],
  code: AICConformanceFindingCode,
  message: string,
  obligationId?: string
): void {
  findings.push({
    code,
    message,
    ...(obligationId ? { obligation_id: obligationId } : {}),
    severity: "error"
  });
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortFindings(findings: AICConformanceFinding[]): AICConformanceFinding[] {
  return [...findings].sort((left, right) => {
    return compareCodeUnits(
      `${left.code}\u0000${left.obligation_id ?? ""}\u0000${left.message}`,
      `${right.code}\u0000${right.obligation_id ?? ""}\u0000${right.message}`
    );
  });
}

function buildResult(input: {
  binding: unknown;
  contract: unknown;
  findings: AICConformanceFinding[];
  generatedAt: string;
  pack: unknown;
  profile?: AICConformanceProfile;
  profileId: string;
  proof?: unknown;
}): AICConformanceResult {
  const findings = sortFindings(input.findings);
  const errors = findings.filter((finding) => finding.severity === "error").length;
  const warnings = findings.filter((finding) => finding.severity === "warning").length;
  const result: AICConformanceResult = {
    artifact_type: "aic_conformance_result",
    binding_digest: createAICDigest(input.binding),
    contract_digest: createAICDigest(input.contract),
    findings,
    generated_at: input.generatedAt,
    level: input.proof === undefined ? "contract" : "proof",
    pack_digest: createAICDigest(input.pack),
    profile_id: stableFallbackId(input.profileId),
    ...(input.proof === undefined ? {} : { proof_digest: createAICDigest(input.proof) }),
    spec: AIC_CONFORMANCE_SPEC,
    status: errors === 0 ? "passed" : "failed",
    summary: {
      errors,
      requirement_obligations: input.profile?.requirements.length ?? 0,
      scenario_obligations: input.profile?.scenarios.length ?? 0,
      warnings
    }
  };
  const resultValidation = validateAICConformanceResult(result);
  if (!resultValidation.ok) {
    throw new Error(`Generated conformance result is invalid: ${formatValidationIssues(resultValidation.issues)}`);
  }
  return result;
}

export function createAICConformanceBinding(
  input: CreateAICConformanceBindingInput
): AICConformanceBinding {
  const packValidation = validateAICConformancePack(input.pack);
  if (!packValidation.ok) {
    throw new Error(`pack is invalid: ${formatValidationIssues(packValidation.issues)}`);
  }
  const contractValidation = validateAICBehaviorContract(input.contract);
  if (!contractValidation.ok) {
    throw new Error(`contract is invalid: ${formatValidationIssues(contractValidation.issues)}`);
  }
  const profile = packValidation.value.profiles.find((candidate) => candidate.id === input.profileId);
  if (!profile) {
    throw new Error(`Unknown conformance profile: ${input.profileId}.`);
  }
  const binding: AICConformanceBinding = {
    artifact_type: "aic_conformance_binding",
    authored: true,
    contract: {
      digest: createAICDigest(contractValidation.value),
      id: contractValidation.value.id
    },
    pack: {
      digest: createAICDigest(packValidation.value),
      id: packValidation.value.id,
      profile: profile.id,
      version: packValidation.value.version
    },
    requirement_map: structuredClone(input.requirementMap),
    scenario_map: structuredClone(input.scenarioMap),
    spec: AIC_CONFORMANCE_SPEC,
    surface_roles: structuredClone(input.surfaceRoles)
  };
  const bindingValidation = validateAICConformanceBinding(binding);
  if (!bindingValidation.ok) {
    throw new Error(`binding is invalid: ${formatValidationIssues(bindingValidation.issues)}`);
  }
  return bindingValidation.value;
}

function reportValidationFindings(
  findings: AICConformanceFinding[],
  code: "binding_invalid" | "contract_invalid" | "pack_invalid" | "proof_invalid",
  issues: Array<{ message: string; path: string }>
): void {
  for (const issue of issues) {
    addFinding(findings, code, `${issue.path}: ${issue.message}`);
  }
}

function checkReusedMappings(
  map: Record<string, string[]>,
  label: "requirement" | "scenario",
  findings: AICConformanceFinding[]
): void {
  const owners = new Map<string, string>();
  for (const [obligationId, mappedIds] of Object.entries(map).sort(([left], [right]) => compareCodeUnits(left, right))) {
    for (const mappedId of mappedIds) {
      const previous = owners.get(mappedId);
      if (previous && previous !== obligationId) {
        addFinding(
          findings,
          "mapping_reused",
          `${label} ${mappedId} is reused by obligations ${previous} and ${obligationId}.`,
          obligationId
        );
      } else {
        owners.set(mappedId, obligationId);
      }
    }
  }
}

function checkSurfaceRoles(
  contract: AICBehaviorContract,
  binding: AICConformanceBinding,
  findings: AICConformanceFinding[]
): void {
  const surfaces = new Map(contract.surfaces.map((surface) => [surface.id, surface]));
  for (const [role, surfaceIds] of Object.entries(binding.surface_roles) as Array<
    [AICConformanceSurfaceRole, string[]]
  >) {
    for (const surfaceId of surfaceIds) {
      const surface = surfaces.get(surfaceId);
      if (!surface) {
        addFinding(findings, "surface_role_invalid", `Bound ${role} surface does not exist: ${surfaceId}.`);
        continue;
      }
      const correctKind = role === "human"
        ? surface.kind === "human_ui"
        : ["webmcp", "mcp", "openapi"].includes(surface.kind);
      if (!correctKind) {
        addFinding(
          findings,
          "surface_role_invalid",
          `Surface ${surfaceId} (${surface.kind}) cannot satisfy role ${role}.`
        );
      }
    }
  }
}

function checkRequirementObligations(
  profile: AICConformanceProfile,
  contract: AICBehaviorContract,
  binding: AICConformanceBinding,
  findings: AICConformanceFinding[]
): void {
  const obligations = new Map(profile.requirements.map((obligation) => [obligation.id, obligation]));
  const requirements = new Map(contract.requirements.map((requirement) => [requirement.id, requirement]));
  for (const mappingId of Object.keys(binding.requirement_map)) {
    if (!obligations.has(mappingId)) {
      addFinding(findings, "mapping_unknown", `Unknown requirement obligation mapping: ${mappingId}.`, mappingId);
    }
  }
  checkReusedMappings(binding.requirement_map, "requirement", findings);
  for (const obligation of profile.requirements) {
    const mappedIds = binding.requirement_map[obligation.id];
    if (!mappedIds) {
      addFinding(findings, "requirement_obligation_missing", `No authored mapping exists for ${obligation.id}.`, obligation.id);
      continue;
    }
    if (mappedIds.length < obligation.minimum_bindings) {
      addFinding(
        findings,
        "requirement_binding_count",
        `${obligation.id} requires at least ${obligation.minimum_bindings} binding(s); received ${mappedIds.length}.`,
        obligation.id
      );
    }
    for (const requirementId of mappedIds) {
      const requirement = requirements.get(requirementId);
      if (!requirement) {
        addFinding(findings, "mapping_unknown", `Mapped contract requirement does not exist: ${requirementId}.`, obligation.id);
      } else if (requirement.phase !== obligation.phase) {
        addFinding(
          findings,
          "requirement_phase_mismatch",
          `${requirementId} has phase ${requirement.phase}; ${obligation.id} requires ${obligation.phase}.`,
          obligation.id
        );
      }
    }
  }
}

function expectedRequirementIds(
  references: string[] | undefined,
  binding: AICConformanceBinding
): string[] {
  return (references ?? []).flatMap((reference) => binding.requirement_map[reference] ?? []);
}

function checkScenarioObligations(
  profile: AICConformanceProfile,
  contract: AICBehaviorContract,
  binding: AICConformanceBinding,
  findings: AICConformanceFinding[]
): void {
  const obligations = new Map(profile.scenarios.map((obligation) => [obligation.id, obligation]));
  const scenarios = new Map(contract.scenarios.map((scenario) => [scenario.id, scenario]));
  for (const mappingId of Object.keys(binding.scenario_map)) {
    if (!obligations.has(mappingId)) {
      addFinding(findings, "mapping_unknown", `Unknown scenario obligation mapping: ${mappingId}.`, mappingId);
    }
  }
  checkReusedMappings(binding.scenario_map, "scenario", findings);
  for (const obligation of profile.scenarios) {
    const mappedIds = binding.scenario_map[obligation.id];
    if (!mappedIds || mappedIds.length === 0) {
      addFinding(findings, "scenario_obligation_missing", `No authored mapping exists for ${obligation.id}.`, obligation.id);
      continue;
    }
    for (const scenarioId of mappedIds) {
      const scenario = scenarios.get(scenarioId);
      if (!scenario) {
        addFinding(findings, "mapping_unknown", `Mapped contract scenario does not exist: ${scenarioId}.`, obligation.id);
        continue;
      }
      if (!obligation.allowed_statuses.includes(scenario.expected.status)) {
        addFinding(
          findings,
          "scenario_status_mismatch",
          `${scenarioId} expects ${scenario.expected.status}; ${obligation.id} allows ${obligation.allowed_statuses.join(", ")}.`,
          obligation.id
        );
      }
      if (
        obligation.allowed_confirmations &&
        (!scenario.expected.confirmation || !obligation.allowed_confirmations.includes(scenario.expected.confirmation))
      ) {
        addFinding(
          findings,
          "scenario_confirmation_mismatch",
          `${scenarioId} confirmation ${scenario.expected.confirmation ?? "missing"} is not allowed by ${obligation.id}.`,
          obligation.id
        );
      }
      const requiredIds = expectedRequirementIds(obligation.requirement_refs, binding);
      const missingRequired = requiredIds.filter(
        (requirementId) => !scenario.expected.required_requirements.includes(requirementId)
      );
      if (missingRequired.length > 0) {
        addFinding(
          findings,
          "scenario_requirement_mismatch",
          `${scenarioId} is missing required mapped requirement(s): ${missingRequired.join(", ")}.`,
          obligation.id
        );
      }
      const forbiddenIds = expectedRequirementIds(obligation.forbidden_requirement_refs, binding);
      const missingForbidden = forbiddenIds.filter(
        (requirementId) => !(scenario.expected.forbidden_requirements ?? []).includes(requirementId)
      );
      if (missingForbidden.length > 0) {
        addFinding(
          findings,
          "scenario_forbidden_requirement_mismatch",
          `${scenarioId} does not explicitly forbid mapped requirement(s): ${missingForbidden.join(", ")}.`,
          obligation.id
        );
      }
      for (const role of obligation.surface_roles) {
        const boundSurfaces = binding.surface_roles[role];
        if (boundSurfaces.length === 0) {
          addFinding(findings, "scenario_surface_role_mismatch", `${obligation.id} requires a ${role} surface binding.`, obligation.id);
          continue;
        }
        const missingSurfaces = boundSurfaces.filter((surfaceId) => !scenario.surfaces.includes(surfaceId));
        if (missingSurfaces.length > 0) {
          addFinding(
            findings,
            "scenario_surface_role_mismatch",
            `${scenarioId} does not cover ${role} surface(s): ${missingSurfaces.join(", ")}.`,
            obligation.id
          );
        }
      }
      if (obligation.parity === "required" && scenario.parity !== "required") {
        addFinding(findings, "scenario_parity_mismatch", `${scenarioId} must require cross-surface parity.`, obligation.id);
      }
    }
  }
}

function checkProof(
  profile: AICConformanceProfile,
  contract: AICBehaviorContract,
  binding: AICConformanceBinding,
  proof: AICBehaviorProof,
  findings: AICConformanceFinding[]
): void {
  const contractDigest = createAICDigest(contract);
  if (proof.contract.id !== contract.id || proof.contract.digest !== contractDigest) {
    addFinding(findings, "proof_contract_mismatch", "The proof is not bound to the supplied contract.");
  }
  if (proof.status !== "passed") {
    addFinding(findings, "proof_status_failed", "A proof-level conformance result requires a passed proof.");
  }
  const proofScenarios = new Map(proof.scenarios.map((scenario) => [scenario.scenario_id, scenario]));
  for (const obligation of profile.scenarios) {
    for (const scenarioId of binding.scenario_map[obligation.id] ?? []) {
      const proofScenario = proofScenarios.get(scenarioId);
      if (!proofScenario) {
        addFinding(findings, "proof_scenario_missing", `Proof is missing mapped scenario ${scenarioId}.`, obligation.id);
      } else {
        if (proofScenario.status !== "passed") {
          addFinding(findings, "proof_scenario_failed", `Proof scenario ${scenarioId} failed.`, obligation.id);
        }
        if (obligation.parity === "required" && proofScenario.parity !== "passed") {
          addFinding(findings, "proof_parity_failed", `Proof scenario ${scenarioId} did not pass parity.`, obligation.id);
        }
      }
    }
  }
}

export function verifyAICConformance(
  input: VerifyAICConformanceInput
): AICConformanceResult {
  assertIsoDateTime(input.generatedAt, "generatedAt");
  const findings: AICConformanceFinding[] = [];
  const packValidation = validateAICConformancePack(input.pack);
  const bindingValidation = validateAICConformanceBinding(input.binding);
  const contractValidation = validateAICBehaviorContract(input.contract);
  const proofValidation = input.proof === undefined
    ? undefined
    : validateAICBehaviorProof(input.proof);

  if (
    typeof input.binding === "object" &&
    input.binding !== null &&
    !Array.isArray(input.binding) &&
    (input.binding as Record<string, unknown>).authored !== true
  ) {
    addFinding(
      findings,
      "authored_binding_required",
      "Conformance mappings must be explicitly reviewed and marked authored."
    );
  }

  if (!packValidation.ok) reportValidationFindings(findings, "pack_invalid", packValidation.issues);
  if (!bindingValidation.ok) reportValidationFindings(findings, "binding_invalid", bindingValidation.issues);
  if (!contractValidation.ok) reportValidationFindings(findings, "contract_invalid", contractValidation.issues);
  if (proofValidation && !proofValidation.ok) reportValidationFindings(findings, "proof_invalid", proofValidation.issues);

  const rawPack = readNestedRecord(input.binding, "pack");
  const profileId = stableFallbackId(rawPack?.profile);
  const profile = packValidation.ok
    ? packValidation.value.profiles.find((candidate) => candidate.id === profileId)
    : undefined;

  if (packValidation.ok && !profile) {
    addFinding(findings, "unknown_profile", `Unknown conformance profile: ${profileId}.`);
  }

  if (packValidation.ok && bindingValidation.ok) {
    const binding = bindingValidation.value;
    if (
      binding.pack.id !== packValidation.value.id ||
      binding.pack.version !== packValidation.value.version ||
      binding.pack.digest !== createAICDigest(packValidation.value)
    ) {
      addFinding(findings, "pack_binding_mismatch", "The binding does not match the supplied conformance pack.");
    }
  }

  if (contractValidation.ok && bindingValidation.ok) {
    const binding = bindingValidation.value;
    if (
      binding.contract.id !== contractValidation.value.id ||
      binding.contract.digest !== createAICDigest(contractValidation.value)
    ) {
      addFinding(findings, "contract_binding_mismatch", "The binding does not match the supplied behavior contract.");
    }
  }

  if (profile && contractValidation.ok && bindingValidation.ok) {
    checkSurfaceRoles(contractValidation.value, bindingValidation.value, findings);
    checkRequirementObligations(profile, contractValidation.value, bindingValidation.value, findings);
    checkScenarioObligations(profile, contractValidation.value, bindingValidation.value, findings);
    if (proofValidation?.ok) {
      checkProof(profile, contractValidation.value, bindingValidation.value, proofValidation.value, findings);
    }
  }

  return buildResult({
    binding: input.binding,
    contract: input.contract,
    findings,
    generatedAt: input.generatedAt,
    pack: input.pack,
    profile,
    profileId,
    ...(input.proof === undefined ? {} : { proof: input.proof })
  });
}
