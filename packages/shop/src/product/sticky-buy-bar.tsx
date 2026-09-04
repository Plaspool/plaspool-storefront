"use client";

import { cn } from "@plaspool/ui";

import type { Colour, Product, SizeOption } from "../data/types";
import { unitPriceFor } from "../data/money";
import { Price } from "../components/price";
import { QuantityStepper } from "../components/quantity-stepper";
import { AddToCartButton } from "../cart/add-to-cart";
import type { CartLineKey } from "../cart/types";
import { BuyNowButton } from "./buy-box";

/**
 * The buy decision, reachable from anywhere on the page.
 *
 * PINNED FOR THE WHOLE SCROLL, not summoned past a threshold. It used to mount
 * only once the buy box had left the top of the viewport, which meant the
 * primary action was absent for the first screenful — including the moment a
 * visitor lands from a search result already knowing what they want. Issue #10
 * removed the trigger; there is no scroll listener and no IntersectionObserver
 * behind this component any more.
 *
 * The cost of that is duplication: while the buy box is on screen, its buttons
 * and this bar's buttons are the same two actions twice. That is the accepted
 * trade — a control that is always in the same place is worth more than the
 * tidiness of showing it once — but it is why the bar stays visually quiet:
 * one row, no heading, and a translucent ground so the page reads through it.
 *
 * `z-40` — under the cart drawer's `z-50`. The competitive analysis rejects
 * floating widgets that occlude the thing you came to buy, and that rule
 * applies to our own bar: the drawer this bar opens must cover it, never the
 * other way round.
 *
 * It reads the selection from `ProductBuySection` rather than holding a copy,
 * so the price here and the price in the buy box cannot drift apart.
 */

export interface StickyBuyBarProps {
  product: Product;
  colour: Colour;
  size: SizeOption;
  quantity: number;
  onQuantityChange: (n: number) => void;
  /**
   * The stepper's ceiling for the CHOSEN variant, decided by `ProductBuySection`.
   *
   * Passed in rather than derived here because the section owns the quantity
   * and already clamps it against this number — two readings of the rule is two
   * places for them to disagree, and the disagreement would be a stepper whose
   * `max` and whose value came from different variants.
   */
  maxQty: number;
  className?: string;
}

export function StickyBuyBar({
  product,
  colour,
  size,
  quantity,
  onQuantityChange,
  maxQty,
  className,
}: StickyBuyBarProps) {
  const unit = unitPriceFor(size.priceMinor, product.bulkTiers, quantity);
  const line: CartLineKey = {
    productSlug: product.slug,
    colourId: colour.id,
    sizeId: size.id,
  };

  return (
    <div
      /* ShopShell reserves the page's bottom padding off this attribute, so
         the footer is not left under the bar at full scroll. Renaming it
         without updating the `has-[[data-cta-bar]]` selector there silently
         un-reserves that space. */
      data-cta-bar=""
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t-2 border-foreground bg-background/95 backdrop-blur",
        /* iOS home-indicator inset. On every other device this resolves to
           0px, so it costs nothing to always apply. */
        "pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-3 sm:gap-3 sm:px-6 lg:px-8">
        {/* Below sm the name goes and the price and buttons stay: at 375px
            the decision has to fit, and the name is the part you already
            know. */}
        <div className="hidden min-w-0 flex-1 sm:block">
          <p className="truncate text-sm font-semibold text-foreground">
            {product.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{colour.name}</p>
        </div>

        {/*
          THE PRICE IS DELIBERATELY SMALLER THAN THE BUY BOX'S.

          At 320-390px the bar is a fixed-width budget shared between the price
          and two buttons, and the price was winning it — `text-base` on a
          string as long as `₦34,000` left the buttons squeezed to their label
          width. Stepping down to `text-sm` below `sm` hands that space back.

          It is a step down in size, not in prominence: still mono, still bold,
          still tabular, and the full figure — nothing is truncated or hidden,
          and the buy box above still shows it at `lg`.
        */}
        <Price
          amount={unit}
          currency={size.currency}
          size="md"
          className="shrink-0"
          amountClassName="text-sm sm:text-base"
        />

        <QuantityStepper
          value={quantity}
          onChange={onQuantityChange}
          max={maxQty}
          label={product.name}
          className="hidden shrink-0 sm:inline-flex"
        />

        {/*
          `flex-1` below sm so the two buttons split the reclaimed width and
          grow with the viewport; `shrink-0` from sm up, where the name block
          takes the slack instead and the buttons want their natural width.
        */}
        <div className="flex min-w-0 flex-1 gap-2 sm:ml-0 sm:flex-none sm:shrink-0">
          <AddToCartButton
            line={line}
            qty={quantity}
            disabled={!colour.inStock}
            /* "Add to cart" plus a cart glyph does not fit a third of a 320px
               viewport. The bar uses the short label at every width rather
               than swapping at a breakpoint — the compact form is correct
               here, and the buy box above still carries the full wording, so
               nothing is only ever abbreviated. `srLabel` and `addedLabel`
               keep the accessible name and the announcement whole. */
            label="Add"
            srLabel="Add to cart"
            addedLabel="Added"
            className="min-w-0 flex-1 px-3 sm:flex-none sm:px-5"
          />
          <BuyNowButton
            line={line}
            qty={quantity}
            disabled={!colour.inStock}
            className="min-w-0 flex-1 px-3 sm:flex-none sm:px-5"
          />
        </div>
      </div>
    </div>
  );
}
