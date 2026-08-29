/** @typedef {import("@aicorg/sdk-react").AICMetadataProps} AICMetadataProps */

export const CHECKOUT_VIEW = /** @type {{
  pageTitle: string;
  route_pattern: string;
  url: string;
  view_id: string;
}} */ ({
  pageTitle: "Checkout",
  route_pattern: "/",
  url: "http://localhost:3000",
  view_id: "next.checkout"
});

export const CHECKOUT_SUMMARY_ACTION = /** @type {import("@aicorg/spec").AICActionContract} */ ({
  completion_signal: {
    type: "custom",
    value: "checkout.summary.returned"
  },
  estimated_latency_ms: 50,
  execution_readiness: {
    reviewed_at: "2026-08-28T00:00:00.000Z",
    reviewed_by: "checkout-demo-owner",
    source: "authored",
    status: "execution_ready"
  },
  failure_modes: ["checkout_state_unavailable"],
  idempotent: true,
  name: "checkout.get_summary",
  postconditions: ["checkout state remains unchanged"],
  preconditions: ["checkout is visible"],
  side_effects: [],
  target: "checkout.summary",
  title: "Get checkout summary",
  undoable: false
});

export const CHECKOUT_SUMMARY_ELEMENT = /** @type {import("@aicorg/spec").AICElementManifest} */ ({
  actions: [
    {
      contract_ref: CHECKOUT_SUMMARY_ACTION.name,
      name: "read",
      target: "checkout.summary",
      type: "semantic_action"
    }
  ],
  description: "Reads the currently displayed checkout summary without modifying it",
  id: "checkout.summary",
  label: "Checkout summary",
  risk: "low",
  role: "generic",
  state: {
    visible: true
  },
  workflow_ref: "checkout.review"
});

export const ORDER_LINES = /** @type {{
  price: string;
  quantity: number;
  title: string;
  removeProps: AICMetadataProps;
}[]} */ ([
  {
    price: "$129.00",
    quantity: 1,
    title: "Starter Kit",
    removeProps: {
      agentDescription: "Removes the Starter Kit line before submitting the order",
      agentEffects: ["order.lines -= 1", "order.total.recalculated = true"],
      agentEntityId: "line_starter_kit",
      agentEntityLabel: "Starter Kit",
      agentEntityType: "order_line",
      agentId: "checkout.order_line.remove.line_starter_kit",
      agentLabel: "Remove Starter Kit",
      agentRisk: "medium",
      agentWorkflowStep: "checkout.review.items"
    }
  },
  {
    price: "$24.00",
    quantity: 2,
    title: "Priority Support Add-on",
    removeProps: {
      agentDescription: "Removes the Priority Support Add-on line before submitting the order",
      agentEffects: ["order.lines -= 1", "order.total.recalculated = true"],
      agentEntityId: "line_priority_support",
      agentEntityLabel: "Priority Support Add-on",
      agentEntityType: "order_line",
      agentId: "checkout.order_line.remove.line_priority_support",
      agentLabel: "Remove Priority Support Add-on",
      agentRisk: "medium",
      agentWorkflowStep: "checkout.review.items"
    }
  }
]);

export const COUPON_INPUT_PROPS = /** @type {AICMetadataProps} */ ({
  agentDescription: "Edits the coupon code before checkout discounts are applied",
  agentId: "checkout.coupon_code",
  agentLabel: "Coupon code",
  agentRisk: "low",
  agentValidation: {
    examples: ["SPRING20", "SHIPFREE"],
    format: "uppercase_code",
    max_length: 16,
    min_length: 5,
    pattern: "^[A-Z0-9]+$"
  },
  agentWorkflowStep: "checkout.review.discount"
});

export const APPLY_COUPON_PROPS = /** @type {AICMetadataProps} */ ({
  agentAction: "submit",
  agentDescription: "Applies the current coupon code to the in-progress checkout",
  agentEffects: ["order.discount.recalculated = true"],
  agentExecution: {
    estimated_latency_ms: 1200,
    settled_when: ["summary.discount.updated = true"]
  },
  agentId: "checkout.apply_coupon",
  agentLabel: "Apply coupon",
  agentRisk: "low",
  agentWorkflowStep: "checkout.review.discount"
});

export const SAVE_CART_PROPS = /** @type {AICMetadataProps} */ ({
  agentDescription: "Saves the current cart, shipping, and payment selections without charging the order",
  agentEffects: ["cart.snapshot_saved", "toast.visible"],
  agentExecution: {
    estimated_latency_ms: 1800,
    settled_when: ["toast.visible = true"]
  },
  agentId: "checkout.save_cart",
  agentLabel: "Save cart",
  agentRecovery: {
    error_code: "cart_save_timeout",
    recovery: "retry_save_cart",
    retry_after_ms: 3000,
    retryable: true
  },
  agentRisk: "medium",
  agentWorkflowStep: "checkout.review.save"
});

export const SUBMIT_ORDER_PROPS = /** @type {AICMetadataProps} */ ({
  agentAction: "submit",
  agentContractRef: "checkout.complete",
  agentConfirmation: {
    prompt_template: "Charge {{payment_method}} for {{order_total}} and submit order {{order_id}}?",
    summary_fields: ["order_total", "payment_method"],
    type: "human_review"
  },
  agentDescription: "Completes checkout and charges the selected payment method",
  agentEntityId: "ord_100245",
  agentEntityLabel: "Order #100245",
  agentEntityType: "order",
  agentEffects: ["payment.charge", "order.status=submitted"],
  agentExecution: {
    estimated_latency_ms: 4000,
    settled_when: ["navigation.pathname = '/checkout/success'"]
  },
  agentId: "checkout.submit_order",
  agentLabel: "Submit order",
  agentPermissions: ["checkout.submit_order"],
  agentRequiresConfirmation: true,
  agentRisk: "critical",
  agentWorkflowStep: "checkout.review.submit"
});

export const SUBMIT_ORDER_ACTION = /** @type {import("@aicorg/spec").AICActionContract} */ ({
  completion_signal: {
    type: "state_change",
    value: "order.status = submitted"
  },
  estimated_latency_ms: 4000,
  execution_readiness: {
    reviewed_at: "2026-08-28T00:00:00.000Z",
    reviewed_by: "checkout-demo-owner",
    source: "authored",
    status: "execution_ready"
  },
  failure_modes: ["confirmation_declined", "order_state_conflict", "payment_declined"],
  idempotent: false,
  name: "checkout.complete",
  postconditions: ["order.status = submitted", "payment.status = charged"],
  preconditions: ["order.id = ord_100245", "order.status = draft"],
  side_effects: ["payment.charge", "order.status=submitted"],
  target: "checkout.submit_order",
  title: "Complete checkout",
  undoable: false
});

export const SUBMIT_ORDER_ELEMENT = /** @type {import("@aicorg/spec").AICElementManifest} */ ({
  actions: [
    {
      contract_ref: SUBMIT_ORDER_ACTION.name,
      name: SUBMIT_ORDER_PROPS.agentAction ?? "submit",
      target: SUBMIT_ORDER_PROPS.agentId,
      type: "semantic_action"
    }
  ],
  confirmation: SUBMIT_ORDER_PROPS.agentConfirmation,
  description: SUBMIT_ORDER_PROPS.agentDescription,
  effects: SUBMIT_ORDER_PROPS.agentEffects,
  entity_ref: {
    entity_id: SUBMIT_ORDER_PROPS.agentEntityId ?? "ord_100245",
    entity_label: SUBMIT_ORDER_PROPS.agentEntityLabel,
    entity_type: SUBMIT_ORDER_PROPS.agentEntityType ?? "order"
  },
  execution: SUBMIT_ORDER_PROPS.agentExecution,
  id: SUBMIT_ORDER_PROPS.agentId,
  label: SUBMIT_ORDER_PROPS.agentLabel ?? "Submit order",
  permissions: SUBMIT_ORDER_PROPS.agentPermissions,
  recovery: SUBMIT_ORDER_PROPS.agentRecovery,
  requires_confirmation: SUBMIT_ORDER_PROPS.agentRequiresConfirmation,
  risk: SUBMIT_ORDER_PROPS.agentRisk ?? "critical",
  role: "button",
  state: {
    enabled: true,
    visible: true
  },
  validation: SUBMIT_ORDER_PROPS.agentValidation,
  workflow_ref: SUBMIT_ORDER_PROPS.agentWorkflowStep
});
