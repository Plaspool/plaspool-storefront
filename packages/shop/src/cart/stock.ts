import type { VariantStock } from "../data/types";

export type { VariantStock };

/**
 * How many of one variant a shopper may put in the basket.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE SHOP LET ANYONE ORDER 99 OF A THING IT HAD FOUR OF.
 *
 * Nothing between the buy box and the checkout freeze ever compared a quantity
 * to a stock level. `QuantityStepper` shipped with `max = 99` — a placeholder
 * written while the catalogue was static local data with no inventory in it at
 * all — and when the commerce API arrived four days later carrying real counts,
 * not one of the stepper's four call sites was given a real ceiling.
 *
 * So the refusal came at the very last gate: `POST /checkout/freeze` answers
 * `409 insufficient_stock`, and the shopper discovered the limit only after
 * filling in an address. The API had been sending the number the whole time.
 *
 * ═══ THE NUMBER ARRIVES TWICE, AND THE FRESHER ONE WINS ═══
 * A cart line carries `inStock` — quoted live on every cart read, so it is
 * `onHand - reserved` as of this second. The catalogue carries `available` per
 * variant too, but a catalogue response is ISR-cached for up to an hour
 * (`CATALOG_DETAIL_REVALIDATE`), so on a cart row it is the staler of the two
 * and must not be preferred. The product page has only the catalogue's copy,
 * which is the right answer there because no line exists yet.
 *
 * ═══ WHAT THE CATALOGUE IS FOR ON A CART ROW: `backorderable` ═══
 * A backorderable variant is SOLD PAST ZERO ON PURPOSE, and its `available`
 * goes negative to record it (`server/shop/admin/inventory.ts`). Capping such a
 * line at its stock level would refuse an order the shop actively wants to
 * take. The cart line does not carry the flag, the catalogue does, and it is
 * the half of the answer that barely ever changes — so a stale copy of it is
 * harmless in a way a stale COUNT is not.
 *
 * The rule below is the server's own, from `merge.ts` in the admin:
 *
 *     const ceiling = quote.backorderable ? requested : Math.max(0, quote.available);
 *
 * Keeping the two spellings identical is the point. A storefront that clamps
 * somewhere the server does not shows a shopper a limit that is not real; one
 * that clamps looser than the server sends them to the same dead end as before.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * The stepper's own sanity ceiling, unchanged from the day it was written.
 *
 * It is NOT an inventory claim and never was — it is the bound past which a
 * quantity is more likely a stuck key than an order. It still applies over the
 * top of a stock ceiling, so a warehouse holding 4,000 spools does not get a
 * stepper you can hold the plus key on for an afternoon.
 */
export const MAX_LINE_QTY = 99;

/**
 * The most this variant may be ordered in, for a stepper's `max`.
 *
 * ALWAYS A NUMBER, never null, because that is what the control needs and a
 * caller left to spell `?? MAX_LINE_QTY` itself is a caller that will one day
 * forget. "No ceiling" is expressed as `MAX_LINE_QTY`, which is the honest
 * answer: there is always a ceiling, and when stock does not set one the UI's
 * own still does.
 *
 * NEVER BELOW 1. A stepper whose `max` is under its `min` is incoherent — the
 * clamp inverts and the minus button starts producing the maximum. A row with
 * nothing left is not a quantity problem anyway: the API marks it
 * `available: false` and it leaves the basket through `partitionLines` as
 * unsellable, which is the path that can actually offer to remove it.
 */
export function maxQtyFor(stock: VariantStock | null | undefined): number {
  if (!stock || stock.backorderable || stock.available === null) return MAX_LINE_QTY;
  return Math.max(1, Math.min(MAX_LINE_QTY, stock.available));
}

/**
 * What the catalogue knows about the variant a (colour, size) pair names.
 *
 * Keyed exactly as `variantIds` is, and for the reason that map exists: the UI
 * names a row by a triple and the API names it by one variant id. A missing key
 * is a combination that is not for sale, and answers `null` rather than a
 * fabricated zero.
 *
 * THE KEY IS SPELLED OUT HERE rather than imported from `variantKey` in
 * `data/api.ts`: that module is the catalogue's fetch client, and pulling it
 * into the cart to borrow a two-token template would put the whole thing in
 * the bundle. `variantIdsFrom` and `variantStockFrom` are the authority on the
 * shape, and they build it the same way — the same standing agreement
 * `sizesFrom` and `variantIdsFrom` already have about a size id.
 */
export function stockOf(
  entry: { variantStock: Record<string, VariantStock> },
  colourId: string,
  sizeId: string,
): VariantStock | null {
  return entry.variantStock[`${colourId}:${sizeId}`] ?? null;
}

/**
 * The ceiling for a CART line: the server's live count, the catalogue's flag.
 *
 * The split is the whole subtlety of this module — see the header. `inStock`
 * comes off the line (fresh); `backorderable` comes off the catalogue (stale,
 * and it does not matter).
 */
export function maxQtyForLine(
  inStock: number | null,
  stock: VariantStock | null | undefined,
): number {
  return maxQtyFor({ available: inStock, backorderable: stock?.backorderable ?? false });
}

/**
 * Whether a row should say how few are left, and the number to say.
 *
 * ONLY WHEN THE SHOPPER IS AT OR PAST THE LIMIT. A shop that captions every
 * row with its stock level is a shop shouting scarcity at people who are not
 * near it, and the caption stops being read by the time it matters. `null` is
 * the ordinary case and means "say nothing".
 *
 * ═══ AND ONLY WHEN THE LIMIT IS A SHELF, NOT THE SANITY CEILING ═══
 * `MAX_LINE_QTY` is not an inventory claim, so a shopper who holds the plus key
 * to 99 on an UNTRACKED product must not be told the shop has 99 of it. That
 * number is this file's own invention; presenting it as stock would be the
 * storefront inventing a fact about the warehouse.
 *
 * The cost is one false negative: a variant with exactly 99 on the shelf is
 * capped correctly and says nothing about why. That is the right way round —
 * a missing caption is a smaller failure than a fabricated one, and it is the
 * only case where the two ceilings are indistinguishable from here.
 */
export function stockWarning(qty: number, max: number): number | null {
  if (max >= MAX_LINE_QTY) return null;
  return qty >= max ? max : null;
}
