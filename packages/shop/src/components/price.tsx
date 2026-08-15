import { cn } from "@plaspool/ui";

import { formatNaira } from "../data/money";

/**
 * Every price in the store. Monospace and tabular per the type thesis, so a
 * column of prices lines up on the comma.
 *
 * Naira strings run wide — `From ₦34,000` is the string to lay a price slot
 * out against, never `₦0`.
 */

const AMOUNT: Record<NonNullable<PriceProps["size"]>, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
};

const SECONDARY: Record<NonNullable<PriceProps["size"]>, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export interface PriceProps {
  /** Whole Naira. */
  amount: number;
  /** The struck reference price. Rendered only when it beats `amount`. */
  compareAt?: number | null;
  size?: "sm" | "md" | "lg";
  /** Prefixes a sans "From" — for cards, where the figure is the cheapest
   *  size rather than the price of a specific thing. */
  from?: boolean;
  className?: string;
}

export function Price({
  amount,
  compareAt = null,
  size = "md",
  from = false,
  className,
}: PriceProps) {
  const showCompare = typeof compareAt === "number" && compareAt > amount;

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5", className)}>
      {from && (
        <span className={cn("font-sans text-muted-foreground", SECONDARY[size])}>From</span>
      )}
      <span className={cn("font-mono font-bold tabular-nums text-foreground", AMOUNT[size])}>
        {formatNaira(amount)}
      </span>
      {showCompare && (
        <s className={cn("font-mono tabular-nums text-muted-foreground", SECONDARY[size])}>
          <span className="sr-only">Was </span>
          {formatNaira(compareAt)}
        </s>
      )}
    </span>
  );
}
