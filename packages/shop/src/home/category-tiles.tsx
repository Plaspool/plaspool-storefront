import { Link } from "../components/link";
import { cn } from "@plaspool/ui";

import { listCategories } from "../data/catalog";
import { SpoolImage } from "../components/spool-image";

/**
 * The categories, as the second thing on the page — the fastest route from
 * "I need filament" to a listing.
 *
 * A category carrying no products still links. Its listing page is the
 * designed empty state, and an empty category that quietly disappears from
 * the nav is worse than one that tells you it is empty.
 *
 * THE HEADING SAYS "category" BECAUSE THAT IS WHAT THE API RETURNS. It read
 * "Shop by material" while the catalogue had a category per material — the
 * same rot `catalog.ts` records about the hero's old `/store/pla` button, and
 * it went unnoticed for the same reason: a string literal describing data it
 * never reads cannot fail a build. The categories collapsed to a single
 * `filament`, which is not a material, and the heading was left describing a
 * shelf that no longer exists.
 */

export async function CategoryTiles() {
  const categories = await listCategories();

  /*
   * ONE TILE IS NOT A CHOICE, so there is nothing to shop BY. This section is a
   * chooser; below two categories it is a heading over a single link that goes
   * exactly where the hero's primary button above it already goes —
   * `primaryCategoryLink()` picks the same first category — stacked on top of a
   * product count that is currently "0 products".
   *
   * Rendering nothing is the honest state, and it is how three of this page's
   * other sections already behave: `home-page.tsx` is composed so that any of
   * them dropping out leaves a shorter page rather than a gap. The section
   * returns on its own the moment a second category exists, so nothing here has
   * to be edited again when the shelf refills.
   */
  if (categories.length < 2) return null;

  return (
    <section aria-labelledby="shop-categories" className="border-b border-brand-line">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
        <h2
          id="shop-categories"
          className="text-xl font-semibold text-foreground sm:text-2xl"
        >
          Shop by category
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
                  <span className="mt-2 text-sm font-semibold text-foreground">
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
