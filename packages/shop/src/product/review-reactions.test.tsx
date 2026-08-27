import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ReviewReactions } from "./review-reactions";

/**
 * VOTING ON A REVIEW, AND THE NUMBER THAT MUST NEVER APPEAR.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `helpfulCount` IS PUBLIC. `unhelpful` IS NOT, ANYWHERE, EVER.
 *
 * A dislike tally on a product page is a scoreboard for brigading. The vote is
 * still worth collecting — the owner sees it in the admin — so the control
 * stays and only the NUMBER goes. There is also no ratio to compute: the
 * denominator does not exist on this side, and inventing one misrepresents it.
 *
 * The signed-out case renders the counts and the thread, and only the CONTROLS
 * ask for a sign-in — reading a product page signed out is not an error.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const render = (props: Parameters<typeof ReviewReactions>[0]) =>
  renderToStaticMarkup(<ReviewReactions {...props} />);
const text = (props: Parameters<typeof ReviewReactions>[0]) =>
  render(props).replace(/<[^>]*>/g, " ");

const BASE = {
  helpfulCount: 4,
  viewerReaction: null,
  pending: false,
  canVote: true,
  onVote: () => {},
  signInHref: "/sign-in",
} as const;

describe("ReviewReactions", () => {
  /* THE COUNT SITS AGAINST THE THUMB IT COUNTS, not in a sentence beside it —
     "4 found this helpful" next to two labelled buttons was three ways of
     saying the same thing on one row. */
  it("shows the tally as a figure, not a sentence", () => {
    const out = text({ ...BASE });
    expect(out).toContain("4");
    expect(out).not.toMatch(/found this helpful/);
  });

  /* ICON-ONLY BUTTONS STILL NEED NAMES. Without these the controls are usable
     only by people who can see the glyph. */
  it("names both controls for a screen reader", () => {
    const html = render({ ...BASE });
    expect(html).toContain('aria-label="Helpful, 4 so far"');
    expect(html).toContain('aria-label="Not helpful"');
  });

  /* ═══ THE RULE THIS FILE EXISTS FOR ═══ */
  it("never puts a number beside the not-helpful control", () => {
    const out = text({ ...BASE, viewerReaction: "unhelpful" });
    /* The only figure anywhere on this row may be the helpful count. */
    const numbers = out.match(/\d+/g) ?? [];
    expect(numbers).toEqual(["4"]);
  });

  it("shows no dislike tally even when this viewer has cast one", () => {
    expect(text({ ...BASE, helpfulCount: 0, viewerReaction: "unhelpful" })).not.toMatch(
      /\b[1-9]\d*\b/,
    );
  });

  /* §9.6 VERBATIM: "grep your rendered review payload for `unhelpful` — it
     must not appear". The vote may be CAST as `unhelpful`; the word must not
     reach the markup, because anything printed there is a step from being
     counted there. */
  it("never writes the word unhelpful into the markup", () => {
    for (const viewerReaction of [null, "helpful", "unhelpful"] as const) {
      expect(render({ ...BASE, viewerReaction })).not.toContain("unhelpful");
    }
  });

  it("still offers the not-helpful control", () => {
    expect(render({ ...BASE })).toContain('aria-label="Not helpful"');
  });

  /* A review nobody has voted on shows no figure at all — a "0" beside the
     thumb reads as a verdict rather than as an absence of votes. */
  it("shows no figure for a count of zero", () => {
    expect(text({ ...BASE, helpfulCount: 0 }).trim()).not.toMatch(/\d/);
  });

  it("marks the control this viewer has already pressed", () => {
    expect(render({ ...BASE, viewerReaction: "helpful" })).toContain('aria-pressed="true"');
  });

  it("leaves both controls unpressed for a viewer who has not voted", () => {
    expect(render({ ...BASE })).not.toContain('aria-pressed="true"');
  });

  /* SIGNED OUT: the count still renders, and the controls become a way in
     rather than disappearing or silently failing. */
  it("offers a sign-in instead of buttons when the viewer cannot vote", () => {
    const out = render({ ...BASE, canVote: false, signInHref: "/sign-in?next=%2Fx" });
    expect(out).toContain('href="/sign-in?next=%2Fx"');
    expect(out).not.toContain("<button");
  });

  /* A shopper deciding whether to trust a review should not have to sign in to
     see how many people found it useful. */
  it("still shows the tally when the viewer cannot vote", () => {
    expect(text({ ...BASE, canVote: false })).toContain("4");
  });

  it("disables the controls while a vote is in flight", () => {
    expect(render({ ...BASE, pending: true })).toContain('disabled=""');
  });
});
