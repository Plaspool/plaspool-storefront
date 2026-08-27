import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Price } from "./price";

/**
 * A PRICE THAT IS BOTH ON SALE AND ON A BULK RUNG HAS THREE NUMBERS, NOT TWO.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS EXISTS TO PREVENT COMING BACK.
 *
 * The buy box used to pass the BULK price as `amount` and the list price as
 * `compareAt`, so a spool reduced from ₦24,000 to ₦20,000 and then bought five
 * at a time rendered as "₦24,000 struck through, ₦18,000". Two different
 * discounts collapsed into one strike-through, reading as a 25% sale when the
 * sale is 17% and the rest was earned by quantity.
 *
 * The API is explicit that the bulk percentage comes off the LIVE price and
 * never off `compareAtMinor`; this is the rendering half of that rule.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const html = (props: Parameters<typeof Price>[0]) => renderToStaticMarkup(<Price {...props} />);
const text = (props: Parameters<typeof Price>[0]) => html(props).replace(/<[^>]*>/g, "");

describe("Price", () => {
  it("shows one figure when there is nothing to compare", () => {
    const out = html({ amount: 23_500 });
    expect(out).toContain("₦23,500");
    expect(out).not.toContain("<s ");
  });

  it("strikes a reference price that beats the amount", () => {
    const out = html({ amount: 20_000, compareAt: 24_000 });
    expect(out).toContain("<s ");
    expect(out).toContain("₦24,000");
    expect(out).toContain("₦20,000");
  });

  /* A reference at or below the price is carried honestly and never shown —
     pre-existing behaviour, asserted so the bulk work did not disturb it. */
  it("ignores a reference price that does not beat the amount", () => {
    expect(html({ amount: 20_000, compareAt: 20_000 })).not.toContain("<s ");
    expect(html({ amount: 20_000, compareAt: 19_000 })).not.toContain("<s ");
  });

  /* ═══ THE THREE-NUMBER CASE ═══ */
  it("keeps the sale price visible when a bulk rung also applies", () => {
    const out = text({ amount: 20_000, compareAt: 24_000, bulkAmount: 18_000, bulkQty: 5 });
    expect(out).toContain("₦24,000");
    expect(out).toContain("₦20,000");
    expect(out).toContain("₦18,000");
  });

  it("says what quantity earns the bulk price", () => {
    const out = text({ amount: 20_000, bulkAmount: 18_000, bulkQty: 5 });
    expect(out).toMatch(/5/);
    expect(out).toMatch(/each/i);
  });

  /* THE STRIKE-THROUGH STAYS ON THE SALE, NOT ON THE BULK. Striking the list
     price against the bulk figure is the conflation this whole test exists
     for, so the struck element must still hold `compareAt`. */
  it("strikes the reference price and never the bulk price", () => {
    const out = html({ amount: 20_000, compareAt: 24_000, bulkAmount: 18_000, bulkQty: 5 });
    const struck = /<s [^>]*>(.*?)<\/s>/s.exec(out)?.[1] ?? "";
    expect(struck).toContain("₦24,000");
    expect(struck).not.toContain("₦18,000");
  });

  /* No rung reached is the ordinary case and must render exactly as before. */
  it("shows no bulk figure when no rung applies", () => {
    const out = text({ amount: 20_000, compareAt: 24_000 });
    expect(out).not.toMatch(/each/i);
  });

  /* A bulk price that saves nothing is not worth a line of its own. */
  it("shows no bulk figure when the rung does not beat the price", () => {
    expect(text({ amount: 20_000, bulkAmount: 20_000, bulkQty: 5 })).not.toMatch(/each/i);
  });
});
