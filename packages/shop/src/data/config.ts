/**
 * Fixture reviews are for building the UI. They are not customer reviews and
 * must never be presented as them on a live store.
 *
 * OFF, NOW THAT REVIEWS ARE REAL. The product page reads the live API, so a
 * card advertising an invented "4.8 (6)" over a page that says "No reviews
 * yet" would be the store contradicting itself — worse than showing nothing.
 *
 * What it still gates is the two surfaces the API cannot answer yet, because
 * both need a rating for EVERY product in a listing and the public API
 * aggregates one product at a time:
 *
 *   - the rating line on `ProductCard`
 *   - the "Best rated" option in the listing's sort
 *
 * Turning this back on means putting invented numbers in front of customers.
 * The way to bring these two back is a bulk aggregate endpoint, not this flag.
 */
export const SHOW_FIXTURE_REVIEWS = false;

/**
 * The commerce API — the same deployment the blog reads from, which is why
 * this is the same host as `BLOG_API_BASE` in `packages/blog`. Hardcoded for
 * the reason that one is: there is no environment variable for it, on
 * purpose, and the two packages own their own copy rather than one importing
 * the other's config.
 */
export const COMMERCE_API_BASE = "https://blog-admin-app-gold.vercel.app";

/**
 * Reviews are cached for a minute at the API and revalidated here on the same
 * window. The product page's own hour-long ISR sits in front of both, so an
 * approval reaches a live page within that hour — the sum of the windows, as
 * the API contract describes.
 */
export const REVIEWS_REVALIDATE = 60;

/** A page of reviews. The API caps a request at 50. */
export const REVIEWS_PER_PAGE = 10;

export const DELIVERY = {
  lagos: "Next day in Lagos on orders placed before 2pm",
  nationwide: "2–4 working days nationwide",
  freeOver: 50_000,
  returns: "Unopened spools can be returned within 7 days",
} as const;

export const PAYMENT_METHODS = [
  "Card",
  "Bank transfer",
  "USSD",
  "Pay on delivery (Lagos)",
] as const;
