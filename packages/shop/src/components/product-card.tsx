import { Link } from "./link";
import { Badge, cn } from "@plaspool/ui";

import type { Product } from "../data/types";
import { availableColours, cheapestSize, firstInStockColour, priceFrom } from "../data/money";
import { bulkAffordance } from "../data/bulk";
import { primaryBadge } from "../data/badges";
import { CardAddButton } from "./card-add-button";
import { ProductPhoto } from "./product-photo";
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
  const rating = product.rating;
  /* One badge, never a stack — see `primaryBadge` for which one wins. */
  const badge = primaryBadge(product.badges);
  /* Only colours somebody can order. See `availableColours`. */
  const colours = availableColours(product);

  return (
    <div className={cn("group relative flex flex-col", className)}>
      {/* The image well. The add button is positioned against this box, and
          is a sibling of the link rather than a child of it. */}
      <div className="relative overflow-hidden rounded-lg border border-brand-line bg-background">
        <div className="aspect-square p-3">
          <ProductPhoto
            src={colour.imageUrl ?? product.coverImageUrl}
            /* THE NAME FOLLOWS THE PICTURE. Only a photograph of this colour —
               or the drawing, which is tinted to it — may be called by it; the
               product cover standing in is a picture of the product. */
            alt={
              colour.imageUrl || !product.coverImageUrl
                ? `${product.name} spool in ${colour.name}`
                : product.name
            }
            colourHex={colour.hex}
            weightGrams={size.weightGrams}
            className="h-full w-full"
          />
        </div>

        {badge && (
          <Badge
            variant={badge === "Low stock" ? "outline" : "default"}
            className={cn(
              "pointer-events-none absolute left-2 top-2 z-10",
              badge === "Low stock" && "border-brand-line bg-background",
            )}
          >
            {badge}
          </Badge>
        )}

        <CardAddButton product={product} />
      </div>

      {/* The swatch row sits outside the link, so its `sr-only` colour names
          never join the link's accessible name. */}
      <ColourSwatches
        colours={colours}
        max={6}
        className="mt-3"
        label={`Colours available for ${product.name}`}
      />

      <Link
        href={`/store/products/${product.slug}`}
        aria-label={product.name}
        className={cn(
          "mt-2 rounded-sm text-sm font-semibold leading-snug text-foreground",
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
          silence on a card, and an empty star row would still claim a rating
          exists. These are real customer ratings now, aggregated by the API in
          one request for the whole grid; the flag that used to suppress
          invented ones is gone with the fixtures that needed it. */}
      {rating.count > 0 && (
        <RatingStars
          rating={rating.average}
          count={rating.count}
          className="mt-1.5"
        />
      )}

      <Price
        from
        amount={priceFrom(product)}
        /* `priceFrom` is the CHEAPEST size's figure, so the currency that
           denominates it is that same size's — read together, never assumed.
           See `priceFrom`'s own comment. */
        currency={cheapestSize(product).currency}
        size="sm"
        className="mt-1.5"
      />

      {/* THE LADDER'S BEST OFFER, or nothing. A listing has no quantity to
          reason about, so `bulkAffordance` names the deepest rung and what
          reaches it rather than saying "bulk discount available" — which names
          neither a saving nor a quantity and so changes nobody's basket. */}
      {bulkAffordance(product.bulkTiers) && (
        <p className="mt-1 text-xs text-brand">
          {bulkAffordance(product.bulkTiers)}
        </p>
      )}
    </div>
  );
}
