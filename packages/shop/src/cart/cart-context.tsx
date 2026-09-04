"use client";

import * as React from "react";

import { isSwitchable, type CurrencyCode, type CurrencyConfig } from "../data/currency-config";
import { resolveCurrency, storedCurrency } from "../data/currency-preference";
import {
  addLine,
  bulkOf,
  createCart,
  majorUnits,
  previewLines,
  readCart,
  removeLine,
  setLineQty,
} from "../data/cart-api";
import { lineKey } from "./line-key";
import { EMPTY_VIEW as EMPTY, outcomeOfRead } from "./read-outcome";
import { partitionLines } from "./sellable";
import { maxQtyForLine, stockOf } from "./stock";
import type { VariantMatch } from "./sellable";
import type { ApiCartView, CartResult } from "../data/cart-api";
import type { CartApi, CartLine, CartLineKey, ResolvedLine } from "./types";
import type { BulkTier, Colour, SizeOption, VariantStock } from "../data/types";

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
  /**
   * `"<colourId>:<sizeId>"` → the shelf, keyed identically to `variantIds`.
   *
   * READ FOR `backorderable` AND NOTHING ELSE on a cart row. The count here
   * came from an ISR-cached catalogue response and can be an hour old; the
   * line's own `inStock` is re-quoted on every cart read. `maxQtyForLine` in
   * `stock.ts` is where the two are combined, and its header says why.
   */
  variantStock: Record<string, VariantStock>;
  /** The product's own photograph, for a basket row whose colour has none. */
  coverImageUrl: string | null;
}

export interface CartProviderProps {
  children: React.ReactNode;
  catalog: CartCatalogEntry[];
  /**
   * What the shop may charge in, from `ShopShell`.
   *
   * ═══ THE PROVIDER NEEDS IT BECAUSE IT IS WHAT MINTS THE CART ═══
   * `POST /cart` writes the currency at CREATION and nothing updates it
   * afterwards — order totals freeze against it. The cart is minted lazily on
   * the first add, so this is the only moment the choice can be applied, and a
   * provider that did not know it would silently create every basket in the
   * shop's default no matter what the shopper had selected.
   *
   * OPTIONAL, so the package dev harnesses and any caller predating this can
   * mount the provider unchanged; an absent config means `createCart` sends no
   * currency and the server decides, which is exactly today's behaviour.
   */
  currencyConfig?: CurrencyConfig;
}

export function CartProvider({ children, catalog, currencyConfig }: CartProviderProps) {
  const [view, setView] = React.useState<ApiCartView>(EMPTY);
  const [hydrated, setHydrated] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  /** A write is in flight. The drawer disables its steppers rather than letting
   *  two edits race and land in the order the network chose. */
  const [pending, setPending] = React.useState(false);
  /**
   * WHICH ROW is being written, as its `ResolvedLine.key`, or null.
   *
   * `pending` alone says only that SOME write is in flight, which is enough to
   * stop two edits racing and not enough to tell a shopper anything: pressing
   * plus on one row would have to blank every row's figure, or none of them.
   * Keyed on the triple rather than the server line id because that is what
   * `resolved` rows carry and what the drawer already renders against — see
   * `ResolvedLine.key`.
   */
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);

  /**
   * The currency any cart minted here is created in.
   *
   * READ FRESH AT EACH CREATE, not captured once: a shopper can switch in the
   * header and then add an item without the provider remounting. `undefined`
   * when there is no config or only one currency — `createCart` then sends no
   * body at all and the server's default decides, which is the behaviour this
   * provider had before currencies existed.
   *
   * NEVER `replace`. Emptying a basket to change its currency is a question,
   * and it is asked by `CurrencySwitcher` — the only place that may answer it.
   * A create from here that hits `currency_locked` simply leaves the existing
   * cart alone, which is correct: the shopper is adding an item, not
   * relitigating the currency.
   */
  const cartCurrency = React.useCallback((): CurrencyCode | undefined => {
    if (!currencyConfig || !isSwitchable(currencyConfig)) return undefined;
    return resolveCurrency(storedCurrency(), currencyConfig);
  }, [currencyConfig]);

  /** What the last write ran into, in the shopper's words. Null when the cart
   *  and the server agree. */
  const [problem, setProblem] = React.useState<string | null>(null);

  /**
   * Which read is the current one.
   *
   * Overlapping reads must land in the order they were ISSUED, not the order
   * the network chose to answer them. The case that matters is `/checkout/
   * complete`: the mount read fires the instant the page loads, while the
   * basket is still open, and the confirmation's read fires a second or two
   * later once the payment is known captured. A slow first read landing last
   * would put the spent basket straight back on screen — the very bug this
   * refresh exists to fix, reappearing intermittently.
   *
   * `mutate` bumps this too: a write's response IS the new cart, so it
   * supersedes any read still in the air.
   */
  const readSeq = React.useRef(0);

  /**
   * READ THE CART AND APPLY IT. The one path from the server to the view.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * THIS USED TO BE A MOUNT EFFECT AND NOTHING ELSE, WHICH IS THE WHOLE BUG.
   *
   * One read, on mount, for the life of the page — and `CartProvider` sits in
   * `ShopShell`, above every `(shop)` route, so it does not remount on a
   * client-side navigation either. Nothing anywhere could ask the cart again.
   *
   * That is survivable while the only thing that changes the basket is this
   * tab, because every mutation already answers with the new state. It stops
   * being survivable when the basket is retired by something OFF-SCREEN — and
   * paying for it is exactly that: the commerce API converts the cart to an
   * order on its side, and this tab is never told. The badge went on
   * advertising a basket the shopper had already bought until they reloaded
   * the page by hand, which is precisely what was reported.
   *
   * So the read is a function now, and the two moments the view can no longer
   * be trusted both call it — see the effects below and `refresh` on the
   * context. `outcomeOfRead` owns what each answer means, so mount and refresh
   * cannot drift apart.
   * ═══════════════════════════════════════════════════════════════════════════
   */
  const load = React.useCallback((): Promise<void> => {
    const seq = ++readSeq.current;
    /* `.then` rather than `await`: the state updates have to sit behind a
       callback the effect below does not run synchronously, or
       `react-hooks/set-state-in-effect` reads this as a cascading render. Same
       shape the mount read had before it became a function. */
    return readCart().then((result) => {
      /* HYDRATED EITHER WAY, and BEFORE the guard below. All this flag claims
         is that the client has heard from the server, which is now true no
         matter whose answer wins — and every cart surface renders nothing
         until it flips. Leaving it unset when a write superseded this read
         would blank the badge, the drawer and `/cart` for the rest of the
         page's life. */
      setHydrated(true);
      if (seq !== readSeq.current) return;
      const outcome = outcomeOfRead(result);
      /* NULL MEANS KEEP. A read that failed is not an empty cart — see
         `read-outcome.ts` for why that distinction is the load-bearing one. */
      if (outcome.view) setView(outcome.view);
      setProblem(outcome.problem);
    });
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  /**
   * A BFCACHE RESTORE IS A PAGE WHOSE CART IS AS OLD AS THE FREEZE.
   *
   * The other way back from Paystack is the Back button, and a restored page
   * comes back with its whole JS heap intact: this provider's `view` still
   * holds the basket as it was before the payment, and no effect re-runs to
   * correct it. Same stale badge, different route to it — and `checkout-flow`
   * already carries a `pageshow` listener for its own half of this exact trip,
   * which is the evidence that shoppers do come back this way.
   *
   * `event.persisted` is what separates a real restore from an ordinary load;
   * without it this would double every first read.
   */
  React.useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) void load();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [load]);

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
  const mutate = React.useCallback(async (
    run: () => Promise<CartResult>,
    /** The row this write belongs to, for per-row feedback. Absent for writes
     *  that are not about one row — creating the cart, emptying it. */
    key?: string,
  ) => {
    /* A WRITE SUPERSEDES ANY READ STILL IN THE AIR. Every mutation answers with
       the whole new cart, so a `load` issued before this one started is stale
       the moment this runs — and letting it land afterwards would undo the
       edit on screen. Same rule as `readSeq` itself: issue order wins. */
    readSeq.current += 1;
    setPending(true);
    setPendingKey(key ?? null);
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
      setPendingKey(null);
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
        if (!view.cart) await createCart(cartCurrency());
        const added = await addLine(variantId, amount);
        /* ONE RETRY, AND ONLY FOR `gone`. The API retires the cookie naming a
           cart that has become an order, so the first add after a checkout finds
           no cart — and the honest response to "your old basket is finished" is
           a new basket with the thing they just asked for in it, not an error
           about a cart they were not thinking about. `createCart` mints one
           because the cookie is already cleared, so this cannot loop. */
        if (!added.ok && added.reason === "gone") {
          const created = await createCart(cartCurrency());
          if (created.ok) return addLine(variantId, amount);
        }
        return added;
      });
    },
    [variantFor, open, mutate, view.cart, cartCurrency],
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
        if (!view.cart) await createCart(cartCurrency());
        let last: CartResult = { ok: false, reason: "gone" };
        for (const item of known) {
          let next = await addLine(item.variantId, Math.trunc(item.qty));
          /* The same one-retry rule `add` follows: reordering is the commonest
             thing to do right after checking out, which is exactly when the
             previous cart has just been retired. */
          if (!next.ok && next.reason === "gone") {
            const created = await createCart(cartCurrency());
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
    [byVariant, open, mutate, view.cart, cartCurrency],
  );

  const setQty = React.useCallback(
    (key: CartLineKey, qty: number) => {
      const lineId = lineIdFor(key);
      if (!lineId) return;
      /* Below one reads as "take it out" rather than an invalid state to
         refuse — the same rule the local cart followed. */
      if (qty < 1) {
        void mutate(() => removeLine(lineId), lineKey(key));
        return;
      }
      /* ═══ THE CEILING IS ENFORCED HERE TOO, NOT ONLY IN THE STEPPER ═══
         A `max` on the control is a courtesy to the shopper; this is the rule.
         `setQty` is the whole cart's write path and it is reachable without
         touching a stepper at all — the drawer and `/cart` both call it
         directly, and a row whose stock fell while the basket sat open is
         holding a value no control clamped when it was rendered. Sending the
         over-quantity anyway is how the shopper gets all the way to the freeze
         and is refused there, which is the bug this change exists to end. */
      const line = view.lines.find((l) => l.id === lineId);
      const entry = bySlug.get(key.productSlug);
      /* Rebuilt from `view.lines` and `bySlug` rather than read off `resolved`,
         which is declared BELOW this callback — and deliberately not hoisted or
         stuffed into a ref to get at it. Both halves of the rule are already in
         scope here, and it is the same pair `resolved` itself feeds to
         `maxQtyForLine`. */
      const cap = maxQtyForLine(
        line?.inStock ?? null,
        entry ? stockOf(entry, key.colourId, key.sizeId) : null,
      );
      void mutate(() => setLineQty(lineId, Math.min(Math.trunc(qty), cap)), lineKey(key));
    },
    [lineIdFor, mutate, view.lines, bySlug],
  );

  const remove = React.useCallback(
    (key: CartLineKey) => {
      const lineId = lineIdFor(key);
      if (!lineId) return;
      void mutate(() => removeLine(lineId), lineKey(key));
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

  const resolved = React.useMemo<ResolvedLine[]>(() => {
    /* THE PREVIEW IS WHERE THE DISCOUNT LIVES. `cart.lines[]` carries `unit`,
       which is the LIST price and says nothing about a rung; the per-line
       totals — `effectiveUnit`, `bulkPercentBps`, `bulkQty`, `lineTotal` —
       are on `preview.lines[]`. Empty until the admin's bulk deploy lands, and
       `bulkOf` supplies the pre-bulk defaults for every line until then. */
    const totals = previewLines(view.preview);

    /* A MAP, NOT A FILTER. Every reason to leave a line out has already been
       applied in `partitionLines`; a second `continue` here is how the two
       projections drifted apart the first time. */
    return split.sellable.map(({ line, entry, colour, size }) => {
        /* THE SERVER'S PRICE, not `size.priceMinor`. The two agree today, and
           when they stop agreeing the server is the one that takes the money. */
        const unitPrice = majorUnits(line.unit);
        const frozen = totals.get(line.variantId);
        /* NO PREVIEW LINE IS THE PRE-BULK WORLD, spelled out rather than faked
           through `bulkOf` with a stand-in line: the defaults are the same ones
           an old order falls back to — no rung, and the list price is what they
           pay. */
        const bulk = frozen
          ? bulkOf(frozen)
          : { qty: line.qty, percentBps: 0, effectiveUnit: line.unit, discounted: false };
        const effectiveUnitPrice = majorUnits(bulk.effectiveUnit);
        return {
          key: lineKey({ productSlug: entry.slug, colourId: colour.id, sizeId: size.id }),
          product: entry,
          colour,
          size,
          qty: line.qty,
          unitPrice,
          effectiveUnitPrice,
          bulkPercentBps: bulk.percentBps,
          bulkQty: bulk.qty,
          /* THE SERVER'S LINE TOTAL where there is one. `effectiveUnit × qty`
             is the fallback rather than the rule, and `unitPrice × qty` is
             never either — that is the number the customer is not charged. */
          total: frozen ? majorUnits(frozen.lineTotal) : effectiveUnitPrice * line.qty,
          /* No tier: the shop currently offers no bulk discounts (see
             `policy.ts`), and even if it did, that would be a storefront policy
             constant with nothing behind it in the API, so the cart could not
             claim one the till will not honour. */
          tier: null,
          /* THE LINE'S COUNT, THE CATALOGUE'S FLAG. `line.inStock` is re-quoted
             on every cart read; `entry.variantStock` rode in on a catalogue
             response that may be an hour old. Feeding the stale number here
             would cap a shopper against stock that has since been restocked. */
          maxQty: maxQtyForLine(line.inStock, stockOf(entry, colour.id, size.id)),
        };
      });
  }, [split, view.preview]);

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
    /* ═══ DIVIDED, BECAUSE `subtotal` ABOVE IS WHOLE UNITS ═══
       `size.priceMinor` is minor units now (it was `priceNaira`, whole units,
       when this line was written). `subtotal` comes through `majorUnits()`.
       Subtracting one from the other without this division is a 100x error
       that renders as a perfectly plausible saving — the confusion
       `money-units.test.ts` exists to pin. Rounded per unit before
       multiplying, exactly as `priceNaira` did, so the figure does not move.

       THIS PROVIDER IS STILL NAIRA-SHAPED, knowingly: it works in whole units
       via `majorUnits()`, which rounds cents away. Correct while a cart can
       only be NGN, and the first thing to migrate when it cannot — the cart's
       own currency is already on `view.cart.currency`. */
    const list = resolved.reduce(
      (sum, r) => sum + Math.round(r.size.priceMinor / 100) * r.qty,
      0,
    );
    return {
      lines,
      resolved,
      unsellable: split.unsellable,
      itemCount,
      subtotal,
      savings: Math.max(0, list - subtotal),
      hydrated,
      pending,
      pendingKey,
      changes: view.changes,
      problem,
      add,
      addVariants,
      setQty,
      remove,
      removeLineId,
      clear,
      refresh: load,
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
    pendingKey,
    add,
    addVariants,
    setQty,
    remove,
    removeLineId,
    clear,
    load,
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
