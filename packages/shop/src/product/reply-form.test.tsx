import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ReplyForm } from "./reply-form";

/**
 * THE REPLY CONTROL IS A BUTTON UNTIL SOMEBODY ASKS FOR A BOX.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * It used to render an open textarea under every review AND under every reply,
 * so one review with one reply on it showed two empty boxes stacked, each with
 * its own idle "Reply" button — a form shouting over the thing it is attached
 * to.
 *
 * The first render is what these assert, because that is the state every
 * shopper sees on every product page whether or not they ever reply. The
 * expanded state is driven by `useState` and belongs to a browser; the suite
 * here is `environment: "node"` and renders through `react-dom/server`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const render = (over: Partial<Parameters<typeof ReplyForm>[0]> = {}) =>
  renderToStaticMarkup(
    <ReplyForm reviewId="rev_1" action="allowed" signInHref="/sign-in" {...over} />,
  );

describe("ReplyForm", () => {
  it("shows no textarea before it is asked for", () => {
    expect(render()).not.toContain("<textarea");
  });

  it("offers a plain Reply control to open it", () => {
    const html = render();
    expect(html).toContain("<button");
    expect(html).toContain("Reply");
  });

  /* A guest gets a way in, not a control that will fail — and still no box. */
  it("offers a sign-in instead, for a shopper who cannot reply", () => {
    const html = render({ action: "sign-in", signInHref: "/sign-in?next=%2Fx" });
    expect(html).toContain('href="/sign-in?next=%2Fx"');
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("<button");
  });
});

/**
 * A SIGNED-IN SHOPPER WHO HAS NOT BOUGHT THE SPOOL.
 *
 * Same trap as the vote row: the old `canReply: false` rendered "Sign in to
 * reply", which is addressed to a guest and is simply wrong for somebody who is
 * already signed in and merely has not bought this spool.
 *
 * THE CONTROL GOES AWAY ENTIRELY rather than explaining itself. This sits under
 * every review and under every reply; a sentence here is that sentence repeated
 * down the whole page, and the panel at the top of the tab has already said it
 * once where the reader is looking.
 */
describe("ReplyForm, for a shopper who has not bought it", () => {
  it("does not tell a signed-in shopper to sign in", () => {
    const html = render({ action: "unbought" });
    expect(html).not.toContain("Sign in");
    expect(html).not.toContain("<a");
  });

  it("offers no reply control at all", () => {
    const html = render({ action: "unbought" });
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<textarea");
  });
});
