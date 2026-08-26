import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { BulkLinePrice } from "./bulk-line-price";

/**
 * WHAT A DISCOUNTED CART LINE SAYS, WHICH IS THE ONLY PART A SHOPPER SEES.
 *
 * The number is the server's; the SENTENCE is this storefront's, and it is the
 * part that can lie. A line reading "2 × black, 10% off" is inexplicable on its
 * own — the rung was earned by five units across two variants of the same
 * product, and `bulkQty` is the only field that says so.
 */

function render(props: Partial<Parameters<typeof BulkLinePrice>[0]> = {}) {
  return renderToStaticMarkup(
    <BulkLinePrice
      unitPrice={23_500}
      effectiveUnitPrice={21_150}
      bulkPercentBps={1000}
      bulkQty={5}
      lineQty={2}
      {...props}
    />,
  );
}

describe("BulkLinePrice", () => {
  /* THE PRE-BULK AND NO-RUNG CASE, which must look exactly like the cart always
     did: one price, no strike, no explanation. */
  it("shows one plain price when no rung applied", () => {
    const html = render({ bulkPercentBps: 0, effectiveUnitPrice: 23_500, bulkQty: 2 });
    expect(html).toContain("₦23,500");
    /* `"<s "` WITH THE SPACE, not `"<s"` — the latter matches `<span`, which
       every branch of this component renders, so the assertion passed on
       markup that did contain a strike-through. It caught nothing until the
       space was added. */
    expect(html).not.toContain("<s ");
    expect(html).not.toContain("%");
  });

  it("strikes the list price and shows what they actually pay", () => {
    const html = render();
    expect(html).toContain("<s ");
    expect(html).toContain("₦23,500");
    expect(html).toContain("₦21,150");
  });

  it("names the rung as a percentage, not as basis points", () => {
    const html = render();
    expect(html).toContain("10%");
    expect(html).not.toContain("1000%");
  });

  /* A rung the operator set to 7.5% arrives as 750. Rendering "8%" beside a
     price computed from 7.5 is the shop contradicting its own arithmetic. */
  it("keeps a fractional rung intact", () => {
    expect(render({ bulkPercentBps: 750 })).toContain("7.5%");
  });

  /* THE EXPLANATION. Without it the discount is unattributable, and the
     quantity that earned it is not the one printed on this row. */
  it("explains the discount with the product-wide quantity", () => {
    const html = render();
    expect(html).toContain("5");
    expect(html).toMatch(/buying/i);
  });

  /* When the line IS the whole quantity there is nothing to reconcile, so the
     row should not tell the shopper something they can already see. */
  it("does not explain a quantity the row already shows", () => {
    const html = render({ bulkQty: 2, lineQty: 2 });
    expect(html).not.toMatch(/buying/i);
    expect(html).toContain("10%");
  });
});
