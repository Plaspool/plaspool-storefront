"use client";

import * as React from "react";
import { cn } from "@plaspool/ui";

import type { Product } from "../data/types";
import type { ReviewAggregate } from "../data/reviews";
import { firstInStockColour, cheapestSize } from "../data/money";
import { Gallery } from "./gallery";
import { BuyBox } from "./buy-box";
import { StickyBuyBar } from "./sticky-buy-bar";

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
  className?: string;
}

export function ProductBuySection({
  product,
  reviewAggregate,
  className,
}: ProductBuySectionProps) {
  const [colourId, setColourId] = React.useState(() => firstInStockColour(product).id);
  const [sizeId, setSizeId] = React.useState(() => cheapestSize(product).id);
  const [quantity, setQuantity] = React.useState(1);

  const colour = product.colours.find((c) => c.id === colourId) ?? product.colours[0];
  const size = product.sizes.find((s) => s.id === sizeId) ?? product.sizes[0];

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
        <Gallery
          name={product.name}
          colours={product.colours}
          selectedId={colour.id}
          onSelect={setColourId}
          weightGrams={size.weightGrams}
          productCoverUrl={product.coverImageUrl}
          className="lg:sticky lg:top-20"
        />

        <div className="min-w-0">
          <BuyBox
            product={product}
            colour={colour}
            size={size}
            quantity={quantity}
            reviewAggregate={reviewAggregate}
            onColourChange={setColourId}
            onSizeChange={setSizeId}
            onQuantityChange={setQuantity}
          />
        </div>
      </div>

      <StickyBuyBar
        product={product}
        colour={colour}
        size={size}
        quantity={quantity}
        onQuantityChange={setQuantity}
      />
    </div>
  );
}
