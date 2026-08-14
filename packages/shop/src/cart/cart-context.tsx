"use client";

import * as React from "react";

import { getProduct } from "../data/catalog";
import { lineTotal, savingsFor, tierFor, unitPriceFor } from "../data/money";
import { lineKey, readCart, writeCart } from "./storage";
import type { CartApi, CartLine, CartLineKey, ResolvedLine } from "./types";

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

export function CartProvider({ children }: { children: React.ReactNode }) {
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

  const resolved = React.useMemo<ResolvedLine[]>(() => {
    const out: ResolvedLine[] = [];
    for (const line of lines) {
      const product = getProduct(line.productSlug);
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
  }, [lines]);

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
