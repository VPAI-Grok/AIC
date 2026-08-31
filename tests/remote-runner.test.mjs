import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import { importWorkspaceModule } from "./helpers.mjs";

const core = await importWorkspaceModule(
  "packages/evidence-core/dist/evidence-core/src/index.js"
);
const httpEvidence = await importWorkspaceModule(
  "packages/evidence-http/dist/evidence-http/src/index.js"
);
const runner = await importWorkspaceModule(
  "packages/runner-remote/dist/runner-remote/src/index.js"
);

const REVISION = "a".repeat(40);
const ORIGIN = "https://service.example";

function contract() {
  return {
    artifact_type: "aic_behavior_contract",
    spec: "aic.behavior/0.1",
    id: "remote.complete.behavior",
    title: "Remote behavior",
    description: "Remote production evidence fixture.",
    action: {
      id: "remote.complete",
      operation_id: "remote.complete.domain",
      risk: "critical"
    },
    surfaces: [
      {
        id: "openapi",
        kind: "openapi",
        label: "Remote OpenAPI operation",
        entrypoint: "completeOperation"
      }
    ],
    requirements: [
      { id: "result.ok", phase: "postcondition", description: "The operation reports success." }
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

function planFor(contractValue, { mutates = false } = {}) {
  return {
    artifact_type: "aic_evidence_plan",
    spec: "aic.evidence/0.1",
    id: "remote.complete.plan",
    contract: {
      id: contractValue.id,
      digest: core.createAICEvidenceDigest(contractValue)
    },
    surfaces: [
      {
        adapter: "@aicorg/evidence-http",
        max_response_bytes: 100_000,
        surface_id: "openapi",
        timeout_ms: 10_000,
        openapi: {
          operation_id: "completeOperation",
          document: {
            openapi: "3.2.0",
            info: { title: "fixture", version: "1" },
            paths: {
              "/complete": {
                [mutates ? "post" : "get"]: {
                  operationId: "completeOperation",
                  responses: { "200": { description: "ok" } }
                }
              }
            }
          }
        },
        scenarios: [
          {
            scenario_id: "success",
            mutates,
            request: {},
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

function jobFor({ mutates = false, origin = ORIGIN, deploymentId = "dep-1" } = {}) {
  const contractValue = contract();
  return {
    artifact_type: "aic_remote_observation_job",
    spec: "aic.remote/0.1",
    id: "remote-job-1",
    contract: contractValue,
    plan: planFor(contractValue, { mutates }),
    target: {
      environment: "production",
      origin,
      identity_path: "/.well-known/aic-deployment.json",
      expected_deployment_id: deploymentId,
      expected_source_revision: REVISION
    },
    policy: {
      adapter_allowlist: ["@aicorg/evidence-http"],
      operation_allowlist: [contractValue.action.operation_id],
      require_https: true,
      public_network_only: true,
      max_run_ms: 10_000,
      max_response_bytes: 100_000,
      ...(mutates
        ? {
            allow_mutations: {
              canary_scope: "tenant:aic-canary",
              operation_ids: [contractValue.action.operation_id]
            }
          }
        : {})
    }
  };
}

function identity({ deploymentId = "dep-1", origin = ORIGIN } = {}) {
  return {
    artifact_type: "aic_deployment_identity",
    spec: "aic.deployment/0.1",
    origin,
    environment: "production",
    deployment_id: deploymentId,
    source_revision: REVISION,
    deployed_at: "2026-08-29T10:00:00.000Z"
  };
}

function fakeFetchFactory(state, identityValue = identity()) {
  return () => async (rawUrl, init = {}) => {
    const url = new URL(rawUrl);
    state.calls.push({ method: init.method, path: url.pathname });
    if (url.pathname === "/.well-known/aic-deployment.json") {
      return new Response(JSON.stringify(identityValue), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ ok: true, outcome: { value: "done" } }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
}

function runnerInput(job, overrides = {}) {
  const {
    identityValue,
    state = { calls: [] },
    ...runnerOverrides
  } = overrides;
  return {
    adapters: new Map([
      ["@aicorg/evidence-http", httpEvidence.createAICHttpEvidenceAdapter()]
    ]),
    job,
    dns: async () => [{ address: "93.184.216.34", family: 4 }],
    fetchFactory: fakeFetchFactory(state, identityValue),
    now: () => new Date("2026-08-29T12:00:00.000Z"),
    runner: {
      id: "independent-runner.example",
      software_name: "@aicorg/runner-remote",
      software_version: "0.1.0-alpha.2",
      software_revision: "b".repeat(40)
    },
    ...runnerOverrides
  };
}

test("remote runner verifies public origin, exact deployment identity, and emits a bound bundle", async () => {
  const state = { calls: [] };
  const bundle = await runner.runAICRemoteObservation(runnerInput(jobFor(), { state }));

  assert.equal(bundle.status, "completed");
  assert.equal(bundle.receipt.target.origin, ORIGIN);
  assert.equal(bundle.receipt.target.deployment_id, "dep-1");
  assert.equal(bundle.receipt.target.source_revision, REVISION);
  assert.equal(bundle.receipt.request_count, 2);
  assert.deepEqual(state.calls, [
    { method: "GET", path: "/.well-known/aic-deployment.json" },
    { method: "GET", path: "/complete" }
  ]);
  assert.equal(core.verifyAICEvidenceBundle(bundle).ok, true);

  const tampered = structuredClone(bundle);
  tampered.artifacts[0].content.target_origin = "https://tampered.example";
  assert.equal(core.verifyAICEvidenceBundle(tampered).ok, false);

  const semanticallyIncomplete = structuredClone(bundle);
  semanticallyIncomplete.observations.observations = [];
  semanticallyIncomplete.receipt.observations_digest = core.createAICEvidenceDigest(
    semanticallyIncomplete.observations
  );
  semanticallyIncomplete.receipt_digest = core.createAICEvidenceDigest(
    semanticallyIncomplete.receipt
  );
  const incompleteCheck = core.verifyAICEvidenceBundle(semanticallyIncomplete);
  assert.equal(incompleteCheck.ok, false);
  assert.equal(
    incompleteCheck.findings.some((finding) => finding.code === "observation_coverage_mismatch"),
    true
  );

  const malformed = { ...bundle, receipt: { artifact_type: "aic_evidence_receipt" } };
  assert.doesNotThrow(() => core.verifyAICEvidenceBundle(malformed));
  assert.equal(core.verifyAICEvidenceBundle(malformed).ok, false);
});

test("submitted mutation permission cannot broaden operator capabilities", async () => {
  const mutationJob = jobFor({ mutates: true });
  const state = { calls: [] };
  await assert.rejects(
    runner.runAICRemoteObservation(runnerInput(mutationJob, { state })),
    (error) => error.code === "target_rejected" && /requester and operator grants/.test(error.message)
  );
  assert.equal(state.calls.length, 0);

  await assert.rejects(
    runner.runAICRemoteObservation(runnerInput(mutationJob, {
      state,
      operatorCapabilities: {
        mutations: [{ operation_id: "remote.complete.domain", canary_scope: "tenant:wrong" }]
      }
    })),
    (error) => error.code === "target_rejected"
  );
  assert.equal(state.calls.length, 0);
});

test("matching operator mutation grant executes the canary mutation exactly once", async () => {
  const state = { calls: [] };
  const bundle = await runner.runAICRemoteObservation(runnerInput(jobFor({ mutates: true }), {
    state,
    operatorCapabilities: {
      mutations: [
        { operation_id: "remote.complete.domain", canary_scope: "tenant:aic-canary" }
      ]
    }
  }));
  assert.equal(bundle.status, "completed");
  assert.equal(state.calls.filter((call) => call.path === "/complete").length, 1);
  assert.equal(state.calls.at(-1).method, "POST");
});

test("operator capabilities are strict data and are validated before network access", async () => {
  const state = { calls: [] };
  await assert.rejects(
    runner.runAICRemoteObservation(runnerInput(jobFor(), {
      state,
      operatorCapabilities: {
        mutations: [{ operation_id: "remote.complete.domain", canary_scope: "tenant:aic-canary", extra: true }]
      }
    })),
    (error) => error.code === "plan_invalid" && /capability/.test(error.message)
  );
  assert.equal(state.calls.length, 0);

  await assert.rejects(
    runner.runAICRemoteObservation(runnerInput(jobFor(), {
      state,
      operatorCapabilities: {
        adapter_allowlist: ["@aicorg/evidence-http"],
        max_response_bytes: 50_000,
        max_run_ms: 5_000,
        operation_allowlist: ["remote.complete.domain"]
      }
    })),
    (error) => error.code === "target_rejected" && /operator/.test(error.message)
  );
  assert.equal(state.calls.length, 0);

  await assert.rejects(
    runner.runAICRemoteObservation(runnerInput(jobFor(), {
      state,
      operatorCapabilities: { operation_allowlist: [] }
    })),
    (error) => error.code === "target_rejected" && /operator allowlist/.test(error.message)
  );
  assert.equal(state.calls.length, 0);
});

test("remote runner rejects unsafe IPv4, IPv6, transition, IP-literal, and non-HTTPS targets", async () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.0.2.1",
    "::1",
    "::7f00:1",
    "::ffff:8.8.8.8",
    "64:ff9b::808:808",
    "192.88.99.1",
    "2001:2::1",
    "2001:db8::1",
    "2002:0808:0808::1",
    "3fff::1"
  ]) {
    assert.equal(runner.isAICPublicNetworkAddress(address), false, address);
  }
  assert.equal(runner.isAICPublicNetworkAddress("8.8.8.8"), true);
  assert.equal(runner.isAICPublicNetworkAddress("2606:4700:4700::1111"), true);
  assert.throws(() => runner.validateAICRemoteTargetOrigin("http://service.example"), (error) => error.code === "target_rejected");
  assert.throws(() => runner.validateAICRemoteTargetOrigin("https://127.0.0.1"), (error) => error.code === "target_rejected");
  await assert.rejects(
    runner.resolveAICRemoteTarget({
      origin: ORIGIN,
      dns: async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.1", family: 4 }
      ]
    }),
    (error) => error.code === "target_rejected"
  );
  await assert.rejects(
    runner.resolveAICRemoteTarget({
      origin: ORIGIN,
      dns: async () => [{ address: "93.184.216.34", family: 6 }]
    }),
    (error) => error.code === "target_rejected"
  );
});

test("deployment mismatch fails before an operation adapter can run", async () => {
  const state = { calls: [] };
  await assert.rejects(
    runner.runAICRemoteObservation(runnerInput(jobFor(), {
      state,
      identityValue: identity({ deploymentId: "wrong-deployment" })
    })),
    (error) => error.code === "deployment_mismatch"
  );
  assert.deepEqual(state.calls, [
    { method: "GET", path: "/.well-known/aic-deployment.json" }
  ]);
});

test("receipt identity is unsigned by default and verifiable only with an explicitly pinned runner key", async () => {
  const unsigned = await runner.runAICRemoteObservation(runnerInput(jobFor()));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  const keyId = `sha256:${createHash("sha256").update(publicKey.export({ format: "der", type: "spki" })).digest("hex")}`;
  assert.equal(
    runner.verifyAICRemoteReceiptSignature({ bundle: unsigned, expectedKeyId: keyId, publicKeyPem }).status,
    "unsigned"
  );

  const signedBundle = await runner.runAICRemoteObservation(runnerInput(jobFor(), {
    signer: {
      async sign(canonicalReceipt) {
        return {
          algorithm: "ed25519",
          key_id: keyId,
          value: sign(null, Buffer.from(canonicalReceipt), privateKey).toString("base64")
        };
      }
    }
  }));
  assert.equal(
    runner.verifyAICRemoteReceiptSignature({ bundle: signedBundle, expectedKeyId: keyId, publicKeyPem }).status,
    "trusted"
  );
  assert.equal(
    runner.verifyAICRemoteReceiptSignature({ bundle: signedBundle, expectedKeyId: `sha256:${"0".repeat(64)}`, publicKeyPem }).status,
    "invalid"
  );
});
