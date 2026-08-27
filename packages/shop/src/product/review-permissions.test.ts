import { describe, expect, it } from "vitest";

import { reviewActionFor, reviewGateFor } from "./review-permissions";

/**
 * WHO MAY DO WHAT WITH REVIEWS ON A PRODUCT — the two decisions, in one place.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PURE FUNCTIONS ON PURPOSE. This suite runs `environment: "node"` with no
 * jsdom and no testing-library (a deliberate choice — see `vitest.config.ts`),
 * so a decision that lives inside a `useEffect` cannot be asserted on at all.
 * Everything else in these components is a session read, a fetch and a
 * `setState`; this is the part that can be wrong, so this is the part that is
 * a function.
 *
 * ═══ THE RULE BOTH OF THEM SHARE ═══
 * An ABSENT answer is an unreadable endpoint, never a refusal. If either
 * function read a missing field as `false`, one bad minute from the reviews
 * service would strip reviewing, replying and voting from every product in the
 * shop at once — silently, with nothing on the page to say why.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * WHICH OF THE THREE THINGS THE GATE SHOWS — the decision the bug was in.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Pulled out as a pure function ON PURPOSE. This suite runs
 * `environment: "node"` with no jsdom and no testing-library (a deliberate
 * choice — see `vitest.config.ts`), so a component whose answer lives inside
 * `useEffect` cannot be asserted on at all. The rest of the gate is a session
 * read, a fetch and a `setState`; this is the part that can be wrong, so this
 * is the part that is a function.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("reviewGateFor", () => {
  const REVIEWED = { "pla-basic": { canReview: true, hasReviewed: true } };
  const NOT_REVIEWED = { "pla-basic": { canReview: true, hasReviewed: false } };

  it("sends a guest to the sign-in panel", () => {
    expect(reviewGateFor("guest", {}, "pla-basic")).toBe("guest");
  });

  /* THE BUG, IN ONE LINE. This returned "form", above the review they had
     already written. */
  it("shows the notice, not a form, to somebody who has already reviewed", () => {
    expect(reviewGateFor("customer", REVIEWED, "pla-basic")).toBe("reviewed");
  });

  it("shows the form to a customer who has not reviewed this product", () => {
    expect(reviewGateFor("customer", NOT_REVIEWED, "pla-basic")).toBe("form");
  });

  /* ═══ FAIL OPEN ═══
     `reviewEligibility` answers `{}` for anything it could not read. If an
     absent answer read as "has reviewed", one unreachable minute would remove
     the review form from every shopper in the shop. */
  it("shows the form when the eligibility answer is missing entirely", () => {
    expect(reviewGateFor("customer", {}, "pla-basic")).toBe("form");
  });

  /* Another product's answer is not this product's. A page that indexed the
     record loosely would gate one spool on another's verdict. */
  it("does not read another product's answer", () => {
    expect(reviewGateFor("customer", REVIEWED, "petg-matte")).toBe("form");
  });
});

/**
 * REVIEWS COME FROM BUYERS — the second half of the same eligibility answer.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `canReview` rides along with `hasReviewed` in one response, so gating on it
 * costs no extra request. The server refuses a non-buyer either way; this is
 * only about whether somebody types a review before being told.
 *
 * ═══ THE ORDER OF THE TWO CHECKS IS LOAD-BEARING, AND SO IS THE THIRD ═══
 * `hasReviewed` is asked FIRST: a shopper who demonstrably reviewed the spool
 * should be told that, not told to go and buy something. The states can coexist
 * — an order refunded and archived, a review written before this rule — and
 * "you have not bought this" to somebody looking at their own review on the
 * page is the worse of the two wrong answers.
 *
 * And ONLY AN EXPLICIT `false` BLOCKS. An absent answer is an unreachable
 * endpoint, which is what the live one is today; reading `undefined` as "has
 * not bought" would hide the form from the entire shop.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("reviewGateFor, on the purchase gate", () => {
  const slug = "pla-basic";
  const at = (canReview: boolean, hasReviewed: boolean) => ({
    [slug]: { canReview, hasReviewed },
  });

  it("does not offer a form to somebody who has not bought the spool", () => {
    expect(reviewGateFor("customer", at(false, false), slug)).toBe("unbought");
  });

  it("offers the form to a buyer who has not reviewed yet", () => {
    expect(reviewGateFor("customer", at(true, false), slug)).toBe("form");
  });

  /* REVIEWED WINS. Telling somebody to buy a spool they have already reviewed
     is the worse of the two wrong answers. */
  it("says 'already reviewed' rather than 'not bought' when both are true", () => {
    expect(reviewGateFor("customer", at(false, true), slug)).toBe("reviewed");
  });

  /* ═══ THE ONE THAT KEEPS THE SHOP WORKING ═══
     `undefined` is not `false`. `reviewEligibility` answers `{}` for anything
     it could not read; if that read as "has not bought", an unreachable reviews
     service would remove reviewing from every product in the shop. */
  it("still offers the form when there is no answer at all", () => {
    expect(reviewGateFor("customer", {}, slug)).toBe("form");
  });
});

/**
 * WHETHER THIS VIEWER MAY REPLY OR VOTE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A DIFFERENT QUESTION FROM `reviewGateFor`, AND `hasReviewed` IS NOT PART OF
 * IT. Reviewing is once; replying and voting are not, so somebody who has used
 * their one review may still argue with the answers and vote on other people's.
 * Folding the two decisions into one boolean would silence exactly the shoppers
 * with the most to say about a spool.
 *
 * ═══ AND IT HAS THREE ANSWERS, NOT TWO, BECAUSE "NO" HAS TWO REASONS ═══
 * This was a boolean, and `false` rendered "Sign in to vote". A signed-in
 * shopper who simply had not bought the spool was therefore told to sign in —
 * which they had already done, and doing it again would change nothing. That is
 * the same lie `ReviewGuestPrompt` was written to avoid, one row further down.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("reviewActionFor", () => {
  const slug = "pla-basic";
  const at = (canReview: boolean, hasReviewed = false) => ({
    [slug]: { canReview, hasReviewed },
  });

  it("sends a guest to sign in", () => {
    expect(reviewActionFor("guest", {}, slug)).toBe("sign-in");
  });

  it("lets a buyer reply and vote", () => {
    expect(reviewActionFor("customer", at(true), slug)).toBe("allowed");
  });

  /* NOT "sign-in" — they are signed in, and being told to do it again is the
     one instruction that cannot help them. */
  it("does not tell a signed-in non-buyer to sign in", () => {
    expect(reviewActionFor("customer", at(false), slug)).toBe("unbought");
  });

  /* REPLYING IS NOT ONCE. Having used their one review must not cost somebody
     the right to answer a reply to it. */
  it("still lets somebody who has already reviewed reply and vote", () => {
    expect(reviewActionFor("customer", at(true, true), slug)).toBe("allowed");
  });

  /* ═══ FAIL OPEN — an unreadable answer must not become a refusal ═══ */
  it("allows the actions when there is no answer at all", () => {
    expect(reviewActionFor("customer", {}, slug)).toBe("allowed");
  });

  it("does not read another product's answer", () => {
    expect(reviewActionFor("customer", at(false), "petg-matte")).toBe("allowed");
  });
});
