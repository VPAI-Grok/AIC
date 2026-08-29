import type { AICValidationIssue, JsonValue, ValidationResult } from "./types.js";
import type { AICTrustSignature } from "./trust.js";

export const AIC_TRANSPARENCY_SPEC = "aic.transparency/0.1";

export interface AICTransparencyExternalReceipt {
  artifact_digest: string;
  profile: string;
  provider: string;
  reference: string;
}

export type AICTransparencyEntryKind = "attestation" | "key_transition" | "key_revocation";

export interface AICTransparencyEntry {
  artifact: JsonValue;
  artifact_digest: string;
  entry_digest: string;
  external_receipts?: AICTransparencyExternalReceipt[];
  kind: AICTransparencyEntryKind;
  logged_at: string;
  previous_entry_digest: string | null;
  sequence: number;
}

export interface AICTransparencyCheckpointStatement {
  artifact_type: "aic_transparency_checkpoint_statement";
  head_entry_digest: string | null;
  issued_at: string;
  log_id: string;
  previous_checkpoint_digest?: string;
  size: number;
  spec: string;
}

export interface AICSignedTransparencyCheckpoint {
  artifact_type: "aic_signed_transparency_checkpoint";
  signature: AICTrustSignature;
  spec: string;
  statement: AICTransparencyCheckpointStatement;
}

export interface AICTransparencyIndex {
  artifact_type: "aic_transparency_index";
  checkpoint: AICSignedTransparencyCheckpoint;
  entries: AICTransparencyEntry[];
  log_id: string;
  spec: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function isDate(value: unknown): value is string {
  return isString(value) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isJson(value: unknown): value is JsonValue {
  if (value === null || ["string", "boolean"].includes(typeof value)) return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  return isRecord(value) && Object.values(value).every(isJson);
}

function add(issues: AICValidationIssue[], path: string, message: string, rule: string): void {
  issues.push({ message, path, rule, severity: "error" });
}

function allowed(value: Record<string, unknown>, keys: string[], path: string, issues: AICValidationIssue[]): void {
  const set = new Set(keys);
  Object.keys(value).forEach((key) => {
    if (!set.has(key)) add(issues, `${path}.${key}`, `Unknown field: ${key}`, "transparency.unknown_field");
  });
}

function validateSignature(value: unknown, path: string, issues: AICValidationIssue[]): void {
  if (!isRecord(value)) {
    add(issues, path, "Expected an object", "transparency.signature");
    return;
  }
  allowed(value, ["algorithm", "key_id", "value"], path, issues);
  if (value.algorithm !== "ed25519") add(issues, `${path}.algorithm`, "Expected ed25519", "transparency.algorithm");
  if (!isDigest(value.key_id)) add(issues, `${path}.key_id`, "Expected a SHA-256 key id", "transparency.key_id");
  if (!isString(value.value) || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.value)) add(issues, `${path}.value`, "Expected a base64 signature", "transparency.signature_value");
}

function validateCheckpoint(value: unknown, path: string, issues: AICValidationIssue[]): void {
  if (!isRecord(value)) {
    add(issues, path, "Expected an object", "transparency.checkpoint");
    return;
  }
  allowed(value, ["artifact_type", "signature", "spec", "statement"], path, issues);
  if (value.artifact_type !== "aic_signed_transparency_checkpoint") add(issues, `${path}.artifact_type`, "Expected aic_signed_transparency_checkpoint", "transparency.checkpoint_type");
  if (value.spec !== AIC_TRANSPARENCY_SPEC) add(issues, `${path}.spec`, `Expected ${AIC_TRANSPARENCY_SPEC}`, "transparency.spec");
  validateSignature(value.signature, `${path}.signature`, issues);
  if (!isRecord(value.statement)) {
    add(issues, `${path}.statement`, "Expected an object", "transparency.checkpoint_statement");
    return;
  }
  const statement = value.statement;
  allowed(statement, ["artifact_type", "head_entry_digest", "issued_at", "log_id", "previous_checkpoint_digest", "size", "spec"], `${path}.statement`, issues);
  if (statement.artifact_type !== "aic_transparency_checkpoint_statement") add(issues, `${path}.statement.artifact_type`, "Expected aic_transparency_checkpoint_statement", "transparency.statement_type");
  if (statement.spec !== AIC_TRANSPARENCY_SPEC) add(issues, `${path}.statement.spec`, `Expected ${AIC_TRANSPARENCY_SPEC}`, "transparency.spec");
  if (!isString(statement.log_id)) add(issues, `${path}.statement.log_id`, "Expected a non-empty string", "transparency.log_id");
  if (!Number.isSafeInteger(statement.size) || Number(statement.size) < 0) add(issues, `${path}.statement.size`, "Expected a non-negative safe integer", "transparency.size");
  if (!isDate(statement.issued_at)) add(issues, `${path}.statement.issued_at`, "Expected an ISO date-time", "transparency.issued_at");
  if (statement.head_entry_digest !== null && !isDigest(statement.head_entry_digest)) add(issues, `${path}.statement.head_entry_digest`, "Expected null or a SHA-256 digest", "transparency.head");
  if (statement.previous_checkpoint_digest !== undefined && !isDigest(statement.previous_checkpoint_digest)) add(issues, `${path}.statement.previous_checkpoint_digest`, "Expected a SHA-256 digest", "transparency.previous_checkpoint");
}

export function validateAICSignedTransparencyCheckpoint(value: unknown): ValidationResult<AICSignedTransparencyCheckpoint> {
  const issues: AICValidationIssue[] = [];
  validateCheckpoint(value, "$", issues);
  return issues.length > 0 ? { issues, ok: false } : { issues, ok: true, value: value as AICSignedTransparencyCheckpoint };
}

export function validateAICTransparencyIndex(value: unknown): ValidationResult<AICTransparencyIndex> {
  const issues: AICValidationIssue[] = [];
  if (!isRecord(value)) return { issues: [{ message: "Expected an object", path: "$", rule: "transparency.object", severity: "fatal" }], ok: false };
  allowed(value, ["artifact_type", "checkpoint", "entries", "log_id", "spec"], "$", issues);
  if (value.artifact_type !== "aic_transparency_index") add(issues, "$.artifact_type", "Expected aic_transparency_index", "transparency.artifact_type");
  if (value.spec !== AIC_TRANSPARENCY_SPEC) add(issues, "$.spec", `Expected ${AIC_TRANSPARENCY_SPEC}`, "transparency.spec");
  if (!isString(value.log_id)) add(issues, "$.log_id", "Expected a non-empty string", "transparency.log_id");
  if (!Array.isArray(value.entries)) add(issues, "$.entries", "Expected an array", "transparency.entries");
  for (const [index, entryValue] of (Array.isArray(value.entries) ? value.entries : []).entries()) {
    const path = `$.entries[${index}]`;
    if (!isRecord(entryValue)) {
      add(issues, path, "Expected an object", "transparency.entry");
      continue;
    }
    allowed(entryValue, ["artifact", "artifact_digest", "entry_digest", "external_receipts", "kind", "logged_at", "previous_entry_digest", "sequence"], path, issues);
    if (!Number.isSafeInteger(entryValue.sequence) || entryValue.sequence !== index) add(issues, `${path}.sequence`, `Expected contiguous sequence ${index}`, "transparency.sequence");
    if (!["attestation", "key_transition", "key_revocation"].includes(String(entryValue.kind))) add(issues, `${path}.kind`, "Expected a supported entry kind", "transparency.kind");
    if (!isDate(entryValue.logged_at)) add(issues, `${path}.logged_at`, "Expected an ISO date-time", "transparency.logged_at");
    if (!isDigest(entryValue.artifact_digest)) add(issues, `${path}.artifact_digest`, "Expected a SHA-256 digest", "transparency.artifact_digest");
    if (!isDigest(entryValue.entry_digest)) add(issues, `${path}.entry_digest`, "Expected a SHA-256 digest", "transparency.entry_digest");
    if (entryValue.previous_entry_digest !== null && !isDigest(entryValue.previous_entry_digest)) add(issues, `${path}.previous_entry_digest`, "Expected null or a SHA-256 digest", "transparency.previous_entry");
    if (!isJson(entryValue.artifact)) add(issues, `${path}.artifact`, "Expected a JSON value", "transparency.artifact");
    if (entryValue.external_receipts !== undefined) {
      if (!Array.isArray(entryValue.external_receipts)) add(issues, `${path}.external_receipts`, "Expected an array", "transparency.receipts");
      else {
        if (entryValue.external_receipts.length === 0) add(issues, `${path}.external_receipts`, "Expected at least one external receipt", "transparency.receipts_empty");
        entryValue.external_receipts.forEach((receipt, receiptIndex) => {
          const receiptPath = `${path}.external_receipts[${receiptIndex}]`;
          if (!isRecord(receipt)) return add(issues, receiptPath, "Expected an object", "transparency.receipt");
          allowed(receipt, ["artifact_digest", "profile", "provider", "reference"], receiptPath, issues);
          for (const field of ["profile", "provider", "reference"]) if (!isString(receipt[field])) add(issues, `${receiptPath}.${field}`, "Expected a non-empty string", "transparency.receipt_field");
          if (!isDigest(receipt.artifact_digest)) add(issues, `${receiptPath}.artifact_digest`, "Expected a SHA-256 digest", "transparency.receipt_digest");
        });
      }
    }
  }
  validateCheckpoint(value.checkpoint, "$.checkpoint", issues);
  if (isRecord(value.checkpoint) && isRecord(value.checkpoint.statement)) {
    const statement = value.checkpoint.statement;
    const entries = Array.isArray(value.entries) ? value.entries : [];
    if (statement.log_id !== value.log_id) add(issues, "$.checkpoint.statement.log_id", "Checkpoint log id does not match index", "transparency.log_binding");
    if (statement.size !== entries.length) add(issues, "$.checkpoint.statement.size", "Checkpoint size does not match entries", "transparency.size_binding");
    const expectedHead = entries.length > 0 && isRecord(entries[entries.length - 1]) ? entries[entries.length - 1].entry_digest : null;
    if (statement.head_entry_digest !== expectedHead) add(issues, "$.checkpoint.statement.head_entry_digest", "Checkpoint head does not match entries", "transparency.head_binding");
  }
  return issues.length > 0 ? { issues, ok: false } : { issues, ok: true, value: value as unknown as AICTransparencyIndex };
}
