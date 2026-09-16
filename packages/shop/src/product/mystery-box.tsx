import * as React from "react";
import { Gift } from "lucide-react";
import { cn } from "@plaspool/ui";

import { boxCountLine } from "../data/mystery-box";
import type { BoxCue } from "../data/mystery-box";

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

/**
 * "How it works", in the owner's words from Settings → Mystery box.
 *
 * THE STOREFRONT OWNS NONE OF THESE SENTENCES. The hard-coded copy this
 * replaced still told shoppers to "pick a size" after the box lost its sizes;
 * the admin is where the words live now. No steps renders nothing at all.
 */
export function BoxHowItWorks({
  title,
  steps,
  className,
}: {
  title: string;
  steps: readonly string[];
  className?: string;
}) {
  const headingId = React.useId();
  if (steps.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className={cn("border-t border-brand-line pt-5", className)}>
      <h2 id={headingId} className="text-sm font-semibold text-foreground">
        {title}
      </h2>
      <div className="mt-2 flex flex-col gap-1 text-sm leading-6 text-muted-foreground">
        {steps.map((step, index) => (
          <p key={index}>{step}</p>
        ))}
      </div>
    </section>
  );
}

export interface BoxSizeChoice {
  /** The owner's name for this size, or null for the single unnamed one. */
  label: string | null;
  /** The catalogue size it selects, whose id is this button's value. */
  id: string;
  /** False when this size cannot be filled, or has no item count set up. */
  sellable: boolean;
}

/**
 * The box's sizes, in the owner's order.
 *
 * A SOLD-OUT SIZE STAYS VISIBLE, named and unselectable, so a shopper can see
 * the size exists and that it is gone. "Sold out" is spelled beside it, never
 * carried by colour alone. Nothing here decides sold-out-ness — see
 * `boxSizeSellable`; nothing here reorders, either.
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
  if (choices.length === 0) return null;
  return (
    <div className={className}>
      <p id={labelId} className="text-sm font-semibold text-foreground">
        Size
      </p>
      <div role="group" aria-labelledby={labelId} className="mt-2 flex flex-wrap gap-2">
        {choices.map(({ id, label, sellable }) => {
          const active = id === selectedId;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              disabled={!sellable}
              onClick={() => onSelect(id)}
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
              <span className={cn("text-sm", !sellable && "line-through")}>{label}</span>
              {!sellable && <span className="text-xs">Sold out</span>}
            </button>
          );
        })}
      </div>
    </div>
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
  size: { boxItemCount?: number | null; itemCount?: number | null };
  className?: string;
}) {
  const line = boxCountLine(size);
  if (!line) return null;
  return <p className={cn("text-sm font-medium text-foreground", className)}>{line}</p>;
}

/**
 * Cues the admin resolved, printed as sent and in the order sent.
 *
 * THE STOREFRONT OWNS NO CUE LOGIC: no thresholds, no "N left" arithmetic, no
 * time formatting. `kind` picks a style and nothing else, and an unknown kind
 * from a newer API is a plain line, never dropped. No cues renders nothing, not
 * an empty container.
 */
export function BoxCues({ cues, className }: { cues: readonly BoxCue[]; className?: string }) {
  if (cues.length === 0) return null;
  return (
    <ul className={cn("flex flex-col gap-1", className)}>
      {cues.map((cue, index) => (
        <li key={index} data-cue={cue.kind || "other"} className={CUE_STYLE[cue.kind] ?? CUE_PLAIN}>
          {cue.text}
        </li>
      ))}
    </ul>
  );
}

const CUE_PLAIN = "text-sm text-muted-foreground";

/** Styling by kind. `low_stock` is the most urgent of the lines under the price. */
const CUE_STYLE: Record<string, string> = {
  just_dropped:
    "inline-flex w-fit border border-foreground px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-foreground",
  low_stock: "text-sm font-semibold text-foreground",
  selling_fast: "text-sm font-medium text-foreground",
  sold_out: "text-sm text-foreground",
};

/** Which cues go where on the buy box. Order within each place is kept. */
export function placeBoxCues(cues: readonly BoxCue[]): { badge: BoxCue[]; price: BoxCue[]; soldOut: BoxCue[] } {
  return {
    badge: cues.filter((cue) => cue.kind === "just_dropped"),
    soldOut: cues.filter((cue) => cue.kind === "sold_out"),
    price: cues.filter((cue) => cue.kind !== "just_dropped" && cue.kind !== "sold_out"),
  };
}
