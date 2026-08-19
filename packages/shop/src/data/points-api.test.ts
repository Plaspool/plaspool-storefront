import { describe, expect, it } from "vitest";
import { pointsLabel, spendablePoints, type PointsBalance } from "./points-api";

/**
 * The two pure helpers behind the checkout's points widget.
 *
 * WHAT THESE ARE FOR, AND WHAT THEY ARE DELIBERATELY NOT.
 *
 * `spendablePoints` is a UI clamp. The API re-decides every rule at the freeze,
 * against a balance read at that instant and against a cap that is a share of
 * the order — a number this side cannot see, because the total is not final
 * until the freeze computes it. So these tests pin "does the widget appear and
 * with what ceiling", never "is the customer charged correctly", which is the
 * freeze's answer and is tested on the API side.
 *
 * `pointsLabel` guards the rule `marketing.ts` states at length: nothing in this
 * package may spell a points noun. The interesting cases are therefore the ones
 * where a noun is ABSENT — because the tempting fix is a fallback, and a
 * fallback is the exact failure the rule exists to prevent.
 */

const balance = (over: Partial<PointsBalance> = {}): PointsBalance => ({
  points: 500,
  lifetimeEarned: 500,
  // Invented for the fixture, never asserted as a value — see the file header.
  pointsLabelSingular: "Widget",
  pointsLabelPlural: "Widgets",
  redemptionEnabled: true,
  minRedeemPoints: 100,
  ...over,
});

describe("spendablePoints", () => {
  it("offers the whole balance when the programme allows it", () => {
    expect(spendablePoints(balance())).toBe(500);
  });

  it("offers nothing when there is no balance to read", () => {
    // The client answers null for every failure — network, 401, 500, bad body —
    // so this is also the guest case and the service-down case.
    expect(spendablePoints(null)).toBe(0);
  });

  it("offers nothing when redemption is switched off", () => {
    expect(spendablePoints(balance({ redemptionEnabled: false }))).toBe(0);
  });

  it("offers nothing for an empty wallet", () => {
    expect(spendablePoints(balance({ points: 0 }))).toBe(0);
  });

  it("offers nothing below the programme's own minimum", () => {
    // 99 of a 100-point minimum. The widget must not invite a customer to spend
    // an amount the freeze would then decline to quote.
    expect(spendablePoints(balance({ points: 99, minRedeemPoints: 100 }))).toBe(0);
  });

  it("offers the balance exactly AT the minimum", () => {
    // The boundary, spelled out: the minimum is what may be spent, not what must
    // be exceeded.
    expect(spendablePoints(balance({ points: 100, minRedeemPoints: 100 }))).toBe(100);
  });

  it("offers the balance when the programme sets no minimum", () => {
    expect(spendablePoints(balance({ points: 5, minRedeemPoints: null }))).toBe(5);
  });

  it("never offers a negative number", () => {
    // A balance cannot go negative — the API has a CHECK for it — so this is a
    // guard against a malformed body rather than a reachable state.
    expect(spendablePoints(balance({ points: -50 }))).toBe(0);
  });
});

describe("pointsLabel", () => {
  it("uses the singular for exactly one", () => {
    expect(pointsLabel(balance(), 1)).toBe("Widget");
  });

  it("uses the plural for everything else, including zero", () => {
    expect(pointsLabel(balance(), 0)).toBe("Widgets");
    expect(pointsLabel(balance(), 2)).toBe("Widgets");
  });

  it("pluralises by MAGNITUDE, so −1 is not a plural", () => {
    // A ledger row can be negative. "-1 Widgets" is wrong in the same way
    // "1 Widgets" is.
    expect(pointsLabel(balance(), -1)).toBe("Widget");
    expect(pointsLabel(balance(), -5)).toBe("Widgets");
  });

  it("ANSWERS NULL RATHER THAN INVENTING A NOUN when the programme has none", () => {
    /*
     * The one that matters. `marketing.ts` states the rule: an operator can
     * rename the programme, the admin enforces that no screen spells the words
     * itself, and a storefront with a hardcoded fallback would be the single
     * surface still showing the old name — or worse, showing a generic English
     * word the operator never chose. Null means the caller renders nothing.
     */
    expect(pointsLabel(balance({ pointsLabelSingular: null, pointsLabelPlural: null }), 5)).toBeNull();
    expect(pointsLabel(null, 5)).toBeNull();
  });

  it("treats a blank label as absent, not as a name", () => {
    // An empty string would render as a number with a trailing space, which
    // looks like a bug rather than like missing configuration.
    expect(pointsLabel(balance({ pointsLabelPlural: "   " }), 5)).toBeNull();
  });
});
