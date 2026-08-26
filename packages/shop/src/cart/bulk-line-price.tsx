import { Badge } from "@plaspool/ui";

import { percentFromBps } from "../data/bulk";
import { formatNaira } from "../data/money";

/**
 * The unit price of a cart line, and why it is what it is.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE NUMBERS ARE THE SERVER'S. THE SENTENCE IS OURS, AND IT IS THE PART THAT
 * CAN LIE.
 *
 * `bulkQty` IS NOT `lineQty`. The rung is chosen on the total across every line
 * of the same product, so a row reading "2 × black — 10% off" is inexplicable
 * on its own: the five that earned it are two black and three white. Printing
 * the percentage without that number leaves the shopper unable to check the
 * arithmetic on their own basket.
 *
 * When the two ARE equal there is nothing to reconcile, and the explanation is
 * dropped rather than stating a quantity already printed on the row.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export interface BulkLinePriceProps {
  /** The list price per unit. Struck through when a rung applied. */
  unitPrice: number;
  /** What they actually pay per unit. */
  effectiveUnitPrice: number;
  /** The rung, in basis points. `0` renders as an ordinary undiscounted line. */
  bulkPercentBps: number;
  /** Units of this PRODUCT across every line — what earned the rung. */
  bulkQty: number;
  /** This row's own quantity, for deciding whether the two need reconciling. */
  lineQty: number;
  className?: string;
}

export function BulkLinePrice({
  unitPrice,
  effectiveUnitPrice,
  bulkPercentBps,
  bulkQty,
  lineQty,
  className,
}: BulkLinePriceProps) {
  const discounted = bulkPercentBps > 0;

  if (!discounted) {
    return (
      <div className={className}>
        <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
          {formatNaira(unitPrice)}
        </span>{" "}
        <span className="whitespace-nowrap font-sans text-xs text-muted-foreground">each</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className="gap-1 whitespace-nowrap border-transparent bg-brand-soft px-1.5 py-0 text-[11px] font-semibold text-brand"
        >
          {/* U+2212, not a hyphen: it is a minus sign. */}
          <span className="font-mono tabular-nums">−{percentFromBps(bulkPercentBps)}%</span>
          <span className="font-sans">bulk</span>
        </Badge>

        {/* `<s>` rather than a line-through class: this is a price that no
            longer applies, which is what the element means, and a screen reader
            should not read the two numbers as though both were being charged. */}
        <s className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
          {formatNaira(unitPrice)}
        </s>
        <span className="whitespace-nowrap font-mono text-xs font-bold tabular-nums text-foreground">
          {formatNaira(effectiveUnitPrice)}
        </span>
        <span className="whitespace-nowrap font-sans text-xs text-muted-foreground">each</span>
      </div>

      {bulkQty !== lineQty && (
        <p className="mt-1 font-sans text-xs text-muted-foreground">
          You&rsquo;re buying{" "}
          <span className="font-mono tabular-nums">{bulkQty}</span> of this product
        </p>
      )}
    </div>
  );
}
