import { Link } from "../components/link";
import { cn } from "@plaspool/ui";

import { listProducts, STANDARD_TIERS } from "../data/catalog";
import { formatNaira } from "../data/money";
import { BulkTierTable } from "../components/bulk-tier-table";

/**
 * The dark band, and the page's one inverted surface.
 *
 * `id="bulk"` no longer has anything pointing at it. The hero's second CTA used
 * to jump here; it now goes to the full catalogue, because this band renders
 * nothing while the discount ladder is empty and a link to a section that does
 * not render is worse than no link. The id stays so the anchor works again the
 * moment real tiers do.
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

/**
 * A real catalogue price, so the ladder quotes a figure you can go and buy.
 *
 * THIS USED TO BE MODULE SCOPE — `getProduct("pla-matte")` evaluated once at
 * import time against a local array. Neither half of that survives a live
 * catalogue: the fetch is async, and no product is guaranteed to exist, let
 * alone that one. So the reference is resolved per render, from whatever is
 * actually on sale.
 *
 * A 1 kg SPOOL WHERE THERE IS ONE, because that is the unit the ladder is
 * quoted in and the size a bulk buyer orders. Failing that, the cheapest size in
 * the catalogue — still a figure somebody can go and buy, which is the whole
 * promise of the band.
 */
async function referencePrice(): Promise<number | null> {
  const products = await listProducts();
  const sizes = products.flatMap((product) => product.sizes);
  if (!sizes.length) return null;
  const kilo = sizes.filter((size) => size.weightGrams === 1000);
  const pool = kilo.length ? kilo : sizes;
  return pool.reduce((min, size) => (size.priceNaira < min.priceNaira ? size : min)).priceNaira;
}

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

export async function BulkPromo() {
  /*
   * NO LADDER MEANS NOTHING TO PROMOTE. `STANDARD_TIERS` is empty while the
   * shop offers no bulk discounts; rendering this band over an empty ladder
   * would advertise a scheme that does not exist, which is worse than a
   * shorter home page.
   */
  if (!STANDARD_TIERS.length) return null;

  const price = await referencePrice();
  /*
   * NOTHING TO QUOTE MEANS NOTHING TO SHOW. An empty catalogue makes this band a
   * discount ladder over a price that does not exist — the table needs a base
   * figure, and inventing one would advertise a spool nobody can buy. Rendering
   * nothing is the honest empty state, and the home page reads fine without it.
   */
  if (price === null) return null;

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
                {formatNaira(price)}
              </span>
              .
            </p>
            <div className={cn("mt-4", INVERTED_TABLE)}>
              <BulkTierTable tiers={STANDARD_TIERS} basePrice={price} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
