import { describe, expect, it } from "vitest";

import { EMPTY_VIEW, outcomeOfRead } from "./read-outcome";
import type { ApiCartView } from "../data/cart-api";

/**
 * WHAT A CART READ MEANS FOR WHAT IS ON SCREEN.
 *
 * The provider only ever read the cart ONCE, in a mount effect, so this rule
 * had nowhere it could be wrong: the view it might have cleared was already
 * empty. Reading again — after a payment comes back captured — is what makes
 * every branch load-bearing, and `gone` is the branch the stale badge was
 * hiding in.
 *
 * A plain module for the reason `sellable.ts` is one: the suite is
 * `environment: "node"` (see `vitest.config.mts`), so a decision worth
 * asserting has to live outside the component that uses it.
 */

const FULL: ApiCartView = {
  cart: { id: "crt_full", currency: "NGN", status: "open", revision: 4 },
  lines: [
    {
      id: "crl_one",
      variantId: "var_one",
      qty: 2,
      available: true,
      sku: "PLA-BLK-1KG",
      title: "PLA Basic — Black, 1kg",
      optionValues: { colour: "black", size: "1kg" },
      unit: { amount: 2300000, currency: "NGN" },
      inStock: 9,
    },
  ],
  preview: null,
  changes: [],
};

describe("outcomeOfRead", () => {
  it("adopts the cart the server sent", () => {
    expect(outcomeOfRead({ ok: true, view: FULL }).view).toBe(FULL);
  });

  it("clears the basket when the server says the cart is gone", () => {
    /* THE STALE BADGE, IN ONE ASSERTION. A cart that became an order answers
       404, and leaving the previous view on screen is how a paid-for basket
       kept its count until the shopper reloaded the page by hand. */
    expect(outcomeOfRead({ ok: false, reason: "gone" }).view).toEqual(EMPTY_VIEW);
  });

  it("says nothing when the cart is gone, because checking out is not an error", () => {
    expect(outcomeOfRead({ ok: false, reason: "gone" }).problem).toBeNull();
  });

  it("keeps what is on screen when nothing was reached", () => {
    /* A READ THAT FAILED IS NOT AN EMPTY CART — null means "leave the basket
       alone", which is the rule that stops a dropped connection from looking
       like a cart being thrown away. */
    expect(outcomeOfRead({ ok: false, reason: "offline" }).view).toBeNull();
  });

  it("explains itself when nothing was reached", () => {
    expect(outcomeOfRead({ ok: false, reason: "offline" }).problem).toBeTruthy();
  });

  it("keeps what is on screen when the server refused the read", () => {
    expect(outcomeOfRead({ ok: false, reason: "refused", status: 500 }).view).toBeNull();
  });

  it("explains itself when the server refused the read", () => {
    expect(outcomeOfRead({ ok: false, reason: "refused", status: 500 }).problem).toBeTruthy();
  });
});
