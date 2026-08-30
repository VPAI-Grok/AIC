import type {
  AICValidationIssue,
  AICValidationSeverity,
  ValidationResult
} from "./types.js";
import { isAICRfc3339DateTime as isIsoDateTime } from "./date-time.js";

export const AIC_TRUST_SPEC = "aic.trust/0.1";
export const AIC_TRUST_PAYLOAD_TYPE = "application/vnd.aic.trust-statement+json";

export const AIC_TRUST_ENVIRONMENTS = [
  "production",
  "staging",
  "test",
  "development"
] as const;
export const AIC_TRUST_ISSUER_KINDS = [
  "github_actions",
  "ci",
  "developer",
  "organization",
  "other"
] as const;
export const AIC_TRUST_RUNNER_KINDS = [
  "github_actions",
  "ci",
  "local",
  "remote"
] as const;

export type AICTrustEnvironment = (typeof AIC_TRUST_ENVIRONMENTS)[number];
export type AICTrustIssuerKind = (typeof AIC_TRUST_ISSUER_KINDS)[number];
export type AICTrustRunnerKind = (typeof AIC_TRUST_RUNNER_KINDS)[number];

export interface AICTrustIssuer {
  id: string;
  kind: AICTrustIssuerKind;
}

export interface AICTrustRunner {
  commit_sha?: string;
  id: string;
  kind: AICTrustRunnerKind;
  repository?: string;
  run_id?: string;
  workflow?: string;
}

export interface AICTrustDeployment {
  artifact_digest?: string;
  deployed_at?: string;
  deployment_id: string;
  environment: AICTrustEnvironment;
  origin: string;
  source_repository?: string;
  source_revision: string;
}

export interface AICTrustSubject {
  contract_digest: string;
  contract_id: string;
  evidence_level: "executed" | "imported" | "mixed" | "none";
  generated_at: string;
  operation_id: string;
  proof_digest: string;
  proof_status: "passed";
}

export interface AICTrustReferences {
  contract?: string;
  observations?: string;
  proof?: string;
}

export interface AICTrustStatement {
  artifact_type: "aic_trust_statement";
  deployment: AICTrustDeployment;
  expires_at?: string;
  issued_at: string;
  issuer: AICTrustIssuer;
  references?: AICTrustReferences;
  runner: AICTrustRunner;
  spec: string;
  subject: AICTrustSubject;
}

export interface AICTrustSignature {
  algorithm: "ed25519";
  key_id: string;
  value: string;
}

export interface AICSignedAttestation {
  artifact_type: "aic_signed_attestation";
  payload_type: string;
  signature: AICTrustSignature;
  spec: string;
  statement: AICTrustStatement;
}

export interface AICTrustStoreKey {
  allowed_origins?: string[];
  issuer_id: string;
  key_id: string;
  public_key_pem: string;
  status: "active" | "revoked";
  valid_from?: string;
  valid_until?: string;
}

export interface AICTrustStore {
  artifact_type: "aic_trust_store";
  keys: AICTrustStoreKey[];
  spec: string;
  updated_at: string;
}

export interface AICTrustRegistryEntry {
  attestation: AICSignedAttestation;
  attestation_digest: string;
  deployment_id: string;
  environment: AICTrustEnvironment;
  id: string;
  operation_id: string;
  origin: string;
}

export interface AICTrustRegistry {
  artifact_type: "aic_trust_registry";
  entries: AICTrustRegistryEntry[];
  id: string;
  spec: string;
  updated_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function isSourceRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}([0-9a-f]{24})?$/.test(value);
}

function isCanonicalOrigin(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
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

function isReference(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  if (value.startsWith("./") || value.startsWith("../") || value.startsWith("/")) return true;
  try {
    return ["https:", "http:", "urn:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function pushIssue(
  issues: AICValidationIssue[],
  severity: AICValidationSeverity,
  path: string,
  message: string,
  rule: string
): void {
  issues.push({ message, path, rule, severity });
}

function createResult<T>(value: T, issues: AICValidationIssue[]): ValidationResult<T> {
  const blocked = issues.some((issue) => issue.severity === "error" || issue.severity === "fatal");
  return blocked ? { issues, ok: false } : { issues, ok: true, value };
}

function validateAllowedKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: AICValidationIssue[],
  rule: string
): void {
  const allowedKeys = new Set(allowed);
  Object.keys(value).forEach((key) => {
    if (!allowedKeys.has(key)) {
      pushIssue(issues, "error", `${path}.${key}`, `Unknown field: ${key}`, rule);
    }
  });
}

function validateStringField(
  value: Record<string, unknown>,
  field: string,
  path: string,
  issues: AICValidationIssue[],
  rule: string
): void {
  if (!isNonEmptyString(value[field])) {
    pushIssue(issues, "error", `${path}.${field}`, "Expected a non-empty string", rule);
  }
}

function validateTrustStatementValue(
  value: unknown,
  path: string,
  issues: AICValidationIssue[]
): void {
  if (!isRecord(value)) {
    pushIssue(issues, "fatal", path, "Expected an object", "trust_statement.object");
    return;
  }

  validateAllowedKeys(
    value,
    ["artifact_type", "deployment", "expires_at", "issued_at", "issuer", "references", "runner", "spec", "subject"],
    path,
    issues,
    "trust_statement.unknown_field"
  );
  if (value.artifact_type !== "aic_trust_statement") {
    pushIssue(issues, "error", `${path}.artifact_type`, "Expected aic_trust_statement", "trust_statement.artifact_type");
  }
  if (value.spec !== AIC_TRUST_SPEC) {
    pushIssue(issues, "error", `${path}.spec`, `Expected ${AIC_TRUST_SPEC}`, "trust_statement.spec");
  }
  if (!isIsoDateTime(value.issued_at)) {
    pushIssue(issues, "error", `${path}.issued_at`, "Expected an ISO date-time", "trust_statement.issued_at");
  }
  if (value.expires_at !== undefined && !isIsoDateTime(value.expires_at)) {
    pushIssue(issues, "error", `${path}.expires_at`, "Expected an ISO date-time", "trust_statement.expires_at");
  }
  if (isIsoDateTime(value.issued_at) && isIsoDateTime(value.expires_at) && Date.parse(value.expires_at) <= Date.parse(value.issued_at)) {
    pushIssue(issues, "error", `${path}.expires_at`, "expires_at must be after issued_at", "trust_statement.expiry_order");
  }

  if (!isRecord(value.issuer)) {
    pushIssue(issues, "error", `${path}.issuer`, "Expected an object", "trust_statement.issuer");
  } else {
    validateAllowedKeys(value.issuer, ["id", "kind"], `${path}.issuer`, issues, "trust_statement.issuer_unknown_field");
    validateStringField(value.issuer, "id", `${path}.issuer`, issues, "trust_statement.issuer_id");
    if (typeof value.issuer.kind !== "string" || !(AIC_TRUST_ISSUER_KINDS as readonly string[]).includes(value.issuer.kind)) {
      pushIssue(issues, "error", `${path}.issuer.kind`, "Expected a supported issuer kind", "trust_statement.issuer_kind");
    }
  }

  if (!isRecord(value.runner)) {
    pushIssue(issues, "error", `${path}.runner`, "Expected an object", "trust_statement.runner");
  } else {
    const runner = value.runner;
    validateAllowedKeys(runner, ["commit_sha", "id", "kind", "repository", "run_id", "workflow"], `${path}.runner`, issues, "trust_statement.runner_unknown_field");
    validateStringField(runner, "id", `${path}.runner`, issues, "trust_statement.runner_id");
    if (typeof runner.kind !== "string" || !(AIC_TRUST_RUNNER_KINDS as readonly string[]).includes(runner.kind)) {
      pushIssue(issues, "error", `${path}.runner.kind`, "Expected a supported runner kind", "trust_statement.runner_kind");
    }
    ["repository", "workflow", "run_id"].forEach((field) => {
      if (runner[field] !== undefined && !isNonEmptyString(runner[field])) {
        pushIssue(issues, "error", `${path}.runner.${field}`, "Expected a non-empty string", `trust_statement.runner_${field}`);
      }
    });
    if (runner.commit_sha !== undefined && !isSourceRevision(runner.commit_sha)) {
      pushIssue(issues, "error", `${path}.runner.commit_sha`, "Expected a full 40- or 64-character lowercase hexadecimal revision", "trust_statement.runner_commit_sha");
    }
  }

  if (!isRecord(value.deployment)) {
    pushIssue(issues, "error", `${path}.deployment`, "Expected an object", "trust_statement.deployment");
  } else {
    validateAllowedKeys(value.deployment, ["artifact_digest", "deployed_at", "deployment_id", "environment", "origin", "source_repository", "source_revision"], `${path}.deployment`, issues, "trust_statement.deployment_unknown_field");
    validateStringField(value.deployment, "deployment_id", `${path}.deployment`, issues, "trust_statement.deployment_id");
    if (!isCanonicalOrigin(value.deployment.origin)) {
      pushIssue(issues, "error", `${path}.deployment.origin`, "Expected a canonical HTTP(S) origin without a path or trailing slash", "trust_statement.origin");
    }
    if (typeof value.deployment.environment !== "string" || !(AIC_TRUST_ENVIRONMENTS as readonly string[]).includes(value.deployment.environment)) {
      pushIssue(issues, "error", `${path}.deployment.environment`, "Expected a supported environment", "trust_statement.environment");
    }
    if (!isSourceRevision(value.deployment.source_revision)) {
      pushIssue(issues, "error", `${path}.deployment.source_revision`, "Expected a full 40- or 64-character lowercase hexadecimal revision", "trust_statement.source_revision");
    }
    if (value.deployment.artifact_digest !== undefined && !isSha256Digest(value.deployment.artifact_digest)) {
      pushIssue(issues, "error", `${path}.deployment.artifact_digest`, "Expected sha256:<64 lowercase hex characters>", "trust_statement.artifact_digest");
    }
    if (value.deployment.deployed_at !== undefined && !isIsoDateTime(value.deployment.deployed_at)) {
      pushIssue(issues, "error", `${path}.deployment.deployed_at`, "Expected an ISO date-time", "trust_statement.deployed_at");
    }
    if (value.deployment.source_repository !== undefined && !isNonEmptyString(value.deployment.source_repository)) {
      pushIssue(issues, "error", `${path}.deployment.source_repository`, "Expected a non-empty string", "trust_statement.source_repository");
    }
    if (
      isIsoDateTime(value.issued_at) &&
      isIsoDateTime(value.deployment.deployed_at) &&
      Date.parse(value.deployment.deployed_at) > Date.parse(value.issued_at)
    ) {
      pushIssue(issues, "error", `${path}.deployment.deployed_at`, "deployed_at cannot be after issued_at", "trust_statement.deployment_time_order");
    }
  }

  if (!isRecord(value.subject)) {
    pushIssue(issues, "error", `${path}.subject`, "Expected an object", "trust_statement.subject");
  } else {
    const subject = value.subject;
    validateAllowedKeys(subject, ["contract_digest", "contract_id", "evidence_level", "generated_at", "operation_id", "proof_digest", "proof_status"], `${path}.subject`, issues, "trust_statement.subject_unknown_field");
    ["contract_id", "operation_id"].forEach((field) => validateStringField(subject, field, `${path}.subject`, issues, `trust_statement.${field}`));
    ["contract_digest", "proof_digest"].forEach((field) => {
      if (!isSha256Digest(subject[field])) {
        pushIssue(issues, "error", `${path}.subject.${field}`, "Expected sha256:<64 lowercase hex characters>", `trust_statement.${field}`);
      }
    });
    if (!isIsoDateTime(value.subject.generated_at)) {
      pushIssue(issues, "error", `${path}.subject.generated_at`, "Expected an ISO date-time", "trust_statement.subject_generated_at");
    }
    if (!["executed", "imported", "mixed", "none"].includes(String(value.subject.evidence_level))) {
      pushIssue(issues, "error", `${path}.subject.evidence_level`, "Expected a supported evidence level", "trust_statement.evidence_level");
    }
    if (value.subject.proof_status !== "passed") {
      pushIssue(issues, "error", `${path}.subject.proof_status`, "Only passed proofs can be attested", "trust_statement.proof_status");
    }
    if (
      isIsoDateTime(value.issued_at) &&
      isIsoDateTime(value.subject.generated_at) &&
      Date.parse(value.subject.generated_at) > Date.parse(value.issued_at)
    ) {
      pushIssue(issues, "error", `${path}.subject.generated_at`, "Proof generation cannot be after issued_at", "trust_statement.proof_time_order");
    }
  }

  if (value.references !== undefined) {
    if (!isRecord(value.references)) {
      pushIssue(issues, "error", `${path}.references`, "Expected an object", "trust_statement.references");
    } else {
      validateAllowedKeys(value.references, ["contract", "observations", "proof"], `${path}.references`, issues, "trust_statement.references_unknown_field");
      Object.entries(value.references).forEach(([field, reference]) => {
        if (!isReference(reference)) {
          pushIssue(issues, "error", `${path}.references.${field}`, "Expected an HTTP(S), URN, absolute, or relative reference", "trust_statement.reference");
        }
      });
    }
  }
}

export function validateAICTrustStatement(value: unknown): ValidationResult<AICTrustStatement> {
  const issues: AICValidationIssue[] = [];
  validateTrustStatementValue(value, "$", issues);
  return createResult(value as AICTrustStatement, issues);
}

export function validateAICSignedAttestation(value: unknown): ValidationResult<AICSignedAttestation> {
  const issues: AICValidationIssue[] = [];
  if (!isRecord(value)) {
    pushIssue(issues, "fatal", "$", "Expected an object", "signed_attestation.object");
    return { issues, ok: false };
  }
  validateAllowedKeys(value, ["artifact_type", "payload_type", "signature", "spec", "statement"], "$", issues, "signed_attestation.unknown_field");
  if (value.artifact_type !== "aic_signed_attestation") {
    pushIssue(issues, "error", "$.artifact_type", "Expected aic_signed_attestation", "signed_attestation.artifact_type");
  }
  if (value.spec !== AIC_TRUST_SPEC) {
    pushIssue(issues, "error", "$.spec", `Expected ${AIC_TRUST_SPEC}`, "signed_attestation.spec");
  }
  if (value.payload_type !== AIC_TRUST_PAYLOAD_TYPE) {
    pushIssue(issues, "error", "$.payload_type", `Expected ${AIC_TRUST_PAYLOAD_TYPE}`, "signed_attestation.payload_type");
  }
  validateTrustStatementValue(value.statement, "$.statement", issues);
  if (!isRecord(value.signature)) {
    pushIssue(issues, "error", "$.signature", "Expected an object", "signed_attestation.signature");
  } else {
    validateAllowedKeys(value.signature, ["algorithm", "key_id", "value"], "$.signature", issues, "signed_attestation.signature_unknown_field");
    if (value.signature.algorithm !== "ed25519") {
      pushIssue(issues, "error", "$.signature.algorithm", "Expected ed25519", "signed_attestation.algorithm");
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(String(value.signature.key_id))) {
      pushIssue(issues, "error", "$.signature.key_id", "Expected a sha256-derived key id", "signed_attestation.key_id");
    }
    if (!isNonEmptyString(value.signature.value) || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.signature.value)) {
      pushIssue(issues, "error", "$.signature.value", "Expected a base64 signature", "signed_attestation.signature_value");
    }
  }
  return createResult(value as unknown as AICSignedAttestation, issues);
}

export function validateAICTrustStore(value: unknown): ValidationResult<AICTrustStore> {
  const issues: AICValidationIssue[] = [];
  if (!isRecord(value)) {
    pushIssue(issues, "fatal", "$", "Expected an object", "trust_store.object");
    return { issues, ok: false };
  }
  validateAllowedKeys(value, ["artifact_type", "keys", "spec", "updated_at"], "$", issues, "trust_store.unknown_field");
  if (value.artifact_type !== "aic_trust_store") {
    pushIssue(issues, "error", "$.artifact_type", "Expected aic_trust_store", "trust_store.artifact_type");
  }
  if (value.spec !== AIC_TRUST_SPEC) {
    pushIssue(issues, "error", "$.spec", `Expected ${AIC_TRUST_SPEC}`, "trust_store.spec");
  }
  if (!isIsoDateTime(value.updated_at)) {
    pushIssue(issues, "error", "$.updated_at", "Expected an ISO date-time", "trust_store.updated_at");
  }
  if (!Array.isArray(value.keys) || value.keys.length === 0) {
    pushIssue(issues, "error", "$.keys", "Expected at least one trusted key", "trust_store.keys");
  }
  const keyIds = new Set<string>();
  for (const [index, keyValue] of (Array.isArray(value.keys) ? value.keys : []).entries()) {
    const path = `$.keys[${index}]`;
    if (!isRecord(keyValue)) {
      pushIssue(issues, "error", path, "Expected an object", "trust_store.key");
      continue;
    }
    validateAllowedKeys(keyValue, ["allowed_origins", "issuer_id", "key_id", "public_key_pem", "status", "valid_from", "valid_until"], path, issues, "trust_store.key_unknown_field");
    validateStringField(keyValue, "issuer_id", path, issues, "trust_store.issuer_id");
    if (!/^sha256:[0-9a-f]{64}$/.test(String(keyValue.key_id))) {
      pushIssue(issues, "error", `${path}.key_id`, "Expected a sha256-derived key id", "trust_store.key_id");
    } else if (keyIds.has(keyValue.key_id as string)) {
      pushIssue(issues, "error", `${path}.key_id`, `Duplicate key id: ${keyValue.key_id}`, "trust_store.key_unique");
    } else {
      keyIds.add(keyValue.key_id as string);
    }
    if (!isNonEmptyString(keyValue.public_key_pem) || !keyValue.public_key_pem.includes("BEGIN PUBLIC KEY")) {
      pushIssue(issues, "error", `${path}.public_key_pem`, "Expected a PEM encoded public key", "trust_store.public_key_pem");
    }
    if (keyValue.status !== "active" && keyValue.status !== "revoked") {
      pushIssue(issues, "error", `${path}.status`, "Expected active or revoked", "trust_store.status");
    }
    if (keyValue.allowed_origins !== undefined) {
      if (!Array.isArray(keyValue.allowed_origins) || keyValue.allowed_origins.length === 0) {
        pushIssue(issues, "error", `${path}.allowed_origins`, "Expected at least one canonical origin", "trust_store.allowed_origins");
      } else {
        const origins = new Set<string>();
        keyValue.allowed_origins.forEach((origin, originIndex) => {
          if (!isCanonicalOrigin(origin)) {
            pushIssue(issues, "error", `${path}.allowed_origins[${originIndex}]`, "Expected a canonical HTTP(S) origin", "trust_store.allowed_origin");
          } else if (origins.has(origin)) {
            pushIssue(issues, "error", `${path}.allowed_origins[${originIndex}]`, `Duplicate origin: ${origin}`, "trust_store.allowed_origin_unique");
          } else {
            origins.add(origin);
          }
        });
      }
    }
    ["valid_from", "valid_until"].forEach((field) => {
      if (keyValue[field] !== undefined && !isIsoDateTime(keyValue[field])) {
        pushIssue(issues, "error", `${path}.${field}`, "Expected an ISO date-time", `trust_store.${field}`);
      }
    });
    if (isIsoDateTime(keyValue.valid_from) && isIsoDateTime(keyValue.valid_until) && Date.parse(keyValue.valid_until) <= Date.parse(keyValue.valid_from)) {
      pushIssue(issues, "error", `${path}.valid_until`, "valid_until must be after valid_from", "trust_store.validity_order");
    }
  }
  return createResult(value as unknown as AICTrustStore, issues);
}

export function validateAICTrustRegistry(value: unknown): ValidationResult<AICTrustRegistry> {
  const issues: AICValidationIssue[] = [];
  if (!isRecord(value)) {
    pushIssue(issues, "fatal", "$", "Expected an object", "trust_registry.object");
    return { issues, ok: false };
  }
  validateAllowedKeys(value, ["artifact_type", "entries", "id", "spec", "updated_at"], "$", issues, "trust_registry.unknown_field");
  if (value.artifact_type !== "aic_trust_registry") {
    pushIssue(issues, "error", "$.artifact_type", "Expected aic_trust_registry", "trust_registry.artifact_type");
  }
  if (value.spec !== AIC_TRUST_SPEC) {
    pushIssue(issues, "error", "$.spec", `Expected ${AIC_TRUST_SPEC}`, "trust_registry.spec");
  }
  validateStringField(value, "id", "$", issues, "trust_registry.id");
  if (!isIsoDateTime(value.updated_at)) {
    pushIssue(issues, "error", "$.updated_at", "Expected an ISO date-time", "trust_registry.updated_at");
  }
  if (!Array.isArray(value.entries)) {
    pushIssue(issues, "error", "$.entries", "Expected an array", "trust_registry.entries");
  }
  const entryIds = new Set<string>();
  for (const [index, entryValue] of (Array.isArray(value.entries) ? value.entries : []).entries()) {
    const path = `$.entries[${index}]`;
    if (!isRecord(entryValue)) {
      pushIssue(issues, "error", path, "Expected an object", "trust_registry.entry");
      continue;
    }
    validateAllowedKeys(entryValue, ["attestation", "attestation_digest", "deployment_id", "environment", "id", "operation_id", "origin"], path, issues, "trust_registry.entry_unknown_field");
    ["id", "deployment_id", "operation_id"].forEach((field) => validateStringField(entryValue, field, path, issues, `trust_registry.${field}`));
    if (isNonEmptyString(entryValue.id)) {
      if (entryIds.has(entryValue.id)) {
        pushIssue(issues, "error", `${path}.id`, `Duplicate entry id: ${entryValue.id}`, "trust_registry.entry_unique");
      }
      entryIds.add(entryValue.id);
    }
    if (!isCanonicalOrigin(entryValue.origin)) {
      pushIssue(issues, "error", `${path}.origin`, "Expected a canonical HTTP(S) origin", "trust_registry.origin");
    }
    if (typeof entryValue.environment !== "string" || !(AIC_TRUST_ENVIRONMENTS as readonly string[]).includes(entryValue.environment)) {
      pushIssue(issues, "error", `${path}.environment`, "Expected a supported environment", "trust_registry.environment");
    }
    if (!isSha256Digest(entryValue.attestation_digest)) {
      pushIssue(issues, "error", `${path}.attestation_digest`, "Expected sha256:<64 lowercase hex characters>", "trust_registry.attestation_digest");
    }
    const attestationValidation = validateAICSignedAttestation(entryValue.attestation);
    attestationValidation.issues.forEach((issue) => {
      pushIssue(issues, issue.severity, `${path}.attestation${issue.path.slice(1)}`, issue.message, issue.rule ?? "trust_registry.attestation");
    });
  }
  return createResult(value as unknown as AICTrustRegistry, issues);
}
