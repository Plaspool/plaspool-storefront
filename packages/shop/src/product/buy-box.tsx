"use client";

import * as React from "react";
import { Check, Truck } from "lucide-react";
import { Button, cn } from "@plaspool/ui";

import type { Colour, Product, SizeOption } from "../data/types";
import { tierFor } from "../data/bulk";
import { availableColours, unitPriceFor } from "../data/money";
import { DELIVERY } from "../data/config";
import { starsFromAggregate } from "../data/reviews";
import type { ReviewAggregate } from "../data/reviews";
import { Price } from "../components/price";
import { ColourSwatches } from "../components/colour-swatches";
import { RatingStars } from "../components/rating-stars";
import { QuantityStepper } from "../components/quantity-stepper";
import { BulkTierTable } from "../components/bulk-tier-table";
import { NextTierHint } from "./next-tier-hint";
import { AddToCartButton } from "../cart/add-to-cart";
import type { CartLineKey } from "../cart/types";
import { useCart } from "../cart/cart-context";

/**
 * Everything you need to decide with, in the order the spec fixes: name,
 * rating, price, colour, size, quantity, tiers, features, delivery, actions.
 *
 * The headline price is the LIVE one; the bulk rung is stated beside it rather
 * than replacing it — see the note on `rung` below for what that fixes. That
 * is what makes the tier ladder underneath real rather than decorative.
 *
 * All state is owned by `ProductBuySection` above, because the sticky bar
 * shows the same figures and a second copy of this state is exactly how a bar
 * ends up quoting a price the buy box no longer shows.
 */

/**
 * "Buy Now" adds the line and opens the drawer, same as before — checkout
 * exists now, but the drawer's own "Checkout" button is the way in, and this
 * button's job stops at getting the item into the cart. Making "Buy Now"
 * itself jump straight to `/checkout` would skip the one place a customer
 * sees the drawer confirm what was actually added, and would special-case
 * this button against every other add-to-cart control in the store for a
 * step that is one click away either way.
 */
export function BuyNowButton({
  line,
  qty,
  disabled = false,
  className,
}: {
  line: CartLineKey;
  qty: number;
  disabled?: boolean;
  className?: string;
}) {
  const cart = useCart();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      aria-label={disabled ? "Buy Now — out of stock" : undefined}
      /* ═══ SURFACE PIN — EXCUSED FROM THE FLAG, ON PURPOSE ═══════════════
         Owner decision: "for now leave the add to cart and buy now buttons
         they are okay". Delete this one prop and the button rejoins
         `DEFAULT_BUTTON_SURFACE`. Matched to `AddToCartButton`, which carries
         the same pin — the pair reads as one control and must stay that way. */
      surface="neo"
      onClick={() => {
        cart.add(line, qty);
        cart.open();
      }}
      className={cn(
        // Matched to AddToCartButton so the pair reads as one control: same
        // height, same label size, same stroke and press. The fill stays
        // white — it is the secondary of the two, and #10 kept its colour.
        // `variant="outline"` resolves to the `default` tone, whose `neo` row
        // IS that white fill and 2px foreground stroke, so nothing is written
        // out here any more.
        "h-12 px-5 text-base",
        className,
      )}
    >
      Buy Now
    </Button>
  );
}

export interface BuyBoxProps {
  product: Product;
  colour: Colour;
  size: SizeOption;
  quantity: number;
  /** Approved-review summary from the API; draws the stars under the name. */
  reviewAggregate: ReviewAggregate;
  onColourChange: (id: string) => void;
  onSizeChange: (id: string) => void;
  onQuantityChange: (n: number) => void;
  className?: string;
}

export function BuyBox({
  product,
  colour,
  size,
  quantity,
  reviewAggregate,
  onColourChange,
  onSizeChange,
  onQuantityChange,
  className,
}: BuyBoxProps) {
  /* Real reviews only. This read the invented fixtures behind a feature flag
     until there was an API to ask; a product nobody has reviewed now shows no
     stars rather than a manufactured score. */
  const showRating = reviewAggregate.count > 0;

  /* ═══ THE HEADLINE PRICE IS THE LIVE ONE, AND NO LONGER MOVES WITH THE
     STEPPER — this reverses what this file's header used to say. ═══
     It read `unitPriceFor(..., quantity)` and was handed to `Price` as
     `amount`, with the list price as `compareAt`. That struck ₦24,000 against
     a five-up price of ₦18,000 and read as a 25% sale when the sale was 17%
     and the rest was earned by quantity — two discounts with different causes
     collapsed into one strike-through. The rung is stated separately now, with
     the quantity that earns it, so raising the stepper still changes what the
     block says; it changes the honest half. */
  const rung = tierFor(product.bulkTiers, quantity);
  const unit = unitPriceFor(size.priceNaira, product.bulkTiers, quantity);
  const line: CartLineKey = {
    productSlug: product.slug,
    colourId: colour.id,
    sizeId: size.id,
  };
  const outOfStock = !colour.inStock;

  /* A single-size product still renders the control, disabled: an absent
     control reads as an unanswered question about what you are buying. */
  const singleSize = product.sizes.length === 1;

  /* A PRODUCT WHOSE CATALOGUE RECORDS NO WEIGHT HAS NOTHING TO PUT HERE.
     `sizeLabelOf` leaves the label empty when neither the weight axis nor
     `weightGrams` says anything, and one blank button under a "Size" heading
     asks a question with no answer. The price above already states what is
     being bought, and the variant is still the one Add to cart adds. */
  const showSizes = product.sizes.some((option) => option.label !== "");

  const sizeLabelId = React.useId();

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-5", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {product.name}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{product.overview}</p>
      </div>

      {showRating && (
        <RatingStars
          rating={starsFromAggregate(reviewAggregate)}
          count={reviewAggregate.count}
          size="md"
        />
      )}

      <Price
        amount={size.priceNaira}
        compareAt={size.compareAtNaira}
        bulkAmount={unit}
        bulkQty={rung?.minQty ?? null}
        size="lg"
      />

      <div>
        <p className="text-sm font-semibold text-foreground">Colour</p>
        <ColourSwatches
          /* Only colours somebody can order — the card's row and this picker
             have to agree, or a colour vanishes between the grid and the buy
             box. See `availableColours`. */
          colours={availableColours(product)}
          selectedId={colour.id}
          onSelect={onColourChange}
          className="mt-2"
        />
        {/* A swatch grid with no name is unusable for anyone who cannot tell
            the hues apart. */}
        <p className="mt-1.5 text-sm text-muted-foreground">{colour.name}</p>
      </div>

      {showSizes && (
        <div>
          <p id={sizeLabelId} className="text-sm font-semibold text-foreground">
            Size
          </p>
          <div role="group" aria-labelledby={sizeLabelId} className="mt-2 flex flex-wrap gap-2">
            {product.sizes.map((option) => {
              const active = option.id === size.id;
              /* THE GRAM FIGURE IS A SECOND READING, NOT A REPEAT.
                 `1kg` beside `1000 g` is worth showing: one is what the seller
                 typed, the other is what it weighs, and the pair answers
                 "how much is a kilo, exactly". `100 g` beside `100 g` is just
                 the same words twice — which is what happens whenever
                 `sizeLabelOf` DERIVED the label from `weightGrams` because no
                 weight axis was set. Whitespace and case are ignored so `100g`
                 counts as the same reading as `100 g`. */
              const grams = `${option.weightGrams} g`;
              const fold = (v: string) => v.replace(/\s+/g, "").toLowerCase();
              const showGrams = option.weightGrams > 0 && fold(option.label) !== fold(grams);
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  disabled={singleSize}
                  onClick={() => onSizeChange(option.id)}
                  className={cn(
                    "inline-flex items-baseline gap-2 rounded-lg border px-3 py-2 transition-colors motion-reduce:transition-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "disabled:cursor-default",
                    active
                      ? "border-brand bg-brand-soft text-foreground"
                      : "border-brand-line text-muted-foreground hover:border-foreground hover:text-foreground",
                  )}
                >
                  <span className="text-sm">{option.label}</span>
                  {showGrams && (
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {grams}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-foreground">Quantity</p>
        <QuantityStepper
          value={quantity}
          onChange={onQuantityChange}
          label={product.name}
          className="mt-2"
        />
        {/* Computed from `bulkTiers` alone — no request per key press. Renders
            nothing without a ladder or on the top rung. */}
        <NextTierHint tiers={product.bulkTiers} quantity={quantity} className="mt-2" />
      </div>

      <BulkTierTable
        tiers={product.bulkTiers}
        basePrice={size.priceNaira}
        quantity={quantity}
      />

      <ul className="flex flex-col gap-2 border-t border-brand-line pt-5">
        {product.features.map((feature) => (
          <li key={feature} className="flex gap-2 text-sm leading-6 text-muted-foreground">
            <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-brand" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* Delivery certainty is a live objection in this market, not a
          footnote at the bottom of the page. */}
      <div className="flex gap-2 border-t border-brand-line pt-5">
        <Truck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <ul className="flex flex-col gap-1 text-sm leading-6 text-muted-foreground">
          <li>{DELIVERY.abuja}</li>
          <li>{DELIVERY.nationwide}</li>
        </ul>
      </div>

      {outOfStock && (
        <p className="text-sm text-foreground">
          {colour.name} is out of stock. Pick another colour.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <AddToCartButton line={line} qty={quantity} disabled={outOfStock} />
        <BuyNowButton line={line} qty={quantity} disabled={outOfStock} />
      </div>
    </div>
  );
}
