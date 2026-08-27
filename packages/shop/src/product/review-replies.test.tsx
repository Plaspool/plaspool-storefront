import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ReviewReplies } from "./review-replies";
import type { ReviewReply } from "../data/reviews";

/**
 * A REPLY THREAD, AND WHO IS ALLOWED TO LOOK OFFICIAL.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `authorKind` DECIDES, NEVER THE NAME. The brief is explicit that matching on
 * `"PlaSpool"` breaks the day a customer is called that — and the failure mode
 * is a customer wearing the shop's logomark under a review, which is the exact
 * impersonation the field exists to prevent. The test below signs a CUSTOMER
 * reply "PlaSpool" and requires that it still reads as a customer.
 *
 * The badge exists so the distinction survives monochrome and images-off; the
 * logomark alone would carry nothing in either.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const reply = (over: Partial<ReviewReply>): ReviewReply => ({
  id: "rpl_1",
  parentId: null,
  depth: 0,
  body: "Thanks — glad it printed well.",
  authorKind: "customer",
  authorName: "Dara",
  createdAt: 1787788800000,
  ...over,
});

const render = (replies: ReviewReply[]) =>
  renderToStaticMarkup(<ReviewReplies replies={replies} />);

/** Renders a marker wherever a reply control would go, so the depth rule can
 *  be asserted without mounting the form itself. */
const withControls = (replies: ReviewReply[]) =>
  renderToStaticMarkup(
    <ReviewReplies
      replies={replies}
      replyControl={(parentId) => <b data-reply-to={parentId}>reply-control</b>}
    />,
  );
const text = (replies: ReviewReply[]) => render(replies).replace(/<[^>]*>/g, " ");

describe("ReviewReplies", () => {
  it("renders nothing at all for a review with no replies", () => {
    expect(render([])).toBe("");
  });

  it("shows a reply and who wrote it", () => {
    const out = text([reply({ body: "Mine arrived quickly too.", authorName: "Dara" })]);
    expect(out).toContain("Mine arrived quickly too.");
    expect(out).toContain("Dara");
  });

  /* ═══ THE IMPERSONATION TEST ═══ */
  it("does not make a customer official because of their name", () => {
    const out = render([reply({ authorKind: "customer", authorName: "PlaSpool" })]);
    expect(out).not.toContain("logomark");
    expect(out).not.toMatch(/>\s*(Shop|Owner)\s*</);
  });

  it("marks an owner reply with the logomark and a badge", () => {
    const out = render([reply({ authorKind: "owner", authorName: "PlaSpool" })]);
    expect(out).toContain("logomark");
    expect(out).toMatch(/Shop|Owner/);
  });

  /* THE NAME IS THE FIELD, NOT A CONSTANT — a rename is one server change. */
  it("renders the owner's name from the payload rather than a hardcoded string", () => {
    const out = text([reply({ authorKind: "owner", authorName: "PlaSpool Nigeria" })]);
    expect(out).toContain("PlaSpool Nigeria");
  });

  it("nests a depth-1 reply under its parent", () => {
    const out = text([
      reply({ id: "a", body: "Parent reply." }),
      reply({ id: "b", parentId: "a", depth: 1, body: "Child reply." }),
    ]);
    expect(out.indexOf("Parent reply.")).toBeLessThan(out.indexOf("Child reply."));
    expect(out).toContain("Child reply.");
  });

  /* Every reply must appear exactly once — a tree built by grouping is easy to
     render twice, at the top level and again as a child. */
  it("renders each reply exactly once", () => {
    const out = text([
      reply({ id: "a", body: "Parent reply." }),
      reply({ id: "b", parentId: "a", depth: 1, body: "Child reply." }),
    ]);
    expect(out.split("Child reply.").length - 1).toBe(1);
    expect(out.split("Parent reply.").length - 1).toBe(1);
  });
});

describe("the reply control", () => {
  /* TWO LEVELS IS THE CEILING. The API answers `400 parentId` for a reply to a
     depth-1 reply, and a control that offers a refusal is worse than no
     control — the customer finds the wall by hitting it. */
  it("is offered on a top-level reply and never on a nested one", () => {
    const out = withControls([
      reply({ id: "a" }),
      reply({ id: "b", parentId: "a", depth: 1 }),
    ]);
    expect(out).toContain('data-reply-to="a"');
    expect(out).not.toContain('data-reply-to="b"');
    expect(out.split("reply-control").length - 1).toBe(1);
  });

  it("is absent entirely when the caller offers none", () => {
    expect(render([reply({ id: "a" })])).not.toContain("reply-control");
  });
});
