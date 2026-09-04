import { describe, expect, it } from "vitest";

import { majorUnits, type ApiMoney } from "./cart-api";
import { formatNaira } from "./money";
import { formatMinor } from "./format-money";
import { sizesFrom, type ApiVariant } from "./api";
import type { Order } from "./orders-api";

/**
 * THE TWO MONEY CONVENTIONS, PINNED SIDE BY SIDE.
 *
 * One system, two spellings, and they have been confused once already:
 *
 *   cart / checkout  →  `{ amount, currency }`   (`ApiMoney`)
 *   order            →  a plain number, with one `currency` on the order
 *
 * Both are MINOR UNITS: 100 per naira, so ₦3,000 is `300000`. Reading an
 * order field as if it were `ApiMoney` renders `[object Object]`; reading a
 * cart field as if it were a plain number is a 100x error that renders as a
 * perfectly plausible price. Neither throws. This file exists so that the next
 * person to touch either one has to change a failing assertion rather than
 * find out in production.
 */

const NAIRA = 100; // minor units per naira

describe("minor units", () => {
  it("is 100 per naira", () => {
    expect(majorUnits({ amount: 3000 * NAIRA, currency: "NGN" })).toBe(3000);
    expect(formatNaira(majorUnits({ amount: 300000, currency: "NGN" }))).toBe("₦3,000");
  });
});

describe("cart / checkout money is an object", () => {
  it("takes `{ amount, currency }` and converts to whole naira", () => {
    const unit: ApiMoney = { amount: 2300000, currency: "NGN" };
    expect(majorUnits(unit)).toBe(23000);
    expect(formatNaira(majorUnits(unit))).toBe("₦23,000");
  });

  it("treats an absent price as zero rather than NaN", () => {
    expect(majorUnits(null)).toBe(0);
    expect(formatNaira(majorUnits(null))).toBe("₦0");
  });

  it("rounds rather than truncating a sub-naira remainder", () => {
    expect(majorUnits({ amount: 250, currency: "NGN" })).toBe(3);
    expect(majorUnits({ amount: 249, currency: "NGN" })).toBe(2);
  });
});

describe("order money is a plain number", () => {
  const order = {
    currency: "NGN",
    subtotal: 2300000,
    shippingTotal: 150000,
    taxTotal: 0,
    grandTotal: 2450000,
    refundedTotal: 0,
  } as Order;

  /* This is exactly how `orders-list.tsx` and `order-detail.tsx` render an
     order total: wrap the plain number with the order's own currency, THEN
     convert. Not `formatNaira(order.grandTotal)`, which is 100x too big. */
  it("is wrapped with the order's currency before conversion", () => {
    const naira = (minor: number) => formatNaira(majorUnits({ amount: minor, currency: order.currency }));
    expect(naira(order.grandTotal)).toBe("₦24,500");
    expect(naira(order.subtotal)).toBe("₦23,000");
    expect(naira(order.shippingTotal)).toBe("₦1,500");
  });

  it("formatting the raw field is the 100x bug this convention invites", () => {
    // Documented, not endorsed: ₦24,500 mis-renders as ₦2,450,000.
    expect(formatNaira(order.grandTotal)).toBe("₦2,450,000");
    expect(formatNaira(order.grandTotal)).not.toBe("₦24,500");
  });

  it("an order field is a number, never an ApiMoney object", () => {
    // The `[object Object]` failure begins here: if this ever becomes an
    // object, every `naira()` call site above silently stops working.
    expect(typeof order.grandTotal).toBe("number");
  });
});

describe("sizesFrom — which now carries minor units and their currency, and converts nothing", () => {
  const variant = (over: Partial<ApiVariant>): ApiVariant =>
    ({
      id: "v",
      sku: "sku",
      optionValues: { Weight: "1 kg" },
      position: 0,
      weightGrams: null,
      status: "active",
      colorHex: null,
      price: { amount: 1850000, currency: "NGN" },
      available: 5,
      backorderable: false,
      ...over,
    }) as ApiVariant;

  it("carries the API's minor units through UNCONVERTED, with their currency", () => {
    /* ═══ THIS ASSERTION USED TO SAY THE OPPOSITE, AND THAT IS THE CHANGE ═══
       `sizesFrom` was "the one place minor units become whole naira": it did
       `Math.round(minor / 100)` and dropped the currency. That made a dollar
       price unrenderable — $49.99 arrived as the number 50 and drew as `₦50`.
       The division now happens at RENDER, in `formatMoney`, where the currency
       is still attached and its own precision is known. */
    const [size] = sizesFrom([variant({})]);
    expect(size.priceMinor).toBe(1850000);
    expect(size.currency).toBe("NGN");
    expect(formatMinor(size.priceMinor, size.currency)).toBe("₦18,500");
  });

  it("reads the currency off the variant rather than assuming the shop's", () => {
    const [size] = sizesFrom([variant({ price: { amount: 4999, currency: "USD" } })]);
    expect(size.currency).toBe("USD");
    /* The whole point: the same pipeline that renders ₦18,500 renders $49.99,
       cents intact. Through the old one this was `₦50`. */
    expect(formatMinor(size.priceMinor, size.currency)).toBe("$49.99");
  });

  it("falls back to naira for a currency this build cannot render", () => {
    /* No symbol and no precision rule for it, so a figure printed beside it
       would have no stated denomination. */
    const [size] = sizesFrom([variant({ price: { amount: 4999, currency: "GHS" } })]);
    expect(size.currency).toBe("NGN");
  });

  it("keeps the cheapest priced variant for a repeated weight", () => {
    const sizes = sizesFrom([
      variant({ id: "a", price: { amount: 1850000, currency: "NGN" } }),
      variant({ id: "b", price: { amount: 1700000, currency: "NGN" } }),
    ]);
    expect(sizes).toHaveLength(1);
    expect(sizes[0].priceMinor).toBe(1700000);
  });

  /* An unpriced variant is a real state, and it is NOT a size: offering it
     would put a row in the buy box that cannot be added to a cart. Upstream,
     `toProduct` drops a product with no priced weight at all, because
     `cheapestSize()` reduces with no initial value and throws on []. */
  it("drops unpriced variants entirely", () => {
    expect(sizesFrom([variant({ price: null })])).toEqual([]);
    const sizes = sizesFrom([
      variant({ id: "a", price: null }),
      variant({ id: "b", optionValues: { Weight: "250 g" } }),
    ]);
    expect(sizes.map((s) => s.label)).toEqual(["250 g"]);
  });

  it("sorts ascending by price", () => {
    const sizes = sizesFrom([
      variant({ id: "a", optionValues: { Weight: "1 kg" }, price: { amount: 1850000, currency: "NGN" } }),
      variant({ id: "b", optionValues: { Weight: "250 g" }, price: { amount: 650000, currency: "NGN" } }),
    ]);
    expect(sizes.map((s) => s.priceMinor)).toEqual([650000, 1850000]);
  });

  it("rounds at RENDER now, not on the way in, and no float reaches the screen", () => {
    /* The rounding did not disappear, it moved. `sizesFrom` keeps exactly what
       the server sent; `formatMinor` applies the currency's own precision — 0
       decimals for naira, so ₦999.99 of kobo still prints as `₦1,000`. */
    const [size] = sizesFrom([variant({ price: { amount: 99999, currency: "NGN" } })]);
    expect(size.priceMinor).toBe(99999);
    expect(formatMinor(size.priceMinor, size.currency)).toBe("₦1,000");
  });
});
