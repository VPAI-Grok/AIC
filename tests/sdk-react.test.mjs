import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { importWorkspaceModule, resolveFromRepo } from "./helpers.mjs";

const sdkReact = await importWorkspaceModule("packages/sdk-react/dist/sdk-react/src/index.js");
const sdkReactClient = await importWorkspaceModule("packages/sdk-react/dist/sdk-react/src/client.js");
const runtime = await importWorkspaceModule("packages/runtime/dist/runtime/src/index.js");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function withReactTestRendererWarningsSuppressed(callback) {
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

test("sdk-react root entry is directive-free and client entry preserves the client boundary", async () => {
  const rootFile = await readFile(
    resolveFromRepo("packages/sdk-react/dist/sdk-react/src/index.js"),
    "utf8"
  );
  const clientFile = await readFile(
    resolveFromRepo("packages/sdk-react/dist/sdk-react/src/client.js"),
    "utf8"
  );

  assert.equal(rootFile.startsWith("\"use client\";"), false);
  assert.equal(clientFile.startsWith("\"use client\";"), true);
  assert.equal(typeof sdkReactClient.AICProvider, "function");
  assert.equal(sdkReactClient.AICProvider, sdkReact.AICProvider);
});

test("AIC components register with the runtime registry and unregister on unmount", async () => {
  const registry = new runtime.AICRegistry();
  let renderer;

  await withReactTestRendererWarningsSuppressed(async () => {
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(
          sdkReact.AICProvider,
          { registry },
          React.createElement(
            sdkReact.AIC.Button,
            {
              agentAction: "click",
              agentConfirmation: {
                prompt_template: "Archive this customer?",
                type: "inline_modal"
              },
              agentDescription: "Archive customer",
              agentEntityId: "customer_42",
              agentEntityType: "customer",
              agentId: "customer.archive",
              agentRequiresConfirmation: true,
              agentRisk: "critical",
              agentWorkflowStep: "customer.archive.flow"
            },
            "Archive customer"
          )
        )
      );
    });
  });

  const button = renderer.root.findByType("button");
  assert.equal(button.props["data-agent-id"], "customer.archive");
  assert.equal(button.props["data-agent-confirmation"], "inline_modal");
  assert.equal(button.props["data-agent-entity-type"], "customer");
  assert.equal(button.props["data-agent-workflow"], "customer.archive.flow");

  const registered = registry.get("customer.archive");
  assert.ok(registered);
  assert.equal(registered.description, "Archive customer");
  assert.equal(registered.requires_confirmation, true);
  assert.equal(registered.entity_ref?.entity_id, "customer_42");

  await withReactTestRendererWarningsSuppressed(async () => {
    await act(async () => {
      renderer.unmount();
    });
  });

  assert.equal(registry.snapshot().length, 0);
});

test("AIC components update registry state on rerender and emit development warnings", async () => {
  const registry = new runtime.AICRegistry();
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => {
    warnings.push(String(message));
  };

  let renderer;

  try {
    await withReactTestRendererWarningsSuppressed(async () => {
      await act(async () => {
        renderer = TestRenderer.create(
          React.createElement(
            sdkReact.AICProvider,
            { registry },
            React.createElement(
              sdkReact.AIC.Button,
              {
                agentDescription: "Archive customer",
                agentId: "customer.archive",
                agentRequiresConfirmation: true,
                agentRisk: "critical"
              },
              "Archive customer"
            )
          )
        );
      });
    });

    assert.ok(
      warnings.some((message) => message.includes("missing a confirmation prompt template")),
      "expected development warning for critical action without prompt"
    );

    await withReactTestRendererWarningsSuppressed(async () => {
      await act(async () => {
        renderer.update(
          React.createElement(
            sdkReact.AICProvider,
            { registry },
            React.createElement(
              sdkReact.AIC.Button,
              {
                agentConfirmation: {
                  prompt_template: "Archive customer ACME Corp?",
                  type: "manual_phrase"
                },
                agentDescription: "Archive selected customer",
                agentEntityId: "customer_99",
                agentEntityType: "customer",
                agentId: "customer.archive",
                agentRequiresConfirmation: true,
                agentRisk: "critical"
              },
              "Archive selected customer"
            )
          )
        );
      });
    });

    const updated = registry.get("customer.archive");
    assert.ok(updated);
    assert.equal(updated.description, "Archive selected customer");
    assert.equal(updated.confirmation?.type, "manual_phrase");
    assert.equal(updated.entity_ref?.entity_id, "customer_99");
  } finally {
    console.warn = originalWarn;
    if (renderer) {
      await withReactTestRendererWarningsSuppressed(async () => {
        await act(async () => {
          renderer.unmount();
        });
      });
    }
  }
});

test("Agent compatibility aliases still work with mounted components and hooks", async () => {
  const registry = new runtime.AICRegistry();

  function LegacyLink() {
    const attributes = sdkReact.useAgentAttributes({
      agentAction: "navigate",
      agentDescription: "View customer",
      agentId: "customer.view",
      agentRisk: "low",
      children: "View customer"
    });

    return React.createElement(
      "a",
      {
        ...attributes,
        href: "/customers/42"
      },
      "View customer"
    );
  }

  let renderer;

  await withReactTestRendererWarningsSuppressed(async () => {
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(
          sdkReact.AgentProvider,
          { registry },
          React.createElement(LegacyLink)
        )
      );
    });
  });

  const link = renderer.root.findByType("a");
  assert.equal(link.props["data-agent-id"], "customer.view");
  assert.equal(link.props["data-agent-action"], "navigate");
  assert.equal(registry.get("customer.view")?.label, "View customer");

  await withReactTestRendererWarningsSuppressed(async () => {
    await act(async () => {
      renderer.unmount();
    });
  });
});
