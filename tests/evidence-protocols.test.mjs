import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { importWorkspaceModule } from "./helpers.mjs";

const core = await importWorkspaceModule(
  "packages/evidence-core/dist/evidence-core/src/index.js"
);
const httpEvidence = await importWorkspaceModule(
  "packages/evidence-http/dist/evidence-http/src/index.js"
);
const mcpEvidence = await importWorkspaceModule(
  "packages/evidence-mcp/dist/evidence-mcp/src/index.js"
);
const spec = await importWorkspaceModule("packages/spec/dist/index.js");

function contractFor(kind, surfaceId, entrypoint) {
  return {
    artifact_type: "aic_behavior_contract",
    spec: "aic.behavior/0.1",
    id: `example.${surfaceId}.behavior`,
    title: `${surfaceId} behavior`,
    description: "A deterministic protocol evidence fixture.",
    action: {
      id: `example.${surfaceId}`,
      operation_id: "example.complete.domain",
      risk: "high"
    },
    surfaces: [
      {
        id: surfaceId,
        kind,
        label: `${surfaceId} surface`,
        entrypoint
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
        surfaces: [surfaceId],
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

function projection(bodySource) {
  return {
    status: { literal: "succeeded" },
    outcome: { source: bodySource, pointer: "/outcome" },
    checks: [
      {
        requirement_id: "result.ok",
        observed_when: {
          source: bodySource,
          pointer: "/ok",
          operator: "equals",
          value: true
        },
        actual: { source: bodySource, pointer: "/ok" }
      }
    ]
  };
}

function evidencePlan(contract, surface) {
  return {
    artifact_type: "aic_evidence_plan",
    spec: "aic.evidence/0.1",
    id: `${contract.id}.plan`,
    contract: {
      id: contract.id,
      digest: core.createAICEvidenceDigest(contract)
    },
    surfaces: [surface]
  };
}

async function listen(handler) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  return {
    origin,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

function context(contract, plan, origin, overrides = {}) {
  return {
    allowDestructive: false,
    allowedMutationOperations: new Set(),
    contract,
    fetch: globalThis.fetch,
    now: () => new Date("2026-08-29T12:00:00.000Z"),
    plan,
    signal: new AbortController().signal,
    targetOrigin: origin,
    ...overrides
  };
}

test("HTTP/OpenAPI 3.2 evidence produces an executed digest-addressed observation", async (t) => {
  let calls = 0;
  const app = await listen((request, response) => {
    calls += 1;
    assert.equal(request.method, "GET");
    assert.equal(request.url, "/complete");
    response.writeHead(200, { "content-type": "application/json", "x-request-id": "req-1" });
    response.end(JSON.stringify({ ok: true, outcome: { value: "done" } }));
  });
  t.after(app.close);

  const contract = contractFor("openapi", "openapi", "completeOperation");
  const plan = evidencePlan(contract, {
    adapter: "@aicorg/evidence-http",
    surface_id: "openapi",
    openapi: {
      operation_id: "completeOperation",
      document: {
        openapi: "3.2.0",
        info: { title: "fixture", version: "1" },
        paths: {
          "/complete": {
            get: { operationId: "completeOperation", responses: { "200": { description: "ok" } } }
          }
        }
      }
    },
    scenarios: [
      {
        scenario_id: "success",
        mutates: false,
        request: {},
        projection: projection("response.body")
      }
    ]
  });

  assert.equal(spec.validateAICEvidencePlan(plan).ok, true);
  assert.equal(core.validateAICEvidencePlanForContract({ contract, plan }).ok, true);
  const collection = await httpEvidence.collectAICHttpEvidence(context(contract, plan, app.origin));

  assert.equal(calls, 1);
  assert.equal(collection.request_count, 1);
  assert.equal(collection.observations.observations[0].mode, "executed");
  assert.equal(collection.observations.observations[0].status, "succeeded");
  assert.deepEqual(collection.observations.observations[0].outcome, { value: "done" });
  assert.equal(collection.artifacts.length, 1);
  assert.equal(collection.artifacts[0].digest, core.createAICEvidenceDigest(collection.artifacts[0].content));
  assert.equal(collection.observations.observations[0].evidence[0].ref, collection.artifacts[0].ref);
});

test("HTTP evidence rejects external OpenAPI refs, cross-origin servers, and ambiguous operationIds", () => {
  const external = {
    openapi: "3.2.0",
    info: { title: "fixture", version: "1" },
    paths: { "/x": { get: { operationId: "x", responses: { "200": { $ref: "https://evil.example/response.json" } } } } }
  };
  assert.throws(
    () => httpEvidence.resolveAICOpenAPIOperation(external, "x", "https://safe.example"),
    (error) => error.code === "plan_invalid"
  );
  const crossOrigin = structuredClone(external);
  crossOrigin.paths["/x"].get.responses["200"] = { description: "ok" };
  crossOrigin.servers = [{ url: "https://evil.example" }];
  assert.throws(
    () => httpEvidence.resolveAICOpenAPIOperation(crossOrigin, "x", "https://safe.example"),
    (error) => error.code === "target_rejected"
  );
  const duplicate = structuredClone(crossOrigin);
  delete duplicate.servers;
  duplicate.paths["/y"] = { post: { operationId: "x", responses: {} } };
  assert.throws(
    () => httpEvidence.resolveAICOpenAPIOperation(duplicate, "x", "https://safe.example"),
    (error) => error.code === "plan_invalid"
  );
});

test("mutating HTTP transport failure is uncertain and is never retried", async () => {
  const contract = contractFor("openapi", "openapi", "completeOperation");
  const plan = evidencePlan(contract, {
    adapter: "@aicorg/evidence-http",
    surface_id: "openapi",
    scenarios: [
      {
        scenario_id: "success",
        mutates: true,
        request: { method: "POST", path: "/complete", body: { value: 1 } },
        projection: projection("response.body")
      }
    ]
  });
  let calls = 0;
  await assert.rejects(
    httpEvidence.collectAICHttpEvidence(context(contract, plan, "https://safe.example", {
      allowedMutationOperations: new Set([contract.action.operation_id]),
      fetch: async () => {
        calls += 1;
        throw new Error("connection lost after dispatch");
      }
    })),
    (error) => error.code === "outcome_uncertain" && error.execution === "uncertain"
  );
  assert.equal(calls, 1);
});

test("HTTP evidence redacts resolved secrets and treats an unverifiable mutation response as uncertain", async () => {
  const contract = contractFor("openapi", "openapi", "completeOperation");
  const readPlan = evidencePlan(contract, {
    adapter: "@aicorg/evidence-http",
    surface_id: "openapi",
    scenarios: [
      {
        scenario_id: "success",
        mutates: false,
        request: {
          method: "GET",
          path: "/complete",
          headers: {
            authorization: { secret_ref: "service-token" },
            "x-visible": "visible"
          }
        },
        projection: projection("response.body")
      }
    ]
  });
  const collection = await httpEvidence.collectAICHttpEvidence(
    context(contract, readPlan, "https://safe.example", {
      credentials: (reference) => {
        assert.equal(reference, "service-token");
        return "Bearer top-secret";
      },
      fetch: async (_url, init) => {
        assert.equal(init.headers.authorization, "Bearer top-secret");
        return new Response(JSON.stringify({ ok: true, outcome: { value: "done" } }), {
          headers: { "content-type": "application/json" },
          status: 200
        });
      }
    })
  );
  const transcript = JSON.stringify(collection.artifacts[0].content);
  assert.equal(transcript.includes("top-secret"), false);
  assert.equal(transcript.includes("[REDACTED]"), true);
  assert.equal(transcript.includes("visible"), true);

  const mutationPlan = structuredClone(readPlan);
  mutationPlan.surfaces[0].scenarios[0].mutates = true;
  mutationPlan.surfaces[0].scenarios[0].request.method = "POST";
  let calls = 0;
  await assert.rejects(
    httpEvidence.collectAICHttpEvidence(
      context(contract, mutationPlan, "https://safe.example", {
        allowedMutationOperations: new Set([contract.action.operation_id]),
        credentials: () => "Bearer top-secret",
        fetch: async () => {
          calls += 1;
          return new Response("not-json", {
            headers: { "content-type": "text/plain" },
            status: 200
          });
        }
      })
    ),
    (error) => error.code === "outcome_uncertain" && error.execution === "uncertain"
  );
  assert.equal(calls, 1);
});

test("evidence plans fail closed when projected requirements are incomplete", () => {
  const contract = contractFor("openapi", "openapi", "completeOperation");
  const plan = evidencePlan(contract, {
    adapter: "@aicorg/evidence-http",
    surface_id: "openapi",
    scenarios: [
      {
        scenario_id: "success",
        mutates: false,
        request: { method: "GET", path: "/complete" },
        projection: { status: { literal: "succeeded" }, checks: [] }
      }
    ]
  });
  const validation = core.validateAICEvidencePlanForContract({ contract, plan });
  assert.equal(validation.ok, false);
  assert.equal(validation.findings.some((finding) => finding.code === "projection_requirement_mismatch"), true);
});

test("stateless MCP 2026-07-28 emits required metadata headers and x-mcp-header values", async (t) => {
  const requests = [];
  const app = await listen(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    requests.push({ body, headers: request.headers });
    assert.equal(request.method, "POST");
    assert.equal(request.headers["mcp-protocol-version"], "2026-07-28");
    assert.equal(request.headers["mcp-method"], body.method);
    assert.equal(body.params._meta["io.modelcontextprotocol/protocolVersion"], "2026-07-28");
    if (body.method === "tools/list") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          tools: [
            {
              name: "complete_operation",
              annotations: { readOnlyHint: true },
              inputSchema: {
                type: "object",
                additionalProperties: false,
                required: ["region"],
                properties: {
                  region: { type: "string", "x-mcp-header": "Region" }
                }
              },
              outputSchema: {
                type: "object",
                additionalProperties: false,
                required: ["ok", "outcome"],
                properties: {
                  ok: { type: "boolean" },
                  outcome: {
                    type: "object",
                    additionalProperties: false,
                    required: ["value"],
                    properties: { value: { type: "string" } }
                  }
                }
              }
            }
          ]
        }
      }));
      return;
    }
    assert.equal(request.headers["mcp-name"], "complete_operation");
    assert.equal(request.headers["mcp-param-region"], "us-east-1");
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        content: [{ type: "text", text: JSON.stringify({ ok: true, outcome: { value: "done" } }) }],
        structuredContent: { ok: true, outcome: { value: "done" } },
        isError: false
      }
    }));
  });
  t.after(app.close);

  const contract = contractFor("mcp", "mcp", "complete_operation");
  const plan = evidencePlan(contract, {
    adapter: "@aicorg/evidence-mcp",
    surface_id: "mcp",
    endpoint: "/mcp",
    scenarios: [
      {
        scenario_id: "success",
        mutates: false,
        tool_name: "complete_operation",
        arguments: { region: "us-east-1" },
        projection: projection("mcp.structured_content")
      }
    ]
  });
  const collection = await mcpEvidence.collectAICMcpEvidence(context(contract, plan, app.origin));

  assert.equal(requests.length, 2);
  assert.equal(collection.request_count, 2);
  assert.equal(collection.adapter.protocol_version, "2026-07-28");
  assert.equal(collection.observations.observations[0].status, "succeeded");
});

test("injected MCP caller is pinned, requires read-only annotation, and mutating failures are called once", async () => {
  assert.throws(
    () => mcpEvidence.createAICMcpInjectedCaller({ protocolVersion: "2025-11-25", listTools: async () => [], callTool: async () => ({}) }),
    (error) => error.code === "tool_mismatch"
  );

  const contract = contractFor("mcp", "mcp", "complete_operation");
  const plan = evidencePlan(contract, {
    adapter: "@aicorg/evidence-mcp",
    surface_id: "mcp",
    endpoint: "/mcp",
    scenarios: [
      {
        scenario_id: "success",
        mutates: true,
        tool_name: "complete_operation",
        arguments: {},
        projection: projection("mcp.structured_content")
      }
    ]
  });
  let calls = 0;
  const caller = mcpEvidence.createAICMcpInjectedCaller({
    protocolVersion: "2026-07-28",
    listTools: async () => [
      { name: "complete_operation", inputSchema: { type: "object" }, annotations: { readOnlyHint: false } }
    ],
    callTool: async () => {
      calls += 1;
      throw new Error("response lost");
    }
  });
  await assert.rejects(
    mcpEvidence.collectAICMcpEvidence(
      context(contract, plan, "https://safe.example", {
        allowedMutationOperations: new Set([contract.action.operation_id])
      }),
      () => caller
    ),
    (error) => error.code === "outcome_uncertain" && error.execution === "uncertain"
  );
  assert.equal(calls, 1);
});

test("MCP read-only evidence fails closed without explicit readOnlyHint", async () => {
  const contract = contractFor("mcp", "mcp", "complete_operation");
  const plan = evidencePlan(contract, {
    adapter: "@aicorg/evidence-mcp",
    surface_id: "mcp",
    endpoint: "/mcp",
    scenarios: [
      {
        scenario_id: "success",
        mutates: false,
        tool_name: "complete_operation",
        arguments: {},
        projection: projection("mcp.structured_content")
      }
    ]
  });
  const caller = mcpEvidence.createAICMcpInjectedCaller({
    protocolVersion: "2026-07-28",
    listTools: async () => [{ name: "complete_operation", inputSchema: { type: "object" } }],
    callTool: async () => ({ structuredContent: { ok: true, outcome: { value: "done" } } })
  });
  await assert.rejects(
    mcpEvidence.collectAICMcpEvidence(context(contract, plan, "https://safe.example"), () => caller),
    (error) => error.code === "tool_mismatch"
  );
});

test("injected MCP calls enforce schemas before and after the single call", async () => {
  const contract = contractFor("mcp", "mcp", "complete_operation");
  const makePlan = (argumentsValue, mutates = false) => evidencePlan(contract, {
    adapter: "@aicorg/evidence-mcp",
    surface_id: "mcp",
    endpoint: "/mcp",
    scenarios: [
      {
        scenario_id: "success",
        mutates,
        tool_name: "complete_operation",
        arguments: argumentsValue,
        projection: projection("mcp.structured_content")
      }
    ]
  });
  const tool = {
    name: "complete_operation",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["region"],
      properties: { region: { type: "string", minLength: 3 } }
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "outcome"],
      properties: {
        ok: { type: "boolean" },
        outcome: { type: "object" }
      }
    }
  };
  let calls = 0;
  const caller = mcpEvidence.createAICMcpInjectedCaller({
    protocolVersion: "2026-07-28",
    listTools: async () => [tool],
    callTool: async () => {
      calls += 1;
      return { structuredContent: { ok: "yes", outcome: { value: "done" } } };
    }
  });
  await assert.rejects(
    mcpEvidence.collectAICMcpEvidence(
      context(contract, makePlan({ region: "x" }), "https://safe.example"),
      () => caller
    ),
    (error) => error.code === "tool_mismatch" && error.execution === "not_started"
  );
  assert.equal(calls, 0);

  await assert.rejects(
    mcpEvidence.collectAICMcpEvidence(
      context(contract, makePlan({ region: "use" }, true), "https://safe.example", {
        allowedMutationOperations: new Set([contract.action.operation_id])
      }),
      () => caller
    ),
    (error) => error.code === "outcome_uncertain" && error.execution === "uncertain"
  );
  assert.equal(calls, 1);
});
