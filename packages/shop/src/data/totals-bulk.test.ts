import { describe, expect, it } from "vitest";

import { bulkOf } from "./checkout-api";
import type { TotalsLine } from "./checkout-api";

/**
 * READING THE BULK FIELDS OFF A FROZEN LINE, INCLUDING ONE THAT PREDATES THEM.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ORDERS FROZEN BEFORE BULK DISCOUNTS SHIPPED ARE STORED WITHOUT THESE FIELDS,
 * PERMANENTLY. There is no backfill and there cannot be one — a frozen total is
 * the record of what was actually charged. So every order surface in the shop
 * will be rendering both shapes forever, and a reader that assumes the new one
 * crashes the order history rather than one line of it.
 *
 * The defaults are the only ones that describe the old world truthfully: no
 * discount applied, the unit price IS what they paid, and the only quantity
 * anybody knew about was the line's own.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const NGN = (amount: number) => ({ amount, currency: "NGN" });

/** A line as the API freezes one TODAY, with the bulk fields present. */
const modern: TotalsLine = {
  variantId: "var_1",
  qty: 2,
  unit: NGN(2_350_000),
  bulkQty: 5,
  bulkPercentBps: 1000,
  effectiveUnit: NGN(2_115_000),
  lineTotal: NGN(4_230_000),
  taxable: true,
  taxAmount: NGN(317_250),
};

/** A line frozen before any of this existed. */
const legacy: TotalsLine = {
  variantId: "var_1",
  qty: 2,
  unit: NGN(2_350_000),
  lineTotal: NGN(4_700_000),
  taxable: true,
  taxAmount: NGN(0),
};

describe("bulkOf", () => {
  it("reads the fields the API froze onto a modern line", () => {
    expect(bulkOf(modern)).toEqual({
      qty: 5,
      percentBps: 1000,
      effectiveUnit: NGN(2_115_000),
      discounted: true,
    });
  });

  it("does not crash on a line frozen before the fields existed", () => {
    expect(() => bulkOf(legacy)).not.toThrow();
  });

  /* THE DOCUMENTED DEFAULTS. `effectiveUnit` falling back to `unit` is the
     load-bearing one: it is what every price on an old order renders from. */
  it("defaults a legacy line to no discount at the list price", () => {
    expect(bulkOf(legacy)).toEqual({
      qty: 2,
      percentBps: 0,
      effectiveUnit: NGN(2_350_000),
      discounted: false,
    });
  });

  /* A LINE THAT REACHED NO RUNG carries the fields with a zero percentage —
     that is not the same as a legacy line, but it must render identically: no
     strike-through, no "you're buying N" explanation. */
  it("treats an explicit zero rung as no discount", () => {
    const noRung: TotalsLine = { ...modern, bulkPercentBps: 0, effectiveUnit: NGN(2_350_000) };
    expect(bulkOf(noRung).discounted).toBe(false);
  });

  /* `bulkQty` IS NOT THIS LINE'S `qty` — it is the total across every line of
     the same product, which is the only thing that explains a line reading
     "2 × black, 10% off". Collapsing the two would make the explanation wrong
     rather than absent. */
  it("keeps `bulkQty` distinct from the line's own quantity", () => {
    expect(bulkOf(modern).qty).toBe(5);
    expect(modern.qty).toBe(2);
  });
});
