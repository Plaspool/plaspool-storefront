import type { BulkTier, Colour, SizeOption } from "../data/types";
import type { CartCatalogEntry } from "./cart-context";
import type { UnsellableLine } from "./sellable";

/**
 * Cart types, split out from `cart-context.tsx` so `line-key.ts` — a plain
 * module with no React and no `"use client"` — can import `CartLineKey` without
 * pulling the provider in with it. (That file was `storage.ts` until the basket
 * moved to the server; the split is still load-bearing for the same reason.)
 *
 * Ruling R3: the brief's Step 1 opens with
 * `import type { CartLine } from "./types-or-inline"`, which is not a module,
 * only a drafting artefact. This file is the `./types` it should have named.
 */

/** Identifies one cart line: a specific product, colour and size. Two lines
 *  with the same key are the same line — quantities merge into one, they
 *  never stack as a duplicate entry. */
export interface CartLineKey {
  productSlug: string;
  colourId: string;
  sizeId: string;
}

/** The persisted shape. Identifiers and a quantity, never a price — see
 *  `storage.ts` for why that is the one hard rule of this task. */
export interface CartLine extends CartLineKey {
  qty: number;
}

/** A `CartLine` joined against the live catalog, with pricing computed fresh
 *  on every render rather than read from storage. Produced by
 *  `cart-context.tsx`'s `resolved`, which drops any line whose product,
 *  colour or size no longer exists in the catalog before it reaches this
 *  shape — a product pulled from the catalog must not crash the drawer. */
export interface ResolvedLine {
  key: string;
  /**
   * The CART-SIZED projection, not the full `Product`.
   *
   * Narrowed when the catalogue went live: the provider is a client component
   * fed from the server, and shipping a description document per product into
   * every shop page's bundle to price a cart nobody has opened is not worth it.
   * `CartCatalogEntry` is what the drawer and the arithmetic actually read —
   * widening this back means widening what crosses that boundary.
   */
  product: CartCatalogEntry;
  colour: Colour;
  size: SizeOption;
  qty: number;
  /** The LIST price per unit, as the server quotes it. Struck through when a
   *  bulk rung applied. */
  unitPrice: number;
  /**
   * What they actually pay per unit — the server's `effectiveUnit`, or the list
   * price when no rung applied or the API predates bulk discounts.
   */
  effectiveUnitPrice: number;
  /** The rung that applied, in basis points. `0` is no discount. */
  bulkPercentBps: number;
  /**
   * Units of this PRODUCT across every line, which is what earned the rung —
   * NOT this line's `qty`. It is the only thing that explains a line reading
   * "2 × black, 10% off".
   */
  bulkQty: number;
  /**
   * `effectiveUnit × qty`, TAKEN FROM THE SERVER rather than multiplied here.
   * A line total recomputed from `unitPrice` is a number the customer is not
   * charged.
   */
  total: number;
  tier: BulkTier | null;
  /**
   * The most this row may be ordered in — the stepper's `max`, already decided.
   *
   * ═══ COMPUTED HERE SO EVERY BASKET SURFACE GETS THE SAME ANSWER ═══
   * The drawer and `/cart` each render their own stepper, and the rule needs
   * two inputs from two places: the LINE's live `inStock` and the CATALOGUE's
   * `backorderable`. Left to the call sites, that is the same decision written
   * twice — which is precisely how `resolved` and `itemCount` drifted apart and
   * produced a badge counting rows the drawer could not draw (see `sellable.ts`).
   *
   * Always a number. "No ceiling" is `MAX_LINE_QTY`, never null — see
   * `maxQtyFor`.
   */
  maxQty: number;
}

/** The cart's whole public surface. `hydrated` gates anything derived from
 *  `lines`/`resolved` — the server always renders an empty cart, and nothing
 *  that depends on the real one may render until the client has loaded it.
 *  See `cart-context.tsx` for the full rule. */
export interface CartApi {
  lines: CartLine[];
  resolved: ResolvedLine[];
  /**
   * Lines the server is holding that the shopper cannot buy — the variant left
   * the catalogue, or the API marked it unavailable.
   *
   * SURFACED RATHER THAN DROPPED. These used to be filtered out of `resolved`
   * and silently counted in `itemCount`, which is a badge reading 1 over a
   * drawer reading "Your cart is empty" and no control anywhere able to remove
   * the line. Every surface that draws a basket must draw these too, because
   * `/checkout` refuses the whole cart over them and tells the shopper to go
   * back and remove one.
   */
  unsellable: UnsellableLine[];
  /** UNITS THE SHOPPER CAN ACTUALLY BUY. Never the raw server line count — see
   *  `unsellable` for what that cost. */
  itemCount: number;
  subtotal: number;
  savings: number;
  hydrated: boolean;
  /**
   * A write is in flight. The basket lives on the server now, so an edit is a
   * round trip rather than a state update — controls disable against this
   * instead of letting two edits race and land in whatever order the network
   * chose.
   */
  pending: boolean;
  /**
   * What the SERVER changed without being asked: a line dropped because its
   * variant vanished, a quantity clamped to what is left. Surfaced because a
   * basket that silently edits itself is the failure this exists to prevent.
   */
  changes: { lineId?: string; reason?: string }[];
  /**
   * What the last write ran into, in the shopper's words, or null.
   *
   * DISTINCT FROM `changes`, which is the server editing the basket on its own
   * initiative. This is the shopper's own edit not landing — and it exists
   * because it used to not exist: every failure was swallowed into "keep
   * showing what we have", so a cart the server had retired sat on screen with
   * a Remove button that did nothing and said nothing.
   */
  problem: string | null;
  add(key: CartLineKey, qty?: number): void;
  /**
   * Add several lines at once, BY VARIANT ID rather than by the (product,
   * colour, size) triple the UI names a row by.
   *
   * This exists for "order it again", where the source is an order line and an
   * order line carries a `variantId` and nothing the catalogue keys on. A
   * variant the catalogue no longer sells is skipped rather than failing the
   * whole reorder — the count comes back so the caller can say what happened
   * instead of silently delivering a shorter basket.
   */
  addVariants(items: { variantId: string; qty: number }[]): Promise<{
    /** UNITS that reached the basket — the same thing `itemCount` counts, so a
     *  reorder's message cannot contradict the badge it just changed. */
    added: number;
    /** Lines whose write failed. The caller must say so: a basket that did not
     *  change while the page claims it did is the worst available outcome. */
    failed: number;
    /** Variants the catalogue no longer sells. Returned as ids rather than a
     *  count so the caller can name what it left out. */
    skippedVariantIds: string[];
  }>;
  setQty(key: CartLineKey, qty: number): void;
  remove(key: CartLineKey): void;
  /**
   * Remove BY SERVER LINE ID, for an `unsellable` row.
   *
   * The `(product, colour, size)` key every other control is built on cannot
   * name a line whose variant the catalogue has lost — there is no colour and
   * no size to name it with. That is why the old `remove(key)` could never
   * reach the one line a shopper most needed to take out.
   */
  removeLineId(lineId: string): void;
  clear(): void;
  /**
   * Re-read the basket from the server, for when something OFF-SCREEN has
   * changed it and this tab would otherwise never find out.
   *
   * THE CASE IT EXISTS FOR IS PAYING. The commerce API turns the cart into an
   * order on its own side; nothing tells this tab, and the provider used to
   * read the cart exactly once per full page load — so the badge went on
   * showing a basket the shopper had already bought until they refreshed by
   * hand. `/checkout/complete` calls this the moment the payment is known
   * captured.
   *
   * NOT needed after an ordinary edit: `add`, `setQty` and `remove` already
   * answer with the whole new cart, so a read on top of one would be a second
   * round trip and a window in which the two disagree.
   */
  refresh(): Promise<void>;
  isOpen: boolean;
  open(): void;
  close(): void;
}
