import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { NextTierHint } from "./next-tier-hint";
import type { BulkTier } from "../data/types";

/**
 * "ADD 2 MORE TO SAVE 10%" — computed from the ladder alone.
 *
 * NO REQUEST PER KEYSTROKE. The rung a quantity would earn is a property of
 * `bulkTiers`, which the product page already has; asking the API as the
 * stepper moves would be a round trip per press to answer a question already
 * on the page.
 *
 * It is a PROJECTION and is worded as one. Quantity is summed per product
 * across variants, so a basket already holding some of this product reaches the
 * rung sooner than this says — never later. The sentence promises a floor.
 */

const TIERS: BulkTier[] = [
  { minQty: 3, percentBps: 500 },
  { minQty: 5, percentBps: 1000 },
  { minQty: 10, percentBps: 1500 },
];

const render = (tiers: BulkTier[], quantity: number) =>
  renderToStaticMarkup(<NextTierHint tiers={tiers} quantity={quantity} />);

/**
 * The rendered SENTENCE, with the markup stripped.
 *
 * The number sits in its own `<span>` for the tabular figures, so `1</span>
 * more spool` is what the raw HTML says and a plain `/1 more spool/` never
 * matches however correct the copy is. What is being asserted is the wording a
 * shopper reads, so the tags come out first.
 */
const text = (tiers: BulkTier[], quantity: number) =>
  render(tiers, quantity).replace(/<[^>]*>/g, "");

describe("NextTierHint", () => {
  it("says how many more units reach the next rung", () => {
    const html = render(TIERS, 1);
    expect(html).toContain("2");
    expect(html).toContain("5%");
  });

  it("counts from the rung already reached", () => {
    expect(render(TIERS, 4)).toContain("10%");
  });

  /* NOTHING TO OFFER IS NOTHING TO SAY. A product with no ladder must not grow
     an empty paragraph, and the top rung has no next. */
  it("renders nothing without a ladder", () => {
    expect(render([], 1)).toBe("");
  });

  it("renders nothing on the top rung", () => {
    expect(render(TIERS, 10)).toBe("");
    expect(render(TIERS, 40)).toBe("");
  });

  /* Singular, because "add 1 more units" is the kind of thing that makes a shop
     look unfinished on the one rung a shopper is most likely to be one away
     from. */
  it("speaks of one unit in the singular", () => {
    expect(text(TIERS, 2)).toContain("Add 1 more spool to save");
    expect(text(TIERS, 2)).not.toContain("spools");
  });

  it("speaks of several units in the plural", () => {
    expect(text(TIERS, 1)).toContain("Add 2 more spools to save");
  });

  /* A fractional rung must not render as a rounded one beside a table quoting
     the exact figure. */
  it("keeps a fractional rung intact", () => {
    expect(render([{ minQty: 4, percentBps: 750 }], 2)).toContain("7.5%");
  });
});
