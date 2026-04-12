import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { importWorkspaceModule, readJsonFile, resolveFromRepo } from "./helpers.mjs";

const automationCore = await importWorkspaceModule(
  "packages/automation-core/dist/automation-core/src/index.js"
);
const runtime = await importWorkspaceModule("packages/runtime/dist/runtime/src/index.js");
const sdkReact = await importWorkspaceModule(
  "packages/integrations-shadcn/node_modules/@aicorg/sdk-react/dist/sdk-react/src/index.js"
);
const shadcn = await importWorkspaceModule(
  "packages/integrations-shadcn/dist/integrations-shadcn/src/index.js"
);

const checkoutContract = await import(
  pathToFileURL(resolveFromRepo("examples/nextjs-checkout-demo/app/checkout-contract.mjs")).href
);
const crmContract = await import(
  pathToFileURL(resolveFromRepo("examples/react-basic/src/crm-contract.mjs")).href
);

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

async function renderRuntimeUi(view, renderTree) {
  const registry = new runtime.AICRegistry();
  let renderer;

  await withWarningsSuppressed(async () => {
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(sdkReact.AICProvider, { registry }, renderTree())
      );
    });
  });

  const manifest = registry.serializeRuntimeUi(view);

  await withWarningsSuppressed(async () => {
    await act(async () => {
      renderer.unmount();
    });
  });

  return manifest;
}

async function loadProjectArtifacts(configRelativePath) {
  const configPath = resolveFromRepo(configRelativePath);
  const config = await readJsonFile(configPath);

  return automationCore.generateProjectArtifacts({
    ...config,
    projectRoot: resolve(dirname(configPath), config.projectRoot ?? ".")
  });
}

export async function buildCheckoutContractBundle() {
  const artifacts = await loadProjectArtifacts("examples/nextjs-checkout-demo/aic.project.json");
  const ui = await renderRuntimeUi(checkoutContract.CHECKOUT_VIEW, () =>
    React.createElement(
      React.Fragment,
      null,
      checkoutContract.ORDER_LINES.map((line) =>
        React.createElement(
          sdkReact.AICButton,
          {
            ...line.removeProps,
            key: line.removeProps.agentId,
            type: "button"
          },
          "Remove line"
        )
      ),
      React.createElement(
        sdkReact.AICForm,
        {
          agentDescription: "Reviews and applies coupon codes before the order is submitted",
          agentId: "checkout.discount_form",
          agentRisk: "low",
          agentWorkflowStep: "checkout.review.discount"
        },
        React.createElement(sdkReact.AICInput, checkoutContract.COUPON_INPUT_PROPS),
        React.createElement(
          sdkReact.AICButton,
          {
            ...checkoutContract.APPLY_COUPON_PROPS,
            type: "button"
          },
          "Apply coupon"
        )
      ),
      React.createElement(
        sdkReact.AICButton,
        {
          ...checkoutContract.SAVE_CART_PROPS,
          type: "button"
        },
        "Save cart"
      ),
      React.createElement(
        sdkReact.AICButton,
        {
          ...checkoutContract.SUBMIT_ORDER_PROPS,
          type: "button"
        },
        "Submit order"
      )
    )
  );

  return {
    actions: artifacts.actions,
    discovery: artifacts.discovery,
    permissions: artifacts.permissions,
    ui,
    workflows: artifacts.workflows
  };
}

export async function buildCrmContractBundle() {
  const artifacts = await loadProjectArtifacts("examples/react-basic/aic.project.json");
  const ui = await renderRuntimeUi(crmContract.CRM_VIEW, () =>
    React.createElement(
      React.Fragment,
      null,
      React.createElement(
        shadcn.ShadcnAICDialogTrigger,
        crmContract.ARCHIVE_CUSTOMER_PROPS,
        "Archive customer"
      ),
      React.createElement(
        shadcn.ShadcnAICDialogContent,
        crmContract.ARCHIVE_DIALOG_PROPS,
        React.createElement(
          React.Fragment,
          null,
          "Archiving Northwind Traders pauses reminder workflows.",
          React.createElement(
            shadcn.ShadcnAICDialogClose,
            {
              ...crmContract.ARCHIVE_DIALOG_CLOSE_PROPS,
              type: "button"
            },
            "Cancel archive"
          ),
          React.createElement(
            shadcn.ShadcnAICButton,
            {
              ...crmContract.ARCHIVE_CONFIRM_PROPS,
              type: "button"
            },
            "Confirm archive"
          )
        )
      ),
      React.createElement(
        shadcn.ShadcnAICButton,
        {
          ...crmContract.SEND_RENEWAL_REMINDER_PROPS,
          type: "button"
        },
        "Send renewal reminder"
      ),
      React.createElement(shadcn.ShadcnAICInput, crmContract.RENEWAL_NOTE_INPUT_PROPS),
      React.createElement(
        shadcn.ShadcnAICButton,
        {
          ...crmContract.SAVE_RENEWAL_NOTE_PROPS,
          type: "button"
        },
        "Save renewal note"
      ),
      React.createElement(
        shadcn.ShadcnAICTabsTrigger,
        crmContract.OVERVIEW_TAB_PROPS,
        "Overview"
      )
    )
  );

  return {
    actions: artifacts.actions,
    discovery: artifacts.discovery,
    permissions: artifacts.permissions,
    ui,
    workflows: artifacts.workflows
  };
}
