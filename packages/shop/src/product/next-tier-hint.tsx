import { nextTierFor, percentFromBps, unitsToNextTier } from "../data/bulk";
import type { BulkTier } from "../data/types";

/**
 * "Add 2 more spools to save 10%" — the nudge under the quantity stepper.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * COMPUTED FROM `bulkTiers` ALONE, NEVER FROM A REQUEST. The rung a quantity
 * would earn is a property of the ladder the page already holds; asking the API
 * as the stepper moves would be a round trip per key press to answer a question
 * already in memory.
 *
 * IT IS A PROJECTION, AND THE WORDING IS CHOSEN TO SURVIVE BEING ONE. Quantity
 * is summed per PRODUCT across variants, so a basket already holding two of
 * this spool in another colour reaches the rung sooner than this says — never
 * later. "Add N more" therefore promises a floor: the shopper cannot be
 * disappointed by the till, only pleasantly surprised.
 *
 * NOTHING TO OFFER IS NOTHING TO SAY: no ladder, or already on the top rung,
 * renders nothing rather than an empty line under the stepper.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function NextTierHint({
  tiers,
  quantity,
  className,
}: {
  tiers: BulkTier[];
  quantity: number;
  className?: string;
}) {
  const next = nextTierFor(tiers, quantity);
  if (!next) return null;

  const more = unitsToNextTier(tiers, quantity);
  if (more <= 0) return null;

  return (
    <p className={className}>
      <span className="font-sans text-sm text-muted-foreground">
        Add <span className="font-mono font-semibold tabular-nums text-foreground">{more}</span> more{" "}
        {more === 1 ? "spool" : "spools"} to save{" "}
        <span className="font-mono font-semibold tabular-nums text-brand">
          {percentFromBps(next.percentBps)}%
        </span>
      </span>
    </p>
  );
}
