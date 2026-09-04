"use client";

import * as React from "react";
import { Button } from "@plaspool/ui";
import { pointsLabel, spendablePoints } from "../data/points-api";
import type { Adjustment } from "../data/checkout-api";
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
 * final until the freeze computes it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SO IT IS TOLD WHAT THE FREEZE GRANTED, AND THAT IS THE WHOLE POINT OF
 * `granted`.
 *
 * This panel used to read its own state off `chosen` alone — the shopper's
 * REQUEST — and say "Your discount is applied on the next screen, before you
 * pay." Both halves of that were wrong at once.
 *
 * The screen was wrong: that sentence was written when points were asked for on
 * a step BEFORE the total existed. Checkout was compressed to two steps and
 * this widget moved beside the total it moves, so "the next screen" became
 * Paystack — the shopper is already on step 2 of 2.
 *
 * The promise was wrong: `quote()` answers `null` — a 200 with NO adjustment —
 * for several ordinary reasons this component cannot see. Redemption switched
 * off since the balance was read, the programme's currency not matching the
 * cart's, or the commonest one by far: `max_redeem_bps` is a share of the
 * ORDER, so on a small order the affordable points fall below the shop's own
 * `min_redeem_points` and the quote declines outright. Every one of those came
 * back looking exactly like success — the button flipped to "Don't spend", the
 * total did not move, and the panel promised a discount that was never coming.
 *
 * A DECLINE MUST READ AS A DECLINE. `granted` is the redemption adjustment the
 * freeze actually returned, so the outcome line states what happened rather
 * than what was asked for.
 *
 * THE BUTTON STILL FOLLOWS `chosen`, NOT `granted`, and that is deliberate:
 * it is the shopper's own switch and it has to keep offering the way back out
 * of a choice they made, whatever the server did with it. Intent drives the
 * control; outcome drives the words.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function PointsOffer({
  balance,
  chosen,
  granted,
  onChange,
  disabled,
}: {
  balance: PointsBalance | null;
  chosen: number;
  /**
   * The redemption adjustment the last freeze actually returned, or null when
   * it granted nothing. See the header — this is the outcome, and `chosen` is
   * only the request.
   *
   * Safe to read straight from the frozen totals: the review step renders this
   * panel inside its `totals &&` branch, and a thaw nulls the totals, so a
   * repricing in flight replaces the whole block with its skeleton rather than
   * showing this one against a stale answer.
   */
  granted: Adjustment | null;
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
      {/*
        * STILL NOT A NAIRA FIGURE, and now for a better reason than before.
        * The granted amount is already a line in the totals panel directly
        * above this one, rendered from the API's own label — repeating it here
        * would be the same number in two places, which is the arrangement that
        * eventually disagrees with itself. This line says WHERE the answer is,
        * not what it is.
        */}
      {spending && granted && (
        <p className="mt-2 text-xs text-muted-foreground">
          Applied — see your total above.
        </p>
      )}
      {/*
        * NO REASON GIVEN, DELIBERATELY. The rules that produced this decline
        * live in the API — the rate, the minimum, and a cap that is a share of
        * the order — and `points-api.ts` already sets out why this package must
        * not re-implement a money rule to explain one. Guessing "your order is
        * too small" would be a second implementation of the cap, and wrong the
        * day an operator changes it. What is certainly true is that nothing was
        * taken, and that is the half the shopper is actually worried about.
        */}
      {spending && !granted && (
        <p className="mt-2 text-xs text-muted-foreground">
          These {label.toLowerCase()} couldn&apos;t be applied to this order.
          Nothing has been spent.
        </p>
      )}
    </div>
  );
}
