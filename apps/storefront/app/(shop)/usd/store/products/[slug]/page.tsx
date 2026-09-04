import type { Metadata } from "next";

import { ProductPage, productMetadata, productParams, withCurrency } from "@plaspool/shop";

/**
 * `/usd/store/products/[slug]` — a product, priced in dollars. The same
 * component as `/store/products/[slug]`; see `../../page.tsx` for why the
 * currency is a literal path segment.
 */

type Params = { params: Promise<{ slug: string }> };

export default function UsdProductPage({ params }: Params) {
  return <ProductPage params={withCurrency(params, "USD")} />;
}

/* Canonicalises to the naira twin — see `canonicalPath` for what that
   consolidation gives up. */
export function generateMetadata({ params }: Params): Promise<Metadata> {
  return productMetadata({ params: withCurrency(params, "USD") });
}

/* Every product, once more. The largest of the three trees and so the biggest
   single contributor to the doubled KV surface. */
export const generateStaticParams = productParams;

/* Matches `/store/products/[slug]`. */
export const revalidate = 3600;
