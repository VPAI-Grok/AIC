import type { AICValidationIssue, ValidationResult } from "./types.js";
import type { AICTrustSignature } from "./trust.js";
import { isAICRfc3339DateTime as date } from "./date-time.js";

export const AIC_KEY_TRANSITION_SPEC = "aic.key-transition/0.1";

export interface AICKeyTransitionStatement {
  artifact_type: "aic_key_transition_statement";
  effective_at: string;
  issuer_id: string;
  issued_at: string;
  next_trust_store_digest: string;
  prior_trust_store_digest: string;
  reason: "scheduled_rotation";
  retiring_key_id: string;
  spec: string;
  successor_key_id: string;
  transition_id: string;
}

export interface AICKeyTransitionSignature {
  role: "authorizing" | "proof_of_possession";
  signature: AICTrustSignature;
}

export interface AICSignedKeyTransition {
  artifact_type: "aic_signed_key_transition";
  signatures: AICKeyTransitionSignature[];
  spec: string;
  statement: AICKeyTransitionStatement;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function string(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function digest(value: unknown): value is string { return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value); }
function add(issues: AICValidationIssue[], path: string, message: string, rule: string): void { issues.push({ message, path, rule, severity: "error" }); }
function allowed(value: Record<string, unknown>, keys: string[], path: string, issues: AICValidationIssue[]): void {
  const set = new Set(keys); Object.keys(value).forEach((key) => { if (!set.has(key)) add(issues, `${path}.${key}`, `Unknown field: ${key}`, "key_transition.unknown_field"); });
}

export function validateAICSignedKeyTransition(value: unknown): ValidationResult<AICSignedKeyTransition> {
  const issues: AICValidationIssue[] = [];
  if (!record(value)) return { issues: [{ message: "Expected an object", path: "$", rule: "key_transition.object", severity: "fatal" }], ok: false };
  allowed(value, ["artifact_type", "signatures", "spec", "statement"], "$", issues);
  if (value.artifact_type !== "aic_signed_key_transition") add(issues, "$.artifact_type", "Expected aic_signed_key_transition", "key_transition.artifact_type");
  if (value.spec !== AIC_KEY_TRANSITION_SPEC) add(issues, "$.spec", `Expected ${AIC_KEY_TRANSITION_SPEC}`, "key_transition.spec");
  if (!record(value.statement)) add(issues, "$.statement", "Expected an object", "key_transition.statement");
  else {
    const statement = value.statement;
    allowed(statement, ["artifact_type", "effective_at", "issuer_id", "issued_at", "next_trust_store_digest", "prior_trust_store_digest", "reason", "retiring_key_id", "spec", "successor_key_id", "transition_id"], "$.statement", issues);
    if (statement.artifact_type !== "aic_key_transition_statement") add(issues, "$.statement.artifact_type", "Expected aic_key_transition_statement", "key_transition.statement_type");
    if (statement.spec !== AIC_KEY_TRANSITION_SPEC) add(issues, "$.statement.spec", `Expected ${AIC_KEY_TRANSITION_SPEC}`, "key_transition.spec");
    for (const field of ["issuer_id", "transition_id"]) if (!string(statement[field])) add(issues, `$.statement.${field}`, "Expected a non-empty string", "key_transition.string");
    for (const field of ["prior_trust_store_digest", "next_trust_store_digest", "retiring_key_id", "successor_key_id"]) if (!digest(statement[field])) add(issues, `$.statement.${field}`, "Expected a SHA-256 digest", "key_transition.digest");
    if (!date(statement.issued_at)) add(issues, "$.statement.issued_at", "Expected an ISO date-time", "key_transition.issued_at");
    if (!date(statement.effective_at)) add(issues, "$.statement.effective_at", "Expected an ISO date-time", "key_transition.effective_at");
    if (date(statement.issued_at) && date(statement.effective_at) && Date.parse(statement.effective_at) < Date.parse(statement.issued_at)) add(issues, "$.statement.effective_at", "effective_at cannot precede issued_at", "key_transition.time_order");
    if (statement.reason !== "scheduled_rotation") add(issues, "$.statement.reason", "Only scheduled_rotation is supported", "key_transition.reason");
    if (statement.retiring_key_id === statement.successor_key_id) add(issues, "$.statement.successor_key_id", "Successor key must differ from retiring key", "key_transition.distinct_keys");
  }
  if (!Array.isArray(value.signatures) || value.signatures.length !== 2) add(issues, "$.signatures", "Expected exactly authorizing and proof_of_possession signatures", "key_transition.signatures");
  const roles = new Set<string>();
  for (const [index, item] of (Array.isArray(value.signatures) ? value.signatures : []).entries()) {
    const path = `$.signatures[${index}]`;
    if (!record(item)) { add(issues, path, "Expected an object", "key_transition.signature"); continue; }
    allowed(item, ["role", "signature"], path, issues);
    if (item.role !== "authorizing" && item.role !== "proof_of_possession") add(issues, `${path}.role`, "Expected authorizing or proof_of_possession", "key_transition.role");
    else if (roles.has(item.role)) add(issues, `${path}.role`, `Duplicate role: ${item.role}`, "key_transition.role_unique");
    else roles.add(item.role);
    if (!record(item.signature)) { add(issues, `${path}.signature`, "Expected an object", "key_transition.signature_value"); continue; }
    allowed(item.signature, ["algorithm", "key_id", "value"], `${path}.signature`, issues);
    if (item.signature.algorithm !== "ed25519") add(issues, `${path}.signature.algorithm`, "Expected ed25519", "key_transition.algorithm");
    if (!digest(item.signature.key_id)) add(issues, `${path}.signature.key_id`, "Expected a SHA-256 key id", "key_transition.key_id");
    if (!string(item.signature.value) || !/^[A-Za-z0-9+/]+={0,2}$/.test(item.signature.value)) add(issues, `${path}.signature.value`, "Expected a base64 signature", "key_transition.signature_encoding");
  }
  for (const role of ["authorizing", "proof_of_possession"]) if (!roles.has(role)) add(issues, "$.signatures", `Missing ${role} signature`, "key_transition.role_required");
  if (record(value.statement) && Array.isArray(value.signatures)) {
    const authorizing = value.signatures.find((item) => record(item) && item.role === "authorizing");
    const possession = value.signatures.find((item) => record(item) && item.role === "proof_of_possession");
    if (record(authorizing) && record(authorizing.signature) && authorizing.signature.key_id !== value.statement.retiring_key_id) add(issues, "$.signatures", "Authorizing signature must use retiring_key_id", "key_transition.authorizing_key_binding");
    if (record(possession) && record(possession.signature) && possession.signature.key_id !== value.statement.successor_key_id) add(issues, "$.signatures", "Proof-of-possession signature must use successor_key_id", "key_transition.possession_key_binding");
  }
  return issues.length > 0 ? { issues, ok: false } : { issues, ok: true, value: value as unknown as AICSignedKeyTransition };
}
