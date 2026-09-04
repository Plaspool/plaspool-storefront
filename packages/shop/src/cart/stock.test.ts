import { describe, expect, it } from "vitest";

import { MAX_LINE_QTY, maxQtyFor, maxQtyForLine, stockOf, stockWarning } from "./stock";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT: a stepper that went to 99 beside a variant with four on the
 * shelf, and a refusal that arrived only at the checkout freeze.
 *
 * Every case below is one of the four states the API can actually be in about
 * a variant's shelf — a count, no count at all, a backorder, and an oversold
 * backorder whose count has gone NEGATIVE. The last two are the ones that make
 * a naive `Math.min(stock, 99)` wrong rather than merely conservative: they
 * would cap a variant the shop is deliberately selling past zero at zero, and a
 * stepper capped at zero has a `max` below its `min`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

describe("maxQtyFor", () => {
  it("caps at the shelf when the count is tracked", () => {
    expect(maxQtyFor({ available: 4, backorderable: false })).toBe(4);
  });

  it("keeps the sanity ceiling when the shelf is deeper than it", () => {
    expect(maxQtyFor({ available: 4000, backorderable: false })).toBe(MAX_LINE_QTY);
  });

  /* `available: null` is "no inventory row", which `api.ts` is explicit is not
     the same claim as zero. Reading it as zero would cap every untracked
     product in the shop at one. */
  it("does not cap an untracked variant", () => {
    expect(maxQtyFor({ available: null, backorderable: false })).toBe(MAX_LINE_QTY);
  });

  it("does not cap a backorderable variant", () => {
    expect(maxQtyFor({ available: 0, backorderable: true })).toBe(MAX_LINE_QTY);
  });

  /* THE ONE THAT LOOKS LIKE CORRUPT DATA AND IS NOT. An oversold backorder
     records itself as a negative `available`; the admin's own inventory module
     says so. Clamping it to a stock ceiling would refuse an order the shop
     wants. */
  it("does not cap an oversold backorder, whose count is negative", () => {
    expect(maxQtyFor({ available: -3, backorderable: true })).toBe(MAX_LINE_QTY);
  });

  /* A `max` under the stepper's `min` inverts its clamp. Nothing with no stock
     should reach a stepper at all — it leaves the basket as `unsellable` — but
     the control must stay coherent if one ever does. */
  it("never returns a ceiling below one", () => {
    expect(maxQtyFor({ available: 0, backorderable: false })).toBe(1);
    expect(maxQtyFor({ available: -5, backorderable: false })).toBe(1);
  });

  it("does not cap when the catalogue says nothing about the variant", () => {
    expect(maxQtyFor(null)).toBe(MAX_LINE_QTY);
    expect(maxQtyFor(undefined)).toBe(MAX_LINE_QTY);
  });
});

describe("maxQtyForLine", () => {
  /* THE SPLIT THIS MODULE EXISTS FOR. The count is the LINE's, because a cart
     read is live; the flag is the CATALOGUE's, because a cart line does not
     carry one. A test that fed both from the same place would pass while the
     shipped code read the hour-old number. */
  it("prefers the line's live count over the catalogue's stale one", () => {
    expect(maxQtyForLine(2, { available: 40, backorderable: false })).toBe(2);
  });

  it("still honours the catalogue's backorder flag", () => {
    expect(maxQtyForLine(0, { available: 0, backorderable: true })).toBe(MAX_LINE_QTY);
  });

  it("does not cap a line the API tracks no stock for", () => {
    expect(maxQtyForLine(null, { available: 4, backorderable: false })).toBe(MAX_LINE_QTY);
  });

  /* A line whose variant the catalogue cannot explain has no flag to read. It
     must not become a backorder by default — that is the permissive direction,
     and it is how a cap silently stops applying. */
  it("treats an unknown variant as not backorderable", () => {
    expect(maxQtyForLine(3, null)).toBe(3);
  });
});

describe("stockOf", () => {
  const entry = {
    variantStock: {
      "black:1kg": { available: 4, backorderable: false },
    },
  };

  it("finds a variant by the colour and size that name it", () => {
    expect(stockOf(entry, "black", "1kg")).toEqual({ available: 4, backorderable: false });
  });

  it("answers null for a pair that is not for sale", () => {
    expect(stockOf(entry, "black", "5kg")).toBeNull();
  });
});

describe("stockWarning", () => {
  it("says nothing while the shopper is under the limit", () => {
    expect(stockWarning(2, 4)).toBeNull();
  });

  it("names the number once they have reached it", () => {
    expect(stockWarning(4, 4)).toBe(4);
  });

  /* Reaching the ceiling from above: a basket built before stock moved. The
     row must still explain itself rather than going quiet at the worst moment. */
  it("still names it when the basket is already over", () => {
    expect(stockWarning(9, 4)).toBe(4);
  });

  /* THE ONE THAT WOULD HAVE SHIPPED A LIE. `MAX_LINE_QTY` is this storefront's
     own invention, not a fact about the warehouse — so a shopper who holds the
     plus key to 99 on an untracked product must not be told there are 99 left.
     The first cut of this returned the cap unconditionally and did exactly
     that. */
  it("says nothing at the sanity ceiling of an untracked variant", () => {
    expect(stockWarning(MAX_LINE_QTY, maxQtyFor(null))).toBeNull();
    expect(stockWarning(MAX_LINE_QTY, maxQtyFor({ available: null, backorderable: false }))).toBeNull();
  });

  it("says nothing at the sanity ceiling of a backorderable variant", () => {
    expect(stockWarning(MAX_LINE_QTY, maxQtyFor({ available: 0, backorderable: true }))).toBeNull();
  });
});
