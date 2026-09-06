import { commerceApiBase } from "@plaspool/brand/environment";

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
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A SUBDOMAIN OF THE STOREFRONT'S OWN SITE, AND THAT IS LOAD-BEARING.
 *
 * This was `blog-admin-app-gold.vercel.app`. Same deployment, but a different
 * REGISTRABLE DOMAIN from `plaspool.com` — which made every credentialed call
 * here a THIRD-PARTY request. `__Host-shop_cart` and `__Host-shop_session`
 * then depended on third-party cookies surviving, which they increasingly do
 * not: Safari's ITP blocks them outright, and the exchange would 200 while the
 * browser silently dropped the `Set-Cookie`, leaving a shopper signed in
 * according to Clerk and a guest according to the shop.
 *
 * `admin.plaspool.com` shares the registrable domain with the storefront, so
 * those cookies are SAME-SITE. They are still `__Host-` prefixed and therefore
 * still host-only — nothing is being loosened — but they are no longer
 * third-party, and the whole class of tracking-prevention failure goes away.
 *
 * CORS STILL APPLIES. Same site is not same origin, so the admin must still
 * allow-list `https://plaspool.com` in `APP_ORIGINS` and answer credentialed
 * preflights. See `plaspool-admin/server/shop/cart/cors.ts`.
 *
 * ⚠  AND THE DEVELOPMENT ENVIRONMENT NEEDS ITS OWN ENTRY IN THAT LIST.
 * `admin.dev.plaspool.com` must allow-list `https://dev.plaspool.com`
 * separately — the pair is same-site for the same reason the production pair
 * is, but an origin missing from `APP_ORIGINS` fails exactly the way
 * `localhost` does today: `fetch` rejects, `cart-api.ts` maps it to `offline`,
 * and every cart surface reports "We couldn't load your cart" with nothing
 * anywhere naming CORS as the cause.
 * ═══════════════════════════════════════════════════════════════════════════
 */
/**
 * ⚠  RESOLVED FROM THE HOSTNAME IN THE BROWSER, from the build on the server.
 *
 * See the long note at the foot of `packages/brand/src/environment.ts`. The
 * short version: every call made through this constant from the browser carries
 * credentials, and a build-time value that inlined wrongly once already sent
 * `dev.plaspool.com`'s cart to the production API without erroring. The page
 * knows what host it is on; that answer cannot drift from reality the way an
 * inlined literal can.
 *
 * Server-side there is no `window`, so this is the build's answer — which is
 * also the only answer available while prerendering.
 */
export const COMMERCE_API_BASE = commerceApiBase();

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
 * ═══════════════════════════════════════════════════════════════════════════
 * CACHE TAGS — THE OTHER HALF OF THE WINDOWS ABOVE.
 *
 * A revalidate window is a promise about the WORST case. It is not a way to
 * get a change out quickly, and treating it as one is how the catalogue's hour
 * came to be the thing standing between an owner editing a price and a
 * customer seeing it.
 *
 * These tags are what `POST /api/revalidate` purges. Every catalogue fetch
 * carries `CATALOG_TAG`; the single-product fetch also carries its own
 * `productTag(slug)`, so a price change on one spool does not have to throw
 * away the whole shop's cached listings to reach its own page.
 *
 * ═══ THE WINDOWS STAY, AND THEY ARE NOT REDUNDANT ═══
 * On-demand purging is a push, and a push can be missed: the admin can fail to
 * fire it, the request can be dropped, and a row edited straight in the
 * database fires nothing at all. The window is the floor underneath that —
 * what the shop is guaranteed to correct on its own with nobody watching. The
 * tag is what makes the ordinary case fast.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const CATALOG_TAG = "catalog";

/**
 * The tag for ONE product's detail fetch.
 *
 * `slug` is interpolated, so it is validated at the only door that takes one
 * from a stranger — see the allow-list in `app/api/revalidate/route.ts`.
 * Nothing else should build one of these from unvalidated input.
 */
export function productTag(slug: string): string {
  return `product:${slug}`;
}

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
  abuja: "Next day in Abuja on orders placed before 2pm",
  nationwide: "2–4 working days nationwide",
  returns: "Unopened spools can be returned within 7 days",
} as const;

export const PAYMENT_METHODS = [
  "Card",
  "Bank transfer",
  "USSD",
  "Pay on delivery (Abuja)",
] as const;
