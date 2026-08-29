"use client";

import { useCallback, useRef, useState } from "react";
import {
  AICButton,
  AICForm,
  AICInput,
  useAICElement,
  useAICRegistry
} from "@aicorg/sdk-react/client";
import { useAICWebMCPTool } from "@aicorg/webmcp/react";
import {
  APPLY_COUPON_PROPS,
  CHECKOUT_SUMMARY_ACTION,
  CHECKOUT_SUMMARY_ELEMENT,
  COUPON_INPUT_PROPS,
  ORDER_LINES,
  SAVE_CART_PROPS,
  SUBMIT_ORDER_ACTION,
  SUBMIT_ORDER_ELEMENT,
  SUBMIT_ORDER_PROPS
} from "./checkout-contract.mjs";
import {
  CHECKOUT_REQUEST,
  authorizeCheckoutRequest,
  executeCheckoutDomainOperation,
  validateCheckoutRequest
} from "./checkout-operation.mjs";

interface CheckoutToolInput extends Record<string, unknown> {
  order_id: string;
  order_total: string;
  payment_method: string;
}

interface CheckoutToolResult {
  order_id: string;
  payment_status: "charged";
  status: "submitted";
}

type CheckoutFixtureExecution = "fail" | "recover" | "succeed";

interface CheckoutSummary {
  currency: "USD";
  item_count: 3;
  order_id: "ord_100245";
  order_total: "$177.00";
  payment_method: "Visa ending 4242";
  status: "draft" | "processing" | "submitted";
}

export function CheckoutDemoContent() {
  const registry = useAICRegistry();
  const [orderStatus, setOrderStatus] = useState<"draft" | "processing" | "submitted">("draft");
  const orderStatusRef = useRef<"draft" | "processing" | "submitted">("draft");
  const [paymentStatus, setPaymentStatus] = useState<"charged" | "unpaid">("unpaid");
  const [chargeCount, setChargeCount] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [auditCount, setAuditCount] = useState(0);
  const [recovered, setRecovered] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<
    "accepted" | "declined" | "not_reached"
  >("not_reached");
  const [lastErrorCode, setLastErrorCode] = useState("");
  const { attributes: checkoutSummaryAttributes } = useAICElement(
    {
      agentAction: "read",
      agentContractRef: CHECKOUT_SUMMARY_ACTION.name,
      agentDescription: CHECKOUT_SUMMARY_ELEMENT.description,
      agentId: CHECKOUT_SUMMARY_ELEMENT.id,
      agentLabel: CHECKOUT_SUMMARY_ELEMENT.label,
      agentRisk: CHECKOUT_SUMMARY_ELEMENT.risk,
      agentWorkflowStep: CHECKOUT_SUMMARY_ELEMENT.workflow_ref,
      state: {
        value: orderStatus,
        visible: true
      }
    },
    { role: "generic" }
  );

  const getCheckoutSummary = useCallback((): CheckoutSummary => ({
    currency: "USD",
    item_count: 3,
    order_id: "ord_100245",
    order_total: "$177.00",
    payment_method: "Visa ending 4242",
    status: orderStatus
  }), [orderStatus]);

  const summaryWebMCP = useAICWebMCPTool<Record<string, never>, CheckoutSummary>(
    () => ({
      action: CHECKOUT_SUMMARY_ACTION,
      element: CHECKOUT_SUMMARY_ELEMENT,
      execute: async () => getCheckoutSummary(),
      registry,
      tool: {
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false
        },
        description: "Read the currently displayed checkout summary without modifying the cart or order.",
        inputSchema: {
          additionalProperties: false,
          type: "object"
        },
        name: "get_checkout_summary",
        title: "Get checkout summary"
      },
      validate: async (input) => {
        if (Object.keys(input).length > 0) {
          throw new Error("get_checkout_summary does not accept input fields.");
        }
      }
    }),
    [getCheckoutSummary, registry]
  );

  const permissionGranted = useCallback(() => {
    return new URLSearchParams(window.location.search).get("aic_fixture_permission") !== "denied";
  }, []);

  const authorizeCheckout = useCallback((input: CheckoutToolInput) => {
    const allowed = authorizeCheckoutRequest(input, orderStatusRef.current, permissionGranted());
    if (!allowed) {
      setConfirmationResult("not_reached");
      setLastErrorCode("authorization_denied");
    }
    return allowed;
  }, [permissionGranted]);

  const confirmCheckout = useCallback((prompt: string) => {
    const accepted = window.confirm(prompt);
    setConfirmationResult(accepted ? "accepted" : "declined");
    setLastErrorCode(accepted ? "" : "confirmation_declined");
    return accepted;
  }, []);

  const fixtureExecution = useCallback((): CheckoutFixtureExecution => {
    const value = new URLSearchParams(window.location.search).get("aic_fixture_execution");
    return value === "fail" || value === "recover" ? value : "succeed";
  }, []);

  const completeOrder = useCallback(async (input: CheckoutToolInput): Promise<CheckoutToolResult> => {
    const executeAttempt = async (failBeforeCommit: boolean) => {
      setAttemptCount((count) => count + 1);
      return executeCheckoutDomainOperation(
        input,
        (status) => {
          orderStatusRef.current = status;
          setOrderStatus(status);
          if (status === "submitted") {
            setChargeCount((count) => count + 1);
            setAuditCount((count) => count + 1);
            setPaymentStatus("charged");
            setLastErrorCode("");
          }
        },
        { fail_before_commit: failBeforeCommit }
      );
    };

    const mode = fixtureExecution();
    if (mode === "recover") {
      try {
        await executeAttempt(true);
      } catch {
        setLastErrorCode("payment_provider_unavailable");
        setRecovered(true);
      }
      return executeAttempt(false);
    }

    try {
      return await executeAttempt(mode === "fail");
    } catch (error) {
      setLastErrorCode(
        error instanceof Error && "code" in error
          ? String(error.code)
          : "checkout_execution_failed"
      );
      throw error;
    }
  }, [fixtureExecution]);

  const checkoutWebMCP = useAICWebMCPTool<CheckoutToolInput, CheckoutToolResult>(
    () => ({
      action: SUBMIT_ORDER_ACTION,
      authorize: async (input) => authorizeCheckout(input),
      confirm: async (request) => confirmCheckout(request.prompt),
      element: SUBMIT_ORDER_ELEMENT,
      execute: async (input) => completeOrder(input),
      registry,
      tool: {
        annotations: {
          readOnlyHint: false,
          untrustedContentHint: false
        },
        description:
          "Validate and complete the currently displayed checkout after application authorization and human confirmation.",
        inputSchema: {
          additionalProperties: false,
          properties: {
            order_id: {
              const: "ord_100245",
              description: "The displayed order ID.",
              type: "string"
            },
            order_total: {
              const: "$177.00",
              description: "The displayed order total.",
              type: "string"
            },
            payment_method: {
              const: "Visa ending 4242",
              description: "The displayed payment method.",
              type: "string"
            }
          },
          required: ["order_id", "order_total", "payment_method"],
          type: "object"
        },
        name: "complete_checkout",
        title: "Complete checkout"
      },
      validate: async (input) => {
        validateCheckoutRequest(input);
      },
      verify: async (result) =>
        result.order_id === "ord_100245" &&
        result.payment_status === "charged" &&
        result.status === "submitted"
    }),
    [authorizeCheckout, completeOrder, confirmCheckout, registry]
  );

  const submitFromHumanUI = useCallback(async () => {
    validateCheckoutRequest(CHECKOUT_REQUEST);
    if (!authorizeCheckout(CHECKOUT_REQUEST)) {
      return;
    }

    if (!confirmCheckout("Charge Visa ending 4242 for $177.00 and submit order ord_100245?")) {
      return;
    }

    try {
      await completeOrder(CHECKOUT_REQUEST);
    } catch {
      // The fixture exposes the fail-closed state through the evidence element.
    }
  }, [authorizeCheckout, completeOrder, confirmCheckout]);

  return (
    <>
      <section style={{ display: "grid", gap: 10 }}>
        <span
          style={{
            color: "#a16207",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase"
          }}
        >
          Next.js Checkout Demo
        </span>
        <h1 style={{ fontSize: 46, lineHeight: 1.05, margin: 0 }}>
          Critical actions, async saves, validation, and entity-scoped line items
        </h1>
        <p style={{ fontSize: 18, margin: 0, maxWidth: 720 }}>
          This example stays intentionally small while proving the stronger AIC contract surface:
          structured confirmation, async execution and recovery, validation guidance, and
          row-scoped entity actions.
        </p>
      </section>

      <section
        style={{
          background: "rgba(255, 255, 255, 0.82)",
          border: "1px solid rgba(28, 25, 23, 0.08)",
          borderRadius: 24,
          display: "grid",
          gap: 16,
          padding: 24
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <h2 style={{ fontSize: 24, margin: 0 }}>Order lines</h2>
          {ORDER_LINES.map((line) => (
            <div
              key={line.removeProps.agentId}
              style={{
                alignItems: "center",
                border: "1px solid rgba(28, 25, 23, 0.08)",
                borderRadius: 18,
                display: "grid",
                gap: 8,
                gridTemplateColumns: "1fr auto auto",
                padding: "14px 16px"
              }}
            >
              <strong>{line.title}</strong>
              <span style={{ color: "#57534e", fontSize: 14 }}>Qty {line.quantity}</span>
              <span style={{ color: "#57534e", fontSize: 14 }}>{line.price}</span>
              <AICButton
                {...line.removeProps}
                style={{
                  background: "#ffedd5",
                  border: 0,
                  borderRadius: 999,
                  color: "#9a3412",
                  cursor: "pointer",
                  fontWeight: 700,
                  gridColumn: "1 / -1",
                  justifySelf: "start",
                  padding: "10px 14px"
                }}
                type="button"
              >
                Remove line
              </AICButton>
            </div>
          ))}
        </div>

        <AICForm
          agentDescription="Reviews and applies coupon codes before the order is submitted"
          agentId="checkout.discount_form"
          agentLabel="Discounts form"
          agentRisk="low"
          agentWorkflowStep="checkout.review.discount"
          style={{ display: "grid", gap: 12 }}
        >
          <h2 style={{ fontSize: 24, margin: 0 }}>Discounts</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <AICInput
              {...COUPON_INPUT_PROPS}
              placeholder="Enter coupon code"
              style={{
                border: "1px solid rgba(28, 25, 23, 0.14)",
                borderRadius: 12,
                flex: "1 1 220px",
                fontSize: 15,
                padding: "12px 14px"
              }}
            />
            <AICButton
              {...APPLY_COUPON_PROPS}
              style={{
                background: "#fed7aa",
                border: 0,
                borderRadius: 999,
                color: "#9a3412",
                cursor: "pointer",
                fontWeight: 700,
                padding: "12px 18px"
              }}
              type="button"
            >
              Apply coupon
            </AICButton>
          </div>
        </AICForm>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <AICButton
            {...SAVE_CART_PROPS}
            style={{
              background: "#fff7ed",
              border: "1px solid rgba(194, 65, 12, 0.14)",
              borderRadius: 999,
              color: "#9a3412",
              cursor: "pointer",
              fontSize: 16,
              fontWeight: 700,
              padding: "16px 24px"
            }}
            type="button"
          >
            Save cart
          </AICButton>
          <AICButton
            {...SUBMIT_ORDER_PROPS}
            disabled={orderStatus !== "draft"}
            onClick={() => void submitFromHumanUI()}
            style={{
              background: "#c2410c",
              border: 0,
              borderRadius: 999,
              color: "white",
              cursor: "pointer",
              fontSize: 16,
              fontWeight: 700,
              padding: "16px 24px"
            }}
            type="button"
          >
            Submit order
          </AICButton>
        </div>
        <div
          {...checkoutSummaryAttributes}
          aria-live="polite"
          data-aic-evidence="checkout-state"
          data-attempt-count={String(attemptCount)}
          data-audit-count={String(auditCount)}
          data-charge-count={String(chargeCount)}
          data-confirmation={confirmationResult}
          data-error-code={lastErrorCode}
          data-order-id="ord_100245"
          data-order-status={orderStatus}
          data-order-total="$177.00"
          data-payment-method="Visa ending 4242"
          data-payment-status={paymentStatus}
          data-recovered={String(recovered)}
          style={{ color: "#57534e", display: "flex", flexWrap: "wrap", gap: 16, fontSize: 14 }}
        >
          <span>Order: {orderStatus}</span>
          <span>Payment: {paymentStatus}; charges: {chargeCount}</span>
          <span>Attempts: {attemptCount}; audit events: {auditCount}</span>
          <span>
            WebMCP: summary {summaryWebMCP.status}; checkout {checkoutWebMCP.status}
          </span>
        </div>
      </section>

      <section
        style={{
          background: "#1c1917",
          borderRadius: 24,
          color: "#fafaf9",
          display: "grid",
          gap: 10,
          padding: 24
        }}
      >
        <span style={{ color: "#c4b5fd", fontSize: 12, fontWeight: 800, letterSpacing: "0.1em" }}>
          AIC BROWSER EVIDENCE
        </span>
        <h2 style={{ fontSize: 24, margin: 0 }}>Native browser parity: passed</h2>
        <p style={{ color: "#d6d3d1", margin: 0 }}>
          Real human controls and native document.modelContext tools produced ten executed
          observations with zero findings across success, authorization denial, confirmation
          decline, isolated business failure, and exactly-once recovery. The deterministic domain
          harness remains a faster lower-level check.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <a href="/aic-browser-conformance-result" style={{ color: "#ddd6fe", fontWeight: 700 }}>
            Inspect checkout conformance
          </a>
          <a href="/aic-browser-proof" style={{ color: "#ddd6fe", fontWeight: 700 }}>
            Inspect browser proof
          </a>
          <a href="/aic-browser-observations" style={{ color: "#ddd6fe", fontWeight: 700 }}>
            Inspect raw observations
          </a>
          <a href="/aic-proof" style={{ color: "#ddd6fe", fontWeight: 700 }}>
            Inspect deterministic proof
          </a>
        </div>
      </section>
    </>
  );
}
