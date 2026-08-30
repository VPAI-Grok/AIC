import { readFile, realpath } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { parseAICStrictJson } from "@aicorg/spec";
import { createAICCanonicalJson, createAICDigest, verifyAICSignedAttestation, verifyAICTrustRegistry } from "./trust.js";

export const AIC_INTEROP_SPEC = "aic.interop/0.1";
export const AIC_CANONICAL_JSON_PROFILE = "aic-canonical-json/0.1";

export type AICInteropOperation = "canonicalize" | "digest" | "verify_attestation" | "verify_registry";

export interface AICInteropCase {
  expected: Record<string, unknown>;
  id: string;
  input: Record<string, unknown>;
  operation: AICInteropOperation;
}

export interface AICInteropSuite {
  artifact_type: "aic_interop_suite";
  canonicalization: string;
  cases: AICInteropCase[];
  id: string;
  spec: string;
}

export interface AICInteropCaseResult {
  actual: Record<string, unknown>;
  expected: Record<string, unknown>;
  id: string;
  passed: boolean;
}

export interface AICInteropSuiteResult {
  artifact_type: "aic_interop_result";
  cases: AICInteropCaseResult[];
  failed: number;
  passed: number;
  spec: string;
  status: "failed" | "passed";
  suite_id: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableEqual(left: unknown, right: unknown): boolean {
  return createAICCanonicalJson(left) === createAICCanonicalJson(right);
}

function validateSuite(value: unknown): asserts value is AICInteropSuite {
  if (!record(value) || Object.keys(value).some((key) => !["artifact_type", "canonicalization", "cases", "id", "spec"].includes(key)) || value.artifact_type !== "aic_interop_suite" || value.spec !== AIC_INTEROP_SPEC || value.canonicalization !== AIC_CANONICAL_JSON_PROFILE || typeof value.id !== "string" || !value.id.trim() || !Array.isArray(value.cases) || value.cases.length === 0) throw new Error("Invalid AIC interoperability suite header.");
  const ids = new Set<string>();
  value.cases.forEach((item, index) => {
    if (!record(item) || Object.keys(item).some((key) => !["expected", "id", "input", "operation"].includes(key)) || typeof item.id !== "string" || !item.id.trim() || ids.has(item.id) || !["canonicalize", "digest", "verify_attestation", "verify_registry"].includes(String(item.operation)) || !record(item.input) || !record(item.expected)) throw new Error(`Invalid AIC interoperability case at index ${index}.`);
    ids.add(item.id);
  });
}

export function executeAICInteropCase(testCase: AICInteropCase): Record<string, unknown> {
  if (testCase.operation === "canonicalize") return { canonical_json: createAICCanonicalJson(testCase.input.value) };
  if (testCase.operation === "digest") return { digest: createAICDigest(testCase.input.value) };
  if (testCase.operation === "verify_attestation") {
    const result = verifyAICSignedAttestation({
      attestation: testCase.input.attestation,
      ...(testCase.input.contract === undefined ? {} : { contract: testCase.input.contract }),
      ...(typeof testCase.input.expected_origin === "string" ? { expectedOrigin: testCase.input.expected_origin } : {}),
      ...(typeof testCase.input.expected_revision === "string" ? { expectedRevision: testCase.input.expected_revision } : {}),
      ...(testCase.input.proof === undefined ? {} : { proof: testCase.input.proof }),
      trustStore: testCase.input.trust_store,
      ...(typeof testCase.input.verified_at === "string" ? { verifiedAt: testCase.input.verified_at } : {})
    });
    return {
      assurance_class: result.assurance_class,
      checks: result.checks,
      finding_codes: result.findings.map((finding) => finding.code),
      key_id: result.key_id ?? null,
      status: result.status
    };
  }
  const result = verifyAICTrustRegistry({
    registry: testCase.input.registry,
    trustStore: testCase.input.trust_store,
    ...(typeof testCase.input.verified_at === "string" ? { verifiedAt: testCase.input.verified_at } : {})
  });
  return {
    entries: result.entries.map((entry) => ({
      assurance_class: entry.result.assurance_class,
      finding_codes: entry.result.findings.map((finding) => finding.code),
      id: entry.id,
      status: entry.result.status
    })),
    finding_codes: result.findings.map((finding) => finding.code),
    status: result.status
  };
}

export function verifyAICInteropSuite(value: unknown): AICInteropSuiteResult {
  validateSuite(value);
  const cases = value.cases.map((testCase) => {
    const actual = executeAICInteropCase(testCase);
    return { actual, expected: testCase.expected, id: testCase.id, passed: stableEqual(actual, testCase.expected) };
  });
  const passed = cases.filter((item) => item.passed).length;
  return {
    artifact_type: "aic_interop_result",
    cases,
    failed: cases.length - passed,
    passed,
    spec: AIC_INTEROP_SPEC,
    status: passed === cases.length ? "passed" : "failed",
    suite_id: value.id
  };
}

function jsonPointer(value: unknown, fragment: string): unknown {
  if (!fragment || fragment === "#") return value;
  if (!fragment.startsWith("#/")) throw new Error(`Unsupported interoperability fixture fragment: ${fragment}`);
  return fragment.slice(2).split("/").reduce<unknown>((current, raw) => {
    const key = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!record(current) && !Array.isArray(current)) throw new Error(`Unable to resolve interoperability fixture fragment: ${fragment}`);
    return (current as Record<string, unknown>)[key];
  }, value);
}

export async function loadAICInteropSuite(manifestPath: string): Promise<AICInteropSuite> {
  const absoluteManifest = resolve(manifestPath);
  const root = dirname(absoluteManifest);
  const realRoot = await realpath(root);
  const realManifest = await realpath(absoluteManifest);
  const manifest = parseAICStrictJson(await readFile(absoluteManifest, "utf8"));
  validateSuite(manifest);
  const resolveFixtureValue = async (value: unknown): Promise<unknown> => {
    if (Array.isArray(value)) return Promise.all(value.map(resolveFixtureValue));
    if (!record(value)) return value;
    if (Object.keys(value).length === 1 && typeof value.$ref === "string") {
      const [file, fragment = ""] = value.$ref.split("#", 2);
      const target = resolve(root, file);
      const realTarget = await realpath(target);
      const traversal = relative(realRoot, realTarget);
      if (traversal.startsWith("..") || traversal === "" || realTarget === realManifest) throw new Error(`Fixture reference must stay below the suite directory: ${value.$ref}`);
      return jsonPointer(
        parseAICStrictJson(await readFile(target, "utf8")),
        fragment ? `#${fragment}` : ""
      );
    }
    return Object.fromEntries(
      await Promise.all(
        Object.entries(value).map(async ([key, child]) => [key, await resolveFixtureValue(child)])
      )
    );
  };
  const resolvedCases: AICInteropCase[] = [];
  for (const testCase of manifest.cases) {
    const resolvedInput = Object.fromEntries(
      await Promise.all(
        Object.entries(testCase.input).map(async ([name, input]) => [
          name,
          await resolveFixtureValue(input)
        ])
      )
    );
    resolvedCases.push({ ...testCase, input: resolvedInput });
  }
  return { ...manifest, cases: resolvedCases };
}
