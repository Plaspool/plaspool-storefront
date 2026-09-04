import {
  CATALOG_DETAIL_REVALIDATE,
  CATALOG_LIST_REVALIDATE,
  CATALOG_TAG,
  COMMERCE_API_BASE,
  productTag,
} from "./config";
import { lineImagesFrom, toCategory, toProduct } from "./api";
import type { CurrencyCode } from "./currency-config";
import { listReviewAggregates } from "./reviews";
import { HERO_COLOURS, STANDARD_TIERS } from "./policy";
import type { AdaptContext, ApiCategory, ApiProduct, LineImageIndex } from "./api";
import type { Category, Product } from "./types";

/**
 * The seam. These used to read a local array; they now read the commerce API,
 * and — as this file's original header promised — only their bodies changed.
 *
 * Every signature gained `Promise`, which is the one thing that could not be
 * kept: the callers are Server Components and they `await`. Nothing else about
 * the shapes moved, because `api.ts` owns the translation and `Product` is still
 * this package's own type.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A FETCH PER LIST, NOT PER PRODUCT, AND THE REASON IS A CPU BUDGET.
 *
 * This storefront runs on Cloudflare Workers with a 10ms CPU budget per
 * request, and storefront issue #9 was Error 1102 — every `revalidate` route
 * re-rendering on every request because the Worker had no cache binding. It now
 * has KV and cache interception, so these fetches are cached rather than live
 * on the hot path, but the shape still matters: `listProducts()` is ONE request
 * that every card on a listing reads from, never one per card.
 *
 * `getProduct()` still calls the DETAIL endpoint rather than filtering the list,
 * even though the list now carries variants too. Two reasons: the detail
 * response is one product instead of the whole catalogue, and it has its own
 * much longer cache window — a product page is the most-cached route in the shop
 * and has no reason to share a five-minute list TTL.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * NOTHING HERE THROWS ON A FAILED FETCH. A shop that 500s because the catalogue
 * API blinked is worse than one that renders an empty shelf, and the blog client
 * next door already follows this rule (`BlogStrip`, and `reviews.ts` for the
 * same reason). An empty catalogue is a visible, recoverable state; a thrown
 * error inside a Server Component is a 500 on the whole route.
 */

/**
 * `tags` IS REQUIRED RATHER THAN OPTIONAL, and that is the whole point of it.
 *
 * An untagged fetch cannot be purged — it comes back only when its window
 * runs out — and an optional parameter is one a future call site forgets. Every
 * catalogue read goes through here, so making the argument mandatory is what
 * guarantees `POST /api/revalidate` reaches all of them rather than whichever
 * ones somebody remembered. Pass `[]` deliberately if a fetch should genuinely
 * only ever expire on time; nothing does today.
 */
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * `fresh` — THE OWNER LOOKING AT THEIR OWN EDIT, AND NOBODY ELSE'S CACHE.
 *
 * A revalidate window is a promise about the worst case, and `/api/revalidate`
 * is a push that only fires if something remembers to fire it. Neither answers
 * "I changed a price ten seconds ago and I want to SEE it", which is what an
 * owner does dozens of times while setting a shop up.
 *
 * `fresh` makes ONE request skip the cache: `cache: "no-store"` instead of the
 * window, so the answer comes from the commerce API every time. It reaches the
 * pages through `?fresh=1` on a catalogue URL.
 *
 * ═══ WHY THIS IS SAFER THAN THE PURGE ENDPOINT NEXT DOOR ═══
 * `POST /api/revalidate` EVICTS: one call makes the next request for every
 * catalogue page miss cache and re-render, which is the amplification its own
 * comment records as a denial-of-wallet risk. This evicts NOTHING. It renders
 * fresh for the caller and leaves every cached entry exactly where it was, so
 * the cost of abusing it is one render per request — the same as any dynamic
 * page — and no shopper's response gets slower for it.
 *
 * It is unauthenticated for the same reason that endpoint is, and it is worth
 * a rate-limiting rule on the query if it is ever noticed being hammered.
 *
 * `no-store` REPLACES the window rather than joining it: Next rejects a fetch
 * carrying both, so this is a branch and not an extra option.
 * ═══════════════════════════════════════════════════════════════════════════
 */
/**
 * `?currency=USD`, or nothing at all.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFAULT CURRENCY MUST SEND NO PARAMETER, AND THAT IS A CACHING RULE AS
 * MUCH AS AN API ONE.
 *
 * `getJson` keys Next's fetch cache by URL, so `/api/shop/products` and
 * `/api/shop/products?currency=NGN` are TWO cache entries holding identical
 * bytes — every naira page would miss the entry the shop has been filling
 * since it launched, and each one costs a KV write to refill. The account has
 * already had deploys fail against the free tier's 1,000-write day
 * (`CLAUDE.md`), so doubling the catalogue's entries for no change in the
 * response is not a cosmetic waste.
 *
 * It is also what the API asks for: "Omit the parameter for naira."
 *
 * A currency that is not enabled is a 400, which `getJson` maps to null — so a
 * stale switcher asking for a currency the admin has since turned off costs
 * that page's products rather than an exception, and the currency config's own
 * fail-closed rule is what stops it being asked for in the first place.
 * ═══════════════════════════════════════════════════════════════════════════
 */
/* Exported for its test: the "omit for the default" rule is a CACHING
   invariant, not a formatting detail, and it is worth a failing assertion
   rather than a code review. The same reason `returns-cta` exports
   `isOwnEntry`. */
export function currencyQuery(currency: CurrencyCode | undefined, defaultCurrency: CurrencyCode = "NGN"): string {
  return !currency || currency === defaultCurrency ? "" : `?currency=${currency}`;
}

async function getJson<T>(
  path: string,
  revalidate: number,
  tags: string[],
  fresh = false,
): Promise<T | null> {
  try {
    const res = await fetch(
      `${COMMERCE_API_BASE}${path}`,
      fresh ? { cache: "no-store" } : { next: { revalidate, tags } },
    );
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------- categories

async function fetchCategories(fresh = false): Promise<ApiCategory[]> {
  const body = await getJson<{ items: ApiCategory[] }>(
    "/api/shop/categories",
    CATALOG_LIST_REVALIDATE,
    [CATALOG_TAG],
    fresh,
  );
  return body?.items ?? [];
}

export async function listCategories(fresh = false): Promise<Category[]> {
  return (await fetchCategories(fresh)).map(toCategory);
}

export async function getCategory(slug: string, fresh = false): Promise<Category | null> {
  return (await listCategories(fresh)).find((c) => c.slug === slug) ?? null;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE SHOP'S FRONT DOOR — DERIVED, BECAUSE THE HARDCODED ONE ROTTED.
 *
 * The hero's primary button pointed at `/store/pla` and said "Shop PLA". That
 * was true while the catalogue had a category per material. It stopped being
 * true when the categories collapsed to a single `filament`, and nothing
 * noticed: the href was a string literal, so there was no build error, no test
 * failure and no 404 until somebody clicked the biggest button on the home
 * page and got "We couldn't find that page".
 *
 * A LINK BUILT FROM A SLUG NOBODY VERIFIED IS A LINK THAT ROTS SILENTLY.
 * This asks the catalogue instead, so the button can only ever point at a
 * category that exists — and its LABEL comes from the same answer, because a
 * button reading "Shop PLA" that lands on Filament is a different bug wearing
 * the first one's clothes.
 *
 * `position` order, so the owner decides what the front door opens onto by
 * ordering categories in the admin rather than by editing a component.
 *
 * FALLS BACK TO `/store/all`, which is not a category and therefore cannot go
 * missing: `categoryParams` prerenders it and `metaFor` answers for it
 * directly. An empty catalogue still gets a working button.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export interface CategoryLink {
  href: string;
  label: string;
}

export async function primaryCategoryLink(fresh = false): Promise<CategoryLink> {
  const [first] = await listCategories(fresh);
  return first
    ? { href: `/store/${first.slug}`, label: `Shop ${first.name}` }
    : { href: "/store/all", label: "Browse all filament" };
}

export async function categoryPaths(): Promise<{ category: string }[]> {
  return (await listCategories()).map((c) => ({ category: c.slug }));
}

// ------------------------------------------------------------------- products

/**
 * The context every adaptation needs: the name→slug map, and one clock reading.
 *
 * The clock is read HERE rather than inside `badgesFrom` so that every product
 * in one response is badged against the same instant. Read per product, a slow
 * response could put two spools published seconds apart on different sides of
 * the "New" boundary.
 */
async function context(fresh = false): Promise<AdaptContext> {
  const categories = await fetchCategories(fresh);
  return {
    categorySlugByName: new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.slug])),
    now: Date.now(),
  };
}

/**
 * Every sellable product.
 *
 * ONE REQUEST. The list endpoint returns each product WITH its variants, prices
 * and availability, so a card can be priced without a second call — which is
 * what `Plaspool/plaspool-admin#14` changed it to do, and why. Fetching the list
 * and then a detail response per product was `1 + N` subrequests against a
 * 50-subrequest cap, i.e. a catalogue-size ceiling rather than a slow path.
 */
export async function listProducts(fresh = false, currency?: CurrencyCode): Promise<Product[]> {
  const [list, ctx] = await Promise.all([
    getJson<{ items: ApiProduct[] }>(
      `/api/shop/products${currencyQuery(currency)}`,
      CATALOG_LIST_REVALIDATE,
      /* ═══ THE SAME TAG FOR EVERY CURRENCY, DELIBERATELY ═══
         One product edit changes the naira listing and the dollar listing
         alike — they are the same catalogue quoted twice — so a purge that
         reached only the currency the editor happened to be looking at would
         leave the other serving a price nobody sells at. `CATALOG_TAG` spans
         both, and `POST /api/revalidate` keeps working unchanged. */
      [CATALOG_TAG],
      fresh,
    ),
    context(fresh),
  ]);
  const items = list?.items ?? [];

  /*
   * RATINGS FOR THE WHOLE GRID IN ONE REQUEST, and it has to come after the
   * list because it is keyed by the slugs the list returns.
   *
   * That makes it the one place this file serialises two fetches on purpose.
   * The alternative is a rating request per card, which on Workers is a
   * subrequest per card against a 50-request cap — a grid-size ceiling rather
   * than a slow path. Two sequential requests beat sixteen parallel ones here.
   *
   * `listReviewAggregates` never throws and answers an empty map when the
   * reviews API is unreachable, so a bad day there costs star lines and not
   * the catalogue.
   */
  const slugs = items.map((item) => item.slug).filter((slug): slug is string => !!slug);
  const ratings = await listReviewAggregates(slugs);

  return items
    .map((item) => toProduct(item, { ...ctx, ratings }))
    .filter((p): p is Product => p !== null);
}

async function fetchProduct(
  slug: string,
  fresh = false,
  currency?: CurrencyCode,
): Promise<ApiProduct | null> {
  const body = await getJson<{ product: ApiProduct }>(
    `/api/shop/products/${encodeURIComponent(slug)}${currencyQuery(currency)}`,
    CATALOG_DETAIL_REVALIDATE,
    /* BOTH TAGS, NOT JUST ITS OWN. `CATALOG_TAG` so a "the catalogue moved"
       purge reaches every product page without the caller having to enumerate
       slugs it may not know; `productTag` so editing one spool can reach that
       spool's page without discarding every cached listing in the shop. */
    [CATALOG_TAG, productTag(slug)],
    fresh,
  );
  return body?.product ?? null;
}

export async function getProduct(
  slug: string,
  fresh = false,
  currency?: CurrencyCode,
): Promise<Product | null> {
  /* No ratings fetched here. The product PAGE renders the full review list and
     its own aggregate beside this call (`product-page.tsx`), so asking for a
     star summary as well would be the same numbers twice. `toProduct` leaves
     `rating` at zero, which the page never reads. */
  const [detail, ctx] = await Promise.all([fetchProduct(slug, fresh, currency), context(fresh)]);
  if (!detail) return null;
  return toProduct(detail, ctx);
}

export async function listProductsByCategory(slug: string, fresh = false): Promise<Product[]> {
  return (await listProducts(fresh)).filter((p) => p.categorySlug === slug);
}

/**
 * The home page's featured row.
 *
 * THE NEWEST FEW, BECAUSE THERE IS NO `featured` COLUMN. `Product.featured` is
 * `false` on every adapted product for that reason, so this cannot read it — and
 * an empty featured row on the home page would be a worse answer than a recent
 * one. What it must not do is claim an editorial choice nobody made, which is
 * why the selection rule is stated here rather than hidden behind a flag that
 * looks deliberate.
 *
 * The list endpoint returns newest-first, and `listProducts` preserves that
 * order, so this is a slice rather than a sort.
 */
export async function listFeaturedProducts(limit = 4, fresh = false): Promise<Product[]> {
  return (await listProducts(fresh)).slice(0, limit);
}

export async function productPaths(): Promise<{ slug: string }[]> {
  return (await listProducts()).map((p) => ({ slug: p.slug }));
}

// --------------------------------------------------------- order line images

/**
 * Pictures for order lines: `variantId` → `LineImage`, from one catalogue read.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS NOT `listProducts()`.
 *
 * `listProducts()` answers the SELLABLE catalogue — it drops a product with no
 * slug or no priced size and keeps only active variants — and it serialises a
 * second fetch, `listReviewAggregates`, to put stars on cards. An order page
 * needs neither. It needs pictures for things that were bought, including
 * things that can no longer be bought, and it has no stars anywhere on it.
 *
 * Calling it here would cost both ways. `config.ts` sets out the trap under
 * `REVIEWS_BULK_REVALIDATE`: anything composed into a shared route inherits its
 * revalidate window to every route that composes it, which is how a 60s reviews
 * window silently took `/store` and every category page from five minutes to
 * one. Composing a reviews fetch into two account routes for data neither
 * renders is the same mistake pointed at a new pair of pages.
 *
 * ═══ THE WINDOW IS `CATALOG_LIST_REVALIDATE`, AND IT IS THE SAME FETCH ═══
 * Same URL, same options as the one `listProducts()` makes, so Next's data
 * cache keys them together: an order route and `/store` share one cached
 * response rather than each holding their own. Choosing a shorter window here
 * would not make an order's pictures fresher — it would split the cache entry
 * in two and pull `/store` down to the shorter of them.
 *
 * 300s IS ALSO SAFE TO COMPOSE, which is the second half of that rule. Both
 * callers are `force-dynamic` account routes with no static window of their own
 * to drag down; and even if one were static, five minutes is what every other
 * catalogue read in the shop already costs.
 *
 * ═══ `force-dynamic` MAKES `no-store` THE SEGMENT DEFAULT, AND THE EXPLICIT
 * `revalidate` IS WHAT SURVIVES IT ═══
 * `getJson` passes `next: { revalidate }` on every call, and Next only applies
 * the segment's `no-store` default when a fetch has set no revalidate of its
 * own (`patch-fetch.js`: the branch is guarded on `!currentFetchRevalidate`).
 * So this stays cached on both order routes. Anything that later drops the
 * explicit window here would turn one cached catalogue read into an origin hit
 * per page view, on a runtime with a 10ms CPU budget — silently, and only in
 * production.
 *
 * ONE FETCH PER RENDER, SHARED BY EVERY LINE OF EVERY ORDER ON THE PAGE. The
 * route awaits this once and passes the plain object down; nothing resolves a
 * picture over the network, so an order with five lines and a list with twenty
 * orders cost exactly the same as an empty one.
 *
 * ═══ IT NEVER THROWS, AND AN UNREACHABLE CATALOGUE COSTS PICTURES ═══
 * `getJson` answers null for a transport failure and for a non-2xx alike, so
 * this answers an EMPTY INDEX and every line resolves to "no picture". That is
 * the same rule the rest of this file follows, applied to the surface where it
 * matters most: a customer checking where their order is must not get a 500
 * because the product API blinked.
 *
 * WHAT THAT COLLAPSES, STATED PLAINLY: "this variant is gone from the
 * catalogue" and "the catalogue could not be read" arrive at the caller
 * identically, as an absent key. They are NOT distinguishable downstream and
 * deliberately so — to a customer looking at a 48px box beside a row that
 * already names what they bought, the fact is the same one ("there is no
 * picture of this"), only the reason differs, and a thumbnail cannot carry a
 * reason. What they must never collapse into is the case next to them: a
 * variant the catalogue DOES know but nobody has photographed still has a
 * colour, and draws a spool in it. Distinguishing the two failures would mean
 * a page-level notice, not a different picture; if that is ever wanted, this
 * function has to start returning the reason rather than the caller guessing.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export async function getLineImages(): Promise<LineImageIndex> {
  const list = await getJson<{ items: ApiProduct[] }>(
    "/api/shop/products",
    CATALOG_LIST_REVALIDATE,
    [CATALOG_TAG],
  );
  return lineImagesFrom(list?.items ?? []);
}

/**
 * Re-exported so the order surfaces can type the prop without reaching past
 * this seam into `api.ts` — `catalog.ts` is what the package's `index.ts`
 * publishes, and `LineImage` is part of what `getLineImages()` answers.
 */
export type { LineImage, LineImageIndex } from "./api";

/**
 * Shared catalog vocabulary.
 *
 * `COLOURS` IS GONE — colours are variants now, and the components that needed a
 * pool needed it for decoration, which `HERO_COLOURS` in `policy.ts` names
 * honestly. `STANDARD_TIERS` is re-exported here because the bulk band reads the
 * same ladder the products carry, and `policy.ts` records why there is only one.
 */
export { HERO_COLOURS, STANDARD_TIERS };
