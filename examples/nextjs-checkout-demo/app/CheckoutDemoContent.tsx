"use client";

import { AICButton, AICForm, AICInput } from "@aic/sdk-react/client";
import {
  APPLY_COUPON_PROPS,
  COUPON_INPUT_PROPS,
  ORDER_LINES,
  SAVE_CART_PROPS,
  SUBMIT_ORDER_PROPS
} from "./checkout-contract.mjs";

export function CheckoutDemoContent() {
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
      </section>
    </>
  );
}
