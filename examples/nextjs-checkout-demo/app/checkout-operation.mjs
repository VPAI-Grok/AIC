/**
 * @typedef {{ order_id: string; order_total: string; payment_method: string }} CheckoutRequest
 * @typedef {{ order_id: string; payment_status: "charged"; status: "submitted" }} CheckoutResult
 */

export const CHECKOUT_REQUEST = /** @type {Readonly<CheckoutRequest>} */ (
  Object.freeze({
    order_id: "ord_100245",
    order_total: "$177.00",
    payment_method: "Visa ending 4242"
  })
);

/**
 * Validate that a request refers to the checkout the user can currently review.
 *
 * @param {CheckoutRequest} input
 */
export function validateCheckoutRequest(input) {
  if (
    input.order_id !== CHECKOUT_REQUEST.order_id ||
    input.order_total !== CHECKOUT_REQUEST.order_total ||
    input.payment_method !== CHECKOUT_REQUEST.payment_method
  ) {
    throw new Error("The requested checkout does not match the displayed order.");
  }
}

/**
 * Keep entity state and caller permission in one reusable authorization boundary.
 *
 * @param {CheckoutRequest} input
 * @param {string} orderStatus
 * @param {boolean} [permissionGranted]
 */
export function authorizeCheckoutRequest(input, orderStatus, permissionGranted = true) {
  return (
    permissionGranted &&
    input.order_id === CHECKOUT_REQUEST.order_id &&
    orderStatus === "draft"
  );
}

/**
 * The one domain operation used after either the human UI or WebMCP guardrails pass.
 *
 * @param {CheckoutRequest} input
 * @param {(status: "processing" | "submitted") => void} [transition]
 * @returns {Promise<CheckoutResult>}
 */
export async function executeCheckoutDomainOperation(input, transition = () => undefined) {
  validateCheckoutRequest(input);
  transition("processing");
  await Promise.resolve();

  const result = /** @type {CheckoutResult} */ ({
    order_id: input.order_id,
    payment_status: "charged",
    status: "submitted"
  });

  transition(result.status);
  return result;
}
