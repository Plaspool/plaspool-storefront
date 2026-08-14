"use client";

import { cn } from "@plaspool/ui";

import type { Colour } from "../data/types";
import { SpoolImage } from "../components/spool-image";

/**
 * The product image, twice: the main spool at the selected colour, and one
 * thumbnail per colour the product carries.
 *
 * Not a carousel. There is one image per colour and nothing else, so the
 * gallery and the colour picker are the same control expressed twice —
 * picking a thumbnail is picking a colour, which is what makes changing
 * colour feel like looking at the product rather than editing a form.
 *
 * The re-tint itself lives on `SpoolImage`'s winding paths. Nothing here
 * animates: `colourHex` changes and the spool eases to it, or snaps under
 * `prefers-reduced-motion`.
 */

export interface GalleryProps {
  name: string;
  colours: Colour[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Drives the fill level of the drawn spool — the selected size's weight. */
  weightGrams: number;
  className?: string;
}

export function Gallery({
  name,
  colours,
  selectedId,
  onSelect,
  weightGrams,
  className,
}: GalleryProps) {
  const selected = colours.find((colour) => colour.id === selectedId) ?? colours[0];

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-4 md:flex-row-reverse", className)}>
      {/* SpoolImage fills its flange and bore with the page background, so it
          stays on the background surface and never on a tinted one. */}
      <div className="min-w-0 flex-1 rounded-xl border border-brand-line bg-background p-4 sm:p-8">
        <SpoolImage
          colourHex={selected.hex}
          weightGrams={weightGrams}
          label={`${name}, ${selected.name}`}
          className="mx-auto max-w-md"
        />
      </div>

      {/* A strip below md, a column at md and up. The strip scrolls inside
          itself at 375 px rather than widening the page. */}
      <ul
        aria-label="Colours"
        className={cn(
          "flex w-full min-w-0 shrink-0 gap-2 overflow-x-auto pb-1",
          "md:w-20 md:flex-col md:overflow-x-visible md:overflow-y-auto md:pb-0",
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
                <SpoolImage
                  colourHex={colour.hex}
                  weightGrams={weightGrams}
                  label=""
                  className="h-full w-full"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
