import type { ApiCartView, CartResult } from "../data/cart-api";

/**
 * What a cart READ means for what is on screen.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS RULE USED TO LIVE INSIDE A MOUNT EFFECT, WHERE IT COULD NOT BE WRONG.
 *
 * The provider read the cart exactly once, on mount, and applied this inline.
 * `gone` therefore did nothing at all — and that was invisible, because the
 * view it would have cleared was already empty. There was no second read for
 * the missing branch to matter to.
 *
 * A read after a payment comes back is that second read, and it is where the
 * gap showed: a basket that has become an order answers 404, the provider kept
 * the previous view, and the badge went on advertising items the shopper had
 * already paid for until they reloaded the page by hand.
 *
 * So the branch is spelled out here, once, and BOTH the mount read and every
 * later refresh go through it. Two copies of this rule is how the mount case
 * and the refresh case drift apart.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A plain module with no React and no `"use client"`, for the reason
 * `sellable.ts` is one: this suite is `environment: "node"` (see
 * `vitest.config.mts`), so a decision worth asserting has to live outside the
 * component that uses it.
 */

/** The cart nobody has: what the server renders, and what a retired basket
 *  collapses to. Shared with `cart-context.tsx` so there is one empty. */
export const EMPTY_VIEW: ApiCartView = { cart: null, lines: [], preview: null, changes: [] };

export interface ReadOutcome {
  /**
   * The view to adopt, or NULL meaning "leave on screen whatever is already
   * there".
   *
   * The null is load-bearing and is not the same as `EMPTY_VIEW`: a read that
   * failed is not an empty cart, and replacing a full basket with an empty one
   * because a request timed out looks exactly like a customer's cart being
   * thrown away.
   */
  view: ApiCartView | null;
  /** What to tell the shopper, in their words, or null when there is nothing
   *  wrong worth saying. */
  problem: string | null;
}

export function outcomeOfRead(result: CartResult): ReadOutcome {
  if (result.ok) return { view: result.view, problem: null };

  /* GONE IS A STATE, NOT A FAILURE. There is no cart — it expired, or it
     became an order — so the basket on screen is finished and continuing to
     draw it is the bug rather than the fix. And it is silent: a shopper who
     has just checked out does not need their spent basket reported in red. */
  if (result.reason === "gone") return { view: EMPTY_VIEW, problem: null };

  /* OFFLINE OR REFUSED. Neither is evidence the basket changed, so keep it and
     say that this read did not land. */
  return { view: null, problem: "We couldn't load your cart. Refresh to try again." };
}
