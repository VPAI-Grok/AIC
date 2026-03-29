import { AICButton, AICInput } from "@aic/sdk-react/client";

export function ContractProof() {
  return (
    <>
      <AICInput
        agentDescription="Edits the coupon code before checkout discounts are applied"
        agentId="checkout.coupon_code"
        agentLabel="Coupon code"
        agentRisk="low"
      />
      <AICButton
        agentAction="submit"
        agentDescription="Applies the current coupon code to the in-progress checkout"
        agentId="checkout.apply_coupon"
        agentRisk="low"
      >
        Apply coupon
      </AICButton>
      <AICButton
        agentAction="click"
        agentDescription="Saves the current cart, shipping, and payment selections without charging the order"
        agentId="checkout.save_cart"
        agentRisk="medium"
      >
        Save cart
      </AICButton>
      <AICButton
        agentAction="submit"
        agentDescription="Completes checkout and charges the selected payment method"
        agentId="checkout.submit_order"
        agentRisk="critical"
      >
        Submit order
      </AICButton>
      <AICButton
        agentAction="click"
        agentDescription="Removes the Starter Kit line before submitting the order"
        agentId="checkout.order_line.remove.line_starter_kit"
        agentRisk="medium"
      >
        Remove Starter Kit
      </AICButton>
    </>
  );
}
