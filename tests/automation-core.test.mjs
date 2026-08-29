import assert from "node:assert/strict";
import test from "node:test";

import { importWorkspaceModule, resolveFromRepo } from "./helpers.mjs";

const automationCore = await importWorkspaceModule(
  "packages/automation-core/dist/automation-core/src/index.js"
);

test("generated action contracts are explicitly review-only and never pretend to be executable", async () => {
  const artifacts = await automationCore.generateProjectArtifacts({
    appName: "Review-only actions",
    framework: "vite",
    generatedAt: "2026-08-28T00:00:00.000Z",
    projectRoot: resolveFromRepo("tests/fixtures/plugin-app"),
    updatedAt: "2026-08-28T00:00:00.000Z",
    viewId: "review.actions",
    viewUrl: "https://example.test"
  });

  assert.ok(artifacts.actions.actions.length > 0);
  for (const action of artifacts.actions.actions) {
    assert.equal(action.execution_readiness.status, "review_required");
    assert.equal(action.execution_readiness.source, "inferred");
    assert.deepEqual(action.completion_signal, { type: "custom", value: "review_required" });
    assert.deepEqual(action.failure_modes, ["review_required"]);
  }
});

test("scanSourceForAICAnnotations preserves explicit semantic action contract references", () => {
  const result = automationCore.scanSourceForAICAnnotations(
    `<AICButton agentId="checkout.submit" agentAction="submit" agentContractRef="checkout.complete" agentRisk="critical" />`,
    "Checkout.tsx"
  );

  assert.equal(result.matches[0].agentContractRef, "checkout.complete");
});

test("scanSourceForAICAnnotations resolves same-file alias, object-member, helper, and label expressions", () => {
  const result = automationCore.scanSourceForAICAnnotations(
    `const metadata = {
  archive: {
    id: "customer.archive",
    risk: "high"
  },
  labels: {
    preview: "Preview customer"
  }
};
const archiveAlias = metadata.archive.id;
const archiveIdWithSuffix = archiveAlias + ".primary";
const extraAliases = ["archive customer"];
const mergedAliases = [...extraAliases, \`customer \${"archive"}\`];
const baseConfirmation = {
  type: "manual_phrase",
  summary_fields: ["customer_name"]
};
const archiveConfirmation = {
  ...baseConfirmation,
  prompt_template: \`Archive \${"customer"}\`
};
function getArchiveAction() {
  return "click";
}
const getArchiveDescription = () => "Archive customer";
const getPreviewLabel = () => metadata.labels.preview;

export function App() {
  return (
    <main>
      <button
        agentId={archiveIdWithSuffix}
        agentAction={getArchiveAction()}
        agentDescription={getArchiveDescription()}
        agentAliases={mergedAliases}
        agentConfirmation={archiveConfirmation}
        agentRisk={metadata.archive.risk}
      >
        Archive customer
      </button>
      <button data-testid="preview">{getPreviewLabel()}</button>
    </main>
  );
}
`,
    "src/App.tsx"
  );

  assert.equal(result.diagnostics.length, 0);
  assert.deepEqual(result.matches, [
    {
      action: "click",
      agentDescription: "Archive customer",
      agentId: "customer.archive.primary",
      column: 7,
      file: "src/App.tsx",
      line: 31,
      role: "button",
      risk: "high",
      source_key: "src/App.tsx:31:7:button",
      tagName: "button"
    }
  ]);
  assert.equal(result.source_inventory.length, 2);
  assert.equal(result.source_inventory[0].label, "Archive customer");
  assert.equal(result.matches[0].agentId, "customer.archive.primary");
  assert.equal(result.source_inventory[1].label, "Preview customer");
  assert.equal(result.source_inventory[1].selectors?.testId, "preview");
});

test("scanSourceForAICAnnotations emits explicit deferred diagnostic codes for imports, unsupported members, helper args, and cycles", () => {
  const result = automationCore.scanSourceForAICAnnotations(
    `import { importedId } from "./external";

const computed = {
  ["badId"]: "customer.computed"
};

const helperWithArgs = (suffix) => \`customer.\${suffix}\`;
const loopA = loopB;
const loopB = loopA;

export function App() {
  return (
    <main>
      <button agentId={importedId}>Imported</button>
      <button agentId={computed.badId}>Computed</button>
      <button agentId={helperWithArgs("dynamic")}>Helper</button>
      <button agentId={loopA}>Cycle</button>
    </main>
  );
}
`,
    "src/App.tsx"
  );

  assert.equal(result.matches.length, 0);
  assert.equal(result.source_inventory.length, 4);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.code),
    [
      "unsupported_import_reference",
      "unsupported_member_expression",
      "unsupported_call_expression",
      "cyclic_static_reference"
    ]
  );
  assert.ok(result.diagnostics.every((diagnostic) => diagnostic.attribute === "agentId"));
});

test("createQAReadinessReport flags missing critical confirmation and workflow metadata", () => {
  const report = automationCore.createQAReadinessReport({
    projectReport: {
      diagnostics: [],
      filesScanned: 1,
      framework: "vite",
      generated_manifests: {
        findings: [],
        summary: {
          invalid: 0
        }
      },
      matches: [],
      source_inventory: []
    },
    ui: {
      elements: [
        {
          actions: [{ name: "click", target: "invoice.delete", type: "element_action" }],
          id: "invoice.delete",
          label: "Delete invoice",
          risk: "critical",
          role: "button",
          state: {
            visible: true
          }
        }
      ],
      page: {
        url: "https://demo.example/invoices"
      },
      spec: "aic/0.1",
      updated_at: "2026-05-20T00:00:00.000Z",
      view: {
        view_id: "invoices.list"
      }
    },
    workflows: {
      generated_at: "2026-05-20T00:00:00.000Z",
      spec: "aic/0.1",
      workflows: []
    }
  });

  assert.equal(report.artifact_type, "aic_qa_readiness_report");
  assert.equal(report.summary.grade, "not_ready");
  assert.equal(report.summary.blockers, 1);
  assert.equal(report.coverage.confirmation.covered, 0);
  assert.ok(
    report.findings.some((finding) => finding.code === "critical_action_missing_confirmation")
  );
  assert.ok(report.findings.some((finding) => finding.code === "no_explicit_workflows"));
});

test("createQAReadinessReport and createQAAgentTestPlan accept a fully annotated pilot workflow", () => {
  const ui = {
    elements: [
      {
        actions: [{ name: "submit", target: "invoice.send", type: "element_action" }],
        confirmation: {
          prompt_template: "Send invoice INV-42?",
          summary_fields: ["invoice_number"],
          type: "human_review"
        },
        entity_ref: {
          entity_id: "inv_42",
          entity_label: "Invoice INV-42",
          entity_type: "invoice"
        },
        execution: {
          settled_when: ["toast.visible = true"]
        },
        id: "invoice.send",
        label: "Send invoice",
        recovery: {
          recovery: "Retry after confirming customer email",
          retryable: true
        },
        requires_confirmation: true,
        risk: "high",
        role: "button",
        state: {
          visible: true
        },
        validation: {
          required: true
        },
        workflow_ref: "invoice.send.submit"
      }
    ],
    page: {
      url: "https://demo.example/invoices/inv_42"
    },
    spec: "aic/0.1",
    updated_at: "2026-05-20T00:00:00.000Z",
    view: {
      view_id: "invoice.detail"
    }
  };
  const workflows = {
    generated_at: "2026-05-20T00:00:00.000Z",
    spec: "aic/0.1",
    workflows: [
      {
        entry_points: ["invoice.send"],
        id: "invoice.send",
        steps: [
          {
            action: "submit",
            id: "invoice.send.submit",
            requires_confirmation: true,
            target: "invoice.send",
            type: "element_action"
          }
        ],
        title: "Send Invoice"
      }
    ]
  };
  const projectReport = {
    diagnostics: [],
    filesScanned: 1,
    framework: "vite",
    generated_manifests: {
      findings: [],
      summary: {
        invalid: 0
      }
    },
    matches: [],
    source_inventory: []
  };

  const readiness = automationCore.createQAReadinessReport({
    projectReport,
    ui,
    workflows
  });
  const plan = automationCore.createQAAgentTestPlan({
    ui,
    workflows
  });

  assert.equal(readiness.summary.grade, "pilot_ready");
  assert.equal(readiness.summary.score, 100);
  assert.equal(readiness.coverage.entity.covered, 1);
  assert.equal(plan.source, "workflows");
  assert.equal(plan.scenarios[0].id, "invoice.send");
  assert.equal(plan.scenarios[0].steps[0].target, "invoice.send");
  assert.match(plan.playwright_skeleton, /data-agent-id/);
});
