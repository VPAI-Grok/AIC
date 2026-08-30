import {
  AIC_RELIANCE_RECORD_SPEC,
  AIC_RELIANCE_SNAPSHOT_SPEC,
  isAICRfc3339DateTime,
  parseAICStrictJson,
  validateAICRelianceDecision,
  validateAICRelianceRecord as validateSpecRelianceRecord,
  validateAICRelianceSnapshot as validateSpecRelianceSnapshot,
  type AICRelianceArtifactLocator,
  type AICRelianceArtifactDigests,
  type AICRelianceDecision,
  type AICRelianceRecord,
  type AICRelianceRecordBinding,
  type AICRelianceSnapshot,
  type AICRelianceVerdict
} from "@aicorg/spec";
import { createAICDigest } from "@aicorg/verify-core";

export {
  AIC_RELIANCE_RECORD_SPEC,
  AIC_RELIANCE_SNAPSHOT_SPEC
} from "@aicorg/spec";
export type {
  AICRelianceArtifactLocator,
  AICRelianceDecision,
  AICRelianceRecord,
  AICRelianceSnapshot,
  AICRelianceVerdict
} from "@aicorg/spec";

export const AIC_RELIANCE_SERVER_SPEC = "aic.reliance-server/0.1" as const;

export type AICJsonPrimitive = boolean | null | number | string;
export type AICJsonValue = AICJsonPrimitive | AICJsonValue[] | { [key: string]: AICJsonValue };

export type AICRelianceBinding = AICRelianceRecordBinding;

export interface AICRelianceQuery {
  deployment_id?: string;
  operation_id: string;
  origin: string;
  source_revision?: string;
}

export interface AICRelianceStore {
  exportSnapshot(): AICRelianceSnapshot | Promise<AICRelianceSnapshot>;
  query(query: AICRelianceQuery): AICRelianceRecord[] | Promise<AICRelianceRecord[]>;
}

export interface EvaluateAICRelianceInput {
  attestation: unknown;
  contract: unknown;
  disposition?: {
    on_failed?: "confirm" | "deny";
    on_indeterminate?: "confirm" | "deny" | "indeterminate";
    on_passed?: "allow" | "confirm";
  };
  environment: "production" | "staging" | "test" | "development";
  evaluated_at?: string;
  expected_deployment_id: string;
  expected_revision: string;
  observations: unknown;
  operation_id: string;
  origin: string;
  policy: unknown;
  proof: unknown;
  transparency?: {
    index: unknown;
    prior_index?: unknown;
    trust_store: unknown;
  };
  trust_store: unknown;
}

export type AICRelianceEvaluationRequest = EvaluateAICRelianceInput;

export type AICRelianceEvaluator = (
  input: EvaluateAICRelianceInput,
  context?: { signal: AbortSignal }
) => AICRelianceDecision | Promise<AICRelianceDecision>;

export interface AICRelianceCorsOptions {
  allowed_origins: "*" | readonly string[];
}

export interface AICRelianceHandlerOptions {
  /** Bounds asynchronous evaluator settlement; it cannot preempt synchronous CPU work. */
  async_evaluator_timeout_ms?: number;
  cache_control?: string;
  clock?: () => Date | string;
  cors?: false | AICRelianceCorsOptions;
  evaluator?: AICRelianceEvaluator;
  max_decision_age_seconds?: number;
  max_json_depth?: number;
  max_json_nodes?: number;
  max_request_bytes?: number;
  rely_rate_limit?: (request: Request) => boolean | Promise<boolean>;
  store: AICRelianceStore;
}

type JsonObject = { [key: string]: AICJsonValue };

const DEFAULT_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";
const DEFAULT_MAX_REQUEST_BYTES = 1_048_576;
const DEFAULT_ASYNC_EVALUATOR_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_JSON_DEPTH = 64;
const DEFAULT_MAX_JSON_NODES = 50_000;
const DEFAULT_MAX_DECISION_AGE_SECONDS = 60;
const MAX_HISTORY_LIMIT = 100;
const SOURCE_REVISION_PATTERN = /^[0-9a-f]{40}([0-9a-f]{24})?$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function trustedNow(clock: AICRelianceHandlerOptions["clock"]): string {
  const value = clock?.() ?? new Date();
  const date = value instanceof Date
    ? value
    : isAICRfc3339DateTime(value)
      ? new Date(Date.parse(value))
      : new Date(Number.NaN);
  if (Number.isNaN(date.getTime())) throw new TypeError("clock must return a valid time.");
  return date.toISOString();
}

async function runEvaluator(
  evaluator: AICRelianceEvaluator,
  input: EvaluateAICRelianceInput,
  timeoutMs: number
): Promise<AICRelianceDecision> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(evaluator(input, { signal: controller.signal })),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error("AIC_RELIANCE_EVALUATOR_TIMEOUT"));
          controller.abort();
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function decisionIsCurrent(
  decision: AICRelianceDecision,
  now: string,
  maximumAgeSeconds: number
): boolean {
  const age = (Date.parse(now) - Date.parse(decision.evaluated_at)) / 1000;
  if (age < 0 || age > maximumAgeSeconds) return false;
  if (
    decision.verdict === "allow" &&
    (decision.valid_until === undefined ||
      Date.parse(now) >= Date.parse(decision.valid_until))
  ) {
    return false;
  }
  const expiry = decision.evidence_freshness.attestation_expires_at;
  return expiry === undefined || Date.parse(expiry) > Date.parse(now);
}

function isJsonValue(value: unknown, seen = new Set<object>()): value is AICJsonValue {
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
    return (
      descriptor.enumerable === true &&
      "value" in descriptor &&
      isJsonValue(descriptor.value, seen)
    );
  });
  seen.delete(value);
  return valid;
}

function cloneJson<T extends AICJsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function canonicalOrigin(value: unknown): string | undefined {
  if (!isNonEmptyString(value)) return undefined;
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username !== "" ||
      url.password !== "" ||
      url.origin !== value
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

function validateBinding(value: unknown, path = "binding"): AICRelianceBinding {
  if (!isObject(value)) throw new TypeError(`${path} must be an object.`);
  const allowed = new Set(["deployment_id", "operation_id", "origin", "source_revision"]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${path}.${key} is not supported.`);
  }
  const origin = canonicalOrigin(value.origin);
  if (!origin) throw new TypeError(`${path}.origin must be a canonical HTTP(S) origin.`);
  if (!isNonEmptyString(value.operation_id)) {
    throw new TypeError(`${path}.operation_id must be a non-empty string.`);
  }
  if (!isNonEmptyString(value.deployment_id)) {
    throw new TypeError(`${path}.deployment_id must be a non-empty string.`);
  }
  if (typeof value.source_revision !== "string" || !SOURCE_REVISION_PATTERN.test(value.source_revision)) {
    throw new TypeError(`${path}.source_revision must be a full lowercase source revision.`);
  }
  return {
    deployment_id: value.deployment_id,
    operation_id: value.operation_id,
    origin,
    source_revision: value.source_revision
  };
}

export function validateAICRelianceRecord(value: unknown): AICRelianceRecord {
  if (!isJsonValue(value)) {
    throw new TypeError("record must contain only finite, plain JSON data.");
  }
  const validation = validateSpecRelianceRecord(value, { createDigest: createAICDigest });
  if (!validation.ok) {
    throw new TypeError(
      `record is invalid: ${validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`
    );
  }
  return cloneJson(validation.value as unknown as AICJsonValue) as unknown as AICRelianceRecord;
}

function sortRecords(records: AICRelianceRecord[]): AICRelianceRecord[] {
  return records.sort((left, right) => {
    const byTime = Date.parse(right.indexed_at) - Date.parse(left.indexed_at);
    return byTime === 0 ? left.id.localeCompare(right.id) : byTime;
  });
}

function validateSnapshot(value: unknown): AICRelianceSnapshot {
  if (!isJsonValue(value)) {
    throw new TypeError("snapshot must contain only finite, plain JSON data.");
  }
  const validation = validateSpecRelianceSnapshot(value, { createDigest: createAICDigest });
  if (!validation.ok) {
    throw new TypeError(
      `snapshot is invalid: ${validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`
    );
  }
  const snapshot = cloneJson(validation.value as unknown as AICJsonValue) as unknown as AICRelianceSnapshot;
  return { ...snapshot, records: sortRecords(snapshot.records) };
}

export function createMemoryRelianceStore(snapshotValue: unknown): AICRelianceStore {
  const snapshot = validateSnapshot(snapshotValue);
  return {
    exportSnapshot() {
      return cloneJson(snapshot as AICRelianceSnapshot & AICJsonValue);
    },
    query(query) {
      const records = snapshot.records.filter((record) => {
        return (
          record.binding.origin === query.origin &&
          record.binding.operation_id === query.operation_id &&
          (query.deployment_id === undefined || record.binding.deployment_id === query.deployment_id) &&
          (query.source_revision === undefined ||
            record.binding.source_revision === query.source_revision)
        );
      });
      return cloneJson(records as AICRelianceRecord[] & AICJsonValue);
    }
  };
}

function errorBody(code: string, message: string): JsonObject {
  return {
    artifact_type: "aic_reliance_error",
    code,
    message,
    spec: AIC_RELIANCE_SERVER_SPEC
  };
}

function corsOrigin(request: Request, cors: AICRelianceHandlerOptions["cors"]): string | undefined {
  if (!cors) return undefined;
  if (cors.allowed_origins === "*") return "*";
  const origin = request.headers.get("origin");
  return origin && cors.allowed_origins.includes(origin) ? origin : undefined;
}

function jsonResponse(
  request: Request,
  options: AICRelianceHandlerOptions,
  status: number,
  body: JsonObject,
  cacheControl: string
): Response {
  const headers = new Headers({
    "cache-control": cacheControl,
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff"
  });
  const allowedOrigin = corsOrigin(request, options.cors);
  if (allowedOrigin) {
    headers.set("access-control-allow-origin", allowedOrigin);
    if (allowedOrigin !== "*") headers.set("vary", "origin");
  }
  return new Response(`${JSON.stringify(body)}\n`, { headers, status });
}

function noStoreError(
  request: Request,
  options: AICRelianceHandlerOptions,
  status: number,
  code: string,
  message: string
): Response {
  return jsonResponse(request, options, status, errorBody(code, message), "no-store");
}

function parseLookupBinding(url: URL): AICRelianceBinding | string {
  const candidate = {
    deployment_id: url.searchParams.get("deployment_id"),
    operation_id: url.searchParams.get("operation_id"),
    origin: url.searchParams.get("origin"),
    source_revision: url.searchParams.get("revision")
  };
  try {
    return validateBinding(candidate, "query");
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid exact binding query.";
  }
}

function parseHistoryQuery(url: URL): AICRelianceQuery | string {
  const origin = canonicalOrigin(url.searchParams.get("origin"));
  const operationId = url.searchParams.get("operation_id");
  const deploymentId = url.searchParams.get("deployment_id") ?? undefined;
  const revision = url.searchParams.get("revision") ?? undefined;
  if (!origin) return "query.origin must be a canonical HTTP(S) origin.";
  if (!isNonEmptyString(operationId)) return "query.operation_id must be a non-empty string.";
  if (deploymentId !== undefined && !isNonEmptyString(deploymentId)) {
    return "query.deployment_id must be a non-empty string when supplied.";
  }
  if (revision !== undefined && !SOURCE_REVISION_PATTERN.test(revision)) {
    return "query.revision must be a full lowercase source revision when supplied.";
  }
  return {
    deployment_id: deploymentId,
    operation_id: operationId,
    origin,
    source_revision: revision
  };
}

function pagination(url: URL): { limit: number; offset: number } | string {
  const rawLimit = url.searchParams.get("limit") ?? "20";
  const rawOffset = url.searchParams.get("offset") ?? "0";
  if (!/^\d+$/.test(rawLimit) || !/^\d+$/.test(rawOffset)) {
    return "limit and offset must be non-negative integers.";
  }
  const limit = Number(rawLimit);
  const offset = Number(rawOffset);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_HISTORY_LIMIT) {
    return `limit must be between 1 and ${MAX_HISTORY_LIMIT}.`;
  }
  if (!Number.isSafeInteger(offset) || offset < 0) return "offset must be a non-negative integer.";
  return { limit, offset };
}

type JsonRequestResult =
  | { ok: true; value: AICJsonValue }
  | { error: string; ok: false };

async function readJsonRequest(
  request: Request,
  maxBytes: number,
  maxDepth: number,
  maxNodes: number
): Promise<JsonRequestResult> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json" && !contentType?.endsWith("+json")) {
    return {
      error: "Content-Type must be application/json or an application/*+json media type.",
      ok: false
    };
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
    return { error: `Request body exceeds the ${maxBytes} byte limit.`, ok: false };
  }
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("AIC request body limit exceeded").catch(() => undefined);
        return { error: `Request body exceeds the ${maxBytes} byte limit.`, ok: false };
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed: unknown = parseAICStrictJson(text, { maxDepth, maxNodes });
    return isJsonValue(parsed)
      ? { ok: true, value: parsed }
      : { error: "Request body must be finite, acyclic JSON data.", ok: false };
  } catch {
    return { error: "Request body must contain valid JSON.", ok: false };
  }
}

function validateEvaluationRequest(value: AICJsonValue): EvaluateAICRelianceInput | string {
  if (!isObject(value)) return "Evaluation request must be a JSON object.";
  const allowed = new Set([
    "attestation",
    "contract",
    "disposition",
    "environment",
    "expected_deployment_id",
    "expected_revision",
    "observations",
    "operation_id",
    "origin",
    "policy",
    "proof",
    "transparency",
    "trust_store"
  ]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) return `request.${key} is not supported.`;
  }
  for (const field of [
    "attestation",
    "contract",
    "observations",
    "policy",
    "proof",
    "trust_store"
  ] as const) {
    if (value[field] === undefined) return `request.${field} is required.`;
  }
  if (![
    "production",
    "staging",
    "test",
    "development"
  ].includes(String(value.environment))) {
    return "request.environment is required and must be supported.";
  }
  const bindingCandidate = {
    deployment_id: value.expected_deployment_id,
    operation_id: value.operation_id,
    origin: value.origin,
    source_revision: value.expected_revision
  };
  try {
    validateBinding(bindingCandidate, "request");
  } catch (error) {
    return error instanceof Error ? error.message : "Evaluation request has an invalid binding.";
  }
  if (value.disposition !== undefined) {
    if (!isObject(value.disposition)) {
      return "request.disposition must be an object.";
    }
    const allowedDispositionFields = new Set([
      "on_failed",
      "on_indeterminate",
      "on_passed"
    ]);
    for (const key of Object.keys(value.disposition)) {
      if (!allowedDispositionFields.has(key)) {
        return `request.disposition.${key} is not supported.`;
      }
    }
    if (
      value.disposition.on_failed !== undefined &&
      !["confirm", "deny"].includes(String(value.disposition.on_failed))
    ) {
      return "request.disposition.on_failed must be confirm or deny.";
    }
    if (
      value.disposition.on_indeterminate !== undefined &&
      !["confirm", "deny", "indeterminate"].includes(
        String(value.disposition.on_indeterminate)
      )
    ) {
      return "request.disposition.on_indeterminate must be confirm, deny, or indeterminate.";
    }
    if (
      value.disposition.on_passed !== undefined &&
      !["allow", "confirm"].includes(String(value.disposition.on_passed))
    ) {
      return "request.disposition.on_passed must be allow or confirm.";
    }
  }
  return cloneJson(value as AICJsonValue) as unknown as EvaluateAICRelianceInput;
}

function isDecision(value: unknown): value is AICRelianceDecision {
  return isJsonValue(value) && validateAICRelianceDecision(value).ok;
}

interface ExpectedEvaluationEnvelope {
  artifact_digests: AICRelianceArtifactDigests;
  disposition?: EvaluateAICRelianceInput["disposition"];
  evaluated_at: string;
  request: {
    environment: EvaluateAICRelianceInput["environment"];
    expected_deployment_id: string;
    expected_revision: string;
    operation_id: string;
    origin: string;
  };
}

function createExpectedEvaluationEnvelope(
  request: EvaluateAICRelianceInput
): ExpectedEvaluationEnvelope {
  const transparency = isObject(request.transparency)
    ? request.transparency
    : undefined;
  return {
    artifact_digests: {
      attestation: createAICDigest(request.attestation),
      contract: createAICDigest(request.contract),
      observations: createAICDigest(request.observations),
      policy: createAICDigest(request.policy),
      proof: createAICDigest(request.proof),
      ...(transparency?.index === undefined
        ? {}
        : { transparency_index: createAICDigest(transparency.index) }),
      ...(transparency?.prior_index === undefined
        ? {}
        : {
            transparency_prior_index: createAICDigest(
              transparency.prior_index
            )
          }),
      ...(transparency?.trust_store === undefined
        ? {}
        : {
            transparency_trust_store: createAICDigest(
              transparency.trust_store
            )
          }),
      trust_store: createAICDigest(request.trust_store)
    },
    ...(request.disposition === undefined
      ? {}
      : { disposition: cloneJson(request.disposition as unknown as AICJsonValue) as EvaluateAICRelianceInput["disposition"] }),
    evaluated_at: request.evaluated_at!,
    request: {
      environment: request.environment,
      expected_deployment_id: request.expected_deployment_id,
      expected_revision: request.expected_revision,
      operation_id: request.operation_id,
      origin: request.origin
    }
  };
}

function decisionMatchesExpectedEnvelope(
  decision: AICRelianceDecision,
  expected: ExpectedEvaluationEnvelope
): boolean {
  if (
    decision.evaluated_at !== expected.evaluated_at ||
    decision.request.origin !== expected.request.origin ||
    decision.request.operation_id !== expected.request.operation_id ||
    decision.request.expected_deployment_id !== expected.request.expected_deployment_id ||
    decision.request.expected_revision !== expected.request.expected_revision ||
    decision.request.environment !== expected.request.environment
  ) {
    return false;
  }

  const expectedDigests = Object.entries(expected.artifact_digests);
  if (Object.keys(decision.artifact_digests).length !== expectedDigests.length) {
    return false;
  }
  for (const [name, digest] of expectedDigests) {
    if (decision.artifact_digests[name as keyof AICRelianceArtifactDigests] !== digest) {
      return false;
    }
  }
  if (
    decision.verdict === "allow" &&
    expected.disposition?.on_passed === "confirm"
  ) {
    return false;
  }
  return true;
}

type BoundEvaluationResult =
  | { decision: AICRelianceDecision; ok: true }
  | {
      ok: false;
      reason:
        | "local_verifier_binding_mismatch"
        | "local_verifier_invalid_result";
    };

async function runBoundEvaluator(
  evaluator: AICRelianceEvaluator,
  untrustedInput: EvaluateAICRelianceInput,
  evaluatedAt: string,
  timeoutMs: number
): Promise<BoundEvaluationResult> {
  const expectedInput: EvaluateAICRelianceInput = {
    ...untrustedInput,
    evaluated_at: evaluatedAt
  };
  const expectedEnvelope = createExpectedEvaluationEnvelope(expectedInput);
  const evaluatorInput = cloneJson(
    expectedInput as unknown as AICJsonValue
  ) as unknown as EvaluateAICRelianceInput;
  const decision = await runEvaluator(evaluator, evaluatorInput, timeoutMs);
  if (!isDecision(decision)) {
    return { ok: false, reason: "local_verifier_invalid_result" };
  }
  if (!decisionMatchesExpectedEnvelope(decision, expectedEnvelope)) {
    return { ok: false, reason: "local_verifier_binding_mismatch" };
  }
  return { decision, ok: true };
}

function bindingFromEvaluation(request: EvaluateAICRelianceInput): AICRelianceBinding {
  return {
    deployment_id: request.expected_deployment_id,
    operation_id: request.operation_id,
    origin: request.origin,
    source_revision: request.expected_revision
  };
}

function indeterminateResolution(
  binding: AICRelianceBinding,
  discovery: JsonObject,
  reasonCode: string,
  status: "not_performed" | "verification_error"
): JsonObject {
  return {
    artifact_type: "aic_reliance_resolution",
    binding: binding as unknown as AICJsonValue,
    discovery,
    evaluation: {
      reason_codes: [reasonCode],
      status
    },
    mode: status === "not_performed" ? "discovery_only" : "local_verification",
    spec: AIC_RELIANCE_SERVER_SPEC,
    verdict: "indeterminate"
  };
}

export function createAICRelianceHandler(
  options: AICRelianceHandlerOptions
): (request: Request) => Promise<Response> {
  if (!options || typeof options !== "object" || !options.store) {
    throw new TypeError("A reliance store is required.");
  }
  const maxRequestBytes = options.max_request_bytes ?? DEFAULT_MAX_REQUEST_BYTES;
  if (!Number.isSafeInteger(maxRequestBytes) || maxRequestBytes < 1) {
    throw new TypeError("max_request_bytes must be a positive safe integer.");
  }
  const evaluatorTimeoutMs =
    options.async_evaluator_timeout_ms ?? DEFAULT_ASYNC_EVALUATOR_TIMEOUT_MS;
  if (!Number.isSafeInteger(evaluatorTimeoutMs) || evaluatorTimeoutMs < 1) {
    throw new TypeError("async_evaluator_timeout_ms must be a positive safe integer.");
  }
  const maxJsonDepth = options.max_json_depth ?? DEFAULT_MAX_JSON_DEPTH;
  if (!Number.isSafeInteger(maxJsonDepth) || maxJsonDepth < 1) {
    throw new TypeError("max_json_depth must be a positive safe integer.");
  }
  const maxJsonNodes = options.max_json_nodes ?? DEFAULT_MAX_JSON_NODES;
  if (!Number.isSafeInteger(maxJsonNodes) || maxJsonNodes < 1) {
    throw new TypeError("max_json_nodes must be a positive safe integer.");
  }
  const maxDecisionAgeSeconds =
    options.max_decision_age_seconds ?? DEFAULT_MAX_DECISION_AGE_SECONDS;
  if (!Number.isFinite(maxDecisionAgeSeconds) || maxDecisionAgeSeconds < 0) {
    throw new TypeError("max_decision_age_seconds must be a non-negative finite number.");
  }
  if (options.evaluator && !options.rely_rate_limit) {
    throw new TypeError(
      "rely_rate_limit is required when the reliance evaluator endpoint is enabled."
    );
  }
  const cacheControl = options.cache_control ?? DEFAULT_CACHE_CONTROL;

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    try {

    if (request.method === "OPTIONS") {
      const headers = new Headers({
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "cache-control": "no-store"
      });
      const allowedOrigin = corsOrigin(request, options.cors);
      if (!allowedOrigin) {
        return noStoreError(request, options, 403, "cors_origin_denied", "Origin is not allowed.");
      }
      headers.set("access-control-allow-origin", allowedOrigin);
      if (allowedOrigin !== "*") headers.set("vary", "origin");
      return new Response(null, { headers, status: 204 });
    }

    if (url.pathname === "/healthz") {
      if (request.method !== "GET") {
        return noStoreError(request, options, 405, "method_not_allowed", "Only GET is supported.");
      }
      const snapshot = await options.store.exportSnapshot();
      return jsonResponse(
        request,
        options,
        200,
        {
          artifact_type: "aic_reliance_health",
          mode: options.evaluator ? "local_verification" : "discovery_only",
          read_only: true,
          records: snapshot.records.length,
          spec: AIC_RELIANCE_SERVER_SPEC,
          status: "ok"
        },
        "no-store"
      );
    }

    if (url.pathname === "/v1/snapshot") {
      if (request.method !== "GET") {
        return noStoreError(request, options, 405, "method_not_allowed", "Only GET is supported.");
      }
      const snapshot = await options.store.exportSnapshot();
      return jsonResponse(
        request,
        options,
        200,
        snapshot as unknown as JsonObject,
        cacheControl
      );
    }

    if (url.pathname === "/v1/assurance") {
      if (request.method !== "GET") {
        return noStoreError(request, options, 405, "method_not_allowed", "Only GET is supported.");
      }
      const binding = parseLookupBinding(url);
      if (typeof binding === "string") {
        return noStoreError(request, options, 400, "invalid_binding", binding);
      }
      const records = sortRecords(
        await options.store.query({
          deployment_id: binding.deployment_id,
          operation_id: binding.operation_id,
          origin: binding.origin,
          source_revision: binding.source_revision
        })
      );
      if (records.length === 0) {
        return noStoreError(
          request,
          options,
          404,
          "assurance_not_found",
          "No assurance record matches the exact binding."
        );
      }
      return jsonResponse(
        request,
        options,
        200,
        {
          artifact_type: "aic_reliance_lookup",
          binding: binding as unknown as AICJsonValue,
          record: records[0] as unknown as AICJsonValue,
          records_found: records.length,
          spec: AIC_RELIANCE_SERVER_SPEC,
          trust_status: "unverified_discovery"
        },
        cacheControl
      );
    }

    if (url.pathname === "/v1/assurance/history") {
      if (request.method !== "GET") {
        return noStoreError(request, options, 405, "method_not_allowed", "Only GET is supported.");
      }
      const query = parseHistoryQuery(url);
      if (typeof query === "string") {
        return noStoreError(request, options, 400, "invalid_query", query);
      }
      const page = pagination(url);
      if (typeof page === "string") {
        return noStoreError(request, options, 400, "invalid_pagination", page);
      }
      const allRecords = sortRecords(await options.store.query(query));
      const records = allRecords.slice(page.offset, page.offset + page.limit);
      return jsonResponse(
        request,
        options,
        200,
        {
          artifact_type: "aic_reliance_history",
          limit: page.limit,
          next_offset:
            page.offset + records.length < allRecords.length ? page.offset + records.length : null,
          offset: page.offset,
          query: query as unknown as AICJsonValue,
          records: records as unknown as AICJsonValue,
          spec: AIC_RELIANCE_SERVER_SPEC,
          total: allRecords.length,
          trust_status: "unverified_discovery"
        },
        cacheControl
      );
    }

    if (url.pathname === "/v1/rely") {
      if (request.method !== "POST") {
        return noStoreError(request, options, 405, "method_not_allowed", "Only POST is supported.");
      }
      if (options.evaluator && !(await options.rely_rate_limit?.(request))) {
        return noStoreError(
          request,
          options,
          429,
          "rate_limit_exceeded",
          "The local reliance verifier rate limit was exceeded."
        );
      }
      const parsed = await readJsonRequest(
        request,
        maxRequestBytes,
        maxJsonDepth,
        maxJsonNodes
      );
      if (!parsed.ok) {
        const tooLarge = parsed.error.includes("exceeds");
        return noStoreError(
          request,
          options,
          tooLarge ? 413 : 400,
          tooLarge ? "request_too_large" : "invalid_json",
          parsed.error
        );
      }
      const evaluationRequest = validateEvaluationRequest(parsed.value);
      if (typeof evaluationRequest === "string") {
        return noStoreError(request, options, 400, "invalid_evaluation_request", evaluationRequest);
      }
      const binding = bindingFromEvaluation(evaluationRequest);
      const discovered = sortRecords(
        await options.store.query({
          deployment_id: binding.deployment_id,
          operation_id: binding.operation_id,
          origin: binding.origin,
          source_revision: binding.source_revision
        })
      );
      const discovery: JsonObject = {
        records: discovered as unknown as AICJsonValue,
        status: discovered.length > 0 ? "found" : "not_found",
        trust_status: "unverified_discovery"
      };
      if (!options.evaluator) {
        return jsonResponse(
          request,
          options,
          200,
          indeterminateResolution(binding, discovery, "local_verifier_unavailable", "not_performed"),
          "no-store"
        );
      }

      try {
        const untrustedInput = cloneJson(
          evaluationRequest as unknown as AICJsonValue
        ) as unknown as EvaluateAICRelianceInput;
        let evaluationTime = trustedNow(options.clock);
        let evaluation = await runBoundEvaluator(
          options.evaluator,
          untrustedInput,
          evaluationTime,
          evaluatorTimeoutMs
        );
        if (!evaluation.ok) {
          return jsonResponse(
            request,
            options,
            200,
            indeterminateResolution(
              binding,
              discovery,
              evaluation.reason,
              "verification_error"
            ),
            "no-store"
          );
        }

        const timeAfterEvaluation = trustedNow(options.clock);
        if (timeAfterEvaluation !== evaluationTime) {
          evaluationTime = timeAfterEvaluation;
          evaluation = await runBoundEvaluator(
            options.evaluator,
            untrustedInput,
            evaluationTime,
            evaluatorTimeoutMs
          );
          if (!evaluation.ok) {
            return jsonResponse(
              request,
              options,
              200,
              indeterminateResolution(
                binding,
                discovery,
                evaluation.reason,
                "verification_error"
              ),
              "no-store"
            );
          }
        }

        const decision = evaluation.decision;
        if (!decisionIsCurrent(decision, trustedNow(options.clock), maxDecisionAgeSeconds)) {
          return jsonResponse(
            request,
            options,
            200,
            indeterminateResolution(
              binding,
              discovery,
              "local_verifier_stale_result",
              "verification_error"
            ),
            "no-store"
          );
        }
        return jsonResponse(
          request,
          options,
          200,
          {
            artifact_type: "aic_reliance_resolution",
            binding: binding as unknown as AICJsonValue,
            discovery,
            evaluation: cloneJson(decision as unknown as AICJsonValue),
            mode: "local_verification",
            spec: AIC_RELIANCE_SERVER_SPEC,
            verdict: decision.verdict
          },
          "no-store"
        );
      } catch (error) {
        return jsonResponse(
          request,
          options,
          200,
          indeterminateResolution(
            binding,
            discovery,
            error instanceof Error && error.message === "AIC_RELIANCE_EVALUATOR_TIMEOUT"
              ? "local_verifier_timeout"
              : "local_verifier_error",
            "verification_error"
          ),
          "no-store"
        );
      }
    }

      return noStoreError(request, options, 404, "route_not_found", "Route not found.");
    } catch {
      return noStoreError(
        request,
        options,
        503,
        "resolver_unavailable",
        "The resolver could not complete the local request."
      );
    }
  };
}
