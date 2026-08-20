"use client";

import * as React from "react";
import { cn } from "@plaspool/ui";

import type { Colour } from "../data/types";
import { ProductPhoto } from "../components/product-photo";

/**
 * The product's pictures. A GALLERY — not a colour picker.
 *
 * ═══ THE RAIL WAS SHOWING VARIANTS, AND IT SHOULD NEVER HAVE BEEN ═══
 * This component used to take the whole `colours` array and render one
 * thumbnail per colour, each one a generated `SpoolImage` tinted to that
 * colour's hex. Two things were wrong with that, and they compound:
 *
 * 1. IT DUPLICATED A CONTROL THAT ALREADY EXISTS. The buy box, a few hundred
 *    pixels to the right, has the colour picker — a labelled radio group whose
 *    selection drives the price, the variant id and the add button. A second,
 *    unlabelled picker made of pictures competes with it, and teaches the
 *    shopper that the left column is where you choose, which it is not.
 * 2. IT DREW PICTURES OF THINGS NOBODY HAD PHOTOGRAPHED. No live variant
 *    carries its own `imageUrl` today, so the rail was six or eight generated
 *    drawings of the same spool in six or eight tints, stacked beside ONE real
 *    photograph on the stage. A column of drawings beside a photograph reads
 *    as "here are more photographs", and every one of them is a claim the
 *    catalogue cannot back.
 *
 * So the rail is now what a rail is everywhere else in commerce: THE OTHER
 * PICTURES OF THIS PRODUCT. Nothing generated ever enters it — a thumbnail
 * here is always a file somebody uploaded.
 *
 * ═══ AND IT DISAPPEARS WHEN THERE IS NOTHING TO PICK BETWEEN ═══
 * One photograph is not a gallery. Below two pictures the rail is not rendered
 * at all, rather than rendered holding a single thumbnail of the image already
 * filling the stage beside it — a control with no second state.
 *
 * The colour still reaches this component, and still matters twice: it tints
 * the drawn spool when the product has no photographs at all, and it decides
 * whether the stage may be NAMED for a colour.
 *
 * ═══ THE ALT TEXT DESCRIBES WHAT IS ON SCREEN, NOT WHAT IS SELECTED ═══
 * Kept from the version that got this wrong, because the trap is still here.
 * The stage's alt was once built from the selected colour unconditionally, so
 * when it fell back to the product cover the SAME BYTES were announced as
 * "PLA Filament, Black", then "PLA Filament, Red", then "PLA Filament, Grey"
 * as the shopper clicked along — a false claim made to exactly the people who
 * cannot check it. A picture is named for what it is a picture OF: the colour
 * enters the name only when the picture is that colour's own photograph, or is
 * the spool drawn in it.
 */

export interface GalleryProps {
  name: string;
  /** The selected colour. Tints the drawn spool, and gates the honest alt. */
  colour: Colour;
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
  colour,
  weightGrams,
  productCoverUrl = null,
  productImageUrls = [],
  className,
}: GalleryProps) {
  /**
   * Every real photograph of what is currently selected, in the order a
   * shopper should meet them.
   *
   * THE SELECTED COLOUR'S OWN PHOTOGRAPH LEADS, when there is one: it is the
   * most specific true picture of the thing being bought. The cover follows,
   * then the extra angles. Deduped, because a shop that sets the cover and
   * also lists it in `imageUrls` should not get the same file twice — a
   * thumbnail whose only distinguishing feature is its position is a broken
   * control.
   *
   * OTHER COLOURS' PHOTOGRAPHS ARE DELIBERATELY ABSENT. Putting them here
   * would rebuild the variant picker this file just removed, in a place with
   * no room to name what each one is.
   */
  const photos = React.useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const url of [colour.imageUrl, productCoverUrl, ...productImageUrls]) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }
    return out;
  }, [colour.imageUrl, productCoverUrl, productImageUrls]);

  /**
   * A thumbnail the shopper picked, overriding the leading photograph.
   *
   * The product AND the colour it was picked under travel with it, so moving
   * to another product — or changing colour, which re-shuffles `photos` —
   * drops the override DURING RENDER rather than in an effect that would paint
   * the wrong picture first and correct it a frame later. The membership test
   * does the same job for a `photos` list that changed shape under a stale
   * pick.
   */
  const [picked, setPicked] = React.useState<Picked | null>(null);
  const pickedUrl =
    picked &&
    picked.product === name &&
    picked.colourId === colour.id &&
    photos.includes(picked.url)
      ? picked.url
      : null;

  const shown = pickedUrl ?? photos[0] ?? null;

  /* Named for what it is a picture of. The colour's own photograph and the
     drawn spool are both pictures OF the colour; the cover and the extra
     angles are pictures of the product. */
  const ofThisColour = shown === null || shown === colour.imageUrl;
  const stageAlt = ofThisColour ? `${name}, ${colour.name}` : name;

  /* One picture is not a gallery. */
  const hasRail = photos.length > 1;

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
          src={shown}
          alt={stageAlt}
          colourHex={colour.hex}
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
      {hasRail && (
        <div className="w-full min-w-0 shrink-0 md:relative md:w-20 md:self-stretch">
          <ul
            aria-label={`Photos of ${name}`}
            className={cn(
              "flex w-full min-w-0 gap-2 overflow-x-auto pb-1",
              "md:absolute md:inset-0 md:flex-col md:overflow-x-visible md:overflow-y-auto md:pb-0",
              /* One thumbnail wide, so a scrollbar gutter would come out of the
                 thumbnail itself. The strip below md already scrolls without one. */
              "no-scrollbar",
            )}
          >
            {photos.map((url, i) => {
              const active = url === shown;
              return (
                <li key={url} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={active}
                    /* Same rule as the stage: only the colour's own photograph
                       may be named for the colour. Everything else is "photo
                       N", which is all anybody can honestly say about a file
                       the catalogue ships no caption for. */
                    aria-label={
                      url === colour.imageUrl
                        ? `${name}, ${colour.name}`
                        : `${name}, photo ${i + 1}`
                    }
                    onClick={() => setPicked({ product: name, colourId: colour.id, url })}
                    className={cn(
                      THUMB,
                      active ? "border-brand" : "border-brand-line hover:border-foreground",
                    )}
                  >
                    <ProductPhoto
                      src={url}
                      /* Decorative: the button already carries the name. */
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
      )}
    </div>
  );
}

/** A chosen thumbnail, with the product and colour it was chosen under. */
interface Picked {
  product: string;
  colourId: string;
  url: string;
}

const THUMB = cn(
  "block h-16 w-16 rounded-lg border bg-background p-1 transition-colors motion-reduce:transition-none md:h-20 md:w-20",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);
