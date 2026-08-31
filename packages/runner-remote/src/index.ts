import { createHash, createPublicKey, verify } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import {
  AICEvidenceCollectionError,
  type AICCredentialResolver,
  type AICEvidenceAdapter,
  type AICFetch,
  type AICFetchRequestInit,
  createAICEvidenceBundle,
  createAICEvidenceCanonicalJson,
  createAICEvidenceDigest,
  validateAICEvidencePlanForContract,
  verifyAICEvidenceBundle
} from "@aicorg/evidence-core";
import {
  type AICDeploymentIdentity,
  type AICEvidenceBundle,
  type AICProtectedSignature,
  type AICRemoteObservationJob,
  type AICRemoteRunnerIdentity,
  validateAICDeploymentIdentity,
  validateAICRemoteObservationJob
} from "@aicorg/spec";

export const AIC_REMOTE_RUNNER_VERSION = "0.1.0-alpha.2";
export const AIC_REMOTE_DEFAULT_MAX_RESPONSE_BYTES = 1_048_576;
export const AIC_REMOTE_DEFAULT_MAX_RUN_MS = 60_000;

export interface AICResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type AICRemoteDnsLookup = (hostname: string) => Promise<AICResolvedAddress[]>;

export type AICPinnedFetchFactory = (input: {
  addresses: readonly AICResolvedAddress[];
  maxResponseBytes: number;
  origin: string;
}) => AICFetch;

export interface AICProtectedReceiptSigner {
  sign(canonicalReceipt: string): Promise<AICProtectedSignature>;
}

export interface AICRemoteObservationRunnerInput {
  adapters: ReadonlyMap<string, AICEvidenceAdapter>;
  credentials?: AICCredentialResolver;
  dns?: AICRemoteDnsLookup;
  fetchFactory?: AICPinnedFetchFactory;
  job: unknown;
  now?: () => Date;
  operatorCapabilities?: AICRemoteOperatorCapabilities;
  runner: AICRemoteRunnerIdentity;
  signer?: AICProtectedReceiptSigner;
}

export interface AICRemoteOperatorCapabilities {
  adapter_allowlist?: string[];
  destructive_operation_ids?: string[];
  max_response_bytes?: number;
  max_run_ms?: number;
  mutations?: Array<{
    canary_scope: string;
    operation_id: string;
  }>;
  operation_allowlist?: string[];
}

export function validateAICRemoteOperatorCapabilities(
  value: unknown
): AICRemoteOperatorCapabilities {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AICEvidenceCollectionError("plan_invalid", "Operator capabilities must be an object.");
  }
  const record = value as Record<string, unknown>;
  const allowedFields = new Set([
    "adapter_allowlist",
    "destructive_operation_ids",
    "max_response_bytes",
    "max_run_ms",
    "mutations",
    "operation_allowlist"
  ]);
  for (const key of Object.keys(record)) {
    if (!allowedFields.has(key)) {
      throw new AICEvidenceCollectionError("plan_invalid", `Unknown operator capability field: ${key}.`);
    }
  }
  for (const field of ["adapter_allowlist", "destructive_operation_ids", "operation_allowlist"] as const) {
    const values = record[field];
    if (
      values !== undefined &&
      (!Array.isArray(values) ||
        !values.every((item) => typeof item === "string" && item.trim().length > 0) ||
        new Set(values).size !== values.length)
    ) {
      throw new AICEvidenceCollectionError("plan_invalid", `Operator ${field} must contain unique non-empty strings.`);
    }
  }
  for (const field of ["max_response_bytes", "max_run_ms"] as const) {
    if (
      record[field] !== undefined &&
      (!Number.isSafeInteger(record[field]) || Number(record[field]) < 1)
    ) {
      throw new AICEvidenceCollectionError("plan_invalid", `Operator ${field} must be a positive safe integer.`);
    }
  }
  const mutations = record.mutations;
  if (mutations !== undefined) {
    if (!Array.isArray(mutations)) {
      throw new AICEvidenceCollectionError("plan_invalid", "Operator mutation capabilities must be an array.");
    }
    const keys = new Set<string>();
    for (const [index, mutation] of mutations.entries()) {
      if (typeof mutation !== "object" || mutation === null || Array.isArray(mutation)) {
        throw new AICEvidenceCollectionError("plan_invalid", `Operator mutation capability ${index} must be an object.`);
      }
      const grant = mutation as Record<string, unknown>;
      if (
        Object.keys(grant).some((key) => key !== "canary_scope" && key !== "operation_id") ||
        typeof grant.operation_id !== "string" ||
        !grant.operation_id.trim() ||
        typeof grant.canary_scope !== "string" ||
        !grant.canary_scope.trim()
      ) {
        throw new AICEvidenceCollectionError("plan_invalid", `Operator mutation capability ${index} is invalid.`);
      }
      const key = `${grant.operation_id}\u0000${grant.canary_scope}`;
      if (keys.has(key)) throw new AICEvidenceCollectionError("plan_invalid", `Duplicate operator mutation capability ${index}.`);
      keys.add(key);
    }
  }
  return {
    ...(record.adapter_allowlist ? { adapter_allowlist: [...record.adapter_allowlist as string[]] } : {}),
    ...(record.destructive_operation_ids ? { destructive_operation_ids: [...record.destructive_operation_ids as string[]] } : {}),
    ...(record.max_response_bytes !== undefined ? { max_response_bytes: Number(record.max_response_bytes) } : {}),
    ...(record.max_run_ms !== undefined ? { max_run_ms: Number(record.max_run_ms) } : {}),
    ...(mutations ? { mutations: mutations as AICRemoteOperatorCapabilities["mutations"] } : {}),
    ...(record.operation_allowlist ? { operation_allowlist: [...record.operation_allowlist as string[]] } : {})
  };
}

export interface AICReceiptSignatureVerification {
  findings: Array<{
    code: "key_id_mismatch" | "public_key_invalid" | "signature_invalid" | "signature_missing";
    message: string;
  }>;
  status: "invalid" | "trusted" | "unsigned";
}

function parseIpv4(address: string): number[] | undefined {
  const parts = address.split(".");
  if (parts.length !== 4) return undefined;
  const values = parts.map(Number);
  return values.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)
    ? values
    : undefined;
}

function ipv4In(address: number[], first: number, secondMin = 0, secondMax = 255): boolean {
  return address[0] === first && address[1] >= secondMin && address[1] <= secondMax;
}

function expandIpv6(address: string): number[] | undefined {
  let normalized = address.toLowerCase().split("%")[0];
  if (normalized.includes(".")) {
    const lastColon = normalized.lastIndexOf(":");
    const ipv4 = parseIpv4(normalized.slice(lastColon + 1));
    if (!ipv4) return undefined;
    normalized = `${normalized.slice(0, lastColon)}:${((ipv4[0] << 8) | ipv4[1]).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
  }
  const halves = normalized.split("::");
  if (halves.length > 2) return undefined;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return undefined;
  const parts = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return undefined;
  return parts.map((part) => Number.parseInt(part, 16));
}

export function isAICPublicNetworkAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const value = parseIpv4(address);
    if (!value) return false;
    if (
      ipv4In(value, 0) ||
      ipv4In(value, 10) ||
      (value[0] === 100 && value[1] >= 64 && value[1] <= 127) ||
      ipv4In(value, 127) ||
      (value[0] === 169 && value[1] === 254) ||
      (value[0] === 172 && value[1] >= 16 && value[1] <= 31) ||
      (value[0] === 192 && value[1] === 0 && value[2] === 0) ||
      (value[0] === 192 && value[1] === 0 && value[2] === 2) ||
      (value[0] === 192 && value[1] === 88 && value[2] === 99) ||
      (value[0] === 192 && value[1] === 168) ||
      (value[0] === 198 && (value[1] === 18 || value[1] === 19)) ||
      (value[0] === 198 && value[1] === 51 && value[2] === 100) ||
      (value[0] === 203 && value[1] === 0 && value[2] === 113) ||
      value[0] >= 224
    ) return false;
    return true;
  }
  if (family === 6) {
    const parts = expandIpv6(address);
    if (!parts) return false;
    const first = parts[0];
    // Only globally scoped 2000::/3 space is accepted by the initial remote runner.
    if ((first & 0xe000) !== 0x2000) return false;
    // Reject documentation, Teredo, ORCHID, 6to4, NAT64, IPv4-compatible/mapped,
    // and other transition/special-use prefixes even if an OS resolver returns them.
    if (parts.slice(0, 6).every((part) => part === 0)) return false; // ::/96
    if (parts[0] === 0x0064 && parts[1] === 0xff9b) return false;
    if (parts[0] === 0x2002) return false;
    if (parts[0] === 0x2001 && parts[1] <= 0x01ff) return false;
    if (parts[0] === 0x2001 && parts[1] >= 0x0010 && parts[1] <= 0x003f) return false;
    if (parts[0] === 0x2001 && parts[1] === 0x0db8) return false;
    if (parts[0] === 0x3fff && parts[1] <= 0x0fff) return false;
    return true;
  }
  return false;
}

export function validateAICRemoteTargetOrigin(origin: string): URL {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new AICEvidenceCollectionError("target_rejected", "Remote target origin is not a valid URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.origin !== origin ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(url.hostname) !== 0
  ) {
    throw new AICEvidenceCollectionError(
      "target_rejected",
      "Remote targets require a canonical HTTPS origin on port 443 with a DNS hostname and no credentials."
    );
  }
  return url;
}

async function defaultDnsLookup(hostname: string): Promise<AICResolvedAddress[]> {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((record) => ({ address: record.address, family: record.family as 4 | 6 }));
}

export async function resolveAICRemoteTarget(input: {
  dns?: AICRemoteDnsLookup;
  origin: string;
}): Promise<{ addresses: AICResolvedAddress[]; url: URL }> {
  const url = validateAICRemoteTargetOrigin(input.origin);
  let addresses: AICResolvedAddress[];
  try {
    addresses = await (input.dns ?? defaultDnsLookup)(url.hostname);
  } catch (cause) {
    throw new AICEvidenceCollectionError("target_rejected", `Unable to resolve remote target ${url.hostname}.`, { cause });
  }
  if (
    addresses.length === 0 ||
    addresses.some(
      (address) =>
        isIP(address.address) !== address.family ||
        !isAICPublicNetworkAddress(address.address)
    )
  ) {
    throw new AICEvidenceCollectionError(
      "target_rejected",
      `Every DNS address for ${url.hostname} must be a public, non-reserved address.`
    );
  }
  return { addresses, url };
}

function defaultPinnedFetchFactory(input: {
  addresses: readonly AICResolvedAddress[];
  maxResponseBytes: number;
  origin: string;
}): AICFetch {
  let addressIndex = 0;
  return async (rawUrl, init: AICFetchRequestInit = {}) => {
    const url = new URL(rawUrl);
    if (url.origin !== input.origin || url.protocol !== "https:" || url.username || url.password) {
      throw new AICEvidenceCollectionError("target_rejected", "Pinned fetch attempted to leave the approved origin.");
    }
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      const request = httpsRequest(url, {
        headers: init.headers,
        lookup: ((hostname: string, options: { all?: boolean }, callback: (
          error: Error | null,
          address?: string | Array<{ address: string; family: 4 | 6 }>,
          family?: number
        ) => void) => {
          if (hostname !== url.hostname) {
            callback(new Error("Pinned DNS hostname mismatch."));
            return;
          }
          if (options.all) {
            callback(null, input.addresses.map(({ address, family }) => ({ address, family })));
            return;
          }
          const selected = input.addresses[addressIndex++ % input.addresses.length];
          callback(null, selected.address, selected.family);
        }) as never,
        method: init.method,
        servername: url.hostname,
        signal: init.signal
      }, (response) => {
        response.on("data", (chunk: Buffer) => {
          total += chunk.byteLength;
          if (total > input.maxResponseBytes) {
            request.destroy(new Error(`Remote response exceeded ${input.maxResponseBytes} bytes.`));
            return;
          }
          chunks.push(chunk);
        });
        response.once("error", reject);
        response.once("end", () => {
          const headers = new Headers();
          for (const [name, value] of Object.entries(response.headers)) {
            if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
            else if (value !== undefined) headers.set(name, String(value));
          }
          resolve(new Response(Buffer.concat(chunks), {
            headers,
            status: response.statusCode ?? 500,
            statusText: response.statusMessage
          }));
        });
      });
      request.once("error", reject);
      if (init.body !== undefined) request.write(init.body);
      request.end();
    });
  };
}

async function fetchDeploymentIdentity(input: {
  fetch: AICFetch;
  job: AICRemoteObservationJob;
}): Promise<AICDeploymentIdentity> {
  const url = new URL(input.job.target.identity_path, input.job.target.origin);
  if (url.origin !== input.job.target.origin) throw new AICEvidenceCollectionError("target_rejected", "Deployment identity path escapes the target origin.");
  let response: Awaited<ReturnType<AICFetch>>;
  try {
    response = await input.fetch(url, {
      headers: { accept: "application/json" },
      method: "GET",
      redirect: "manual"
    });
  } catch (cause) {
    throw new AICEvidenceCollectionError("transport_failed", "Unable to fetch the remote deployment identity.", { cause, execution: "started" });
  }
  if (response.status !== 200) throw new AICEvidenceCollectionError("deployment_mismatch", `Deployment identity returned HTTP ${response.status}.`, { execution: "started" });
  const contentType = response.headers.get("content-type") ?? "";
  if (!/(^|[+/])json(?:;|$)/i.test(contentType)) {
    throw new AICEvidenceCollectionError("deployment_mismatch", "Deployment identity must use a JSON content type.", { execution: "started" });
  }
  let value: unknown;
  try {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > input.job.policy.max_response_bytes) {
      throw new AICEvidenceCollectionError(
        "deployment_mismatch",
        `Deployment identity exceeded ${input.job.policy.max_response_bytes} bytes.`,
        { execution: "started" }
      );
    }
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch (cause) {
    if (cause instanceof AICEvidenceCollectionError) throw cause;
    throw new AICEvidenceCollectionError("deployment_mismatch", "Deployment identity is not valid JSON.", { cause, execution: "started" });
  }
  const validation = validateAICDeploymentIdentity(value);
  if (!validation.ok) throw new AICEvidenceCollectionError("deployment_mismatch", `Deployment identity is invalid: ${validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`, { execution: "started" });
  const identity = validation.value;
  if (
    identity.origin !== input.job.target.origin ||
    identity.environment !== input.job.target.environment ||
    identity.deployment_id !== input.job.target.expected_deployment_id ||
    identity.source_revision !== input.job.target.expected_source_revision
  ) {
    throw new AICEvidenceCollectionError("deployment_mismatch", "Deployment identity does not match exact job expectations.", { execution: "started" });
  }
  return identity;
}

function validateJobPolicy(
  job: AICRemoteObservationJob,
  operatorCapabilities: AICRemoteOperatorCapabilities,
  availableAdapters: ReadonlySet<string>
): { allowDestructive: boolean; allowedMutationOperations: Set<string> } {
  const planCheck = validateAICEvidencePlanForContract({ contract: job.contract, plan: job.plan });
  if (!planCheck.ok) throw new AICEvidenceCollectionError("plan_invalid", planCheck.findings.map((finding) => finding.message).join("; "));
  if (!job.policy.operation_allowlist.includes(job.contract.action.operation_id)) {
    throw new AICEvidenceCollectionError("target_rejected", `Operation ${job.contract.action.operation_id} is not allowlisted.`);
  }
  if (
    operatorCapabilities.operation_allowlist !== undefined &&
    !operatorCapabilities.operation_allowlist.includes(job.contract.action.operation_id)
  ) {
    throw new AICEvidenceCollectionError("target_rejected", `Operation ${job.contract.action.operation_id} is outside the operator allowlist.`);
  }
  const operatorMaxResponseBytes = operatorCapabilities.max_response_bytes ?? AIC_REMOTE_DEFAULT_MAX_RESPONSE_BYTES;
  const operatorMaxRunMs = operatorCapabilities.max_run_ms ?? AIC_REMOTE_DEFAULT_MAX_RUN_MS;
  if (job.policy.max_response_bytes > operatorMaxResponseBytes) {
    throw new AICEvidenceCollectionError("target_rejected", "Remote job exceeds the operator response-size capability.");
  }
  if (job.policy.max_run_ms > operatorMaxRunMs) {
    throw new AICEvidenceCollectionError("target_rejected", "Remote job exceeds the operator runtime capability.");
  }
  const operatorAdapters = new Set(operatorCapabilities.adapter_allowlist ?? availableAdapters);
  const adapters = new Set(job.plan.surfaces.map((surface) => surface.adapter));
  for (const adapter of adapters) {
    if (!job.policy.adapter_allowlist.includes(adapter)) throw new AICEvidenceCollectionError("target_rejected", `Adapter ${adapter} is not allowlisted.`);
    if (!availableAdapters.has(adapter)) throw new AICEvidenceCollectionError("plan_invalid", `Built-in adapter is unavailable: ${adapter}.`);
    if (!operatorAdapters.has(adapter)) throw new AICEvidenceCollectionError("target_rejected", `Adapter ${adapter} is outside the operator allowlist.`);
  }
  let mutates = false;
  for (const surface of job.plan.surfaces) {
    if ((surface.max_response_bytes ?? 1_048_576) > job.policy.max_response_bytes) {
      throw new AICEvidenceCollectionError("plan_invalid", `Surface ${surface.surface_id} exceeds the remote response limit.`);
    }
    if ((surface.timeout_ms ?? 10_000) > job.policy.max_run_ms) {
      throw new AICEvidenceCollectionError("plan_invalid", `Surface ${surface.surface_id} timeout exceeds the remote run limit.`);
    }
    for (const scenario of surface.scenarios) {
      if (scenario.mutates) mutates = true;
      if (surface.adapter === "@aicorg/evidence-http") {
        const httpScenario = scenario as import("@aicorg/spec").AICHttpEvidenceScenarioPlan;
        const method = httpScenario.request.method;
        if (method && !["GET", "HEAD", "OPTIONS"].includes(method)) mutates = true;
      }
    }
  }
  const requesterMutation = job.policy.allow_mutations;
  const operatorMutation = operatorCapabilities?.mutations?.find(
    (grant) =>
      grant.operation_id === job.contract.action.operation_id &&
      grant.canary_scope === requesterMutation?.canary_scope
  );
  const mutationAllowed =
    requesterMutation !== undefined &&
    requesterMutation.operation_ids.includes(job.contract.action.operation_id) &&
    operatorMutation !== undefined;
  if (mutates && !mutationAllowed) {
    throw new AICEvidenceCollectionError(
      "target_rejected",
      "Remote mutations require matching requester and operator grants for the exact operation and canary scope."
    );
  }
  const allowDestructive =
    mutationAllowed &&
    job.policy.allow_destructive === true &&
    operatorCapabilities?.destructive_operation_ids?.includes(job.contract.action.operation_id) === true;
  return {
    allowDestructive,
    allowedMutationOperations: new Set(mutationAllowed ? [job.contract.action.operation_id] : [])
  };
}

function assertRunnerIdentity(value: AICRemoteRunnerIdentity): void {
  if (
    !value.id?.trim() ||
    !value.software_name?.trim() ||
    !value.software_version?.trim() ||
    !/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(value.software_revision)
  ) {
    throw new AICEvidenceCollectionError("plan_invalid", "Remote runner identity requires names, version, and a full software revision.");
  }
}

export async function runAICRemoteObservation(
  input: AICRemoteObservationRunnerInput
): Promise<AICEvidenceBundle> {
  const validation = validateAICRemoteObservationJob(input.job);
  if (!validation.ok) {
    throw new AICEvidenceCollectionError("plan_invalid", `Remote job is invalid: ${validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }
  const job = validation.value;
  const operatorCapabilities = validateAICRemoteOperatorCapabilities(input.operatorCapabilities);
  const availableAdapters = new Set<string>();
  for (const [adapterId, adapter] of input.adapters) {
    if (adapter.id !== adapterId) {
      throw new AICEvidenceCollectionError("plan_invalid", `Adapter map identity mismatch for ${adapterId}.`);
    }
    availableAdapters.add(adapterId);
  }
  const effectiveCapabilities = validateJobPolicy(job, operatorCapabilities, availableAdapters);
  assertRunnerIdentity(input.runner);
  const startedAt = (input.now ?? (() => new Date()))();
  const resolved = await resolveAICRemoteTarget({ dns: input.dns, origin: job.target.origin });
  const fetch = (input.fetchFactory ?? defaultPinnedFetchFactory)({
    addresses: resolved.addresses,
    maxResponseBytes: job.policy.max_response_bytes,
    origin: job.target.origin
  });
  const identity = await fetchDeploymentIdentity({ fetch, job });
  const deployedAt = Date.parse(identity.deployed_at);
  if (deployedAt > startedAt.getTime()) throw new AICEvidenceCollectionError("deployment_mismatch", "Deployment identity is dated in the future.", { execution: "started" });
  if (
    job.policy.max_identity_age_seconds !== undefined &&
    startedAt.getTime() - deployedAt > job.policy.max_identity_age_seconds * 1000
  ) {
    throw new AICEvidenceCollectionError("deployment_mismatch", "Deployment identity is older than the job policy permits.", { execution: "started" });
  }
  const overallController = new AbortController();
  const overallTimer = setTimeout(
    () => overallController.abort(new Error(`Remote run exceeded ${job.policy.max_run_ms}ms.`)),
    job.policy.max_run_ms
  );
  overallTimer.unref?.();
  try {
    const adapterIds = [...new Set(job.plan.surfaces.map((surface) => surface.adapter))].sort();
    const collections = [];
    for (const adapterId of adapterIds) {
      const adapter = input.adapters.get(adapterId);
      if (!adapter || adapter.id !== adapterId) throw new AICEvidenceCollectionError("plan_invalid", `Built-in adapter is unavailable: ${adapterId}.`);
      const collection = await adapter.collect({
        allowDestructive: effectiveCapabilities.allowDestructive,
        allowedMutationOperations: effectiveCapabilities.allowedMutationOperations,
        contract: job.contract,
        credentials: input.credentials,
        fetch,
        now: input.now ?? (() => new Date()),
        plan: job.plan,
        signal: overallController.signal,
        targetOrigin: job.target.origin
      });
      if (collection.adapter.id !== adapterId) throw new AICEvidenceCollectionError("evidence_invalid", `Adapter result identity mismatch for ${adapterId}.`);
      collections.push(collection);
    }
    const completedAt = (input.now ?? (() => new Date()))();
    const bundle = await createAICEvidenceBundle({
      collections,
      completedAt: completedAt.toISOString(),
      contract: job.contract,
      deploymentIdentity: identity,
      jobId: job.id,
      plan: job.plan,
      runner: input.runner,
      ...(input.signer ? { signer: (canonicalReceipt) => input.signer!.sign(canonicalReceipt) } : {}),
      startedAt: startedAt.toISOString()
    });
    const bundleCheck = verifyAICEvidenceBundle(bundle);
    if (!bundleCheck.ok) throw new AICEvidenceCollectionError("evidence_invalid", bundleCheck.findings.map((finding) => finding.message).join("; "));
    return bundle;
  } finally {
    clearTimeout(overallTimer);
  }
}

function keyIdForPublicKey(publicKeyPem: string): string {
  const publicKey = createPublicKey(publicKeyPem);
  if (publicKey.asymmetricKeyType !== "ed25519") throw new Error("Expected an Ed25519 public key.");
  const der = publicKey.export({ format: "der", type: "spki" });
  return `sha256:${createHash("sha256").update(der).digest("hex")}`;
}

export function verifyAICRemoteReceiptSignature(input: {
  bundle: unknown;
  expectedKeyId: string;
  publicKeyPem: string;
}): AICReceiptSignatureVerification {
  const bundleCheck = verifyAICEvidenceBundle(input.bundle);
  if (!bundleCheck.ok || !bundleCheck.value) {
    return {
      findings: [{ code: "signature_invalid", message: "Evidence bundle is invalid before signature verification." }],
      status: "invalid"
    };
  }
  const signature = bundleCheck.value.receipt_signature;
  if (!signature) {
    return {
      findings: [{ code: "signature_missing", message: "Evidence receipt is unsigned; use an AIC trust attestation or an explicitly pinned runner key." }],
      status: "unsigned"
    };
  }
  let derivedKeyId: string;
  try {
    derivedKeyId = keyIdForPublicKey(input.publicKeyPem);
  } catch {
    return { findings: [{ code: "public_key_invalid", message: "Pinned runner public key is not a valid Ed25519 key." }], status: "invalid" };
  }
  if (derivedKeyId !== input.expectedKeyId || signature.key_id !== input.expectedKeyId) {
    return { findings: [{ code: "key_id_mismatch", message: "Receipt signature does not match the explicitly pinned runner key id." }], status: "invalid" };
  }
  let valid = false;
  try {
    valid = verify(
      null,
      Buffer.from(createAICEvidenceCanonicalJson(bundleCheck.value.receipt)),
      createPublicKey(input.publicKeyPem),
      Buffer.from(signature.value, "base64")
    );
  } catch {
    valid = false;
  }
  return valid
    ? { findings: [], status: "trusted" }
    : { findings: [{ code: "signature_invalid", message: "Receipt signature does not verify." }], status: "invalid" };
}

export function createAICRemoteJobDigest(job: unknown): string {
  return createAICEvidenceDigest(job);
}
