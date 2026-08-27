import type { PaymentIntent } from "../data/checkout-api";

/**
 * Whether a payment's status means this browser's basket has been spent.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DANGEROUS MISTAKE HERE IS NOT MISSING `captured`.
 *
 * It is treating any TERMINAL status as spent, and so emptying the basket of
 * somebody whose card was declined. `/checkout/complete` tells that shopper
 * "Your cart still has the items — go back and try again", with a Back to cart
 * button under it; both are only true while nothing has cleared the cart on
 * their behalf. A cancelled or failed payment must leave the basket exactly
 * where it was.
 *
 * `PaymentIntent["status"]` is an OPEN union — the API may name a state this
 * build predates — so this answers on the one status it recognises and lets
 * everything else fall to false. Being wrong that way costs a badge that
 * corrects itself on the next read; being wrong the other way deletes a cart
 * nobody paid for.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A plain module for the reason `sellable.ts` is one: the page that acts on
 * this is a client component, and this suite is `environment: "node"`.
 */
export function basketIsSpent(status: PaymentIntent["status"]): boolean {
  return status === "captured";
}
