import { COMMERCE_API_BASE } from "./config";

/**
 * The points client — a signed-in customer's own balance and history.
 *
 *   GET /api/marketing/me/points
 *   GET /api/marketing/me/points/ledger
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `/api/marketing`, NOT `/api/shop`, AND THAT IS NOT AN INCONSISTENCY.
 *
 * The ledger belongs to the admin's marketing subsystem, which may not import
 * the shop's code and vice versa — the two halves only meet at the API's
 * composition root. These reads are marketing's, so they answer on marketing's
 * prefix, which is why this file does not reuse `cart-api`'s or
 * `checkout-api`'s `request()` helper: both hardcode `/api/shop`.
 *
 * NO POINTS OR UNIT NOUN IS SPELLED IN THIS PACKAGE. `marketing.ts` sets out
 * the rule and why it is a rule rather than a preference: an operator can
 * rename the programme, the admin enforces on its own side that no screen
 * spells the words itself, and a storefront that hardcoded them would be the
 * one surface still using the old name after a rename. So the labels arrive
 * WITH the balance, and a response that carries none renders nothing.
 *
 * CROSS-SITE, so `credentials: "include"` — the same `__Host-shop_session` the
 * cart and checkout clients send, and the reason the API sets
 * `access-control-allow-credentials` on these two paths specifically.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * NEITHER READ THROWS, and neither answers an error shape. A points service
 * having a bad day must not take a checkout down: the balance is an OFFER, and
 * the honest degraded state is not making it. Every failure — network, 401,
 * 500, malformed body — is `null`, which every caller here renders as "no
 * widget", exactly as the API's own `quote()` answers null for "nothing to
 * show" rather than raising.
 */

/**
 * A balance, and the words for it.
 *
 * `points` IS A COUNT, NOT MONEY. Deliberately a bare number and not the
 * `{ amount, currency }` shape `ApiMoney` uses — this system already runs two
 * money conventions (an order's totals are plain minor units, a cart's are
 * objects) and a third thing that merely looked like money would invite the
 * wrong one. What a balance is WORTH depends on the cart it is spent against,
 * because the cap is a share of the order, so only the freeze can answer it.
 *
 * The label fields are nullable because the programme's configuration may be
 * absent. Nullable, not defaulted: there is no correct noun to invent here.
 */
export interface PointsBalance {
  points: number;
  lifetimeEarned: number;
  pointsLabelSingular: string | null;
  pointsLabelPlural: string | null;
  /** Whether spending is offered at all. Not the whole answer — the API also
   *  requires the programme's currency to match the cart's — but it is the half
   *  that needs no cart, and the freeze stays authoritative either way. */
  redemptionEnabled: boolean;
  /** Below this, the API declines to quote. Null when unconfigured. */
  minRedeemPoints: number | null;
}

export interface LedgerEntry {
  id: string;
  kind: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  createdAt: number;
}

export interface LedgerPage {
  items: LedgerEntry[];
  nextCursor: string | null;
}

async function read<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${COMMERCE_API_BASE}/api/marketing${path}`, {
      credentials: "include",
    });
    // A 401 is the ordinary answer for a guest, not an exception — every caller
    // here already treats "no balance" and "not signed in" the same way.
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function getPointsBalance(): Promise<PointsBalance | null> {
  return read<PointsBalance>("/me/points");
}

export function getPointsLedger(cursor?: string): Promise<LedgerPage | null> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return read<LedgerPage>(`/me/points/ledger${query}`);
}

/**
 * How many points this customer may actually offer to spend right now.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS IS A UI CLAMP AND NOTHING MORE. The API re-decides every one of these
 * rules at the freeze, against a balance read at that instant and against a cap
 * (`max_redeem_bps`) that is a share of the order — a number this function
 * cannot see, because the total is not final until the freeze computes it.
 *
 * So this exists to stop the widget offering an obviously impossible number,
 * not to be right. A value that survives this and is then clamped further by
 * the API is expected and correct; the freeze's response is what the customer
 * is charged against. Duplicating the cap here would be a second implementation
 * of a money rule, which is the thing that eventually disagrees.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Returns 0 for every "no widget" case — redemption switched off, no balance,
 * or a balance under the programme's own minimum — so a caller can branch on
 * one number instead of re-testing three conditions and eventually missing one.
 */
export function spendablePoints(balance: PointsBalance | null): number {
  if (!balance || !balance.redemptionEnabled) return 0;
  if (balance.points <= 0) return 0;
  if (balance.minRedeemPoints !== null && balance.points < balance.minRedeemPoints) return 0;
  return balance.points;
}

/**
 * The label for a quantity, in the operator's words, or null.
 *
 * NULL RATHER THAN A FALLBACK NOUN, for the reason the file header gives: there
 * is no correct English word to reach for, and inventing one here is exactly
 * the failure the admin's own guard exists to prevent. A caller with null
 * renders no label — and, since a bare number with no noun is meaningless,
 * renders nothing at all.
 *
 * Plural by magnitude so a single point does not read as a plural.
 */
export function pointsLabel(balance: PointsBalance | null, quantity: number): string | null {
  if (!balance) return null;
  const label =
    Math.abs(quantity) === 1 ? balance.pointsLabelSingular : balance.pointsLabelPlural;
  return label && label.trim() !== "" ? label : null;
}
