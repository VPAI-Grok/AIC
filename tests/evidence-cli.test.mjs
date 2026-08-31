import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  createTempDir,
  importWorkspaceModule,
  readJsonFile,
  runCli,
  writeJsonFile,
  writeTextFile
} from "./helpers.mjs";

const core = await importWorkspaceModule(
  "packages/evidence-core/dist/evidence-core/src/index.js"
);

const ORIGIN = "https://service.example";
const REVISION = "a".repeat(40);

function contract() {
  return {
    artifact_type: "aic_behavior_contract",
    spec: "aic.behavior/0.1",
    id: "cli.evidence.behavior",
    title: "CLI evidence behavior",
    description: "A deterministic CLI evidence fixture.",
    action: {
      id: "cli.evidence",
      operation_id: "cli.evidence.domain",
      risk: "high"
    },
    surfaces: [
      {
        id: "openapi",
        kind: "openapi",
        label: "OpenAPI",
        entrypoint: "completeOperation"
      }
    ],
    requirements: [
      {
        id: "result.ok",
        phase: "postcondition",
        description: "The operation reports success."
      }
    ],
    scenarios: [
      {
        id: "success",
        title: "Success",
        surfaces: ["openapi"],
        parity: "independent",
        expected: {
          status: "succeeded",
          outcome: { value: "done" },
          required_requirements: ["result.ok"]
        }
      }
    ]
  };
}

function plan(contractValue, mutates = false) {
  return {
    artifact_type: "aic_evidence_plan",
    spec: "aic.evidence/0.1",
    id: "cli.evidence.plan",
    contract: {
      id: contractValue.id,
      digest: core.createAICEvidenceDigest(contractValue)
    },
    surfaces: [
      {
        adapter: "@aicorg/evidence-http",
        max_response_bytes: 100_000,
        surface_id: "openapi",
        timeout_ms: 5_000,
        scenarios: [
          {
            scenario_id: "success",
            mutates,
            request: {
              method: mutates ? "POST" : "GET",
              path: "/complete"
            },
            projection: {
              status: { literal: "succeeded" },
              outcome: { source: "response.body", pointer: "/outcome" },
              checks: [
                {
                  requirement_id: "result.ok",
                  observed_when: {
                    source: "response.body",
                    pointer: "/ok",
                    operator: "equals",
                    value: true
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  };
}

async function signedBundle() {
  const contractValue = contract();
  const planValue = plan(contractValue);
  const artifact = core.createAICEvidenceArtifact({
    content: {
      adapter: "@aicorg/evidence-http",
      scenario_id: "success",
      surface_id: "openapi",
      target_origin: ORIGIN,
      transcripts: []
    }
  });
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  const keyId = `sha256:${createHash("sha256")
    .update(publicKey.export({ format: "der", type: "spki" }))
    .digest("hex")}`;
  const completedAt = "2026-08-29T12:00:01.000Z";
  const bundle = await core.createAICEvidenceBundle({
    collections: [
      {
        adapter: {
          id: "@aicorg/evidence-http",
          protocol_version: "OpenAPI 3.0/3.1/3.2",
          version: "0.1.0-alpha.2"
        },
        artifacts: [artifact],
        observations: {
          artifact_type: "aic_behavior_observation_set",
          contract_id: contractValue.id,
          generated_at: completedAt,
          observations: [
            {
              artifact_type: "aic_behavior_observation",
              captured_at: completedAt,
              checks: [{ actual: true, passed: true, requirement_id: "result.ok" }],
              contract_id: contractValue.id,
              environment: {
                adapter: "@aicorg/evidence-http",
                adapter_version: "0.1.0-alpha.2",
                protocol_version: "HTTP",
                target_origin: ORIGIN
              },
              evidence: [{ digest: artifact.digest, kind: "trace", ref: artifact.ref }],
              mode: "executed",
              operation_id: contractValue.action.operation_id,
              outcome: { value: "done" },
              scenario_id: "success",
              status: "succeeded",
              surface_id: "openapi"
            }
          ]
        },
        request_count: 1
      }
    ],
    completedAt,
    contract: contractValue,
    deploymentIdentity: {
      artifact_type: "aic_deployment_identity",
      spec: "aic.deployment/0.1",
      deployed_at: "2026-08-29T11:00:00.000Z",
      deployment_id: "dep-cli-1",
      environment: "production",
      origin: ORIGIN,
      source_revision: REVISION
    },
    jobId: "cli-evidence-job",
    plan: planValue,
    runner: {
      id: "runner.example",
      software_name: "@aicorg/runner-remote",
      software_revision: "b".repeat(40),
      software_version: "0.1.0-alpha.2"
    },
    signer: async (canonicalReceipt) => ({
      algorithm: "ed25519",
      key_id: keyId,
      value: sign(null, Buffer.from(canonicalReceipt), privateKey).toString("base64")
    }),
    startedAt: "2026-08-29T12:00:00.000Z"
  });
  return { bundle, keyId, publicKeyPem };
}

test("aic evidence verify accepts a valid bundle only with the explicitly pinned runner key", async (t) => {
  const tempDir = await createTempDir("aic-evidence-cli-");
  t.after(async () => rm(tempDir, { force: true, recursive: true }));
  const fixture = await signedBundle();
  const bundleFile = resolve(tempDir, "bundle.json");
  const publicKeyFile = resolve(tempDir, "runner-public.pem");
  const resultFile = resolve(tempDir, "verification.json");
  await writeJsonFile(bundleFile, fixture.bundle);
  await writeTextFile(publicKeyFile, fixture.publicKeyPem);

  const result = await runCli([
    "evidence",
    "verify",
    bundleFile,
    "--runner-public-key",
    publicKeyFile,
    "--runner-key-id",
    fixture.keyId,
    "--out-file",
    resultFile
  ]);
  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
  const verification = await readJsonFile(resultFile);
  assert.equal(verification.bundle.ok, true);
  assert.equal(verification.receipt_signature.status, "trusted");
});

test("aic evidence run-remote denies requester-authorized mutations before contacting a target", async (t) => {
  const tempDir = await createTempDir("aic-evidence-cli-deny-");
  t.after(async () => rm(tempDir, { force: true, recursive: true }));
  const contractValue = contract();
  const jobFile = resolve(tempDir, "job.json");
  await writeJsonFile(jobFile, {
    artifact_type: "aic_remote_observation_job",
    spec: "aic.remote/0.1",
    id: "cli-default-deny-job",
    contract: contractValue,
    plan: plan(contractValue, true),
    target: {
      environment: "production",
      origin: "https://127.0.0.1",
      identity_path: "/.well-known/aic-deployment.json",
      expected_deployment_id: "never-contact",
      expected_source_revision: REVISION
    },
    policy: {
      adapter_allowlist: ["@aicorg/evidence-http"],
      operation_allowlist: [contractValue.action.operation_id],
      require_https: true,
      public_network_only: true,
      max_run_ms: 5_000,
      max_response_bytes: 100_000,
      allow_mutations: {
        canary_scope: "tenant:requester-canary",
        operation_ids: [contractValue.action.operation_id]
      }
    }
  });

  const missingOutput = await runCli([
    "evidence",
    "run-remote",
    jobFile,
    "--runner-id",
    "runner.example",
    "--runner-revision",
    "b".repeat(40),
    "--allow-mutation",
    `${contractValue.action.operation_id}=tenant:requester-canary`
  ]);
  assert.equal(missingOutput.code, 1);
  assert.match(missingOutput.stderr, /Missing required option: --out-file/);
  assert.doesNotMatch(missingOutput.stderr, /target|deployment|DNS/i);

  const result = await runCli([
    "evidence",
    "run-remote",
    jobFile,
    "--runner-id",
    "runner.example",
    "--runner-revision",
    "b".repeat(40),
    "--out-file",
    resolve(tempDir, "must-not-exist.json")
  ]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /matching requester and operator grants/);
});
