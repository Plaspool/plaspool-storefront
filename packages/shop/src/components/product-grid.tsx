import type { ReactNode } from "react";
import { PackageSearch } from "lucide-react";
import { cn } from "@plaspool/ui";

import type { Product } from "../data/types";
import { ProductCard } from "./product-card";
import { EmptyState } from "./empty-state";

/**
 * Every grid of products in the store — the home page's featured row, a
 * category listing, a search result.
 *
 * Two columns at 375 px, not one. Filament shopping is comparison shopping,
 * and a single column turns a fourteen-product category into an endless
 * scroll with nothing to compare against.
 */

export interface ProductGridProps {
  products: Product[];
  /** Rendered instead of the default `EmptyState` when there is nothing to
   *  show. Listings supply their own, because "no results for your filters"
   *  and "this category is empty" are different situations. */
  emptyState?: ReactNode;
  className?: string;
}

export function ProductGrid({ products, emptyState, className }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <>
        {emptyState ?? (
          <EmptyState
            icon={<PackageSearch aria-hidden="true" className="h-6 w-6" />}
            title="No spools here yet"
            body="Try PLA or PETG, which carry the widest range of colours and sizes."
          />
        )}
      </>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4", className)}>
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </div>
  );
}
