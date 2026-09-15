import * as React from "react";
import { Gift } from "lucide-react";
import { cn } from "@plaspool/ui";

import type { SizeOption } from "../data/types";
import { boxCountLine } from "../data/mystery-box";

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
  "Every box is made up of items we have in stock.",
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

/**
 * "3 surprise items in every box.", under the price. Renders nothing when the
 * box has no item count: it cannot be sold then, and the sold-out state says so
 * instead of a promise with no number in it.
 */
export function BoxItemCountLine({
  size,
  className,
}: {
  size: Pick<SizeOption, "boxItemCount">;
  className?: string;
}) {
  const line = boxCountLine(size);
  if (!line) return null;
  return <p className={cn("text-sm font-medium text-foreground", className)}>{line}</p>;
}

/** The sentence beside the disabled button, when the box cannot be filled. */
export function BoxSoldOutNotice({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm text-foreground", className)}>The mystery box is sold out right now.</p>
  );
}
