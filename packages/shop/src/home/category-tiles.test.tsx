import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { CategoryTiles } from "./category-tiles";
import type { ApiCategory } from "../data/api";

/**
 * WHAT THE SECOND SECTION OF `/store` SAYS, AND WHEN IT IS ENTITLED TO SAY IT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BOTH ASSERTIONS EXIST BECAUSE OF THE SAME DEFECT, WHICH SHIPPED TWICE.
 *
 * The heading read "Shop by material" and the grid rendered unconditionally.
 * Both were written when the catalogue had a category per material, and both
 * were string-and-shape decisions about data neither of them read — so when
 * the categories collapsed to a single `filament`, nothing failed. The store
 * home page simply started announcing "Shop by material" over one tile named
 * after a category, counting "0 products". `catalog.ts` records the identical
 * rot in the hero's old hardcoded `/store/pla` button.
 *
 * A COPY TEST LOOKS PEDANTIC UNTIL YOU NOTICE THE FAILURE MODE: there is no
 * build error, no type error and no 404 for a heading that describes a shelf
 * that no longer exists. The bytes are the only place it is visible.
 *
 * Rendered through `react-dom/server` rather than jsdom, the way
 * `line-thumb.test.tsx` next door does it: these are Server Components, so
 * that is how they actually run.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function category(over: Partial<ApiCategory> & { slug: string }): ApiCategory {
  return {
    name: over.slug,
    blurb: "",
    accentHex: null,
    position: 0,
    count: 0,
    ...over,
  } as ApiCategory;
}

/** `/api/shop/categories` answering with exactly these, the way the live one
 *  does: `{ items: [...] }`. */
function serving(items: ApiCategory[]) {
  global.fetch = vi.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ items }),
      }) as Response,
  ) as unknown as typeof fetch;
}

async function markup() {
  return renderToStaticMarkup(await CategoryTiles());
}

describe("CategoryTiles", () => {
  it("names the thing it is grouping by, which is a category", async () => {
    serving([
      category({ slug: "pla", name: "PLA", count: 12 }),
      category({ slug: "petg", name: "PETG", count: 4 }),
    ]);

    const html = await markup();

    expect(html).toContain("Shop by category");
    /* The heading it replaced. `Material` is still a legitimate FILTER — see
       `filter-rail.tsx` — but it is not what this grid groups by, and this
       section must not claim otherwise again. */
    expect(html).not.toMatch(/material/i);
  });

  it("renders a tile per category, each linking to its listing", async () => {
    serving([
      category({ slug: "pla", name: "PLA", count: 12 }),
      category({ slug: "petg", name: "PETG", count: 1 }),
    ]);

    const html = await markup();

    expect(html).toContain('href="/store/pla"');
    expect(html).toContain('href="/store/petg"');
    expect(html).toContain("12 products");
    /* Singular, because "1 products" is the tell of a count that was never
       read by anybody who wrote it. */
    expect(html).toContain("1 product<");
  });

  it("disappears below two categories, because one tile is not a choice", async () => {
    serving([category({ slug: "filament", name: "Filament", count: 0 })]);

    expect(await CategoryTiles()).toBeNull();
    expect(await markup()).toBe("");
  });

  it("disappears when the catalogue has no categories at all", async () => {
    serving([]);

    expect(await CategoryTiles()).toBeNull();
  });

  it("disappears rather than throwing when the commerce API is unreachable", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    expect(await CategoryTiles()).toBeNull();
  });
});
