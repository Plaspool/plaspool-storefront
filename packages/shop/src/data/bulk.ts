import type { BulkTier } from "./types";

/**
 * The quantity ladder: which rung a quantity has reached, and what it would
 * take to reach the next.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * EVERY NUMBER THIS MODULE PRODUCES IS A PROJECTION, NEVER A CHARGE.
 *
 * The API resolves the ladder — the store-wide default, any per-product
 * override and the on/off switch are all applied server-side — then picks the
 * rung and quotes `effectiveUnit` on every cart and order line. This exists so
 * a PRODUCT PAGE can say what a quantity would earn before anything is in a
 * basket, which is the one moment there is no server line to read.
 *
 * The instant a line exists, the server's numbers win. Nothing here may be used
 * to recompute a total that the API has already quoted — see the note on
 * `TotalsLine` in `checkout-api.ts`.
 *
 * ═══ AN EMPTY LADDER IS A COMPLETE ANSWER ═══
 * `[]` means this product has no bulk discount. It is never a reason to fall
 * back to a ladder of our own: a second rule here is a rule that will disagree
 * with what the customer is actually charged. `bulkDiscountEnabled` is
 * informational and is deliberately read by nothing.
 *
 * ═══ BASIS POINTS ═══
 * `percentBps` is basis points — 10000 is 100%, so 1000 is 10%. The field this
 * replaced was `discountPct`, a whole-number percentage, and the two differ by
 * a factor of a hundred: a ladder read with the old spelling quotes a 1000%
 * discount and prices every spool at nothing.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** The best rung this quantity has reached, or null below the first. */
export function tierFor(tiers: BulkTier[], qty: number): BulkTier | null {
  let best: BulkTier | null = null;
  for (const tier of tiers) {
    if (qty >= tier.minQty && (!best || tier.minQty > best.minQty)) best = tier;
  }
  return best;
}

/**
 * The rung above the one this quantity has reached, or null on the top rung.
 *
 * THE API PROMISES ASCENDING ORDER AND THIS DOES NOT RELY ON IT, for the same
 * reason `tierFor` does not: a ladder that arrived out of order would otherwise
 * fail as a wrong price rather than as an error.
 */
export function nextTierFor(tiers: BulkTier[], qty: number): BulkTier | null {
  let next: BulkTier | null = null;
  for (const tier of tiers) {
    if (tier.minQty > qty && (!next || tier.minQty < next.minQty)) next = tier;
  }
  return next;
}

/** How many more units reach the next rung; 0 when there is none left. */
export function unitsToNextTier(tiers: BulkTier[], qty: number): number {
  const next = nextTierFor(tiers, qty);
  return next ? next.minQty - qty : 0;
}

/** Basis points as the percentage a shopper is shown: 1000 → 10, 750 → 7.5. */
export function percentFromBps(percentBps: number): number {
  return percentBps / 100;
}

/**
 * A basis-point discount taken off an amount in MINOR UNITS.
 *
 * Multiplied before dividing rather than through a `1 - bps/10000` factor,
 * because the factor is not representable in binary — `1 - 1000/10000` lands a
 * hair under 0.9 and turns ₦23,500 into 2114999.9999999998. Integer maths
 * first keeps a whole number of kobo, which is the only thing that can be
 * charged and the only thing `formatNaira` can render.
 */
export function applyBps(minor: number, percentBps: number): number {
  return Math.round((minor * (10_000 - percentBps)) / 10_000);
}

/**
 * The one line a CARD can honestly say about a ladder: "Save up to 15% on 10+".
 *
 * A listing has no quantity to reason about, so the deepest rung and what
 * reaches it is the only thing a shopper can act on. "Bulk discount available"
 * would be true and useless — it names neither a saving nor a quantity, so it
 * cannot change what anybody puts in a basket.
 *
 * THE DEEPEST DISCOUNT, NOT THE LAST RUNG. The API promises `minQty` ascends
 * and says nothing about the percentage doing the same; a ladder whose top rung
 * happened to be a smaller discount would otherwise advertise the wrong number.
 */
export function bulkAffordance(tiers: BulkTier[]): string | null {
  let best: BulkTier | null = null;
  for (const tier of tiers) {
    if (!best || tier.percentBps > best.percentBps) best = tier;
  }
  if (!best || best.percentBps <= 0) return null;
  return `Save up to ${percentFromBps(best.percentBps)}% on ${best.minQty}+`;
}
