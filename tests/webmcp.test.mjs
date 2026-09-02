import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { importWorkspaceModule } from "./helpers.mjs";

const runtime = await importWorkspaceModule("packages/runtime/dist/runtime/src/index.js");
const webmcp = await importWorkspaceModule("packages/webmcp/dist/webmcp/src/index.js");
const automation = await importWorkspaceModule(
  "packages/automation-core/dist/automation-core/src/index.js"
);

const NEWLINE = String.fromCharCode(10);

function createReadyBinding(overrides = {}) {
  const registry = overrides.registry ?? new runtime.AICRegistry();
  const element = {
    actions: [
      {
        contract_ref: "checkout.complete",
        name: "submit",
        target: "checkout.submit_order",
        type: "semantic_action"
      }
    ],
    confirmation: {
      prompt_template: "Charge {{order_total}} for order {{order_id}}?",
      summary_fields: ["order_total", "order_id"],
      type: "human_review"
    },
    description: "Complete the current checkout",
    effects: ["payment.charge", "order.status=submitted"],
    entity_ref: {
      entity_id: "ord_100245",
      entity_label: "Order #100245",
      entity_type: "order"
    },
    id: "checkout.submit_order",
    label: "Submit order",
    permissions: ["checkout.submit_order"],
    requires_confirmation: true,
    risk: "critical",
    role: "button",
    state: {
      enabled: true,
      visible: true
    }
  };
  const action = {
    completion_signal: {
      type: "state_change",
      value: "order.status = submitted"
    },
    estimated_latency_ms: 1000,
    execution_readiness: {
      reviewed_at: "2026-08-28T00:00:00.000Z",
      reviewed_by: "checkout-team",
      source: "authored",
      status: "execution_ready"
    },
    failure_modes: ["payment_declined", "order_conflict"],
    idempotent: false,
    name: "checkout.complete",
    postconditions: ["order.status = submitted"],
    preconditions: ["order.status = draft"],
    side_effects: ["payment.charge", "order.status=submitted"],
    target: "checkout.submit_order",
    title: "Complete checkout",
    undoable: false
  };

  return {
    action,
    authorize: async (input) => input.order_id === "ord_100245",
    confirm: async () => true,
    element,
    execute: async (input) => ({ order_id: input.order_id, status: "submitted" }),
    registry,
    tool: {
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: false
      },
      description: "Validate and complete the currently displayed checkout after human confirmation.",
      inputSchema: {
        additionalProperties: false,
        properties: {
          order_id: { type: "string" },
          order_total: { type: "string" }
        },
        required: ["order_id", "order_total"],
        type: "object"
      },
      name: "complete_checkout",
      title: "Complete checkout"
    },
    validate: async (input) => {
      if (typeof input.order_id !== "string" || typeof input.order_total !== "string") {
        throw new Error("Invalid checkout input.");
      }
    },
    verify: async (result) => result.status === "submitted",
    ...overrides
  };
}

test("auditAICWebMCPTool blocks inferred and placeholder action contracts", () => {
  const binding = createReadyBinding();
  binding.action = {
    ...binding.action,
    completion_signal: {
      type: "custom",
      value: "review_required"
    },
    execution_readiness: {
      blockers: ["review semantics"],
      source: "inferred",
      status: "review_required"
    },
    failure_modes: ["review_required"]
  };

  const report = webmcp.auditAICWebMCPTool(binding);

  assert.equal(report.ready, false);
  assert.ok(report.findings.some((finding) => finding.code === "action_not_execution_ready"));
  assert.ok(report.findings.some((finding) => finding.code === "action_not_authored"));
  assert.ok(report.findings.some((finding) => finding.code === "verifiable_completion_missing"));
});

test("auditAICWebMCPTool rejects execution-ready labels that retain review blockers", () => {
  const binding = createReadyBinding();
  binding.action = {
    ...binding.action,
    execution_readiness: {
      blockers: ["security review remains open"],
      source: "authored",
      status: "execution_ready"
    }
  };

  const report = webmcp.auditAICWebMCPTool(binding);

  assert.equal(report.ready, false);
  assert.ok(report.findings.some((finding) => finding.code === "action_not_execution_ready"));
});

test("registerAICWebMCPTool degrades safely when document.modelContext is unavailable", async () => {
  const registration = await webmcp.registerAICWebMCPTool(createReadyBinding());

  assert.equal(registration.status, "unsupported");
  assert.equal(registration.readiness.ready, true);
  registration.dispose();
});

test("registerAICWebMCPTool enforces the AIC execution lifecycle around the native tool", async () => {
  const events = [];
  const confirmations = [];
  let nativeTool;
  let registrationOptions;
  const registry = new runtime.AICRegistry();
  registry.subscribe((event) => events.push(event));
  const binding = createReadyBinding({
    confirm: async (request) => {
      confirmations.push(request);
      return true;
    },
    registry
  });
  registry.register({
    element: binding.element,
    instanceId: "checkout.submit_order:1",
    source: "authored"
  });

  const registration = await webmcp.registerAICWebMCPTool(binding, {
    modelContext: {
      async registerTool(tool, options) {
        nativeTool = tool;
        registrationOptions = options;
      }
    }
  });

  assert.equal(registration.status, "registered");
  assert.equal(registrationOptions.signal.aborted, false);
  const executionController = new AbortController();
  const result = await nativeTool.execute(
    { order_id: "ord_100245", order_total: "$177.00" },
    { signal: executionController.signal }
  );

  assert.deepEqual(result, { order_id: "ord_100245", status: "submitted" });
  assert.equal(confirmations[0].prompt, "Charge $177.00 for order ord_100245?");
  assert.deepEqual(confirmations[0].summary, {
    order_id: "ord_100245",
    order_total: "$177.00"
  });
  assert.deepEqual(
    events.filter((event) => event.type.startsWith("action_")).map((event) => event.type),
    ["action_started", "action_completed"]
  );

  registration.dispose();
  assert.equal(registrationOptions.signal.aborted, true);
});

test("native WebMCP execution tolerates draft browsers that omit callback options", async () => {
  let nativeTool;
  const registration = await webmcp.registerAICWebMCPTool(createReadyBinding(), {
    modelContext: {
      async registerTool(tool) {
        nativeTool = tool;
      }
    }
  });

  const result = await nativeTool.execute({
    order_id: "ord_100245",
    order_total: "$177.00"
  });

  assert.deepEqual(result, { order_id: "ord_100245", status: "submitted" });
  registration.dispose();
});

test("critical WebMCP execution fails closed when authorization is denied", async () => {
  const events = [];
  let nativeTool;
  const registry = new runtime.AICRegistry();
  registry.subscribe((event) => events.push(event));
  const binding = createReadyBinding({
    authorize: async () => false,
    registry
  });

  await webmcp.registerAICWebMCPTool(binding, {
    modelContext: {
      async registerTool(tool) {
        nativeTool = tool;
      }
    }
  });

  await assert.rejects(
    nativeTool.execute(
      { order_id: "ord_wrong", order_total: "$177.00" },
      { signal: new AbortController().signal }
    ),
    (error) => error.code === "authorization_denied"
  );
  assert.equal(events.at(-1).type, "action_failed");
  assert.equal(events.at(-1).payload.error_code, "authorization_denied");
});

test("critical WebMCP execution stops when human confirmation is declined", async () => {
  let nativeTool;
  await webmcp.registerAICWebMCPTool(
    createReadyBinding({ confirm: async () => false }),
    {
      modelContext: {
        async registerTool(tool) {
          nativeTool = tool;
        }
      }
    }
  );

  await assert.rejects(
    nativeTool.execute(
      { order_id: "ord_100245", order_total: "$177.00" },
      { signal: new AbortController().signal }
    ),
    (error) => error.code === "confirmation_declined"
  );
});

test("mutating WebMCP execution fails when the declared completion cannot be verified", async () => {
  let nativeTool;
  await webmcp.registerAICWebMCPTool(
    createReadyBinding({ verify: async () => false }),
    {
      modelContext: {
        async registerTool(tool) {
          nativeTool = tool;
        }
      }
    }
  );

  await assert.rejects(
    nativeTool.execute(
      { order_id: "ord_100245", order_total: "$177.00" },
      { signal: new AbortController().signal }
    ),
    (error) => error.code === "verification_failed"
  );
});

test("WebMCP execution respects browser cancellation before application mutation", async () => {
  let executed = false;
  let nativeTool;
  await webmcp.registerAICWebMCPTool(
    createReadyBinding({
      execute: async () => {
        executed = true;
        return { order_id: "ord_100245", status: "submitted" };
      }
    }),
    {
      modelContext: {
        async registerTool(tool) {
          nativeTool = tool;
        }
      }
    }
  );
  const execution = new AbortController();
  execution.abort();

  await assert.rejects(
    nativeTool.execute(
      { order_id: "ord_100245", order_total: "$177.00" },
      { signal: execution.signal }
    ),
    (error) => error.code === "execution_aborted"
  );
  assert.equal(executed, false);
});

test("registration blocks insecure cross-origin exposure", async () => {
  await assert.rejects(
    webmcp.registerAICWebMCPTool(createReadyBinding(), {
      exposedTo: ["http://partner.example"],
      modelContext: {
        async registerTool() {}
      }
    }),
    (error) => error.code === "registration_blocked"
  );
});

test("source readiness detects third-party WebMCP wrapper registrations", async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), "aic-webmcp-wrapper-test-"));

  try {
    await writeFile(
      resolve(workspace, "Tools.tsx"),
      [
        'import { useWebMCP } from "use-webmcp-tool";',
        "",
        "export function Tools() {",
        "  useWebMCP({",
        '    name: "checkout",',
        '    description: "Place the order. Irreversible.",',
        "    inputSchema: {},",
        "    annotations: { readOnlyHint: false },",
        "    execute: async () => placeOrder()",
        "  });",
        "  return null;",
        "}",
        ""
      ].join(NEWLINE),
      "utf8"
    );

    const report = await automation.analyzeProjectForWebMCPReadiness(workspace);

    // A wrapper registration is a real, current registration. Reporting it as
    // "not detected" would hide every tool in a typical WebMCP app.
    assert.equal(report.status, "review_needed");
    assert.equal(report.summary.current_native_registrations, 1);
    assert.equal(report.summary.direct_native_registrations, 1);
    assert.equal(report.summary.governed_registrations, 0);
    assert.equal(report.summary.obsolete_api_usages, 0);
    assert.equal(
      report.findings.filter((finding) => finding.code === "direct_native_registration").length,
      1
    );
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
});

test("source readiness does not count governed AIC bindings as ungoverned", async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), "aic-webmcp-governed-test-"));

  try {
    await writeFile(
      resolve(workspace, "Governed.tsx"),
      [
        'import { useAICWebMCPTool } from "@aicorg/webmcp/react";',
        "",
        "export function Governed() {",
        "  useAICWebMCPTool(() => binding, []);",
        "  return null;",
        "}",
        ""
      ].join(NEWLINE),
      "utf8"
    );

    const report = await automation.analyzeProjectForWebMCPReadiness(workspace);

    assert.equal(report.summary.governed_registrations, 1);
    assert.equal(report.summary.direct_native_registrations, 0);
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
});
