import type { ShippingOption } from "../data/checkout-api";

/**
 * The delivery options, and the one thing that can make them stale.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DELIVERY PRICE NOW DEPENDS ON BASKET WEIGHT.
 *
 * It did not used to. Under flat zone rates the number was settled the moment
 * the address was, so the options fetched by `PUT /checkout/addresses` stayed
 * true for the rest of the checkout and nothing had to watch the cart. With a
 * courier quote it moves: measured on production, one spool to Wuse is
 * ₦4,000 and five spools to the same address is ₦5,000, because the per-unit
 * 1 kg rule pushes the basket out of Fez's 0–5 kg band.
 *
 * So a held option list is only true for the basket it was quoted against.
 * `basketSignature()` is what says whether that basket still exists; when it
 * changes, the options must be re-read before any of them is shown or sent.
 *
 * WHAT GOES WRONG WITHOUT IT: the shopper adds two more spools after the
 * address step, is shown the one-spool delivery price, and the server
 * re-derives correctly at freeze — so the total jumps on the payment step,
 * which is the exact last-moment surprise the freeze exists to prevent.
 *
 * ═══ THE ID IS OPAQUE ═══
 * `id` used to be a zone option id and can now be a courier one carrying an
 * amount (`fez:400000`). NOTHING may parse it, match on it, or read a price
 * out of it — it is passed back verbatim, and the server refuses a client
 * that sends its own amount. It is compared for equality here and nowhere
 * else, which is the only thing an opaque handle allows.
 *
 * ═══ AND THE LABEL IS THE SERVER'S ═══
 * The ETA is already inside `label` when the courier supplies one. Live Fez
 * returns none today and the sandbox does, so any regex written to pull one
 * out would match nothing in production and match on dev — the worst possible
 * split. Render `label` as given.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** One cart line, reduced to the parts a courier quote depends on. */
export interface BasketLine {
  variantId: string;
  qty: number;
}

/**
 * What the delivery options were quoted against.
 *
 * VARIANT AND QUANTITY, because weight is per unit — swapping a line for a
 * different variant changes the weight as surely as adding one does. SORTED,
 * so a cart that merely reorders its lines does not read as a new basket and
 * cost a pointless round trip.
 *
 * The empty basket has its own signature rather than `""`, so "no lines yet"
 * and "not hydrated yet" cannot be confused for one another.
 */
export function basketSignature(lines: readonly BasketLine[]): string {
  if (lines.length === 0) return "empty";
  return lines
    .map((line) => `${line.variantId}:${line.qty}`)
    .sort()
    .join("|");
}

/**
 * The option to keep selected once a fresh list has arrived.
 *
 * THE SHOPPER'S CHOICE SURVIVES A REQUOTE IF IT STILL EXISTS. Terminal returns
 * several options; a shopper who picked the slower cheaper one and then added
 * a spool must not silently land back on the default. Matching is by id and
 * only by id — the label may now carry a different ETA and the amount will
 * have moved, which is the whole point of the requote.
 *
 * NULL WHEN THERE IS NOTHING TO SELECT, and the first option when the previous
 * choice is gone: an id the new list does not contain would be refused by
 * `PUT /checkout/shipping`, and a checkout stuck on a dead selection cannot be
 * completed.
 */
export function reconcileShippingSelection(
  options: readonly ShippingOption[],
  previousId: string | null,
): string | null {
  if (options.length === 0) return null;
  if (previousId && options.some((option) => option.id === previousId)) return previousId;
  return options[0].id;
}

/**
 * Whether a held option list still describes this basket.
 *
 * `quotedFor === null` means nothing has been quoted yet — there is nothing
 * stale, and nothing to re-read.
 */
export function shippingIsStale(quotedFor: string | null, current: string): boolean {
  return quotedFor !== null && quotedFor !== current;
}
