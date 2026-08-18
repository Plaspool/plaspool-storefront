"use client";

import * as React from "react";

import { lineTotal, savingsFor, tierFor, unitPriceFor } from "../data/money";
import { lineKey, readCart, writeCart } from "./storage";
import type { CartApi, CartLine, CartLineKey, ResolvedLine } from "./types";
import type { BulkTier, Colour, SizeOption } from "../data/types";

/**
 * The cart's state and derivations, as a single provider.
 *
 * The hydration rule, which is the whole reason `hydrated` exists. The server
 * always renders an empty cart — it has no access to `localStorage`. If the
 * client's first render read storage instead, React would reconcile against a
 * tree that differs from the one the server sent, and throw a hydration error
 * on every page that shows a cart badge. So `lines` starts as `[]` on both
 * sides; a `useEffect` — client-only, and only running after the first commit
 * — loads the real cart and flips `hydrated`. Anything derived from the cart
 * (a nav badge, this drawer's own contents) must render nothing until
 * `hydrated` is true, or it flashes an empty cart before the real one lands.
 *
 * A second effect writes `lines` back to storage on every change, but only
 * once hydrated: without that guard, the initial empty `lines` would fire on
 * mount and overwrite a real stored cart with `[]` before the load effect
 * even has a chance to run.
 */

const CartContext = React.createContext<CartApi | null>(null);

function sameKey(a: CartLineKey, b: CartLineKey): boolean {
  return lineKey(a) === lineKey(b);
}

/**
 * THE CATALOGUE ARRIVES AS A PROP, AND THIS IS THE ONE PLACE THE LIVE-DATA
 * SWITCH ACTUALLY CHANGED A DESIGN RATHER THAN A CALL.
 *
 * `storage.ts` persists identifiers and a quantity, NEVER a price, and
 * `resolved` below joins those identifiers against the catalogue on every render
 * so pricing is always computed fresh. That rule is worth keeping — a price in
 * localStorage is a price that goes stale silently — but it means this component
 * needs the catalogue, and it is a client component that cannot `await` one.
 *
 * Three options, and only one of them is any good:
 *
 *   - **fetch it in the browser** — a round trip the server already made, and it
 *     would need CORS on `/api/shop/products`, which has no reason to allow it
 *   - **denormalise price into `CartLine`** — exactly the rule above, broken
 *   - **pass it down from the server** — what this does
 *
 * IT IS A PROJECTION, NOT THE WHOLE CATALOGUE. `CartCatalogEntry` is the four
 * fields the drawer and the arithmetic actually read; the full `Product` carries
 * a description document per product, and shipping all of that into the client
 * bundle of every shop page to price a cart nobody has opened would be paying
 * for the catalogue on each navigation.
 */
export interface CartCatalogEntry {
  slug: string;
  name: string;
  colours: Colour[];
  sizes: SizeOption[];
  bulkTiers: BulkTier[];
}

export interface CartProviderProps {
  children: React.ReactNode;
  catalog: CartCatalogEntry[];
}

export function CartProvider({ children, catalog }: CartProviderProps) {
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [hydrated, setHydrated] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    setLines(readCart());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    writeCart(lines);
  }, [lines, hydrated]);

  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => setIsOpen(false), []);

  const add = React.useCallback(
    (key: CartLineKey, qty: number = 1) => {
      const amount = Math.max(1, Math.trunc(qty));
      setLines((prev) => {
        const index = prev.findIndex((line) => sameKey(line, key));
        if (index === -1) return [...prev, { ...key, qty: amount }];
        const next = [...prev];
        next[index] = { ...next[index], qty: next[index].qty + amount };
        return next;
      });
      open();
    },
    [open],
  );

  const setQty = React.useCallback((key: CartLineKey, qty: number) => {
    setLines((prev) => {
      // A quantity below 1 reads as "take it out" rather than an invalid
      // state to reject — `QuantityStepper` never sends this in practice
      // (its own `min` keeps it at 1+), but a future caller might, and this
      // keeps `lines` free of the qty <= 0 entries `readCart` would strip on
      // the next reload anyway.
      if (qty < 1) return prev.filter((line) => !sameKey(line, key));
      const amount = Math.trunc(qty);
      return prev.map((line) => (sameKey(line, key) ? { ...line, qty: amount } : line));
    });
  }, []);

  const remove = React.useCallback((key: CartLineKey) => {
    setLines((prev) => prev.filter((line) => !sameKey(line, key)));
  }, []);

  const clear = React.useCallback(() => setLines([]), []);

  /* By slug, rebuilt only when the catalogue itself changes — `resolved` runs
     on every line edit and a linear scan per line would be quadratic in a big
     cart. */
  const bySlug = React.useMemo(
    () => new Map(catalog.map((entry) => [entry.slug, entry])),
    [catalog],
  );

  const resolved = React.useMemo<ResolvedLine[]>(() => {
    const out: ResolvedLine[] = [];
    for (const line of lines) {
      /* A line whose product has left the catalogue is DROPPED, not shown at a
         stale price — the behaviour `types.ts` already documented for a product
         pulled from sale, and now reachable for real rather than only imagined. */
      const product = bySlug.get(line.productSlug);
      if (!product) continue;
      const colour = product.colours.find((c) => c.id === line.colourId);
      if (!colour) continue;
      const size = product.sizes.find((s) => s.id === line.sizeId);
      if (!size) continue;
      out.push({
        key: lineKey(line),
        product,
        colour,
        size,
        qty: line.qty,
        unitPrice: unitPriceFor(size.priceNaira, product.bulkTiers, line.qty),
        total: lineTotal(size.priceNaira, product.bulkTiers, line.qty),
        tier: tierFor(product.bulkTiers, line.qty),
      });
    }
    return out;
  }, [lines, bySlug]);

  const itemCount = React.useMemo(
    () => resolved.reduce((sum, line) => sum + line.qty, 0),
    [resolved],
  );

  const subtotal = React.useMemo(
    () => resolved.reduce((sum, line) => sum + line.total, 0),
    [resolved],
  );

  const savings = React.useMemo(
    () =>
      resolved.reduce(
        (sum, line) => sum + savingsFor(line.size.priceNaira, line.product.bulkTiers, line.qty),
        0,
      ),
    [resolved],
  );

  const value = React.useMemo<CartApi>(
    () => ({
      lines,
      resolved,
      itemCount,
      subtotal,
      savings,
      hydrated,
      add,
      setQty,
      remove,
      clear,
      isOpen,
      open,
      close,
    }),
    [lines, resolved, itemCount, subtotal, savings, hydrated, add, setQty, remove, clear, isOpen, open, close],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = React.useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
