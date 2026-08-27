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
  /**
   * What a unit costs once a BULK RUNG applies, and the quantity that earns it.
   *
   * ═══ A THIRD NUMBER, BECAUSE TWO CANNOT SAY THIS HONESTLY ═══
   * A spool can be on sale AND on a rung at once, and the two discounts have
   * different causes: the sale is the shop's, the rung is the shopper's for
   * buying five. The buy box used to pass the bulk figure as `amount` and the
   * list price as `compareAt`, which struck ₦24,000 against ₦18,000 and read as
   * a 25% sale when the sale was 17%.
   *
   * So `amount` stays the LIVE price, `compareAt` stays the reference it is
   * reduced from, and the rung is stated separately with the quantity that
   * earns it — which is also the API's own rule: the bulk percentage comes off
   * the live price, never off `compareAtMinor`.
   *
   * Rendered only when it actually beats `amount`; a rung that saves nothing is
   * not worth a line.
   */
  bulkAmount?: number | null;
  bulkQty?: number | null;
  size?: "sm" | "md" | "lg";
  /** Prefixes a sans "From" — for cards, where the figure is the cheapest
   *  size rather than the price of a specific thing. */
  from?: boolean;
  className?: string;
  /**
   * Extra classes for the figure itself.
   *
   * `className` lands on the wrapper, and the figure sets its own size from
   * `size`, so a type-scale override passed to the wrapper never reaches it —
   * the child's own class wins regardless of specificity games. This is the
   * hook for a caller that needs the figure to be responsive, which `size`
   * cannot express: the sticky buy bar wants `text-sm` at 320px and
   * `text-base` from `sm` up. Merged last, so it beats `size`.
   */
  amountClassName?: string;
}

export function Price({
  amount,
  compareAt = null,
  bulkAmount = null,
  bulkQty = null,
  size = "md",
  from = false,
  className,
  amountClassName,
}: PriceProps) {
  const showCompare = typeof compareAt === "number" && compareAt > amount;
  const showBulk =
    typeof bulkAmount === "number" &&
    typeof bulkQty === "number" &&
    bulkQty > 0 &&
    bulkAmount < amount;

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5", className)}>
      {from && (
        <span className={cn("font-sans text-muted-foreground", SECONDARY[size])}>From</span>
      )}
      <span
        className={cn(
          "font-mono font-bold tabular-nums text-foreground",
          AMOUNT[size],
          amountClassName,
        )}
      >
        {formatNaira(amount)}
      </span>
      {showCompare && (
        <s className={cn("font-mono tabular-nums text-muted-foreground", SECONDARY[size])}>
          <span className="sr-only">Was </span>
          {formatNaira(compareAt)}
        </s>
      )}
      {showBulk && (
        /* NOT STRUCK, and not inside the `<s>` above: this price is not one the
           shopper has stopped paying, it is one they can reach. */
        <span className={cn("font-sans text-muted-foreground", SECONDARY[size])}>
          buy{" "}
          <span className="font-mono tabular-nums">{bulkQty}</span> for{" "}
          <span className="font-mono font-semibold tabular-nums text-brand">
            {formatNaira(bulkAmount)}
          </span>{" "}
          each
        </span>
      )}
    </span>
  );
}
