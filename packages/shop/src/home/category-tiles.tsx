import { Link } from "../components/link";
import { cn } from "@plaspool/ui";

import { listCategories } from "../data/catalog";
import { SpoolImage } from "../components/spool-image";

/**
 * The six categories, as the second thing on the page — the fastest route
 * from "I need filament" to a listing.
 *
 * `support` carries no products today and still links. Its listing page is
 * the designed empty state, and an empty category that quietly disappears
 * from the nav is worse than one that tells you it is empty.
 */

export async function CategoryTiles() {
  const categories = await listCategories();

  return (
    <section aria-labelledby="shop-categories" className="border-b border-brand-line">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
        <h2
          id="shop-categories"
          className="font-sans text-xl font-semibold text-foreground sm:text-2xl"
        >
          Shop by material
        </h2>
        <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {categories.map((category) => {
            /* Counted by the API, not by a fetch per tile. See
               `Category.productCount` — the old `listProductsByCategory().length`
               here became one subrequest per tile the moment this stopped being
               a local array. */
            const count = category.productCount;
            return (
              <li key={category.slug}>
                <Link
                  href={`/store/${category.slug}`}
                  className={cn(
                    "flex h-full flex-col items-center rounded-lg border border-brand-line bg-background p-3 text-center",
                    /* The tile keeps its `bg-background` ground on hover:
                       `SpoolImage` fills its flange and bore with the
                       background colour, so tinting the tile would leave the
                       spool sitting in a pale hole. The border carries the
                       hover instead. */
                    "transition-colors hover:border-brand motion-reduce:transition-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                >
                  {/* Hidden from the accessible tree: the tile's own text is
                      already the link's name, and a second reading of the
                      category as a spool adds nothing. */}
                  <span aria-hidden="true" className="block w-20">
                    <SpoolImage
                      colourHex={category.accentHex}
                      weightGrams={1000}
                      label={`${category.name} spool`}
                    />
                  </span>
                  <span className="mt-2 font-sans text-sm font-semibold text-foreground">
                    {category.name}
                  </span>
                  <span className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                    {count} {count === 1 ? "product" : "products"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
