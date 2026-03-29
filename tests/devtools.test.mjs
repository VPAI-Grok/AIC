import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { importWorkspaceModule, resolveFromRepo } from "./helpers.mjs";

const devtools = await importWorkspaceModule("packages/devtools/dist/devtools/src/index.js");
const devtoolsClient = await importWorkspaceModule("packages/devtools/dist/devtools/src/client.js");
const runtime = await importWorkspaceModule("packages/runtime/dist/runtime/src/index.js");
const sdkReact = await importWorkspaceModule("packages/sdk-react/dist/sdk-react/src/index.js");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function withReactWarningsSuppressed(callback) {
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

test("devtools root entry is directive-free and client entry preserves the bridge boundary", async () => {
  const rootFile = await readFile(
    resolveFromRepo("packages/devtools/dist/devtools/src/index.js"),
    "utf8"
  );
  const clientFile = await readFile(
    resolveFromRepo("packages/devtools/dist/devtools/src/client.js"),
    "utf8"
  );

  assert.equal(rootFile.startsWith("\"use client\";"), false);
  assert.equal(clientFile.startsWith("\"use client\";"), true);
  assert.equal(typeof devtoolsClient.AICDevtoolsBridge, "function");
  assert.equal(devtoolsClient.AICDevtoolsBridge, devtools.AICDevtoolsBridge);
});

function createWindowStub() {
  const eventTarget = new EventTarget();
  return {
    addEventListener: eventTarget.addEventListener.bind(eventTarget),
    dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
    removeEventListener: eventTarget.removeEventListener.bind(eventTarget)
  };
}

test("AICDevtoolsBridge emits throttled snapshot events from the live registry", async () => {
  const originalWindow = globalThis.window;
  const registry = new runtime.AICRegistry();
  const events = [];
  const windowStub = createWindowStub();
  globalThis.window = windowStub;

  windowStub.addEventListener(devtools.AIC_DEVTOOLS_SNAPSHOT_EVENT, (event) => {
    events.push(event.detail);
  });

  let renderer;

  try {
    await withReactWarningsSuppressed(async () => {
      await act(async () => {
        renderer = TestRenderer.create(
          React.createElement(
            sdkReact.AICProvider,
            { registry },
            React.createElement(devtools.AICDevtoolsBridge, {
              throttleMs: 0,
              url: "https://demo.example/customers",
              view_id: "customers.list"
            }),
            React.createElement(
              sdkReact.AIC.Button,
              {
                agentAction: "click",
                agentDescription: "Archive customer",
                agentId: "customer.archive",
                agentRisk: "high"
              },
              "Archive customer"
            )
          )
        );
      });
    });

    assert.ok(events.length >= 1);
    const latestEvent = events.at(-1);
    assert.equal(latestEvent.source, "registry");
    assert.equal(latestEvent.manifest.view.view_id, "customers.list");
    assert.equal(latestEvent.manifest.elements[0].id, "customer.archive");
  } finally {
    globalThis.window = originalWindow;
    if (renderer) {
      await withReactWarningsSuppressed(async () => {
        await act(async () => {
          renderer.unmount();
        });
      });
    }
  }
});

test("createAICDevtoolsExtensionShell exposes the synced panel extension assets", async () => {
  const shell = devtools.createAICDevtoolsExtensionShell();

  assert.equal(shell.manifest.devtools_page, "devtools.html");
  assert.ok(shell.files["content-script.js"]);
  assert.ok(shell.files["panel.html"]);
  assert.ok(shell.files["panel.js"]);
  assert.ok(shell.files["popup.js"]);
  assert.ok(shell.files["service-worker.js"]);

  const manifestFile = await readFile(
    resolveFromRepo("packages/devtools/extension/manifest.json"),
    "utf8"
  );
  const panelFile = await readFile(resolveFromRepo("packages/devtools/extension/panel.js"), "utf8");
  const popupFile = await readFile(resolveFromRepo("packages/devtools/extension/popup.js"), "utf8");

  assert.equal(shell.files["manifest.json"], manifestFile);
  assert.equal(shell.files["panel.js"], panelFile);
  assert.equal(shell.files["popup.js"], popupFile);
  assert.match(shell.files["panel.html"], /Collect DOM/);
  assert.match(shell.files["panel.html"], /apply-ready/);
  assert.match(shell.files["panel.html"], /Import report\.json/);
  assert.match(shell.files["panel.js"], /aic:collect-dom-candidates/);
});

test("filterAICElements and diffRuntimeUiSnapshots are browser-safe helpers for inspector views", () => {
  const before = {
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
    spec: "aic/0.1",
    updated_at: "2026-03-28T00:00:00.000Z",
    view: { view_id: "customers.list" }
  };
  const after = {
    ...before,
    elements: [
      {
        actions: [{ name: "click", target: "customer.archive", type: "element_action" }],
        description: "Archive the selected customer",
        id: "customer.archive",
        label: "Archive customer",
        risk: "high",
        role: "button",
        state: { visible: true }
      },
      {
        actions: [{ name: "navigate", target: "customer.view", type: "element_action" }],
        entity_ref: {
          entity_id: "customer_42",
          entity_type: "customer"
        },
        id: "customer.view",
        label: "View customer",
        risk: "low",
        role: "link",
        state: { visible: true }
      }
    ]
  };

  const filtered = devtools.filterAICElements(after.elements, {
    query: "customer_42",
    risk: "all",
    role: "all"
  });
  const diff = devtools.diffRuntimeUiSnapshots(before, after);

  assert.deepEqual(filtered.map((element) => element.id), ["customer.view"]);
  assert.deepEqual(diff.added, ["customer.view"]);
  assert.equal(diff.changed[0].key, "customer.archive");
});

test("collectAICDomDiscoveryCandidates and createAICAuthoringPatchPlan expose browser-safe authoring helpers", () => {
  const visibleStyle = {
    display: "block",
    opacity: "1",
    visibility: "visible"
  };
  const createElement = ({ attrs = {}, label, tagName }) => ({
    getAttribute(name) {
      return attrs[name] ?? null;
    },
    getBoundingClientRect() {
      return {
        height: 24,
        width: 80
      };
    },
    hidden: false,
    tagName,
    textContent: label
  });
  const root = {
    querySelectorAll() {
      return [
        createElement({
          attrs: {
            "data-testid": "archive-button"
          },
          label: "Archive customer",
          tagName: "BUTTON"
        }),
        createElement({
          label: "Archive customer",
          tagName: "BUTTON"
        }),
        createElement({
          label: "Send renewal email",
          tagName: "BUTTON"
        })
      ];
    }
  };
  const windowRef = {
    getComputedStyle() {
      return visibleStyle;
    },
    location: {
      href: "https://demo.example/customers",
      pathname: "/customers"
    }
  };

  const domCandidates = devtools.collectAICDomDiscoveryCandidates(root, {
    pageUrl: "https://demo.example/customers",
    routePattern: "/customers",
    windowRef
  });
  const plan = devtools.createAICAuthoringPatchPlan({
    dom_candidates: domCandidates
  });

  assert.equal(domCandidates.length, 2);
  assert.equal(domCandidates[0].selectors.testId, "archive-button");
  assert.equal(plan.artifact_type, "aic_authoring_patch_plan");
  assert.equal(plan.summary.total_proposals, 2);
  assert.equal(plan.summary.apply_ready, 0);
  assert.match(devtools.exportAICAuthoringPatchPlanSummary(plan), /AIC Authoring Patch Plan/);
  assert.match(devtools.exportAICAuthoringPatchPlan(plan), /aic_authoring_patch_plan/);
});
