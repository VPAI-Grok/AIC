import assert from "node:assert/strict";
import test from "node:test";

import { importWorkspaceModule, readJsonFile, resolveFromRepo } from "./helpers.mjs";

const spec = await importWorkspaceModule("packages/spec/dist/index.js");
const runtime = await importWorkspaceModule("packages/runtime/dist/runtime/src/index.js");
const actionsBefore = await readJsonFile(resolveFromRepo("tests/fixtures/diffs/actions-before.json"));
const actionsAfter = await readJsonFile(resolveFromRepo("tests/fixtures/diffs/actions-after.json"));
const uiBefore = await readJsonFile(resolveFromRepo("tests/fixtures/diffs/ui-before.json"));
const uiAfter = await readJsonFile(resolveFromRepo("tests/fixtures/diffs/ui-after.json"));
const expectedActionsDetailed = await readJsonFile(
  resolveFromRepo("tests/fixtures/diffs/expected/actions-detailed.json")
);
const expectedUiSummary = await readJsonFile(resolveFromRepo("tests/fixtures/diffs/expected/ui-summary.json"));

test("validateRuntimeUiManifest rejects critical actions without structured confirmation", () => {
  const manifest = {
    spec: spec.SPEC_VERSION,
    manifest_version: spec.MANIFEST_VERSION,
    updated_at: "2026-03-28T00:00:00.000Z",
    page: {
      url: "https://demo.example/customers"
    },
    view: {
      view_id: "customers.list"
    },
    elements: [
      {
        id: "customer.archive",
        label: "Archive customer",
        role: "button",
        actions: [
          {
            name: "click",
            target: "customer.archive",
            type: "element_action"
          }
        ],
        risk: "critical",
        state: {
          enabled: true,
          visible: true
        }
      }
    ]
  };

  const result = spec.validateRuntimeUiManifest(manifest);

  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.rule === "element.critical_confirmation"),
    "expected missing critical confirmation issue"
  );
});

test("validateRuntimeUiManifest warns when row-scoped actions omit entity identity", () => {
  const manifest = {
    spec: spec.SPEC_VERSION,
    manifest_version: spec.MANIFEST_VERSION,
    updated_at: "2026-03-28T00:00:00.000Z",
    page: {
      url: "https://demo.example/customers"
    },
    view: {
      view_id: "customers.list"
    },
    elements: [
      {
        id: "customers.row.archive",
        label: "Archive customer row",
        parent_id: "customers.table",
        role: "button",
        actions: [
          {
            name: "click",
            target: "customers.row.archive",
            type: "element_action"
          }
        ],
        risk: "high",
        state: {
          enabled: true,
          visible: true
        }
      }
    ]
  };

  const result = spec.validateRuntimeUiManifest(manifest);

  assert.equal(result.ok, true);
  assert.ok(
    result.issues.some((issue) => issue.rule === "element.entity_ref" && issue.severity === "warning"),
    "expected entity identity warning"
  );
});

test("validateDiscoveryManifest enforces endpoint and capability consistency", () => {
  const manifest = {
    spec: spec.SPEC_VERSION,
    manifest_version: spec.MANIFEST_VERSION,
    generated_at: "2026-04-11T00:00:00.000Z",
    app: {
      name: "Discovery Drift Demo"
    },
    capabilities: {
      runtimeUiTree: true,
      semanticActions: true,
      permissions: false,
      workflows: true
    },
    endpoints: {
      ui: "/.well-known/agent/ui",
      actions: "/.well-known/agent/actions",
      permissions: "/agent-permissions.json"
    }
  };

  const result = spec.validateDiscoveryManifest(manifest);

  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (issue) =>
        issue.rule === "discovery.endpoint_capability_mismatch" &&
        issue.path === "$.endpoints.permissions" &&
        issue.severity === "warning"
    ),
    "expected warning for disabled capability with endpoint"
  );
  assert.ok(
    result.issues.some(
      (issue) =>
        issue.rule === "discovery.endpoint_capability_mismatch" &&
        issue.path === "$.endpoints.workflows" &&
        issue.severity === "error"
    ),
    "expected error for advertised capability without endpoint"
  );
});

test("AICRegistry merges provenance, emits lifecycle events, and renders manifests", () => {
  const registry = new runtime.AICRegistry();
  const eventTypes = [];

  registry.subscribe((event) => {
    eventTypes.push(event.type);
  });

  registry.register({
    instanceId: "customer.archive:1",
    source: "inferred",
    element: {
      id: "customer.archive",
      label: "Archive customer candidate",
      actions: [
        {
          name: "click",
          target: "customer.archive",
          type: "element_action"
        }
      ],
      aliases: ["archive customer"],
      notes: ["inferred from DOM"],
      role: "button",
      risk: "high",
      selectors: {
        text: "Archive"
      },
      state: {
        enabled: true,
        visible: true
      }
    }
  });

  registry.update({
    instanceId: "customer.archive:1",
    source: "authored",
    element: {
      id: "customer.archive",
      label: "Archive customer",
      description: "Archive the selected customer record",
      actions: [
        {
          name: "click",
          target: "customer.archive",
          type: "element_action"
        }
      ],
      aliases: ["customer archive"],
      confirmation: {
        type: "inline_modal",
        prompt_template: "Archive the selected customer?"
      },
      entity_ref: {
        entity_id: "customer_42",
        entity_type: "customer"
      },
      notes: ["authored by product team"],
      risk: "critical",
      role: "button",
      selectors: {
        text: "Archive customer"
      },
      state: {
        busy: false,
        enabled: true,
        visible: true
      },
      requires_confirmation: true
    }
  });

  registry.emitActionEvent("action_completed", "customer.archive", {
    status: "ok"
  });

  const merged = registry.get("customer.archive");
  assert.ok(merged);
  assert.equal(merged.label, "Archive customer");
  assert.equal(merged.description, "Archive the selected customer record");
  assert.deepEqual(merged.aliases, ["archive customer", "customer archive"]);
  assert.equal(merged.selectors.text, "Archive customer");
  assert.equal(merged.provenance.inferred.source, "inferred");
  assert.equal(merged.provenance.authored.source, "authored");

  const ui = registry.serializeRuntimeUi({
    pageTitle: "Customers",
    url: "https://demo.example/customers",
    view_id: "customers.list"
  });
  assert.equal(ui.elements.length, 1);
  assert.equal(ui.elements[0].id, "customer.archive");

  const discovery = registry.createDiscoveryManifest({
    appName: "Demo CRM",
    framework: "vite"
  });
  assert.equal(discovery.framework, "vite");
  assert.equal(discovery.capabilities.executionModel, true);

  const permissions = registry.createPermissionsManifest({
    forbiddenActions: ["customer.delete"]
  });
  assert.equal(permissions.riskBands.high.requiresConfirmation, true);
  assert.deepEqual(permissions.forbiddenActions, ["customer.delete"]);

  const operate = registry.renderOperateText({
    appName: "Demo CRM"
  });
  assert.match(operate, /AIC is enabled for Demo CRM\./);

  registry.unregister("customer.archive", "customer.archive:1");
  assert.deepEqual(eventTypes, [
    "element_registered",
    "element_updated",
    "action_completed",
    "element_removed"
  ]);
});

test("createAICDataAttributes exposes stable contract metadata", () => {
  const attributes = runtime.createAICDataAttributes({
    id: "customer.archive",
    label: "Archive customer",
    description: "Archive customer",
    role: "button",
    actions: [
      {
        name: "click",
        target: "customer.archive",
        type: "element_action"
      }
    ],
    confirmation: {
      type: "manual_phrase",
      prompt_template: "Type ARCHIVE"
    },
    entity_ref: {
      entity_id: "customer_42",
      entity_type: "customer"
    },
    requires_confirmation: true,
    risk: "high",
    state: {
      enabled: true,
      visible: true
    },
    workflow_ref: "customer.archive.flow"
  });

  assert.deepEqual(attributes, {
    "data-agent-action": "click",
    "data-agent-confirmation": "manual_phrase",
    "data-agent-description": "Archive customer",
    "data-agent-entity-id": "customer_42",
    "data-agent-entity-type": "customer",
    "data-agent-id": "customer.archive",
    "data-agent-label": "Archive customer",
    "data-agent-risk": "high",
    "data-agent-role": "button",
    "data-agent-workflow": "customer.archive.flow"
  });
});

test("shared manifest diff helpers produce stable summary and detailed output", () => {
  assert.deepEqual(spec.diffAICManifestSummary("ui", uiBefore, uiAfter), expectedUiSummary);
  assert.deepEqual(
    spec.diffAICManifestDetailed("actions", actionsBefore, actionsAfter),
    expectedActionsDetailed
  );
});

test("buildAICAuthoringPatchPlan merges snapshot, DOM candidates, bootstrap review, and source report", () => {
  const snapshot = {
    elements: [
      {
        actions: [{ name: "click", target: "customer.archive", type: "element_action" }],
        id: "customer.archive",
        label: "Archive customer",
        risk: "high",
        role: "button",
        state: { visible: true }
      }
    ],
    page: { url: "https://demo.example/customers" },
    spec: spec.SPEC_VERSION,
    updated_at: "2026-03-28T00:00:00.000Z",
    view: { route_pattern: "/customers", view_id: "customers.list" }
  };
  const domCandidates = [
    {
      key: "/customers::button::archive_customer",
      label: "Archive customer",
      page_url: "https://demo.example/customers",
      role: "button",
      route_pattern: "/customers",
      selectors: {
        text: "Archive customer"
      },
      tag_name: "button"
    },
    {
      key: "/customers::button::send_renewal_email",
      label: "Send renewal email",
      page_url: "https://demo.example/customers",
      role: "button",
      route_pattern: "/customers",
      selectors: {
        text: "Send renewal email"
      },
      tag_name: "button"
    }
  ];
  const projectReport = {
    diagnostics: [],
    filesScanned: 1,
    framework: "vite",
    matches: [
      {
        action: "click",
        agentDescription: "Archive customer",
        agentId: "customer.archive",
        column: 7,
        file: "src/App.tsx",
        line: 12,
        risk: "high",
        source_key: "src/App.tsx:12:7:button",
        tagName: "button"
      }
    ],
    source_inventory: [
      {
        annotated_agent_id: "customer.archive",
        column: 7,
        file: "src/App.tsx",
        label: "Archive customer",
        line: 12,
        role: "button",
        selectors: {
          text: "Archive customer"
        },
        source_key: "src/App.tsx:12:7:button",
        tagName: "button"
      },
      {
        column: 7,
        file: "src/App.tsx",
        label: "Send renewal email",
        line: 18,
        role: "button",
        selectors: {
          testId: "send-renewal",
          text: "Send renewal email"
        },
        source_key: "src/App.tsx:18:7:button",
        tagName: "button"
      }
    ]
  };
  const bootstrapReview = {
    artifact_type: "aic_bootstrap_review",
    suggestions: [
      {
        status: "accepted",
        suggestion: {
          action: "click",
          confidence_score: 0.91,
          label: "Send renewal email",
          review_required: false,
          risk: "medium",
          role: "button",
          route: "/customers",
          target: "customer.send_renewal_email"
        }
      }
    ]
  };

  const plan = spec.buildAICAuthoringPatchPlan({
    bootstrap_review: bootstrapReview,
    dom_candidates: domCandidates,
    project_report: projectReport,
    snapshot
  });

  assert.equal(plan.artifact_type, "aic_authoring_patch_plan");
  assert.equal(plan.summary.total_proposals, 3);
  assert.equal(plan.summary.ready, 2);
  assert.equal(plan.summary.apply_ready, 2);
  assert.equal(plan.summary.blocked_by_jsx_pattern, 0);
  assert.equal(plan.summary.ignored, 1);
  assert.equal(plan.summary.bootstrap_backed_proposals, 1);
  assert.equal(plan.summary.review_only_metadata, 0);
  assert.equal(plan.summary.source_resolved_proposals, 2);

  const sendEmailProposal = plan.proposals.find((proposal) => proposal.key === "dom:/customers::button::send_renewal_email");
  assert.ok(sendEmailProposal);
  assert.equal(sendEmailProposal.status, "ready");
  assert.equal(sendEmailProposal.apply_status, "eligible");
  assert.equal(sendEmailProposal.apply_target.match_kind, "source_inventory_exact");
  assert.equal(sendEmailProposal.recommended_props.agentId, "customer.send_renewal_email");
  assert.equal(sendEmailProposal.bootstrap_backed, true);

  const duplicateProposal = plan.proposals.find((proposal) => proposal.key === "dom:/customers::button::archive_customer");
  assert.ok(duplicateProposal);
  assert.equal(duplicateProposal.status, "ignored");
  assert.equal(duplicateProposal.issues[0].code, "duplicate_runtime_match");
  assert.match(spec.renderAICAuthoringPatchPlanSummary(plan), /AIC Authoring Patch Plan/);
});

test("buildAICAuthoringPatchPlan surfaces scalar optional props, review-only metadata, and JSX blockers", () => {
  const plan = spec.buildAICAuthoringPatchPlan({
    project_report: {
      diagnostics: [],
      filesScanned: 1,
      framework: "vite",
      matches: [
        {
          action: "click",
          agentDescription: "Archive customer",
          agentId: "customer.archive",
          column: 7,
          file: "src/App.tsx",
          line: 12,
          risk: "high",
          source_key: "src/App.tsx:12:7:button",
          tagName: "button"
        }
      ],
      source_inventory: [
        {
          annotated_agent_id: "customer.archive",
          column: 7,
          file: "src/App.tsx",
          has_spread_attributes: true,
          label: "Archive customer",
          line: 12,
          opening_tag_signature: "<button {...props}>",
          role: "button",
          selectors: {
            text: "Archive customer"
          },
          source_key: "src/App.tsx:12:7:button",
          tagName: "button"
        }
      ]
    },
    snapshot: {
      spec: "aic/0.1",
      updated_at: "2026-03-28T00:00:00.000Z",
      page: {
        url: "https://demo.example/customers"
      },
      view: {
        route_pattern: "/customers",
        view_id: "customers.list"
      },
      elements: [
        {
          id: "customer.archive",
          label: "Archive customer",
          description: "Archive selected customer",
          role: "menuitem",
          actions: [
            {
              name: "click",
              target: "customer.archive",
              type: "element_action"
            }
          ],
          confirmation: {
            type: "human_review"
          },
          entity_ref: {
            entity_id: "cust_123",
            entity_label: "Acme Co",
            entity_type: "customer"
          },
          requires_confirmation: true,
          risk: "critical",
          state: {
            visible: true
          },
          workflow_ref: "customer.archive"
        }
      ]
    }
  });

  const proposal = plan.proposals.find((entry) => entry.key === "existing:customer.archive");
  assert.ok(proposal);
  assert.equal(proposal.apply_status, "blocked");
  assert.equal(proposal.apply_block_reason, "spread_attributes_present");
  assert.equal(proposal.apply_target?.opening_tag_signature, "<button {...props}>");
  assert.deepEqual(proposal.recommended_optional_props, {
    agentEntityId: "cust_123",
    agentEntityLabel: "Acme Co",
    agentEntityType: "customer",
    agentRequiresConfirmation: true,
    agentRole: "menuitem",
    agentWorkflowStep: "customer.archive"
  });
  assert.ok(proposal.issues.some((issue) => issue.code === "review_only_object_metadata"));
  assert.equal(plan.summary.apply_ready, 0);
  assert.equal(plan.summary.blocked_by_jsx_pattern, 1);
  assert.equal(plan.summary.review_only_metadata, 1);
  assert.equal(plan.summary.source_resolved_proposals, 1);
});
