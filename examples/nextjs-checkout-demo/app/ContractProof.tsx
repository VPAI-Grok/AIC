import { AICButton, AICInput } from "@aicorg/sdk-react/client";

export function ContractProof() {
  return (
    <>
      <AICInput
        agentDescription="Edits the coupon code before checkout discounts are applied"
        agentId="checkout.coupon_code"
        agentLabel="Coupon code"
        agentRisk="low"
        agentValidation={{
          examples: ["SPRING20", "SHIPFREE"],
          format: "uppercase_code",
          max_length: 16,
          min_length: 5,
          pattern: "^[A-Z0-9]+$"
        }}
        agentWorkflowStep="checkout.review.discount"
      />
      <AICButton
        agentAction="submit"
        agentDescription="Applies the current coupon code to the in-progress checkout"
        agentEffects={["order.discount.recalculated = true"]}
        agentExecution={{
          estimated_latency_ms: 1200,
          settled_when: ["summary.discount.updated = true"]
        }}
        agentId="checkout.apply_coupon"
        agentLabel="Apply coupon"
        agentRisk="low"
        agentWorkflowStep="checkout.review.discount"
      >
        Apply coupon
      </AICButton>
      <AICButton
        agentAction="click"
        agentDescription="Saves the current cart, shipping, and payment selections without charging the order"
        agentEffects={["cart.snapshot_saved", "toast.visible"]}
        agentExecution={{
          estimated_latency_ms: 1800,
          settled_when: ["toast.visible = true"]
        }}
        agentId="checkout.save_cart"
        agentLabel="Save cart"
        agentRecovery={{
          error_code: "cart_save_timeout",
          recovery: "retry_save_cart",
          retry_after_ms: 3000,
          retryable: true
        }}
        agentRisk="medium"
        agentWorkflowStep="checkout.review.save"
      >
        Save cart
      </AICButton>
      <AICButton
        agentAction="submit"
        agentContractRef="checkout.complete"
        agentConfirmation={{
          prompt_template: "Charge {{payment_method}} for {{order_total}} and submit order {{order_id}}?",
          summary_fields: ["order_total", "payment_method"],
          type: "human_review"
        }}
        agentDescription="Completes checkout and charges the selected payment method"
        agentEntityId="ord_100245"
        agentEntityLabel="Order #100245"
        agentEntityType="order"
        agentEffects={["payment.charge", "order.status=submitted"]}
        agentExecution={{
          estimated_latency_ms: 4000,
          settled_when: ["navigation.pathname = '/checkout/success'"]
        }}
        agentId="checkout.submit_order"
        agentLabel="Submit order"
        agentPermissions={["checkout.submit_order"]}
        agentRequiresConfirmation
        agentRisk="critical"
        agentWorkflowStep="checkout.review.submit"
      >
        Submit order
      </AICButton>
      <AICButton
        agentAction="click"
        agentDescription="Removes the Starter Kit line before submitting the order"
        agentEffects={["order.lines -= 1", "order.total.recalculated = true"]}
        agentEntityId="line_starter_kit"
        agentEntityLabel="Starter Kit"
        agentEntityType="order_line"
        agentId="checkout.order_line.remove.line_starter_kit"
        agentLabel="Remove Starter Kit"
        agentRisk="medium"
        agentWorkflowStep="checkout.review.items"
      >
        Remove Starter Kit
      </AICButton>
    </>
  );
}
