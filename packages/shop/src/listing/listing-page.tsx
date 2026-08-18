import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { Button, cn } from "@plaspool/ui";

import { categoryPaths, getCategory, listProducts, listProductsByCategory } from "../data/catalog";
import { Breadcrumb } from "../components/breadcrumb";
import { EmptyState } from "../components/empty-state";
import { ProductGrid } from "../components/product-grid";
import { applyFilters, facetsFor, parseFilters } from "./filter-state";
import { FilteredGrid } from "./filtered-grid";
import { FilterRail } from "./filter-rail";
import { FilterDrawer } from "./filter-drawer";
import { ListingSearch } from "./listing-search";
import { SortSelect } from "./sort-select";

/**
 * `/store/[category]` — the listing.
 *
 * STATIC, AND THAT IS THE FIX FOR #9. This page used to await
 * `searchParams`, and in the App Router that single read makes the whole
 * route dynamic at runtime — the build summary printed ● SSG, but the
 * prerender manifest told the truth: `/store/all` was in neither `routes`
 * nor `dynamicRoutes`, so EVERY visit was a full server render of the
 * heaviest page in the store. On the Workers free plan's 10ms CPU budget
 * that was Error 1102 roughly once in twenty requests.
 *
 * Now nothing here reads request state. The page prerenders for every
 * category (plus `all`), revalidates on the 300s window, and is served from
 * the incremental cache without executing a render. Filtering moved into
 * `FilteredGrid`, which applies the SAME `filter-state.ts` functions over
 * the same fixture array in the browser. Every filter control was already a
 * client component that only rewrites the URL; they now sit in Suspense
 * boundaries because a static page requires it of `useSearchParams`
 * readers.
 *
 * `all` is a pseudo-category meaning every product. The nav search submits
 * to `/store/all?q=…` and "View all" links here, so it is a real route and
 * is statically generated alongside the real categories.
 */

const ALL_META = { name: "All filament", blurb: "Every spool we make." };

async function metaFor(category: string) {
  return category === "all" ? ALL_META : await getCategory(category);
}

export async function categoryMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const meta = await metaFor(category);
  if (!meta) return {};
  return {
    /* Not "<name> filament": the category names already read as materials,
       and "All filament" and "Support material" would both double a word. */
    title: `${meta.name} — PlaSpool`,
    description: meta.blurb,
    alternates: { canonical: `/store/${category}` },
  };
}

export async function categoryParams(): Promise<{ category: string }[]> {
  /* The pseudo-category is generated too, so `/store/all` is not a
     runtime-only route. */
  return [...(await categoryPaths()), { category: "all" }];
}

export async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;

  const isAll = category === "all";
  /* Both reads at once: the category header and the grid are independent
     fetches and serialising them would put one latency behind the other for no
     reason. The blog's pages use the same `Promise.all` shape. */
  const [meta, base] = await Promise.all([
    metaFor(category),
    isAll ? listProducts() : listProductsByCategory(category),
  ]);
  if (!meta) notFound();

  const facets = facetsFor(base);

  /* The default presentation — featured first, catalog order after — is what
     the static HTML carries and what the Suspense fallback shows, so the
     hydration swap is invisible until a query string makes the views differ. */
  const defaultOrder = applyFilters(base, parseFilters({}));

  const categoryEmpty = base.length === 0;

  /* A category with nothing in it yet (`support` today) is not a filter that
     matched nothing; that second state lives in FilteredGrid with the
     filters themselves. */
  const categoryEmptyState = (
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
        {/* The category's size — static on purpose. When filters narrow the
            view, FilteredGrid announces the match count beside the grid. */}
        <p className="font-mono text-sm text-muted-foreground">
          {base.length} {base.length === 1 ? "product" : "products"}
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
            added later cannot appear in one and not the other. Each control
            sits in its own Suspense boundary: they read `useSearchParams`,
            and on a static page that read must have a fallback to bail to.
            The fallbacks are fixed-size ghosts, so nothing shifts when the
            controls hydrate in. */}
        {!categoryEmpty && (
          <aside className="hidden md:block">
            <Suspense fallback={<div aria-hidden="true" className="min-h-[24rem]" />}>
              <FilterRail facets={facets} />
            </Suspense>
          </aside>
        )}

        <div className="min-w-0">
          {!categoryEmpty && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Suspense
                fallback={
                  <div aria-hidden="true" className="h-10 w-28 rounded-md border md:hidden" />
                }
              >
                <FilterDrawer facets={facets} className="md:hidden" />
              </Suspense>
              <Suspense
                fallback={
                  <div aria-hidden="true" className="h-10 rounded-md border sm:flex-1" />
                }
              >
                <ListingSearch className="sm:flex-1" />
              </Suspense>
              <Suspense
                fallback={<div aria-hidden="true" className="h-10 w-44 rounded-md border" />}
              >
                <SortSelect />
              </Suspense>
            </div>
          )}

          <div className={cn(!categoryEmpty && "mt-6")}>
            {/* The fallback IS the page: the full grid in default order (or
                the category's own empty state), server-rendered into the
                static HTML. FilteredGrid replaces it on hydration with the
                same markup — or the filtered view, when the URL carries
                one. */}
            <Suspense
              fallback={
                categoryEmpty ? categoryEmptyState : <ProductGrid products={defaultOrder} />
              }
            >
              <FilteredGrid
                base={base}
                clearHref={`/store/${category}`}
                emptyState={categoryEmptyState}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CategoryPage;
