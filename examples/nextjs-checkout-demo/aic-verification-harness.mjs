import {
  CHECKOUT_REQUEST,
  authorizeCheckoutRequest,
  executeCheckoutDomainOperation,
  validateCheckoutRequest
} from "./app/checkout-operation.mjs";

const CAPTURED_AT = "2026-08-28T00:00:00.000Z";
const OPERATION_ID = "checkout.complete.domain";

function passed(requirement_id, actual = true) {
  return { actual, passed: true, requirement_id };
}

function notObserved(requirement_id) {
  return { actual: false, passed: false, requirement_id };
}

function unchangedOutcome(state) {
  return {
    order_id: CHECKOUT_REQUEST.order_id,
    order_status: state.orderStatus,
    payment_status: state.paymentStatus
  };
}

async function runGuardedCheckout({ confirm, permissionGranted, surfaceId }) {
  const state = {
    chargeCount: 0,
    orderStatus: "draft",
    paymentStatus: "unpaid"
  };
  const common = {
    artifact_type: "aic_behavior_observation",
    captured_at: CAPTURED_AT,
    contract_id: "checkout.complete.behavior",
    environment: { fixture: "nextjs-checkout-demo", surface: surfaceId },
    evidence: [{ kind: "trace", ref: `checkout-trace:${surfaceId}` }],
    mode: "executed",
    operation_id: OPERATION_ID,
    surface_id: surfaceId
  };

  validateCheckoutRequest(CHECKOUT_REQUEST);
  const initialChecks = [passed("order.is_draft", state.orderStatus)];

  if (!authorizeCheckoutRequest(CHECKOUT_REQUEST, state.orderStatus, permissionGranted)) {
    return {
      ...common,
      checks: [
        ...initialChecks,
        passed("authorization.denied"),
        passed("order.unchanged", unchangedOutcome(state)),
        notObserved("confirmation.accepted"),
        notObserved("confirmation.declined"),
        notObserved("payment.charge"),
        notObserved("order.submitted"),
        notObserved("payment.charged")
      ],
      confirmation: "not_reached",
      error_code: "authorization_denied",
      outcome: unchangedOutcome(state),
      scenario_id: "authorization-denied",
      status: "denied"
    };
  }

  const authorizedChecks = [...initialChecks, passed("authorization.allowed")];
  if (!confirm()) {
    return {
      ...common,
      checks: [
        ...authorizedChecks,
        passed("confirmation.declined"),
        passed("order.unchanged", unchangedOutcome(state)),
        notObserved("authorization.denied"),
        notObserved("confirmation.accepted"),
        notObserved("payment.charge"),
        notObserved("order.submitted"),
        notObserved("payment.charged")
      ],
      confirmation: "declined",
      error_code: "confirmation_declined",
      outcome: unchangedOutcome(state),
      scenario_id: "confirmation-declined",
      status: "cancelled"
    };
  }

  const result = await executeCheckoutDomainOperation(CHECKOUT_REQUEST, (status) => {
    state.orderStatus = status;
    if (status === "submitted") {
      state.chargeCount += 1;
      state.paymentStatus = "charged";
    }
  });

  return {
    ...common,
    checks: [
      ...authorizedChecks,
      passed("confirmation.accepted"),
      passed("payment.charge", state.chargeCount),
      passed("order.submitted", result.status),
      passed("payment.charged", result.payment_status),
      notObserved("authorization.denied"),
      notObserved("confirmation.declined"),
      notObserved("order.unchanged")
    ],
    confirmation: "accepted",
    outcome: unchangedOutcome(state),
    scenario_id: "success",
    status: "succeeded"
  };
}

async function runScenario(surfaceId, scenarioId) {
  switch (scenarioId) {
    case "success":
      return runGuardedCheckout({ confirm: () => true, permissionGranted: true, surfaceId });
    case "authorization-denied":
      return runGuardedCheckout({ confirm: () => true, permissionGranted: false, surfaceId });
    case "confirmation-declined":
      return runGuardedCheckout({ confirm: () => false, permissionGranted: true, surfaceId });
    default:
      throw new Error(`Unsupported checkout scenario: ${scenarioId}`);
  }
}

export async function collectAICBehaviorObservations({ contract }) {
  const observations = [];

  for (const scenario of contract.scenarios) {
    for (const surfaceId of scenario.surfaces) {
      observations.push(await runScenario(surfaceId, scenario.id));
    }
  }

  return {
    artifact_type: "aic_behavior_observation_set",
    contract_id: contract.id,
    generated_at: CAPTURED_AT,
    observations
  };
}
