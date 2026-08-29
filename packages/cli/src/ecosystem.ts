import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  appendAICTransparencyEntry,
  applyAICScheduledKeyTransition,
  createAICConformanceBinding,
  createAICTransparencyIndex,
  evaluateAICAssurancePolicy,
  loadAICInteropSuite,
  prepareAICScheduledKeyRotation,
  verifyAICConformance,
  verifyAICInteropSuite,
  verifyAICScheduledKeyTransition,
  verifyAICTransparencyConsistency,
  verifyAICTransparencyIndex
} from "@aicorg/automation-core";
import {
  getAICBuiltInConformancePack,
  listAICBuiltInConformancePacks
} from "@aicorg/conformance-packs";
import { verifyAICEvidenceBundle, type AICEvidenceAdapter } from "@aicorg/evidence-core";
import { createAICHttpEvidenceAdapter } from "@aicorg/evidence-http";
import { createAICMcpEvidenceAdapter } from "@aicorg/evidence-mcp";
import {
  AIC_REMOTE_RUNNER_VERSION,
  runAICRemoteObservation,
  verifyAICRemoteReceiptSignature,
  type AICRemoteOperatorCapabilities
} from "@aicorg/runner-remote";
import {
  type AICConformancePack,
  type AICTransparencyEntryKind,
  validateAICAssurancePolicy,
  validateAICConformanceBinding,
  validateAICConformancePack,
  validateAICConformanceResult,
  validateAICDeploymentIdentity,
  validateAICEvidenceBundle,
  validateAICEvidencePlan,
  validateAICSignedKeyTransition,
  validateAICPolicyEvaluation,
  validateAICRemoteObservationJob,
  validateAICSignedTransparencyCheckpoint,
  validateAICTransparencyIndex,
  type AICValidationIssue
} from "@aicorg/spec";

type EcosystemValidator = (value: unknown) => {
  issues: AICValidationIssue[];
  ok: boolean;
};

const validators: Record<string, EcosystemValidator> = {
  "assurance-policy": validateAICAssurancePolicy,
  "conformance-binding": validateAICConformanceBinding,
  "conformance-pack": validateAICConformancePack,
  "conformance-result": validateAICConformanceResult,
  "deployment-identity": validateAICDeploymentIdentity,
  "evidence-bundle": validateAICEvidenceBundle,
  "evidence-plan": validateAICEvidencePlan,
  "key-transition": validateAICSignedKeyTransition,
  "policy-evaluation": validateAICPolicyEvaluation,
  "remote-job": validateAICRemoteObservationJob,
  "transparency-checkpoint": validateAICSignedTransparencyCheckpoint,
  "transparency-index": validateAICTransparencyIndex
};

async function readJson<T = unknown>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(resolve(process.cwd(), filePath), "utf8")) as T;
}

async function readText(filePath: string): Promise<string> {
  return readFile(resolve(process.cwd(), filePath), "utf8");
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  const resolved = resolve(process.cwd(), filePath);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function option(args: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = args.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requiredOption(args: string[], name: string): string {
  const value = option(args, name);
  if (!value) throw new Error(`Missing required option: ${name} <value>.`);
  return value;
}

function optionValues(args: string[], name: string): string[] {
  const values: string[] = [];
  const prefix = `${name}=`;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === name && args[index + 1] && !args[index + 1].startsWith("--")) {
      values.push(args[index + 1]);
      index += 1;
    } else if (value.startsWith(prefix)) {
      values.push(value.slice(prefix.length));
    }
  }
  return values;
}

function positional(args: string[]): string[] {
  const result: string[] = [];
  const flags = new Set(["--json"]);
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value.startsWith("--")) {
      if (!value.includes("=") && !flags.has(value) && args[index + 1] && !args[index + 1].startsWith("--")) {
        index += 1;
      }
      continue;
    }
    result.push(value);
  }
  return result;
}

function requiredInteger(args: string[], name: string): number {
  const raw = requiredOption(args, name);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer.`);
  }
  return value;
}

async function maybeWrite(args: string[], value: unknown): Promise<void> {
  const outFile = option(args, "--out-file");
  if (outFile) await writeJson(outFile, value);
}

async function loadPack(source: string): Promise<AICConformancePack> {
  const builtIn = getAICBuiltInConformancePack(source);
  if (builtIn) return builtIn;
  return readJson<AICConformancePack>(source);
}

function printIssues(issues: AICValidationIssue[]): void {
  issues.forEach((issue) => console.error(`[${issue.severity}] ${issue.path}: ${issue.message}`));
}

async function validateArtifact(kind: string, args: string[]): Promise<number> {
  const [file] = positional(args);
  if (!file) throw new Error(`validate ${kind} expects a <file>.`);
  const validation = validators[kind](await readJson(file));
  printIssues(validation.issues);
  if (!validation.ok) return 1;
  console.log(`${kind} is valid.`);
  return 0;
}

async function runConformance(kind: string | undefined, args: string[]): Promise<number> {
  if (kind === "list") {
    const packs = listAICBuiltInConformancePacks();
    printJson({
      packs: packs.map((pack) => ({
        id: pack.id,
        profiles: pack.profiles.map((profile) => profile.id),
        title: pack.title,
        version: pack.version
      }))
    });
    return 0;
  }

  if (kind === "show") {
    const [packSource] = positional(args);
    if (!packSource) throw new Error("conformance show expects a <pack-id-or-file>.");
    printJson(await loadPack(packSource));
    return 0;
  }

  if (kind === "bind") {
    const [packSource, profileId, contractFile, mappingFile] = positional(args);
    if (!packSource || !profileId || !contractFile || !mappingFile) {
      throw new Error("conformance bind expects <pack-id-or-file> <profile-id> <contract> <mapping>.");
    }
    const outFile = requiredOption(args, "--out-file");
    const mapping = await readJson<Record<string, unknown>>(mappingFile);
    const binding = createAICConformanceBinding({
      contract: await readJson(contractFile),
      pack: await loadPack(packSource),
      profileId,
      requirementMap: mapping.requirement_map as Record<string, string[]>,
      scenarioMap: mapping.scenario_map as Record<string, string[]>,
      surfaceRoles: mapping.surface_roles as { agent: string[]; human: string[] }
    });
    await writeJson(outFile, binding);
    printJson(binding);
    return 0;
  }

  if (kind === "verify") {
    const [packSource, bindingFile, contractFile] = positional(args);
    if (!packSource || !bindingFile || !contractFile) {
      throw new Error("conformance verify expects <pack-id-or-file> <binding> <contract>.");
    }
    const proofFile = option(args, "--proof");
    const result = verifyAICConformance({
      binding: await readJson(bindingFile),
      contract: await readJson(contractFile),
      generatedAt: option(args, "--generated-at") ?? new Date().toISOString(),
      pack: await loadPack(packSource),
      ...(proofFile ? { proof: await readJson(proofFile) } : {})
    });
    await maybeWrite(args, result);
    printJson(result);
    return result.status === "passed" ? 0 : 1;
  }

  throw new Error("conformance expects list, show, bind, or verify.");
}

async function runPolicy(kind: string | undefined, args: string[]): Promise<number> {
  if (kind !== "evaluate") throw new Error("policy expects evaluate.");
  const [policyFile, contractFile, proofFile] = positional(args);
  if (!policyFile || !contractFile || !proofFile) {
    throw new Error("policy evaluate expects <policy> <contract> <proof>.");
  }
  const observationsFile = requiredOption(args, "--observations");
  const attestationFile = option(args, "--attestation");
  const trustStoreFile = option(args, "--trust-store");
  if (Boolean(attestationFile) !== Boolean(trustStoreFile)) {
    throw new Error("--attestation and --trust-store must be supplied together.");
  }
  const environment = option(args, "--environment");
  if (environment && !["development", "production", "staging", "test"].includes(environment)) {
    throw new Error("--environment must be development, production, staging, or test.");
  }
  const evaluation = evaluateAICAssurancePolicy({
    ...(attestationFile ? { attestation: await readJson(attestationFile) } : {}),
    contract: await readJson(contractFile),
    ...(environment ? { environment: environment as "development" | "production" | "staging" | "test" } : {}),
    evaluatedAt: option(args, "--evaluated-at"),
    expectedOrigin: option(args, "--expect-origin"),
    expectedRevision: option(args, "--expect-revision"),
    observations: await readJson(observationsFile),
    policy: await readJson(policyFile),
    proof: await readJson(proofFile),
    ...(trustStoreFile ? { trustStore: await readJson(trustStoreFile) } : {})
  });
  await maybeWrite(args, evaluation);
  printJson(evaluation);
  return evaluation.decision === "passed" ? 0 : 1;
}

async function runInterop(kind: string | undefined, args: string[]): Promise<number> {
  if (kind !== "verify") throw new Error("interop expects verify.");
  const [suiteFile] = positional(args);
  if (!suiteFile) throw new Error("interop verify expects a <suite>.");
  const result = verifyAICInteropSuite(await loadAICInteropSuite(suiteFile));
  await maybeWrite(args, result);
  printJson(result);
  return result.status === "passed" ? 0 : 1;
}

async function runEvidence(kind: string | undefined, args: string[]): Promise<number> {
  if (kind === "run-remote") return runRemoteEvidence(args);
  if (kind !== "verify") throw new Error("evidence expects verify or run-remote.");
  const [bundleFile] = positional(args);
  if (!bundleFile) throw new Error("evidence verify expects a <bundle>.");
  const bundle = await readJson(bundleFile);
  const verification = verifyAICEvidenceBundle(bundle);
  const publicKeyFile = option(args, "--runner-public-key");
  const expectedKeyId = option(args, "--runner-key-id");
  if (Boolean(publicKeyFile) !== Boolean(expectedKeyId)) {
    throw new Error("--runner-public-key and --runner-key-id must be supplied together.");
  }
  const receiptSignature = publicKeyFile && expectedKeyId
    ? verifyAICRemoteReceiptSignature({
        bundle,
        expectedKeyId,
        publicKeyPem: await readText(publicKeyFile)
      })
    : undefined;
  const result = {
    artifact_type: "aic_evidence_verification",
    bundle: verification,
    ...(receiptSignature ? { receipt_signature: receiptSignature } : {})
  };
  await maybeWrite(args, result);
  printJson(result);
  return verification.ok && (!receiptSignature || receiptSignature.status === "trusted") ? 0 : 1;
}

function parseAssignments(values: string[], label: string): Map<string, string> {
  const assignments = new Map<string, string>();
  for (const value of values) {
    const separator = value.indexOf("=");
    if (separator <= 0 || separator === value.length - 1) {
      throw new Error(`${label} values must use <name>=<value>.`);
    }
    const name = value.slice(0, separator);
    if (assignments.has(name)) throw new Error(`${label} contains duplicate name ${name}.`);
    assignments.set(name, value.slice(separator + 1));
  }
  return assignments;
}

function createReceiptSigner(privateKeyPem: string): {
  sign(canonicalReceipt: string): Promise<{ algorithm: "ed25519"; key_id: string; value: string }>;
} {
  const privateKey = createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("Receipt signing requires an Ed25519 private key.");
  const publicKey = createPublicKey(privateKey);
  const keyId = `sha256:${createHash("sha256")
    .update(publicKey.export({ format: "der", type: "spki" }))
    .digest("hex")}`;
  return {
    async sign(canonicalReceipt) {
      return {
        algorithm: "ed25519",
        key_id: keyId,
        value: sign(null, Buffer.from(canonicalReceipt), privateKey).toString("base64")
      };
    }
  };
}

async function runRemoteEvidence(args: string[]): Promise<number> {
  const [jobFile] = positional(args);
  if (!jobFile) throw new Error("evidence run-remote expects a <job>.");
  const outFile = requiredOption(args, "--out-file");
  const runnerId = requiredOption(args, "--runner-id");
  const runnerRevision = requiredOption(args, "--runner-revision");

  const mutationAssignments = parseAssignments(
    optionValues(args, "--allow-mutation"),
    "--allow-mutation"
  );
  const operatorCapabilities: AICRemoteOperatorCapabilities = {
    ...(optionValues(args, "--allow-destructive-operation").length > 0
      ? { destructive_operation_ids: optionValues(args, "--allow-destructive-operation") }
      : {}),
    ...(mutationAssignments.size > 0
      ? {
          mutations: [...mutationAssignments].map(([operation_id, canary_scope]) => ({
            canary_scope,
            operation_id
          }))
        }
      : {})
  };
  const secretAssignments = parseAssignments(optionValues(args, "--secret"), "--secret");
  const receiptPrivateKeyFile = option(args, "--receipt-private-key");
  const bundle = await runAICRemoteObservation({
    adapters: new Map<string, AICEvidenceAdapter>([
      ["@aicorg/evidence-http", createAICHttpEvidenceAdapter()],
      ["@aicorg/evidence-mcp", createAICMcpEvidenceAdapter()]
    ]),
    ...(secretAssignments.size > 0
      ? {
          credentials: (reference: string) => {
            const environmentName = secretAssignments.get(reference);
            if (!environmentName) throw new Error(`No operator credential mapping exists for ${reference}.`);
            const value = process.env[environmentName];
            if (!value) throw new Error(`Credential environment variable ${environmentName} is unset.`);
            return value;
          }
        }
      : {}),
    job: await readJson(jobFile),
    operatorCapabilities,
    runner: {
      id: runnerId,
      software_name: option(args, "--runner-name") ?? "@aicorg/runner-remote",
      software_revision: runnerRevision,
      software_version: option(args, "--runner-version") ?? AIC_REMOTE_RUNNER_VERSION
    },
    ...(receiptPrivateKeyFile
      ? { signer: createReceiptSigner(await readText(receiptPrivateKeyFile)) }
      : {})
  });
  await writeJson(outFile, bundle);
  printJson({
    observations: bundle.observations.observations.length,
    output: resolve(process.cwd(), outFile),
    receipt_digest: bundle.receipt_digest,
    receipt_signature: bundle.receipt_signature ? "signed" : "unsigned",
    runner: bundle.receipt.runner,
    status: bundle.status,
    target: bundle.receipt.target
  });
  return 0;
}

function readExpectedHead(args: string[]): string | null {
  const value = requiredOption(args, "--expect-head");
  return value === "null" ? null : value;
}

async function runTransparency(kind: string | undefined, args: string[]): Promise<number> {
  if (kind === "init") {
    const index = createAICTransparencyIndex({
      issuedAt: option(args, "--issued-at"),
      logId: requiredOption(args, "--log-id"),
      privateKeyPem: await readText(requiredOption(args, "--private-key"))
    });
    await writeJson(requiredOption(args, "--out-file"), index);
    printJson(index);
    return 0;
  }

  if (kind === "append") {
    const [indexFile, entryKind, artifactFile] = positional(args);
    if (!indexFile || !entryKind || !artifactFile) {
      throw new Error("transparency append expects <index> <attestation|key_transition|key_revocation> <artifact>.");
    }
    if (!["attestation", "key_transition", "key_revocation"].includes(entryKind)) {
      throw new Error("Unsupported transparency entry kind.");
    }
    const next = appendAICTransparencyEntry({
      artifact: await readJson(artifactFile),
      expectedHead: readExpectedHead(args),
      expectedSize: requiredInteger(args, "--expect-size"),
      ...(option(args, "--external-receipts")
        ? { externalReceipts: await readJson(option(args, "--external-receipts") as string) }
        : {}),
      index: await readJson(indexFile),
      kind: entryKind as AICTransparencyEntryKind,
      loggedAt: option(args, "--logged-at"),
      logTrustStore: await readJson(requiredOption(args, "--trust-store")),
      privateKeyPem: await readText(requiredOption(args, "--private-key"))
    });
    await writeJson(requiredOption(args, "--out-file"), next);
    printJson(next);
    return 0;
  }

  if (kind === "verify") {
    const [indexFile] = positional(args);
    if (!indexFile) throw new Error("transparency verify expects an <index>.");
    const result = verifyAICTransparencyIndex({
      index: await readJson(indexFile),
      logTrustStore: await readJson(requiredOption(args, "--trust-store")),
      verifiedAt: option(args, "--verified-at")
    });
    printJson(result);
    return result.status === "trusted" ? 0 : 1;
  }

  if (kind === "consistency") {
    const [fromFile, toFile] = positional(args);
    if (!fromFile || !toFile) throw new Error("transparency consistency expects <from-index> <to-index>.");
    const result = verifyAICTransparencyConsistency({
      from: await readJson(fromFile),
      logTrustStore: await readJson(requiredOption(args, "--trust-store")),
      to: await readJson(toFile),
      verifiedAt: option(args, "--verified-at")
    });
    printJson(result);
    return result.status === "consistent" ? 0 : 1;
  }

  throw new Error("transparency expects init, append, verify, or consistency.");
}

async function prepareRotation(args: string[]): Promise<number> {
  const nextTrustStoreFile = resolve(
    process.cwd(),
    requiredOption(args, "--next-trust-store")
  );
  const transitionOutFile = resolve(
    process.cwd(),
    requiredOption(args, "--transition-out")
  );
  const result = prepareAICScheduledKeyRotation({
    effectiveAt: requiredOption(args, "--effective-at"),
    issuedAt: option(args, "--issued-at"),
    issuerId: requiredOption(args, "--issuer-id"),
    priorTrustStore: await readJson(requiredOption(args, "--prior-trust-store")),
    retireAt: requiredOption(args, "--retire-at"),
    retiringPrivateKeyPem: await readText(requiredOption(args, "--retiring-private-key")),
    successorPrivateKeyPem: await readText(requiredOption(args, "--successor-private-key")),
    successorValidUntil: option(args, "--successor-valid-until"),
    transitionId: requiredOption(args, "--transition-id")
  });
  await writeJson(nextTrustStoreFile, result.next_trust_store);
  await writeJson(transitionOutFile, result.transition);
  printJson({
    next_trust_store: nextTrustStoreFile,
    status: "prepared",
    transition: transitionOutFile,
    transition_id: result.transition.statement.transition_id
  });
  return 0;
}

async function runTransition(action: string | undefined, args: string[]): Promise<number> {
  if (action !== "verify" && action !== "apply") {
    throw new Error("trust transition expects verify or apply.");
  }
  const input = {
    nextTrustStore: await readJson(requiredOption(args, "--next-trust-store")),
    priorTrustStore: await readJson(requiredOption(args, "--prior-trust-store")),
    transition: await readJson(requiredOption(args, "--transition")),
    verifiedAt: option(args, "--verified-at")
  };
  const verification = verifyAICScheduledKeyTransition(input);
  if (action === "verify") {
    await maybeWrite(args, verification);
    printJson(verification);
    return verification.status === "trusted" ? 0 : 1;
  }
  if (verification.status !== "trusted") {
    printJson(verification);
    return 1;
  }
  const applied = applyAICScheduledKeyTransition(input);
  await writeJson(requiredOption(args, "--out-file"), applied);
  printJson({ output: resolve(process.cwd(), requiredOption(args, "--out-file")), status: "trusted" });
  return 0;
}

export async function runAICEcosystemCommand(argv: string[]): Promise<number | undefined> {
  const [command, kind, ...args] = argv;
  try {
    if (command === "validate" && kind && validators[kind]) return validateArtifact(kind, args);
    if (command === "conformance") return runConformance(kind, args);
    if (command === "policy") return runPolicy(kind, args);
    if (command === "interop") return runInterop(kind, args);
    if (command === "evidence") return runEvidence(kind, args);
    if (command === "transparency") return runTransparency(kind, args);
    if (command === "trust" && kind === "rotate") {
      const [action, ...rotationArgs] = args;
      if (action !== "prepare") throw new Error("trust rotate expects prepare.");
      return prepareRotation(rotationArgs);
    }
    if (command === "trust" && kind === "transition") {
      const [action, ...transitionArgs] = args;
      return runTransition(action, transitionArgs);
    }
    return undefined;
  } catch (error) {
    console.error(`AIC ecosystem command failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
