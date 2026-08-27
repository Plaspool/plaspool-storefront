import { describe, expect, it } from "vitest";

import { basketIsSpent } from "./basket-spent";

/**
 * WHICH PAYMENT OUTCOMES RETIRE THE BASKET, AND — the half that matters more —
 * WHICH MUST LEAVE IT ALONE.
 *
 * `/checkout/complete` tells a declined shopper "Your cart still has the items
 * — go back and try again", and the Back to cart button next to that sentence
 * is only true while nothing has emptied the cart on their behalf. So the
 * dangerous mistake here is not missing `captured`; it is treating any
 * terminal status as spent and quietly deleting the basket of somebody whose
 * card was refused.
 *
 * Asserted as a plain predicate rather than through the page, because the page
 * is a client component and this suite is `environment: "node"`.
 */

describe("basketIsSpent", () => {
  it("is spent once the payment is captured", () => {
    expect(basketIsSpent("captured")).toBe(true);
  });

  it("is not spent while the provider has not taken the money yet", () => {
    expect(basketIsSpent("requires_payment")).toBe(false);
  });

  it("is not spent when the payment was cancelled, so the retry still has a cart", () => {
    expect(basketIsSpent("cancelled")).toBe(false);
  });

  it("is not spent when the payment failed, so the retry still has a cart", () => {
    expect(basketIsSpent("failed")).toBe(false);
  });

  it("is not spent on a status this storefront has never heard of", () => {
    /* `PaymentIntent["status"]` is an open union — the API may name a state
       this build predates. Unknown must fall to "leave the basket alone": the
       cost of being wrong the other way is deleting a cart nobody paid for. */
    expect(basketIsSpent("something_new")).toBe(false);
  });
});
