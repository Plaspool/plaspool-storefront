import { Link } from "../components/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@plaspool/ui";

import { listFeaturedProducts } from "../data/catalog";
import type { CurrencyCode } from "../data/currency-config";
import { ProductGrid } from "../components/product-grid";

/**
 * The featured row. `listFeaturedProducts()` decides what is in it — the home
 * page has no opinion, so a merchandising change never touches this file.
 *
 * "View all" points at `/store/all`, the pseudo-category that means every
 * product. It is the same URL the nav's search submits to.
 */

export async function FeaturedProducts({ currency }: { currency?: CurrencyCode } = {}) {
  const products = await listFeaturedProducts(4, false, currency);

  return (
    <section aria-labelledby="shop-featured" className="border-b border-brand-line">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2
            id="shop-featured"
            className="text-xl font-semibold text-foreground sm:text-2xl"
          >
            Featured spools
          </h2>
          <Link
            href="/store/all"
            className={cn(
              "group inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-brand",
              "underline-offset-4 hover:underline",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            View all
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>

        <ProductGrid products={products} className="mt-6" />
      </div>
    </section>
  );
}
