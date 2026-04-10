import assert from "node:assert/strict";
import test from "node:test";

import { importWorkspaceModule } from "./helpers.mjs";

const automationCore = await importWorkspaceModule(
  "packages/automation-core/dist/automation-core/src/index.js"
);

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
