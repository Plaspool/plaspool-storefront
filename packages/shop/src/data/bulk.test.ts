import { describe, expect, it } from "vitest";

import {
  applyBps,
  bulkAffordance,
  nextTierFor,
  percentFromBps,
  tierFor,
  unitsToNextTier,
} from "./bulk";
import type { BulkTier } from "./types";

/**
 * THE QUANTITY LADDER, IN BASIS POINTS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * EVERY NUMBER HERE IS A PROJECTION, NEVER A CHARGE. The API resolves the
 * ladder, picks the rung and quotes `effectiveUnit`; this module exists so the
 * product page can SAY what a quantity would earn before anything is in a
 * basket. The moment a line exists, the server's numbers win — see
 * `checkout-api.ts`.
 *
 * `percentBps` IS BASIS POINTS: 10000 is 100%, so 1000 is 10%. The field it
 * replaced was `discountPct`, a whole-number percentage, and the two differ by
 * a factor of a hundred — a ladder read with the old spelling would quote a
 * 1000% discount and price every spool at zero.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** The live ladder the admin resolves: 5%, 10%, 15%. */
const TIERS: BulkTier[] = [
  { minQty: 3, percentBps: 500 },
  { minQty: 5, percentBps: 1000 },
  { minQty: 10, percentBps: 1500 },
];

describe("tierFor", () => {
  it("finds no rung below the first", () => {
    expect(tierFor(TIERS, 1)).toBeNull();
    expect(tierFor(TIERS, 2)).toBeNull();
  });

  it("takes the highest rung the quantity has reached", () => {
    expect(tierFor(TIERS, 3)?.percentBps).toBe(500);
    expect(tierFor(TIERS, 4)?.percentBps).toBe(500);
    expect(tierFor(TIERS, 5)?.percentBps).toBe(1000);
    expect(tierFor(TIERS, 9)?.percentBps).toBe(1000);
    expect(tierFor(TIERS, 10)?.percentBps).toBe(1500);
    expect(tierFor(TIERS, 10_000)?.percentBps).toBe(1500);
  });

  /* THE API PROMISES ASCENDING ORDER. This does not rely on it: a ladder that
     arrived out of order would otherwise quote whichever rung happened to be
     last, and the failure would be a wrong price rather than an error. */
  it("does not depend on the ladder arriving sorted", () => {
    expect(tierFor([...TIERS].reverse(), 7)?.percentBps).toBe(1000);
  });

  /* AN EMPTY LADDER IS A COMPLETE ANSWER — "no bulk discount on this product" —
     and never a reason to fall back to a ladder of our own. A second rule here
     is a rule that disagrees with what the customer is charged. */
  it("answers null for a product with no ladder", () => {
    expect(tierFor([], 500)).toBeNull();
  });
});

describe("nextTierFor", () => {
  it("points at the first rung from below the ladder", () => {
    expect(nextTierFor(TIERS, 1)?.minQty).toBe(3);
  });

  it("points at the rung above the one already reached", () => {
    expect(nextTierFor(TIERS, 3)?.minQty).toBe(5);
    expect(nextTierFor(TIERS, 5)?.minQty).toBe(10);
  });

  it("has nothing to point at on the top rung", () => {
    expect(nextTierFor(TIERS, 10)).toBeNull();
    expect(nextTierFor(TIERS, 99)).toBeNull();
  });

  it("has nothing to point at with no ladder", () => {
    expect(nextTierFor([], 1)).toBeNull();
  });
});

describe("unitsToNextTier", () => {
  /* THE SENTENCE THIS EXISTS FOR: "add 2 more to save 10%". */
  it("counts the units still needed to reach the next rung", () => {
    expect(unitsToNextTier(TIERS, 1)).toBe(2);
    expect(unitsToNextTier(TIERS, 3)).toBe(2);
    expect(unitsToNextTier(TIERS, 4)).toBe(1);
    expect(unitsToNextTier(TIERS, 5)).toBe(5);
  });

  it("counts nothing when there is no rung left to reach", () => {
    expect(unitsToNextTier(TIERS, 10)).toBe(0);
    expect(unitsToNextTier([], 1)).toBe(0);
  });
});

describe("percentFromBps", () => {
  it("reads basis points as the percentage a shopper is shown", () => {
    expect(percentFromBps(500)).toBe(5);
    expect(percentFromBps(1000)).toBe(10);
    expect(percentFromBps(1500)).toBe(15);
    expect(percentFromBps(10000)).toBe(100);
    expect(percentFromBps(0)).toBe(0);
  });

  /* A rung the operator set to 7.5% arrives as 750 and must not render "8%"
     beside a price computed from 7.5. */
  it("keeps a fractional percentage rather than rounding it away", () => {
    expect(percentFromBps(750)).toBe(7.5);
  });
});

describe("applyBps", () => {
  it("takes the discount off the amount", () => {
    expect(applyBps(2_350_000, 1000)).toBe(2_115_000);
    expect(applyBps(2_350_000, 500)).toBe(2_232_500);
  });

  it("changes nothing at zero", () => {
    expect(applyBps(2_350_000, 0)).toBe(2_350_000);
  });

  /* MINOR UNITS ARE INTEGERS — a fraction of a kobo cannot be charged, and a
     non-integer would reach `formatNaira` and render a decimal in a currency
     that has none on screen. */
  it("answers a whole number of minor units", () => {
    const out = applyBps(2_350_001, 750);
    expect(Number.isInteger(out)).toBe(true);
  });
});

describe("bulkAffordance", () => {
  /* THE CARD'S ONE LINE. A listing has no quantity to reason about, so the only
     honest thing to advertise is the best the ladder offers and what reaches
     it — never "bulk discount available", which tells a shopper nothing they
     can act on. */
  it("names the deepest rung and the quantity that reaches it", () => {
    expect(bulkAffordance(TIERS)).toBe("Save up to 15% on 10+");
  });

  it("says nothing for a product with no ladder", () => {
    expect(bulkAffordance([])).toBeNull();
  });

  /* THE DEEPEST DISCOUNT, NOT THE LAST ELEMENT. The API promises ascending
     `minQty`, and says nothing about the percentage being ascending too — a
     ladder whose top rung is a smaller discount would otherwise advertise the
     wrong number. */
  it("takes the deepest discount rather than the last rung", () => {
    const odd: BulkTier[] = [
      { minQty: 3, percentBps: 2000 },
      { minQty: 10, percentBps: 500 },
    ];
    expect(bulkAffordance(odd)).toBe("Save up to 20% on 3+");
  });

  it("keeps a fractional rung intact", () => {
    expect(bulkAffordance([{ minQty: 4, percentBps: 750 }])).toBe("Save up to 7.5% on 4+");
  });
});
