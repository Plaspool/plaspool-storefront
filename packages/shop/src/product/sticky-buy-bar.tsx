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
 * The one pattern worth taking from Bambu: once the buy box has scrolled past,
 * the decision stays reachable without a scroll back up.
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
  visible: boolean;
  className?: string;
}

export function StickyBuyBar({
  product,
  colour,
  size,
  quantity,
  onQuantityChange,
  visible,
  className,
}: StickyBuyBarProps) {
  /* Unmounted rather than hidden. A bar kept in the tree with `aria-hidden`
     would still put its two buttons in the tab order while off-screen, and
     the page already has those controls in the buy box. */
  if (!visible) return null;

  const unit = unitPriceFor(size.priceNaira, product.bulkTiers, quantity);
  const line: CartLineKey = {
    productSlug: product.slug,
    colourId: colour.id,
    sizeId: size.id,
  };

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-brand-line bg-background/95 backdrop-blur",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        {/* Below sm the name goes and the price and buttons stay: at 375 px
            the decision has to fit, and the name is the part you already
            know. */}
        <div className="hidden min-w-0 flex-1 sm:block">
          <p className="truncate font-sans text-sm font-semibold text-foreground">
            {product.name}
          </p>
          <p className="truncate font-sans text-xs text-muted-foreground">{colour.name}</p>
        </div>

        <Price amount={unit} size="md" className="shrink-0" />

        <QuantityStepper
          value={quantity}
          onChange={onQuantityChange}
          label={product.name}
          className="hidden shrink-0 sm:inline-flex"
        />

        <div className="ml-auto flex shrink-0 gap-2 sm:ml-0">
          <AddToCartButton line={line} qty={quantity} disabled={!colour.inStock} />
          <BuyNowButton line={line} qty={quantity} disabled={!colour.inStock} />
        </div>
      </div>
    </div>
  );
}
