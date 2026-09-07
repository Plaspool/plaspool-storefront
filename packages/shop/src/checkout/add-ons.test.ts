import { describe, expect, it } from "vitest";

import {
  INCLUDED,
  addOnAmountLabel,
  addOnBasisOf,
  addOnImageSrc,
  addOnPriceLabel,
  addOnRowsFor,
  addOnUnitAmount,
  addOnUnitLabel,
  addOnUnits,
  appliedAddOns,
  askedAddOns,
  includedAddOns,
  pendingAddOns,
  potentialSavingOf,
  savingAmountLabel,
  savingLabel,
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
    ).toEqual([{ key: "ado_1", label: "Velvet pouch", value: "₦1,500", saving: false }]);
  });

  it("says Included, not ₦0, for an included add-on that cost nothing", () => {
    expect(
      addOnRowsFor([{ id: "ado_2", title: "Padded packing", mode: "included", amount: 0 }], "NGN"),
    ).toEqual([{ key: "ado_2", label: "Padded packing", value: INCLUDED, saving: false }]);
  });

  it("prints the amount for an included add-on the operator chose to charge for", () => {
    /* "Included" would be a lie beside a charge. When the price is charged
       it is just a row with a number, whatever route put it on the order. */
    expect(
      addOnRowsFor([{ id: "ado_3", title: "Insurance", mode: "included", amount: 50000 }], "NGN"),
    ).toEqual([{ key: "ado_3", label: "Insurance", value: "₦500", saving: false }]);
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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PER-ITEM PRICING AND THE ADD-ON THAT PAYS MONEY BACK.
 *
 * Two things arrived together on the API and only one of them is visible:
 * an add-on can be priced PER ITEM, and an add-on can be something already
 * inside the product price that the shopper takes back out for a refund. The
 * second makes `amount` NEGATIVE for the first time in this codebase, and
 * every assumption that an add-on only ever adds money is wrong from that
 * moment.
 *
 * THE TRAP THESE EXIST TO PIN: for `opt_out`, `choice: null` and
 * `choice: "accepted"` mean the SAME THING — the box stays, and it costs
 * nothing extra because it was paid for inside the product price. Only
 * `"declined"` does anything, and what it does is give money back.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const OPT_OUT_UNANSWERED: AddOnOffer = {
  id: "ado_box",
  title: "Packaging",
  description: null,
  imageUrl: null,
  price: { amount: 50000, currency: "NGN" },
  unitAmount: { amount: 50000, currency: "NGN" },
  units: 4,
  basis: "item",
  amount: { amount: 0, currency: "NGN" },
  mode: "opt_out",
  choice: null,
};

const OPT_OUT_DECLINED: AddOnOffer = {
  ...OPT_OUT_UNANSWERED,
  unitAmount: { amount: -50000, currency: "NGN" },
  amount: { amount: -200000, currency: "NGN" },
  choice: "declined",
};

const OPT_OUT_KEPT: AddOnOffer = { ...OPT_OUT_UNANSWERED, choice: "accepted" };

describe("an add-on whose cost is already in the price", () => {
  it("is a question the checkout must ask — gating on mode === 'ask' hides the whole feature", () => {
    expect(pendingAddOns([OPT_OUT_UNANSWERED])).toEqual([OPT_OUT_UNANSWERED]);
    expect(askedAddOns([OPT_OUT_UNANSWERED])).toEqual([OPT_OUT_UNANSWERED]);
  });

  it("is finished once answered, in EITHER direction, so nobody is asked twice", () => {
    /* Answers are stored server-side precisely so the product page and the
       extras step cannot both ask. A shopper who ticked "leave out the
       packaging" in the buy box arrives at checkout already answered. */
    expect(pendingAddOns([OPT_OUT_DECLINED])).toEqual([]);
    expect(pendingAddOns([OPT_OUT_KEPT])).toEqual([]);
  });

  it("is on the order whatever the shopper said, unlike an unanswered 'ask'", () => {
    /* Kept, it is applied at 0 and a box still goes in the parcel; declined,
       it is applied at a negative amount and money comes off. */
    expect(appliedAddOns([OPT_OUT_UNANSWERED])).toEqual([OPT_OUT_UNANSWERED]);
    expect(appliedAddOns([OPT_OUT_DECLINED])).toEqual([OPT_OUT_DECLINED]);
  });

  it("is never the drawer's quiet 'included' line — the shopper has a say over it", () => {
    expect(includedAddOns([OPT_OUT_UNANSWERED, OPT_OUT_DECLINED])).toEqual([]);
  });

  it("costs nothing while unanswered, and must not be priced as a charge", () => {
    expect(addOnAmountLabel(OPT_OUT_UNANSWERED.amount)).toBe("Free");
    expect(addOnPriceLabel(OPT_OUT_UNANSWERED.amount)).toBe("Free");
  });
});

describe("money that comes off the bill", () => {
  it("reads as a saving, not as a charge wearing a minus sign", () => {
    /* formatNaira would spell this "-₦2,000". The U+2212 minus and the space
       are what separate a subtraction from a negative charge at this size. */
    expect(addOnAmountLabel(OPT_OUT_DECLINED.amount)).toBe("− ₦2,000");
    expect(addOnPriceLabel(OPT_OUT_DECLINED.amount)).toBe("− ₦2,000");
    expect(savingLabel(-200000)).toBe("− ₦2,000");
  });

  it("drops the sign where the sentence already carries the direction", () => {
    /* "save − ₦2,000" would say the saving twice and read as a negative one. */
    expect(savingAmountLabel(-200000)).toBe("₦2,000");
    expect(savingAmountLabel(200000)).toBe("₦2,000");
  });

  it("is flagged on the totals row, so a panel need not re-read the glyph", () => {
    const rows = addOnRowsFor(
      [{ id: "ado_box", title: "Packaging", mode: "removed", amount: -200000 }],
      "NGN",
    );
    expect(rows).toEqual([
      { key: "ado_box", label: "Packaging — Removed", value: "− ₦2,000", saving: true },
    ]);
  });

  it("never reads as Included, which is what a KEPT opt-out reads as", () => {
    /* Both are boxes in the parcel on the order; only one of them is a refund,
       and the row has to be able to tell a shopper which. */
    const kept = addOnRowsFor([{ title: "Packaging", mode: "included", amount: 0 }], "NGN");
    expect(kept[0]).toMatchObject({ value: INCLUDED, saving: false });
  });
});

describe("what one unit costs, and how many of them there are", () => {
  it("shows the arithmetic for a per-item add-on", () => {
    expect(addOnUnitLabel(OPT_OUT_UNANSWERED)).toBe("₦500 each × 4");
  });

  it("uses the magnitude, so a refund does not claim every box is one", () => {
    expect(addOnUnitLabel(OPT_OUT_DECLINED)).toBe("₦500 each × 4");
  });

  it("says nothing for an order-basis add-on, whose unit IS the order", () => {
    expect(addOnUnitLabel({ ...OPT_OUT_UNANSWERED, basis: "order", units: 1 })).toBeNull();
  });

  it("says nothing for a single item — '₦500 each × 1' is a sum nobody needed", () => {
    expect(addOnUnitLabel({ ...OPT_OUT_UNANSWERED, units: 1 })).toBeNull();
  });

  it("quotes the saving from unitAmount × units, because amount is 0 until it is declined", () => {
    /* THE PRODUCT PAGE'S NUMBER. Before there is a cart there is no charge to
       read: keeping the box costs nothing, so the offer is only expressible as
       the multiplication. */
    expect(potentialSavingOf(OPT_OUT_UNANSWERED)).toBe(200000);
    expect(potentialSavingOf(OPT_OUT_DECLINED)).toBe(200000);
  });
});

describe("an order placed before per-item pricing existed", () => {
  /* THE FIELDS ARE SIMPLY ABSENT on every historical order. A strict read
     renders all of them as corrupt, so each has one fallback describing what
     those servers meant: one unit, charged once, costing the whole amount. */
  const OLD = {
    amount: { amount: 150000, currency: "NGN" },
  } as AddOnOffer;

  it("reads one unit, order basis, and the whole amount as the unit price", () => {
    expect(addOnUnits(OLD)).toBe(1);
    expect(addOnBasisOf(OLD)).toBe("order");
    expect(addOnUnitAmount(OLD)).toEqual({ amount: 150000, currency: "NGN" });
  });

  it("does not invent arithmetic it was never given", () => {
    expect(addOnUnitLabel(OLD)).toBeNull();
  });

  it("survives a units field that is not a number", () => {
    expect(addOnUnits({ units: Number.NaN })).toBe(1);
    expect(addOnUnits({ units: undefined })).toBe(1);
  });
});
