import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify
} from "node:crypto";
import {
  AIC_KEY_TRANSITION_SPEC,
  AIC_TRUST_SPEC,
  type AICSignedKeyTransition,
  type AICTrustSignature,
  type AICTrustStore,
  type AICTrustStoreKey,
  validateAICSignedKeyTransition,
  validateAICTrustStore
} from "@aicorg/spec";
import { createAICCanonicalJson, createAICDigest } from "./trust.js";

const TRANSITION_DOMAIN = "aic-key-transition-v1\0";

export interface AICScheduledKeyRotationResult {
  next_trust_store: AICTrustStore;
  transition: AICSignedKeyTransition;
}

export interface AICKeyTransitionVerificationResult {
  findings: Array<{
    code:
      | "key_policy_invalid"
      | "next_store_invalid"
      | "origin_broadening"
      | "prior_store_invalid"
      | "signature_invalid"
      | "store_binding_mismatch"
      | "transition_invalid"
      | "transition_not_yet_valid";
    message: string;
  }>;
  status: "invalid" | "trusted" | "untrusted";
}

function keyId(publicKeyPem: string): string {
  const der = createPublicKey(publicKeyPem).export({ format: "der", type: "spki" });
  return `sha256:${createHash("sha256").update(der).digest("hex")}`;
}

function transitionBytes(statement: unknown): Buffer {
  return Buffer.from(`${TRANSITION_DOMAIN}${createAICCanonicalJson(statement)}`, "utf8");
}

function assertDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) throw new Error(`${field} must be an ISO date-time.`);
}

function publicKeyFor(privateKeyPem: string): { id: string; pem: string } {
  const privateKey = createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("Rotation keys must be Ed25519 keys.");
  const pem = createPublicKey(privateKey).export({ format: "pem", type: "spki" }).toString();
  return { id: keyId(pem), pem };
}

function originsAreSubset(candidate: string[] | undefined, existing: string[] | undefined): boolean {
  if (existing === undefined) return true;
  if (candidate === undefined) return false;
  return candidate.every((origin) => existing.includes(origin));
}

function signature(privateKeyPem: string, role: "authorizing" | "proof_of_possession", statement: unknown): { role: typeof role; signature: AICTrustSignature } {
  const privateKey = createPrivateKey(privateKeyPem);
  const publicKeyPem = createPublicKey(privateKey).export({ format: "pem", type: "spki" }).toString();
  return {
    role,
    signature: {
      algorithm: "ed25519",
      key_id: keyId(publicKeyPem),
      value: sign(null, transitionBytes(statement), privateKey).toString("base64")
    }
  };
}

export function prepareAICScheduledKeyRotation(input: {
  effectiveAt: string;
  issuedAt?: string;
  issuerId: string;
  priorTrustStore: unknown;
  retireAt: string;
  retiringPrivateKeyPem: string;
  successorPrivateKeyPem: string;
  successorValidUntil?: string;
  transitionId: string;
}): AICScheduledKeyRotationResult {
  const priorValidation = validateAICTrustStore(input.priorTrustStore);
  if (!priorValidation.ok) throw new Error(`Prior trust store is invalid: ${priorValidation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  const issuedAt = input.issuedAt ?? new Date().toISOString();
  for (const [field, value] of [["issuedAt", issuedAt], ["effectiveAt", input.effectiveAt], ["retireAt", input.retireAt]] as const) assertDate(value, field);
  if (input.successorValidUntil) assertDate(input.successorValidUntil, "successorValidUntil");
  if (Date.parse(input.effectiveAt) < Date.parse(issuedAt)) throw new Error("effectiveAt cannot precede issuedAt.");
  if (Date.parse(input.retireAt) < Date.parse(input.effectiveAt)) throw new Error("retireAt must not precede effectiveAt; scheduled rotations require an overlap or exact cutover.");
  if (input.successorValidUntil && Date.parse(input.successorValidUntil) <= Date.parse(input.effectiveAt)) throw new Error("successorValidUntil must be after effectiveAt.");
  if (!input.issuerId.trim() || !input.transitionId.trim()) throw new Error("issuerId and transitionId must be non-empty strings.");

  const retiringMaterial = publicKeyFor(input.retiringPrivateKeyPem);
  const successorMaterial = publicKeyFor(input.successorPrivateKeyPem);
  if (retiringMaterial.id === successorMaterial.id) throw new Error("The successor key must differ from the retiring key.");
  const prior = priorValidation.value;
  if (Date.parse(issuedAt) < Date.parse(prior.updated_at)) throw new Error("issuedAt cannot precede the prior trust-store update.");
  const retiring = prior.keys.find((key) => key.key_id === retiringMaterial.id);
  if (!retiring || retiring.status !== "active" || retiring.issuer_id !== input.issuerId) throw new Error("The retiring private key does not match an active key for the requested issuer.");
  if ((retiring.valid_from && Date.parse(issuedAt) < Date.parse(retiring.valid_from)) || (retiring.valid_until && Date.parse(issuedAt) > Date.parse(retiring.valid_until))) throw new Error("The retiring key does not authorize transitions at issuedAt.");
  if (retiring.valid_until && Date.parse(retiring.valid_until) < Date.parse(input.retireAt)) throw new Error("Rotation cannot extend the retiring key beyond its existing valid_until.");
  if (prior.keys.some((key) => key.key_id === successorMaterial.id)) throw new Error("The successor key already exists in the trust store.");

  const successor: AICTrustStoreKey = {
    ...(retiring.allowed_origins ? { allowed_origins: [...retiring.allowed_origins] } : {}),
    issuer_id: input.issuerId,
    key_id: successorMaterial.id,
    public_key_pem: successorMaterial.pem,
    status: "active",
    valid_from: input.effectiveAt,
    ...(input.successorValidUntil ? { valid_until: input.successorValidUntil } : {})
  };
  const next: AICTrustStore = {
    artifact_type: "aic_trust_store",
    keys: prior.keys.map((key) => key.key_id === retiring.key_id ? { ...key, status: "active" as const, valid_until: input.retireAt } : structuredClone(key)).concat(successor),
    spec: AIC_TRUST_SPEC,
    updated_at: issuedAt
  };
  const nextValidation = validateAICTrustStore(next);
  if (!nextValidation.ok) throw new Error(`Generated next trust store is invalid: ${nextValidation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);

  const statement = {
    artifact_type: "aic_key_transition_statement" as const,
    effective_at: input.effectiveAt,
    issuer_id: input.issuerId,
    issued_at: issuedAt,
    next_trust_store_digest: createAICDigest(next),
    prior_trust_store_digest: createAICDigest(prior),
    reason: "scheduled_rotation" as const,
    retiring_key_id: retiring.key_id,
    spec: AIC_KEY_TRANSITION_SPEC,
    successor_key_id: successor.key_id,
    transition_id: input.transitionId
  };
  const transition: AICSignedKeyTransition = {
    artifact_type: "aic_signed_key_transition",
    signatures: [
      signature(input.retiringPrivateKeyPem, "authorizing", statement),
      signature(input.successorPrivateKeyPem, "proof_of_possession", statement)
    ],
    spec: AIC_KEY_TRANSITION_SPEC,
    statement
  };
  const transitionValidation = validateAICSignedKeyTransition(transition);
  if (!transitionValidation.ok) throw new Error(`Generated transition is invalid: ${transitionValidation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  return { next_trust_store: next, transition };
}

export function verifyAICScheduledKeyTransition(input: {
  nextTrustStore: unknown;
  priorTrustStore: unknown;
  transition: unknown;
  verifiedAt?: string;
}): AICKeyTransitionVerificationResult {
  const findings: AICKeyTransitionVerificationResult["findings"] = [];
  const priorValidation = validateAICTrustStore(input.priorTrustStore);
  const nextValidation = validateAICTrustStore(input.nextTrustStore);
  const transitionValidation = validateAICSignedKeyTransition(input.transition);
  if (!priorValidation.ok) priorValidation.issues.forEach((issue) => findings.push({ code: "prior_store_invalid", message: `${issue.path}: ${issue.message}` }));
  if (!nextValidation.ok) nextValidation.issues.forEach((issue) => findings.push({ code: "next_store_invalid", message: `${issue.path}: ${issue.message}` }));
  if (!transitionValidation.ok) transitionValidation.issues.forEach((issue) => findings.push({ code: "transition_invalid", message: `${issue.path}: ${issue.message}` }));
  if (!priorValidation.ok || !nextValidation.ok || !transitionValidation.ok) return { findings, status: "invalid" };
  const prior = priorValidation.value;
  const next = nextValidation.value;
  const transition = transitionValidation.value;
  const statement = transition.statement;
  const verifiedAt = input.verifiedAt ?? new Date().toISOString();
  assertDate(verifiedAt, "verifiedAt");
  if (Date.parse(statement.issued_at) > Date.parse(verifiedAt)) findings.push({ code: "transition_not_yet_valid", message: "Transition was issued after the verification time." });
  if (createAICDigest(prior) !== statement.prior_trust_store_digest || createAICDigest(next) !== statement.next_trust_store_digest) findings.push({ code: "store_binding_mismatch", message: "Transition does not bind the supplied prior and next trust stores." });
  if (Date.parse(prior.updated_at) > Date.parse(statement.issued_at) || next.updated_at !== statement.issued_at) findings.push({ code: "key_policy_invalid", message: "Trust-store update times are inconsistent with transition issued_at." });

  const retiringPrior = prior.keys.find((key) => key.key_id === statement.retiring_key_id);
  const retiringNext = next.keys.find((key) => key.key_id === statement.retiring_key_id);
  const successor = next.keys.find((key) => key.key_id === statement.successor_key_id);
  if (!retiringPrior || !retiringNext || !successor || retiringPrior.status !== "active" || retiringNext.status !== "active" || successor.status !== "active" || retiringPrior.issuer_id !== statement.issuer_id || retiringNext.issuer_id !== statement.issuer_id || successor.issuer_id !== statement.issuer_id) {
    findings.push({ code: "key_policy_invalid", message: "Prior/retiring/successor key policy is not a scheduled same-issuer rotation." });
  } else {
    if (!retiringNext.valid_until || Date.parse(retiringNext.valid_until) < Date.parse(statement.effective_at) || successor.valid_from !== statement.effective_at) findings.push({ code: "key_policy_invalid", message: "Retiring and successor validity windows do not implement the signed cutover." });
    if (retiringPrior.valid_until && retiringNext.valid_until && Date.parse(retiringNext.valid_until) > Date.parse(retiringPrior.valid_until)) findings.push({ code: "key_policy_invalid", message: "Rotation cannot extend an existing retiring-key validity limit." });
    if (!originsAreSubset(successor.allowed_origins, retiringPrior.allowed_origins)) findings.push({ code: "origin_broadening", message: "Successor key broadens the retiring key's allowed origins." });
    const priorRetiringPolicy = { ...retiringPrior, valid_until: undefined };
    const nextRetiringPolicy = { ...retiringNext, valid_until: undefined };
    if (createAICCanonicalJson(priorRetiringPolicy) !== createAICCanonicalJson(nextRetiringPolicy)) findings.push({ code: "key_policy_invalid", message: "Retiring key policy changed beyond valid_until." });
    const priorWithoutRetiring = prior.keys.filter((key) => key.key_id !== statement.retiring_key_id);
    for (const key of priorWithoutRetiring) {
      const preserved = next.keys.find((candidate) => candidate.key_id === key.key_id);
      if (!preserved || createAICCanonicalJson(preserved) !== createAICCanonicalJson(key)) findings.push({ code: "key_policy_invalid", message: `Unrelated key ${key.key_id} was not preserved exactly.` });
    }
    if (next.keys.length !== prior.keys.length + 1) findings.push({ code: "key_policy_invalid", message: "Next trust store must add exactly one successor key." });
    const transitionIssuedAt = Date.parse(statement.issued_at);
    if ((retiringPrior.valid_from && transitionIssuedAt < Date.parse(retiringPrior.valid_from)) || (retiringPrior.valid_until && transitionIssuedAt > Date.parse(retiringPrior.valid_until))) findings.push({ code: "key_policy_invalid", message: "Retiring key did not authorize transitions at issued_at." });
  }

  const signatures = new Map(transition.signatures.map((item) => [item.role, item.signature]));
  for (const [role, key] of [["authorizing", retiringPrior], ["proof_of_possession", successor]] as const) {
    const signed = signatures.get(role);
    if (!key || !signed || signed.key_id !== key.key_id) {
      findings.push({ code: "signature_invalid", message: `${role} signature does not use the required key.` });
      continue;
    }
    try {
      if (keyId(key.public_key_pem) !== key.key_id || !verify(null, transitionBytes(statement), createPublicKey(key.public_key_pem), Buffer.from(signed.value, "base64"))) findings.push({ code: "signature_invalid", message: `${role} signature is invalid.` });
    } catch {
      findings.push({ code: "signature_invalid", message: `${role} signature could not be verified.` });
    }
  }
  return { findings, status: findings.length > 0 ? "untrusted" : "trusted" };
}

export function applyAICScheduledKeyTransition(input: {
  nextTrustStore: unknown;
  priorTrustStore: unknown;
  transition: unknown;
  verifiedAt?: string;
}): AICTrustStore {
  const verification = verifyAICScheduledKeyTransition(input);
  if (verification.status !== "trusted") throw new Error(`Scheduled key transition is not trusted: ${verification.findings.map((item) => item.message).join("; ")}`);
  return structuredClone(input.nextTrustStore) as AICTrustStore;
}
