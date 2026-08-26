"use client";

import * as React from "react";

import { addLine, createCart, majorUnits, readCart, removeLine, setLineQty } from "../data/cart-api";
import { lineKey } from "./line-key";
import { partitionLines } from "./sellable";
import type { VariantMatch } from "./sellable";
import type { ApiCartView, CartResult } from "../data/cart-api";
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
  /** The product's own photograph, for a basket row whose colour has none. */
  coverImageUrl: string | null;
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

  /** What the last write ran into, in the shopper's words. Null when the cart
   *  and the server agree. */
  const [problem, setProblem] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void readCart().then((result) => {
      if (cancelled) return;
      if (result.ok) setView(result.view);
      /* A READ THAT FAILED IS NOT AN EMPTY CART. With nothing set here the
         drawer falls through to "Your cart is empty", which is an assertion
         this client is in no position to make when it never heard back — the
         same class of lie as the dead basket, told the other way round.
         `gone` is exempt: there genuinely is no cart, and a shopper who has
         just checked out does not need that in red. */
      if (!result.ok && result.reason !== "gone") {
        setProblem("We couldn't load your cart. Refresh to try again.");
      }
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
    const out = new Map<string, VariantMatch>();
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
   * Every mutation goes through here, and what it does depends on WHICH failure.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * THIS USED TO TREAT EVERY FAILURE AS A TIMEOUT.
   *
   * The rule was "a null answer leaves the previous view alone", and the
   * reasoning was sound as far as it went: replacing a real basket with an empty
   * one because a request timed out looks exactly like a customer's cart being
   * thrown away. But `cart-api.ts` answered null for a refusal too, so a server
   * that said "that cart became an order" was handled as though it had said
   * nothing at all — the drawer kept the dead basket and the Remove button did
   * nothing, with no error, indefinitely. That is the storefront half of
   * `Plaspool/plaspool-admin#38`.
   *
   *   `offline` — KEEP THE VIEW. Nothing was reached, so what is on screen is
   *               still the last thing the server said. This is the case the
   *               original rule was written for, and it is unchanged.
   *   `gone`    — CLEAR THE VIEW. There is no cart. Continuing to draw one is
   *               the failure, not the fix.
   *   `refused` — RESYNC. The server rejected this against a state we evidently
   *               do not have, so the answer is to go and get the real one
   *               rather than to guess. A stale revision resolves itself this
   *               way; anything else at least stops the UI from lying.
   * ═══════════════════════════════════════════════════════════════════════════
   */
  const mutate = React.useCallback(async (run: () => Promise<CartResult>) => {
    setPending(true);
    setProblem(null);
    try {
      const result = await run();
      if (result.ok) {
        setView(result.view);
        return result;
      }

      if (result.reason === "offline") {
        setProblem("We couldn't reach your cart. Check your connection and try again.");
        return result;
      }

      if (result.reason === "gone") {
        setView(EMPTY);
        setProblem("That basket is no longer open — it was checked out or it expired.");
        return result;
      }

      /* REFUSED. Re-read rather than reason about it: the server is the only
         thing that knows what the cart actually is now, and every branch of
         this ends in wanting that answer. */
      const fresh = await readCart();
      setView(fresh.ok ? fresh.view : EMPTY);
      setProblem(
        fresh.ok && fresh.view.cart
          ? "That change didn't go through — your cart is up to date now, try again."
          : "That basket is no longer open — it was checked out or it expired.",
      );
      return result;
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
        const added = await addLine(variantId, amount);
        /* ONE RETRY, AND ONLY FOR `gone`. The API retires the cookie naming a
           cart that has become an order, so the first add after a checkout finds
           no cart — and the honest response to "your old basket is finished" is
           a new basket with the thing they just asked for in it, not an error
           about a cart they were not thinking about. `createCart` mints one
           because the cookie is already cleared, so this cannot loop. */
        if (!added.ok && added.reason === "gone") {
          const created = await createCart();
          if (created.ok) return addLine(variantId, amount);
        }
        return added;
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
        let last: CartResult = { ok: false, reason: "gone" };
        for (const item of known) {
          let next = await addLine(item.variantId, Math.trunc(item.qty));
          /* The same one-retry rule `add` follows: reordering is the commonest
             thing to do right after checking out, which is exactly when the
             previous cart has just been retired. */
          if (!next.ok && next.reason === "gone") {
            const created = await createCart();
            if (created.ok) next = await addLine(item.variantId, Math.trunc(item.qty));
          }
          /* THE RESULT, NOT THE INTENTION. A cart write that never landed used
             to leave the basket untouched, open the drawer on it, and still
             report success. */
          if (next.ok) {
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
   * Remove by SERVER LINE ID, which is the only handle an unsellable row has.
   *
   * `remove(key)` goes through `lineIdFor`, which resolves the triple to a
   * variant through the catalogue — so for a line whose variant the catalogue
   * has lost it returns null and does nothing at all. That silent no-op was the
   * whole of the stuck basket: the one line that had to go was the one line no
   * control could name.
   */
  const removeLineId = React.useCallback(
    (lineId: string) => {
      void mutate(() => removeLine(lineId));
    },
    [mutate],
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
      let last: CartResult = { ok: false, reason: "gone" };
      for (const id of ids) last = await removeLine(id);
      return last;
    });
  }, [view.lines, mutate]);

  /**
   * THE ONE PLACE A LINE IS JUDGED BUYABLE OR NOT.
   *
   * This used to be two decisions in two places: `resolved` dropped whatever
   * the catalogue could not explain, and `itemCount` counted the raw server
   * lines regardless. They disagreed the moment a variant left the catalogue —
   * badge 1, drawer empty, nothing on screen able to remove the line. See
   * `sellable.ts` for the whole account.
   *
   * A LINE THE CATALOGUE NO LONGER EXPLAINS IS NOT DROPPED ANY MORE. The server
   * still holds it and the drawer still cannot draw a row it has no name or
   * colour for — but it can say so and offer to take it out, which is the part
   * that was missing. `changes` from the API remains where a line the SERVER
   * removed is reported.
   */
  const split = React.useMemo(
    () => partitionLines(view.lines, byVariant),
    [view.lines, byVariant],
  );

  const resolved = React.useMemo<ResolvedLine[]>(
    () =>
      /* A MAP, NOT A FILTER. Every reason to leave a line out has already been
         applied in `partitionLines`; a second `continue` here is how the two
         projections drifted apart the first time. */
      split.sellable.map(({ line, entry, colour, size }) => {
        /* THE SERVER'S PRICE, not `size.priceNaira`. The two agree today, and
           when they stop agreeing the server is the one that takes the money. */
        const unitPrice = majorUnits(line.unit);
        return {
          key: lineKey({ productSlug: entry.slug, colourId: colour.id, sizeId: size.id }),
          product: entry,
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
        };
      }),
    [split],
  );

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
    /* SELLABLE UNITS ONLY. The badge is a promise that there are things in the
       basket worth opening it for; counting a line nothing can draw, price or
       remove makes it a promise the drawer immediately breaks. */
    const itemCount = split.itemCount;
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
      unsellable: split.unsellable,
      itemCount,
      subtotal,
      savings: Math.max(0, list - subtotal),
      hydrated,
      pending,
      changes: view.changes,
      problem,
      add,
      addVariants,
      setQty,
      remove,
      removeLineId,
      clear,
      isOpen,
      open,
      close,
    };
  }, [
    split,
    view.preview,
    view.changes,
    problem,
    resolved,
    lines,
    hydrated,
    pending,
    add,
    addVariants,
    setQty,
    remove,
    removeLineId,
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
