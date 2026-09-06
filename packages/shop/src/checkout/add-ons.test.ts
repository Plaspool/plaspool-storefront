import { describe, expect, it } from "vitest";

import {
  INCLUDED,
  addOnAmountLabel,
  addOnImageSrc,
  addOnPriceLabel,
  addOnRowsFor,
  appliedAddOns,
  askedAddOns,
  includedAddOns,
  pendingAddOns,
} from "./add-ons";
import type { AddOnOffer } from "../data/cart-api";

/**
 * The two derivations the brief names, and the one word this package adds.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THESE PIN. The API decides whether an add-on is asked about or
 * included; the storefront only sorts what it was told into "ask now",
 * "on the order" and "changeable later", and prints the number the API froze
 * beside the operator's title. Every assertion here is about that sorting
 * and that printing — there is no arithmetic to test because there is none.
 * ═══════════════════════════════════════════════════════════════════════════
 */

function offer(over: Partial<AddOnOffer> = {}): AddOnOffer {
  return {
    id: "ado_box",
    /* A noun no operator at PlaSpool would choose, the trick
       `points-offer.test.tsx` uses: a component that hardcoded "Gift box"
       would pass against a realistic fixture. */
    title: "Velvet pouch",
    description: "A drawstring pouch, tied by hand.",
    imageUrl: null,
    price: { amount: 150000, currency: "NGN" },
    amount: { amount: 150000, currency: "NGN" },
    mode: "ask",
    choice: null,
    ...over,
  };
}

const ASKED = offer();
const ACCEPTED = offer({ id: "ado_card", title: "Card", choice: "accepted" });
const DECLINED = offer({ id: "ado_ribbon", title: "Ribbon", choice: "declined" });
const INCLUDED_FREE = offer({
  id: "ado_pack",
  title: "Padded packing",
  mode: "include",
  amount: { amount: 0, currency: "NGN" },
});
const INCLUDED_CHARGED = offer({
  id: "ado_ins",
  title: "Insurance",
  mode: "include",
});

const ALL = [ASKED, ACCEPTED, DECLINED, INCLUDED_FREE, INCLUDED_CHARGED];

describe("which add-ons the shopper still has to answer", () => {
  it("is the ask offers with no recorded choice, and nothing else", () => {
    expect(pendingAddOns(ALL)).toEqual([ASKED]);
  });

  it("never includes an included add-on, which is never asked about", () => {
    /* `choice` is null on an include offer too — the same value a pending
       ask carries — so a filter on `choice === null` alone would put the
       packaging the rules already decided on in front of the shopper as a
       question. */
    expect(pendingAddOns([INCLUDED_FREE, INCLUDED_CHARGED])).toEqual([]);
  });

  it("is empty when the server sent nothing, which is every server today", () => {
    expect(pendingAddOns([])).toEqual([]);
  });
});

describe("which add-ons will be on the order", () => {
  it("is everything included plus everything accepted", () => {
    expect(appliedAddOns(ALL)).toEqual([ACCEPTED, INCLUDED_FREE, INCLUDED_CHARGED]);
  });

  it("does not count a pending offer as applied — the freeze prices it as declined", () => {
    expect(appliedAddOns([ASKED])).toEqual([]);
  });
});

describe("which add-ons get a control on the review step", () => {
  it("is every ask offer, answered or not", () => {
    expect(askedAddOns(ALL)).toEqual([ASKED, ACCEPTED, DECLINED]);
  });
});

describe("which add-ons the drawer mentions in passing", () => {
  it("is the included ones, charged or not, and never an answer the shopper gave", () => {
    expect(includedAddOns(ALL)).toEqual([INCLUDED_FREE, INCLUDED_CHARGED]);
  });
});

describe("the charge on an offer card", () => {
  it("reads as an addition to the total, in naira, with no invented symbol", () => {
    expect(addOnPriceLabel({ amount: 150000, currency: "NGN" })).toBe("+ ₦1,500");
  });

  it("goes through the same minor-unit rounding as every other price", () => {
    expect(addOnPriceLabel({ amount: 2300000, currency: "NGN" })).toBe("+ ₦23,000");
  });

  it("says Free, with no sign, when the rule charges nothing", () => {
    /* "+ ₦0" is an addition of nothing, which reads as a mistake. */
    expect(addOnPriceLabel({ amount: 0, currency: "NGN" })).toBe("Free");
  });
});

describe("what an add-on costs, in words", () => {
  it("is the amount in naira, or Free for nothing", () => {
    expect(addOnAmountLabel({ amount: 150000, currency: "NGN" })).toBe("₦1,500");
    expect(addOnAmountLabel({ amount: 0, currency: "NGN" })).toBe("Free");
  });
});

describe("what a totals row says about an add-on", () => {
  it("prints the title verbatim and the amount the API froze", () => {
    expect(
      addOnRowsFor([{ id: "ado_1", title: "Velvet pouch", mode: "chosen", amount: 150000 }], "NGN"),
    ).toEqual([{ key: "ado_1", label: "Velvet pouch", value: "₦1,500" }]);
  });

  it("says Included, not ₦0, for an included add-on that cost nothing", () => {
    expect(
      addOnRowsFor([{ id: "ado_2", title: "Padded packing", mode: "included", amount: 0 }], "NGN"),
    ).toEqual([{ key: "ado_2", label: "Padded packing", value: INCLUDED }]);
  });

  it("prints the amount for an included add-on the operator chose to charge for", () => {
    /* "Included" would be a lie beside a charge. When the price is charged
       it is just a row with a number, whatever route put it on the order. */
    expect(
      addOnRowsFor([{ id: "ado_3", title: "Insurance", mode: "included", amount: 50000 }], "NGN"),
    ).toEqual([{ key: "ado_3", label: "Insurance", value: "₦500" }]);
  });

  it("never says Included for a chosen add-on, even a free one", () => {
    /* The shopper chose it; "Included" would tell them the shop put it there. */
    expect(
      addOnRowsFor([{ id: "ado_4", title: "Card", mode: "chosen", amount: 0 }], "NGN")[0].value,
    ).toBe("₦0");
  });

  it("keeps the API's order and gives each row a key of its own", () => {
    const rows = addOnRowsFor(
      [
        { title: "First", mode: "chosen", amount: 100 },
        { title: "Second", mode: "included", amount: 0 },
      ],
      "NGN",
    );
    expect(rows.map((r) => r.label)).toEqual(["First", "Second"]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });

  it("is nothing at all for an order with no add-ons — every old order", () => {
    expect(addOnRowsFor([], "NGN")).toEqual([]);
  });
});

describe("where an add-on's picture is fetched from", () => {
  it("routes a public image id through the storefront's own proxy", () => {
    expect(addOnImageSrc("/api/public/images/img_abc-123")).toBe("/images/shop/img_abc-123");
  });

  it("leaves an absolute URL alone", () => {
    expect(addOnImageSrc("https://cdn.example.com/box.png")).toBe("https://cdn.example.com/box.png");
  });

  it("fetches any other API path from the API origin", () => {
    expect(addOnImageSrc("/static/box.png")).toMatch(/^https?:\/\/.+\/static\/box\.png$/);
  });

  it("answers null for null, which draws the placeholder", () => {
    expect(addOnImageSrc(null)).toBeNull();
  });
});
