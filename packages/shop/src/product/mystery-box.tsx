import * as React from "react";
import { Gift } from "lucide-react";
import { cn } from "@plaspool/ui";

import type { SizeOption } from "../data/types";
import { boxCountLine, boxItemCountOf } from "../data/mystery-box";

/**
 * The mystery-box pieces of the product page, PRESENTATIONAL AND PROP-DRIVEN.
 *
 * Extracted from `buy-box.tsx` for the reason `returns/return-intro.tsx` gives:
 * the buy box is a client component full of cart hooks, and this suite runs in
 * node through `renderToStaticMarkup`. Everything here is the part a shopper
 * reads, so it is the part that has to be assertable.
 */

/**
 * "Mystery box", near the title. NOT SUBTLE ON PURPOSE — it is the one thing
 * that tells a shopper the contents are a surprise before they pay.
 */
export function MysteryBoxLabel({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 border-2 border-foreground bg-brand-soft px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-foreground",
        className,
      )}
    >
      <Gift aria-hidden="true" className="h-3.5 w-3.5 text-brand" />
      Mystery box
    </p>
  );
}

/** Three plain sentences, no numbered markers. */
export const BOX_HOW_IT_WORKS = [
  /* True for all three of the owner's filling modes — hand-packed, packed
     ahead, or picked automatically — so it says neither who packs nor when. */
  "Pick a size. Every box is made up of items we have in stock.",
  "You won't know what's inside until it arrives.",
  "Once it's delivered, your order page lists everything that was in the box.",
] as const;

export function BoxHowItWorks({ className }: { className?: string }) {
  const headingId = React.useId();
  return (
    <section aria-labelledby={headingId} className={cn("border-t border-brand-line pt-5", className)}>
      <h2 id={headingId} className="text-sm font-semibold text-foreground">
        How it works
      </h2>
      <div className="mt-2 flex flex-col gap-1 text-sm leading-6 text-muted-foreground">
        {BOX_HOW_IT_WORKS.map((sentence) => (
          <p key={sentence}>{sentence}</p>
        ))}
      </div>
    </section>
  );
}

export interface BoxSizeChoice {
  size: SizeOption;
  /** False for a sold-out size, and for one whose pool is not set up. */
  sellable: boolean;
}

/**
 * The box sizes. Labels render exactly as the owner wrote them.
 *
 * A SOLD-OUT SIZE KEEPS ITS LABEL and is disabled rather than hidden: the
 * shopper can see the size exists and that it is gone, which is more honest
 * than a picker that silently shrinks. "Sold out" is spelled beside it, so the
 * state is never carried by colour alone.
 */
export function BoxSizePicker({
  choices,
  selectedId,
  onSelect,
  className,
}: {
  choices: BoxSizeChoice[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const labelId = React.useId();
  const selected = choices.find((c) => c.size.id === selectedId) ?? null;
  const countLine = selected && selected.sellable ? boxCountLine(selected.size) : null;
  return (
    <div className={className}>
      <p id={labelId} className="text-sm font-semibold text-foreground">
        Box size
      </p>
      <div role="group" aria-labelledby={labelId} className="mt-2 flex flex-wrap gap-2">
        {choices.map(({ size, sellable }) => {
          const active = sellable && size.id === selectedId;
          return (
            <button
              key={size.id}
              type="button"
              aria-pressed={active}
              disabled={!sellable}
              onClick={() => onSelect(size.id)}
              className={cn(
                "inline-flex items-baseline gap-2 rounded-lg border px-3 py-2 transition-colors motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                !sellable
                  ? "cursor-not-allowed border-dashed border-brand-line text-muted-foreground"
                  : active
                    ? "border-brand bg-brand-soft text-foreground"
                    : "border-brand-line text-muted-foreground hover:border-foreground hover:text-foreground",
              )}
            >
              <span className={cn("text-sm", !sellable && "line-through")}>{size.label}</span>
              {!sellable && (
                <span className="text-xs">
                  {/* A size with no count has no pool behind it yet: it was never
                      for sale, so "sold out" would be a claim about demand. */}
                  {boxItemCountOf(size) === null ? "Unavailable" : "Sold out"}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {countLine && <p className="mt-1.5 text-sm text-muted-foreground">{countLine}</p>}
    </div>
  );
}
