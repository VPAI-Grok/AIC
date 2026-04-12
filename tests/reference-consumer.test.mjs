import assert from "node:assert/strict";
import test from "node:test";

import { importWorkspaceModule } from "./helpers.mjs";
import {
  buildCheckoutContractBundle,
  buildCrmContractBundle
} from "./reference-consumer-fixtures.mjs";
import { createReferenceConsumer } from "./reference-consumer-harness.mjs";

const spec = await importWorkspaceModule("packages/spec/dist/index.js");

test("reference consumer resolves checkout contract bundle without selector fields", async () => {
  const bundle = await buildCheckoutContractBundle();
  const validation = {
    actions: spec.validateSemanticActionsManifest(bundle.actions),
    discovery: spec.validateDiscoveryManifest(bundle.discovery),
    permissions: spec.validatePermissionsManifest(bundle.permissions),
    ui: spec.validateRuntimeUiManifest(bundle.ui),
    workflows: spec.validateWorkflowManifest(bundle.workflows)
  };

  assert.equal(validation.discovery.ok, true);
  assert.equal(validation.actions.ok, true);
  assert.equal(validation.permissions.ok, true);
  assert.equal(validation.workflows.ok, true);
  assert.equal(validation.ui.ok, true);

  const selectorlessBundle = {
    ...bundle,
    ui: {
      ...bundle.ui,
      elements: bundle.ui.elements.map(({ selectors: _selectors, ...element }) => element)
    }
  };
  const consumer = createReferenceConsumer(selectorlessBundle);

  assert.equal(consumer.getEndpoint("ui"), "/.well-known/agent/ui");
  assert.equal(consumer.getEndpoint("actions"), "/.well-known/agent/actions");

  const submitOrder = consumer.getElement("checkout.submit_order");
  assert.equal(submitOrder.id, "checkout.submit_order");
  assert.equal(consumer.requiresConfirmation("checkout.submit_order"), true);

  const submitPolicy = consumer.getPermissionPolicy("checkout.submit_order");
  assert.equal(submitPolicy.source, "action_policy");
  assert.equal(submitPolicy.policy.requiresConfirmation, true);

  const submitAction = consumer.getActionContract("checkout.submit_order");
  assert.equal(submitAction.target, "checkout.submit_order");

  const submitWorkflow = consumer.resolveWorkflow("checkout.submit_order");
  assert.equal(submitWorkflow.workflow.id, "checkout.review");
  assert.equal(submitWorkflow.step?.id, "checkout.review.submit");

  const saveCartCompletion = consumer.getCompletionStrategy("checkout.save_cart");
  assert.equal(saveCartCompletion.source, "runtime_execution");
  assert.equal(saveCartCompletion.mode, "settled_when");
  assert.deepEqual(saveCartCompletion.conditions, ["toast.visible = true"]);

  const starterKitActions = consumer.findElementsByEntityRef("order_line", "line_starter_kit");
  assert.deepEqual(
    starterKitActions.map((element) => element.id),
    ["checkout.order_line.remove.line_starter_kit"]
  );
});

test("reference consumer resolves crm contract bundle by stable ids, entities, and workflows", async () => {
  const bundle = await buildCrmContractBundle();
  const consumer = createReferenceConsumer(bundle);

  assert.equal(consumer.getEndpoint("permissions"), "/agent-permissions.json");
  assert.equal(consumer.getEndpoint("workflows"), "/agent-workflows.json");

  const archive = consumer.getElement("customer.archive");
  assert.equal(archive.entity_ref?.entity_id, "cus_2048");
  assert.equal(consumer.requiresConfirmation("customer.archive"), true);

  const archivePolicy = consumer.getPermissionPolicy("customer.archive");
  assert.equal(archivePolicy.source, "action_policy");
  assert.deepEqual(archivePolicy.policy.roleRequirements, ["billing_manager"]);

  const archiveWorkflow = consumer.resolveWorkflow("customer.archive");
  assert.equal(archiveWorkflow.workflow.id, "customer.archive");
  assert.equal(archiveWorkflow.step?.id, "customer.archive.review");

  const renewalAction = consumer.getActionContract("customer.send_renewal_email");
  assert.equal(renewalAction.target, "customer.send_renewal_email");

  const renewalWorkflow = consumer.resolveWorkflow("customer.send_renewal_email");
  assert.equal(renewalWorkflow.workflow.id, "customer.renewal.outreach");
  assert.equal(renewalWorkflow.step?.id, "customer.renewal.outreach.send");

  const renewalCompletion = consumer.getCompletionStrategy("customer.send_renewal_email");
  assert.equal(renewalCompletion.source, "runtime_execution");
  assert.equal(renewalCompletion.mode, "settled_when");
  assert.deepEqual(renewalCompletion.conditions, ["toast.visible = true"]);

  const customerScoped = consumer.findElementsByEntityRef("customer", "cus_2048");
  assert.ok(
    customerScoped.some((element) => element.id === "customer.archive"),
    "expected archive action to resolve by entity identity"
  );
  assert.ok(
    customerScoped.some((element) => element.id === "customer.send_renewal_email"),
    "expected renewal action to resolve by entity identity"
  );
});
