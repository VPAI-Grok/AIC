import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify
} from "node:crypto";
import {
  AIC_TRUST_PAYLOAD_TYPE,
  AIC_TRUST_SPEC,
  type AICBehaviorContract,
  type AICBehaviorProof,
  type AICSignedAttestation,
  type AICTrustDeployment,
  type AICTrustIssuer,
  type AICTrustReferences,
  type AICTrustRegistry,
  type AICTrustRegistryEntry,
  type AICTrustRunner,
  type AICTrustStatement,
  type AICTrustStore,
  validateAICBehaviorContract,
  validateAICBehaviorProof,
  validateAICSignedAttestation,
  validateAICTrustRegistry,
  validateAICTrustStatement,
  validateAICTrustStore
} from "@aicorg/spec";

export type AICTrustCheck = "passed" | "failed" | "not_checked";

export type AICTrustFindingCode =
  | "attestation_digest_mismatch"
  | "attestation_invalid"
  | "attestation_not_yet_valid"
  | "contract_binding_mismatch"
  | "deployment_binding_mismatch"
  | "expired_attestation"
  | "issuer_mismatch"
  | "key_expired"
  | "key_id_mismatch"
  | "key_not_yet_valid"
  | "key_revoked"
  | "origin_not_allowed"
  | "proof_binding_mismatch"
  | "registry_entry_mismatch"
  | "registry_invalid"
  | "signature_invalid"
  | "trust_store_invalid"
  | "trusted_key_missing";

export interface AICTrustFinding {
  code: AICTrustFindingCode;
  message: string;
  severity: "error" | "warning";
}

export interface AICTrustVerificationResult {
  assurance_class: "ci_signed_claim" | "local_signed_claim" | "remote_signed_claim" | "unverified";
  checks: {
    attestation_schema: AICTrustCheck;
    contract_binding: AICTrustCheck;
    deployment_binding: AICTrustCheck;
    issuer_trust: AICTrustCheck;
    proof_binding: AICTrustCheck;
    signature: AICTrustCheck;
    trust_store_schema: AICTrustCheck;
  };
  findings: AICTrustFinding[];
  key_id?: string;
  statement?: AICTrustStatement;
  status: "invalid" | "trusted" | "untrusted";
}

export interface AICTrustKeyPair {
  key_id: string;
  private_key_pem: string;
  public_key_pem: string;
  trust_store: AICTrustStore;
}

export interface CreateAICTrustStatementInput {
  contract: unknown;
  deployment: AICTrustDeployment;
  expiresAt?: string;
  issuedAt?: string;
  issuer: AICTrustIssuer;
  proof: unknown;
  references?: AICTrustReferences;
  runner: AICTrustRunner;
}

export interface VerifyAICSignedAttestationInput {
  attestation: unknown;
  contract?: unknown;
  expectedOrigin?: string;
  expectedRevision?: string;
  proof?: unknown;
  trustStore: unknown;
  verifiedAt?: string;
}

export interface VerifyAICTrustRegistryResult {
  entries: Array<{
    id: string;
    result: AICTrustVerificationResult;
  }>;
  findings: AICTrustFinding[];
  status: "invalid" | "trusted" | "untrusted";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  return value;
}

export function createAICCanonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function createAICDigest(value: unknown): string {
  return `sha256:${createHash("sha256").update(createAICCanonicalJson(value)).digest("hex")}`;
}

function createKeyId(publicKeyPem: string): string {
  const publicKey = createPublicKey(publicKeyPem);
  const der = publicKey.export({ format: "der", type: "spki" });
  return `sha256:${createHash("sha256").update(der).digest("hex")}`;
}

function assertIsoDateTime(value: string, field: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new Error(`${field} must be an ISO date-time string.`);
  }
}

function createRegistryEntryId(attestation: AICSignedAttestation): string {
  return `urn:aic:attestation:${createAICDigest(attestation).slice("sha256:".length)}`;
}

function asBehaviorProof(value: unknown): AICBehaviorProof {
  const validation = validateAICBehaviorProof(value);
  if (!validation.ok) {
    throw new Error(`proof is invalid: ${validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }
  return validation.value;
}

function addFinding(
  findings: AICTrustFinding[],
  code: AICTrustFindingCode,
  message: string,
  severity: AICTrustFinding["severity"] = "error"
): void {
  findings.push({ code, message, severity });
}

function assuranceClass(statement: AICTrustStatement | undefined): AICTrustVerificationResult["assurance_class"] {
  if (!statement) return "unverified";
  if (statement.runner.kind === "local") return "local_signed_claim";
  if (statement.runner.kind === "remote") return "remote_signed_claim";
  return "ci_signed_claim";
}

export function generateAICTrustKeyPair(input: {
  allowedOrigins?: string[];
  generatedAt?: string;
  issuerId: string;
}): AICTrustKeyPair {
  if (!input.issuerId.trim()) {
    throw new Error("issuerId must be a non-empty string.");
  }
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  assertIsoDateTime(generatedAt, "generatedAt");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  const keyId = createKeyId(publicKeyPem);
  const trustStore: AICTrustStore = {
    artifact_type: "aic_trust_store",
    keys: [
      {
        ...(input.allowedOrigins && input.allowedOrigins.length > 0
          ? { allowed_origins: [...input.allowedOrigins] }
          : {}),
        issuer_id: input.issuerId,
        key_id: keyId,
        public_key_pem: publicKeyPem,
        status: "active",
        valid_from: generatedAt
      }
    ],
    spec: AIC_TRUST_SPEC,
    updated_at: generatedAt
  };
  const validation = validateAICTrustStore(trustStore);
  if (!validation.ok) {
    throw new Error(`Generated trust store is invalid: ${validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }
  return {
    key_id: keyId,
    private_key_pem: privateKeyPem,
    public_key_pem: publicKeyPem,
    trust_store: trustStore
  };
}

export function createAICTrustStatement(input: CreateAICTrustStatementInput): AICTrustStatement {
  const contractValidation = validateAICBehaviorContract(input.contract);
  if (!contractValidation.ok) {
    throw new Error(`contract is invalid: ${contractValidation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }
  const contract = contractValidation.value;
  const proof = asBehaviorProof(input.proof);
  if (proof.status !== "passed") {
    throw new Error("Only a passed behavior proof can be attested.");
  }
  const contractDigest = createAICDigest(contract);
  if (proof.contract.id !== contract.id || proof.contract.digest !== contractDigest) {
    throw new Error("The proof is not bound to the supplied behavior contract.");
  }
  const issuedAt = input.issuedAt ?? new Date().toISOString();
  assertIsoDateTime(issuedAt, "issuedAt");
  if (input.expiresAt) assertIsoDateTime(input.expiresAt, "expiresAt");
  const statement: AICTrustStatement = {
    artifact_type: "aic_trust_statement",
    deployment: input.deployment,
    ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
    issued_at: issuedAt,
    issuer: input.issuer,
    ...(input.references ? { references: input.references } : {}),
    runner: input.runner,
    spec: AIC_TRUST_SPEC,
    subject: {
      contract_digest: contractDigest,
      contract_id: contract.id,
      evidence_level: proof.evidence_level,
      generated_at: proof.generated_at,
      operation_id: contract.action.operation_id,
      proof_digest: createAICDigest(proof),
      proof_status: "passed"
    }
  };
  const validation = validateAICTrustStatement(statement);
  if (!validation.ok) {
    throw new Error(`trust statement is invalid: ${validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }
  return statement;
}

export function signAICTrustStatement(input: {
  privateKeyPem: string;
  statement: unknown;
}): AICSignedAttestation {
  const statementValidation = validateAICTrustStatement(input.statement);
  if (!statementValidation.ok) {
    throw new Error(`trust statement is invalid: ${statementValidation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }
  const privateKey = createPrivateKey(input.privateKeyPem);
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("The private key must be an Ed25519 key.");
  }
  const publicKeyPem = createPublicKey(privateKey).export({ format: "pem", type: "spki" }).toString();
  const signature = sign(null, Buffer.from(createAICCanonicalJson(statementValidation.value)), privateKey);
  return {
    artifact_type: "aic_signed_attestation",
    payload_type: AIC_TRUST_PAYLOAD_TYPE,
    signature: {
      algorithm: "ed25519",
      key_id: createKeyId(publicKeyPem),
      value: signature.toString("base64")
    },
    spec: AIC_TRUST_SPEC,
    statement: statementValidation.value
  };
}

export function createAICSignedAttestation(
  input: CreateAICTrustStatementInput & { privateKeyPem: string }
): AICSignedAttestation {
  return signAICTrustStatement({
    privateKeyPem: input.privateKeyPem,
    statement: createAICTrustStatement(input)
  });
}

export function verifyAICSignedAttestation(
  input: VerifyAICSignedAttestationInput
): AICTrustVerificationResult {
  const findings: AICTrustFinding[] = [];
  const checks: AICTrustVerificationResult["checks"] = {
    attestation_schema: "not_checked",
    contract_binding: "not_checked",
    deployment_binding: "not_checked",
    issuer_trust: "not_checked",
    proof_binding: "not_checked",
    signature: "not_checked",
    trust_store_schema: "not_checked"
  };
  const attestationValidation = validateAICSignedAttestation(input.attestation);
  if (!attestationValidation.ok) {
    checks.attestation_schema = "failed";
    attestationValidation.issues.forEach((issue) => addFinding(findings, "attestation_invalid", `${issue.path}: ${issue.message}`));
  } else {
    checks.attestation_schema = "passed";
  }
  const trustStoreValidation = validateAICTrustStore(input.trustStore);
  if (!trustStoreValidation.ok) {
    checks.trust_store_schema = "failed";
    trustStoreValidation.issues.forEach((issue) => addFinding(findings, "trust_store_invalid", `${issue.path}: ${issue.message}`));
  } else {
    checks.trust_store_schema = "passed";
  }
  if (!attestationValidation.ok || !trustStoreValidation.ok) {
    return { assurance_class: "unverified", checks, findings, status: "invalid" };
  }

  const attestation = attestationValidation.value;
  const statement = attestation.statement;
  const key = trustStoreValidation.value.keys.find((candidate) => candidate.key_id === attestation.signature.key_id);
  if (!key) {
    checks.issuer_trust = "failed";
    addFinding(findings, "trusted_key_missing", `No trusted key matches ${attestation.signature.key_id}.`);
  } else {
    const derivedKeyId = (() => {
      try {
        return createKeyId(key.public_key_pem);
      } catch {
        return undefined;
      }
    })();
    if (derivedKeyId !== key.key_id) {
      checks.issuer_trust = "failed";
      addFinding(findings, "key_id_mismatch", "The trusted key id does not match its public key material.");
    }
    if (key.issuer_id !== statement.issuer.id) {
      checks.issuer_trust = "failed";
      addFinding(findings, "issuer_mismatch", `Trusted key issuer ${key.issuer_id} does not match statement issuer ${statement.issuer.id}.`);
    }
    if (key.status === "revoked") {
      checks.issuer_trust = "failed";
      addFinding(findings, "key_revoked", `Trusted key ${key.key_id} is revoked.`);
    }
    if (key.allowed_origins && !key.allowed_origins.includes(statement.deployment.origin)) {
      checks.issuer_trust = "failed";
      addFinding(findings, "origin_not_allowed", `Issuer key ${key.key_id} is not trusted for ${statement.deployment.origin}.`);
    }
    const issuedAt = Date.parse(statement.issued_at);
    if (key.valid_from && issuedAt < Date.parse(key.valid_from)) {
      checks.issuer_trust = "failed";
      addFinding(findings, "key_not_yet_valid", "The attestation predates the trusted key validity window.");
    }
    if (key.valid_until && issuedAt > Date.parse(key.valid_until)) {
      checks.issuer_trust = "failed";
      addFinding(findings, "key_expired", "The attestation was issued after the trusted key validity window.");
    }
    if (checks.issuer_trust !== "failed") checks.issuer_trust = "passed";
    try {
      const signatureValid = verify(
        null,
        Buffer.from(createAICCanonicalJson(statement)),
        createPublicKey(key.public_key_pem),
        Buffer.from(attestation.signature.value, "base64")
      );
      checks.signature = signatureValid ? "passed" : "failed";
      if (!signatureValid) addFinding(findings, "signature_invalid", "The Ed25519 signature does not verify.");
    } catch {
      checks.signature = "failed";
      addFinding(findings, "signature_invalid", "The Ed25519 signature or trusted public key could not be verified.");
    }
  }

  const verifiedAt = input.verifiedAt ?? new Date().toISOString();
  assertIsoDateTime(verifiedAt, "verifiedAt");
  if (Date.parse(statement.issued_at) > Date.parse(verifiedAt)) {
    addFinding(findings, "attestation_not_yet_valid", `The attestation is not valid before ${statement.issued_at}.`);
  }
  if (statement.expires_at && Date.parse(statement.expires_at) <= Date.parse(verifiedAt)) {
    addFinding(findings, "expired_attestation", `The attestation expired at ${statement.expires_at}.`);
  }
  if (input.expectedOrigin && statement.deployment.origin !== input.expectedOrigin) {
    checks.deployment_binding = "failed";
    addFinding(findings, "deployment_binding_mismatch", `Attested origin ${statement.deployment.origin} does not match expected origin ${input.expectedOrigin}.`);
  }
  if (input.expectedRevision && statement.deployment.source_revision !== input.expectedRevision) {
    checks.deployment_binding = "failed";
    addFinding(findings, "deployment_binding_mismatch", `Attested revision ${statement.deployment.source_revision} does not match expected revision ${input.expectedRevision}.`);
  }
  if (
    checks.deployment_binding !== "failed" &&
    (input.expectedOrigin !== undefined || input.expectedRevision !== undefined)
  ) {
    checks.deployment_binding = "passed";
  }

  if (input.contract !== undefined) {
    const contractValidation = validateAICBehaviorContract(input.contract);
    if (!contractValidation.ok) {
      checks.contract_binding = "failed";
      addFinding(findings, "contract_binding_mismatch", "The supplied behavior contract is invalid.");
    } else {
      const contract = contractValidation.value;
      const matches =
        statement.subject.contract_id === contract.id &&
        statement.subject.contract_digest === createAICDigest(contract) &&
        statement.subject.operation_id === contract.action.operation_id;
      checks.contract_binding = matches ? "passed" : "failed";
      if (!matches) addFinding(findings, "contract_binding_mismatch", "The supplied behavior contract does not match the signed statement.");
    }
  }

  if (input.proof !== undefined) {
    try {
      const proof = asBehaviorProof(input.proof);
      const matches =
        proof.status === "passed" &&
        statement.subject.proof_digest === createAICDigest(proof) &&
        statement.subject.contract_id === proof.contract.id &&
        statement.subject.contract_digest === proof.contract.digest;
      checks.proof_binding = matches ? "passed" : "failed";
      if (!matches) addFinding(findings, "proof_binding_mismatch", "The supplied behavior proof does not match the signed statement.");
    } catch {
      checks.proof_binding = "failed";
      addFinding(findings, "proof_binding_mismatch", "The supplied behavior proof is invalid.");
    }
  }

  const hasErrors = findings.some((finding) => finding.severity === "error");
  return {
    assurance_class: assuranceClass(statement),
    checks,
    findings,
    key_id: attestation.signature.key_id,
    statement,
    status: hasErrors ? "untrusted" : "trusted"
  };
}

export function buildAICTrustRegistry(input: {
  attestations: unknown[];
  id: string;
  trustStore: unknown;
  updatedAt?: string;
}): AICTrustRegistry {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  assertIsoDateTime(updatedAt, "updatedAt");
  if (!input.id.trim()) throw new Error("registry id must be a non-empty string.");
  const trustStoreValidation = validateAICTrustStore(input.trustStore);
  if (!trustStoreValidation.ok) {
    throw new Error(`trust store is invalid: ${trustStoreValidation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }
  const entries: AICTrustRegistryEntry[] = input.attestations.map((value) => {
    const verification = verifyAICSignedAttestation({
      attestation: value,
      trustStore: input.trustStore,
      verifiedAt: updatedAt
    });
    if (verification.status !== "trusted" || !verification.statement) {
      throw new Error(`Cannot add an untrusted attestation to the registry: ${verification.findings.map((finding) => finding.message).join("; ")}`);
    }
    const attestation = value as AICSignedAttestation;
    const statement = verification.statement;
    return {
      attestation,
      attestation_digest: createAICDigest(attestation),
      deployment_id: statement.deployment.deployment_id,
      environment: statement.deployment.environment,
      id: createRegistryEntryId(attestation),
      operation_id: statement.subject.operation_id,
      origin: statement.deployment.origin
    };
  });
  entries.sort((left, right) => left.id.localeCompare(right.id));
  const registry: AICTrustRegistry = {
    artifact_type: "aic_trust_registry",
    entries,
    id: input.id,
    spec: AIC_TRUST_SPEC,
    updated_at: updatedAt
  };
  const validation = validateAICTrustRegistry(registry);
  if (!validation.ok) {
    throw new Error(`Generated trust registry is invalid: ${validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }
  return registry;
}

export function verifyAICTrustRegistry(input: {
  registry: unknown;
  trustStore: unknown;
  verifiedAt?: string;
}): VerifyAICTrustRegistryResult {
  const findings: AICTrustFinding[] = [];
  const registryValidation = validateAICTrustRegistry(input.registry);
  if (!registryValidation.ok) {
    registryValidation.issues.forEach((issue) => addFinding(findings, "registry_invalid", `${issue.path}: ${issue.message}`));
    return { entries: [], findings, status: "invalid" };
  }
  const trustStoreValidation = validateAICTrustStore(input.trustStore);
  if (!trustStoreValidation.ok) {
    trustStoreValidation.issues.forEach((issue) => addFinding(findings, "trust_store_invalid", `${issue.path}: ${issue.message}`));
    return { entries: [], findings, status: "invalid" };
  }
  const entries = registryValidation.value.entries.map((entry) => {
    const result = verifyAICSignedAttestation({
      attestation: entry.attestation,
      trustStore: input.trustStore,
      verifiedAt: input.verifiedAt
    });
    const attestationDigest = createAICDigest(entry.attestation);
    if (entry.attestation_digest !== attestationDigest) {
      addFinding(findings, "attestation_digest_mismatch", `Registry entry ${entry.id} has an invalid attestation digest.`);
    }
    const statement = result.statement;
    if (
      statement &&
      (entry.id !== createRegistryEntryId(entry.attestation) ||
        entry.origin !== statement.deployment.origin ||
        entry.environment !== statement.deployment.environment ||
        entry.deployment_id !== statement.deployment.deployment_id ||
        entry.operation_id !== statement.subject.operation_id)
    ) {
      addFinding(findings, "registry_entry_mismatch", `Registry entry ${entry.id} does not match its signed statement.`);
    }
    return { id: entry.id, result };
  });
  const hasUntrustedEntry = entries.some((entry) => entry.result.status !== "trusted");
  const hasErrors = findings.some((finding) => finding.severity === "error");
  return {
    entries,
    findings,
    status: hasErrors ? "invalid" : hasUntrustedEntry ? "untrusted" : "trusted"
  };
}

export function queryAICTrustRegistry(input: {
  environment?: string;
  operationId?: string;
  origin?: string;
  registry: unknown;
}): AICTrustRegistryEntry[] {
  const validation = validateAICTrustRegistry(input.registry);
  if (!validation.ok) {
    throw new Error(`trust registry is invalid: ${validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }
  return validation.value.entries.filter((entry) =>
    (input.origin === undefined || entry.origin === input.origin) &&
    (input.operationId === undefined || entry.operation_id === input.operationId) &&
    (input.environment === undefined || entry.environment === input.environment)
  );
}
