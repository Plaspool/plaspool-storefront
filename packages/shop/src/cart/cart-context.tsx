"use client";

import * as React from "react";

import { addLine, createCart, majorUnits, readCart, removeLine, setLineQty } from "../data/cart-api";
import { lineKey } from "./line-key";
import type { ApiCartView } from "../data/cart-api";
import type { CartApi, CartLine, CartLineKey, ResolvedLine } from "./types";
import type { BulkTier, Colour, SizeOption } from "../data/types";

/**
 * The cart's state, now held by the SERVER.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT CHANGED, AND WHAT DELIBERATELY DID NOT.
 *
 * This used to be `localStorage` plus arithmetic. The basket now lives in the
 * commerce API, identified by a cookie, and every mutation here is a request
 * whose response IS the new state — so this component stores what the server
 * said and computes almost nothing.
 *
 * THE PRICES ARE THE SERVER'S, and that is the point of the move. `unit` is
 * re-quoted from the live catalogue on every read rather than stored on the
 * line, so a price change reaches an open basket, and the number shown in the
 * drawer is the number checkout will charge. A cart that does its own
 * arithmetic is a cart that can disagree with the till.
 *
 * THE HYDRATION RULE SURVIVES UNCHANGED, and for the same reason as before: the
 * server rendering this page has no customer cookie, so it cannot know the
 * basket and always renders an empty one. If the client's first render differed,
 * React would reconcile against a tree the server never sent and throw on every
 * page with a cart badge. So the view starts empty on both sides, and a
 * client-only effect loads the real cart and flips `hydrated`. Anything derived
 * from the cart must render nothing until then.
 *
 * WHAT WENT AWAY. `storage.ts` is deleted — a cart in `localStorage` and a cart
 * on the server is two carts, and the one that takes the money has to win.
 * Leaving its reader behind would have left something able to resurrect a
 * basket the server had already changed. Only `lineKey` survived, in
 * `line-key.ts`, because the UI still names a row by the three things a
 * customer chose.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const CartContext = React.createContext<CartApi | null>(null);

/**
 * The cart-sized projection of a product, fed from the server.
 *
 * `variantIds` IS THE BRIDGE BETWEEN THE TWO MODELS. A row in this UI is a
 * product, a colour and a size; a line in the API is one variant id. Without
 * this map the drawer could render a basket it had no way to modify.
 */
export interface CartCatalogEntry {
  slug: string;
  name: string;
  colours: Colour[];
  sizes: SizeOption[];
  bulkTiers: BulkTier[];
  /** `"<colourId>:<sizeId>"` → variant id, priced and active only. */
  variantIds: Record<string, string>;
}

export interface CartProviderProps {
  children: React.ReactNode;
  catalog: CartCatalogEntry[];
}

const EMPTY: ApiCartView = { cart: null, lines: [], preview: null, changes: [] };

export function CartProvider({ children, catalog }: CartProviderProps) {
  const [view, setView] = React.useState<ApiCartView>(EMPTY);
  const [hydrated, setHydrated] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  /** A write is in flight. The drawer disables its steppers rather than letting
   *  two edits race and land in the order the network chose. */
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void readCart().then((next) => {
      if (cancelled) return;
      if (next) setView(next);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => setIsOpen(false), []);

  /**
   * Two lookups over the catalogue, built once.
   *
   * `resolved` runs on every edit, and a linear scan per line would be
   * quadratic in a basket somebody actually filled.
   */
  const bySlug = React.useMemo(
    () => new Map(catalog.map((entry) => [entry.slug, entry])),
    [catalog],
  );

  /** variant id → the (product, colour, size) triple the UI names it by. */
  const byVariant = React.useMemo(() => {
    const out = new Map<string, { entry: CartCatalogEntry; colourId: string; sizeId: string }>();
    for (const entry of catalog) {
      for (const [key, variantId] of Object.entries(entry.variantIds)) {
        const [colourId, sizeId] = key.split(":");
        out.set(variantId, { entry, colourId, sizeId });
      }
    }
    return out;
  }, [catalog]);

  const variantFor = React.useCallback(
    (key: CartLineKey): string | null =>
      bySlug.get(key.productSlug)?.variantIds[`${key.colourId}:${key.sizeId}`] ?? null,
    [bySlug],
  );

  /** The server line matching a UI key, or null if the basket has none. */
  const lineIdFor = React.useCallback(
    (key: CartLineKey): string | null => {
      const variantId = variantFor(key);
      if (!variantId) return null;
      return view.lines.find((l) => l.variantId === variantId)?.id ?? null;
    },
    [variantFor, view.lines],
  );

  /**
   * Every mutation goes through here.
   *
   * A NULL ANSWER LEAVES THE PREVIOUS VIEW ALONE rather than clearing it. The
   * cart client returns null for any failure, and replacing a real basket with
   * an empty one because a request timed out is the worst available outcome —
   * it looks exactly like the customer's cart being thrown away.
   */
  const mutate = React.useCallback(async (run: () => Promise<ApiCartView | null>) => {
    setPending(true);
    try {
      const next = await run();
      if (next) setView(next);
      return next;
    } finally {
      setPending(false);
    }
  }, []);

  const add = React.useCallback(
    (key: CartLineKey, qty: number = 1) => {
      const variantId = variantFor(key);
      /* A combination with no variant is one that is not for sale — the map only
         holds priced, active variants. Opening the drawer on nothing would be a
         worse answer than doing nothing. */
      if (!variantId) return;
      const amount = Math.max(1, Math.trunc(qty));
      open();
      void mutate(async () => {
        /* LAZILY CREATED, on the first add rather than on page load: a cart per
           visitor would set a cookie on people who never touch the shop. A
           second create on an existing cookie is a 200 returning the same
           basket, so this is safe to call whenever there is no cart yet. */
        if (!view.cart) await createCart();
        return addLine(variantId, amount);
      });
    },
    [variantFor, open, mutate, view.cart],
  );

  /**
   * "Order it again", from an order's lines.
   *
   * BY VARIANT ID, because that is what an order line carries — the triple this
   * file keys on does not survive onto an order, and reconstructing it from the
   * stored option values would be guessing at strings the catalogue owns.
   * `byVariant` is the same map the drawer resolves rows through, so a variant
   * it does not know is one this storefront cannot draw or price: those are
   * SKIPPED and counted rather than sent, since a 404 per line would leave the
   * shopper with a half-filled basket and no explanation.
   *
   * SEQUENTIAL, for the reason `clear` is: each response is the whole new cart,
   * so parallel adds race the revision and the last one to land wins.
   */
  const addVariants = React.useCallback(
    async (items: { variantId: string; qty: number }[]) => {
      const known = items.filter((i) => byVariant.has(i.variantId) && i.qty > 0);
      const skippedVariantIds = items
        .filter((i) => !byVariant.has(i.variantId) || i.qty <= 0)
        .map((i) => i.variantId);
      if (known.length === 0) return { added: 0, failed: 0, skippedVariantIds };
      open();
      /* COUNTED IN UNITS, NOT LINES, because that is what the cart counts. The
         first cut returned `known.length`, so reordering two lines of qty 2 and
         1 announced "2 items added" beside a badge reading 3 — with the drawer
         open and both numbers on screen at once. */
      let added = 0;
      let failed = 0;
      await mutate(async () => {
        if (!view.cart) await createCart();
        let last: ApiCartView | null = null;
        for (const item of known) {
          const next = await addLine(item.variantId, Math.trunc(item.qty));
          /* THE RESULT, NOT THE INTENTION. `addLine` answers null for any
             failure and `mutate` deliberately keeps the previous view on null,
             so a cart write that never landed used to leave the basket
             untouched, open the drawer on it, and still report success. */
          if (next) {
            added += Math.trunc(item.qty);
            last = next;
          } else {
            failed += 1;
          }
        }
        return last;
      });
      return { added, failed, skippedVariantIds };
    },
    [byVariant, open, mutate, view.cart],
  );

  const setQty = React.useCallback(
    (key: CartLineKey, qty: number) => {
      const lineId = lineIdFor(key);
      if (!lineId) return;
      /* Below one reads as "take it out" rather than an invalid state to
         refuse — the same rule the local cart followed. */
      if (qty < 1) {
        void mutate(() => removeLine(lineId));
        return;
      }
      void mutate(() => setLineQty(lineId, Math.trunc(qty)));
    },
    [lineIdFor, mutate],
  );

  const remove = React.useCallback(
    (key: CartLineKey) => {
      const lineId = lineIdFor(key);
      if (!lineId) return;
      void mutate(() => removeLine(lineId));
    },
    [lineIdFor, mutate],
  );

  /**
   * Emptying the basket is N deletes, in sequence.
   *
   * THERE IS NO BULK DELETE ON THE API, and doing them in parallel would race
   * the cart's own revision — each response is the whole new state, so the last
   * one to land wins and an out-of-order pair leaves the view describing a
   * basket that no longer exists.
   */
  const clear = React.useCallback(() => {
    const ids = view.lines.map((l) => l.id);
    void mutate(async () => {
      let last: ApiCartView | null = null;
      for (const id of ids) last = await removeLine(id);
      return last;
    });
  }, [view.lines, mutate]);

  /**
   * Server lines, joined against the catalogue for the words and the swatch.
   *
   * A LINE THE CATALOGUE NO LONGER EXPLAINS IS DROPPED. The server still holds
   * it — this does not delete anything — but the drawer cannot draw a row it
   * has no name or colour for, and inventing them would be worse than a shorter
   * basket. `changes` from the API is where a line the SERVER removed is
   * reported.
   */
  const resolved = React.useMemo<ResolvedLine[]>(() => {
    const out: ResolvedLine[] = [];
    for (const line of view.lines) {
      const match = byVariant.get(line.variantId);
      if (!match) continue;
      const colour = match.entry.colours.find((c) => c.id === match.colourId);
      const size = match.entry.sizes.find((s) => s.id === match.sizeId);
      if (!colour || !size) continue;
      /* THE SERVER'S PRICE, not `size.priceNaira`. The two agree today, and when
         they stop agreeing the server is the one that takes the money. */
      const unitPrice = majorUnits(line.unit);
      out.push({
        key: lineKey({ productSlug: match.entry.slug, colourId: colour.id, sizeId: size.id }),
        product: match.entry,
        colour,
        size,
        qty: line.qty,
        unitPrice,
        total: unitPrice * line.qty,
        /* No tier: the shop currently offers no bulk discounts (see
           `policy.ts`), and even if it did, that would be a storefront policy
           constant with nothing behind it in the API, so the cart could not
           claim one the till will not honour. */
        tier: null,
      });
    }
    return out;
  }, [view.lines, byVariant]);

  const lines = React.useMemo<CartLine[]>(
    () =>
      resolved.map((r) => ({
        productSlug: r.product.slug,
        colourId: r.colour.id,
        sizeId: r.size.id,
        qty: r.qty,
      })),
    [resolved],
  );

  const value = React.useMemo<CartApi>(() => {
    const itemCount = view.lines.reduce((sum, l) => sum + l.qty, 0);
    /* THE SERVER'S SUBTOTAL where there is one. Falling back to the sum of the
       resolved rows keeps the drawer honest if a preview is ever absent, and
       the two agree by construction because both use the server's unit price. */
    const subtotal = view.preview
      ? majorUnits(view.preview.subtotal)
      : resolved.reduce((sum, r) => sum + r.total, 0);
    /* List price minus what is actually charged. Zero today, because nothing
       discounts server-side — and it appears on its own the day something does,
       rather than needing this file to learn about it. */
    const list = resolved.reduce((sum, r) => sum + r.size.priceNaira * r.qty, 0);
    return {
      lines,
      resolved,
      itemCount,
      subtotal,
      savings: Math.max(0, list - subtotal),
      hydrated,
      pending,
      changes: view.changes,
      add,
      addVariants,
      setQty,
      remove,
      clear,
      isOpen,
      open,
      close,
    };
  }, [
    view.lines,
    view.preview,
    view.changes,
    resolved,
    lines,
    hydrated,
    pending,
    add,
    addVariants,
    setQty,
    remove,
    clear,
    isOpen,
    open,
    close,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
