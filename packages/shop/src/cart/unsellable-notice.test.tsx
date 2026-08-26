import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { UnsellableNotice } from "./unsellable-notice";
import type { UnsellableLine } from "./sellable";

/**
 * WHAT THE STUCK-BASKET ROW ACTUALLY SAYS, WHICH IS THE ONLY PART THAT REACHES
 * A SHOPPER.
 *
 * `sellable.test.ts` next door pins WHICH lines are unbuyable. This pins the
 * sentence put next to them — because the defect being fixed was never a
 * miscalculation, it was a screen making two contradictory claims about one
 * basket, and that only shows up in the bytes.
 *
 * Props rather than `useCart()`, so this renders without a provider, a browser
 * or a network. Rendered through `react-dom/server` the same way
 * `line-thumb.test.tsx` does: no jsdom, no testing-library, no second React.
 */

const NAMED: UnsellableLine = {
  lineId: "crl_named",
  variantId: "var_named",
  qty: 1,
  name: "PLA Basic",
};

/** The reported line: the catalogue has lost the variant entirely, so the API
 *  sent null for the title, the sku and the options alike. */
const ANONYMOUS: UnsellableLine = {
  lineId: "crl_mt74r4cka7ff493b1d244afd",
  variantId: "var_msrw93s668288c75cbc24106",
  qty: 1,
  name: null,
};

function render(lines: UnsellableLine[], pending = false) {
  return renderToStaticMarkup(
    <UnsellableNotice lines={lines} pending={pending} onRemove={() => {}} />,
  );
}

describe("UnsellableNotice", () => {
  it("renders nothing when every line can be bought", () => {
    expect(render([])).toBe("");
  });

  it("names the item when the catalogue still explains it", () => {
    expect(render([NAMED])).toContain("PLA Basic");
  });

  /* INVENTING A NAME WOULD BE THE SAME LIE THE BADGE WAS TELLING. There is
     nothing honest left to call a variant the catalogue has lost, so the row
     describes it instead — and must never print the raw variant id at a
     shopper. */
  it("describes an item it cannot name, without showing the variant id", () => {
    const html = render([ANONYMOUS]);
    expect(html).toContain("An item you added");
    expect(html).not.toContain("var_msrw93s668288c75cbc24106");
  });

  it("offers a Remove control that names the row it removes", () => {
    expect(render([NAMED])).toContain('aria-label="Remove PLA Basic from cart"');
  });

  /* THE ONE CONTROL THAT CAN REACH THIS LINE. If it were ever rendered without
     a working Remove, the basket would be exactly as stuck as before — the
     button is the fix, not the message.

     ASSERTED ON THE ATTRIBUTE, `disabled=""`, and not on the substring: the
     button's own class list carries `disabled:pointer-events-none` and
     `disabled:opacity-50`, so a bare `toContain("disabled")` passes on a
     control that is perfectly enabled. The first cut of this test did exactly
     that and reported a bug that was not there. */
  it("keeps the Remove control enabled while no write is in flight", () => {
    expect(render([ANONYMOUS])).not.toContain('disabled=""');
  });

  it("disables Remove while a write is in flight", () => {
    expect(render([NAMED], true)).toContain('disabled=""');
  });

  it("says why it matters, in the words the checkout will use", () => {
    expect(render([NAMED])).toContain("checkout");
  });

  it("speaks of one item in the singular and several in the plural", () => {
    expect(render([NAMED])).toContain("This item is no longer available");
    expect(render([NAMED, ANONYMOUS])).toContain("These items are no longer available");
  });
});
