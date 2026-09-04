import type { Metadata } from "next";

import { CategoryPage, categoryMetadata, categoryParams, withCurrency } from "@plaspool/shop";

/**
 * `/usd/store/[category]` — a listing, priced in dollars. The same component
 * as `/store/[category]`; see the sibling `../page.tsx` for why the currency
 * is a literal path segment.
 */

type Params = { params: Promise<{ category: string }> };

export default function UsdCategoryPage({ params }: Params) {
  return <CategoryPage params={withCurrency(params, "USD")} />;
}

/* `categoryMetadata` canonicalises to the naira URL for every currency — two
   listings differing only in the symbol before each number must not compete as
   duplicate content. See `canonicalPath`. */
export function generateMetadata({ params }: Params): Promise<Metadata> {
  return categoryMetadata({ params: withCurrency(params, "USD") });
}

/* The same slugs as the naira tree; the currency is in the directory, not in
   the params. This is where the prerendered surface doubles — the trade
   `currency-routing.ts` documents, and the first place to look if deploys
   start failing at the KV upload step. */
export const generateStaticParams = categoryParams;

/* Matches `/store/[category]`. */
export const revalidate = 300;
