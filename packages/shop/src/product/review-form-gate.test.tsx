import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ReviewForm } from "./review-form";
import { ReviewGuestPrompt } from "./review-form-gate";

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
