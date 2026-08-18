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
 * Catalogue cache windows, matching the blog's two-tier shape next door
 * (`LIST_REVALIDATE` / `DETAIL_REVALIDATE`) because the reasoning is identical.
 *
 * A LIST GOES STALE FASTER THAN A PAGE. Five minutes on the catalogue list is
 * what decides how quickly a newly published product appears in the nav, on the
 * home page and in a category grid — all of which are the same fetch. An hour on
 * a product page is fine because the URL only exists once the product does, and
 * a price change reaches it within that window.
 *
 * BOTH SIT BEHIND THE WORKER'S KV INCREMENTAL CACHE (storefront #9), so these
 * are revalidation windows rather than a promise about how often the origin is
 * actually hit.
 */
export const CATALOG_LIST_REVALIDATE = 300;
export const CATALOG_DETAIL_REVALIDATE = 3600;

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
