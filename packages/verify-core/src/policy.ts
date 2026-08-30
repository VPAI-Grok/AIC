/** Fail-closed assurance-policy evaluation for AIC verification consumers. */
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
  isAICRfc3339DateTime,
  validateAICAssurancePolicy,
  validateAICBehaviorContract,
  validateAICBehaviorObservationSet,
  validateAICBehaviorProof,
  validateAICSignedAttestation,
  validateAICTransparencyIndex,
  validateAICTrustStore
} from "@aicorg/spec";
import { verifyAICBehavior } from "./assurance.js";
import {
  createAICTransparencyCheckpointDigest,
  verifyAICTransparencyConsistency,
  verifyAICTransparencyIndex
} from "./transparency.js";
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
  transparency?: {
    index: unknown;
    priorIndex?: unknown;
    trustStore: unknown;
  };
  trustStore?: unknown;
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

function normalizeTransparencyInput(value: unknown):
  | { index: unknown; priorIndex?: unknown; trustStore: unknown }
  | undefined {
  if (value === undefined) return undefined;
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      ![2, 3].includes(Object.keys(descriptors).length) ||
      !("index" in descriptors) ||
      !("trustStore" in descriptors) ||
      !("value" in descriptors.index) ||
      !("value" in descriptors.trustStore) ||
      ("priorIndex" in descriptors && !("value" in descriptors.priorIndex)) ||
      Object.keys(descriptors).some(
        (key) => !["index", "priorIndex", "trustStore"].includes(key)
      )
    ) return undefined;
    return {
      index: descriptors.index.value,
      ...(descriptors.priorIndex && "value" in descriptors.priorIndex
        ? { priorIndex: descriptors.priorIndex.value }
        : {}),
      trustStore: descriptors.trustStore.value
    };
  } catch {
    return undefined;
  }
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
  transparency?: {
    index: unknown;
    priorIndex?: unknown;
    trustStore: unknown;
  };
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

  const transparencyReq = req.transparency;
  if (transparencyReq?.required) {
    if (!input.transparency) {
      add(findings, "transparency_required", "A trusted transparency index is required.", id);
    } else {
      const indexValidation = validateAICTransparencyIndex(input.transparency.index);
      const verification = verifyAICTransparencyIndex({
        index: input.transparency.index,
        logTrustStore: input.transparency.trustStore,
        verifiedAt: input.evaluatedAt
      });
      if (!indexValidation.ok || verification.status === "invalid") {
        add(findings, "transparency_invalid", "The transparency index or its pinned trust store is invalid.", id);
      } else if (verification.status !== "trusted") {
        add(findings, "transparency_untrusted", "The transparency index is not trusted by the supplied log trust store.", id);
      } else {
        const index = indexValidation.value;
        if (
          transparencyReq.allowed_log_ids &&
          !transparencyReq.allowed_log_ids.includes(index.log_id)
        ) {
          add(findings, "transparency_log_disallowed", `Transparency log ${index.log_id} is not allowed.`, id);
        }
        if (
          transparencyReq.allowed_key_ids &&
          !transparencyReq.allowed_key_ids.includes(index.checkpoint.signature.key_id)
        ) {
          add(
            findings,
            "transparency_key_disallowed",
            `Transparency checkpoint key ${index.checkpoint.signature.key_id} is not allowed.`,
            id
          );
        }
        const checkpointAge = ageSeconds(
          index.checkpoint.statement.issued_at,
          input.evaluatedAt
        );
        if (
          transparencyReq.maximum_checkpoint_age_seconds !== undefined &&
          checkpointAge > transparencyReq.maximum_checkpoint_age_seconds
        ) {
          add(
            findings,
            "transparency_checkpoint_age_exceeded",
            `Transparency checkpoint age ${checkpointAge}s exceeds ${transparencyReq.maximum_checkpoint_age_seconds}s.`,
            id
          );
        }
        if (
          transparencyReq.minimum_size !== undefined &&
          index.checkpoint.statement.size < transparencyReq.minimum_size
        ) {
          add(
            findings,
            "transparency_size_below_minimum",
            `Transparency checkpoint size ${index.checkpoint.statement.size} is below ${transparencyReq.minimum_size}.`,
            id
          );
        }
        if (
          transparencyReq.expected_checkpoint_digest !== undefined &&
          createAICTransparencyCheckpointDigest(index.checkpoint) !==
            transparencyReq.expected_checkpoint_digest
        ) {
          add(
            findings,
            "transparency_checkpoint_mismatch",
            "Transparency checkpoint does not match the consumer-pinned digest.",
            id
          );
        }
        if (transparencyReq.require_consistency && input.transparency.priorIndex === undefined) {
          add(
            findings,
            "transparency_consistency_required",
            "A prior trusted transparency index is required for consistency verification.",
            id
          );
        }
        if (input.transparency.priorIndex !== undefined) {
          const priorValidation = validateAICTransparencyIndex(
            input.transparency.priorIndex
          );
          if (
            priorValidation.ok &&
            transparencyReq.expected_prior_checkpoint_digest !== undefined &&
            createAICTransparencyCheckpointDigest(priorValidation.value.checkpoint) !==
              transparencyReq.expected_prior_checkpoint_digest
          ) {
            add(
              findings,
              "transparency_prior_checkpoint_mismatch",
              "Prior transparency checkpoint does not match the consumer-pinned digest.",
              id
            );
          }
          const consistency = verifyAICTransparencyConsistency({
            from: input.transparency.priorIndex,
            logTrustStore: input.transparency.trustStore,
            to: index,
            verifiedAt: input.evaluatedAt
          });
          if (consistency.status !== "consistent") {
            add(
              findings,
              "transparency_inconsistent",
              "Transparency index does not consistently extend the consumer's prior trusted index.",
              id
            );
          }
        }
        const attestationDigest = input.attestation
          ? createAICDigest(input.attestation)
          : undefined;
        if (
          !attestationDigest ||
          !index.entries.some(
            (entry) =>
              entry.kind === "attestation" &&
              entry.artifact_digest === attestationDigest
          )
        ) {
          add(
            findings,
            "transparency_attestation_missing",
            "The trusted transparency index does not contain the exact signed attestation.",
            id
          );
        }
      }
    }
  }
  return findings;
}

export function evaluateAICAssurancePolicy(input: EvaluateAICAssurancePolicyInput): AICPolicyEvaluation {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  if (!isAICRfc3339DateTime(evaluatedAt)) throw new Error("evaluatedAt must be an ISO date-time.");
  const policyValidation = validateAICAssurancePolicy(input.policy);
  const contractValidation = validateAICBehaviorContract(input.contract);
  const proofValidation = validateAICBehaviorProof(input.proof);
  const observationValidation = input.observations === undefined ? undefined : validateAICBehaviorObservationSet(input.observations);
  const attestationValidation = input.attestation === undefined ? undefined : validateAICSignedAttestation(input.attestation);
  const transparency = normalizeTransparencyInput(input.transparency);
  const transparencyIndexValidation = transparency
    ? validateAICTransparencyIndex(transparency.index)
    : undefined;
  const transparencyTrustValidation = transparency
    ? validateAICTrustStore(transparency.trustStore)
    : undefined;
  const transparencyPriorValidation =
    transparency?.priorIndex === undefined
      ? undefined
      : validateAICTransparencyIndex(transparency.priorIndex);
  const globalFindings: AICPolicyFinding[] = [];
  for (const [name, validation] of [["policy", policyValidation], ["contract", contractValidation], ["proof", proofValidation], ["observations", observationValidation], ["attestation", attestationValidation]] as const) {
    if (validation && !validation.ok) validation.issues.forEach((issue) => add(globalFindings, "artifact_invalid", `${name} ${issue.path}: ${issue.message}`));
  }
  if (input.transparency !== undefined && transparency === undefined) {
    add(
      globalFindings,
      "artifact_invalid",
      "transparency must contain exactly index and trustStore as data properties."
    );
  }
  for (const [name, validation] of [
    ["transparency index", transparencyIndexValidation],
    ["transparency trust store", transparencyTrustValidation]
    , ["transparency prior index", transparencyPriorValidation]
  ] as const) {
    if (validation && !validation.ok) {
      validation.issues.forEach((issue) =>
        add(globalFindings, "artifact_invalid", `${name} ${issue.path}: ${issue.message}`)
      );
    }
  }
  const policyId = policyValidation.ok ? policyValidation.value.id : "invalid";
  const subjects = {
    ...(input.attestation === undefined ? {} : { attestation_digest: createAICDigest(input.attestation) }),
    ...(contractValidation.ok ? { contract_digest: createAICDigest(contractValidation.value) } : {}),
    ...(observationValidation?.ok ? { observations_digest: createAICDigest(observationValidation.value) } : {}),
    ...(proofValidation.ok ? { proof_digest: createAICDigest(proofValidation.value) } : {}),
    ...(transparencyIndexValidation?.ok && transparencyTrustValidation?.ok
      ? {
          transparency_index_digest: createAICDigest(transparencyIndexValidation.value),
          ...(transparencyPriorValidation?.ok
            ? {
                transparency_prior_index_digest: createAICDigest(
                  transparencyPriorValidation.value
                )
              }
            : {}),
          transparency_trust_store_digest: createAICDigest(transparencyTrustValidation.value)
        }
      : {})
  };
  if (!policyValidation.ok || !contractValidation.ok || !proofValidation.ok || observationValidation?.ok === false || attestationValidation?.ok === false || (input.transparency !== undefined && transparency === undefined) || transparencyIndexValidation?.ok === false || transparencyTrustValidation?.ok === false || transparencyPriorValidation?.ok === false) {
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
  if (policy.unmatched !== "fail") {
    add(
      globalFindings,
      "policy_not_fail_closed",
      "Policy unmatched behavior must be fail for an actionable assurance decision."
    );
  }
  const environment = attestation?.statement.deployment.environment ?? input.environment;
  const regenerated = observations ? verifyAICBehavior({ contract, generatedAt: proof.generated_at, observations }) : undefined;
  const proofRegenerated = regenerated !== undefined && createAICCanonicalJson(regenerated) === createAICCanonicalJson(proof);
  if (!observations) add(globalFindings, "observations_required", "Policy evaluation requires observations so the proof can be regenerated.");
  else if (!proofRegenerated) add(globalFindings, "proof_regeneration_mismatch", "Supplied proof does not equal a proof regenerated from the supplied observations.");
  if (proof.contract.digest !== createAICDigest(contract) || proof.contract.id !== contract.id) add(globalFindings, "binding_mismatch", "Proof does not bind the supplied contract.");
  const matched = policy.rules.filter((rule) => matches(rule, contract, environment));
  if (matched.length === 0) add(globalFindings, "unmatched_policy", "No policy rule matched.");
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
      transparency:
        transparencyIndexValidation?.ok && transparencyTrustValidation?.ok
          ? {
              index: transparencyIndexValidation.value,
              ...(transparencyPriorValidation?.ok
                ? { priorIndex: transparencyPriorValidation.value }
                : {}),
              trustStore: transparencyTrustValidation.value
            }
          : undefined,
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
