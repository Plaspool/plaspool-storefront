import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ReviewForm } from "./review-form";
import {
  AlreadyReviewedNotice,
  PurchaseRequiredNotice,
  ReviewFormGate,
  ReviewGuestPrompt,
} from "./review-form-gate";

/**
 * THE REVIEWER IS THE ACCOUNT, AND IS NEVER TYPED.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * The form asked for a name and an email on a public product page. Its own
 * header explained why — "there is no account yet — the auth bundle is
 * sequenced after this" — and the auth bundle landed, leaving a form that made
 * a shopper hand over an email the shop already had, to identify themselves as
 * somebody the session had already identified, with nothing stopping them
 * typing somebody else's name onto their words.
 *
 * The fields are DELETED rather than pre-filled, and that distinction is what
 * the first test guards: a pre-filled field is still a field, still editable,
 * and still sends whatever it ends up holding.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const form = () =>
  renderToStaticMarkup(<ReviewForm productSlug="pla-basic" productName="PLA Basic" />);

describe("ReviewForm", () => {
  it("asks for no name and no email", () => {
    const html = form();
    expect(html).not.toContain('type="email"');
    expect(html).not.toContain('autoComplete="name"');
    expect(html).not.toContain('autocomplete="name"');
    expect(html).not.toContain("you@example.com");
    expect(html).not.toContain("Shown with your review");
  });

  /* THE REVIEWER'S IDENTITY MUST NOT REACH THIS PAGE AT ALL — not as a value,
     not as a placeholder, not in a hidden input, and since the API reads it off
     the session cookie, not even as a prop. Any `@` in this markup would mean
     an address had found its way back onto a public product page. */
  it("puts no email address into the markup", () => {
    expect(form()).not.toContain("@");
  });

  it("still asks for the things a review actually is", () => {
    const html = form();
    expect(html).toContain("Rating, out of five");
    expect(html).toContain("Submit review");
  });

  /* The moderation promise is load-bearing copy and predates this change —
     asserted so removing the fields did not take it with them. */
  it("still says reviews are read before they are published", () => {
    expect(form()).toMatch(/before they are published/i);
  });
});

describe("ReviewGuestPrompt", () => {
  it("offers a way in rather than a form", () => {
    const html = renderToStaticMarkup(<ReviewGuestPrompt next="/sign-in?next=%2Fstore" />);
    expect(html).toContain("Write a review");
    expect(html).toContain('href="/sign-in?next=%2Fstore"');
    expect(html).not.toContain("<input");
  });

  /* ═══ THIS PANEL IS ALSO WHAT AN UNREADABLE SESSION SEES ═══
     `readShopSession()` answers `"unknown"` for a network failure and for a
     non-2xx alike, and never retries — so a shopper who IS signed in can land
     here. The copy must therefore state what reviewing requires and never claim
     the reader is signed out. `MobileAccountLinks` reached the same conclusion
     after a skeleton behind the same probe shimmered forever. */
  it("never tells the reader they are signed out", () => {
    const html = renderToStaticMarkup(<ReviewGuestPrompt next="/sign-in" />);
    expect(html).not.toMatch(/sign in to write/i);
    expect(html).not.toMatch(/you are (not )?signed/i);
    expect(html).not.toMatch(/signed out/i);
  });

  /* SIGNING IN MUST COME BACK HERE. A guest sent to an account page after
     signing in has lost the review they were about to write, and the product
     they were on. */
  it("carries the return path it was given", () => {
    const html = renderToStaticMarkup(
      <ReviewGuestPrompt next="/sign-in?next=%2Fstore%2Fproducts%2Fpla-basic" />,
    );
    expect(html).toContain("%2Fstore%2Fproducts%2Fpla-basic");
  });
});

/**
 * A SHOPPER WHO HAS ALREADY REVIEWED THIS SPOOL.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * The gate asked one question — "are you signed in?" — and reviewing is once
 * per customer per product. So somebody who had already written one was shown
 * the entire form again, stars and all, directly above the review they had
 * already written, on the same page.
 *
 * ═══ AND THEIRS MAY NOT BE ON THE PAGE TO POINT AT ═══
 * A review is `pending` until a human approves it and is invisible until then
 * — INCLUDING TO ITS AUTHOR — and a rejected one never appears at all. The
 * server counts both as "already reviewed", which is right: it spares a
 * rejected reviewer the loop of rewriting something they cannot see.
 *
 * That makes the copy load-bearing. "You have already reviewed this" beside a
 * page with no review of theirs on it reads as a bug, and their next move is to
 * look for the form this notice replaced. So it says the review is still being
 * read rather than asserting it is up — true whether it is pending, rejected,
 * or approved and sitting further down the page.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("AlreadyReviewedNotice", () => {
  const html = () => renderToStaticMarkup(<AlreadyReviewedNotice />);

  /* THE POINT OF THE WHOLE CHANGE. Not a disabled form, not a form that
     submits and is refused — no form. */
  it("offers no second form", () => {
    expect(html()).not.toContain("<input");
    expect(html()).not.toContain("<textarea");
    expect(html()).not.toContain("Submit review");
    expect(html()).not.toContain("Rating, out of five");
  });

  it("says the shopper has already reviewed this product", () => {
    expect(html()).toMatch(/already reviewed/i);
  });

  /* A PENDING REVIEW IS INVISIBLE TO ITS OWN AUTHOR. Without this the notice
     contradicts a page that shows no review of theirs. */
  it("explains why their review may not be on the page yet", () => {
    expect(html()).toMatch(/read|review(ed|s) before|moderat/i);
  });

  /* It must not promise the review is up: it may be pending, and it may have
     been rejected — and the shop does not tell them which. */
  it("never claims their review is published", () => {
    const markup = html();
    expect(markup).not.toMatch(/is now live|has been published|is published/i);
    expect(markup).not.toMatch(/below|further down/i);
  });
});

describe("PurchaseRequiredNotice", () => {
  const html = () => renderToStaticMarkup(<PurchaseRequiredNotice />);

  it("offers no form", () => {
    expect(html()).not.toContain("<input");
    expect(html()).not.toContain("<textarea");
    expect(html()).not.toContain("Submit review");
  });

  it("says reviews come from people who bought the product", () => {
    expect(html()).toMatch(/bought/i);
  });

  /* ═══ IT MUST NOT FLATLY ACCUSE THEM OF NOT BUYING IT ═══
     The server matches an order by account OR by a case-folded email, so a
     shopper who checked out as a guest under another address is a real buyer
     this query cannot see — and guest checkout is the DEFAULT path through this
     shop. "You have not bought this" would be flatly wrong for them, and
     unarguable from their side, so the panel states the RULE and names the one
     thing that would change the answer. */
  it("states the rule rather than accusing the reader", () => {
    expect(html()).not.toMatch(/you have not bought|you did not buy|you never bought/i);
    expect(html()).toMatch(/different email/i);
  });
});

/**
 * THE GATE ITSELF, NOW THAT IT IS A PURE COMPONENT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * It used to read the session and the eligibility itself, inside `useEffect` —
 * which made the one thing worth asserting (does the right panel appear?)
 * untestable in a suite with no jsdom, and meant the product page ran TWO
 * session reads and would have run two eligibility reads, because `ReviewsTab`
 * renders this and already asks both questions for the vote and reply rows.
 *
 * So the answer is computed once, above, and arrives as a prop. The component
 * has no hooks left at all, which is why these assertions can exist.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("ReviewFormGate", () => {
  const render = (gate: Parameters<typeof ReviewFormGate>[0]["gate"]) =>
    renderToStaticMarkup(
      <ReviewFormGate
        gate={gate}
        productSlug="pla-basic"
        productName="PLA Basic"
        signInHref="/sign-in?next=%2Fx"
      />,
    );

  it("offers the form to a buyer who has not reviewed", () => {
    expect(render("form")).toContain("Submit review");
  });

  /* THE BUG THIS ALL STARTED WITH: a second form above the review they had
     already written. */
  it("offers no form to somebody who has already reviewed", () => {
    const html = render("reviewed");
    expect(html).not.toContain("Submit review");
    expect(html).not.toContain("<textarea");
    expect(html).toMatch(/already reviewed/i);
  });

  it("offers no form to somebody who has not bought the spool", () => {
    const html = render("unbought");
    expect(html).not.toContain("Submit review");
    expect(html).not.toContain("<textarea");
    expect(html).toMatch(/bought/i);
  });

  it("offers a guest a way in rather than a form", () => {
    const html = render("guest");
    expect(html).not.toContain("Submit review");
    expect(html).toContain('href="/sign-in?next=%2Fx"');
  });
});
