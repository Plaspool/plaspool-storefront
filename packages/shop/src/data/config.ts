/*
 * `SHOW_FIXTURE_REVIEWS` USED TO LIVE HERE AND IS DELETED.
 *
 * It existed to keep invented review numbers off a live store, and it ended up
 * gating two surfaces the API could not answer: the rating line on
 * `ProductCard` and the "Best rated" sort. Both needed a rating for EVERY
 * product in a listing, and the public API aggregated one product at a time.
 *
 * Its own note said the way back was "a bulk aggregate endpoint, not this
 * flag". That endpoint exists now (`Plaspool/plaspool-admin#12`), the fixtures
 * it protected against are gone, and both surfaces render real customer
 * ratings — so the flag has nothing left to gate. A constant named for fixtures
 * in a codebase with none is a trap for whoever reads it next.
 */

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
/**
 * Banners and the rewards programme.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 300s, MATCHING THE CATALOGUE, AND IT WAS 60 UNTIL A BUILD SHOWED WHY NOT.
 *
 * A banner is the most timely thing on the store, so a shorter window looks
 * obviously right. It is not, and the reason is where the announcement bar
 * lives: `ShopShell` wraps EVERY `(shop)` route, so the bar's fetch is on every
 * one of them, and Next takes a route's revalidate window to be the SHORTEST of
 * the fetches it composes.
 *
 * At 60s the build reported `/store`, `/store/[category]` and every category
 * page revalidating every minute instead of every five — five times the origin
 * renders across the whole shop, to make one line of copy timelier. On a runtime
 * whose 10ms CPU budget storefront #9 (Error 1102) was only just brought inside,
 * that is a poor trade for a shop this size.
 *
 * So a banner reaches a page within five minutes rather than one. The API caches
 * these itself with its own shorter TTL, so the effective staleness is the sum of
 * the two windows — the same arrangement `REVIEWS_REVALIDATE` describes.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const MARKETING_REVALIDATE = 300;

export const CATALOG_LIST_REVALIDATE = 300;
export const CATALOG_DETAIL_REVALIDATE = 3600;

/**
 * Reviews are cached for a minute at the API and revalidated here on the same
 * window. The product page's own hour-long ISR sits in front of both, so an
 * approval reaches a live page within that hour — the sum of the windows, as
 * the API contract describes.
 */
export const REVIEWS_REVALIDATE = 60;

/**
 * The BULK aggregate's window, and it is deliberately five times the one above.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BECAUSE OF WHERE IT IS FETCHED, NOT BECAUSE THE DATA IS LESS TIMELY.
 *
 * `REVIEWS_REVALIDATE` is 60s so an approval reaches the product PAGE within a
 * minute — that is where a reviewer goes to look for their own review, and it
 * is one route.
 *
 * The bulk aggregate is fetched by `listProducts()`, which every listing and
 * the home page compose. Next takes a route's revalidate window to be the
 * SHORTEST of the fetches it composes, so a 60s window here silently took
 * `/store` and every category page from five minutes to one — five times the
 * origin renders across the whole shop, measured in the build summary, to make
 * a star line on a card timelier.
 *
 * On a runtime whose CPU budget storefront #9 was only just brought inside,
 * that is a poor trade. A card's star count reaching a grid within five minutes
 * is not a promise anybody notices being kept faster. The SAME trap caught
 * `MARKETING_REVALIDATE`; the general rule is that anything composed into a
 * shared route inherits its window to every route that composes it.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const REVIEWS_BULK_REVALIDATE = 300;

/** A page of reviews. The API caps a request at 50. */
export const REVIEWS_PER_PAGE = 10;

export const DELIVERY = {
  lagos: "Next day in Lagos on orders placed before 2pm",
  nationwide: "2–4 working days nationwide",
  returns: "Unopened spools can be returned within 7 days",
} as const;

export const PAYMENT_METHODS = [
  "Card",
  "Bank transfer",
  "USSD",
  "Pay on delivery (Lagos)",
] as const;
