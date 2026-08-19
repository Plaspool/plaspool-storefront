"use client";

import * as React from "react";
import { getPointsBalance, pointsLabel } from "../data/points-api";
import type { PointsBalance } from "../data/points-api";

/**
 * A signed-in customer's points balance, on their account screen.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT RENDERS NOTHING RATHER THAN RENDERING A ZERO OR AN ERROR.
 *
 * `getPointsBalance()` answers null for every failure — network, 401, a bad
 * body, the service being down — and this treats all of them the same way the
 * checkout's offer does: no line. The account screen's job is the order list,
 * and a points service having a bad day must not put a red box on it.
 *
 * A ZERO BALANCE IS ALSO NOTHING, and that is a judgement rather than an
 * oversight. "0" beside a programme name reads as a broken feature to a
 * customer who has never heard of the programme; the place that explains it is
 * the returns page, which is driven by the same configuration. A customer with
 * points sees them; a customer without sees their orders.
 *
 * NO POINTS NOUN IS SPELLED HERE. Every word comes from the API — the rule
 * `data/marketing.ts` sets out at length — and a balance whose label is absent
 * renders nothing at all, because a bare number with no noun is unreadable
 * rather than partially useful.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * NO SKELETON, DELIBERATELY, against this codebase's usual "skeletons, never
 * prose" rule. That rule is for content the page is ABOUT — here the balance is
 * a line that is absent from most accounts, so reserving height for it would
 * make every customer without points watch a placeholder resolve into nothing.
 * The order list below carries its own skeleton and is what the screen is for.
 */
export function PointsSummary() {
  const [balance, setBalance] = React.useState<PointsBalance | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void getPointsBalance().then((result) => {
      if (!cancelled) setBalance(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!balance || balance.points <= 0) return null;

  const label = pointsLabel(balance, balance.points);
  if (!label) return null;

  return (
    <div className="mt-6 border-2 border-foreground bg-brand-soft px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-sans text-xs text-muted-foreground">Your balance</p>
        <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
          {balance.points.toLocaleString()} {label}
        </p>
      </div>
      {/*
        * ONLY WHEN SPENDING IS ACTUALLY OFFERED. `redemptionEnabled` is not the
        * whole answer — the API also requires the programme's currency to match
        * the cart's, and only the freeze can check that — but promising a
        * discount that checkout would then decline to apply is worse than
        * promising nothing, so the weaker half of the test still gates the copy.
        */}
      {balance.redemptionEnabled && (
        <p className="mt-1 font-sans text-xs text-muted-foreground">
          You can put these towards your next order at checkout.
        </p>
      )}
    </div>
  );
}
