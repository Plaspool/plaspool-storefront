import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PointsOffer } from "./points-offer";
import type { Adjustment } from "../data/checkout-api";
import type { PointsBalance } from "../data/points-api";

/**
 * Nouns nobody at PlaSpool would choose, on purpose — the trick
 * `return-intro.test.tsx` uses and for the same reason. The live programme
 * says "Spool Points", so a component that hardcoded it would still pass
 * against a realistic fixture.
 */
const BALANCE: PointsBalance = {
  points: 533,
  lifetimeEarned: 533,
  pointsLabelSingular: "Bottle Cap",
  pointsLabelPlural: "Bottle Caps",
  redemptionEnabled: true,
  minRedeemPoints: 50,
};

const GRANTED: Adjustment = {
  code: "points_redemption",
  label: "38 Bottle Caps redeemed",
  amount: { amount: -380000, currency: "NGN" },
};

function render(props: Partial<React.ComponentProps<typeof PointsOffer>> = {}) {
  return renderToStaticMarkup(
    <PointsOffer
      balance={BALANCE}
      chosen={0}
      granted={null}
      onChange={() => {}}
      {...props}
    />,
  );
}

it("offers the balance in the operator's own words", () => {
  expect(render()).toContain("533 Bottle Caps");
});

/**
 * ═══ THE REGRESSION THIS FILE EXISTS FOR ═══
 * This panel promised "Your discount is applied on the next screen, before you
 * pay" — written when points were asked for on a step BEFORE the total. The
 * checkout was compressed to two steps and the widget moved beside the total
 * it moves, so the screen it pointed at stopped existing: the shopper is
 * already on step 2 of 2 and the only thing after it is Paystack.
 */
it("never promises a discount on a screen that does not exist", () => {
  const html = render({ chosen: 533, granted: GRANTED }) + render({ chosen: 533 });
  expect(html).not.toContain("next screen");
});

it("points at the total when the freeze actually granted a discount", () => {
  const html = render({ chosen: 533, granted: GRANTED });
  expect(html).toContain("total above");
});

/**
 * ═══ THE BUG THE OWNER HIT ═══
 * The freeze re-decides the amount and answers "none" for reasons this widget
 * cannot see — redemption switched off, a currency mismatch, or the order being
 * too small for `max_redeem_bps` to clear `min_redeem_points`. Every one of
 * those came back as a 200 with no adjustment, and the panel went on claiming a
 * discount was coming. A decline has to read as a decline.
 */
it("says so when the freeze granted nothing, rather than implying success", () => {
  const html = render({ chosen: 533, granted: null });
  // No apostrophe in the needle: `renderToStaticMarkup` escapes it to `&#x27;`,
  // so asserting on the typed character tests the escaper, not the copy.
  expect(html).toContain("be applied to this order");
  expect(html).toContain("Nothing has been spent");
  // And in the programme's own words, like every other noun in this panel.
  expect(html).toContain("bottle caps");
});

it("stays silent about an outcome nobody has asked for yet", () => {
  const html = render({ chosen: 0, granted: null });
  expect(html).not.toContain("be applied to this order");
  expect(html).not.toContain("total above");
});

it("renders nothing at all when there is nothing to offer", () => {
  expect(render({ balance: null })).toBe("");
  expect(render({ balance: { ...BALANCE, redemptionEnabled: false } })).toBe("");
  // A balance under the programme's own minimum is not an offer either.
  expect(render({ balance: { ...BALANCE, points: 10 } })).toBe("");
  // Nor is a balance whose noun the operator never configured.
  expect(
    render({
      balance: { ...BALANCE, pointsLabelSingular: null, pointsLabelPlural: null },
    }),
  ).toBe("");
});
