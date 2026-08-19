"use client";

import * as React from "react";
import { cn } from "@plaspool/ui";

import type { Colour } from "../data/types";
import { ProductPhoto } from "../components/product-photo";

/**
 * The product's pictures, and the colour picker, which are the same control.
 *
 * ═══ THE STAGE AND THE RAIL FALL BACK DIFFERENTLY, AND THAT IS THE POINT ═══
 *
 * THE STAGE takes the selected colour's photograph, then the product's cover,
 * then the drawing. Falling back to the cover is what every catalogue does —
 * the main image is "the product", and the swatch below it is the selection.
 *
 * THE RAIL takes the colour's own photograph, then the drawing — and NEVER the
 * cover. A rail is a colour picker: seven thumbnails of the same cover is seven
 * identical buttons, which destroys the one thing the control communicates. The
 * generated spool is tinted to the actual colour, so where no photograph exists
 * it is also the more truthful picture of that colour.
 *
 * ═══ THE ALT TEXT DESCRIBES WHAT IS ON SCREEN, NOT WHAT IS SELECTED ═══
 * This was wrong and it was the sharpest version of the mistake this file
 * otherwise argues against. The stage's alt was built from the selected colour
 * unconditionally, so when it fell back to the product cover, the SAME BYTES
 * were announced as "PLA Filament, Black", then "PLA Filament, Red", then
 * "PLA Filament, Grey" as the shopper clicked along the rail — a false claim
 * made to exactly the people who cannot check it. A picture is named for what
 * it is a picture OF: the colour only enters the name when the photograph is
 * that colour's own.
 *
 * ═══ THE PRODUCT'S OTHER PHOTOGRAPHS ═══
 * `imageUrls` is everything the shop uploaded beyond the cover, and it was
 * carried through the data layer and rendered nowhere — a second angle sitting
 * in the API that no customer could reach. They join the rail after the
 * colours, as their own thumbnails: choosing one changes the picture WITHOUT
 * changing the colour, because a second angle of the product is not a different
 * product. Choosing a colour clears the override, since the colour is the
 * stronger statement about what you are looking at.
 */

export interface GalleryProps {
  name: string;
  colours: Colour[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Drives the fill level of the drawn spool — the selected size's weight. */
  weightGrams: number;
  /** The product's own cover, for colours nobody has photographed. */
  productCoverUrl?: string | null;
  /** Everything else the shop uploaded for this product. */
  productImageUrls?: string[];
  className?: string;
}

export function Gallery({
  name,
  colours,
  selectedId,
  onSelect,
  weightGrams,
  productCoverUrl = null,
  productImageUrls = [],
  className,
}: GalleryProps) {
  const selected = colours.find((colour) => colour.id === selectedId) ?? colours[0];

  /**
   * A product photograph the shopper picked, overriding the colour's picture
   * until they pick a colour again.
   *
   * The product it belongs to is stored WITH it, so navigating to another
   * product drops the override during render rather than in an effect that
   * would paint the wrong picture first and correct it a frame later.
   */
  const [picked, setPicked] = React.useState<{ product: string; url: string } | null>(null);
  const extraUrl = picked?.product === name ? picked.url : null;
  const setExtraUrl = (url: string | null) =>
    setPicked(url === null ? null : { product: name, url });

  /**
   * What the stage shows, and what it is honestly called.
   *
   * Three cases, and the name follows the picture in every one: an extra
   * product photograph is "PLA Filament" (it is not of a colour), a colour's
   * own photograph names the colour, and the cover standing in for an
   * unphotographed colour names only the product.
   */
  const stage: { src: string | null; alt: string } = extraUrl
    ? { src: extraUrl, alt: name }
    : selected.imageUrl
      ? { src: selected.imageUrl, alt: `${name}, ${selected.name}` }
      : productCoverUrl
        ? { src: productCoverUrl, alt: name }
        : /* The drawing, which IS tinted to the selected colour — so here, and
             only here, the colour belongs in the name. */
          { src: null, alt: `${name}, ${selected.name}` };

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-4 md:flex-row-reverse", className)}>
      {/* THE STAGE IS A SQUARE, AND IT SIZES ITSELF (#21).

          It used to be `flex-1` with no shape of its own, so it took whatever
          height the grid handed the gallery column — the buy box's height —
          and drew a border around a tall run of nothing under the spool.
          `aspect-square` gives it proportions, `self-start` stops the flex row
          stretching it back, and `max-w-md` is the cap SpoolImage used to
          carry, moved out to the box so the box is what gets sized rather than
          the drawing inside it. `mx-auto` centres it in the width left beside
          the rail.

          SpoolImage fills its flange and bore with the page background, so it
          stays on the background surface and never on a tinted one. */}
      <div className="mx-auto aspect-square w-full min-w-0 max-w-md self-start rounded-xl border border-brand-line bg-background p-4 sm:p-8 md:flex-1">
        <ProductPhoto
          src={stage.src}
          alt={stage.alt}
          colourHex={selected.hex}
          weightGrams={weightGrams}
          /* The page's LCP: the largest thing above the fold, and the reason
             somebody opened this page. */
          priority
          className="h-full w-full"
        />
      </div>

      {/* THE WRAPPER EXISTS TO HAVE NO HEIGHT OF ITS OWN.

          The rail has always carried `md:overflow-y-auto` — the intent that it
          scroll rather than run long was there from the start — but it never
          had a bounded height to scroll within, so it just grew. Eight 80px
          thumbnails stand ~700px tall, which beside a square stage would make
          the rail the tallest thing here and put back the imbalance #21 is
          about removing.

          So at md and up the rail is absolutely positioned inside a wrapper
          that contributes no intrinsic height: the row's height is the stage's
          alone, the wrapper stretches to it, and the rail scrolls inside
          exactly the square the spool occupies. Below md none of it applies —
          the wrapper is an ordinary block and the rail is the horizontal strip
          it always was, scrolling inside itself at 375px rather than widening
          the page. */}
      <div className="w-full min-w-0 shrink-0 md:relative md:w-20 md:self-stretch">
        <ul
          aria-label="Colours and photos"
          className={cn(
            "flex w-full min-w-0 gap-2 overflow-x-auto pb-1",
            "md:absolute md:inset-0 md:flex-col md:overflow-x-visible md:overflow-y-auto md:pb-0",
            /* One thumbnail wide, so a scrollbar gutter would come out of the
               thumbnail itself. The strip below md already scrolls without one. */
            "no-scrollbar",
          )}
        >
          {colours.map((colour) => {
            const active = !extraUrl && colour.id === selected.id;
            return (
              <li key={colour.id} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={colour.inStock ? colour.name : `${colour.name}, out of stock`}
                  onClick={() => {
                    onSelect(colour.id);
                    /* A colour is the stronger statement about what you are
                       looking at, so it wins over a chosen angle. */
                    setExtraUrl(null);
                  }}
                  className={cn(THUMB, active ? "border-brand" : "border-brand-line hover:border-foreground")}
                >
                  <ProductPhoto
                    /* THE COLOUR'S OWN PHOTOGRAPH OR THE DRAWING — never the
                       product cover. See the file header. */
                    src={colour.imageUrl}
                    /* Decorative: the button already carries the colour's name,
                       and `SpoolImage` reads `""` as "hide me" rather than as
                       an empty name. */
                    alt=""
                    colourHex={colour.hex}
                    weightGrams={weightGrams}
                    className="h-full w-full"
                  />
                </button>
              </li>
            );
          })}

          {productImageUrls.map((url, i) => {
            const active = extraUrl === url;
            return (
              <li key={url} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={`${name}, photo ${i + 2}`}
                  onClick={() => setExtraUrl(url)}
                  className={cn(THUMB, active ? "border-brand" : "border-brand-line hover:border-foreground")}
                >
                  <ProductPhoto
                    src={url}
                    alt=""
                    colourHex={selected.hex}
                    weightGrams={weightGrams}
                    className="h-full w-full"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

const THUMB = cn(
  "block h-16 w-16 rounded-lg border bg-background p-1 transition-colors motion-reduce:transition-none md:h-20 md:w-20",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);
