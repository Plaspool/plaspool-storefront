/**
 * Which steps this checkout has, and what they are called.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LIFTED OUT OF `checkout-flow.tsx` FOR THE REASON `checkout-error-copy.ts`
 * WAS: that file is a client component full of hooks, and this suite runs
 * `environment: "node"` with no jsdom, deliberately. Left inside it, the rule
 * deciding how many steps a shopper is promised would be the one part of the
 * checkout nothing could assert on.
 *
 * ═══ TWO STEPS, NOT FOUR ═══
 * The flow was `address -> delivery -> contact -> review`. Three of those
 * asked for one thing each, and two of them asked for nothing at all in the
 * common case:
 *
 *   - `delivery` rendered a radio group with ONE option in it. A question with
 *     a single answer is not a question.
 *   - `contact` was an email field — and for a signed-in customer not even
 *     that, just their own address read back with a Continue button under it.
 *
 * So address and email are one form, and `delivery` exists only when the
 * server offered a real choice.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type Step = "details" | "delivery" | "review";

export const STEP_LABELS: Record<Step, string> = {
  details: "Your details",
  delivery: "Delivery option",
  review: "Review and pay",
};

/**
 * The steps this checkout actually has.
 *
 * COMPUTED, NOT CONSTANT, because the count is part of what the header
 * promises. A fixed "1 of 4" over a flow that skips a step is a progress
 * indicator that lies twice: it overstates what is left, and then jumps when
 * the skipped step never arrives.
 *
 * `> 1` AND NOT `>= 1`. A single option is auto-selected on the way through,
 * so its step is never reached and must not be counted. Zero is the same:
 * there is nothing to pick, and an address the shop cannot reach was already
 * refused by `PUT /checkout/addresses` before this is asked.
 */
export function stepsFor(optionCount: number): Step[] {
  return optionCount > 1 ? ["details", "delivery", "review"] : ["details", "review"];
}

/** One-based position for the "Step N of M" line, or 0 when the step is not
 *  part of this checkout at all (which the header never renders). */
export function stepPosition(step: Step, steps: Step[]): number {
  return steps.indexOf(step) + 1;
}
