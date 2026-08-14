import { cn } from "@plaspool/ui";

import type { BulkTier } from "../data/types";
import { formatNaira, savingsFor, tierFor, unitPriceFor } from "../data/money";

/**
 * The quantity ladder. Hairline rules and no card chrome, per the design
 * system: this is a datasheet, not a widget.
 *
 * Tiers apply per line, which is what `unitPriceFor` already assumes — two
 * lines of four spools do not combine into a tier of eight.
 */

const CELL = "px-2 py-2.5 align-middle";
const HEAD = "px-2 pb-2 text-xs font-semibold text-muted-foreground";

export interface BulkTierTableProps {
  tiers: BulkTier[];
  /** Unit price before any tier applies. */
  basePrice: number;
  /** The quantity in the buy box. Highlights the rung it has reached and
   *  totals the saving beneath. */
  quantity?: number;
}

export function BulkTierTable({ tiers, basePrice, quantity }: BulkTierTableProps) {
  if (tiers.length === 0) return null;

  const reached = quantity === undefined ? null : tierFor(tiers, quantity);
  const savings = quantity === undefined ? 0 : savingsFor(basePrice, tiers, quantity);
  /* Below the first rung there is no saving to report, so the table says what
     would earn one instead of showing a dead state. */
  const nextTier = tiers[0];
  const showNudge = quantity !== undefined && reached === null && quantity < nextTier.minQty;

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
                    −{tier.discountPct}%
                  </td>
                  <td className={cn(CELL, "text-right font-mono font-bold tabular-nums text-foreground")}>
                    {formatNaira(unitPriceFor(basePrice, tiers, tier.minQty))}
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
            {formatNaira(savings)}
          </span>
        </p>
      )}

      {showNudge && (
        <p className="mt-3 text-sm text-muted-foreground">
          Buy{" "}
          <span className="font-mono tabular-nums text-foreground">{nextTier.minQty}</span> or more
          to save{" "}
          <span className="font-mono tabular-nums text-foreground">{nextTier.discountPct}%</span>
        </p>
      )}
    </div>
  );
}
