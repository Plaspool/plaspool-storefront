import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageSearch, SearchX } from "lucide-react";
import { Button, cn } from "@plaspool/ui";

import { categoryPaths, getCategory, listProducts, listProductsByCategory } from "../data/catalog";
import { Breadcrumb } from "../components/breadcrumb";
import { EmptyState } from "../components/empty-state";
import { ProductGrid } from "../components/product-grid";
import { applyFilters, facetsFor, parseFilters } from "./filter-state";
import { FilterRail } from "./filter-rail";
import { FilterDrawer } from "./filter-drawer";
import { ListingSearch } from "./listing-search";
import { SortSelect } from "./sort-select";

/**
 * `/store/[category]` — the listing.
 *
 * A server component. The grid is rendered on the server from the URL's search
 * params, so a filtered view is shareable and crawlable; the rail, drawer,
 * search box and sort select are the only client code, and all four do nothing
 * but rewrite the URL.
 *
 * `all` is a pseudo-category meaning every product. Task 6's nav search submits
 * to `/store/all?q=…` and Task 8's "View all" links to `/store/all`, so it is
 * a real route and is statically generated alongside the six real categories.
 */

const ALL_META = { name: "All filament", blurb: "Every spool we make." };

function metaFor(category: string) {
  return category === "all" ? ALL_META : getCategory(category);
}

export async function categoryMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const meta = metaFor(category);
  if (!meta) return {};
  return {
    /* Not "<name> filament": the category names already read as materials,
       and "All filament" and "Support material" would both double a word. */
    title: `${meta.name} — PlaSpool`,
    description: meta.blurb,
    alternates: { canonical: `/store/${category}` },
  };
}

export function categoryParams(): { category: string }[] {
  /* The pseudo-category is generated too, so `/store/all` is not a
     runtime-only route. */
  return [...categoryPaths(), { category: "all" }];
}

export async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { category } = await params;
  const filters = parseFilters(await searchParams);

  const isAll = category === "all";
  const meta = metaFor(category);
  if (!meta) notFound();

  const base = isAll ? listProducts() : listProductsByCategory(category);
  const products = applyFilters(base, filters);
  const facets = facetsFor(base);

  /* Two different situations, two different empty states. A category with
     nothing in it yet (`support` today) is not the same as a filter that
     matched nothing, and collapsing them would tell a shopper to clear
     filters they never set. */
  const categoryEmpty = base.length === 0;

  const emptyState = categoryEmpty ? (
    <EmptyState
      icon={<PackageSearch aria-hidden="true" className="h-6 w-6" />}
      title="No products in this category yet"
      body="We're still bringing support materials to market. Browse PLA and PETG in the meantime."
      action={
        <Button asChild>
          <Link href="/store/pla">Browse PLA</Link>
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={<SearchX aria-hidden="true" className="h-6 w-6" />}
      title="No spools match these filters"
      body="Try widening the price range or clearing a colour."
      action={
        <Button asChild variant="outline">
          <Link href={`/store/${category}`}>Clear all filters</Link>
        </Button>
      }
    />
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-10 lg:px-8">
      <Breadcrumb
        trail={[
          { label: "Home", href: "/" },
          { label: "Store", href: "/store" },
          { label: meta.name },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-sans text-2xl font-semibold text-foreground sm:text-3xl">
          {meta.name}
        </h1>
        <p className="font-mono text-sm text-muted-foreground">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{meta.blurb}</p>

      {/* A category with nothing in it has nothing to filter, sort or search:
          every facet would be empty and every control a dead end. The empty
          state is the whole page. */}
      <div
        className={cn(
          "mt-8 grid gap-8",
          !categoryEmpty && "md:grid-cols-[16rem_1fr]",
        )}
      >
        {/* The rail and the drawer render the same `FilterRail`, so a group
            added later cannot appear in one and not the other. */}
        {!categoryEmpty && (
          <aside className="hidden md:block">
            <FilterRail facets={facets} />
          </aside>
        )}

        <div className="min-w-0">
          {!categoryEmpty && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <FilterDrawer facets={facets} className="md:hidden" />
              <ListingSearch className="sm:flex-1" />
              <SortSelect />
            </div>
          )}

          <div className={cn(!categoryEmpty && "mt-6")}>
            <ProductGrid products={products} emptyState={emptyState} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CategoryPage;
