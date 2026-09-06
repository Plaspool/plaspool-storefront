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

export type Step = "details" | "delivery" | "extras" | "review";

/**
 * THE ONLY PLACE A STEP IS NAMED. `extras` is where the shop asks about the
 * add-ons the operator set up — "Gift box, ₦1,500, yes or no?" — and it is
 * called that rather than "One more thing" because two offers can stack on
 * the one page, and a heading that promises one thing over two cards is the
 * "1 Spool Points" mistake in a different font.
 */
export const STEP_LABELS: Record<Step, string> = {
  details: "Your details",
  delivery: "Delivery option",
  extras: "Extras",
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
/**
 * `askCount` IS HOW MANY ADD-ONS THE SHOP IS ASKING ABOUT, and zero is the
 * ordinary value: a server without the feature offers nothing, and so does a
 * cart the rules matched with `include` alone (that packaging is on the
 * order without a question, and shows up on the review step). The step exists
 * for `> 0` and sits between the last details/delivery step and `review`, so
 * the total is settled only after the last question is answered.
 *
 * The count is decided at the moment the shopper continues past the step
 * before it — the same moment `optionCount` becomes known — which is why both
 * are arguments rather than state this module could read.
 */
export function stepsFor(optionCount: number, askCount = 0): Step[] {
  const steps: Step[] = ["details"];
  if (optionCount > 1) steps.push("delivery");
  if (askCount > 0) steps.push("extras");
  steps.push("review");
  return steps;
}

/** One-based position for the "Step N of M" line, or 0 when the step is not
 *  part of this checkout at all (which the header never renders). */
export function stepPosition(step: Step, steps: Step[]): number {
  return steps.indexOf(step) + 1;
}
