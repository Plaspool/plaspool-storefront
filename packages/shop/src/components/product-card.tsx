"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ShoppingCart } from "lucide-react";
import { Badge, cn } from "@plaspool/ui";

import type { Colour, Product, SizeOption } from "../data/types";
import { priceFrom, ratingSummary } from "../data/money";
import { SHOW_FIXTURE_REVIEWS } from "../data/config";
import { useCart } from "../cart/cart-context";
import { SpoolImage } from "./spool-image";
import { Price } from "./price";
import { ColourSwatches } from "./colour-swatches";
import { RatingStars } from "./rating-stars";

/**
 * The card that appears in every grid on the store.
 *
 * Two structural rules the markup exists to satisfy:
 *
 * 1. The whole card is one link, but the add button is a **sibling** of that
 *    link rather than a descendant. A `<button>` inside an `<a>` is invalid
 *    HTML and browsers recover from it by breaking keyboard activation. So the
 *    card is a positioned container, the link is stretched across it with an
 *    `::after` overlay, and the button sits above that overlay.
 * 2. `ColourSwatches` in its static mode emits every colour name as `sr-only`
 *    text. That text sits inside the link's hit area, so the link carries an
 *    explicit `aria-label` — otherwise its accessible name would be the
 *    product name followed by a recital of ten colours.
 *
 * `"use client"` because the add button reads `useCart()`. It cannot reuse
 * `AddToCartButton`: that component builds its own accessible name from its
 * visible label, and this one needs to name the colour and size it will add
 * while showing only a short label.
 */

/** The colour the spool is tinted with, and the one the add button adds. */
function firstInStockColour(product: Product): Colour {
  return product.colours.find((colour) => colour.inStock) ?? product.colours[0];
}

/** The cheapest size — the one `priceFrom` quotes, so the two agree. */
function cheapestSize(product: Product): SizeOption {
  return product.sizes.reduce((min, size) =>
    size.priceNaira < min.priceNaira ? size : min,
  );
}

const CONFIRM_MS = 1800;

function CardAddButton({ product }: { product: Product }) {
  const cart = useCart();
  const colour = firstInStockColour(product);
  const size = cheapestSize(product);
  const [justAdded, setJustAdded] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const soldOut = !colour.inStock;

  function handleClick() {
    cart.add(
      { productSlug: product.slug, colourId: colour.id, sizeId: size.id },
      1,
    );
    setJustAdded(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setJustAdded(false), CONFIRM_MS);
  }

  const label = `Add ${product.name}, ${colour.name}, ${size.label} to cart`;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={soldOut}
        aria-label={soldOut ? `${label} — out of stock` : label}
        className={cn(
          /* Above the link's stretched overlay, so the click lands here. */
          "absolute inset-x-2 bottom-2 z-10 inline-flex h-9 items-center justify-center gap-2",
          "rounded-md bg-brand px-3 font-sans text-sm font-medium text-brand-ink",
          "shadow-sm transition-opacity duration-150 motion-reduce:transition-none",
          "hover:bg-brand-hover disabled:pointer-events-none disabled:opacity-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          /* Hidden until the card is hovered or something inside it has
             focus, so it is reachable by keyboard and not just by mouse.
             `opacity` rather than `hidden`, because a focusable control that
             is `display:none` is not focusable at all. */
          "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      >
        {justAdded ? (
          <Check aria-hidden="true" className="h-4 w-4" />
        ) : (
          <ShoppingCart aria-hidden="true" className="h-4 w-4" />
        )}
        <span aria-hidden="true">{justAdded ? "Added" : "Add to cart"}</span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {justAdded ? `${product.name} added to cart` : ""}
      </span>
    </>
  );
}

export interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const colour = firstInStockColour(product);
  const size = cheapestSize(product);
  const rating = ratingSummary(product.reviews);

  return (
    <div className={cn("group relative flex flex-col", className)}>
      {/* The image well. The add button is positioned against this box, and
          is a sibling of the link rather than a child of it. */}
      <div className="relative overflow-hidden rounded-lg border border-brand-line bg-background">
        <div className="aspect-square p-3">
          <SpoolImage
            colourHex={colour.hex}
            weightGrams={size.weightGrams}
            label={`${product.name} spool in ${colour.name}`}
            className="h-full w-full"
          />
        </div>

        {product.badges.length > 0 && (
          <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
            {product.badges.map((badge) => (
              <Badge
                key={badge}
                variant={badge === "Low stock" ? "outline" : "default"}
                className={cn(
                  "font-sans",
                  badge === "Low stock" && "border-brand-line bg-background",
                )}
              >
                {badge}
              </Badge>
            ))}
          </div>
        )}

        <CardAddButton product={product} />
      </div>

      {/* The swatch row sits outside the link, so its `sr-only` colour names
          never join the link's accessible name. */}
      <ColourSwatches
        colours={product.colours}
        max={6}
        className="mt-3"
        label={`Colours available for ${product.name}`}
      />

      <Link
        href={`/store/products/${product.slug}`}
        aria-label={product.name}
        className={cn(
          "mt-2 rounded-sm font-sans text-sm font-semibold leading-snug text-foreground",
          "transition-colors hover:text-brand motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          /* Stretches the link's hit area over the whole card. The image well
             is `relative`, so this overlay is clipped to the card, and the add
             button's `z-10` keeps it clickable above the overlay. */
          "after:absolute after:inset-0 after:content-['']",
        )}
      >
        {product.name}
      </Link>

      {/* Nothing at all when there are no reviews — "0.0 (0)" is worse than
          silence on a card. With `SHOW_FIXTURE_REVIEWS` off every card takes
          that same no-reviews path: invented stars must never ship looking
          like genuine customer ratings, and an empty star row would still
          claim a rating exists. */}
      {SHOW_FIXTURE_REVIEWS && rating.count > 0 && (
        <RatingStars
          rating={rating.average}
          count={rating.count}
          className="mt-1.5"
        />
      )}

      <Price
        from
        amount={priceFrom(product)}
        size="sm"
        className="mt-1.5"
      />
    </div>
  );
}
