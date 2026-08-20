import { describe, expect, it } from "vitest";

import {
  cheapestSize,
  firstInStockColour,
  formatNaira,
  lineTotal,
  priceFrom,
  ratingSummary,
  savingsFor,
  tierFor,
  unitPriceFor,
} from "./money";
import type { BulkTier, Product, Review } from "./types";

const TIERS: BulkTier[] = [
  { minQty: 3, discountPct: 5 },
  { minQty: 6, discountPct: 10 },
  { minQty: 12, discountPct: 15 },
];

describe("formatNaira", () => {
  it("groups thousands and prefixes the sign", () => {
    expect(formatNaira(18500)).toBe("₦18,500");
    expect(formatNaira(3000)).toBe("₦3,000");
    expect(formatNaira(999)).toBe("₦999");
    expect(formatNaira(1000000)).toBe("₦1,000,000");
    expect(formatNaira(0)).toBe("₦0");
  });

  it("puts the minus outside the sign, not inside the digits", () => {
    expect(formatNaira(-2500)).toBe("-₦2,500");
  });

  it("never emits a decimal", () => {
    expect(formatNaira(1500.4)).toBe("₦1,500");
    expect(formatNaira(1500.6)).toBe("₦1,501");
  });

  /* The whole reason this is hand-rolled instead of `Intl.NumberFormat`: a
     small-icu or Workers runtime emits `NGN 18,500` where full-icu Node emits
     `₦18,500`, and a server and client that disagree on a price string is a
     hydration error on every product on the page. */
  it("is ICU-independent — the symbol is a literal, not a locale lookup", () => {
    expect(formatNaira(18500)).not.toContain("NGN");
    expect(formatNaira(18500).startsWith("₦")).toBe(true);
  });
});

describe("tierFor", () => {
  it("is null below the first rung", () => {
    expect(tierFor(TIERS, 1)).toBeNull();
    expect(tierFor(TIERS, 2)).toBeNull();
  });

  it("picks the best rung reached, not the first one matched", () => {
    expect(tierFor(TIERS, 3)?.discountPct).toBe(5);
    expect(tierFor(TIERS, 5)?.discountPct).toBe(5);
    expect(tierFor(TIERS, 6)?.discountPct).toBe(10);
    expect(tierFor(TIERS, 100)?.discountPct).toBe(15);
  });

  it("is order-independent — a ladder given descending still resolves the best", () => {
    expect(tierFor([...TIERS].reverse(), 7)?.discountPct).toBe(10);
  });
});

describe("unitPriceFor / lineTotal / savingsFor", () => {
  it("rounds the discounted unit price, so no float survives into a total", () => {
    // 10% off 18,500 is 16,650 exactly; 5% off 999 is 949.05 and must round.
    expect(unitPriceFor(18500, TIERS, 6)).toBe(16650);
    expect(unitPriceFor(999, TIERS, 3)).toBe(949);
    expect(Number.isInteger(unitPriceFor(999, TIERS, 3))).toBe(true);
  });

  it("charges the base price below the first rung", () => {
    expect(unitPriceFor(18500, TIERS, 2)).toBe(18500);
    expect(lineTotal(18500, TIERS, 2)).toBe(37000);
    expect(savingsFor(18500, TIERS, 2)).toBe(0);
  });

  /* Tiers apply PER LINE. Two lines of four spools must not combine into a
     single tier of eight — the buy box's tier table is the promise, and this
     is the assertion that keeps it. */
  it("applies per line, so two lines of four are not one tier of eight", () => {
    const twoLinesOfFour = lineTotal(18500, TIERS, 4) * 2;
    const oneLineOfEight = lineTotal(18500, TIERS, 8);
    expect(twoLinesOfFour).toBeGreaterThan(oneLineOfEight);
    expect(twoLinesOfFour).toBe(140600); // 4 x 17,575, twice
    expect(oneLineOfEight).toBe(133200); // 8 x 16,650
  });

  it("reports savings against the undiscounted line", () => {
    expect(savingsFor(18500, TIERS, 6)).toBe(18500 * 6 - 16650 * 6);
  });
});

function product(over: Partial<Product> = {}): Product {
  return {
    slug: "spool",
    name: "Spool",
    summary: "",
    material: "PLA",
    diameterMm: 1.75,
    featured: false,
    colours: [
      { id: "black", name: "Black", hex: "#000000", inStock: false, imageUrl: null },
      { id: "red", name: "Red", hex: "#ff0000", inStock: true, imageUrl: null },
    ],
    sizes: [
      { id: "1kg", label: "1 kg", weightGrams: 1000, priceNaira: 18500, compareAtNaira: null },
      { id: "250g", label: "250 g", weightGrams: 250, priceNaira: 6500, compareAtNaira: null },
    ],
    ...over,
  } as Product;
}

describe("priceFrom / cheapestSize", () => {
  /* A card shows "From ₦X" and its add button adds a size. If these two ever
     disagree the customer is quoted one price and charged another, which is
     silent — nothing throws, the number is just wrong. */
  it("quote and add agree on the same size", () => {
    const p = product();
    expect(priceFrom(p)).toBe(6500);
    expect(cheapestSize(p).priceNaira).toBe(priceFrom(p));
    expect(cheapestSize(p).id).toBe("250g");
  });
});

describe("firstInStockColour", () => {
  it("prefers an in-stock colour", () => {
    expect(firstInStockColour(product()).id).toBe("red");
  });

  it("falls back to the first colour when nothing is in stock", () => {
    const p = product({
      colours: [
        { id: "black", name: "Black", hex: "#000000", inStock: false, imageUrl: null },
        { id: "red", name: "Red", hex: "#ff0000", inStock: false, imageUrl: null },
      ],
    });
    expect(firstInStockColour(p).id).toBe("black");
  });
});

describe("ratingSummary", () => {
  const review = (rating: number): Review => ({ rating }) as Review;

  it("indexes the distribution five-star-first", () => {
    const { distribution } = ratingSummary([review(5), review(5), review(1)]);
    expect(distribution).toEqual([2, 0, 0, 0, 1]);
  });

  it("rounds the average to one decimal", () => {
    expect(ratingSummary([review(5), review(4), review(4)]).average).toBe(4.3);
  });

  it("averages 0 with no reviews rather than NaN", () => {
    const summary = ratingSummary([]);
    expect(summary.average).toBe(0);
    expect(summary.count).toBe(0);
    expect(summary.distribution).toEqual([0, 0, 0, 0, 0]);
  });
});
