import { ProductPage } from "@plaspool/shop";

/** `/preview/products/[slug]` — one product, straight from the API.
 *
 *  The product page's own window is an HOUR (`CATALOG_DETAIL_REVALIDATE`), so
 *  this is the bigger of the two waits it removes. See `../[category]/page.tsx`
 *  for why the bypass is a route rather than a query parameter. */
export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <ProductPage params={params} fresh />;
}
