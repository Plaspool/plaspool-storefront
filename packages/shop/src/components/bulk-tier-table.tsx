import { cn } from "@plaspool/ui";

import type { BulkTier } from "../data/types";
import { percentFromBps } from "../data/bulk";
import { savingsFor, tierFor, unitPriceFor } from "../data/money";
import { formatMinor } from "../data/format-money";
import type { CurrencyCode } from "../data/currency-config";

/**
 * The quantity ladder. Hairline rules and no card chrome, per the design
 * system: this is a datasheet, not a widget.
 *
 * ═══ QUANTITY IS SUMMED PER PRODUCT, ACROSS VARIANTS ═══
 * This table used to say tiers applied per line. They do not: the API totals
 * every line of the same product, so three black spools plus two white is five
 * and both lines take the 5-rung. The `quantity` handed in here is the buy
 * box's, so this is a PROJECTION of what N would earn — a basket already
 * holding some of this product reaches a rung sooner than the table implies,
 * never later, so the figures below are a floor rather than a promise.
 */

const CELL = "px-2 py-2.5 align-middle";
const HEAD = "px-2 pb-2 text-xs font-semibold text-muted-foreground";

export interface BulkTierTableProps {
  tiers: BulkTier[];
  /** Unit price before any tier applies. */
  /** MINOR UNITS, in `currency`. The rungs are basis points off this, and
   *  taking a percentage off a figure already rounded to a whole unit throws
   *  away a hundredth of the precision the server keeps. */
  basePrice: number;
  /** What `basePrice` is denominated in. No default — see `Price`. */
  currency: CurrencyCode;
  /** The quantity in the buy box. Highlights the rung it has reached and
   *  totals the saving beneath. */
  quantity?: number;
}

export function BulkTierTable({ tiers, basePrice, currency, quantity }: BulkTierTableProps) {
  if (tiers.length === 0) return null;

  const reached = quantity === undefined ? null : tierFor(tiers, quantity);
  const savings = quantity === undefined ? 0 : savingsFor(basePrice, tiers, quantity);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[15rem] border-collapse text-sm">
          <caption className="sr-only">Unit price by quantity</caption>
          <thead>
            <tr className="border-b border-brand-line">
              <th scope="col" className={cn(HEAD, "text-left")}>
                Quantity
              </th>
              <th scope="col" className={cn(HEAD, "text-right")}>
                Discount
              </th>
              <th scope="col" className={cn(HEAD, "text-right")}>
                Unit price
              </th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier) => {
              const active = reached?.minQty === tier.minQty;
              return (
                <tr
                  key={tier.minQty}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "border-b border-brand-line last:border-b-0",
                    active && "bg-brand-soft",
                  )}
                >
                  <th
                    scope="row"
                    className={cn(CELL, "text-left font-mono font-normal tabular-nums text-foreground")}
                  >
                    {tier.minQty}+
                    {active && <span className="sr-only"> — your quantity</span>}
                  </th>
                  <td className={cn(CELL, "text-right font-mono tabular-nums text-muted-foreground")}>
                    {/* U+2212, not a hyphen: it is a minus sign. */}
                    −{percentFromBps(tier.percentBps)}%
                  </td>
                  <td className={cn(CELL, "text-right font-mono font-bold tabular-nums text-foreground")}>
                    {formatMinor(unitPriceFor(basePrice, tiers, tier.minQty), currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {savings > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          You save{" "}
          <span className="font-mono font-bold tabular-nums text-foreground">
            {formatMinor(savings, currency)}
          </span>
        </p>
      )}
    </div>
  );
}
