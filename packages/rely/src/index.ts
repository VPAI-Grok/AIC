import {
  createAICCanonicalJson,
  createAICTransparencyCheckpointDigest,
  createAICDigest,
  evaluateAICAssurancePolicy,
  verifyAICSignedAttestation,
  verifyAICTransparencyConsistency,
  verifyAICTransparencyIndex,
  type AICTrustVerificationResult,
  type AICTransparencyVerificationResult
} from "@aicorg/verify-core";
import {
  AIC_RELIANCE_REASON_CODES,
  AIC_RELIANCE_MAX_VALIDITY_SECONDS,
  AIC_RELIANCE_SPEC,
  isAICRfc3339DateTime,
  validateAICAssurancePolicy,
  validateAICBehaviorContract,
  validateAICBehaviorObservationSet,
  validateAICBehaviorProof,
  validateAICRelianceDecision,
  validateAICSignedAttestation,
  validateAICTransparencyIndex,
  validateAICTrustStore,
  type AICAssurancePolicy,
  type AICBehaviorContract,
  type AICBehaviorObservationSet,
  type AICBehaviorProof,
  type AICPolicyEvaluation,
  type AICRelianceArtifactDigests,
  type AICRelianceCheck,
  type AICRelianceDecision,
  type AICRelianceEvidenceFreshness,
  type AICRelianceFreshnessStatus,
  type AICRelianceReasonCode,
  type AICRelianceRequestBinding,
  type AICRelianceVerdict,
  type AICSignedAttestation,
  type AICTrustEnvironment
} from "@aicorg/spec";

export const AIC_RELIANCE_ARTIFACT_TYPE = "aic_reliance_decision" as const;

export {
  AIC_RELIANCE_MAX_VALIDITY_SECONDS,
  AIC_RELIANCE_REASON_CODES,
  AIC_RELIANCE_SPEC,
  validateAICRelianceDecision
} from "@aicorg/spec";
export type {
  AICRelianceArtifactDigests,
  AICRelianceCheck,
  AICRelianceDecision,
  AICRelianceEvidenceFreshness,
  AICRelianceFreshnessStatus,
  AICRelianceReasonCode,
  AICRelianceVerdict
} from "@aicorg/spec";

export interface AICRelianceDisposition {
  on_failed?: "confirm" | "deny";
  on_indeterminate?: "confirm" | "deny" | "indeterminate";
  on_passed?: "allow" | "confirm";
}

export interface AICRelianceTransparencyInput {
  index: unknown;
  prior_index?: unknown;
  trust_store: unknown;
}

export type AICRelianceExpectedArtifactDigests = Required<
  Pick<
    AICRelianceArtifactDigests,
    "attestation" | "contract" | "observations" | "policy" | "proof" | "trust_store"
  >
> &
  Pick<
    AICRelianceArtifactDigests,
    "transparency_index" | "transparency_prior_index" | "transparency_trust_store"
  >;

export type AICRelianceExpectedRequest = Omit<
  AICRelianceRequestBinding,
  "environment"
> &
  Required<Pick<AICRelianceRequestBinding, "environment">>;

interface AICRelianceTemporalOptions {
  clock?: () => Date | string;
  max_decision_age_seconds?: number;
  max_future_skew_seconds?: number;
  /** Residual lifetime required at the trusted clock sample taken after reproduction. */
  minimum_validity_seconds?: number;
}

export interface AICRelianceAssertionOptions extends AICRelianceTemporalOptions {
  /** Exact consumer-owned inputs used to locally reproduce the decision. */
  input: EvaluateAICRelianceInput;
}

export interface AICReliancePreflightOptions extends AICRelianceTemporalOptions {}

export interface EvaluateAICRelianceInput {
  attestation: unknown;
  contract: unknown;
  disposition?: AICRelianceDisposition;
  environment: AICTrustEnvironment;
  evaluated_at?: string;
  expected_deployment_id: string;
  expected_revision: string;
  observations: unknown;
  operation_id: string;
  origin: string;
  policy: unknown;
  proof: unknown;
  transparency?: AICRelianceTransparencyInput;
  trust_store: unknown;
}

type RelianceOutcome = "failed" | "indeterminate" | "passed";

interface ValidatedArtifacts {
  attestation: AICSignedAttestation;
  contract: AICBehaviorContract;
  observations: AICBehaviorObservationSet;
  policy: AICAssurancePolicy;
  proof: AICBehaviorProof;
}

interface RequiredTransparency {
  allowed_key_ids?: string[];
  allowed_log_ids?: string[];
  expected_checkpoint_digest?: string;
  expected_prior_checkpoint_digest?: string;
  maximum_checkpoint_age_seconds?: number;
  minimum_size?: number;
  require_consistency?: boolean;
}

const TRUST_ENVIRONMENTS = new Set<AICTrustEnvironment>([
  "production",
  "staging",
  "test",
  "development"
]);

/** @deprecated Use AIC_RELIANCE_MAX_VALIDITY_SECONDS. */
export const AIC_RELIANCE_PORTABLE_MAX_LIFETIME_SECONDS =
  AIC_RELIANCE_MAX_VALIDITY_SECONDS;

const REQUEST_BINDING_FIELDS = [
  "environment",
  "expected_deployment_id",
  "expected_revision",
  "operation_id",
  "origin"
] as const;

function isCanonicalOrigin(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.origin === value &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

function isFullSourceRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}([0-9a-f]{24})?$/.test(value);
}

function digest(value: unknown): string | undefined {
  try {
    return createAICDigest(value);
  } catch {
    return undefined;
  }
}

function ageSeconds(value: string, evaluatedAt: string): number {
  return (Date.parse(evaluatedAt) - Date.parse(value)) / 1000;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function trustedNow(clock: AICRelianceTemporalOptions["clock"]): string {
  const value = clock?.() ?? new Date();
  const date = value instanceof Date
    ? value
    : isAICRfc3339DateTime(value)
      ? new Date(Date.parse(value))
      : new Date(Number.NaN);
  if (Number.isNaN(date.getTime())) throw new TypeError("AIC reliance clock must return a valid time.");
  return date.toISOString();
}

function finalizeDecision(value: AICRelianceDecision): AICRelianceDecision {
  const validation = validateAICRelianceDecision(value);
  if (!validation.ok) {
    throw new Error(
      `Generated AIC reliance decision is invalid: ${validation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`
    );
  }
  return validation.value;
}

function verdictFor(outcome: RelianceOutcome, disposition: AICRelianceDisposition | undefined): AICRelianceVerdict {
  if (outcome === "passed") return disposition?.on_passed ?? "allow";
  if (outcome === "failed") return disposition?.on_failed ?? "deny";
  return disposition?.on_indeterminate ?? "indeterminate";
}

function validatedDisposition(value: unknown): AICRelianceDisposition | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const allowed = new Set(["on_failed", "on_indeterminate", "on_passed"]);
  if (Object.keys(descriptors).some((key) => !allowed.has(key))) return undefined;
  if (Object.values(descriptors).some((descriptor) => !("value" in descriptor))) return undefined;
  const disposition = value as Record<string, unknown>;
  if (
    disposition.on_failed !== undefined &&
    !["confirm", "deny"].includes(String(disposition.on_failed))
  ) return undefined;
  if (
    disposition.on_indeterminate !== undefined &&
    !["confirm", "deny", "indeterminate"].includes(String(disposition.on_indeterminate))
  ) return undefined;
  if (
    disposition.on_passed !== undefined &&
    !["allow", "confirm"].includes(String(disposition.on_passed))
  ) return undefined;
  return {
    ...(disposition.on_failed !== undefined
      ? { on_failed: disposition.on_failed as "confirm" | "deny" }
      : {}),
    ...(disposition.on_indeterminate !== undefined
      ? {
          on_indeterminate: disposition.on_indeterminate as
            | "confirm"
            | "deny"
            | "indeterminate"
        }
      : {}),
    ...(disposition.on_passed !== undefined
      ? { on_passed: disposition.on_passed as "allow" | "confirm" }
      : {})
  };
}

function validatedTransparencyInput(value: unknown): AICRelianceTransparencyInput | undefined {
  if (value === undefined) return undefined;
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      ![2, 3].includes(Object.keys(descriptors).length) ||
      !("index" in descriptors) ||
      !("trust_store" in descriptors) ||
      !("value" in descriptors.index) ||
      !("value" in descriptors.trust_store) ||
      ("prior_index" in descriptors && !("value" in descriptors.prior_index)) ||
      Object.keys(descriptors).some(
        (key) => !["index", "prior_index", "trust_store"].includes(key)
      )
    ) return undefined;
    return {
      index: descriptors.index.value,
      ...(descriptors.prior_index && "value" in descriptors.prior_index
        ? { prior_index: descriptors.prior_index.value }
        : {}),
      trust_store: descriptors.trust_store.value
    };
  } catch {
    return undefined;
  }
}

/**
 * Canonically binds every consumer-supplied artifact used by a reliance
 * evaluation. Unlike decision generation, this helper is strict: malformed
 * transparency input or any artifact that cannot be digested is an error.
 */
export function createAICRelianceArtifactDigests(
  input: EvaluateAICRelianceInput
): AICRelianceExpectedArtifactDigests {
  const transparency = validatedTransparencyInput(input.transparency);
  if (input.transparency !== undefined && transparency === undefined) {
    throw new TypeError("AIC reliance transparency input must be a plain, complete data object.");
  }

  const values: Partial<AICRelianceExpectedArtifactDigests> = {};
  const candidates: Array<[keyof AICRelianceExpectedArtifactDigests, unknown]> = [
    ["attestation", input.attestation],
    ["contract", input.contract],
    ["observations", input.observations],
    ["policy", input.policy],
    ["proof", input.proof],
    ["trust_store", input.trust_store],
    ...(transparency
      ? ([
          ["transparency_index", transparency.index],
          ...(transparency.prior_index === undefined
            ? []
            : [["transparency_prior_index", transparency.prior_index]]),
          ["transparency_trust_store", transparency.trust_store]
        ] as Array<[keyof AICRelianceExpectedArtifactDigests, unknown]>)
      : [])
  ];

  for (const [field, value] of candidates) {
    try {
      values[field] = createAICDigest(value);
    } catch (error) {
      throw new TypeError(`AIC reliance artifact ${field} could not be canonically digested.`, {
        cause: error
      });
    }
  }

  return values as AICRelianceExpectedArtifactDigests;
}

function artifactDigests(
  input: EvaluateAICRelianceInput,
  transparency: AICRelianceTransparencyInput | undefined
): AICRelianceArtifactDigests {
  const values: AICRelianceArtifactDigests = {};
  const candidates: Array<[keyof AICRelianceArtifactDigests, unknown]> = [
    ["attestation", input.attestation],
    ["contract", input.contract],
    ["observations", input.observations],
    ["policy", input.policy],
    ["proof", input.proof],
    ["trust_store", input.trust_store],
    ["transparency_index", transparency?.index],
    ["transparency_prior_index", transparency?.prior_index],
    ["transparency_trust_store", transparency?.trust_store]
  ];
  for (const [key, value] of candidates) {
    if (value === undefined) continue;
    const valueDigest = digest(value);
    if (valueDigest !== undefined) values[key] = valueDigest;
  }
  return values;
}

function validateArtifacts(input: EvaluateAICRelianceInput): ValidatedArtifacts | undefined {
  const contract = validateAICBehaviorContract(input.contract);
  const proof = validateAICBehaviorProof(input.proof);
  const observations = validateAICBehaviorObservationSet(input.observations);
  const policy = validateAICAssurancePolicy(input.policy);
  const attestation = validateAICSignedAttestation(input.attestation);
  const trustStore = validateAICTrustStore(input.trust_store);
  if (!contract.ok || !proof.ok || !observations.ok || !policy.ok || !attestation.ok || !trustStore.ok) {
    return undefined;
  }
  return {
    attestation: attestation.value,
    contract: contract.value,
    observations: observations.value,
    policy: policy.value,
    proof: proof.value
  };
}

function requestReasonCodes(input: EvaluateAICRelianceInput): AICRelianceReasonCode[] {
  const reasons: AICRelianceReasonCode[] = [];
  if (!isCanonicalOrigin(input.origin)) reasons.push("request_origin_invalid");
  if (typeof input.operation_id !== "string" || input.operation_id.trim().length === 0) reasons.push("request_operation_id_invalid");
  if (typeof input.expected_deployment_id !== "string" || input.expected_deployment_id.trim().length === 0) reasons.push("request_deployment_id_invalid");
  if (!isFullSourceRevision(input.expected_revision)) reasons.push("request_revision_invalid");
  if (!TRUST_ENVIRONMENTS.has(input.environment)) reasons.push("request_environment_invalid");
  if (input.evaluated_at !== undefined && !isAICRfc3339DateTime(input.evaluated_at)) reasons.push("artifacts_invalid");
  if (input.disposition !== undefined && validatedDisposition(input.disposition) === undefined) {
    reasons.push("artifacts_invalid");
  }
  return reasons;
}

function bindingReasonCodes(input: EvaluateAICRelianceInput, artifacts: ValidatedArtifacts): AICRelianceReasonCode[] {
  const reasons: AICRelianceReasonCode[] = [];
  const statement = artifacts.attestation.statement;
  if (statement.deployment.origin !== input.origin) reasons.push("binding_origin_mismatch");
  if (
    artifacts.contract.action.operation_id !== input.operation_id ||
    statement.subject.operation_id !== input.operation_id
  ) {
    reasons.push("binding_operation_mismatch");
  }
  if (statement.deployment.deployment_id !== input.expected_deployment_id) reasons.push("binding_deployment_mismatch");
  if (statement.deployment.source_revision !== input.expected_revision) reasons.push("binding_revision_mismatch");
  if (statement.deployment.environment !== input.environment) reasons.push("binding_deployment_mismatch");
  return reasons;
}

function policyChecksFreshness(policy: AICAssurancePolicy, evaluation: AICPolicyEvaluation): boolean {
  const appliedRuleIds = new Set(evaluation.rules.filter((rule) => rule.status !== "not_applicable").map((rule) => rule.id));
  return policy.rules.some((rule) => {
    if (!appliedRuleIds.has(rule.id)) return false;
    const requirements = rule.require;
    return (
      requirements.maximum_observation_age_seconds !== undefined ||
      requirements.maximum_proof_age_seconds !== undefined ||
      requirements.attestation?.maximum_age_seconds !== undefined ||
      requirements.attestation?.require_expiry === true
    );
  });
}

function freshness(
  evaluatedAt: string,
  artifacts: ValidatedArtifacts | undefined,
  policyEvaluation: AICPolicyEvaluation | undefined,
  trust: AICTrustVerificationResult | undefined
): { freshness: AICRelianceEvidenceFreshness; reasons: AICRelianceReasonCode[] } {
  if (!artifacts) return { freshness: { status: "invalid" }, reasons: [] };
  const proofAge = ageSeconds(artifacts.proof.generated_at, evaluatedAt);
  const observationAges = artifacts.observations.observations.map((observation) => ageSeconds(observation.captured_at, evaluatedAt));
  const attestationAge = ageSeconds(artifacts.attestation.statement.issued_at, evaluatedAt);
  const result: AICRelianceEvidenceFreshness = {
    attestation_age_seconds: attestationAge,
    ...(artifacts.attestation.statement.expires_at
      ? { attestation_expires_at: artifacts.attestation.statement.expires_at }
      : {}),
    ...(observationAges.length > 0 ? { oldest_observation_age_seconds: Math.max(...observationAges) } : {}),
    proof_age_seconds: proofAge,
    status: "not_checked"
  };
  const policyCodes = new Set(policyEvaluation?.findings.map((finding) => finding.code) ?? []);
  const future = proofAge < 0 || attestationAge < 0 || observationAges.some((age) => age < 0) || policyCodes.has("future_evidence");
  const expired = artifacts.attestation.statement.expires_at !== undefined && Date.parse(artifacts.attestation.statement.expires_at) <= Date.parse(evaluatedAt);
  const stale = expired || ["attestation_age_exceeded", "observation_age_exceeded", "proof_age_exceeded"].some((code) => policyCodes.has(code as never));
  if (future) return { freshness: { ...result, status: "future" }, reasons: ["evidence_future"] };
  if (stale || trust?.findings.some((finding) => finding.code === "expired_attestation")) {
    return { freshness: { ...result, status: "stale" }, reasons: ["evidence_stale"] };
  }
  if (policyEvaluation && (policyChecksFreshness(artifacts.policy, policyEvaluation) || artifacts.attestation.statement.expires_at !== undefined)) {
    return { freshness: { ...result, status: "fresh" }, reasons: [] };
  }
  return { freshness: result, reasons: ["evidence_freshness_not_checked"] };
}

function exclusiveAgeDeadline(value: string, maximumAgeSeconds: number): number {
  return Date.parse(value) + maximumAgeSeconds * 1000 + 1;
}

function relianceValidityDeadline(
  evaluatedAt: string,
  artifacts: ValidatedArtifacts,
  policyEvaluation: AICPolicyEvaluation,
  transparencyInput: AICRelianceTransparencyInput | undefined
): string {
  const deadlines = [
    Date.parse(evaluatedAt) + AIC_RELIANCE_MAX_VALIDITY_SECONDS * 1000
  ];
  const passedRuleIds = new Set(
    policyEvaluation.rules
      .filter((rule) => rule.status === "passed")
      .map((rule) => rule.id)
  );

  for (const rule of artifacts.policy.rules) {
    if (!passedRuleIds.has(rule.id)) continue;
    const requirements = rule.require;
    if (requirements.maximum_proof_age_seconds !== undefined) {
      deadlines.push(
        exclusiveAgeDeadline(
          artifacts.proof.generated_at,
          requirements.maximum_proof_age_seconds
        )
      );
    }
    if (requirements.maximum_observation_age_seconds !== undefined) {
      for (const observation of artifacts.observations.observations) {
        deadlines.push(
          exclusiveAgeDeadline(
            observation.captured_at,
            requirements.maximum_observation_age_seconds
          )
        );
      }
    }
    if (requirements.attestation?.maximum_age_seconds !== undefined) {
      deadlines.push(
        exclusiveAgeDeadline(
          artifacts.attestation.statement.issued_at,
          requirements.attestation.maximum_age_seconds
        )
      );
    }
    if (
      requirements.transparency?.maximum_checkpoint_age_seconds !== undefined &&
      transparencyInput !== undefined
    ) {
      const index = validateAICTransparencyIndex(transparencyInput.index);
      if (index.ok) {
        deadlines.push(
          exclusiveAgeDeadline(
            index.value.checkpoint.statement.issued_at,
            requirements.transparency.maximum_checkpoint_age_seconds
          )
        );
      }
    }
  }

  if (artifacts.attestation.statement.expires_at !== undefined) {
    deadlines.push(Date.parse(artifacts.attestation.statement.expires_at));
  }

  return new Date(Math.min(...deadlines)).toISOString();
}

function transparencyCheck(
  transparencyInput: AICRelianceTransparencyInput | undefined,
  evaluatedAt: string,
  attestationDigest: string | undefined,
  requirements: RequiredTransparency[]
): {
  check: AICRelianceCheck;
  failed: boolean;
  reasons: AICRelianceReasonCode[];
  verification?: AICTransparencyVerificationResult;
} {
  if (!transparencyInput) {
    return requirements.length > 0
      ? { check: "failed", failed: true, reasons: ["transparency_required"] }
      : { check: "not_checked", failed: false, reasons: [] };
  }
  const indexValidation = validateAICTransparencyIndex(transparencyInput.index);
  const storeValidation = validateAICTrustStore(transparencyInput.trust_store);
  const priorValidation = transparencyInput.prior_index === undefined
    ? undefined
    : validateAICTransparencyIndex(transparencyInput.prior_index);
  if (!indexValidation.ok || !storeValidation.ok || priorValidation?.ok === false) {
    return { check: "failed", failed: true, reasons: ["transparency_invalid"] };
  }
  const verification = verifyAICTransparencyIndex({
    index: indexValidation.value,
    logTrustStore: storeValidation.value,
    verifiedAt: evaluatedAt
  });
  if (verification.status === "invalid") {
    return { check: "failed", failed: true, reasons: ["transparency_invalid"], verification };
  }
  if (verification.status !== "trusted") {
    return { check: "failed", failed: true, reasons: ["transparency_untrusted"], verification };
  }
  const policyReasons: AICRelianceReasonCode[] = [];
  for (const requirement of requirements) {
    if (requirement.allowed_log_ids && !requirement.allowed_log_ids.includes(indexValidation.value.log_id)) {
      policyReasons.push("transparency_log_disallowed");
    }
    if (
      requirement.allowed_key_ids &&
      !requirement.allowed_key_ids.includes(indexValidation.value.checkpoint.signature.key_id)
    ) {
      policyReasons.push("transparency_key_disallowed");
    }
    if (
      requirement.maximum_checkpoint_age_seconds !== undefined &&
      ageSeconds(indexValidation.value.checkpoint.statement.issued_at, evaluatedAt) >
        requirement.maximum_checkpoint_age_seconds
    ) {
      policyReasons.push("transparency_checkpoint_stale");
    }
    if (
      requirement.minimum_size !== undefined &&
      indexValidation.value.checkpoint.statement.size < requirement.minimum_size
    ) {
      policyReasons.push("transparency_size_below_minimum");
    }
    if (
      requirement.expected_checkpoint_digest !== undefined &&
      createAICTransparencyCheckpointDigest(indexValidation.value.checkpoint) !==
        requirement.expected_checkpoint_digest
    ) {
      policyReasons.push("transparency_checkpoint_mismatch");
    }
    if (requirement.require_consistency && !priorValidation?.ok) {
      policyReasons.push("transparency_consistency_required");
    }
    if (
      priorValidation?.ok &&
      requirement.expected_prior_checkpoint_digest !== undefined &&
      createAICTransparencyCheckpointDigest(priorValidation.value.checkpoint) !==
        requirement.expected_prior_checkpoint_digest
    ) {
      policyReasons.push("transparency_prior_checkpoint_mismatch");
    }
  }
  if (priorValidation?.ok) {
    const consistency = verifyAICTransparencyConsistency({
      from: priorValidation.value,
      logTrustStore: storeValidation.value,
      to: indexValidation.value,
      verifiedAt: evaluatedAt
    });
    if (consistency.status !== "consistent") {
      policyReasons.push("transparency_inconsistent");
    }
  }
  if (policyReasons.length > 0) {
    return { check: "failed", failed: true, reasons: unique(policyReasons), verification };
  }
  const entry = indexValidation.value.entries.find(
    (candidate) => candidate.kind === "attestation" && candidate.artifact_digest === attestationDigest
  );
  if (!entry) {
    return {
      check: "failed",
      failed: true,
      reasons: ["transparency_attestation_missing"],
      verification
    };
  }
  return {
    check: "passed",
    failed: false,
    reasons: entry.external_receipts?.length
      ? ["transparency_external_receipt_not_checked"]
      : [],
    verification
  };
}

/**
 * Evaluates only caller-supplied artifacts. This function performs no network,
 * registry, resolver, environment-variable, or filesystem discovery.
 */
export function evaluateAICReliance(input: EvaluateAICRelianceInput): AICRelianceDecision {
  const disposition = validatedDisposition(input.disposition);
  const transparencyInput = validatedTransparencyInput(input.transparency);
  const suppliedEvaluationTimeValid = input.evaluated_at === undefined || isAICRfc3339DateTime(input.evaluated_at);
  const evaluatedAt = suppliedEvaluationTimeValid ? (input.evaluated_at ?? new Date().toISOString()) : new Date().toISOString();
  const request: AICRelianceDecision["request"] = {
    ...(input.environment && TRUST_ENVIRONMENTS.has(input.environment)
      ? { environment: input.environment }
      : {}),
    expected_deployment_id: typeof input.expected_deployment_id === "string" ? input.expected_deployment_id : "",
    expected_revision: typeof input.expected_revision === "string" ? input.expected_revision : "",
    operation_id: typeof input.operation_id === "string" ? input.operation_id : "",
    origin: typeof input.origin === "string" ? input.origin : ""
  };
  const digests = artifactDigests(input, transparencyInput);
  const requestReasons = unique([
    ...requestReasonCodes(input),
    ...(input.transparency !== undefined && transparencyInput === undefined
      ? (["artifacts_invalid"] as const)
      : [])
  ]);
  if (requestReasons.length > 0) {
    const outcome: RelianceOutcome = "indeterminate";
    const verdict = verdictFor(outcome, disposition);
    return finalizeDecision({
      artifact_digests: digests,
      artifact_type: AIC_RELIANCE_ARTIFACT_TYPE,
      checks: { artifacts: "not_checked", policy: "not_checked", request_binding: "failed", transparency: "not_checked", trust: "not_checked" },
      evaluated_at: evaluatedAt,
      evidence_freshness: { status: "invalid" },
      reason_codes: unique([...requestReasons, ...(verdict === "confirm" ? ["confirmation_required" as const] : [])]),
      request,
      spec: AIC_RELIANCE_SPEC,
      verdict
    });
  }

  const artifacts = validateArtifacts(input);
  if (!artifacts) {
    const outcome: RelianceOutcome = "indeterminate";
    const verdict = verdictFor(outcome, disposition);
    return finalizeDecision({
      artifact_digests: digests,
      artifact_type: AIC_RELIANCE_ARTIFACT_TYPE,
      checks: { artifacts: "failed", policy: "not_checked", request_binding: "not_checked", transparency: "not_checked", trust: "not_checked" },
      evaluated_at: evaluatedAt,
      evidence_freshness: { status: "invalid" },
      reason_codes: unique(["artifacts_invalid", ...(verdict === "confirm" ? ["confirmation_required" as const] : [])]),
      request,
      spec: AIC_RELIANCE_SPEC,
      verdict
    });
  }

  const bindingReasons = bindingReasonCodes(input, artifacts);
  const trust = verifyAICSignedAttestation({
    attestation: artifacts.attestation,
    contract: artifacts.contract,
    expectedOrigin: input.origin,
    expectedRevision: input.expected_revision,
    proof: artifacts.proof,
    trustStore: input.trust_store,
    verifiedAt: evaluatedAt
  });
  const trustReasons: AICRelianceReasonCode[] = trust.status === "invalid"
    ? ["trust_invalid"]
    : trust.status === "trusted"
      ? []
      : ["trust_untrusted"];

  const policyEvaluation = evaluateAICAssurancePolicy({
    attestation: artifacts.attestation,
    contract: artifacts.contract,
    environment: input.environment,
    evaluatedAt,
    expectedOrigin: input.origin,
    expectedRevision: input.expected_revision,
    observations: artifacts.observations,
    policy: artifacts.policy,
    proof: artifacts.proof,
    ...(transparencyInput
      ? {
          transparency: {
            index: transparencyInput.index,
            ...(transparencyInput.prior_index === undefined
              ? {}
              : { priorIndex: transparencyInput.prior_index }),
            trustStore: transparencyInput.trust_store
          }
        }
      : {}),
    trustStore: input.trust_store
  });
  const policyReasons: AICRelianceReasonCode[] = policyEvaluation.decision === "failed"
    ? ["policy_failed"]
    : policyEvaluation.decision === "indeterminate"
      ? ["policy_indeterminate"]
      : [];
  const policyConfigurationReasons: AICRelianceReasonCode[] = [
    ...(artifacts.policy.unmatched === "fail" ? [] : ["policy_not_fail_closed" as const]),
    ...(policyEvaluation.rules.some((rule) => rule.status !== "not_applicable")
      ? []
      : ["policy_rule_unmatched" as const])
  ];
  const applicableRuleIds = new Set(
    policyEvaluation.rules
      .filter((rule) => rule.status !== "not_applicable")
      .map((rule) => rule.id)
  );
  const requiredTransparency: RequiredTransparency[] = artifacts.policy.rules
    .filter((rule) => applicableRuleIds.has(rule.id) && rule.require.transparency?.required === true)
    .map((rule) => ({
      ...(rule.require.transparency?.allowed_key_ids
        ? { allowed_key_ids: rule.require.transparency.allowed_key_ids }
        : {}),
      ...(rule.require.transparency?.allowed_log_ids
        ? { allowed_log_ids: rule.require.transparency.allowed_log_ids }
        : {}),
      ...(rule.require.transparency?.expected_checkpoint_digest
        ? {
            expected_checkpoint_digest:
              rule.require.transparency.expected_checkpoint_digest
          }
        : {}),
      ...(rule.require.transparency?.expected_prior_checkpoint_digest
        ? {
            expected_prior_checkpoint_digest:
              rule.require.transparency.expected_prior_checkpoint_digest
          }
        : {}),
      ...(rule.require.transparency?.maximum_checkpoint_age_seconds !== undefined
        ? {
            maximum_checkpoint_age_seconds:
              rule.require.transparency.maximum_checkpoint_age_seconds
          }
        : {}),
      ...(rule.require.transparency?.minimum_size !== undefined
        ? { minimum_size: rule.require.transparency.minimum_size }
        : {}),
      ...(rule.require.transparency?.require_consistency !== undefined
        ? { require_consistency: rule.require.transparency.require_consistency }
        : {})
    }));
  const transparency = transparencyCheck(
    transparencyInput,
    evaluatedAt,
    digests.attestation,
    requiredTransparency
  );
  const evidenceFreshness = freshness(evaluatedAt, artifacts, policyEvaluation, trust);

  let outcome: RelianceOutcome;
  if (policyEvaluation.decision === "indeterminate") outcome = "indeterminate";
  else if (
    bindingReasons.length > 0 ||
    trust.status !== "trusted" ||
    transparency.failed ||
    policyEvaluation.decision === "failed" ||
    policyConfigurationReasons.length > 0 ||
    ["future", "invalid", "stale"].includes(evidenceFreshness.freshness.status)
  ) outcome = "failed";
  else outcome = "passed";

  const verdict = verdictFor(outcome, disposition);
  const validUntil = verdict === "allow"
    ? relianceValidityDeadline(
        evaluatedAt,
        artifacts,
        policyEvaluation,
        transparencyInput
      )
    : undefined;
  const successReason: AICRelianceReasonCode[] = outcome === "passed" ? ["requirements_satisfied"] : [];
  const confirmationReason: AICRelianceReasonCode[] = verdict === "confirm" ? ["confirmation_required"] : [];
  return finalizeDecision({
    artifact_digests: digests,
    artifact_type: AIC_RELIANCE_ARTIFACT_TYPE,
    checks: {
      artifacts: "passed",
      policy:
        policyEvaluation.decision === "passed" && policyConfigurationReasons.length === 0
          ? "passed"
          : "failed",
      request_binding: bindingReasons.length === 0 ? "passed" : "failed",
      transparency: transparency.check,
      trust: trust.status === "trusted" ? "passed" : "failed"
    },
    evaluated_at: evaluatedAt,
    evidence_freshness: evidenceFreshness.freshness,
    policy_evaluation: policyEvaluation,
    reason_codes: unique([
      ...successReason,
      ...confirmationReason,
      ...bindingReasons,
      ...trustReasons,
      ...policyReasons,
      ...policyConfigurationReasons,
      ...evidenceFreshness.reasons,
      ...transparency.reasons
    ]),
    request,
    spec: AIC_RELIANCE_SPEC,
    ...(validUntil === undefined ? {} : { valid_until: validUntil }),
    verdict
  });
}

export class AICReliancePreflightError extends Error {
  readonly code = "AIC_RELIANCE_BLOCKED";
  readonly result: AICRelianceDecision;

  constructor(result: AICRelianceDecision) {
    super(`AIC reliance preflight returned ${result.verdict}: ${result.reason_codes.join(", ") || "no reason"}`);
    this.name = "AICReliancePreflightError";
    this.result = result;
  }
}

export class AICInvalidRelianceDecisionError extends Error {
  readonly code = "AIC_RELIANCE_DECISION_INVALID";
  readonly issues: ReturnType<typeof validateAICRelianceDecision>["issues"];

  constructor(issues: ReturnType<typeof validateAICRelianceDecision>["issues"]) {
    super(
      `AIC reliance decision is invalid: ${issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`
    );
    this.name = "AICInvalidRelianceDecisionError";
    this.issues = issues;
  }
}

export class AICRelianceDecisionNotCurrentError extends Error {
  readonly code = "AIC_RELIANCE_DECISION_NOT_CURRENT";
  readonly result: AICRelianceDecision;

  constructor(result: AICRelianceDecision, message: string) {
    super(message);
    this.name = "AICRelianceDecisionNotCurrentError";
    this.result = result;
  }
}

export class AICRelianceDecisionBindingError extends Error {
  readonly code = "AIC_RELIANCE_DECISION_BINDING_MISMATCH";
  readonly result: AICRelianceDecision;

  constructor(result: AICRelianceDecision, message: string) {
    super(message);
    this.name = "AICRelianceDecisionBindingError";
    this.result = result;
  }
}

export class AICRelianceDecisionReproductionError extends Error {
  readonly code = "AIC_RELIANCE_DECISION_REPRODUCTION_MISMATCH";
  readonly result: AICRelianceDecision;

  constructor(result: AICRelianceDecision) {
    super(
      "AIC reliance decision does not match local evaluation of the consumer-owned inputs."
    );
    this.name = "AICRelianceDecisionReproductionError";
    this.result = result;
  }
}

function assertDecisionBindings(
  result: AICRelianceDecision,
  input: EvaluateAICRelianceInput
): void {
  const expectedDigests = createAICRelianceArtifactDigests(input);
  const expectedDigestKeys = Object.keys(expectedDigests).sort();
  const actualDigestKeys = Object.keys(result.artifact_digests).sort();
  if (
    actualDigestKeys.length !== expectedDigestKeys.length ||
    actualDigestKeys.some((field, index) => field !== expectedDigestKeys[index]) ||
    expectedDigestKeys.some(
      (field) =>
        result.artifact_digests[field as keyof AICRelianceArtifactDigests] !==
        expectedDigests[field as keyof AICRelianceExpectedArtifactDigests]
    )
  ) {
    throw new AICRelianceDecisionBindingError(
      result,
      "AIC reliance decision artifact digests do not exactly match the consumer's artifacts."
    );
  }

  const expectedRequest: AICRelianceExpectedRequest = {
    environment: input.environment,
    expected_deployment_id: input.expected_deployment_id,
    expected_revision: input.expected_revision,
    operation_id: input.operation_id,
    origin: input.origin
  };
  if (!TRUST_ENVIRONMENTS.has(expectedRequest.environment)) {
    throw new TypeError(
      "AIC assertion input must contain a supported consumer environment."
    );
  }

  for (const field of REQUEST_BINDING_FIELDS) {
    if (result.request[field] !== expectedRequest[field]) {
      throw new AICRelianceDecisionBindingError(
        result,
        `AIC reliance decision does not match expected request field ${field}.`
      );
    }
  }
}

export function assertAICRelianceAllowed(
  result: unknown,
  options: AICRelianceAssertionOptions
): AICRelianceDecision {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw new TypeError(
      "AIC allow assertions require the exact consumer-owned evaluation input."
    );
  }
  let input: EvaluateAICRelianceInput;
  try {
    // Snapshot consumer-owned inputs before touching the untrusted decision. A
    // stateful decision object therefore cannot rewrite the policy or audience
    // that will be used for local reproduction.
    input = JSON.parse(createAICCanonicalJson(options.input)) as EvaluateAICRelianceInput;
  } catch (error) {
    throw new TypeError("AIC reliance assertion input must be finite, plain JSON data.", {
      cause: error
    });
  }
  let decisionSnapshot: unknown;
  try {
    // Canonical cloning reads only data descriptors, rejects accessors and
    // exotic values, and detaches authorization from later mutation of the raw
    // object. This closes validator/use races from stateful Proxy views.
    decisionSnapshot = JSON.parse(createAICCanonicalJson(result));
  } catch {
    throw new AICInvalidRelianceDecisionError([
      {
        message: "Expected finite, plain JSON data without accessors",
        path: "$",
        rule: "reliance.snapshot",
        severity: "fatal"
      }
    ]);
  }
  const validation = validateAICRelianceDecision(decisionSnapshot);
  if (!validation.ok) throw new AICInvalidRelianceDecisionError(validation.issues);
  if (validation.value.verdict !== "allow") {
    throw new AICReliancePreflightError(validation.value);
  }
  assertDecisionBindings(validation.value, input);
  const maximumAge = options.max_decision_age_seconds ?? 60;
  const futureSkew = options.max_future_skew_seconds ?? 0;
  const minimumValidity = options.minimum_validity_seconds ?? 0;
  if (
    !Number.isFinite(maximumAge) ||
    maximumAge < 0 ||
    !Number.isFinite(futureSkew) ||
    futureSkew < 0 ||
    !Number.isFinite(minimumValidity) ||
    minimumValidity < 0 ||
    minimumValidity > AIC_RELIANCE_MAX_VALIDITY_SECONDS
  ) {
    throw new TypeError(
      `AIC reliance decision age limits must be non-negative finite numbers and minimum_validity_seconds must be at most ${AIC_RELIANCE_MAX_VALIDITY_SECONDS}.`
    );
  }
  const reproduced = evaluateAICReliance({
    ...input,
    evaluated_at: validation.value.evaluated_at
  });
  if (createAICDigest(reproduced) !== createAICDigest(validation.value)) {
    throw new AICRelianceDecisionReproductionError(validation.value);
  }
  // Sample trusted time only after the potentially expensive full local
  // reproduction. A decision that expires while hashing or verifying cannot be
  // authorized using a stale pre-reproduction timestamp.
  const now = trustedNow(options.clock);
  const decisionAge = ageSeconds(validation.value.evaluated_at, now);
  if (decisionAge > maximumAge || decisionAge < -futureSkew) {
    throw new AICRelianceDecisionNotCurrentError(
      validation.value,
      `AIC reliance decision is outside the trusted time window (${decisionAge} seconds old).`
    );
  }
  if (Date.parse(now) >= Date.parse(validation.value.valid_until!)) {
    throw new AICRelianceDecisionNotCurrentError(
      validation.value,
      `AIC reliance decision reached its exclusive validity deadline ${validation.value.valid_until}.`
    );
  }
  if (
    Date.parse(validation.value.valid_until!) - Date.parse(now) <
    minimumValidity * 1000
  ) {
    throw new AICRelianceDecisionNotCurrentError(
      validation.value,
      `AIC reliance decision has less than ${minimumValidity} seconds of residual validity.`
    );
  }
  if (
    validation.value.evidence_freshness.attestation_expires_at !== undefined &&
    Date.parse(validation.value.evidence_freshness.attestation_expires_at) <= Date.parse(now)
  ) {
    throw new AICRelianceDecisionNotCurrentError(
      validation.value,
      "AIC reliance decision binds an attestation that is now expired."
    );
  }
  return validation.value;
}

export function createAICReliancePreflight<TContext>(
  load: (context: TContext) => EvaluateAICRelianceInput | Promise<EvaluateAICRelianceInput>,
  options: AICReliancePreflightOptions = {}
): (context: TContext) => Promise<AICRelianceDecision> {
  return async (context) => {
    const loaded = await load(context);
    let input: EvaluateAICRelianceInput;
    try {
      input = JSON.parse(createAICCanonicalJson(loaded)) as EvaluateAICRelianceInput;
    } catch (error) {
      throw new TypeError("AIC reliance preflight input must be finite, plain JSON data.", {
        cause: error
      });
    }

    const firstEvaluationTime = trustedNow(options.clock);
    let result = evaluateAICReliance({
      ...input,
      evaluated_at: firstEvaluationTime
    });
    const secondEvaluationTime = trustedNow(options.clock);
    if (secondEvaluationTime !== firstEvaluationTime) {
      result = evaluateAICReliance({
        ...input,
        evaluated_at: secondEvaluationTime
      });
    }

    return assertAICRelianceAllowed(result, {
      ...options,
      input
    });
  };
}
