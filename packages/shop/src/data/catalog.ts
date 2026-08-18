import { CATALOG_DETAIL_REVALIDATE, CATALOG_LIST_REVALIDATE, COMMERCE_API_BASE } from "./config";
import { toCategory, toProduct } from "./api";
import { listReviewAggregates } from "./reviews";
import { HERO_COLOURS, STANDARD_TIERS } from "./policy";
import type { AdaptContext, ApiCategory, ApiProduct } from "./api";
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

/**
 * Shared catalog vocabulary.
 *
 * `COLOURS` IS GONE — colours are variants now, and the components that needed a
 * pool needed it for decoration, which `HERO_COLOURS` in `policy.ts` names
 * honestly. `STANDARD_TIERS` is re-exported here because the bulk band reads the
 * same ladder the products carry, and `policy.ts` records why there is only one.
 */
export { HERO_COLOURS, STANDARD_TIERS };
