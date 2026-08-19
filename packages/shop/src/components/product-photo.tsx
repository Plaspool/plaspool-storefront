import { cn } from "@plaspool/ui";

import { SpoolImage } from "./spool-image";

/**
 * A product's picture: the photograph if there is one, the drawn spool if not.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS. Every surface in the shop drew `SpoolImage` — a generated,
 * colour-tinted SVG — because the storefront's `Product` type had no field for
 * an image. The API had been sending `coverImageUrl`, `imageUrls` and (since
 * `Plaspool/plaspool-admin#39`) a per-colour `imageUrl` all along; the mapper
 * dropped them. So a photograph uploaded through the admin dashboard was never
 * seen by a single customer.
 *
 * THE DRAWN SPOOL IS NOT DELETED, AND THAT IS DELIBERATE. It is the fallback
 * for a product nobody has photographed yet, and a shop mid-way through filling
 * its catalogue should show a coherent placeholder rather than a hole. It is
 * also still the right answer for decoration — the hero carousel tints a row of
 * these to show the range, and claims no photograph in doing so.
 *
 * ═══ NO HOOKS, ON PURPOSE ═══
 * `SpoolImage` carries the same rule and `card-add-button.tsx` explains it:
 * `ProductCard` is a server component, and a sixteen-card grid should not ship
 * sixteen spools to the browser for the sake of one interaction. A `useState`
 * here to swap a broken image for the drawing would pull every card — and the
 * SVG-generation code behind the fallback — across the client boundary. So the
 * choice is made once, from the URL's presence, on whichever side is rendering.
 *
 * WHAT THAT COSTS, STATED PLAINLY: a URL that stops resolving between being
 * sent and being fetched shows the browser's broken-image treatment and the alt
 * text, not the drawn spool. `/api/public/images/:id` serves an image while an
 * active product references it and the storefront only ever lists active
 * products, so this needs an asset to be deleted out from under a live product.
 * If that turns out to happen, the fix is a client wrapper used only on the
 * surfaces that are already client components — not hooks in here.
 *
 * ═══ `priority` FOR THE ONE IMAGE THAT IS THE LCP ═══
 * Everything here was `loading="lazy"`, including the product page's main
 * image — the largest element above the fold, deferred behind layout for no
 * reason. Lazy is right for a thumbnail rail and a grid's third row; it is
 * wrong for the picture somebody came to look at.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export interface ProductPhotoProps {
  /** The photograph, or null to draw the spool. */
  src: string | null;
  /** Describes the picture. Empty for a decorative one beside its own label. */
  alt: string;
  /** The drawn spool's colour, used whenever the photograph is absent. */
  colourHex: string;
  /** The drawn spool's fill level. Ignored when a photograph is shown. */
  weightGrams: number;
  /** Set on the one image that is the page's LCP — the product page's stage.
   *  Never on a rail, a grid's later rows, or anything below the fold. */
  priority?: boolean;
  className?: string;
}

/**
 * `fetchpriority` as an attribute rather than a prop.
 *
 * React 19 passes unknown lowercase attributes straight through, which is
 * exactly what this needs — the DOM property is camelCase, the ATTRIBUTE is
 * all-lowercase, and React's typings do not carry it yet. Spread from a helper
 * so the cast lives in one named place instead of inline in the markup, and so
 * the attribute is ABSENT rather than `undefined` when it does not apply.
 */
function priorityAttrs(priority: boolean): Record<string, string> {
  return priority ? { fetchpriority: "high" } : {};
}

export function ProductPhoto({
  src,
  alt,
  colourHex,
  weightGrams,
  priority = false,
  className,
}: ProductPhotoProps) {
  if (!src) {
    return (
      <SpoolImage
        colourHex={colourHex}
        weightGrams={weightGrams}
        label={alt}
        className={className}
      />
    );
  }

  return (
    /* A PLAIN `<img>`, NOT `next/image`. `next.config.ts` sets
       `images.unoptimized: true` because Workers has no sharp, so the component
       would buy nothing and cost a wrapper — the same call the blog's covers
       make, for the same reason.

       `object-contain` because these are product shots on a light stage: a
       spool cropped to fill a square is a spool with its edge cut off. */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      {...priorityAttrs(priority)}
      decoding={priority ? "sync" : "async"}
      className={cn("h-full w-full object-contain", className)}
    />
  );
}
