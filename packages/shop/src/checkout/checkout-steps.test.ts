import { describe, expect, it } from "vitest";

import { STEP_LABELS, stepPosition, stepsFor } from "./checkout-steps";
import { errorCopy } from "./checkout-error-copy";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * A STEP THAT ASKS ONE QUESTION WITH ONE ANSWER IS NOT A STEP.
 *
 * The checkout was four screens. The second showed a radio group containing a
 * single filled circle — "Standard delivery, ₦3,000" — and a Continue button.
 * The third showed a signed-in customer their own email address, read back to
 * them, above another Continue button. Two of four screens existed to be
 * clicked past.
 *
 * The assertions below are about the count as much as the order: "Step 1 of 4"
 * over a flow that skips two of them is a progress indicator that overstates
 * what is left and then jumps.
 * ═══════════════════════════════════════════════════════════════════════════
 */

describe("how many steps a shopper is actually promised", () => {
  it("is two when there is one delivery option — today's shop", () => {
    expect(stepsFor(1)).toEqual(["details", "review"]);
  });

  it("is two when the server offers no option at all", () => {
    /* Nothing to pick. An address the shop cannot reach was already refused by
       `PUT /checkout/addresses`, long before this is asked. */
    expect(stepsFor(0)).toEqual(["details", "review"]);
  });

  it("is three only when the choice is real", () => {
    expect(stepsFor(2)).toEqual(["details", "delivery", "review"]);
    expect(stepsFor(5)).toEqual(["details", "delivery", "review"]);
  });

  it("never promises a step it will not show", () => {
    /* THE BUG THIS PREVENTS: a constant STEP_ORDER of four, with the flow
       skipping two of them. The header said "1 of 4", then jumped to "4 of 4". */
    for (const count of [0, 1, 2, 3]) {
      const steps = stepsFor(count);
      expect(steps).toContain("details");
      expect(steps).toContain("review");
      expect(steps.includes("delivery")).toBe(count > 1);
    }
  });
});

describe("the position shown in the header", () => {
  it("counts from one, over the steps this checkout has", () => {
    const two = stepsFor(1);
    expect(stepPosition("details", two)).toBe(1);
    expect(stepPosition("review", two)).toBe(2);

    const three = stepsFor(3);
    expect(stepPosition("details", three)).toBe(1);
    expect(stepPosition("delivery", three)).toBe(2);
    expect(stepPosition("review", three)).toBe(3);
  });

  it("puts review LAST in every shape, because it is where paying happens", () => {
    for (const count of [0, 1, 2, 9]) {
      for (const asks of [0, 1, 2]) {
        const steps = stepsFor(count, asks);
        expect(steps[steps.length - 1]).toBe("review");
      }
    }
  });

  it("counts the extras step in N of M, on every viewport", () => {
    /* The sheet is how the step is DRAWN on a phone, not a different flow —
       so the header over a four-step checkout counts the extras step whether
       that step is a page or a bottom sheet. It is FIRST now: the question is
       about the parcel, not the payment, and asking it last interrupts
       somebody who has filled in an address and is reaching for their card. */
    const four = stepsFor(2, 1);
    expect(stepPosition("extras", four)).toBe(1);
    expect(stepPosition("details", four)).toBe(2);
    expect(stepPosition("review", four)).toBe(4);
  });

  it("has a label for every step it can produce", () => {
    for (const count of [0, 1, 2]) {
      for (const asks of [0, 1]) {
        for (const step of stepsFor(count, asks)) {
          expect(STEP_LABELS[step]).toBeTruthy();
        }
      }
    }
  });
});

/**
 * ═══ THE EXTRAS STEP, WHICH EXISTS ONLY WHEN THERE IS A QUESTION ═══
 * The operator can attach add-ons to the checkout — packaging first — with
 * rules that either ASK the shopper or INCLUDE the add-on outright. Only the
 * asking earns a screen. An included add-on is a row on the review step, and
 * a shop with no add-ons at all is exactly today's two steps.
 */
describe("the extras step", () => {
  it("does not exist when nothing is being asked — today's shop, and every old server", () => {
    expect(stepsFor(1, 0)).toEqual(["details", "review"]);
    expect(stepsFor(1)).toEqual(["details", "review"]);
  });

  it("comes first when one add-on is asked about", () => {
    expect(stepsFor(1, 1)).toEqual(["extras", "details", "review"]);
  });

  it("still comes first when there is a delivery choice too", () => {
    /* It used to sit after delivery, because the offers came from
       `POST /checkout/preview` and that needs an address. `GET /cart` now
       evaluates the rules on every read, so the question can be — and is —
       asked before anything is typed. The address can still turn up a NEW
       offer, which re-enters this same step rather than adding another. */
    expect(stepsFor(2, 1)).toEqual(["extras", "details", "delivery", "review"]);
  });

  it("is one step however many add-ons stack on it", () => {
    expect(stepsFor(1, 3)).toEqual(["extras", "details", "review"]);
  });

  it("never promises the step for a count of zero or less", () => {
    for (const count of [0, -1]) {
      expect(stepsFor(1, count)).not.toContain("extras");
    }
  });

  it("leaves details first when there is nothing to ask, so the common checkout is unchanged", () => {
    /* The reorder must be invisible to a shop with no add-ons wired, which is
       every deployment until an operator configures one. */
    expect(stepsFor(1, 0)[0]).toBe("details");
    expect(stepsFor(2, 0)).toEqual(["details", "delivery", "review"]);
  });
});

/**
 * The refusal a discount code earns, which is new — the code field could not
 * exist before `POST /checkout/discount` was found, and `discount_rejected`
 * would otherwise have fallen through to `unknown` ("That didn't go through.
 * Try again.") for a code that will be refused identically every time.
 */
describe("a discount code the shop will not take", () => {
  it("says the code is not recognised, when that is what the API said", () => {
    const copy = errorCopy({ code: "discount_rejected", reason: "not_found" });
    expect(copy.title).toBe("That code isn't recognised");
    expect(copy.body).toMatch(/spelling/i);
  });

  it("never prints an API enum it does not recognise at a shopper", () => {
    /* `reason` is the admin's own vocabulary and it will grow — expiry,
       minimum spend, per-customer limits. "Discount rejected:
       min_subtotal_not_met" is worse than a sentence that promises nothing. */
    const copy = errorCopy({ code: "discount_rejected", reason: "min_subtotal_not_met" });
    expect(`${copy.title} ${copy.body}`).not.toMatch(/min_subtotal_not_met/);
    expect(copy.title).toBe("That code can't be used");
  });

  it("never tells them to try the same code again, because it cannot work", () => {
    for (const reason of ["not_found", "expired", "whatever"]) {
      expect(errorCopy({ code: "discount_rejected", reason }).body).not.toMatch(/try again/i);
    }
  });

  it("says the rest of the order is fine, because it is", () => {
    /* A refused code is not a failed checkout. The shopper can pay without it,
       and the copy has to say so or it reads as a dead end. */
    const copy = errorCopy({ code: "discount_rejected", reason: "not_found" });
    expect(copy.body).toMatch(/carry on|without it/i);
  });

  it("is not the generic unknown, which is what it used to fall through to", () => {
    expect(errorCopy({ code: "discount_rejected", reason: "not_found" })).not.toEqual(
      errorCopy({ code: "unknown", status: 409, requestId: null }),
    );
  });
});
