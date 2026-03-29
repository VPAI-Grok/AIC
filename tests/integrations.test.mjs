import assert from "node:assert/strict";
import test from "node:test";

import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { importWorkspaceModule } from "./helpers.mjs";

const radix = await importWorkspaceModule(
  "packages/integrations-radix/dist/integrations-radix/src/index.js"
);
const shadcn = await importWorkspaceModule(
  "packages/integrations-shadcn/dist/integrations-shadcn/src/index.js"
);
const shadcnClient = await importWorkspaceModule(
  "packages/integrations-shadcn/dist/integrations-shadcn/src/client.js"
);
const sdkReact = await importWorkspaceModule("packages/sdk-react/dist/sdk-react/src/index.js");
const runtime = await importWorkspaceModule("packages/runtime/dist/runtime/src/index.js");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function withWarningsSuppressed(callback) {
  const originalError = console.error;
  console.error = (...args) => {
    const message = args.map((value) => String(value)).join(" ");

    if (message.includes("react-test-renderer is deprecated")) {
      return;
    }

    originalError(...args);
  };

  try {
    return await callback();
  } finally {
    console.error = originalError;
  }
}

test("shadcn root entry is directive-free and client entry preserves the wrapper boundary", async () => {
  const { readFile } = await import("node:fs/promises");
  const { resolveFromRepo } = await import("./helpers.mjs");
  const rootFile = await readFile(
    resolveFromRepo("packages/integrations-shadcn/dist/integrations-shadcn/src/index.js"),
    "utf8"
  );
  const clientFile = await readFile(
    resolveFromRepo("packages/integrations-shadcn/dist/integrations-shadcn/src/client.js"),
    "utf8"
  );

  assert.equal(rootFile.startsWith("\"use client\";"), false);
  assert.equal(clientFile.startsWith("\"use client\";"), true);
  assert.equal(typeof shadcnClient.ShadcnAICButton, "function");
  assert.equal(shadcnClient.ShadcnAICButton, shadcn.ShadcnAICButton);
});

test("Radix helper factories expose stable AIC props for common controls", () => {
  assert.deepEqual(radix.createRadixDialogTriggerAICProps({ id: "dialog.open" }), {
    agentAction: "click",
    agentDescription: "Opens a dialog",
    agentId: "dialog.open",
    agentRisk: "low",
    agentRole: "dialog_trigger"
  });

  assert.deepEqual(radix.createRadixDialogContentAICProps({ id: "dialog.content" }), {
    agentAction: "read",
    agentDescription: "Reads dialog contents",
    agentId: "dialog.content",
    agentRisk: "low",
    agentRole: "dialog"
  });
  assert.equal(radix.createRadixDialogCloseAICProps({ id: "dialog.close" }).agentAction, "click");

  assert.deepEqual(
    radix.createRadixSelectTriggerAICProps({
      description: "Opens status filter",
      id: "filter.status"
    }),
    {
      agentAction: "select",
      agentDescription: "Opens status filter",
      agentEntityId: undefined,
      agentEntityType: undefined,
      agentId: "filter.status",
      agentRisk: "medium",
      agentRole: "combobox"
    }
  );

  assert.equal(radix.createRadixSelectContentAICProps({ id: "filter.status.options" }).agentRole, "listbox");
  assert.equal(radix.createRadixSelectItemAICProps({ id: "filter.status.active" }).agentRole, "option");
  assert.equal(radix.createRadixDropdownMenuTriggerAICProps({ id: "menu.actions" }).agentRole, "button");
  assert.equal(radix.createRadixDropdownMenuContentAICProps({ id: "menu.actions.content" }).agentRole, "menu");
  assert.equal(radix.createRadixDropdownMenuItemAICProps({ id: "menu.actions.archive" }).agentRole, "menuitem");
  assert.equal(radix.createRadixCheckboxAICProps({ id: "toggle.archived" }).agentAction, "toggle");
  assert.equal(radix.createRadixSwitchAICProps({ id: "toggle.sync" }).agentRole, "switch");
  assert.equal(radix.createRadixTabsListAICProps({ id: "tabs.customer" }).agentRole, "tablist");
  assert.equal(radix.createRadixTabsTriggerAICProps({ id: "tab.overview" }).agentRole, "tab");
  assert.equal(radix.createRadixTabsContentAICProps({ id: "panel.overview" }).agentRole, "tabpanel");
});

test("Shadcn wrappers register expected runtime roles and actions", async () => {
  const registry = new runtime.AICRegistry();
  let renderer;

  await withWarningsSuppressed(async () => {
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(
          sdkReact.AICProvider,
          { registry },
          React.createElement(
            React.Fragment,
            null,
            React.createElement(shadcn.ShadcnAICDialogTrigger, { agentId: "dialog.open" }, "Open dialog"),
            React.createElement(
              shadcn.ShadcnAICDialogContent,
              { agentId: "dialog.content" },
              React.createElement(
                React.Fragment,
                null,
                "Dialog body",
                React.createElement(
                  shadcn.ShadcnAICDialogClose,
                  { agentId: "dialog.close", type: "button" },
                  "Close dialog"
                )
              )
            ),
            React.createElement(
              shadcn.ShadcnAICDropdownMenuTrigger,
              { agentId: "menu.actions" },
              "Actions"
            ),
            React.createElement(
              shadcn.ShadcnAICDropdownMenuContent,
              { agentId: "menu.actions.content" },
              React.createElement(
                shadcn.ShadcnAICDropdownMenuItem,
                { agentId: "menu.actions.archive", type: "button" },
                "Archive"
              )
            ),
            React.createElement(
              shadcn.ShadcnAICSelectTrigger,
              { agentId: "filter.status" },
              "Status"
            ),
            React.createElement(
              shadcn.ShadcnAICSelectContent,
              { agentId: "filter.status.options" },
              React.createElement(
                shadcn.ShadcnAICSelectItem,
                { agentId: "filter.status.active", type: "button" },
                "Active"
              )
            ),
            React.createElement(shadcn.ShadcnAICCheckbox, {
              agentId: "filter.show_archived",
              agentLabel: "Show archived"
            }),
            React.createElement(shadcn.ShadcnAICTabsTrigger, { agentId: "tab.overview" }, "Overview"),
            React.createElement(
              shadcn.ShadcnAICTabsContent,
              { agentId: "panel.overview" },
              "Overview panel"
            )
          )
        )
      );
    });
  });

  const snapshot = registry.snapshot();
  assert.equal(snapshot.length, 12);
  assert.equal(registry.get("dialog.open")?.role, "dialog_trigger");
  assert.equal(registry.get("dialog.content")?.actions[0]?.name, "read");
  assert.equal(registry.get("dialog.close")?.actions[0]?.name, "click");
  assert.equal(registry.get("menu.actions")?.role, "button");
  assert.equal(registry.get("menu.actions.content")?.role, "menu");
  assert.equal(registry.get("menu.actions.archive")?.role, "menuitem");
  assert.equal(registry.get("filter.status")?.role, "combobox");
  assert.equal(registry.get("filter.status.options")?.role, "listbox");
  assert.equal(registry.get("filter.status.active")?.role, "option");
  assert.equal(registry.get("filter.show_archived")?.actions[0]?.name, "toggle");
  assert.equal(registry.get("tab.overview")?.role, "tab");
  assert.equal(registry.get("panel.overview")?.role, "tabpanel");

  await withWarningsSuppressed(async () => {
    await act(async () => {
      renderer.unmount();
    });
  });
});
