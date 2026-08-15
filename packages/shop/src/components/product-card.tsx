import Link from "next/link";
import { Badge, cn } from "@plaspool/ui";

import type { Product } from "../data/types";
import { cheapestSize, firstInStockColour, priceFrom, ratingSummary } from "../data/money";
import { SHOW_FIXTURE_REVIEWS } from "../data/config";
import { CardAddButton } from "./card-add-button";
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
 * No `"use client"`: the only part that needs the boundary is `CardAddButton`,
 * which reads `useCart()` and lives in its own client module. Everything else
 * here — the spool SVG especially — renders on the server.
 */

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
