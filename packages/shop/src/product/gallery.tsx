"use client";

import { cn } from "@plaspool/ui";

import type { Colour } from "../data/types";
import { ProductPhoto } from "../components/product-photo";

/**
 * The product image, twice: the main spool at the selected colour, and one
 * thumbnail per colour the product carries.
 *
 * Not a carousel. There is one image per colour and nothing else, so the
 * gallery and the colour picker are the same control expressed twice —
 * picking a thumbnail is picking a colour, which is what makes changing
 * colour feel like looking at the product rather than editing a form.
 *
 * ═══ THE STAGE AND THE RAIL FALL BACK DIFFERENTLY, AND THAT IS THE POINT ═══
 *
 * THE STAGE takes the selected colour's photograph, then the product's cover,
 * then the drawing. Falling back to the cover is what every catalogue does —
 * the main image is "the product", and the swatch below it is the selection.
 *
 * THE RAIL takes the colour's own photograph, then the drawing — and NEVER the
 * cover. A rail is a colour picker: seven thumbnails of the same cover is seven
 * identical buttons, which is worse than seven tinted drawings because it
 * destroys the one thing the control communicates. The generated spool is
 * tinted to the actual colour, so where no photograph exists it is also the
 * more truthful picture of that colour.
 *
 * The re-tint lives on `SpoolImage`'s winding paths and only applies to the
 * fallback. Nothing here animates: `colourHex` changes and the spool eases to
 * it, or snaps under `prefers-reduced-motion`.
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
  className?: string;
}

export function Gallery({
  name,
  colours,
  selectedId,
  onSelect,
  weightGrams,
  productCoverUrl = null,
  className,
}: GalleryProps) {
  const selected = colours.find((colour) => colour.id === selectedId) ?? colours[0];
  /** The stage: this colour's photograph, the product's cover, then the drawing. */
  const stagePicture = selected.imageUrl ?? productCoverUrl;

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
          src={stagePicture}
          alt={`${name}, ${selected.name}`}
          colourHex={selected.hex}
          weightGrams={weightGrams}
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
        aria-label="Colours"
        className={cn(
          "flex w-full min-w-0 gap-2 overflow-x-auto pb-1",
          "md:absolute md:inset-0 md:flex-col md:overflow-x-visible md:overflow-y-auto md:pb-0",
          /* One thumbnail wide, so a scrollbar gutter would come out of the
             thumbnail itself. The strip below md already scrolls without one. */
          "no-scrollbar",
        )}
      >
        {colours.map((colour) => {
          const active = colour.id === selected.id;
          return (
            <li key={colour.id} className="shrink-0">
              <button
                type="button"
                aria-pressed={active}
                aria-label={colour.inStock ? colour.name : `${colour.name}, out of stock`}
                onClick={() => onSelect(colour.id)}
                className={cn(
                  "block h-16 w-16 rounded-lg border bg-background p-1 transition-colors motion-reduce:transition-none md:h-20 md:w-20",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active ? "border-brand" : "border-brand-line hover:border-foreground",
                )}
              >
                <ProductPhoto
                  /* THE COLOUR'S OWN PHOTOGRAPH OR THE DRAWING — never the
                     product cover. See the file header. */
                  src={colour.imageUrl}
                  /* The button already carries the colour's name, so the
                     picture inside it is decorative. */
                  alt=""
                  colourHex={colour.hex}
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
