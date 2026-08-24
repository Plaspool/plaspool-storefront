"use client";

import { useMemo } from "react";
import { Link } from "../components/link";
import { useSearchParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { Button } from "@plaspool/ui";

import type { Product } from "../data/types";
import { ProductGrid } from "../components/product-grid";
import { EmptyState } from "../components/empty-state";
import { applyFilters, parseFilters } from "./filter-state";

/**
 * The grid, filtered where it is CHEAP to filter (#9).
 *
 * The listing page used to await `searchParams` on the server, which quietly
 * made every `/store/[category]` request — including plain `/store/all` with
 * no query at all — a full dynamic render on the Worker. The build summary
 * claimed SSG; the prerender manifest said otherwise. On the free plan's
 * 10ms CPU budget, rebuilding a 38-product grid of inline SVGs per request
 * was the Error 1102.
 *
 * Now the page reads no request state at all, so it prerenders and is served
 * from the incremental cache without rendering anything. This component
 * hydrates over the server-rendered unfiltered grid and applies the URL's
 * filters in the browser, where the same work is measured in microseconds
 * against a 38-item array.
 *
 * THE URL CONTRACT DID NOT MOVE — `filter-state.ts` still owns it, and the
 * functions running here are the same pure `parseFilters`/`applyFilters` the
 * server used to call. Only the execution site changed; there is no second
 * implementation to drift.
 *
 * What is genuinely given up: a filtered URL's HTML no longer contains the
 * filtered result — crawlers see the full category grid instead. For faceted
 * navigation that trade is close to free (filtered permutations are crawl
 * traps more often than they are landing pages), and the unfiltered listing
 * — the page that actually ranks — is now byte-identical static HTML.
 *
 * While the page prerenders, `useSearchParams()` bails to the Suspense
 * fallback — which the page sets to this SAME markup, unfiltered. Static
 * HTML and hydrated no-query render therefore agree exactly; the swap is
 * invisible until a query string makes them differ, which is the point.
 */
export function FilteredGrid({
  base,
  clearHref,
  emptyState,
}: {
  /** The category's full product list, in catalog order. */
  base: Product[];
  /** Where "Clear all filters" points — the category's own bare URL. */
  clearHref: string;
  /** The category-is-empty state, server-decided; filtered-empty is ours. */
  emptyState?: React.ReactNode;
}) {
  const searchParams = useSearchParams();

  const { products, filtered } = useMemo(() => {
    const filters = parseFilters(Object.fromEntries(searchParams.entries()));
    return {
      products: applyFilters(base, filters),
      filtered: searchParams.size > 0,
    };
  }, [base, searchParams]);

  if (base.length === 0) return <>{emptyState}</>;

  return (
    <>
      {/* Only when a filter changed the answer: the header's static count
          keeps naming the category's size. */}
      {filtered && (
        <p className="mb-4 font-mono text-sm text-muted-foreground" role="status">
          {products.length} of {base.length}{" "}
          {base.length === 1 ? "product" : "products"} match
        </p>
      )}
      <ProductGrid
        products={products}
        emptyState={
          <EmptyState
            icon={<SearchX aria-hidden="true" className="h-6 w-6" />}
            title="No spools match these filters"
            body="Try widening the price range or clearing a colour."
            action={
              <Button asChild variant="outline">
                <Link href={clearHref}>Clear all filters</Link>
              </Button>
            }
          />
        }
      />
    </>
  );
}
