import { CategoryPage } from "@plaspool/shop";

/**
 * `/preview/[category]` — the listing as the commerce API has it RIGHT NOW.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A SEPARATE ROUTE, BECAUSE `?fresh=1` ON `/store/[category]` WOULD BE #9 AGAIN.
 *
 * The obvious shape is a query parameter on the real listing. It cannot be:
 * awaiting `searchParams` in a page makes that route dynamic at runtime FOR
 * EVERY VISITOR, present or not, which is precisely the regression
 * `listing-page.tsx` documents — /store/all rendering in full on every view
 * against a 10ms CPU budget, and Error 1102 about once in twenty requests.
 * The freshness an owner wants while editing is not worth handing every
 * shopper an uncached store.
 *
 * So the bypass lives on its own URL. `/store/filament` stays prerendered and
 * served out of KV exactly as before; `/preview/filament` renders on demand
 * with `cache: "no-store"` on the catalogue fetches, so an edit made seconds
 * ago is visible with no window to wait out and no purge to fire.
 *
 * IT EVICTS NOTHING. Unlike `POST /api/revalidate`, this does not touch a
 * cached entry — it renders a fresh copy for whoever asked and leaves every
 * shopper's cache alone, so the cost of abusing it is one render, not a shop
 * that re-renders everything for the next five minutes.
 *
 * NOT 404'd IN PRODUCTION the way `/dev/*` is: production is the only place
 * worth checking a published edit. It is `noindex, nofollow` and disallowed
 * in robots.txt instead, because an uncached duplicate of every listing is
 * exactly what a crawler should not be walking.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ category: string }> }) {
  return <CategoryPage params={params} fresh />;
}
