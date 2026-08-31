import {
  AICEvidenceCollectionError,
  type AICCredentialResolver,
  type AICEvidenceAdapter,
  type AICEvidenceAdapterExecutionContext,
  type AICFetch,
  createAICEvidenceArtifact,
  createAICEvidenceDigest,
  projectAICBehaviorObservation,
  timeoutSignal
} from "@aicorg/evidence-core";
import type {
  AICBehaviorContract,
  AICBehaviorObservation,
  AICEvidenceAdapterCollection,
  AICEvidenceHeaderValue,
  AICHttpEvidenceRequest,
  AICHttpEvidenceScenarioPlan,
  AICHttpEvidenceSurfacePlan,
  JsonValue
} from "@aicorg/spec";

export const AIC_HTTP_EVIDENCE_ADAPTER_ID = "@aicorg/evidence-http";
export const AIC_HTTP_EVIDENCE_ADAPTER_VERSION = "0.1.0-alpha.2";
export const AIC_OPENAPI_PROTOCOL_VERSION = "OpenAPI 3.0/3.1/3.2";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const FORBIDDEN_REQUEST_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
  "x-api-key"
]);
const RETAINED_RESPONSE_HEADERS = new Set([
  "cache-control",
  "content-type",
  "etag",
  "last-modified",
  "x-correlation-id",
  "x-request-id"
]);

export interface AICResolvedOpenAPIOperation {
  method: NonNullable<AICHttpEvidenceRequest["method"]>;
  operation: Record<string, unknown>;
  path: string;
  protocolVersion: "3.0" | "3.1" | "3.2";
}

interface NormalizedResponse {
  body: JsonValue;
  bodyDigest: string;
  headers: Record<string, string>;
  status: number;
}

interface InvocationTranscript {
  kind: "invocation" | "probe";
  name: string;
  request: {
    body_digest?: string;
    headers: Record<string, string>;
    method: string;
    url: string;
  };
  response: {
    body?: JsonValue;
    body_digest: string;
    headers: Record<string, string>;
    status: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNoExternalReferences(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoExternalReferences(item, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (key === "$ref" && (typeof item !== "string" || !item.startsWith("#/"))) {
      throw new AICEvidenceCollectionError("plan_invalid", `OpenAPI external reference is not allowed at ${path}.$ref.`);
    }
    if (key === "callbacks" || key === "webhooks") {
      throw new AICEvidenceCollectionError("plan_invalid", `OpenAPI ${key} execution is not supported.`);
    }
    assertNoExternalReferences(item, `${path}.${key}`);
  }
}

function validateOpenAPIServers(container: Record<string, unknown>, targetOrigin: string): void {
  if (container.servers === undefined) return;
  if (!Array.isArray(container.servers)) {
    throw new AICEvidenceCollectionError("plan_invalid", "OpenAPI servers must be an array.");
  }
  for (const server of container.servers) {
    if (!isRecord(server) || typeof server.url !== "string") {
      throw new AICEvidenceCollectionError("plan_invalid", "OpenAPI server entries require a URL.");
    }
    if (/[{}]/.test(server.url)) {
      throw new AICEvidenceCollectionError("plan_invalid", "OpenAPI server variables are not supported by the evidence adapter.");
    }
    let resolved: URL;
    try {
      resolved = new URL(server.url, targetOrigin);
    } catch {
      throw new AICEvidenceCollectionError("plan_invalid", "OpenAPI server URL is invalid.");
    }
    if (resolved.origin !== targetOrigin || resolved.username || resolved.password) {
      throw new AICEvidenceCollectionError("target_rejected", `OpenAPI server escapes the target origin: ${resolved.origin}.`);
    }
    if (resolved.pathname !== "/" || resolved.search || resolved.hash) {
      throw new AICEvidenceCollectionError("plan_invalid", "OpenAPI server base paths, queries, and fragments are not yet supported.");
    }
  }
}

export function resolveAICOpenAPIOperation(
  documentValue: unknown,
  operationId: string,
  targetOrigin: string
): AICResolvedOpenAPIOperation {
  if (!isRecord(documentValue)) {
    throw new AICEvidenceCollectionError("plan_invalid", "OpenAPI document must be an object.");
  }
  const version = typeof documentValue.openapi === "string" ? documentValue.openapi : "";
  const protocolVersion = version.startsWith("3.0.")
    ? "3.0"
    : version.startsWith("3.1.")
      ? "3.1"
      : version.startsWith("3.2.")
        ? "3.2"
        : undefined;
  if (!protocolVersion) {
    throw new AICEvidenceCollectionError("plan_invalid", "Only OpenAPI 3.0, 3.1, and 3.2 documents are supported.");
  }
  assertNoExternalReferences(documentValue);
  validateOpenAPIServers(documentValue, targetOrigin);
  if (!isRecord(documentValue.paths)) {
    throw new AICEvidenceCollectionError("plan_invalid", "OpenAPI document requires paths.");
  }
  const matches: AICResolvedOpenAPIOperation[] = [];
  const supportedMethods = ["delete", "get", "head", "options", "patch", "post", "put"] as const;
  for (const [path, pathItem] of Object.entries(documentValue.paths)) {
    if (!path.startsWith("/") || !isRecord(pathItem)) continue;
    for (const method of supportedMethods) {
      const operation = pathItem[method];
      if (isRecord(operation) && operation.operationId === operationId) {
        validateOpenAPIServers(pathItem, targetOrigin);
        validateOpenAPIServers(operation, targetOrigin);
        matches.push({
          method: method.toUpperCase() as AICResolvedOpenAPIOperation["method"],
          operation,
          path,
          protocolVersion
        });
      }
    }
  }
  if (matches.length !== 1) {
    throw new AICEvidenceCollectionError(
      "plan_invalid",
      matches.length === 0
        ? `OpenAPI operationId not found: ${operationId}.`
        : `OpenAPI operationId is ambiguous: ${operationId}.`
    );
  }
  return matches[0];
}

function assertOriginUrl(value: string, targetOrigin: string, field: string): URL {
  let url: URL;
  try {
    url = new URL(value, targetOrigin);
  } catch {
    throw new AICEvidenceCollectionError("plan_invalid", `${field} is not a valid URL.`);
  }
  if (url.origin !== targetOrigin || url.username || url.password) {
    throw new AICEvidenceCollectionError("target_rejected", `${field} must stay on the exact target origin.`);
  }
  return url;
}

function appendQuery(url: URL, query: AICHttpEvidenceRequest["query"]): void {
  for (const [name, raw] of Object.entries(query ?? {})) {
    url.searchParams.delete(name);
    for (const value of Array.isArray(raw) ? raw : [raw]) url.searchParams.append(name, value);
  }
}

async function resolveHeaders(
  headers: Record<string, AICEvidenceHeaderValue> | undefined,
  credentials: AICCredentialResolver | undefined
): Promise<{ headers: Record<string, string>; redacted: Record<string, string> }> {
  const resolved: Record<string, string> = {};
  const redacted: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers ?? {})) {
    const normalized = name.toLowerCase();
    if (FORBIDDEN_REQUEST_HEADERS.has(normalized)) {
      throw new AICEvidenceCollectionError("plan_invalid", `Request header is forbidden: ${name}.`);
    }
    if (typeof value === "string") {
      if (/\r|\n/.test(value)) throw new AICEvidenceCollectionError("plan_invalid", `Request header contains a line break: ${name}.`);
      resolved[name] = value;
      redacted[name] = SENSITIVE_HEADERS.has(normalized) ? "[REDACTED]" : value;
      continue;
    }
    if (!credentials) throw new AICEvidenceCollectionError("plan_invalid", `No credential resolver is available for ${value.secret_ref}.`);
    const secret = await credentials(value.secret_ref);
    if (!secret || /\r|\n/.test(secret)) throw new AICEvidenceCollectionError("plan_invalid", `Credential ${value.secret_ref} is empty or unsafe.`);
    resolved[name] = secret;
    redacted[name] = "[REDACTED]";
  }
  return { headers: resolved, redacted };
}

async function readResponse(
  response: Awaited<ReturnType<AICFetch>>,
  maxBytes: number
): Promise<NormalizedResponse> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    throw new AICEvidenceCollectionError("response_invalid", `HTTP response exceeded ${maxBytes} bytes.`, { execution: "started" });
  }
  if (response.status >= 300 && response.status < 400) {
    throw new AICEvidenceCollectionError("target_rejected", `HTTP redirect ${response.status} is not allowed.`, { execution: "started" });
  }
  const text = new TextDecoder().decode(bytes);
  const contentType = response.headers.get("content-type") ?? "";
  let body: JsonValue = null;
  if (text.trim()) {
    if (!/(^|[+/])json(?:;|$)/i.test(contentType)) {
      throw new AICEvidenceCollectionError("response_invalid", `Expected JSON response content, received ${contentType || "no content type"}.`, { execution: "started" });
    }
    try {
      body = JSON.parse(text) as JsonValue;
    } catch (cause) {
      throw new AICEvidenceCollectionError("response_invalid", "HTTP response was not valid JSON.", { cause, execution: "started" });
    }
  }
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    const normalized = name.toLowerCase();
    if (RETAINED_RESPONSE_HEADERS.has(normalized) && !SENSITIVE_HEADERS.has(normalized)) headers[normalized] = value;
  });
  return { body, bodyDigest: createAICEvidenceDigest(body), headers, status: response.status };
}

async function executeRequest(input: {
  captureResponseBody: boolean;
  context: AICEvidenceAdapterExecutionContext;
  kind: InvocationTranscript["kind"];
  maxResponseBytes: number;
  mutates: boolean;
  name: string;
  request: AICHttpEvidenceRequest;
  resolvedOperation?: AICResolvedOpenAPIOperation;
  timeoutMs: number;
}): Promise<{ response: NormalizedResponse; transcript: InvocationTranscript }> {
  const method = input.request.method ?? input.resolvedOperation?.method;
  const path = input.request.path ?? input.resolvedOperation?.path;
  if (!method || !path) {
    throw new AICEvidenceCollectionError("plan_invalid", "HTTP requests require method and path, directly or through OpenAPI.");
  }
  if (input.resolvedOperation && (method !== input.resolvedOperation.method || path !== input.resolvedOperation.path)) {
    throw new AICEvidenceCollectionError("plan_invalid", "Explicit HTTP method/path does not match the OpenAPI operation.");
  }
  if (/\{[^}]+\}/.test(path)) {
    throw new AICEvidenceCollectionError("plan_invalid", `Unresolved OpenAPI path parameter in ${path}.`);
  }
  const effectiveMutation = input.mutates || !SAFE_METHODS.has(method);
  if (input.kind === "probe" && effectiveMutation) {
    throw new AICEvidenceCollectionError("plan_invalid", "HTTP probes must use GET, HEAD, or OPTIONS.");
  }
  if (effectiveMutation && !input.context.allowedMutationOperations.has(input.context.contract.action.operation_id)) {
    throw new AICEvidenceCollectionError("target_rejected", `Mutation is not allowed for ${input.context.contract.action.operation_id}.`);
  }
  const url = assertOriginUrl(path, input.context.targetOrigin, "HTTP request path");
  appendQuery(url, input.request.query);
  const resolvedHeaders = await resolveHeaders(input.request.headers, input.context.credentials);
  const headers: Record<string, string> = { accept: "application/json", ...resolvedHeaders.headers };
  let body: string | undefined;
  if (input.request.body !== undefined) {
    body = JSON.stringify(input.request.body);
    headers["content-type"] ??= "application/json";
  }
  let response: Awaited<ReturnType<AICFetch>>;
  try {
    response = await input.context.fetch(url, {
      ...(body !== undefined ? { body } : {}),
      headers,
      method,
      redirect: "manual",
      signal: timeoutSignal(input.timeoutMs, input.context.signal)
    });
  } catch (cause) {
    throw new AICEvidenceCollectionError(
      effectiveMutation ? "outcome_uncertain" : "transport_failed",
      effectiveMutation
        ? `Mutating HTTP request outcome is uncertain for ${method} ${url.pathname}; it was not retried.`
        : `HTTP request failed for ${method} ${url.pathname}.`,
      { cause, execution: effectiveMutation ? "uncertain" : "started" }
    );
  }
  let normalized: NormalizedResponse;
  try {
    normalized = await readResponse(response, input.maxResponseBytes);
  } catch (cause) {
    if (effectiveMutation) {
      throw new AICEvidenceCollectionError(
        "outcome_uncertain",
        `Mutating HTTP response could not be verified for ${method} ${url.pathname}; the request was not retried.`,
        { cause, execution: "uncertain" }
      );
    }
    if (cause instanceof AICEvidenceCollectionError) throw cause;
    throw new AICEvidenceCollectionError(
      "transport_failed",
      `HTTP response failed for ${method} ${url.pathname}.`,
      { cause, execution: "started" }
    );
  }
  return {
    response: normalized,
    transcript: {
      kind: input.kind,
      name: input.name,
      request: {
        ...(input.request.body !== undefined ? { body_digest: createAICEvidenceDigest(input.request.body) } : {}),
        headers: { accept: "application/json", ...resolvedHeaders.redacted, ...(body !== undefined ? { "content-type": headers["content-type"] } : {}) },
        method,
        url: url.href
      },
      response: {
        ...(input.captureResponseBody ? { body: normalized.body } : {}),
        body_digest: normalized.bodyDigest,
        headers: normalized.headers,
        status: normalized.status
      }
    }
  };
}

function sourcesForResponse(
  response: NormalizedResponse,
  probes: Map<string, NormalizedResponse>
): Record<string, unknown> {
  const sources: Record<string, unknown> = {
    "response.body": response.body,
    "response.headers": response.headers,
    "response.status": response.status
  };
  for (const [id, probe] of probes) {
    sources[`probe.${id}.body`] = probe.body;
    sources[`probe.${id}.headers`] = probe.headers;
    sources[`probe.${id}.status`] = probe.status;
  }
  return sources;
}

async function runScenario(input: {
  context: AICEvidenceAdapterExecutionContext;
  operation?: AICResolvedOpenAPIOperation;
  scenario: AICHttpEvidenceScenarioPlan;
  surface: AICHttpEvidenceSurfacePlan;
}): Promise<{ artifact: ReturnType<typeof createAICEvidenceArtifact>; observation: AICBehaviorObservation; requests: number }> {
  const startedAt = input.context.now();
  const probes = new Map<string, NormalizedResponse>();
  const transcripts: InvocationTranscript[] = [];
  let requests = 0;
  const runProbes = async (phase: "after" | "before") => {
    for (const probe of input.scenario.probes?.filter((candidate) => candidate.phase === phase) ?? []) {
      const result = await executeRequest({
        captureResponseBody: input.surface.capture_response_body === true,
        context: input.context,
        kind: "probe",
        maxResponseBytes: input.surface.max_response_bytes ?? 1_048_576,
        mutates: false,
        name: probe.id,
        request: probe.request,
        timeoutMs: input.surface.timeout_ms ?? 10_000
      });
      requests += 1;
      probes.set(probe.id, result.response);
      transcripts.push(result.transcript);
    }
  };
  await runProbes("before");
  const invocation = await executeRequest({
    captureResponseBody: input.surface.capture_response_body === true,
    context: input.context,
    kind: "invocation",
    maxResponseBytes: input.surface.max_response_bytes ?? 1_048_576,
    mutates: input.scenario.mutates,
    name: input.operation ? input.operation.operation.operationId as string : input.scenario.scenario_id,
    request: input.scenario.request,
    resolvedOperation: input.operation,
    timeoutMs: input.surface.timeout_ms ?? 10_000
  });
  requests += 1;
  transcripts.push(invocation.transcript);
  await runProbes("after");
  const artifact = createAICEvidenceArtifact({
    content: {
      adapter: AIC_HTTP_EVIDENCE_ADAPTER_ID,
      scenario_id: input.scenario.scenario_id,
      surface_id: input.surface.surface_id,
      target_origin: input.context.targetOrigin,
      transcripts
    } as unknown as JsonValue,
    kind: "trace"
  });
  const completedAt = input.context.now();
  return {
    artifact,
    observation: projectAICBehaviorObservation({
      capturedAt: completedAt.toISOString(),
      contract: input.context.contract,
      durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
      environment: {
        adapter: AIC_HTTP_EVIDENCE_ADAPTER_ID,
        adapter_version: AIC_HTTP_EVIDENCE_ADAPTER_VERSION,
        protocol_version: input.operation ? `OpenAPI ${input.operation.protocolVersion}` : "HTTP",
        target_origin: input.context.targetOrigin
      },
      evidence: [{ digest: artifact.digest, kind: "trace", ref: artifact.ref }],
      projection: input.scenario.projection,
      scenarioId: input.scenario.scenario_id,
      sources: sourcesForResponse(invocation.response, probes),
      surfaceId: input.surface.surface_id
    }),
    requests
  };
}

export async function collectAICHttpEvidence(
  context: AICEvidenceAdapterExecutionContext
): Promise<AICEvidenceAdapterCollection> {
  const surfaces = context.plan.surfaces.filter(
    (surface): surface is AICHttpEvidenceSurfacePlan => surface.adapter === AIC_HTTP_EVIDENCE_ADAPTER_ID
  );
  const observations: AICBehaviorObservation[] = [];
  const artifacts = [];
  let requestCount = 0;
  const contractSurfaces = new Map(context.contract.surfaces.map((surface) => [surface.id, surface]));
  for (const surface of surfaces) {
    const contractSurface = contractSurfaces.get(surface.surface_id);
    if (!contractSurface) throw new AICEvidenceCollectionError("plan_invalid", `Unknown HTTP evidence surface: ${surface.surface_id}.`);
    const operation = surface.openapi
      ? resolveAICOpenAPIOperation(surface.openapi.document, surface.openapi.operation_id, context.targetOrigin)
      : undefined;
    if (operation && contractSurface.entrypoint !== surface.openapi?.operation_id) {
      throw new AICEvidenceCollectionError("plan_invalid", `OpenAPI operationId ${surface.openapi?.operation_id} does not match surface entrypoint ${contractSurface.entrypoint}.`);
    }
    for (const scenario of surface.scenarios) {
      const result = await runScenario({ context, operation, scenario, surface });
      observations.push(result.observation);
      artifacts.push(result.artifact);
      requestCount += result.requests;
    }
  }
  const generatedAt = context.now().toISOString();
  return {
    adapter: {
      id: AIC_HTTP_EVIDENCE_ADAPTER_ID,
      protocol_version: surfaces.some((surface) => surface.openapi) ? AIC_OPENAPI_PROTOCOL_VERSION : "HTTP",
      version: AIC_HTTP_EVIDENCE_ADAPTER_VERSION
    },
    artifacts,
    observations: {
      artifact_type: "aic_behavior_observation_set",
      contract_id: context.contract.id,
      generated_at: generatedAt,
      observations
    },
    request_count: requestCount
  };
}

export class AICHttpEvidenceAdapter implements AICEvidenceAdapter {
  readonly id = AIC_HTTP_EVIDENCE_ADAPTER_ID;
  readonly protocolVersion = AIC_OPENAPI_PROTOCOL_VERSION;
  readonly version = AIC_HTTP_EVIDENCE_ADAPTER_VERSION;

  collect(context: AICEvidenceAdapterExecutionContext): Promise<AICEvidenceAdapterCollection> {
    return collectAICHttpEvidence(context);
  }
}

export function createAICHttpEvidenceAdapter(): AICHttpEvidenceAdapter {
  return new AICHttpEvidenceAdapter();
}
