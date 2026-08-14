import type { CartLine, CartLineKey } from "./types";

const KEY = "plaspool.cart.v1";

/**
 * Only identifiers are persisted. Prices are recomputed from the catalog on
 * every render, so a price change is picked up immediately instead of being
 * frozen into whatever the shopper saw the day they added the line — a price
 * baked into `localStorage` in August is a lie in September.
 *
 * The version lives in the key, not in the payload: a future v2 shape simply
 * does not read v1, rather than needing a migration that has to be right.
 */

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.productSlug === "string" &&
    typeof candidate.colourId === "string" &&
    typeof candidate.sizeId === "string" &&
    isPositiveInteger(candidate.qty)
  );
}

/**
 * JSON.parse in a try/catch; returns `[]` on anything unexpected — a
 * corrupted cart must not white-screen the shop. Drops any entry that is not
 * an object, that is missing a string `productSlug`/`colourId`/`sizeId`, or
 * whose `qty` is not a positive integer.
 *
 * Every surviving entry is rebuilt field by field rather than cast wholesale,
 * so a stray key on a hand-edited or older payload — a baked-in price, say —
 * can never ride along into the resolved cart.
 */
export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const lines: CartLine[] = [];
    for (const entry of parsed) {
      if (!isCartLine(entry)) continue;
      lines.push({
        productSlug: entry.productSlug,
        colourId: entry.colourId,
        sizeId: entry.sizeId,
        qty: entry.qty,
      });
    }
    return lines;
  } catch {
    return [];
  }
}

/** try/catch; a full or blocked `localStorage` (private browsing, quota) is
 *  not an error the shopper can act on — the cart still works for the rest
 *  of the session, it just will not survive a reload. */
export function writeCart(lines: CartLine[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Nothing actionable to surface here.
  }
}

export function lineKey(key: CartLineKey): string {
  return `${key.productSlug}::${key.colourId}::${key.sizeId}`;
}
