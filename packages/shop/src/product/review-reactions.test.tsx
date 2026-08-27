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
  it("says how many found it helpful", () => {
    expect(text({ ...BASE })).toMatch(/4\s*found this helpful/);
  });

  /* ═══ THE RULE THIS FILE EXISTS FOR ═══ */
  it("never puts a number beside the not-helpful control", () => {
    const out = text({ ...BASE, viewerReaction: "unhelpful" });
    /* The only figure on this control may be the helpful count. */
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
    expect(text({ ...BASE })).toMatch(/not helpful/i);
  });

  /* A review nobody has voted on should not announce "0 found this helpful" —
     that reads as a verdict rather than an absence. */
  it("says nothing about a count of zero", () => {
    expect(text({ ...BASE, helpfulCount: 0 })).not.toMatch(/found this helpful/);
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

  it("still shows the count when the viewer cannot vote", () => {
    expect(text({ ...BASE, canVote: false })).toMatch(/4\s*found this helpful/);
  });

  it("disables the controls while a vote is in flight", () => {
    expect(render({ ...BASE, pending: true })).toContain('disabled=""');
  });
});
