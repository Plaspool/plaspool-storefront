"use client";

import * as React from "react";
import { Button } from "@plaspool/ui";
import { pointsLabel, spendablePoints } from "../data/points-api";
import type { PointsBalance } from "../data/points-api";

/**
 * The offer to spend a points balance at checkout.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT RENDERS NOTHING UNLESS THERE IS SOMETHING TO OFFER, and "nothing" covers
 * more cases than it looks: a guest, a shop with redemption switched off, an
 * empty wallet, a balance under the programme's own minimum, and a points
 * service that is simply down — `getPointsBalance()` answers null for the last
 * of those, and `spendablePoints()` folds all of them into one zero.
 *
 * That is why this component takes the balance rather than fetching it: a
 * checkout step must not gain a loading state, an error state and a retry for a
 * line that is absent from almost every order.
 *
 * SPENDING IS OPT-IN AND STARTS AT ZERO. The API reads an omitted amount as "as
 * much as the rules allow", so a widget that pre-filled the maximum — or
 * defaulted the toggle to on — would spend a balance the customer never agreed
 * to spend, on a shop that takes real money. The customer asks, or nothing
 * happens.
 *
 * NO POINTS NOUN IS SPELLED HERE. Every word for the programme comes from the
 * API, the rule `data/marketing.ts` sets out at length. When the label is absent
 * this renders nothing at all rather than falling back to an English word an
 * operator never chose — a bare number with no noun is not a smaller version of
 * the feature, it is an unreadable one.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE NUMBER IS A REQUEST, NOT AN INSTRUCTION. The API re-decides it at the
 * freeze against the balance at that instant and against a cap that is a share
 * of the order — a figure this component cannot know, because the total is not
 * final until the freeze computes it. So the copy promises a discount will be
 * applied, never a specific amount, and the review step shows what was actually
 * granted.
 */
export function PointsOffer({
  balance,
  chosen,
  onChange,
  disabled,
}: {
  balance: PointsBalance | null;
  chosen: number;
  onChange: (points: number) => void;
  disabled?: boolean;
}) {
  const available = spendablePoints(balance);
  const label = pointsLabel(balance, available);

  // Both conditions, not just the first: a balance with no configured noun is
  // as unrenderable as no balance at all. See the header.
  if (available <= 0 || !label) return null;

  const spending = chosen > 0;

  return (
    <div className="border-2 border-foreground bg-brand-soft px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Your balance</p>
          <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {available.toLocaleString()} {label}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          /*
           * A BUTTON, NOT A CHECKBOX OR A SLIDER, and the whole balance rather
           * than an amount to type.
           *
           * The API's cap is a share of the ORDER, so the largest spendable
           * figure is not knowable here — a free-entry field would invite a
           * number that gets silently clamped, and the customer would read the
           * difference as the shop taking their points and not honouring them.
           * "Spend it" asks for as much as the rules allow, the freeze decides
           * how much that is, and the review step shows the answer before
           * anybody pays.
           */
          onClick={() => onChange(spending ? 0 : available)}
          className="shrink-0"
        >
          {spending ? "Don't spend" : "Spend it"}
        </Button>
      </div>
      {spending && (
        <p className="mt-2 text-xs text-muted-foreground">
          {/*
            * DELIBERATELY NOT A NAIRA FIGURE. What the points are worth depends
            * on the order's own total, and quoting a number here that the freeze
            * then adjusts is how a customer decides the shop is lying to them.
            * The next screen carries the real one.
            */}
          Your discount is applied on the next screen, before you pay.
        </p>
      )}
    </div>
  );
}
