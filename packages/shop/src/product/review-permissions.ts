import type { ProductEligibility } from "../data/reviews";
import type { ShopSession } from "../data/auth-api";

/**
 * Who may do what with the reviews on one product.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO DECISIONS, ONE ANSWER, AND ONE FILE. `reviewEligibility()` returns
 * `canReview` and `hasReviewed` together in a single response, and three
 * different surfaces on the product page branch on them: the review form, the
 * reply control and the vote buttons. They live here rather than in any one of
 * those components so that the two that are not the form do not have to import
 * from `review-form-gate.tsx` — a dependency that would point the wrong way and
 * read as though voting were part of writing a review.
 *
 * ═══ THE RULE BOTH FUNCTIONS SHARE: AN ABSENT ANSWER IS NOT A REFUSAL ═══
 * `reviewEligibility()` answers `{}` for an endpoint it could not read — a
 * network failure, a CORS refusal, a bad gateway, a shape it did not expect.
 * Both functions fall through to the PERMISSIVE answer when the slug is missing
 * from the map, and that is a deliberate stance rather than defensive habit.
 *
 * The cost of being wrong is asymmetric. Fail open offers a control the API
 * then refuses: one wasted attempt, and the copy on that refusal now explains
 * it. Fail closed strips reviewing, replying and voting from every product in
 * the shop the moment the reviews service has a bad minute — silently, with
 * nothing on the page to say why.
 *
 * The server is the authority either way; it enforces both rules itself and
 * refuses a duplicate with `403 already_reviewed` and a non-buyer with
 * `403 purchase_required`. Nothing here is a security boundary. It exists to
 * keep somebody from typing a review that was never going to be accepted.
 *
 * The cost of being wrong is asymmetric and points the same way: fail-open
 * offers a control the API then refuses — one wasted attempt, with copy that
 * explains it. Fail-closed silently guts a working shop.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** What the review form's gate shows once both questions have been answered. */
export type ReviewGate = "guest" | "reviewed" | "unbought" | "form";

/**
 * Which of the four the form area shows.
 *
 * REVIEWING IS ONCE PER CUSTOMER PER PRODUCT, which is the rule this whole
 * family exists for: the gate used to ask only "are you signed in?", so a
 * shopper who had already written one was shown the entire form again, stars
 * and all, sitting directly above the review they had already written.
 */
export function reviewGateFor(
  sessionKind: ShopSession["kind"],
  eligible: Record<string, ProductEligibility>,
  productSlug: string,
): ReviewGate {
  /* `unknown` IS NOT `guest`, but it gets the same panel — the copy is written
     to be true either way. See `ReviewGuestPrompt`. */
  if (sessionKind !== "customer") return "guest";

  const answer = eligible[productSlug];
  /* NO ANSWER IS NOT A REFUSAL. See the header — this is the line that keeps
     the shop working until the API catches up. */
  if (!answer) return "form";

  /* REVIEWED IS ASKED FIRST, and the order is deliberate: the two states can
     coexist (an order archived, a review written before this rule), and telling
     somebody to go and buy a spool they are looking at their own review of is
     the worse of the two wrong answers. */
  if (answer.hasReviewed) return "reviewed";
  if (!answer.canReview) return "unbought";
  return "form";
}

/**
 * Whether this viewer may reply to a review or vote on one.
 *
 * ═══ THREE ANSWERS, BECAUSE "NO" HAS TWO REASONS ═══
 * This was a boolean named `canVote`, and `false` rendered "Sign in to vote".
 * Once the purchase gate exists, a signed-in shopper who has simply not bought
 * the spool lands in that same `false` — and is told to do the one thing they
 * have already done and that would change nothing. Telling the two apart is the
 * whole reason this returns a word rather than a flag.
 *
 * `hasReviewed` IS DELIBERATELY NOT CONSULTED. Reviewing is once; replying and
 * voting are not. Somebody who has used their one review may still answer the
 * replies to it and vote on everybody else's — folding the two decisions
 * together would silence exactly the shoppers with most to say about a spool.
 */
export type ReviewAction = "allowed" | "sign-in" | "unbought";

export function reviewActionFor(
  sessionKind: ShopSession["kind"],
  eligible: Record<string, ProductEligibility>,
  productSlug: string,
): ReviewAction {
  if (sessionKind !== "customer") return "sign-in";
  const answer = eligible[productSlug];
  /* Fail open — see the header. */
  if (!answer) return "allowed";
  return answer.canReview ? "allowed" : "unbought";
}
