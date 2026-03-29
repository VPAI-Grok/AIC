import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";

import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { importWorkspaceModule, resolveFromRepo } from "./helpers.mjs";

const sdkReact = await importWorkspaceModule("packages/sdk-react/dist/sdk-react/src/index.js");
const shadcn = await importWorkspaceModule(
  "packages/integrations-shadcn/dist/integrations-shadcn/src/index.js"
);
const runtime = await importWorkspaceModule("packages/runtime/dist/runtime/src/index.js");
const spec = await importWorkspaceModule("packages/spec/dist/index.js");
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

function getElement(manifest, id) {
  const element = manifest.elements.find((candidate) => candidate.id === id);
  assert.ok(element, `expected manifest element ${id}`);
  return element;
}

test("checkout example emits confirmation, validation, execution, recovery, entity, and workflow metadata", async () => {
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
        )
      );
    });
  });

  const manifest = registry.serializeRuntimeUi(checkoutContract.CHECKOUT_VIEW);
  const validation = spec.validateRuntimeUiManifest(manifest);
  assert.equal(validation.ok, true);
  assert.equal(
    validation.issues.filter((issue) => issue.severity === "error" || issue.severity === "fatal").length,
    0
  );

  const submitOrder = getElement(manifest, "checkout.submit_order");
  assert.equal(submitOrder.risk, "critical");
  assert.equal(submitOrder.requires_confirmation, true);
  assert.equal(submitOrder.confirmation?.type, "human_review");
  assert.equal(submitOrder.workflow_ref, "checkout.review.submit");
  assert.equal(submitOrder.entity_ref?.entity_id, "ord_100245");

  const saveCart = getElement(manifest, "checkout.save_cart");
  assert.equal(saveCart.execution?.estimated_latency_ms, 1800);
  assert.equal(saveCart.recovery?.recovery, "retry_save_cart");
  assert.equal(saveCart.recovery?.retryable, true);

  const couponCode = getElement(manifest, "checkout.coupon_code");
  assert.deepEqual(couponCode.validation?.examples, ["SPRING20", "SHIPFREE"]);
  assert.equal(couponCode.validation?.pattern, "^[A-Z0-9]+$");
  assert.equal(couponCode.workflow_ref, "checkout.review.discount");

  const orderLine = getElement(manifest, "checkout.order_line.remove.line_starter_kit");
  assert.equal(orderLine.entity_ref?.entity_type, "order_line");
  assert.equal(orderLine.entity_ref?.entity_label, "Starter Kit");
  assert.equal(orderLine.workflow_ref, "checkout.review.items");

  await withWarningsSuppressed(async () => {
    await act(async () => {
      renderer.unmount();
    });
  });
});

test("crm example emits confirmation, validation, execution, recovery, entity, and workflow metadata", async () => {
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
            React.createElement(
              shadcn.ShadcnAICDropdownMenuTrigger,
              crmContract.CUSTOMER_ACTIONS_TRIGGER_PROPS,
              "Customer actions"
            ),
            React.createElement(
              shadcn.ShadcnAICDropdownMenuContent,
              crmContract.CUSTOMER_ACTIONS_MENU_PROPS,
              React.createElement(
                React.Fragment,
                null,
                React.createElement(
                  shadcn.ShadcnAICDropdownMenuItem,
                  {
                    ...crmContract.SEND_RENEWAL_REMINDER_PROPS,
                    type: "button"
                  },
                  "Send renewal reminder"
                ),
                React.createElement(
                  shadcn.ShadcnAICDialogTrigger,
                  crmContract.ARCHIVE_CUSTOMER_PROPS,
                  "Archive customer"
                )
              )
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
                )
              )
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
              shadcn.ShadcnAICSelectTrigger,
              crmContract.ACCOUNT_STATUS_TRIGGER_PROPS,
              "Account status"
            ),
            React.createElement(
              shadcn.ShadcnAICSelectContent,
              crmContract.ACCOUNT_STATUS_OPTIONS_PROPS,
              React.createElement(
                React.Fragment,
                null,
                React.createElement(
                  shadcn.ShadcnAICSelectItem,
                  {
                    ...crmContract.ACCOUNT_STATUS_ACTIVE_PROPS,
                    type: "button"
                  },
                  "Active"
                ),
                React.createElement(
                  shadcn.ShadcnAICSelectItem,
                  {
                    ...crmContract.ACCOUNT_STATUS_TRIAL_PROPS,
                    type: "button"
                  },
                  "Trial"
                ),
                React.createElement(
                  shadcn.ShadcnAICSelectItem,
                  {
                    ...crmContract.ACCOUNT_STATUS_AT_RISK_PROPS,
                    type: "button"
                  },
                  "At-risk"
                )
              )
            ),
            React.createElement(
              shadcn.ShadcnAICTabsTrigger,
              crmContract.OVERVIEW_TAB_PROPS,
              "Overview"
            )
          )
        )
      );
    });
  });

  const manifest = registry.serializeRuntimeUi(crmContract.CRM_VIEW);
  const validation = spec.validateRuntimeUiManifest(manifest);
  assert.equal(validation.ok, true);
  assert.equal(
    validation.issues.filter((issue) => issue.severity === "error" || issue.severity === "fatal").length,
    0
  );

  const archive = getElement(manifest, "customer.archive");
  assert.equal(archive.confirmation?.type, "human_review");
  assert.equal(archive.requires_confirmation, true);
  assert.equal(archive.entity_ref?.entity_id, "cus_2048");
  assert.equal(archive.workflow_ref, "customer.archive.review");

  const actionsMenu = getElement(manifest, "customer.actions_menu");
  assert.equal(actionsMenu.role, "button");
  assert.equal(actionsMenu.entity_ref?.entity_type, "customer");

  const actionsContent = getElement(manifest, "customer.actions_menu.content");
  assert.equal(actionsContent.role, "menu");

  const sendReminder = getElement(manifest, "customer.send_renewal_email");
  assert.equal(sendReminder.execution?.estimated_latency_ms, 2500);
  assert.equal(sendReminder.recovery?.recovery, "retry_email_send");
  assert.equal(sendReminder.workflow_ref, "customer.renewal.outreach.send");

  const closeArchive = getElement(manifest, "customer.archive.dialog.close");
  assert.equal(closeArchive.role, "button");
  assert.equal(closeArchive.workflow_ref, "customer.archive.review");

  const renewalNote = getElement(manifest, "customer.renewal_note");
  assert.equal(renewalNote.validation?.required, true);
  assert.equal(renewalNote.validation?.max_length, 240);
  assert.equal(renewalNote.workflow_ref, "customer.renewal.note.capture");

  const statusOption = getElement(manifest, "customer.filter.account_status.at_risk");
  assert.equal(statusOption.role, "option");
  assert.equal(statusOption.risk, "medium");

  const saveNote = getElement(manifest, "customer.renewal_note.save");
  assert.equal(saveNote.entity_ref?.entity_type, "customer");
  assert.equal(saveNote.execution?.estimated_latency_ms, 1600);
  assert.equal(saveNote.workflow_ref, "customer.renewal.note.capture");

  await withWarningsSuppressed(async () => {
    await act(async () => {
      renderer.unmount();
    });
  });
});
