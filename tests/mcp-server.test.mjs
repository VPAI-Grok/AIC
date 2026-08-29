import assert from "node:assert/strict";
import test from "node:test";

import { importWorkspaceModule } from "./helpers.mjs";

// Import built modules from dist (after pnpm build)
const fetchManifestModule = await importWorkspaceModule(
  "packages/mcp-server/dist/mcp-server/src/fetch-manifest.js"
);
const { resolveEndpointUrl, resolveAllEndpoints } = fetchManifestModule;

// ── resolveEndpointUrl ─────────────────────────────────────────────────

test("resolveEndpointUrl uses fallback when path is undefined", () => {
  const result = resolveEndpointUrl("http://localhost:3000", undefined, "/.well-known/agent.json");
  assert.equal(result, "http://localhost:3000/.well-known/agent.json");
});

test("resolveEndpointUrl uses custom path when provided", () => {
  const result = resolveEndpointUrl("http://localhost:3000", "/custom/ui", "/.well-known/agent/ui");
  assert.equal(result, "http://localhost:3000/custom/ui");
});

test("resolveEndpointUrl strips trailing slashes from base URL", () => {
  const result = resolveEndpointUrl("http://localhost:3000///", undefined, "/.well-known/agent.json");
  assert.equal(result, "http://localhost:3000/.well-known/agent.json");
});

test("resolveEndpointUrl returns absolute URL paths as-is", () => {
  const result = resolveEndpointUrl(
    "http://localhost:3000",
    "https://cdn.example.com/manifests/ui.json",
    "/.well-known/agent/ui"
  );
  assert.equal(result, "https://cdn.example.com/manifests/ui.json");
});

test("resolveEndpointUrl handles paths without leading slash", () => {
  const result = resolveEndpointUrl("http://localhost:3000", "api/ui", "/.well-known/agent/ui");
  assert.equal(result, "http://localhost:3000/api/ui");
});

// ── resolveAllEndpoints ────────────────────────────────────────────────

test("resolveAllEndpoints resolves all four default endpoints", () => {
  const endpoints = resolveAllEndpoints("http://localhost:3000", {});
  assert.equal(endpoints.actions, "http://localhost:3000/.well-known/agent/actions");
  assert.equal(endpoints.permissions, "http://localhost:3000/agent-permissions.json");
  assert.equal(endpoints.ui, "http://localhost:3000/.well-known/agent/ui");
  assert.equal(endpoints.workflows, "http://localhost:3000/agent-workflows.json");
});

test("resolveAllEndpoints respects custom endpoint paths", () => {
  const endpoints = resolveAllEndpoints("http://example.com", {
    actions: "/api/aic/actions",
    permissions: "/api/aic/permissions",
    ui: "/api/aic/ui",
    workflows: "/api/aic/workflows"
  });
  assert.equal(endpoints.actions, "http://example.com/api/aic/actions");
  assert.equal(endpoints.permissions, "http://example.com/api/aic/permissions");
  assert.equal(endpoints.ui, "http://example.com/api/aic/ui");
  assert.equal(endpoints.workflows, "http://example.com/api/aic/workflows");
});

test("resolveAllEndpoints handles partial custom endpoints", () => {
  const endpoints = resolveAllEndpoints("http://localhost:3000", {
    ui: "/custom/ui"
  });
  assert.equal(endpoints.ui, "http://localhost:3000/custom/ui");
  assert.equal(endpoints.actions, "http://localhost:3000/.well-known/agent/actions");
  assert.equal(endpoints.permissions, "http://localhost:3000/agent-permissions.json");
  assert.equal(endpoints.workflows, "http://localhost:3000/agent-workflows.json");
});

// ── list-elements filtering ────────────────────────────────────────────

// Import list-elements tool internals via the built dist
// Since matchesQuery and isActionable are not exported, we test them
// through the handler by mocking globalThis.fetch

const savedFetch = globalThis.fetch;

function mockFetch(responses) {
  let callIndex = 0;
  globalThis.fetch = async (url) => {
    const key = Object.keys(responses).find((k) => String(url).includes(k));
    if (key) {
      const body = responses[key];
      if (body === null) {
        return { ok: false, status: 404, statusText: "Not Found" };
      }
      return {
        ok: true,
        status: 200,
        json: async () => body
      };
    }
    return { ok: false, status: 404, statusText: "Not Found" };
  };
}

function restoreFetch() {
  globalThis.fetch = savedFetch;
}

const sampleElements = [
  {
    id: "btn-submit-order",
    role: "button",
    label: "Submit Order",
    description: "Confirm and submit the checkout order",
    risk: "critical",
    entity_ref: { entity_type: "order", entity_id: "order-123" },
    state: { enabled: true, visible: true }
  },
  {
    id: "btn-save-draft",
    role: "button",
    label: "Save Draft",
    description: "Save the current draft",
    risk: "low",
    state: { enabled: true, visible: true }
  },
  {
    id: "input-coupon",
    role: "input",
    label: "Coupon Code",
    description: "Enter a discount coupon",
    risk: "low",
    state: { enabled: true, visible: true }
  },
  {
    id: "btn-disabled",
    role: "button",
    label: "Disabled Button",
    risk: "low",
    state: { enabled: false, visible: true }
  },
  {
    id: "btn-hidden",
    role: "button",
    label: "Hidden Button",
    risk: "low",
    state: { hidden: true }
  },
  {
    id: "btn-archive-invoice",
    role: "button",
    label: "Archive",
    description: "Archive this invoice permanently",
    risk: "high",
    entity_ref: { entity_type: "invoice", entity_id: "inv-456" },
    state: { enabled: true, visible: true }
  }
];

const sampleUiManifest = {
  page: { url: "http://localhost:3000/checkout", title: "Checkout" },
  elements: sampleElements
};

const sampleDiscovery = {
  app: { name: "test-app", version: "1.0.0" },
  spec: { version: "1.0.0" },
  endpoints: {}
};

test("list_aic_elements filters by role", async (t) => {
  t.after(restoreFetch);
  mockFetch({
    "agent.json": sampleDiscovery,
    "agent/ui": sampleUiManifest
  });

  const listModule = await importWorkspaceModule(
    "packages/mcp-server/dist/mcp-server/src/tools/list-elements.js"
  );

  const result = JSON.parse(
    await listModule.handleListElements({
      base_url: "http://localhost:3000",
      role: "input"
    })
  );

  assert.equal(result.success, true);
  assert.equal(result.total_matches, 1);
  assert.equal(result.elements[0].id, "input-coupon");
});

test("list_aic_elements filters by risk", async (t) => {
  t.after(restoreFetch);
  mockFetch({
    "agent.json": sampleDiscovery,
    "agent/ui": sampleUiManifest
  });

  const listModule = await importWorkspaceModule(
    "packages/mcp-server/dist/mcp-server/src/tools/list-elements.js"
  );

  const result = JSON.parse(
    await listModule.handleListElements({
      base_url: "http://localhost:3000",
      risk: "critical"
    })
  );

  assert.equal(result.success, true);
  assert.equal(result.total_matches, 1);
  assert.equal(result.elements[0].id, "btn-submit-order");
});

test("list_aic_elements filters by entity_type", async (t) => {
  t.after(restoreFetch);
  mockFetch({
    "agent.json": sampleDiscovery,
    "agent/ui": sampleUiManifest
  });

  const listModule = await importWorkspaceModule(
    "packages/mcp-server/dist/mcp-server/src/tools/list-elements.js"
  );

  const result = JSON.parse(
    await listModule.handleListElements({
      base_url: "http://localhost:3000",
      entity_type: "invoice"
    })
  );

  assert.equal(result.success, true);
  assert.equal(result.total_matches, 1);
  assert.equal(result.elements[0].id, "btn-archive-invoice");
});

test("list_aic_elements filters by query text", async (t) => {
  t.after(restoreFetch);
  mockFetch({
    "agent.json": sampleDiscovery,
    "agent/ui": sampleUiManifest
  });

  const listModule = await importWorkspaceModule(
    "packages/mcp-server/dist/mcp-server/src/tools/list-elements.js"
  );

  const result = JSON.parse(
    await listModule.handleListElements({
      base_url: "http://localhost:3000",
      query: "coupon"
    })
  );

  assert.equal(result.success, true);
  assert.equal(result.total_matches, 1);
  assert.equal(result.elements[0].id, "input-coupon");
});

test("list_aic_elements hides disabled and hidden elements by default", async (t) => {
  t.after(restoreFetch);
  mockFetch({
    "agent.json": sampleDiscovery,
    "agent/ui": sampleUiManifest
  });

  const listModule = await importWorkspaceModule(
    "packages/mcp-server/dist/mcp-server/src/tools/list-elements.js"
  );

  const result = JSON.parse(
    await listModule.handleListElements({
      base_url: "http://localhost:3000"
    })
  );

  assert.equal(result.success, true);
  // 6 total elements minus 2 non-actionable (disabled + hidden) = 4
  assert.equal(result.total_matches, 4);
  const ids = result.elements.map((e) => e.id);
  assert.equal(ids.includes("btn-disabled"), false);
  assert.equal(ids.includes("btn-hidden"), false);
});

test("list_aic_elements shows all elements when actionable_only is false", async (t) => {
  t.after(restoreFetch);
  mockFetch({
    "agent.json": sampleDiscovery,
    "agent/ui": sampleUiManifest
  });

  const listModule = await importWorkspaceModule(
    "packages/mcp-server/dist/mcp-server/src/tools/list-elements.js"
  );

  const result = JSON.parse(
    await listModule.handleListElements({
      base_url: "http://localhost:3000",
      actionable_only: false
    })
  );

  assert.equal(result.success, true);
  assert.equal(result.total_matches, 6);
});

test("list_aic_elements respects limit and reports truncation", async (t) => {
  t.after(restoreFetch);
  mockFetch({
    "agent.json": sampleDiscovery,
    "agent/ui": sampleUiManifest
  });

  const listModule = await importWorkspaceModule(
    "packages/mcp-server/dist/mcp-server/src/tools/list-elements.js"
  );

  const result = JSON.parse(
    await listModule.handleListElements({
      base_url: "http://localhost:3000",
      actionable_only: false,
      limit: 2
    })
  );

  assert.equal(result.success, true);
  assert.equal(result.total_matches, 6);
  assert.equal(result.returned, 2);
  assert.equal(result.truncated, true);
});

test("list_aic_elements combines multiple filters", async (t) => {
  t.after(restoreFetch);
  mockFetch({
    "agent.json": sampleDiscovery,
    "agent/ui": sampleUiManifest
  });

  const listModule = await importWorkspaceModule(
    "packages/mcp-server/dist/mcp-server/src/tools/list-elements.js"
  );

  const result = JSON.parse(
    await listModule.handleListElements({
      base_url: "http://localhost:3000",
      role: "button",
      risk: "high"
    })
  );

  assert.equal(result.success, true);
  assert.equal(result.total_matches, 1);
  assert.equal(result.elements[0].id, "btn-archive-invoice");
});

// ── discover_aic_app ───────────────────────────────────────────────────

test("discover_aic_app returns success with valid discovery manifest", async (t) => {
  t.after(restoreFetch);
  mockFetch({
    "agent.json": sampleDiscovery
  });

  const discoverModule = await importWorkspaceModule(
    "packages/mcp-server/dist/mcp-server/src/tools/discover.js"
  );

  const result = JSON.parse(
    await discoverModule.handleDiscover({ base_url: "http://localhost:3000" })
  );

  assert.equal(result.success, true);
  assert.equal(result.app.name, "test-app");
  assert.ok(result.endpoints);
  assert.ok(result.validation);
});

test("discover_aic_app returns failure for unreachable app", async (t) => {
  t.after(restoreFetch);
  globalThis.fetch = async () => {
    throw new Error("ECONNREFUSED");
  };

  const discoverModule = await importWorkspaceModule(
    "packages/mcp-server/dist/mcp-server/src/tools/discover.js"
  );

  const result = JSON.parse(
    await discoverModule.handleDiscover({ base_url: "http://localhost:9999" })
  );

  assert.equal(result.success, false);
  assert.ok(result.error.includes("ECONNREFUSED"));
  assert.ok(result.hint);
});

// ── get_aic_ui_state ───────────────────────────────────────────────────

test("get_aic_ui_state returns full UI manifest", async (t) => {
  t.after(restoreFetch);
  mockFetch({
    "agent.json": sampleDiscovery,
    "agent/ui": sampleUiManifest
  });

  const uiModule = await importWorkspaceModule(
    "packages/mcp-server/dist/mcp-server/src/tools/ui-state.js"
  );

  const result = JSON.parse(
    await uiModule.handleUiState({ base_url: "http://localhost:3000" })
  );

  assert.equal(result.success, true);
  assert.equal(result.element_count, 6);
  assert.ok(Array.isArray(result.elements));
  assert.ok(result.validation);
});

test("get_aic_ui_state returns error when UI endpoint fails", async (t) => {
  t.after(restoreFetch);
  mockFetch({
    "agent.json": sampleDiscovery
    // No UI endpoint mock — will return 404
  });

  const uiModule = await importWorkspaceModule(
    "packages/mcp-server/dist/mcp-server/src/tools/ui-state.js"
  );

  const result = JSON.parse(
    await uiModule.handleUiState({ base_url: "http://localhost:3000" })
  );

  assert.equal(result.success, false);
  assert.ok(result.error);
  assert.ok(result.hint);
});

// ── get_aic_workflows ──────────────────────────────────────────────────

test("get_aic_workflows filters by workflow_id", async (t) => {
  t.after(restoreFetch);

  const sampleWorkflows = {
    workflows: [
      {
        id: "checkout-flow",
        title: "Checkout",
        steps: [{ id: "step-1", title: "Cart Review" }],
        entry_points: ["cart-page"]
      },
      {
        id: "onboarding",
        title: "Onboarding",
        steps: [{ id: "step-1", title: "Welcome" }],
        entry_points: ["home"]
      }
    ]
  };

  mockFetch({
    "agent.json": sampleDiscovery,
    "agent-workflows.json": sampleWorkflows
  });

  const workflowModule = await importWorkspaceModule(
    "packages/mcp-server/dist/mcp-server/src/tools/workflows.js"
  );

  const result = JSON.parse(
    await workflowModule.handleWorkflows({
      base_url: "http://localhost:3000",
      workflow_id: "checkout-flow"
    })
  );

  assert.equal(result.success, true);
  assert.equal(result.workflow_count, 1);
  assert.equal(result.workflows[0].id, "checkout-flow");
});

test("get_aic_workflows returns error for unknown workflow_id", async (t) => {
  t.after(restoreFetch);

  mockFetch({
    "agent.json": sampleDiscovery,
    "agent-workflows.json": { workflows: [{ id: "existing", title: "A", steps: [], entry_points: [] }] }
  });

  const workflowModule = await importWorkspaceModule(
    "packages/mcp-server/dist/mcp-server/src/tools/workflows.js"
  );

  const result = JSON.parse(
    await workflowModule.handleWorkflows({
      base_url: "http://localhost:3000",
      workflow_id: "nonexistent"
    })
  );

  assert.equal(result.success, false);
  assert.ok(result.available_workflows.includes("existing"));
});

// ── get_aic_actions ────────────────────────────────────────────────────

test("get_aic_actions filters by action_name", async (t) => {
  t.after(restoreFetch);

  const sampleActions = {
    actions: [
      {
        name: "submit_order",
        title: "Submit Order",
        target: "api",
        preconditions: [],
        postconditions: [],
        side_effects: [],
        failure_modes: [],
        idempotent: false,
        undoable: false,
        estimated_latency_ms: 500,
        completion_signal: "order_confirmed"
      },
      {
        name: "archive_customer",
        title: "Archive Customer",
        target: "api",
        preconditions: [],
        postconditions: [],
        side_effects: [],
        failure_modes: [],
        idempotent: true,
        undoable: true,
        estimated_latency_ms: 200,
        completion_signal: "customer_archived"
      }
    ]
  };

  mockFetch({
    "agent.json": sampleDiscovery,
    "agent/actions": sampleActions
  });

  const actionsModule = await importWorkspaceModule(
    "packages/mcp-server/dist/mcp-server/src/tools/actions.js"
  );

  const result = JSON.parse(
    await actionsModule.handleActions({
      base_url: "http://localhost:3000",
      action_name: "submit_order"
    })
  );

  assert.equal(result.success, true);
  assert.equal(result.action_count, 1);
  assert.equal(result.actions[0].name, "submit_order");
  assert.equal(result.actions[0].execution_readiness.status, "review_required");
});

// ── fetchManifest error shaping ────────────────────────────────────────

test("fetchManifest returns error for HTTP failures", async (t) => {
  t.after(restoreFetch);
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    statusText: "Internal Server Error"
  });

  const result = await fetchManifestModule.fetchManifest("http://localhost:3000/test");
  assert.equal(result.ok, false);
  assert.ok(result.error.includes("500"));
});

test("fetchManifest returns error for network failures", async (t) => {
  t.after(restoreFetch);
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };

  const result = await fetchManifestModule.fetchManifest("http://localhost:3000/test");
  assert.equal(result.ok, false);
  assert.ok(result.error.includes("fetch failed"));
});
