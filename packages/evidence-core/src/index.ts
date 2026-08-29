import { createHash } from "node:crypto";
import {
  AIC_EVIDENCE_SPEC,
  type AICBehaviorContract,
  type AICBehaviorEvidenceReference,
  type AICBehaviorObservation,
  type AICBehaviorObservationSet,
  type AICDeploymentIdentity,
  type AICEvidenceAdapterCollection,
  type AICEvidenceArtifact,
  type AICEvidenceBundle,
  type AICEvidenceObservationProjection,
  type AICEvidencePlan,
  type AICEvidencePredicate,
  type AICEvidenceReceipt,
  type AICEvidenceSurfacePlan,
  type AICEvidenceValueExpression,
  type AICProtectedSignature,
  type AICRemoteRunnerIdentity,
  type JsonValue,
  isAICBehaviorConfirmation,
  isAICBehaviorStatus,
  validateAICBehaviorContract,
  validateAICBehaviorObservationSet,
  validateAICDeploymentIdentity,
  validateAICEvidenceBundle,
  validateAICEvidencePlan
} from "@aicorg/spec";

export type AICEvidenceCollectionErrorCode =
  | "deployment_mismatch"
  | "evidence_invalid"
  | "outcome_uncertain"
  | "plan_invalid"
  | "response_invalid"
  | "target_rejected"
  | "tool_mismatch"
  | "transport_failed";

export class AICEvidenceCollectionError extends Error {
  readonly code: AICEvidenceCollectionErrorCode;
  readonly execution: "not_started" | "started" | "uncertain";

  constructor(
    code: AICEvidenceCollectionErrorCode,
    message: string,
    options: {
      cause?: unknown;
      execution?: "not_started" | "started" | "uncertain";
    } = {}
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AICEvidenceCollectionError";
    this.code = code;
    this.execution = options.execution ?? "not_started";
  }
}

export interface AICFetchRequestInit {
  body?: string;
  headers?: Record<string, string>;
  method?: string;
  redirect?: "error" | "follow" | "manual";
  signal?: AbortSignal;
}

export interface AICFetchResponse {
  arrayBuffer(): Promise<ArrayBuffer>;
  headers: {
    forEach(callback: (value: string, key: string) => void): void;
    get(name: string): string | null;
  };
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
  url?: string;
}

export type AICFetch = (
  input: string | URL,
  init?: AICFetchRequestInit
) => Promise<AICFetchResponse>;

export type AICCredentialResolver = (secretReference: string) => Promise<string> | string;

export interface AICEvidenceAdapterExecutionContext {
  allowDestructive: boolean;
  allowedMutationOperations: ReadonlySet<string>;
  contract: AICBehaviorContract;
  credentials?: AICCredentialResolver;
  fetch: AICFetch;
  now: () => Date;
  plan: AICEvidencePlan;
  signal: AbortSignal;
  targetOrigin: string;
}

export interface AICEvidenceAdapter {
  readonly id: string;
  readonly protocolVersion: string;
  readonly version: string;
  collect(context: AICEvidenceAdapterExecutionContext): Promise<AICEvidenceAdapterCollection>;
}

export interface AICEvidencePlanFinding {
  code:
    | "adapter_surface_mismatch"
    | "contract_digest_mismatch"
    | "contract_id_mismatch"
    | "missing_scenario"
    | "missing_surface"
    | "projection_requirement_mismatch"
    | "scenario_surface_mismatch"
    | "unexpected_scenario"
    | "unexpected_surface";
  message: string;
  scenario_id?: string;
  surface_id?: string;
}

export interface AICEvidenceBundleFinding {
  code:
    | "adapter_binding_mismatch"
    | "artifact_digest_mismatch"
    | "artifact_reference_missing"
    | "artifact_reference_unused"
    | "bundle_invalid"
    | "contract_binding_mismatch"
    | "deployment_binding_mismatch"
    | "evidence_manifest_mismatch"
    | "generated_at_mismatch"
    | "observation_binding_mismatch"
    | "observation_coverage_mismatch"
    | "observations_binding_mismatch"
    | "plan_binding_mismatch"
    | "receipt_count_invalid"
    | "receipt_digest_mismatch";
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown, ancestors = new Set<object>()): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (typeof value !== "object") {
    throw new TypeError("AIC canonical JSON accepts only finite JSON data.");
  }
  if (ancestors.has(value)) throw new TypeError("AIC canonical JSON cannot contain cycles.");
  ancestors.add(value);
  if (Array.isArray(value)) {
    const result = value.map((item) => canonicalize(item, ancestors));
    ancestors.delete(value);
    return result;
  }
  if (isRecord(value)) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("AIC canonical JSON accepts only plain data objects.");
    }
    const result = Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = canonicalize(value[key], ancestors);
        return result;
      }, {});
    ancestors.delete(value);
    return result;
  }
  throw new TypeError("AIC canonical JSON accepts only JSON data.");
}

export function createAICEvidenceCanonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function createAICEvidenceDigest(value: unknown): string {
  return `sha256:${createHash("sha256").update(createAICEvidenceCanonicalJson(value)).digest("hex")}`;
}

export function createAICEvidenceArtifact(input: {
  content: JsonValue;
  kind?: AICEvidenceArtifact["kind"];
}): AICEvidenceArtifact {
  const digest = createAICEvidenceDigest(input.content);
  return {
    content: input.content,
    digest,
    kind: input.kind ?? "trace",
    media_type: "application/json",
    ref: `urn:aic:evidence:${digest.slice("sha256:".length)}`
  };
}

function adapterAllowedForSurface(plan: AICEvidenceSurfacePlan, kind: string): boolean {
  if (plan.adapter === "@aicorg/evidence-http") return kind === "openapi" || kind === "custom";
  return kind === "mcp" || kind === "custom";
}

export function validateAICEvidencePlanForContract(input: {
  contract: unknown;
  plan: unknown;
  requireComplete?: boolean;
}): { findings: AICEvidencePlanFinding[]; ok: boolean; contract?: AICBehaviorContract; plan?: AICEvidencePlan } {
  const contractValidation = validateAICBehaviorContract(input.contract);
  const planValidation = validateAICEvidencePlan(input.plan);
  const findings: AICEvidencePlanFinding[] = [];
  if (!contractValidation.ok || !planValidation.ok) {
    return {
      findings: [
        ...(!contractValidation.ok
          ? [{ code: "contract_id_mismatch" as const, message: `Contract is invalid: ${contractValidation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}` }]
          : []),
        ...(!planValidation.ok
          ? [{ code: "contract_id_mismatch" as const, message: `Evidence plan is invalid: ${planValidation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}` }]
          : [])
      ],
      ok: false
    };
  }
  const contract = contractValidation.value;
  const plan = planValidation.value;
  if (plan.contract.id !== contract.id) {
    findings.push({ code: "contract_id_mismatch", message: `Plan targets ${plan.contract.id}, expected ${contract.id}.` });
  }
  const contractDigest = createAICEvidenceDigest(contract);
  if (plan.contract.digest !== contractDigest) {
    findings.push({ code: "contract_digest_mismatch", message: "Plan contract digest does not match the supplied contract." });
  }
  const contractSurfaces = new Map(contract.surfaces.map((surface) => [surface.id, surface]));
  const planSurfaceIds = new Set(plan.surfaces.map((surface) => surface.surface_id));
  for (const surfacePlan of plan.surfaces) {
    const surface = contractSurfaces.get(surfacePlan.surface_id);
    if (!surface) {
      findings.push({ code: "unexpected_surface", message: `Unknown surface: ${surfacePlan.surface_id}.`, surface_id: surfacePlan.surface_id });
      continue;
    }
    if (!adapterAllowedForSurface(surfacePlan, surface.kind)) {
      findings.push({ code: "adapter_surface_mismatch", message: `${surfacePlan.adapter} cannot collect ${surface.kind} evidence.`, surface_id: surface.id });
    }
    const expectedScenarios = contract.scenarios.filter((scenario) => scenario.surfaces.includes(surface.id));
    const expectedIds = new Set(expectedScenarios.map((scenario) => scenario.id));
    const actualIds = new Set(surfacePlan.scenarios.map((scenario) => scenario.scenario_id));
    for (const scenario of expectedScenarios) {
      const scenarioPlan = surfacePlan.scenarios.find((candidate) => candidate.scenario_id === scenario.id);
      if (!scenarioPlan) {
        findings.push({ code: "missing_scenario", message: `Missing scenario ${scenario.id} for ${surface.id}.`, scenario_id: scenario.id, surface_id: surface.id });
        continue;
      }
      const expectedRequirements = new Set([
        ...scenario.expected.required_requirements,
        ...(scenario.expected.forbidden_requirements ?? [])
      ]);
      const mappedRequirements = new Set(
        scenarioPlan.projection.checks.map((check) => check.requirement_id)
      );
      if (
        expectedRequirements.size !== mappedRequirements.size ||
        [...expectedRequirements].some((requirement) => !mappedRequirements.has(requirement))
      ) {
        findings.push({
          code: "projection_requirement_mismatch",
          message: `Projection requirements for ${scenario.id}/${surface.id} must exactly match required and forbidden contract requirements.`,
          scenario_id: scenario.id,
          surface_id: surface.id
        });
      }
    }
    for (const scenarioId of actualIds) {
      if (!expectedIds.has(scenarioId)) {
        findings.push({ code: "unexpected_scenario", message: `Scenario ${scenarioId} does not target ${surface.id}.`, scenario_id: scenarioId, surface_id: surface.id });
      }
    }
  }
  if (input.requireComplete !== false) {
    for (const surface of contract.surfaces) {
      if (!planSurfaceIds.has(surface.id)) {
        findings.push({ code: "missing_surface", message: `No evidence plan exists for contract surface ${surface.id}.`, surface_id: surface.id });
      }
    }
  }
  return { contract, findings, ok: findings.length === 0, plan };
}

const MISSING = Symbol("missing");

function unescapePointerToken(token: string): string {
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

function resolvePointer(value: unknown, pointer: string): unknown | typeof MISSING {
  if (pointer === "") return value;
  let current: unknown = value;
  for (const rawToken of pointer.slice(1).split("/")) {
    const token = unescapePointerToken(rawToken);
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/.test(token)) return MISSING;
      const index = Number(token);
      if (index >= current.length) return MISSING;
      current = current[index];
      continue;
    }
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, token)) return MISSING;
    current = current[token];
  }
  return current;
}

export function evaluateAICEvidenceExpression(
  expression: AICEvidenceValueExpression,
  sources: Readonly<Record<string, unknown>>
): unknown | typeof MISSING {
  if (Object.prototype.hasOwnProperty.call(expression, "literal")) return expression.literal;
  const source = expression.source ? sources[expression.source] : MISSING;
  if (source === undefined && expression.source && !Object.prototype.hasOwnProperty.call(sources, expression.source)) return MISSING;
  return expression.pointer === undefined ? source : resolvePointer(source, expression.pointer);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === MISSING || right === MISSING) return left === right;
  return createAICEvidenceCanonicalJson(left) === createAICEvidenceCanonicalJson(right);
}

export function evaluateAICEvidencePredicate(
  predicate: AICEvidencePredicate,
  sources: Readonly<Record<string, unknown>>
): boolean {
  const actual = evaluateAICEvidenceExpression(predicate, sources);
  switch (predicate.operator) {
    case "absent": return actual === MISSING;
    case "exists": return actual !== MISSING;
    case "equals": return valuesEqual(actual, predicate.value);
    case "not_equals": return !valuesEqual(actual, predicate.value);
    case "truthy": return actual !== MISSING && Boolean(actual);
    case "falsy": return actual !== MISSING && !actual;
    case "greater_than": return typeof actual === "number" && typeof predicate.value === "number" && actual > predicate.value;
    case "less_than": return typeof actual === "number" && typeof predicate.value === "number" && actual < predicate.value;
  }
}

function jsonValueFromExpression(
  expression: AICEvidenceValueExpression,
  sources: Readonly<Record<string, unknown>>,
  field: string
): JsonValue {
  const value = evaluateAICEvidenceExpression(expression, sources);
  if (value === MISSING || value === undefined || !isJsonValue(value)) {
    throw new AICEvidenceCollectionError("response_invalid", `${field} projection did not resolve to a JSON value.`, { execution: "started" });
  }
  return value;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || ["boolean", "number", "string"].includes(typeof value)) return typeof value !== "number" || Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item));
  return isRecord(value) && Object.values(value).every((item) => isJsonValue(item));
}

export function projectAICBehaviorObservation(input: {
  capturedAt: string;
  contract: AICBehaviorContract;
  durationMs: number;
  environment: Record<string, string>;
  evidence: AICBehaviorEvidenceReference[];
  projection: AICEvidenceObservationProjection;
  scenarioId: string;
  sources: Readonly<Record<string, unknown>>;
  surfaceId: string;
}): AICBehaviorObservation {
  const status = jsonValueFromExpression(input.projection.status, input.sources, "status");
  if (!isAICBehaviorStatus(status)) {
    throw new AICEvidenceCollectionError("response_invalid", `Projected status is unsupported: ${String(status)}.`, { execution: "started" });
  }
  const confirmation = input.projection.confirmation
    ? jsonValueFromExpression(input.projection.confirmation, input.sources, "confirmation")
    : undefined;
  if (confirmation !== undefined && !isAICBehaviorConfirmation(confirmation)) {
    throw new AICEvidenceCollectionError("response_invalid", `Projected confirmation is unsupported: ${String(confirmation)}.`, { execution: "started" });
  }
  const errorCode = input.projection.error_code
    ? jsonValueFromExpression(input.projection.error_code, input.sources, "error_code")
    : undefined;
  if (errorCode !== undefined && (typeof errorCode !== "string" || errorCode.length === 0)) {
    throw new AICEvidenceCollectionError("response_invalid", "Projected error_code must be a non-empty string.", { execution: "started" });
  }
  const outcome = input.projection.outcome
    ? jsonValueFromExpression(input.projection.outcome, input.sources, "outcome")
    : undefined;
  return {
    artifact_type: "aic_behavior_observation",
    captured_at: input.capturedAt,
    checks: input.projection.checks.map((check) => {
      const actualExpression = check.actual ?? check.observed_when;
      const actual = evaluateAICEvidenceExpression(actualExpression, input.sources);
      return {
        ...(actual !== MISSING && actual !== undefined && isJsonValue(actual) ? { actual } : {}),
        passed: evaluateAICEvidencePredicate(check.observed_when, input.sources),
        requirement_id: check.requirement_id
      };
    }),
    ...(confirmation !== undefined ? { confirmation } : {}),
    contract_id: input.contract.id,
    duration_ms: input.durationMs,
    environment: input.environment,
    ...(errorCode !== undefined ? { error_code: errorCode } : {}),
    evidence: input.evidence,
    mode: "executed",
    operation_id: input.contract.action.operation_id,
    ...(outcome !== undefined ? { outcome } : {}),
    scenario_id: input.scenarioId,
    status,
    surface_id: input.surfaceId
  };
}

export function mergeAICEvidenceCollections(input: {
  collections: AICEvidenceAdapterCollection[];
  contract: AICBehaviorContract;
  generatedAt: string;
}): { artifacts: AICEvidenceArtifact[]; observations: AICBehaviorObservationSet; requestCount: number } {
  const artifacts = input.collections.flatMap((collection) => collection.artifacts);
  const refs = new Set<string>();
  for (const artifact of artifacts) {
    if (refs.has(artifact.ref)) throw new AICEvidenceCollectionError("evidence_invalid", `Duplicate evidence artifact: ${artifact.ref}.`);
    refs.add(artifact.ref);
  }
  const observations: AICBehaviorObservationSet = {
    artifact_type: "aic_behavior_observation_set",
    contract_id: input.contract.id,
    generated_at: input.generatedAt,
    observations: input.collections.flatMap((collection) => collection.observations.observations)
  };
  const validation = validateAICBehaviorObservationSet(observations);
  if (!validation.ok) {
    throw new AICEvidenceCollectionError("evidence_invalid", `Collected observations are invalid: ${validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }
  const keys = new Set<string>();
  for (const observation of observations.observations) {
    const key = `${observation.scenario_id}\u0000${observation.surface_id}`;
    if (keys.has(key)) throw new AICEvidenceCollectionError("evidence_invalid", `Duplicate observation: ${observation.scenario_id}/${observation.surface_id}.`);
    keys.add(key);
  }
  return {
    artifacts,
    observations: validation.value,
    requestCount: input.collections.reduce((total, collection) => total + collection.request_count, 0)
  };
}

function evidenceManifest(artifacts: AICEvidenceArtifact[]): Array<Pick<AICEvidenceArtifact, "digest" | "kind" | "ref">> {
  return artifacts
    .map(({ digest, kind, ref }) => ({ digest, kind, ref }))
    .sort((left, right) => left.ref.localeCompare(right.ref));
}

export async function createAICEvidenceBundle(input: {
  collections: AICEvidenceAdapterCollection[];
  completedAt: string;
  contract: AICBehaviorContract;
  deploymentIdentity: AICDeploymentIdentity;
  jobId: string;
  plan: AICEvidencePlan;
  runner: AICRemoteRunnerIdentity;
  signer?: (canonicalReceipt: string) => Promise<AICProtectedSignature>;
  startedAt: string;
}): Promise<AICEvidenceBundle> {
  const planCheck = validateAICEvidencePlanForContract({ contract: input.contract, plan: input.plan });
  if (!planCheck.ok) {
    throw new AICEvidenceCollectionError(
      "plan_invalid",
      `Cannot bundle an invalid evidence plan: ${planCheck.findings.map((finding) => finding.message).join("; ")}`
    );
  }
  const deploymentCheck = validateAICDeploymentIdentity(input.deploymentIdentity);
  if (!deploymentCheck.ok || input.deploymentIdentity.environment !== "production") {
    throw new AICEvidenceCollectionError(
      "deployment_mismatch",
      deploymentCheck.ok
        ? "Remote evidence bundles require a production deployment identity."
        : `Deployment identity is invalid: ${deploymentCheck.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`
    );
  }
  if (
    !Number.isFinite(Date.parse(input.startedAt)) ||
    !Number.isFinite(Date.parse(input.completedAt)) ||
    Date.parse(input.completedAt) < Date.parse(input.startedAt)
  ) {
    throw new AICEvidenceCollectionError("evidence_invalid", "Evidence bundle timestamps are invalid or out of order.");
  }
  if (!input.jobId.trim()) throw new AICEvidenceCollectionError("plan_invalid", "Evidence bundle job id is required.");
  const merged = mergeAICEvidenceCollections({
    collections: input.collections,
    contract: input.contract,
    generatedAt: input.completedAt
  });
  const receipt: AICEvidenceReceipt = {
    adapters: input.collections
      .map((collection) => collection.adapter)
      .sort((left, right) => left.id.localeCompare(right.id)),
    artifact_type: "aic_evidence_receipt",
    completed_at: input.completedAt,
    contract: { digest: createAICEvidenceDigest(input.contract), id: input.contract.id },
    deployment_identity_digest: createAICEvidenceDigest(input.deploymentIdentity),
    evidence_manifest_digest: createAICEvidenceDigest(evidenceManifest(merged.artifacts)),
    job_id: input.jobId,
    observations_digest: createAICEvidenceDigest(merged.observations),
    plan_digest: createAICEvidenceDigest(input.plan),
    request_count: merged.requestCount + 1,
    runner: input.runner,
    spec: AIC_EVIDENCE_SPEC,
    started_at: input.startedAt,
    target: {
      deployment_id: input.deploymentIdentity.deployment_id,
      environment: "production",
      origin: input.deploymentIdentity.origin,
      source_revision: input.deploymentIdentity.source_revision
    }
  };
  const receiptDigest = createAICEvidenceDigest(receipt);
  const unsignedBundle: AICEvidenceBundle = {
    artifact_type: "aic_evidence_bundle",
    artifacts: merged.artifacts,
    contract: input.contract,
    deployment_identity: input.deploymentIdentity,
    generated_at: input.completedAt,
    observations: merged.observations,
    plan: input.plan,
    receipt,
    receipt_digest: receiptDigest,
    spec: AIC_EVIDENCE_SPEC,
    status: "completed"
  };
  const unsignedVerification = verifyAICEvidenceBundle(unsignedBundle);
  if (!unsignedVerification.ok) {
    throw new AICEvidenceCollectionError("evidence_invalid", `Generated evidence bundle failed verification: ${unsignedVerification.findings.map((finding) => finding.message).join("; ")}`);
  }
  const signature = input.signer
    ? await input.signer(createAICEvidenceCanonicalJson(receipt))
    : undefined;
  const bundle: AICEvidenceBundle = signature
    ? { ...unsignedBundle, receipt_signature: signature }
    : unsignedBundle;
  const verification = verifyAICEvidenceBundle(bundle);
  if (!verification.ok) {
    throw new AICEvidenceCollectionError("evidence_invalid", `Generated evidence bundle failed verification: ${verification.findings.map((finding) => finding.message).join("; ")}`);
  }
  return bundle;
}

export function verifyAICEvidenceBundle(value: unknown): {
  findings: AICEvidenceBundleFinding[];
  ok: boolean;
  value?: AICEvidenceBundle;
} {
  const validation = validateAICEvidenceBundle(value);
  if (!validation.ok) {
    return {
      findings: validation.issues.map((issue) => ({ code: "bundle_invalid", message: `${issue.path}: ${issue.message}` })),
      ok: false
    };
  }
  const bundle = validation.value;
  const findings: AICEvidenceBundleFinding[] = [];
  const planCheck = validateAICEvidencePlanForContract({ contract: bundle.contract, plan: bundle.plan });
  if (!planCheck.ok) findings.push({ code: "plan_binding_mismatch", message: planCheck.findings.map((finding) => finding.message).join("; ") });
  if (
    bundle.generated_at !== bundle.receipt.completed_at ||
    bundle.observations.generated_at !== bundle.receipt.completed_at
  ) {
    findings.push({ code: "generated_at_mismatch", message: "Bundle, observation-set, and receipt completion timestamps must match exactly." });
  }
  if (
    bundle.observations.contract_id !== bundle.contract.id ||
    bundle.plan.contract.id !== bundle.contract.id
  ) {
    findings.push({ code: "contract_binding_mismatch", message: "Plan or observation-set contract id does not match the bundled contract." });
  }
  if (bundle.receipt.contract.id !== bundle.contract.id || bundle.receipt.contract.digest !== createAICEvidenceDigest(bundle.contract)) {
    findings.push({ code: "contract_binding_mismatch", message: "Receipt contract binding does not match the bundled contract." });
  }
  if (bundle.receipt.plan_digest !== createAICEvidenceDigest(bundle.plan)) {
    findings.push({ code: "plan_binding_mismatch", message: "Receipt plan digest does not match the bundled plan." });
  }
  if (bundle.receipt.observations_digest !== createAICEvidenceDigest(bundle.observations)) {
    findings.push({ code: "observations_binding_mismatch", message: "Receipt observations digest does not match the bundled observations." });
  }
  if (bundle.receipt.deployment_identity_digest !== createAICEvidenceDigest(bundle.deployment_identity)) {
    findings.push({ code: "deployment_binding_mismatch", message: "Receipt deployment digest does not match the bundled identity." });
  }
  if (
    bundle.receipt.target.origin !== bundle.deployment_identity.origin ||
    bundle.receipt.target.deployment_id !== bundle.deployment_identity.deployment_id ||
    bundle.receipt.target.source_revision !== bundle.deployment_identity.source_revision ||
    bundle.receipt.target.environment !== bundle.deployment_identity.environment ||
    bundle.deployment_identity.environment !== "production"
  ) {
    findings.push({ code: "deployment_binding_mismatch", message: "Receipt target fields do not match the bundled deployment identity." });
  }
  if (bundle.receipt_digest !== createAICEvidenceDigest(bundle.receipt)) {
    findings.push({ code: "receipt_digest_mismatch", message: "Receipt digest does not match the bundled receipt." });
  }
  const artifactByRef = new Map(bundle.artifacts.map((artifact) => [artifact.ref, artifact]));
  for (const artifact of bundle.artifacts) {
    if (artifact.digest !== createAICEvidenceDigest(artifact.content)) {
      findings.push({ code: "artifact_digest_mismatch", message: `Artifact digest does not match ${artifact.ref}.` });
    }
  }
  if (bundle.receipt.evidence_manifest_digest !== createAICEvidenceDigest(evidenceManifest(bundle.artifacts))) {
    findings.push({ code: "evidence_manifest_mismatch", message: "Receipt evidence manifest digest does not match bundled artifacts." });
  }
  const plannedAdapters = [...new Set(bundle.plan.surfaces.map((surface) => surface.adapter))].sort();
  const receiptAdapters = bundle.receipt.adapters.map((adapter) => adapter.id).sort();
  const receiptAdapterById = new Map(bundle.receipt.adapters.map((adapter) => [adapter.id, adapter]));
  if (
    plannedAdapters.length !== receiptAdapters.length ||
    plannedAdapters.some((adapter, index) => adapter !== receiptAdapters[index])
  ) {
    findings.push({ code: "adapter_binding_mismatch", message: "Receipt adapter identities do not exactly match the evidence plan." });
  }
  const plannedObservations = new Map<string, {
    adapter: string;
    requirements: Set<string>;
  }>();
  for (const surface of bundle.plan.surfaces) {
    for (const scenario of surface.scenarios) {
      plannedObservations.set(`${scenario.scenario_id}\u0000${surface.surface_id}`, {
        adapter: surface.adapter,
        requirements: new Set(scenario.projection.checks.map((check) => check.requirement_id))
      });
    }
  }
  const observedKeys = new Set<string>();
  const referencedArtifacts = new Set<string>();
  for (const observation of bundle.observations.observations) {
    const observationKey = `${observation.scenario_id}\u0000${observation.surface_id}`;
    if (observedKeys.has(observationKey)) {
      findings.push({ code: "observation_coverage_mismatch", message: `Duplicate observation: ${observation.scenario_id}/${observation.surface_id}.` });
    }
    observedKeys.add(observationKey);
    const planned = plannedObservations.get(observationKey);
    if (!planned) {
      findings.push({ code: "observation_coverage_mismatch", message: `Observation is not planned: ${observation.scenario_id}/${observation.surface_id}.` });
    }
    if (
      observation.contract_id !== bundle.contract.id ||
      observation.operation_id !== bundle.contract.action.operation_id ||
      observation.mode !== "executed"
    ) {
      findings.push({ code: "observation_binding_mismatch", message: `Observation binding is invalid for ${observation.scenario_id}/${observation.surface_id}.` });
    }
    if (
      planned &&
      (
        observation.environment?.adapter !== planned.adapter ||
        observation.environment?.adapter_version !== receiptAdapterById.get(planned.adapter)?.version ||
        observation.environment?.target_origin !== bundle.deployment_identity.origin
      )
    ) {
      findings.push({ code: "adapter_binding_mismatch", message: `Observation adapter/origin binding is invalid for ${observation.scenario_id}/${observation.surface_id}.` });
    }
    if (planned) {
      const actualRequirements = new Set(observation.checks.map((check) => check.requirement_id));
      if (
        actualRequirements.size !== planned.requirements.size ||
        [...planned.requirements].some((requirement) => !actualRequirements.has(requirement))
      ) {
        findings.push({ code: "observation_binding_mismatch", message: `Observation checks do not match the plan for ${observation.scenario_id}/${observation.surface_id}.` });
      }
    }
    if (!observation.evidence?.length) {
      findings.push({ code: "artifact_reference_missing", message: `Observation has no evidence reference: ${observation.scenario_id}/${observation.surface_id}.` });
    }
    for (const evidence of observation.evidence ?? []) {
      referencedArtifacts.add(evidence.ref);
      const artifact = artifactByRef.get(evidence.ref);
      if (!artifact) {
        findings.push({ code: "artifact_reference_missing", message: `Observation evidence is missing: ${evidence.ref}.` });
      } else if (evidence.digest !== artifact.digest) {
        findings.push({ code: "artifact_digest_mismatch", message: `Observation evidence digest does not match ${evidence.ref}.` });
      } else if (evidence.kind !== artifact.kind) {
        findings.push({ code: "observation_binding_mismatch", message: `Observation evidence kind does not match ${evidence.ref}.` });
      }
    }
  }
  for (const key of plannedObservations.keys()) {
    if (!observedKeys.has(key)) {
      const [scenarioId, surfaceId] = key.split("\u0000");
      findings.push({ code: "observation_coverage_mismatch", message: `Planned observation is missing: ${scenarioId}/${surfaceId}.` });
    }
  }
  for (const artifact of bundle.artifacts) {
    if (!referencedArtifacts.has(artifact.ref)) {
      findings.push({ code: "artifact_reference_unused", message: `Bundled artifact is not referenced by an observation: ${artifact.ref}.` });
    }
  }
  if (bundle.receipt.request_count < bundle.observations.observations.length + 1) {
    findings.push({ code: "receipt_count_invalid", message: "Receipt request count is smaller than identity plus planned executions." });
  }
  return { findings, ok: findings.length === 0, ...(findings.length === 0 ? { value: bundle } : {}) };
}

export function timeoutSignal(timeoutMs: number, parent?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Evidence request exceeded ${timeoutMs}ms.`)), timeoutMs);
  timer.unref?.();
  const abort = () => controller.abort(parent?.reason);
  if (parent) {
    if (parent.aborted) abort();
    else parent.addEventListener("abort", abort, { once: true });
  }
  controller.signal.addEventListener("abort", () => {
    clearTimeout(timer);
    parent?.removeEventListener("abort", abort);
  }, { once: true });
  return controller.signal;
}
