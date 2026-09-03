// AIC governance contracts for the espresso store's consequential WebMCP tools.
//
// Retrofit note: 16 tools are registered in WebMCPTools.tsx. Fourteen are left
// exactly as the author wrote them — read-only queries and reversible display
// state do not need a governance wrapper, and AIC's own policy is to govern
// task-level consequential operations rather than every control.
//
// Two are governed here:
//   checkout      critical - charges and is irreversible
//   apply_coupon  medium   - money-adjacent but reversible
//
// The risk gradient is the point. Not everything that mutates is critical.

import type { AICActionContract, AICElementManifest } from "@aicorg/spec";

/* ------------------------------------------------------------------ checkout */

export const CHECKOUT_OPERATION_ID = "espresso.order.place";

export const CHECKOUT_ACTION: AICActionContract = {
  completion_signal: {
    type: "state_change",
    value: "order.created && cart.empty",
  },
  estimated_latency_ms: 1500,
  execution_readiness: {
    reviewed_at: "2026-09-03T00:00:00.000Z",
    reviewed_by: "aic-webmcp-retrofit",
    source: "authored",
    status: "execution_ready",
  },
  failure_modes: ["cart_empty", "confirmation_declined", "not_authenticated"],
  idempotent: false,
  name: CHECKOUT_OPERATION_ID,
  postconditions: ["order.status = placed", "cart.line_count = 0"],
  preconditions: ["user.authenticated = true", "cart.line_count > 0"],
  side_effects: ["order.created", "cart.emptied", "coupon.consumed"],
  target: "espresso.checkout",
  title: "Place the order",
  undoable: false,
};

export const CHECKOUT_ELEMENT: AICElementManifest = {
  actions: [
    {
      contract_ref: CHECKOUT_ACTION.name,
      name: "submit",
      target: "espresso.checkout",
      type: "semantic_action",
    },
  ],
  confirmation: {
    // `checkout` takes no input, so there is nothing to interpolate a
    // placeholder from. Keep the prompt concrete rather than rendering a
    // literal {{order_total}} at the human.
    prompt_template:
      "Place this order and charge the card now? This empties your cart and cannot be undone.",
    summary_fields: [],
    type: "human_review",
  },
  description:
    "Places the order for everything in the cart and charges the customer.",
  effects: ["order.created", "cart.emptied", "coupon.consumed"],
  entity_ref: {
    entity_id: "cart.current",
    entity_label: "Current cart",
    entity_type: "cart",
  },
  id: "espresso.checkout",
  label: "Checkout",
  permissions: ["espresso.order.place"],
  requires_confirmation: true,
  risk: "critical",
  role: "button",
  state: { enabled: true, visible: true },
};

/* --------------------------------------------------------------- applyCoupon */

export const APPLY_COUPON_OPERATION_ID = "espresso.coupon.apply";

export const APPLY_COUPON_ACTION: AICActionContract = {
  completion_signal: {
    type: "state_change",
    value: "cart.coupon.code = requested_code",
  },
  estimated_latency_ms: 600,
  execution_readiness: {
    reviewed_at: "2026-09-03T00:00:00.000Z",
    reviewed_by: "aic-webmcp-retrofit",
    source: "authored",
    status: "execution_ready",
  },
  failure_modes: ["coupon_not_owned", "coupon_already_used", "not_authenticated"],
  idempotent: true,
  name: APPLY_COUPON_OPERATION_ID,
  postconditions: ["cart.coupon.applied = true"],
  preconditions: ["user.authenticated = true", "user.owns_coupon = true"],
  side_effects: ["coupon.applied", "cart.total.recalculated"],
  target: "espresso.apply_coupon",
  title: "Apply a coupon to the cart",
  undoable: true,
};

export const APPLY_COUPON_ELEMENT: AICElementManifest = {
  actions: [
    {
      contract_ref: APPLY_COUPON_ACTION.name,
      name: "submit",
      target: "espresso.apply_coupon",
      type: "semantic_action",
    },
  ],
  description: "Applies one of the customer's coupons to the current cart.",
  effects: ["coupon.applied", "cart.total.recalculated"],
  entity_ref: {
    entity_id: "cart.current",
    entity_label: "Current cart",
    entity_type: "cart",
  },
  id: "espresso.apply_coupon",
  label: "Apply coupon",
  permissions: ["espresso.coupon.apply"],
  requires_confirmation: false,
  risk: "medium",
  role: "button",
  state: { enabled: true, visible: true },
};

/* ----------------------------------------------------------------- discovery */

/**
 * Published in /.well-known/agent.json so an agent can read the risk of each
 * governed tool before it decides to call anything.
 */
export const ESPRESSO_WEBMCP_DISCOVERY = {
  api: "document.modelContext",
  draft: "2026-08-26",
  enabled: true,
  tools: [
    {
      name: "checkout",
      operation_id: CHECKOUT_OPERATION_ID,
      read_only: false,
      requires_confirmation: true,
      requires_permission: "espresso.order.place",
      risk: "critical" as const,
    },
    {
      name: "apply_coupon",
      operation_id: APPLY_COUPON_OPERATION_ID,
      read_only: false,
      requires_confirmation: false,
      requires_permission: "espresso.coupon.apply",
      risk: "medium" as const,
    },
  ],
};
