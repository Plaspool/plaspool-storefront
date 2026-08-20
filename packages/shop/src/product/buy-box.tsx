"use client";

import * as React from "react";
import { Check, Truck } from "lucide-react";
import { Button, cn, NEO_SURFACE } from "@plaspool/ui";

import type { Colour, Product, SizeOption } from "../data/types";
import { availableColours, unitPriceFor } from "../data/money";
import { DELIVERY } from "../data/config";
import { starsFromAggregate } from "../data/reviews";
import type { ReviewAggregate } from "../data/reviews";
import { Price } from "../components/price";
import { ColourSwatches } from "../components/colour-swatches";
import { RatingStars } from "../components/rating-stars";
import { QuantityStepper } from "../components/quantity-stepper";
import { BulkTierTable } from "../components/bulk-tier-table";
import { AddToCartButton } from "../cart/add-to-cart";
import type { CartLineKey } from "../cart/types";
import { useCart } from "../cart/cart-context";

/**
 * Everything you need to decide with, in the order the spec fixes: name,
 * rating, price, colour, size, quantity, tiers, features, delivery, actions.
 *
 * The price is `unitPriceFor(..., qty)`, so raising the stepper moves it. That
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
      onClick={() => {
        cart.add(line, qty);
        cart.open();
      }}
      className={cn(
        // Matched to AddToCartButton so the pair reads as one control: same
        // height, same label size, same stroke and press. The fill stays
        // white — it is the secondary of the two, and #10 kept its colour.
        "h-12 px-5 text-base",
        NEO_SURFACE,
        // `variant="outline"` brings `border border-input`; the neobrutalist
        // stroke is 2px and foreground-coloured, and tailwind-merge only
        // resolves conflicts within a class group — `border-input` and
        // `border-foreground` are both colour, so the later one wins, but the
        // width needs its own token to beat `border`.
        "border-2 border-foreground bg-background hover:bg-background",
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

  const sizeLabelId = React.useId();

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-5", className)}>
      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {product.name}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{product.summary}</p>
      </div>

      {showRating && (
        <RatingStars
          rating={starsFromAggregate(reviewAggregate)}
          count={reviewAggregate.count}
          size="md"
        />
      )}

      <Price amount={unit} compareAt={size.compareAtNaira} size="lg" />

      <div>
        <p className="font-sans text-sm font-semibold text-foreground">Colour</p>
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
        <p className="mt-1.5 font-sans text-sm text-muted-foreground">{colour.name}</p>
      </div>

      <div>
        <p id={sizeLabelId} className="font-sans text-sm font-semibold text-foreground">
          Size
        </p>
        <div role="group" aria-labelledby={sizeLabelId} className="mt-2 flex flex-wrap gap-2">
          {product.sizes.map((option) => {
            const active = option.id === size.id;
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
                <span className="font-sans text-sm">{option.label}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {option.weightGrams} g
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="font-sans text-sm font-semibold text-foreground">Quantity</p>
        <QuantityStepper
          value={quantity}
          onChange={onQuantityChange}
          label={product.name}
          className="mt-2"
        />
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
          <li>{DELIVERY.lagos}</li>
          <li>{DELIVERY.nationwide}</li>
        </ul>
      </div>

      {outOfStock && (
        <p className="font-sans text-sm text-foreground">
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
