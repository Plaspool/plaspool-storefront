"use client";

import * as React from "react";
import { Check, ShoppingCart } from "lucide-react";
import { cn } from "@plaspool/ui";

import type { Product } from "../data/types";
import { cheapestSize, firstInStockColour } from "../data/money";
import { useCart } from "../cart/cart-context";
import { boxQuickAddSize, isMysteryBox } from "../data/mystery-box";
import { useBoxAvailability } from "./use-box-availability";

/**
 * The add button that sits in a `ProductCard`'s image well.
 *
 * It lives in its own module purely to keep the `"use client"` boundary here.
 * `ProductCard` is otherwise a server component — `SpoolImage` in particular is
 * deliberately hook-free so its SVG renders on the server — and a sixteen-card
 * grid should not ship sixteen spools, badge rows and swatch rows to the
 * browser for the sake of one button that reads `useCart()`.
 *
 * It cannot reuse `AddToCartButton`: that component builds its accessible name
 * from its visible label, and this one needs to name the colour and size it
 * will add while showing only a short label.
 */

const CONFIRM_MS = 1800;

export function CardAddButton({ product }: { product: Product }) {
  const cart = useCart();
  const colour = firstInStockColour(product);
  /* ═══ THE BOX ADDS A SIZE THAT CAN BE SOLD ═══
     `cheapestSize` may be sold out, or not set up at all, and a quick-add of it
     only moves the refusal to checkout. For the box, the cheapest SELLABLE size
     is added instead, and the button is disabled when there is none. */
  const isBox = isMysteryBox(product);
  const { availabilityOf } = useBoxAvailability(product, colour.id);
  const boxSize = isBox ? boxQuickAddSize(product.sizes, availabilityOf) : null;
  const size = boxSize ?? cheapestSize(product);
  const [justAdded, setJustAdded] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const soldOut = isBox ? boxSize === null : !colour.inStock;

  function handleClick() {
    cart.add(
      { productSlug: product.slug, colourId: colour.id, sizeId: size.id },
      1,
    );
    setJustAdded(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setJustAdded(false), CONFIRM_MS);
  }

  /* A box's colour has no name, so it is filtered out rather than read as ", ,". */
  const label = `Add ${[product.name, colour.name, size.label].filter(Boolean).join(", ")} to cart`;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={soldOut}
        aria-label={soldOut ? `${label} — out of stock` : label}
        /* ═══ SURFACE PIN — EXCUSED FROM THE FLAG, ON PURPOSE ═══════════════
           Owner decision: "for now leave the add to cart and buy now buttons
           they are okay". This is the third member of that family, alongside
           `cart/add-to-cart.tsx` and `product/buy-box.tsx`, which each carry
           `surface="neo"`.

           IT IS PINNED BY OMISSION RATHER THAN BY `controlSurface(..., "neo")`,
           and that is a deliberate difference from its two siblings. This
           control never wore the neobrutalist treatment: it is a small
           hover-revealed overlay on a product card with its own `bg-brand`
           fill, `shadow-sm` and 9px height. Routing it through the `neo` table
           would ADD a 2px stroke and a 4px hard shadow — a visible change to a
           button the owner asked to leave alone. So the fill below stays
           hand-written, and this comment is the exception record.

           To opt it back in: delete the colour utilities on the next four
           lines and add `controlSurface("primary")`. */
        className={cn(
          /* Above the link's stretched overlay, so the click lands here. */
          "absolute inset-x-2 bottom-2 z-10 inline-flex h-9 items-center justify-center gap-2",
          "rounded-md bg-brand px-3 text-sm font-medium text-brand-ink",
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
