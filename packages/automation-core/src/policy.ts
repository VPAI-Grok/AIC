import {
  AIC_POLICY_SPEC,
  type AICAssurancePolicyRule,
  type AICBehaviorContract,
  type AICBehaviorObservationSet,
  type AICBehaviorProof,
  type AICPolicyEvaluation,
  type AICPolicyFinding,
  type AICPolicyRequirements,
  type AICSignedAttestation,
  type AICTrustEnvironment,
  validateAICAssurancePolicy,
  validateAICBehaviorContract,
  validateAICBehaviorObservationSet,
  validateAICBehaviorProof,
  validateAICSignedAttestation
} from "@aicorg/spec";
import { verifyAICBehavior } from "./assurance.js";
import { createAICCanonicalJson, createAICDigest, verifyAICSignedAttestation } from "./trust.js";

export interface EvaluateAICAssurancePolicyInput {
  attestation?: unknown;
  contract: unknown;
  environment?: AICTrustEnvironment;
  evaluatedAt?: string;
  expectedOrigin?: string;
  expectedRevision?: string;
  observations?: unknown;
  policy: unknown;
  proof: unknown;
  trustStore?: unknown;
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value));
}

function add(findings: AICPolicyFinding[], code: AICPolicyFinding["code"], message: string, ruleId?: string): void {
  findings.push({ code, message, ...(ruleId ? { rule_id: ruleId } : {}) });
}

function matches(rule: AICAssurancePolicyRule, contract: AICBehaviorContract, environment: AICTrustEnvironment | undefined): boolean {
  return (
    (rule.match.risks === undefined || rule.match.risks.includes(contract.action.risk)) &&
    (rule.match.operation_ids === undefined || rule.match.operation_ids.includes(contract.action.operation_id)) &&
    (rule.match.environments === undefined || (environment !== undefined && rule.match.environments.includes(environment)))
  );
}

function ageSeconds(earlier: string, later: string): number {
  return (Date.parse(later) - Date.parse(earlier)) / 1000;
}

function evaluateRule(input: {
  attestation?: AICSignedAttestation;
  contract: AICBehaviorContract;
  environment?: AICTrustEnvironment;
  evaluatedAt: string;
  expectedOrigin?: string;
  expectedRevision?: string;
  observations?: AICBehaviorObservationSet;
  proof: AICBehaviorProof;
  requirements: AICPolicyRequirements;
  ruleId: string;
  trustStore?: unknown;
}): AICPolicyFinding[] {
  const findings: AICPolicyFinding[] = [];
  const req = input.requirements;
  const id = input.ruleId;
  if (req.proof_status === "passed" && input.proof.status !== "passed") add(findings, "proof_status_required", "A passed behavior proof is required.", id);
  if (req.allowed_evidence_levels && !req.allowed_evidence_levels.includes(input.proof.evidence_level)) add(findings, "evidence_level_disallowed", `Evidence level ${input.proof.evidence_level} is not allowed.`, id);
  if (req.observations_required && !input.observations) add(findings, "observations_required", "A behavior observation set is required.", id);

  if (req.maximum_proof_age_seconds !== undefined) {
    const age = ageSeconds(input.proof.generated_at, input.evaluatedAt);
    if (age < 0) add(findings, "future_evidence", "Proof was generated after the policy evaluation time.", id);
    else if (age > req.maximum_proof_age_seconds) add(findings, "proof_age_exceeded", `Proof age ${age}s exceeds ${req.maximum_proof_age_seconds}s.`, id);
  }
  if (req.maximum_observation_age_seconds !== undefined) {
    if (!input.observations) add(findings, "observations_required", "Observation freshness cannot be evaluated without observations.", id);
    else input.observations.observations.forEach((observation) => {
      const age = ageSeconds(observation.captured_at, input.evaluatedAt);
      if (age < 0) add(findings, "future_evidence", `Observation ${observation.scenario_id}/${observation.surface_id} was captured after evaluation time.`, id);
      else if (age > req.maximum_observation_age_seconds!) add(findings, "observation_age_exceeded", `Observation ${observation.scenario_id}/${observation.surface_id} age ${age}s exceeds ${req.maximum_observation_age_seconds}s.`, id);
    });
  }

  (req.required_scenario_ids ?? []).forEach((scenarioId) => {
    const scenario = input.proof.scenarios.find((candidate) => candidate.scenario_id === scenarioId);
    if (!scenario || scenario.status !== "passed") add(findings, "scenario_required", `Required scenario ${scenarioId} did not pass.`, id);
  });
  if (req.parity === "all_required") {
    const parityScenarios = input.contract.scenarios.filter((scenario) => scenario.parity === "required");
    if (parityScenarios.length === 0) add(findings, "parity_required", "Policy requires parity but the contract declares no parity-required scenario.", id);
    parityScenarios.forEach((scenario) => {
      if (input.proof.scenarios.find((candidate) => candidate.scenario_id === scenario.id)?.parity !== "passed") add(findings, "parity_required", `Required parity did not pass for ${scenario.id}.`, id);
    });
  }
  (req.required_surface_kinds ?? []).forEach((kind) => {
    const ids = input.contract.surfaces.filter((surface) => surface.kind === kind).map((surface) => surface.id);
    const passed = ids.length > 0 && input.proof.scenarios.some((scenario) => scenario.surfaces.some((surface) => ids.includes(surface.surface_id) && surface.status === "passed"));
    if (!passed) add(findings, "surface_kind_required", `No passing evidence exists for required surface kind ${kind}.`, id);
  });

  const attReq = req.attestation;
  if (attReq?.required && !input.attestation) add(findings, "attestation_required", "A signed attestation is required.", id);
  if (attReq?.require_expected_origin && !input.expectedOrigin) add(findings, "expected_origin_required", "An explicit expected origin is required.", id);
  if (attReq?.require_expected_revision && !input.expectedRevision) add(findings, "expected_revision_required", "An explicit expected source revision is required.", id);
  if (input.attestation && attReq) {
    if (input.trustStore === undefined) add(findings, "attestation_untrusted", "A pinned trust store is required to evaluate the attestation.", id);
    else {
      const result = verifyAICSignedAttestation({
        attestation: input.attestation,
        contract: input.contract,
        expectedOrigin: input.expectedOrigin,
        expectedRevision: input.expectedRevision,
        proof: input.proof,
        trustStore: input.trustStore,
        verifiedAt: input.evaluatedAt
      });
      if (result.status !== "trusted" || result.checks.contract_binding !== "passed" || result.checks.proof_binding !== "passed") add(findings, "attestation_untrusted", `Attestation verification failed: ${result.findings.map((item) => item.code).join(", ") || result.status}.`, id);
    }
    const statement = input.attestation.statement;
    if (attReq.allowed_issuer_ids && !attReq.allowed_issuer_ids.includes(statement.issuer.id)) add(findings, "attestation_issuer_disallowed", `Issuer ${statement.issuer.id} is not allowed.`, id);
    if (attReq.allowed_key_ids && !attReq.allowed_key_ids.includes(input.attestation.signature.key_id)) add(findings, "attestation_key_disallowed", `Signer key ${input.attestation.signature.key_id} is not allowed.`, id);
    if (attReq.allowed_runner_ids && !attReq.allowed_runner_ids.includes(statement.runner.id)) add(findings, "attestation_runner_disallowed", `Runner ${statement.runner.id} is not allowed.`, id);
    if (attReq.allowed_runner_kinds && !attReq.allowed_runner_kinds.includes(statement.runner.kind)) add(findings, "attestation_runner_disallowed", `Runner kind ${statement.runner.kind} is not allowed.`, id);
    if (attReq.require_expiry && !statement.expires_at) add(findings, "attestation_expiry_required", "Attestation must have an expiry.", id);
    if (attReq.maximum_age_seconds !== undefined) {
      const age = ageSeconds(statement.issued_at, input.evaluatedAt);
      if (age < 0) add(findings, "future_evidence", "Attestation was issued after evaluation time.", id);
      else if (age > attReq.maximum_age_seconds) add(findings, "attestation_age_exceeded", `Attestation age ${age}s exceeds ${attReq.maximum_age_seconds}s.`, id);
    }
    if (attReq.maximum_validity_seconds !== undefined) {
      if (!statement.expires_at) add(findings, "attestation_expiry_required", "Attestation lifetime cannot be evaluated without expires_at.", id);
      else if (ageSeconds(statement.issued_at, statement.expires_at) > attReq.maximum_validity_seconds) add(findings, "attestation_lifetime_exceeded", "Attestation validity period exceeds policy.", id);
    }
    if (attReq.observations_not_before_deployment) {
      if (!statement.deployment.deployed_at || !input.observations) add(findings, "observation_before_deployment", "Deployment time and observations are required to enforce post-deployment collection.", id);
      else input.observations.observations.forEach((observation) => {
        if (Date.parse(observation.captured_at) < Date.parse(statement.deployment.deployed_at!)) add(findings, "observation_before_deployment", `Observation ${observation.scenario_id}/${observation.surface_id} predates deployment.`, id);
      });
    }
  }
  return findings;
}

export function evaluateAICAssurancePolicy(input: EvaluateAICAssurancePolicyInput): AICPolicyEvaluation {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  if (!validDate(evaluatedAt)) throw new Error("evaluatedAt must be an ISO date-time.");
  const policyValidation = validateAICAssurancePolicy(input.policy);
  const contractValidation = validateAICBehaviorContract(input.contract);
  const proofValidation = validateAICBehaviorProof(input.proof);
  const observationValidation = input.observations === undefined ? undefined : validateAICBehaviorObservationSet(input.observations);
  const attestationValidation = input.attestation === undefined ? undefined : validateAICSignedAttestation(input.attestation);
  const globalFindings: AICPolicyFinding[] = [];
  for (const [name, validation] of [["policy", policyValidation], ["contract", contractValidation], ["proof", proofValidation], ["observations", observationValidation], ["attestation", attestationValidation]] as const) {
    if (validation && !validation.ok) validation.issues.forEach((issue) => add(globalFindings, "artifact_invalid", `${name} ${issue.path}: ${issue.message}`));
  }
  const policyId = policyValidation.ok ? policyValidation.value.id : "invalid";
  const subjects = {
    ...(input.attestation === undefined ? {} : { attestation_digest: createAICDigest(input.attestation) }),
    ...(contractValidation.ok ? { contract_digest: createAICDigest(contractValidation.value) } : {}),
    ...(observationValidation?.ok ? { observations_digest: createAICDigest(observationValidation.value) } : {}),
    ...(proofValidation.ok ? { proof_digest: createAICDigest(proofValidation.value) } : {})
  };
  if (!policyValidation.ok || !contractValidation.ok || !proofValidation.ok || observationValidation?.ok === false || attestationValidation?.ok === false) {
    return {
      artifact_type: "aic_policy_evaluation",
      context: { ...(input.environment ? { environment: input.environment } : {}), ...(input.expectedOrigin ? { expected_origin: input.expectedOrigin } : {}), ...(input.expectedRevision ? { expected_revision: input.expectedRevision } : {}) },
      decision: "indeterminate",
      evaluated_at: evaluatedAt,
      findings: globalFindings,
      policy: { digest: createAICDigest(input.policy), id: policyId },
      rules: [],
      spec: AIC_POLICY_SPEC,
      subjects
    };
  }
  const policy = policyValidation.value;
  const contract = contractValidation.value;
  const proof = proofValidation.value;
  const observations = observationValidation?.ok ? observationValidation.value : undefined;
  const attestation = attestationValidation?.ok ? attestationValidation.value : undefined;
  if (input.environment && attestation && input.environment !== attestation.statement.deployment.environment) add(globalFindings, "binding_mismatch", `Policy environment ${input.environment} does not match attested environment ${attestation.statement.deployment.environment}.`);
  const environment = attestation?.statement.deployment.environment ?? input.environment;
  const regenerated = observations ? verifyAICBehavior({ contract, generatedAt: proof.generated_at, observations }) : undefined;
  const proofRegenerated = regenerated !== undefined && createAICCanonicalJson(regenerated) === createAICCanonicalJson(proof);
  if (!observations) add(globalFindings, "observations_required", "Policy evaluation requires observations so the proof can be regenerated.");
  else if (!proofRegenerated) add(globalFindings, "proof_regeneration_mismatch", "Supplied proof does not equal a proof regenerated from the supplied observations.");
  if (proof.contract.digest !== createAICDigest(contract) || proof.contract.id !== contract.id) add(globalFindings, "binding_mismatch", "Proof does not bind the supplied contract.");
  const matched = policy.rules.filter((rule) => matches(rule, contract, environment));
  if (matched.length === 0 && policy.unmatched === "fail") add(globalFindings, "unmatched_policy", "No policy rule matched and unmatched is fail.");
  const rules = policy.rules.map((rule) => {
    if (!matched.includes(rule)) return { findings: [], id: rule.id, status: "not_applicable" as const };
    const findings = evaluateRule({
      attestation,
      contract,
      environment,
      evaluatedAt,
      expectedOrigin: input.expectedOrigin,
      expectedRevision: input.expectedRevision,
      observations,
      proof,
      requirements: rule.require,
      ruleId: rule.id,
      trustStore: input.trustStore
    });
    return { findings, id: rule.id, status: findings.length > 0 ? "failed" as const : "passed" as const };
  });
  const findings = [...globalFindings, ...rules.flatMap((rule) => rule.findings)];
  return {
    artifact_type: "aic_policy_evaluation",
    context: { ...(environment ? { environment } : {}), ...(input.expectedOrigin ? { expected_origin: input.expectedOrigin } : {}), ...(input.expectedRevision ? { expected_revision: input.expectedRevision } : {}) },
    decision: findings.length > 0 ? "failed" : "passed",
    evaluated_at: evaluatedAt,
    findings,
    policy: { digest: createAICDigest(policy), id: policy.id },
    rules,
    spec: AIC_POLICY_SPEC,
    subjects
  };
}
