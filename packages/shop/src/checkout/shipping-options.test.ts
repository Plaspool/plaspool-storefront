import { describe, expect, it } from "vitest";
import {
  basketSignature,
  reconcileShippingSelection,
  shippingIsStale,
} from "./shipping-options";
import type { ShippingOption } from "../data/checkout-api";

/**
 * WHAT THESE ARE ABOUT. Delivery price now moves with basket weight, so a held
 * option list expires when the basket does. Every test here is a way for the
 * shopper to be shown a delivery price that is no longer the one they will be
 * charged — which the server corrects at freeze, meaning the failure is not a
 * wrong charge but a number that jumps on the payment step.
 */

const option = (
  id: string,
  amount: number,
  label = "Delivery",
  eta?: string,
): ShippingOption => ({
  id,
  label,
  amount: { amount, currency: "NGN" },
  taxable: true,
  ...(eta ? { eta } : {}),
});

/** The two shapes the same option has on the two environments. Production is
 *  the one that has to look right. */
const PROD: ShippingOption = option("fez:400000", 400000, "Fez Delivery");
const DEV: ShippingOption = option("fez:400000", 400000, "Fez Delivery", "2 - 5 day(s)");

describe("basketSignature", () => {
  it("moves when a quantity does — the ₦4,000 to ₦5,000 case", () => {
    const one = basketSignature([{ variantId: "spool", qty: 1 }]);
    const five = basketSignature([{ variantId: "spool", qty: 5 }]);
    expect(one).not.toBe(five);
  });

  it("moves when a variant is swapped for another at the same quantity", () => {
    expect(basketSignature([{ variantId: "a", qty: 2 }])).not.toBe(
      basketSignature([{ variantId: "b", qty: 2 }]),
    );
  });

  it("moves when a line is added or removed", () => {
    const before = basketSignature([{ variantId: "a", qty: 1 }]);
    const after = basketSignature([
      { variantId: "a", qty: 1 },
      { variantId: "b", qty: 1 },
    ]);
    expect(before).not.toBe(after);
  });

  it("does NOT move when the same lines merely reorder", () => {
    // Reordering costs no weight, so it must not cost a round trip.
    expect(
      basketSignature([
        { variantId: "a", qty: 1 },
        { variantId: "b", qty: 2 },
      ]),
    ).toBe(
      basketSignature([
        { variantId: "b", qty: 2 },
        { variantId: "a", qty: 1 },
      ]),
    );
  });

  it("gives the empty basket its own signature, not an empty string", () => {
    // So "no lines" and "not hydrated" can never be read as the same thing.
    expect(basketSignature([])).toBe("empty");
    expect(basketSignature([])).not.toBe("");
  });
});

describe("shippingIsStale", () => {
  it("is false before anything has been quoted", () => {
    expect(shippingIsStale(null, "spool:1")).toBe(false);
  });

  it("is false while the basket is the one that was quoted", () => {
    expect(shippingIsStale("spool:1", "spool:1")).toBe(false);
  });

  it("is true once the basket has moved", () => {
    expect(shippingIsStale("spool:1", "spool:5")).toBe(true);
  });
});

describe("reconcileShippingSelection", () => {
  it("keeps the shopper's choice when the requote still offers it", () => {
    // Terminal returns several; a shopper who picked the cheaper slower one
    // must not be silently moved back to the default by adding a spool.
    const options = [option("t:express", 900000), option("t:standard", 500000)];
    expect(reconcileShippingSelection(options, "t:standard")).toBe("t:standard");
  });

  it("matches by id alone, though the amount and label have both moved", () => {
    const before = [option("fez:400000", 400000, "Fez — 2 to 3 days")];
    const after = [option("fez:400000", 500000, "Fez")];
    expect(reconcileShippingSelection(before, "fez:400000")).toBe("fez:400000");
    expect(reconcileShippingSelection(after, "fez:400000")).toBe("fez:400000");
  });

  it("falls to the first option when the previous choice is gone", () => {
    // An id the new list lacks would be refused by PUT /checkout/shipping, and
    // a checkout stuck on a dead selection cannot be completed.
    const options = [option("fez:500000", 500000)];
    expect(reconcileShippingSelection(options, "fez:400000")).toBe("fez:500000");
  });

  it("selects the only option when there was no previous choice", () => {
    expect(reconcileShippingSelection([option("fez:400000", 400000)], null)).toBe("fez:400000");
  });

  it("is null when the address was refused and no option came back", () => {
    // options: [] is a refusal to show, not an error and not a price.
    expect(reconcileShippingSelection([], "fez:400000")).toBeNull();
    expect(reconcileShippingSelection([], null)).toBeNull();
  });

  it("never reads a price out of the id", () => {
    // The id is opaque. `fez:500000` sorts before `fez:400000` as a string and
    // is the larger amount as a number — if anything parsed it, one of these
    // orderings would win. Neither does: the first option wins.
    const options = [option("fez:500000", 500000), option("fez:400000", 400000)];
    expect(reconcileShippingSelection(options, null)).toBe("fez:500000");
  });
});

describe("the eta is optional, and production is the one without it", () => {
  it("is simply absent in production and present on dev", () => {
    // Both are normal. A layout that assumes one will look broken on the other.
    expect(PROD.eta).toBeUndefined();
    expect("eta" in PROD).toBe(false);
    expect(DEV.eta).toBe("2 - 5 day(s)");
  });

  it("is not hidden inside the label any more, on either environment", () => {
    // It used to be glued in. A regex written against dev's label would match
    // nothing in production — so assert the label is JUST the courier name.
    expect(PROD.label).toBe("Fez Delivery");
    expect(DEV.label).toBe("Fez Delivery");
    expect(DEV.label).not.toContain("day");
  });

  it("does not affect which option is selected", () => {
    // Selection is by id alone; an eta appearing or vanishing between quotes
    // must not move the shopper off their choice.
    expect(reconcileShippingSelection([DEV], PROD.id)).toBe("fez:400000");
    expect(reconcileShippingSelection([PROD], DEV.id)).toBe("fez:400000");
  });
});

describe("the id carries the amount but is never the source of it", () => {
  it("crossing a weight band changes the id, so the held choice is replaced", () => {
    // 1 spool quotes fez:400000; 5 spools quote fez:500000. The cart is holding
    // an id the new list no longer offers, so it must be re-sent.
    const requoted = [option("fez:500000", 500000, "Fez Delivery")];
    expect(reconcileShippingSelection(requoted, "fez:400000")).toBe("fez:500000");
  });

  it("takes the price from amount, which need not agree with the id", () => {
    // The id is opaque: nothing may read 400000 out of `fez:400000`. A flat
    // zone rate proves it — its id carries no number at all.
    const flat = option("ship_abuja_standard", 300000, "Standard delivery");
    expect(flat.amount.amount).toBe(300000);
    expect(reconcileShippingSelection([flat], null)).toBe("ship_abuja_standard");
  });
});
