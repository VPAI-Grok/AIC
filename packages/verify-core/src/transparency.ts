/** Signed transparency verification for AIC verification consumers. */
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  type KeyObject,
  verify
} from "node:crypto";
import {
  AIC_TRANSPARENCY_SPEC,
  type AICSignedTransparencyCheckpoint,
  type AICTransparencyEntry,
  type AICTransparencyEntryKind,
  type AICTransparencyExternalReceipt,
  type AICTransparencyIndex,
  type AICTrustStore,
  isAICRfc3339DateTime,
  validateAICSignedAttestation,
  validateAICSignedKeyTransition,
  validateAICTransparencyIndex,
  validateAICTrustStore
} from "@aicorg/spec";
import { createAICCanonicalJson, createAICDigest } from "./trust.js";

const ENTRY_DOMAIN = "aic-transparency-entry-v1\0";
const CHECKPOINT_DOMAIN = "aic-transparency-checkpoint-v1\0";

export type AICTransparencyFindingCode =
  | "artifact_digest_mismatch"
  | "artifact_invalid"
  | "checkpoint_binding_mismatch"
  | "checkpoint_signature_invalid"
  | "checkpoint_signer_untrusted"
  | "entry_digest_mismatch"
  | "external_receipt_not_checked"
  | "index_invalid"
  | "log_id_mismatch"
  | "prefix_mismatch"
  | "sequence_mismatch"
  | "time_order_invalid"
  | "trust_store_invalid";

export interface AICTransparencyFinding {
  code: AICTransparencyFindingCode;
  message: string;
  sequence?: number;
  severity: "error" | "warning";
}

export interface AICTransparencyVerificationResult {
  checks: {
    artifacts: "failed" | "passed" | "not_checked";
    chain: "failed" | "passed" | "not_checked";
    checkpoint: "failed" | "passed" | "not_checked";
    external_receipts: "not_checked";
    index_schema: "failed" | "passed";
    trust_store_schema: "failed" | "passed";
  };
  findings: AICTransparencyFinding[];
  head_entry_digest?: string | null;
  size?: number;
  status: "invalid" | "trusted" | "untrusted";
}

export interface AICTransparencyConsistencyResult {
  findings: AICTransparencyFinding[];
  from_size?: number;
  status: "consistent" | "inconsistent" | "invalid";
  to_size?: number;
}

function keyIdFromKey(publicKey: KeyObject): string {
  const der = publicKey.export({ format: "der", type: "spki" });
  return `sha256:${createHash("sha256").update(der).digest("hex")}`;
}

function keyId(publicKeyPem: string): string {
  return keyIdFromKey(createPublicKey(publicKeyPem));
}

function domainBytes(domain: string, value: unknown): Buffer {
  return Buffer.from(`${domain}${createAICCanonicalJson(value)}`, "utf8");
}

function assertDate(value: string, field: string): void {
  if (!isAICRfc3339DateTime(value)) {
    throw new Error(`${field} must be an ISO date-time.`);
  }
}

function unsignedEntry(entry: Omit<AICTransparencyEntry, "entry_digest"> | AICTransparencyEntry): Omit<AICTransparencyEntry, "entry_digest"> {
  return {
    artifact: entry.artifact,
    artifact_digest: entry.artifact_digest,
    ...(entry.external_receipts ? { external_receipts: entry.external_receipts } : {}),
    kind: entry.kind,
    logged_at: entry.logged_at,
    previous_entry_digest: entry.previous_entry_digest,
    sequence: entry.sequence
  };
}

export function createAICTransparencyEntryDigest(entry: Omit<AICTransparencyEntry, "entry_digest"> | AICTransparencyEntry): string {
  return `sha256:${createHash("sha256").update(domainBytes(ENTRY_DOMAIN, unsignedEntry(entry))).digest("hex")}`;
}

export function createAICTransparencyCheckpointDigest(checkpoint: AICSignedTransparencyCheckpoint): string {
  return createAICDigest(checkpoint);
}

function signCheckpoint(input: {
  head: string | null;
  issuedAt: string;
  logId: string;
  previousCheckpointDigest?: string;
  privateKeyPem: string;
  size: number;
}): AICSignedTransparencyCheckpoint {
  const privateKey = createPrivateKey(input.privateKeyPem);
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("The transparency log key must be Ed25519.");
  const publicKeyPem = createPublicKey(privateKey).export({ format: "pem", type: "spki" }).toString();
  const statement = {
    artifact_type: "aic_transparency_checkpoint_statement" as const,
    head_entry_digest: input.head,
    issued_at: input.issuedAt,
    log_id: input.logId,
    ...(input.previousCheckpointDigest ? { previous_checkpoint_digest: input.previousCheckpointDigest } : {}),
    size: input.size,
    spec: AIC_TRANSPARENCY_SPEC
  };
  return {
    artifact_type: "aic_signed_transparency_checkpoint",
    signature: {
      algorithm: "ed25519",
      key_id: keyId(publicKeyPem),
      value: sign(null, domainBytes(CHECKPOINT_DOMAIN, statement), privateKey).toString("base64")
    },
    spec: AIC_TRANSPARENCY_SPEC,
    statement
  };
}

export function createAICTransparencyIndex(input: {
  issuedAt?: string;
  logId: string;
  privateKeyPem: string;
}): AICTransparencyIndex {
  if (!input.logId.trim()) throw new Error("logId must be a non-empty string.");
  const issuedAt = input.issuedAt ?? new Date().toISOString();
  assertDate(issuedAt, "issuedAt");
  return {
    artifact_type: "aic_transparency_index",
    checkpoint: signCheckpoint({ head: null, issuedAt, logId: input.logId, privateKeyPem: input.privateKeyPem, size: 0 }),
    entries: [],
    log_id: input.logId,
    spec: AIC_TRANSPARENCY_SPEC
  };
}

function validateArtifact(kind: AICTransparencyEntryKind, artifact: unknown): boolean {
  if (kind === "attestation") return validateAICSignedAttestation(artifact).ok;
  if (kind === "key_transition") return validateAICSignedKeyTransition(artifact).ok;
  return typeof artifact === "object" && artifact !== null && (artifact as { artifact_type?: unknown }).artifact_type === "aic_key_revocation";
}

function finding(
  findings: AICTransparencyFinding[],
  code: AICTransparencyFindingCode,
  message: string,
  severity: "error" | "warning" = "error",
  sequence?: number
): void {
  findings.push({ code, message, ...(sequence === undefined ? {} : { sequence }), severity });
}

export function verifyAICTransparencyIndex(input: {
  index: unknown;
  logTrustStore: unknown;
  verifiedAt?: string;
}): AICTransparencyVerificationResult {
  const findings: AICTransparencyFinding[] = [];
  const checks: AICTransparencyVerificationResult["checks"] = {
    artifacts: "not_checked",
    chain: "not_checked",
    checkpoint: "not_checked",
    external_receipts: "not_checked",
    index_schema: "failed",
    trust_store_schema: "failed"
  };
  const indexValidation = validateAICTransparencyIndex(input.index);
  if (!indexValidation.ok) {
    indexValidation.issues.forEach((issue) => finding(findings, "index_invalid", `${issue.path}: ${issue.message}`));
  } else checks.index_schema = "passed";
  const trustValidation = validateAICTrustStore(input.logTrustStore);
  if (!trustValidation.ok) {
    trustValidation.issues.forEach((issue) => finding(findings, "trust_store_invalid", `${issue.path}: ${issue.message}`));
  } else checks.trust_store_schema = "passed";
  if (!indexValidation.ok || !trustValidation.ok) return { checks, findings, status: "invalid" };

  const index = indexValidation.value;
  let previous: string | null = null;
  let previousTime = Number.NEGATIVE_INFINITY;
  let chainFailed = false;
  let artifactFailed = false;
  index.entries.forEach((entry, sequence) => {
    if (entry.sequence !== sequence || entry.previous_entry_digest !== previous) {
      chainFailed = true;
      finding(findings, "sequence_mismatch", `Entry ${sequence} does not extend the preceding entry.`, "error", sequence);
    }
    const expectedEntryDigest = createAICTransparencyEntryDigest(entry);
    if (entry.entry_digest !== expectedEntryDigest) {
      chainFailed = true;
      finding(findings, "entry_digest_mismatch", `Entry ${sequence} digest does not match its content.`, "error", sequence);
    }
    const loggedAt = Date.parse(entry.logged_at);
    if (loggedAt < previousTime) {
      chainFailed = true;
      finding(findings, "time_order_invalid", `Entry ${sequence} predates the preceding entry.`, "error", sequence);
    }
    previousTime = loggedAt;
    if (entry.artifact_digest !== createAICDigest(entry.artifact)) {
      artifactFailed = true;
      finding(findings, "artifact_digest_mismatch", `Entry ${sequence} artifact digest is invalid.`, "error", sequence);
    }
    if (!validateArtifact(entry.kind, entry.artifact)) {
      artifactFailed = true;
      finding(findings, "artifact_invalid", `Entry ${sequence} artifact is not valid for ${entry.kind}.`, "error", sequence);
    }
    (entry.external_receipts ?? []).forEach((receipt) => {
      if (receipt.artifact_digest !== entry.artifact_digest) {
        artifactFailed = true;
        finding(findings, "artifact_digest_mismatch", `Entry ${sequence} external receipt metadata targets a different artifact digest.`, "error", sequence);
      }
    });
    previous = entry.entry_digest;
  });
  checks.chain = chainFailed ? "failed" : "passed";
  checks.artifacts = artifactFailed ? "failed" : "passed";

  const checkpoint = index.checkpoint;
  const statement = checkpoint.statement;
  let checkpointFailed = false;
  if (statement.log_id !== index.log_id || statement.size !== index.entries.length || statement.head_entry_digest !== previous) {
    checkpointFailed = true;
    finding(findings, "checkpoint_binding_mismatch", "Checkpoint does not bind the index head, size, and log id.");
  }
  if (Date.parse(statement.issued_at) < previousTime) {
    checkpointFailed = true;
    finding(findings, "time_order_invalid", "Checkpoint predates its last entry.");
  }
  const verifiedAt = input.verifiedAt ?? new Date().toISOString();
  assertDate(verifiedAt, "verifiedAt");
  if (Date.parse(statement.issued_at) > Date.parse(verifiedAt)) {
    checkpointFailed = true;
    finding(findings, "time_order_invalid", "Checkpoint is not yet valid.");
  }
  const key = trustValidation.value.keys.find((candidate) => candidate.key_id === checkpoint.signature.key_id);
  if (!key || key.issuer_id !== index.log_id || key.status !== "active") {
    checkpointFailed = true;
    finding(findings, "checkpoint_signer_untrusted", "No active pinned log key matches the checkpoint signer and log id.");
  } else {
    let publicKey: KeyObject | undefined;
    let derived: string | undefined;
    try {
      publicKey = createPublicKey(key.public_key_pem);
      derived = keyIdFromKey(publicKey);
    } catch {
      publicKey = undefined;
      derived = undefined;
    }
    const issuedAt = Date.parse(statement.issued_at);
    const inWindow = (!key.valid_from || issuedAt >= Date.parse(key.valid_from)) && (!key.valid_until || issuedAt <= Date.parse(key.valid_until));
    if (!publicKey || publicKey.asymmetricKeyType !== "ed25519" || derived !== key.key_id || !inWindow) {
      checkpointFailed = true;
      finding(findings, "checkpoint_signer_untrusted", "Pinned Ed25519 log key material or validity window does not authorize the checkpoint.");
    } else {
      try {
        if (!verify(null, domainBytes(CHECKPOINT_DOMAIN, statement), publicKey, Buffer.from(checkpoint.signature.value, "base64"))) {
          checkpointFailed = true;
          finding(findings, "checkpoint_signature_invalid", "Checkpoint signature is invalid.");
        }
      } catch {
        checkpointFailed = true;
        finding(findings, "checkpoint_signature_invalid", "Checkpoint signature could not be verified.");
      }
    }
  }
  checks.checkpoint = checkpointFailed ? "failed" : "passed";
  index.entries.flatMap((entry) => entry.external_receipts ?? []).forEach((receipt) => finding(findings, "external_receipt_not_checked", `External ${receipt.profile} receipt from ${receipt.provider} is metadata only and was not cryptographically verified.`, "warning"));
  const errors = findings.some((item) => item.severity === "error");
  return {
    checks,
    findings,
    head_entry_digest: statement.head_entry_digest,
    size: statement.size,
    status: errors ? "untrusted" : "trusted"
  };
}

export function appendAICTransparencyEntry(input: {
  artifact: unknown;
  expectedHead: string | null;
  expectedSize: number;
  externalReceipts?: AICTransparencyExternalReceipt[];
  index: unknown;
  kind: AICTransparencyEntryKind;
  loggedAt?: string;
  logTrustStore: unknown;
  privateKeyPem: string;
}): AICTransparencyIndex {
  const loggedAt = input.loggedAt ?? new Date().toISOString();
  assertDate(loggedAt, "loggedAt");
  const verification = verifyAICTransparencyIndex({ index: input.index, logTrustStore: input.logTrustStore, verifiedAt: loggedAt });
  if (verification.status !== "trusted") throw new Error(`Current transparency index is not trusted: ${verification.findings.map((item) => item.message).join("; ")}`);
  const current = input.index as AICTransparencyIndex;
  if (current.entries.length !== input.expectedSize || current.checkpoint.statement.head_entry_digest !== input.expectedHead) throw new Error("Transparency index changed since the expected head and size were read.");
  if (!validateArtifact(input.kind, input.artifact)) throw new Error(`Artifact is not valid for ${input.kind}.`);
  const lastEntry = current.entries.at(-1);
  if (lastEntry && Date.parse(loggedAt) < Date.parse(lastEntry.logged_at)) throw new Error("loggedAt cannot precede the current transparency head.");
  const body: Omit<AICTransparencyEntry, "entry_digest"> = {
    artifact: input.artifact as AICTransparencyEntry["artifact"],
    artifact_digest: createAICDigest(input.artifact),
    ...(input.externalReceipts && input.externalReceipts.length > 0 ? { external_receipts: structuredClone(input.externalReceipts) } : {}),
    kind: input.kind,
    logged_at: loggedAt,
    previous_entry_digest: input.expectedHead,
    sequence: input.expectedSize
  };
  const entry: AICTransparencyEntry = { ...body, entry_digest: createAICTransparencyEntryDigest(body) };
  const checkpoint = signCheckpoint({
    head: entry.entry_digest,
    issuedAt: loggedAt,
    logId: current.log_id,
    previousCheckpointDigest: createAICTransparencyCheckpointDigest(current.checkpoint),
    privateKeyPem: input.privateKeyPem,
    size: current.entries.length + 1
  });
  const next = { ...current, checkpoint, entries: [...current.entries, entry] };
  const nextVerification = verifyAICTransparencyIndex({ index: next, logTrustStore: input.logTrustStore, verifiedAt: loggedAt });
  if (nextVerification.status !== "trusted") throw new Error(`Appended transparency index is not trusted: ${nextVerification.findings.map((item) => item.message).join("; ")}`);
  return next;
}

export function verifyAICTransparencyConsistency(input: {
  from: unknown;
  logTrustStore: unknown;
  to: unknown;
  verifiedAt?: string;
}): AICTransparencyConsistencyResult {
  const findings: AICTransparencyFinding[] = [];
  const fromValidation = validateAICTransparencyIndex(input.from);
  const toValidation = validateAICTransparencyIndex(input.to);
  if (!fromValidation.ok || !toValidation.ok) {
    [...fromValidation.issues, ...toValidation.issues].forEach((issue) => finding(findings, "index_invalid", `${issue.path}: ${issue.message}`));
    return { findings, status: "invalid" };
  }
  const from = fromValidation.value;
  const to = toValidation.value;
  const fromTrust = verifyAICTransparencyIndex({ index: from, logTrustStore: input.logTrustStore, verifiedAt: input.verifiedAt });
  const toTrust = verifyAICTransparencyIndex({ index: to, logTrustStore: input.logTrustStore, verifiedAt: input.verifiedAt });
  if (fromTrust.status !== "trusted" || toTrust.status !== "trusted") {
    [...fromTrust.findings, ...toTrust.findings].filter((item) => item.severity === "error").forEach((item) => finding(findings, item.code, item.message));
    return { findings, from_size: from.entries.length, status: "invalid", to_size: to.entries.length };
  }
  if (from.log_id !== to.log_id || from.entries.length > to.entries.length) finding(findings, "log_id_mismatch", "Indices do not describe a monotonic history for the same log.");
  else for (let index = 0; index < from.entries.length; index += 1) {
    if (createAICCanonicalJson(from.entries[index]) !== createAICCanonicalJson(to.entries[index])) {
      finding(findings, "prefix_mismatch", `Entry ${index} differs between histories.`, "error", index);
      break;
    }
  }
  if (
    Date.parse(to.checkpoint.statement.issued_at) <
    Date.parse(from.checkpoint.statement.issued_at)
  ) {
    finding(
      findings,
      "time_order_invalid",
      "Current checkpoint predates the consumer-pinned prior checkpoint."
    );
  }
  if (to.entries.length === from.entries.length + 1 && to.checkpoint.statement.previous_checkpoint_digest !== createAICTransparencyCheckpointDigest(from.checkpoint)) {
    finding(findings, "checkpoint_binding_mismatch", "Direct successor checkpoint does not bind the prior checkpoint.");
  }
  return {
    findings,
    from_size: from.entries.length,
    status: findings.some((item) => item.severity === "error") ? "inconsistent" : "consistent",
    to_size: to.entries.length
  };
}
