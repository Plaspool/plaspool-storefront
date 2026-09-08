"use client";

import * as React from "react";
import { Loader2, PackageMinus, PackagePlus, X } from "lucide-react";
import { Button } from "@plaspool/ui";

import type { AddOnOffer } from "../data/cart-api";
import type { AddOnChoice } from "./add-on-offer-card";
import { INCLUDED, addOnAmountLabel, potentialSavingOf, savingAmountLabel } from "./add-ons";
import type { AddOnRow } from "./add-ons";

/**
 * The review step's two add-on pieces: the compact control that changes an
 * answer beside the total it moves, and the rows in the totals panel.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE CONTROL FOLLOWS `discount-code-field.tsx`, AND FOR THE SAME REASON.
 *
 * An answer given on the extras step is a line in a frozen total, and the
 * review step is the last place a correction has to be one click away. So
 * every `ask` add-on gets a control here — "Gift box · ₦1,500 — Remove" when
 * it is on the order, "Add Gift box · ₦1,500" when it is not — and changing
 * it goes through `reprice()` exactly as a code does: thaw, record the
 * answer, re-freeze. That is why it is disabled while anything is in flight.
 *
 * THE FIGURE BESIDE THE TITLE IS `amount` — what the rule charges, never the
 * list price — so the shopper knows what the switch costs. What it actually
 * did to the total is the row in the panel above, in the number the freeze
 * returned; the two are different questions, answered by different numbers
 * on purpose, and neither is computed here.
 *
 * ═══ THE ROWS SAY WHAT THE API FROZE ═══
 * `AddOnTotalRows` draws `addOnRowsFor`'s answer in the review panel's own
 * row idiom. The decision — title verbatim, amount or `Included` — lives in
 * `add-ons.ts` where a test can reach it, and this only draws it.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface AddOnReviewControlProps {
  offer: AddOnOffer;
  disabled?: boolean;
  onChange: (choice: AddOnChoice) => void;
}

export function AddOnReviewControl({ offer, disabled = false, onChange }: AddOnReviewControlProps) {
  /* What it costs, as the card said it — "₦1,500", "Free", or "− ₦2,000" for
     an add-on the shopper took back out. */
  const price = addOnAmountLabel(offer.amount);

  /**
   * ═══ AN `opt_out` IS ALREADY ON THE ORDER, SO ITS ROW IS NOT AN INVITATION ═══
   * The branch below reads `choice === "accepted"` as "on the order" and
   * everything else as "not on it". That is exactly wrong here: for an
   * `opt_out`, `null` and `"accepted"` are the SAME state — the box is in the
   * parcel — and only `"declined"` takes it out. Falling through would offer
   * an unanswered opt-out as "Add Packaging · Free", inviting the shopper to
   * add a thing they have already paid for.
   */
  if (offer.mode === "opt_out") {
    const saving = potentialSavingOf(offer);
    if (offer.choice === "declined") {
      return (
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <PackageMinus aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
            <span className="min-w-0 truncate text-sm text-foreground">
              {offer.title} removed · <span className="font-mono tabular-nums">{price}</span>
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange("accepted")}
            className="shrink-0 gap-1.5"
          >
            {disabled ? (
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PackagePlus aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            Put it back
          </Button>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <PackagePlus aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
          <span className="min-w-0 truncate text-sm text-foreground">
            {offer.title} · {INCLUDED}
          </span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onChange("declined")}
          className="shrink-0 gap-1.5"
        >
          {disabled ? (
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {saving > 0 ? `Send it without — save ${savingAmountLabel(saving)}` : "Send it without"}
        </Button>
      </div>
    );
  }

  if (offer.choice === "accepted") {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <PackagePlus aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
          <span className="min-w-0 truncate text-sm text-foreground">
            {offer.title} · <span className="font-mono tabular-nums">{price}</span>
          </span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onChange("declined")}
          className="shrink-0 gap-1.5"
        >
          {disabled ? (
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          Remove
        </Button>
      </div>
    );
  }

  /* Declined, or never answered — an `ask` offer the rules raised only once
     the address was in, say. Either way it is not on the order, and the
     freeze prices it as declined until this says otherwise. The same
     text-link register as "Have a discount code?": an invitation, not a
     second primary button on the screen that has the Pay button. */
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange("accepted")}
      className="self-start text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
    >
      Add {offer.title} · <span className="font-mono tabular-nums">{price}</span>
    </button>
  );
}

/** The add-on rows of the review step's totals panel, in that panel's own
 *  row idiom. See `addOnRowsFor` for what each one says. */
export function AddOnTotalRows({ rows }: { rows: AddOnRow[] }) {
  return (
    <>
      {rows.map((row) => (
        <div key={row.key} className="flex items-start justify-between gap-3 py-1">
          {/* The title is the OPERATOR'S string and can be any length, so the
              label wraps and the amount never shrinks — the same rule the
              rest of the totals panel follows. */}
          <span className="min-w-0 break-words text-sm text-muted-foreground">{row.label}</span>
          <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">{row.value}</span>
        </div>
      ))}
    </>
  );
}
