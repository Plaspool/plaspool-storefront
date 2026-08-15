import Link from "next/link";
import { cn } from "@plaspool/ui";

import { getProduct, STANDARD_TIERS } from "../data/catalog";
import { formatNaira } from "../data/money";
import { BulkTierTable } from "../components/bulk-tier-table";

/**
 * The dark band, and the page's one inverted surface. `id="bulk"` is the
 * anchor the hero's "Bulk pricing" button jumps to.
 *
 * The visual is the ladder itself — there is no illustration here and
 * deliberately no spool: `SpoolImage` fills its flanges and bore with
 * `hsl(var(--background))`, which on a navy ground would punch two pale holes
 * through the middle of it.
 *
 * `BulkTierTable` is written for the light ground it sits on everywhere else,
 * so the wrapper re-colours it by descendant selector rather than the table
 * growing an `inverted` prop for its one dark usage.
 */

/** A real catalogue price, so the ladder quotes a figure you can go and buy. */
const REFERENCE = getProduct("pla-matte");
const REFERENCE_SIZE = REFERENCE?.sizes.find((size) => size.weightGrams === 1000) ?? null;
const REFERENCE_PRICE = REFERENCE_SIZE?.priceNaira ?? 18_500;

/* Descendant overrides, so each beats the table's own single-class utilities
   on specificity without an `!important` anywhere. */
const INVERTED_TABLE = cn(
  "[&_th]:text-brand-ink [&_td]:text-brand-ink",
  "[&_thead_th]:text-brand-ink/60",
  /* The discount column recedes; the unit price is the figure the band
     exists to show, so it stays at full strength. */
  "[&_tbody_td]:text-brand-ink/70 [&_tbody_td:last-child]:text-brand-ink",
  "[&_tr]:border-brand-ink/20",
);

export function BulkPromo() {
  return (
    <section id="bulk" aria-labelledby="bulk-heading" className="bg-brand text-brand-ink">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 md:gap-14">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-brand-ink/60">
              Bulk pricing
            </p>
            <h2
              id="bulk-heading"
              className="mt-3 font-sans text-2xl font-bold leading-tight text-brand-ink sm:text-3xl"
            >
              Buy by the box
            </h2>
            <p className="mt-4 max-w-prose text-base leading-7 text-brand-ink/70">
              Print farms and service bureaus buy in tens, so the discount is on the shelf
              price rather than behind a quote — it applies to the line as you add spools to
              the cart.
            </p>
            <Link
              href="/store/all"
              className={cn(
                "mt-7 inline-flex h-11 items-center justify-center rounded-md bg-brand-ink px-6 font-sans text-sm font-medium text-brand",
                "transition-opacity hover:opacity-90 motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 focus-visible:ring-offset-brand",
              )}
            >
              Browse every spool
            </Link>
          </div>

          <div>
            <p className="text-sm text-brand-ink/70">
              Unit price on a{" "}
              <span className="font-mono tabular-nums text-brand-ink">1 kg</span> spool of PLA
              Matte, listed at{" "}
              <span className="font-mono font-bold tabular-nums text-brand-ink">
                {formatNaira(REFERENCE_PRICE)}
              </span>
              .
            </p>
            <div className={cn("mt-4", INVERTED_TABLE)}>
              <BulkTierTable tiers={STANDARD_TIERS} basePrice={REFERENCE_PRICE} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
