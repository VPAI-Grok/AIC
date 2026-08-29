import {
  CHECKOUT_REQUEST,
  authorizeCheckoutRequest,
  executeCheckoutDomainOperation,
  validateCheckoutRequest
} from "./app/checkout-operation.mjs";

const CAPTURED_AT = "2026-08-28T00:00:00.000Z";
const OPERATION_ID = "checkout.complete.domain";

function passed(requirement_id, condition = true, actual = true) {
  return {
    actual,
    passed: Boolean(condition),
    requirement_id,
    ...(condition ? {} : { message: `Deterministic evidence did not satisfy ${requirement_id}.` })
  };
}

function forbidden(requirement_id, absent, actual = false) {
  return {
    actual,
    passed: !absent,
    requirement_id,
    ...(absent ? {} : { message: `Deterministic evidence unexpectedly observed ${requirement_id}.` })
  };
}

function outcome(state) {
  return {
    order_id: CHECKOUT_REQUEST.order_id,
    order_status: state.orderStatus,
    payment_status: state.paymentStatus
  };
}

function exactScope(state) {
  return (
    state.request.order_id === CHECKOUT_REQUEST.order_id &&
    state.request.order_total === CHECKOUT_REQUEST.order_total &&
    state.request.payment_method === CHECKOUT_REQUEST.payment_method
  );
}

function unchanged(state) {
  return (
    state.orderStatus === "draft" &&
    state.paymentStatus === "unpaid" &&
    state.chargeCount === 0 &&
    state.auditCount === 0
  );
}

function committedExactlyOnce(state) {
  return (
    state.orderStatus === "submitted" &&
    state.paymentStatus === "charged" &&
    state.chargeCount === 1 &&
    state.auditCount === 1
  );
}

function createState() {
  return {
    attemptCount: 0,
    auditCount: 0,
    chargeCount: 0,
    failureCode: "",
    orderStatus: "draft",
    paymentStatus: "unpaid",
    recovered: false,
    request: CHECKOUT_REQUEST
  };
}

async function executeAttempt(state, failBeforeCommit) {
  state.attemptCount += 1;
  try {
    return await executeCheckoutDomainOperation(
      state.request,
      (status) => {
        state.orderStatus = status;
        if (status === "submitted") {
          state.chargeCount += 1;
          state.auditCount += 1;
          state.paymentStatus = "charged";
        }
      },
      { fail_before_commit: failBeforeCommit }
    );
  } catch (error) {
    state.failureCode =
      error instanceof Error && "code" in error
        ? String(error.code)
        : "checkout_execution_failed";
    throw error;
  }
}

function commonObservation(surfaceId, scenarioId) {
  return {
    artifact_type: "aic_behavior_observation",
    captured_at: CAPTURED_AT,
    contract_id: "checkout.complete.behavior",
    environment: {
      fixture: "nextjs-checkout-demo",
      scenario: scenarioId,
      surface: surfaceId
    },
    evidence: [{ kind: "trace", ref: `checkout-trace:${scenarioId}:${surfaceId}` }],
    mode: "executed",
    operation_id: OPERATION_ID,
    surface_id: surfaceId
  };
}

async function runGuardedCheckout({ confirm, executionMode, permissionGranted, scenarioId, surfaceId }) {
  const state = createState();
  const common = commonObservation(surfaceId, scenarioId);

  validateCheckoutRequest(state.request);
  const initialChecks = [
    passed("order.is_draft", state.orderStatus === "draft", state.orderStatus),
    passed("checkout.exact_scope", exactScope(state), state.request)
  ];

  if (!authorizeCheckoutRequest(state.request, state.orderStatus, permissionGranted)) {
    return {
      ...common,
      checks: [
        ...initialChecks,
        passed("authorization.denied"),
        passed("order.unchanged", unchanged(state), outcome(state)),
        forbidden("authorization.allowed", true),
        forbidden("confirmation.accepted", true),
        forbidden("confirmation.declined", true),
        forbidden("payment.idempotent", true),
        forbidden("execution.failure_isolated", true),
        forbidden("payment.charge", state.chargeCount === 0, state.chargeCount),
        forbidden("order.submitted", state.orderStatus !== "submitted", state.orderStatus),
        forbidden("payment.charged", state.paymentStatus !== "charged", state.paymentStatus),
        forbidden("checkout.audit_recorded", state.auditCount === 0, state.auditCount),
        forbidden("checkout.safe_recovery", !state.recovered, state.recovered)
      ],
      confirmation: "not_reached",
      error_code: "authorization_denied",
      outcome: outcome(state),
      scenario_id: scenarioId,
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
        passed("order.unchanged", unchanged(state), outcome(state)),
        forbidden("authorization.denied", true),
        forbidden("confirmation.accepted", true),
        forbidden("payment.idempotent", true),
        forbidden("execution.failure_isolated", true),
        forbidden("payment.charge", state.chargeCount === 0, state.chargeCount),
        forbidden("order.submitted", state.orderStatus !== "submitted", state.orderStatus),
        forbidden("payment.charged", state.paymentStatus !== "charged", state.paymentStatus),
        forbidden("checkout.audit_recorded", state.auditCount === 0, state.auditCount),
        forbidden("checkout.safe_recovery", !state.recovered, state.recovered)
      ],
      confirmation: "declined",
      error_code: "confirmation_declined",
      outcome: outcome(state),
      scenario_id: scenarioId,
      status: "cancelled"
    };
  }

  const confirmedChecks = [...authorizedChecks, passed("confirmation.accepted")];

  if (executionMode === "fail") {
    try {
      await executeAttempt(state, true);
      throw new Error("The checkout failure fixture unexpectedly committed.");
    } catch (error) {
      if (state.failureCode !== "payment_provider_unavailable") throw error;
    }
    const isolated = unchanged(state) && state.attemptCount === 1;
    return {
      ...common,
      checks: [
        ...confirmedChecks,
        passed("execution.failure_isolated", isolated, {
          attempt_count: state.attemptCount,
          audit_count: state.auditCount,
          charge_count: state.chargeCount,
          error_code: state.failureCode
        }),
        passed("order.unchanged", unchanged(state), outcome(state)),
        forbidden("authorization.denied", true),
        forbidden("confirmation.declined", true),
        forbidden("payment.idempotent", true),
        forbidden("payment.charge", state.chargeCount === 0, state.chargeCount),
        forbidden("order.submitted", state.orderStatus !== "submitted", state.orderStatus),
        forbidden("payment.charged", state.paymentStatus !== "charged", state.paymentStatus),
        forbidden("checkout.audit_recorded", state.auditCount === 0, state.auditCount),
        forbidden("checkout.safe_recovery", !state.recovered, state.recovered)
      ],
      confirmation: "accepted",
      error_code: state.failureCode,
      outcome: outcome(state),
      scenario_id: scenarioId,
      status: "failed"
    };
  }

  if (executionMode === "recover") {
    try {
      await executeAttempt(state, true);
      throw new Error("The checkout recovery fixture did not exercise its failure path.");
    } catch (error) {
      if (state.failureCode !== "payment_provider_unavailable") throw error;
      state.recovered = true;
    }
    await executeAttempt(state, false);
    const once = committedExactlyOnce(state) && state.attemptCount === 2;
    return {
      ...common,
      checks: [
        ...confirmedChecks,
        passed("execution.failure_isolated", state.recovered && state.failureCode === "payment_provider_unavailable", {
          first_attempt_error: state.failureCode
        }),
        passed("payment.idempotent", once, {
          attempt_count: state.attemptCount,
          audit_count: state.auditCount,
          charge_count: state.chargeCount
        }),
        passed("payment.charge", state.chargeCount === 1, state.chargeCount),
        passed("order.submitted", state.orderStatus === "submitted", state.orderStatus),
        passed("payment.charged", state.paymentStatus === "charged", state.paymentStatus),
        passed("checkout.audit_recorded", state.auditCount === 1, state.auditCount),
        passed("checkout.safe_recovery", once && state.recovered, {
          attempt_count: state.attemptCount,
          recovered: state.recovered
        }),
        forbidden("authorization.denied", true),
        forbidden("confirmation.declined", true),
        forbidden("order.unchanged", !unchanged(state), outcome(state))
      ],
      confirmation: "accepted",
      outcome: outcome(state),
      scenario_id: scenarioId,
      status: "recovered"
    };
  }

  await executeAttempt(state, false);
  const once = committedExactlyOnce(state) && state.attemptCount === 1;
  return {
    ...common,
    checks: [
      ...confirmedChecks,
      passed("payment.idempotent", once, {
        attempt_count: state.attemptCount,
        audit_count: state.auditCount,
        charge_count: state.chargeCount
      }),
      passed("payment.charge", state.chargeCount === 1, state.chargeCount),
      passed("order.submitted", state.orderStatus === "submitted", state.orderStatus),
      passed("payment.charged", state.paymentStatus === "charged", state.paymentStatus),
      passed("checkout.audit_recorded", state.auditCount === 1, state.auditCount),
      forbidden("authorization.denied", true),
      forbidden("confirmation.declined", true),
      forbidden("execution.failure_isolated", state.failureCode === "", state.failureCode),
      forbidden("order.unchanged", !unchanged(state), outcome(state)),
      forbidden("checkout.safe_recovery", !state.recovered, state.recovered)
    ],
    confirmation: "accepted",
    outcome: outcome(state),
    scenario_id: scenarioId,
    status: "succeeded"
  };
}

async function runScenario(surfaceId, scenarioId) {
  switch (scenarioId) {
    case "success":
      return runGuardedCheckout({ confirm: () => true, executionMode: "succeed", permissionGranted: true, scenarioId, surfaceId });
    case "authorization-denied":
      return runGuardedCheckout({ confirm: () => true, executionMode: "succeed", permissionGranted: false, scenarioId, surfaceId });
    case "confirmation-declined":
      return runGuardedCheckout({ confirm: () => false, executionMode: "succeed", permissionGranted: true, scenarioId, surfaceId });
    case "business-failure":
      return runGuardedCheckout({ confirm: () => true, executionMode: "fail", permissionGranted: true, scenarioId, surfaceId });
    case "recovery":
      return runGuardedCheckout({ confirm: () => true, executionMode: "recover", permissionGranted: true, scenarioId, surfaceId });
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
