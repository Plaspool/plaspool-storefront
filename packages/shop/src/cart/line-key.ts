import type { CartLineKey } from "./types";

/**
 * How the UI identifies one basket row.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT USED TO BE HERE, AND WHY IT IS GONE.
 *
 * This file was `storage.ts`, and it read and wrote the whole basket to
 * `localStorage` — with one hard rule, that it persisted identifiers and a
 * quantity but NEVER a price, so pricing was always recomputed fresh.
 *
 * The basket now lives on the server, identified by a cookie, and prices are
 * re-quoted by the API on every read. That rule is therefore kept by the design
 * rather than by this file. What is NOT kept is the storage: a cart in
 * `localStorage` and a cart on the server is two carts, and the one that takes
 * the money has to win. Leaving the reader behind would have left something to
 * silently resurrect a basket the server had already changed.
 *
 * The key itself survives unchanged, because the UI still names a row by the
 * three things a customer chose. `cart-context.tsx` maps that to the API's own
 * spelling — one variant id — through `Product.variantIds`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `::` rather than a single colon: a slug cannot contain one, but a colour or
 * size id derived from free text could, and two rows that collapse to one key
 * are two rows the drawer draws over each other.
 */
export function lineKey(key: CartLineKey): string {
  return `${key.productSlug}::${key.colourId}::${key.sizeId}`;
}
