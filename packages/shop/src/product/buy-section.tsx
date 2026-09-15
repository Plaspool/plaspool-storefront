"use client";

import * as React from "react";
import { cn } from "@plaspool/ui";

import type { Product } from "../data/types";
import type { ReviewAggregate } from "../data/reviews";
import type { AddOnOffer } from "../data/cart-api";
import { firstInStockColour, cheapestSize } from "../data/money";
import { fetchProductAddOns } from "../data/add-ons-api";
import { setAddOnChoice } from "../data/checkout-api";
import { useCart } from "../cart/cart-context";
import { maxQtyFor, stockOf } from "../cart/stock";
import { boxSizeSellable, boxStock, isMysteryBox } from "../data/mystery-box";
import { useBoxAvailability } from "../components/use-box-availability";
import { Gallery } from "./gallery";
import { BuyBox } from "./buy-box";
import { AddOnOptOut } from "./add-on-opt-out";
import { StickyBuyBar } from "./sticky-buy-bar";

/** How long the stepper has to settle before the offers are re-asked. Press
 *  and hold on plus is one request per repeat without it, and the answer to
 *  every one but the last is thrown away. */
const QTY_SETTLE_MS = 250;

/**
 * The buy side of the product page, and the one owner of its selection state.
 *
 * Why one component and not three siblings: the gallery's tint, the buy box's
 * price and the sticky bar's price all read the same colour, size and
 * quantity. Three copies of that state is how a sticky bar ends up showing a
 * price the buy box has already moved on from — the classic PDP bug. Here
 * there is one copy and three readers of it.
 */

export interface ProductBuySectionProps {
  product: Product;
  /** Passed straight through to the buy box's stars — see `ProductPage`. */
  reviewAggregate: ReviewAggregate;
  /**
   * The add-ons this product would be offered AT QUANTITY ONE, read on the
   * server so the control is in the first paint rather than popping in after
   * hydration.
   *
   * `[]` is the ordinary answer and means "draw nothing". The list is re-asked
   * from the browser whenever the quantity moves — see the effect below for
   * why that is a re-fetch and not a multiplication.
   */
  initialAddOns?: AddOnOffer[];
  className?: string;
}

export function ProductBuySection({
  product,
  reviewAggregate,
  initialAddOns,
  className,
}: ProductBuySectionProps) {
  const [colourId, setColourId] = React.useState(() => firstInStockColour(product).id);
  const isBox = isMysteryBox(product);
  const [sizeId, setSizeId] = React.useState(() =>
    /* A box opens on a size that can be sold — one with a pool behind it —
       rather than the cheapest, which may be a size nobody has set up. */
    isBox
      ? (product.sizes.find((s) => boxSizeSellable(s, null)) ?? cheapestSize(product)).id
      : cheapestSize(product).id,
  );
  const [chosenQuantity, setQuantity] = React.useState(1);

  const colour = product.colours.find((c) => c.id === colourId) ?? product.colours[0];
  const size = product.sizes.find((s) => s.id === sizeId) ?? product.sizes[0];

  /* The box's live, fillable stock — see `useBoxAvailability`. */
  const availabilityFor = useBoxAvailability(product, colour.id);
  const boxChoices = isBox
    ? product.sizes.map((option) => ({
        size: option,
        sellable: boxSizeSellable(option, availabilityFor(option.id)),
      }))
    : undefined;
  const soldOut = boxChoices
    ? !(boxChoices.find((c) => c.size.id === size.id)?.sellable ?? false)
    : undefined;

  /**
   * ═══ STOCK IS A PROPERTY OF THE VARIANT, SO IT MOVES WHEN THE PICKER DOES ═══
   * `colour.inStock` is a boolean ROLLED UP ACROSS SIZES — a colour reads as in
   * stock if any one of its weights is — so it can say nothing about how many of
   * THIS weight in THIS colour there are. `variantStock` is keyed on the pair,
   * which is the only key that can answer.
   */
  const shelf = stockOf(product, colour.id, size.id);
  const maxQty = maxQtyFor(isBox ? boxStock(shelf, availabilityFor(size.id)) : shelf);
  const cart = useCart();

  /**
   * DERIVED, NOT AN EFFECT THAT WRITES BACK.
   *
   * The quantity outlives the picker: choose 9 of a colour with plenty, switch
   * to one with 2 left, and the state still says 9. Clamping in an effect would
   * render the wrong number for a frame and then correct it — and would fight
   * the shopper's own typing on the way back up. Deriving it means the control
   * is never able to show a quantity this variant cannot supply, and the raw
   * choice is remembered for when they switch back to something that has it.
   */
  const quantity = Math.min(chosenQuantity, maxQty);

  /* ═══════════════════════════════════════════════════════════════════════
     THE ADD-ON OPT-OUT — "send it without the box", before there is a cart.

     Three pieces of state, and each exists because the other two cannot answer
     for it:

       `offers`     what the API says this product would be offered, for the
                    quantity currently on screen. Server-rendered at 1, re-read
                    from the browser as the stepper moves.
       `leaveOut`   the shopper's intent, held locally because there may be no
                    cart to record it against yet. Ticking a box must not
                    create a basket.
       `intentId`   set at Add to cart, cleared once the choice is written. It
                    names the add-on rather than being a boolean, so a stale
                    intent cannot be applied to a different offer.
     ═══════════════════════════════════════════════════════════════════════ */
  const [offers, setOffers] = React.useState<AddOnOffer[]>(initialAddOns ?? []);
  /** The quantity `offers` describes, so the effect below can tell a real
   *  change from its own first run. */
  const [offersQty, setOffersQty] = React.useState(1);
  const [leaveOut, setLeaveOut] = React.useState(false);
  /**
   * A REF, NOT STATE, and that is a lint rule as much as a design choice.
   *
   * Nothing renders from it — it is a note this component leaves itself about
   * a write it owes the cart — and React 19's `react-hooks/set-state-in-effect`
   * rule (new in the plugin Next 16 ships) correctly refuses the version of
   * this that cleared a `useState` inside the effect below. The same rule
   * `add-to-cart.tsx` documents from the other side.
   */
  const intentRef = React.useRef<string | null>(null);

  const optOut = offers.find((offer) => offer.mode === "opt_out") ?? null;

  /**
   * RE-ASK, DO NOT MULTIPLY.
   *
   * `unitAmount` is per unit, so scaling the saving client-side is exact —
   * right up to the moment a rule's ceiling is crossed. Packaging is offered on
   * carts of one to four items, so at five the offer does not grow, it
   * DISAPPEARS. A client that multiplied would promise "save ₦2,500" for a
   * saving the cart will refuse, which is the one failure this control must not
   * have. Only the server knows where the ceilings are.
   *
   * Aborted on every change and guarded by `cancelled`: a shopper leaning on
   * the plus button issues one of these per repeat, and the answers can arrive
   * out of order. The LAST REQUEST must win, not the last response.
   */
  React.useEffect(() => {
    if (quantity === offersQty) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetchProductAddOns(product.slug, quantity, controller.signal).then((result) => {
        if (cancelled) return;
        /* A FAILED READ IS "NO OFFERS", never a retained stale one: the old
           list is priced for a quantity nobody is looking at any more, and a
           saving quoted against the wrong number is worse than no saving. */
        setOffers(result?.offers ?? []);
        setOffersQty(quantity);
      });
    }, QTY_SETTLE_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [product.slug, quantity, offersQty]);

  /**
   * WRITE THE INTENT ONCE THE CART CAN ACCEPT IT.
   *
   * `cart.add` is fire-and-forget, so "immediately after add to cart" is not a
   * moment this component can name. What it CAN do is watch the cart's own
   * offers, which every write answers with: when the add-on the shopper ticked
   * appears there unanswered, that is the first instant a `PUT` can succeed.
   *
   * ═══ THE OFFER MAY NEVER ARRIVE, AND THAT IS A NORMAL ENDING ═══
   * They had three other things in the basket, so it is now seven items and
   * past the rule's ceiling. The intent is dropped rather than retried, and
   * nothing is said: there is no saving to lose, because there was never one
   * to grant. The same silence `409 add_on_not_offered` gets — which is why
   * the write below does not branch on its result either. "Not offered right
   * now" is a true statement about a cart that has moved on, and
   * `cart.refresh()` is the whole of the correct response.
   *
   * NO `setState` ANYWHERE IN HERE. The intent lives in a ref and the only
   * state this can change is the cart's, through the provider.
   */
  React.useEffect(() => {
    const id = intentRef.current;
    if (!id || cart.pending) return;
    intentRef.current = null;
    const live = cart.addOns.find((offer) => offer.id === id);
    /* Gone from the real cart, or already recorded — either way there is
       nothing left to write. */
    if (!live || live.choice === "declined") return;
    /* No `baseRevision`: this cart's revision was never read here, and the
       write has nothing to race against — see `setAddOnChoice`. */
    void setAddOnChoice(live.id, "declined").then(() => cart.refresh());
  }, [cart]);

  /**
   * The tick, and where it goes.
   *
   * ═══ BEFORE THERE IS A CART IT IS AN INTENT; AFTER, IT IS A WRITE ═══
   * Ticking a box must not create a basket, so until the cart holds this offer
   * the answer is local state and nothing is sent. The moment the cart DOES
   * hold it — the shopper added, changed their mind, and unticked — the box
   * has to write through, or the screen would say "keep it" over a cart that
   * still says "declined". `accepted` is the un-tick, because for an
   * `opt_out` that is what "leave the box in" is called.
   */
  function chooseOptOut(next: boolean) {
    setLeaveOut(next);
    const live = optOut ? cart.addOns.find((offer) => offer.id === optOut.id) : null;
    if (!live) return;
    void setAddOnChoice(live.id, next ? "declined" : "accepted").then(() => cart.refresh());
  }

  /* The IntersectionObserver that used to gate the sticky bar is gone (#10):
     the bar is pinned for the whole scroll now, so there is nothing to
     observe and no reason for this component to hold a ref to the buy box. */

  return (
    <div className={cn("w-full min-w-0", className)}>
      {/* `lg:items-start` — without it the grid's default `stretch` hands the
          gallery column the buy box's full height, the gallery's stage grows
          to fill it, and the result is a tall bordered rectangle with the
          spool marooned at the top of it. The two columns are independent
          objects, not two halves of one panel (#21). */}
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
        {/* Sticky only where there is something to be sticky against: at `lg`
            the buy column runs roughly twice the square gallery's height, so
            without this the product image scrolls away while you are still
            choosing a size. `top-20` clears the shop nav (`h-16`) with a
            little air. Below `lg` the two are stacked and there is nothing to
            hold position beside. */}
        {/* The gallery no longer picks the colour — the buy box beside it does,
            and did all along. See `gallery.tsx` for why a second, unlabelled
            picker made of tinted drawings was the wrong left column. */}
        <Gallery
          name={product.name}
          colour={colour}
          weightGrams={size.weightGrams}
          productCoverUrl={product.coverImageUrl}
          productImageUrls={product.imageUrls}
          className="lg:sticky lg:top-20"
        />

        <div className="min-w-0">
          {/* `onAdded` FIRES ON DISPATCH, NOT COMPLETION — the effect above is
              what waits for the cart. Only Add to cart carries it: Buy Now
              navigates to the checkout in the same breath, where the extras
              step asks about any unanswered add-on anyway, so an intent that
              could not be recorded there costs a question rather than a silent
              charge. */}
          <BuyBox
            product={product}
            colour={colour}
            size={size}
            quantity={quantity}
            reviewAggregate={reviewAggregate}
            onColourChange={setColourId}
            onSizeChange={setSizeId}
            onQuantityChange={setQuantity}
            maxQty={maxQty}
            boxChoices={boxChoices}
            onAdded={() => {
              if (leaveOut && optOut) intentRef.current = optOut.id;
            }}
            addOnControl={
              optOut ? (
                <AddOnOptOut
                  offer={optOut}
                  checked={leaveOut}
                  onChange={chooseOptOut}
                  busy={cart.pending}
                />
              ) : null
            }
          />
        </div>
      </div>

      <StickyBuyBar
        product={product}
        colour={colour}
        size={size}
        quantity={quantity}
        onQuantityChange={setQuantity}
        maxQty={maxQty}
        soldOut={soldOut}
      />
    </div>
  );
}
