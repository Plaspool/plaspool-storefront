import { cn } from "@plaspool/ui";

import type { AddOnOffer } from "../data/cart-api";
import { addOnUnitLabel, potentialSavingOf, savingAmountLabel } from "../checkout/add-ons";

/**
 * "Send it without the box" — the buy box's offer to take out an add-on whose
 * cost is already inside the product price.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PRESENTATIONAL, AND DELIBERATELY SO. Props in, markup out, no hooks and no
 * client directive — the pattern `returns/return-intro.tsx` establishes and
 * explains. This suite runs `environment: "node"` with no jsdom, so a control
 * that owned its own state could not be asserted at all; the state lives in
 * `buy-section.tsx`, which owns every other choice on this page for the same
 * reason it owns colour, size and quantity.
 *
 * ═══ WHAT IT MUST NOT SAY ═══
 * An unanswered `opt_out` costs NOTHING and is already applied: the shopper
 * bought the box with the spool. So there is no "+ ₦500" here, no "not added
 * yet", and no price beside the title — the only figure on screen is what
 * ticking the box GIVES BACK. Rendering this as an ordinary add-on offer is
 * the one mistake that would charge a shopper twice in their head.
 *
 * ═══ THE FIGURE COMES FROM `unitAmount × units`, NOT `amount` ═══
 * Uniquely here, and `potentialSavingOf` carries the reasoning: before there
 * is a cart, `amount` is `0`, because zero is what keeping the box costs. The
 * saving on offer is only expressible as the multiplication. Once there IS a
 * cart, the checkout reads `amount` and the cart's answer wins — including the
 * clamp that can make it smaller than this promised.
 *
 * ═══ IT IS AN ESTIMATE, AND IT SAYS SO ═══
 * `basis: "item"` counts every item in the CART, and this page can only see
 * one product. Two filaments and three nozzles is five boxes, and the rule
 * that offers this stops at four. So the caption reads "for this order" rather
 * than naming a total the cart may not agree with — see `add-ons-api.ts`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface AddOnOptOutProps {
  offer: AddOnOffer;
  /** Ticked means "leave it out" — i.e. the shopper intends to DECLINE. */
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Set while the choice is being written to the cart, so the control cannot
   *  be pressed twice into a race it would lose. */
  busy?: boolean;
  id?: string;
  className?: string;
}

export function AddOnOptOut({
  offer,
  checked,
  onChange,
  busy = false,
  id = "add-on-opt-out",
  className,
}: AddOnOptOutProps) {
  const saving = potentialSavingOf(offer);

  /* NOTHING TO OFFER, NOTHING TO DRAW. A rule can price an `opt_out` at zero —
     packaging thrown in for free — and a checkbox promising "save ₦0" is a
     control that wastes a tap to do nothing. The same silence `offers: []`
     gets. */
  if (saving <= 0) return null;

  const arithmetic = addOnUnitLabel(offer);
  const describedBy = `${id}-detail`;

  return (
    <div
      className={cn(
        "rounded-md border border-brand-line bg-background px-4 py-3",
        busy && "opacity-70",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          disabled={busy}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={describedBy}
          /* `mt-1` rather than centring the row: the label wraps to two lines
             on a 320px screen and a vertically centred box then floats beside
             the gap between them. */
          className={cn(
            "mt-1 h-4 w-4 shrink-0 rounded-sm border-brand-line accent-brand",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="block text-sm font-medium text-foreground">
            {/* THE TITLE IS THE OPERATOR'S WORD, VERBATIM — the same rule
                `adjustment.label` lives by. The sentence around it is ours, so
                it has to work for any noun they type: "Leave out Packaging",
                "Leave out Gift wrap". Nothing here lowercases or pluralises
                what an operator wrote. */}
            Leave out {offer.title}
            <span className="whitespace-nowrap"> — save {savingAmountLabel(saving)}</span>
          </label>
          <p id={describedBy} className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {arithmetic ? `${arithmetic} · ` : null}
            Already in the price, so leaving it out takes it off this order.
          </p>
          {offer.description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{offer.description}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
