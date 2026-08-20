import { CATALOG_DETAIL_REVALIDATE, CATALOG_LIST_REVALIDATE, COMMERCE_API_BASE } from "./config";
import { lineImagesFrom, toCategory, toProduct } from "./api";
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

async function getJson<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(`${COMMERCE_API_BASE}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------- categories

async function fetchCategories(): Promise<ApiCategory[]> {
  const body = await getJson<{ items: ApiCategory[] }>(
    "/api/shop/categories",
    CATALOG_LIST_REVALIDATE,
  );
  return body?.items ?? [];
}

export async function listCategories(): Promise<Category[]> {
  return (await fetchCategories()).map(toCategory);
}

export async function getCategory(slug: string): Promise<Category | null> {
  return (await listCategories()).find((c) => c.slug === slug) ?? null;
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
async function context(): Promise<AdaptContext> {
  const categories = await fetchCategories();
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
export async function listProducts(): Promise<Product[]> {
  const [list, ctx] = await Promise.all([
    getJson<{ items: ApiProduct[] }>("/api/shop/products", CATALOG_LIST_REVALIDATE),
    context(),
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

async function fetchProduct(slug: string): Promise<ApiProduct | null> {
  const body = await getJson<{ product: ApiProduct }>(
    `/api/shop/products/${encodeURIComponent(slug)}`,
    CATALOG_DETAIL_REVALIDATE,
  );
  return body?.product ?? null;
}

export async function getProduct(slug: string): Promise<Product | null> {
  /* No ratings fetched here. The product PAGE renders the full review list and
     its own aggregate beside this call (`product-page.tsx`), so asking for a
     star summary as well would be the same numbers twice. `toProduct` leaves
     `rating` at zero, which the page never reads. */
  const [detail, ctx] = await Promise.all([fetchProduct(slug), context()]);
  if (!detail) return null;
  return toProduct(detail, ctx);
}

export async function listProductsByCategory(slug: string): Promise<Product[]> {
  return (await listProducts()).filter((p) => p.categorySlug === slug);
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
export async function listFeaturedProducts(limit = 4): Promise<Product[]> {
  return (await listProducts()).slice(0, limit);
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
