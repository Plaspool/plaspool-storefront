"use client";

import * as React from "react";
import { cn } from "@plaspool/ui";

import type { Product } from "../data/types";
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
  className?: string;
}

export function ProductBuySection({ product, className }: ProductBuySectionProps) {
  const [colourId, setColourId] = React.useState(() => firstInStockColour(product).id);
  const [sizeId, setSizeId] = React.useState(() => cheapestSize(product).id);
  const [quantity, setQuantity] = React.useState(1);

  const colour = product.colours.find((c) => c.id === colourId) ?? product.colours[0];
  const size = product.sizes.find((s) => s.id === sizeId) ?? product.sizes[0];

  const buyBoxRef = React.useRef<HTMLDivElement | null>(null);
  const [barVisible, setBarVisible] = React.useState(false);

  React.useEffect(() => {
    const el = buyBoxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) =>
        /* Both terms matter. `!isIntersecting` alone is true on first paint
           for a buy box below the fold, which would flash the bar before the
           buy box has ever been scrolled past; `top < 0` says it left
           upwards, which is the only direction that should summon it. */
        setBarVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className={cn("w-full min-w-0", className)}>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Gallery
          name={product.name}
          colours={product.colours}
          selectedId={colour.id}
          onSelect={setColourId}
          weightGrams={size.weightGrams}
        />

        <div ref={buyBoxRef} className="min-w-0">
          <BuyBox
            product={product}
            colour={colour}
            size={size}
            quantity={quantity}
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
        visible={barVisible}
      />
    </div>
  );
}
