/**
 * @typedef {{ order_id: string; order_total: string; payment_method: string }} CheckoutRequest
 * @typedef {{ order_id: string; payment_status: "charged"; status: "submitted" }} CheckoutResult
 * @typedef {{ fail_before_commit?: boolean }} CheckoutExecutionOptions
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

export class CheckoutExecutionError extends Error {
  /** @type {string} */
  code;

  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = "CheckoutExecutionError";
    this.code = code;
  }
}

/**
 * The one domain operation used after either the human UI or WebMCP guardrails pass.
 *
 * @param {CheckoutRequest} input
 * @param {(status: "draft" | "processing" | "submitted") => void} [transition]
 * @param {CheckoutExecutionOptions} [options]
 * @returns {Promise<CheckoutResult>}
 */
export async function executeCheckoutDomainOperation(
  input,
  transition = () => undefined,
  options = {}
) {
  validateCheckoutRequest(input);
  transition("processing");
  await Promise.resolve();

  if (options.fail_before_commit) {
    transition("draft");
    throw new CheckoutExecutionError(
      "payment_provider_unavailable",
      "The payment provider was unavailable before the charge committed."
    );
  }

  const result = /** @type {CheckoutResult} */ ({
    order_id: input.order_id,
    payment_status: "charged",
    status: "submitted"
  });

  transition(result.status);
  return result;
}
