import type { LedgerEntry, PointsBalance, ShopCustomer } from "@plaspool/shop";

/**
 * Fixtures for `/dev/account` — the states no dev environment can reach.
 *
 * `/me/points`, `/me/points/ledger` and `/api/shop/customer/me` are all
 * credentialed, and the commerce API's `APP_ORIGINS` does not include
 * localhost, so every screen here renders from these instead. The ORDER
 * fixtures are not repeated: `../orders/fixtures` already has a careful set and
 * a second copy would be the one that drifts.
 *
 * EVERY WORD IN A `reason` BELOW IS SHAPED LIKE THE ADMIN'S OWN, because the
 * storefront prints it verbatim and the whole no-hardcoded-nouns rule rests on
 * that. `server/marketing/redemption/port.ts` writes
 * `Order ${orderId}: ${fmtPoints(...)} spent`, and the release form appends
 * `— ${reason}`. Inventing a tidier sentence here would bench a string the API
 * never sends.
 */

/** 20 Aug 2026, so stamps here line up with `../orders/fixtures`. */
const AUG_20 = 1787270400000;
const DAY = 24 * 60 * 60 * 1000;

export const CUSTOMER: ShopCustomer = {
  id: "cus_bench",
  email: "ada.obi@example.com",
  name: "Ada Obi",
};

/** The same person with no display name — the branch that decides between a
 *  greeting and a plain title, and the one nobody looks at. */
export const CUSTOMER_NO_NAME: ShopCustomer = {
  ...CUSTOMER,
  name: null,
};

export const BALANCE: PointsBalance = {
  points: 1240,
  lifetimeEarned: 3400,
  pointsLabelSingular: "Spool Point",
  pointsLabelPlural: "Spool Points",
  redemptionEnabled: true,
  minRedeemPoints: 500,
};

/** A wallet that has never been used. The rewards page shows this; the hub's
 *  balance line deliberately does not. */
export const BALANCE_ZERO: PointsBalance = {
  ...BALANCE,
  points: 0,
  lifetimeEarned: 0,
};

/**
 * A balance whose programme has no configured labels.
 *
 * THE CASE THE NO-NOUN RULE EXISTS FOR. `pointsLabel` answers null here, and
 * every surface that would have printed a number must print NOTHING — a bare
 * "1,240" with no noun is unreadable rather than partially useful. If this case
 * ever renders a number, the rule has been broken somewhere upstream.
 */
export const BALANCE_UNLABELLED: PointsBalance = {
  ...BALANCE,
  pointsLabelSingular: null,
  pointsLabelPlural: null,
};

/** Redemption switched off at the programme — the balance is real, the offer
 *  to spend it is not, and the copy has to drop. */
export const BALANCE_NO_REDEMPTION: PointsBalance = {
  ...BALANCE,
  redemptionEnabled: false,
};

function entry(
  n: number,
  kind: string,
  delta: number,
  balanceAfter: number,
  reason: string,
  daysAgo: number,
): LedgerEntry {
  return {
    id: `led_${n}`,
    kind,
    delta,
    balanceAfter,
    reason,
    createdAt: AUG_20 - daysAgo * DAY,
  };
}

/**
 * Newest first, exactly as the API answers.
 *
 * The set is chosen so every branch on the page is exercised at once:
 *   - a SPEND, which is the "discount used" row the whole page was asked for;
 *   - a RELEASE, which is filed under the API's `redemptions` filter while
 *     being a CREDIT — the case that decided the page filters by the sign of
 *     `delta` rather than by the API's own buckets;
 *   - a MANUAL adjustment, which belongs to neither of the API's other two
 *     filters and would have been invisible under them;
 *   - an AWARD, the ordinary way a balance grows;
 *   - a NEGATIVE MANUAL, so "spent" is not silently assumed to mean
 *     "redemption";
 *   - a very long reason, because the row truncates nothing and has to survive
 *     320px.
 */
export const LEDGER: LedgerEntry[] = [
  entry(1, "redemption", -500, 1240, "Order ord_2026000007F: 500 Spool Points spent", 1),
  entry(2, "return_award", 350, 1740, "Returned 5 spools", 3),
  entry(
    3,
    "redemption_release",
    250,
    1390,
    "Order ord_2026000004F: 250 Spool Points returned — order cancelled before dispatch",
    9,
  ),
  entry(4, "redemption", -250, 1140, "Order ord_2026000004F: 250 Spool Points spent", 11),
  entry(5, "manual", 100, 1390, "Goodwill credit after a late delivery", 20),
  entry(6, "manual", -40, 1290, "Correction: duplicate return counted twice on 14 Jul", 24),
  entry(7, "return_award", 700, 1330, "Returned 10 spools", 40),
  entry(8, "return_award", 630, 630, "Returned 9 spools", 61),
];

/** Every row is a credit — the state in which the "Spent" filter is empty and
 *  has to say so without claiming more than it knows. */
export const LEDGER_CREDITS_ONLY: LedgerEntry[] = LEDGER.filter((e) => e.delta >= 0);
