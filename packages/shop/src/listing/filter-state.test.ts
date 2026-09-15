import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  applyFilters,
  facetsFor,
  parseFilters,
  serialiseFilters,
  type Filters,
} from "./filter-state";
import type { Product } from "../data/types";

function product(over: Partial<Product> = {}): Product {
  return {
    slug: "spool",
    name: "Spool",
    overview: "A spool",
    material: "PLA",
    diameterMm: 1.75,
    featured: false,
    rating: { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] },
    colours: [{ id: "black", name: "Black", hex: "#000000", inStock: true, imageUrl: null }],
    sizes: [
      { id: "1kg", label: "1 kg", weightGrams: 1000, priceMinor: 1850000, compareAtMinor: null, currency: "NGN" as const },
    ],
    ...over,
  } as Product;
}

describe("parseFilters", () => {
  /* Tolerant by design: a hand-edited or stale URL must yield the unfiltered
     view, never an error page. */
  it("yields the unfiltered view for an empty query string", () => {
    expect(parseFilters({})).toEqual({
      materials: [],
      colours: [],
      diameters: [],
      weights: [],
      minPrice: null,
      maxPrice: null,
      inStockOnly: false,
      query: "",
      sort: "featured",
    });
  });

  it("splits comma lists and trims, dropping empties", () => {
    const f = parseFilters({ material: "PLA, PETG ,", colour: "obsidian-black" });
    expect(f.materials).toEqual(["PLA", "PETG"]);
    expect(f.colours).toEqual(["obsidian-black"]);
  });

  it("drops a diameter the catalogue does not stock rather than throwing", () => {
    expect(parseFilters({ diameter: "1.75,3.00,banana" }).diameters).toEqual([1.75]);
  });

  it("falls back to the default sort for an unknown key", () => {
    expect(parseFilters({ sort: "price-asc" }).sort).toBe("price-asc");
    expect(parseFilters({ sort: "cheapest-first" }).sort).toBe("featured");
  });

  it("reads only `stock=in` as the in-stock filter", () => {
    expect(parseFilters({ stock: "in" }).inStockOnly).toBe(true);
    expect(parseFilters({ stock: "out" }).inStockOnly).toBe(false);
    expect(parseFilters({ stock: "true" }).inStockOnly).toBe(false);
  });

  it("treats an unparseable price bound as absent, not as zero", () => {
    expect(parseFilters({ min: "abc" }).minPrice).toBeNull();
    expect(parseFilters({ min: "0" }).minPrice).toBe(0);
  });

  it("takes the first value when a param repeats", () => {
    expect(parseFilters({ q: ["matte", "gloss"] }).query).toBe("matte");
  });
});

describe("serialiseFilters", () => {
  /* Two routes to the same view would split the shareable link, so every
     default is omitted. */
  it("omits every default", () => {
    expect(serialiseFilters(parseFilters({})).toString()).toBe("");
    expect(serialiseFilters({ ...parseFilters({}), inStockOnly: false }).toString()).toBe("");
  });

  it("round-trips through parseFilters", () => {
    const original: Filters = {
      materials: ["PLA", "PETG"],
      colours: ["obsidian-black"],
      diameters: [1.75],
      weights: [1000],
      minPrice: 15000,
      maxPrice: 30000,
      inStockOnly: true,
      query: "matte",
      sort: "price-asc",
    };
    const params = serialiseFilters(original);
    expect(parseFilters(Object.fromEntries(params))).toEqual(original);
  });
});

describe("activeFilterCount", () => {
  it("counts facets but not sort or search, which have their own controls", () => {
    const f = parseFilters({ material: "PLA,PETG", min: "1000", stock: "in", q: "matte", sort: "name-asc" });
    expect(activeFilterCount(f)).toBe(4);
  });
});

describe("applyFilters", () => {
  /* A product with no material tag matches NO material filter — it is not in
     every bucket and not silently in one wrong bucket. */
  it("excludes an unclassified product from a material filter", () => {
    const unclassified = product({ slug: "mystery", material: null });
    const pla = product({ slug: "pla" });
    const out = applyFilters([unclassified, pla], parseFilters({ material: "PLA" }));
    expect(out.map((p) => p.slug)).toEqual(["pla"]);
  });

  it("still reaches an unclassified product unfiltered", () => {
    const unclassified = product({ slug: "mystery", material: null });
    expect(applyFilters([unclassified], parseFilters({}))).toHaveLength(1);
  });

  /* `${p.material}` would stringify null to the literal "null" and make every
     unclassified product a hit for the search term "null". */
  it("does not match the literal string \"null\" against a null material", () => {
    const unclassified = product({ slug: "mystery", material: null, name: "Mystery", overview: "" });
    expect(applyFilters([unclassified], parseFilters({ q: "null" }))).toEqual([]);
  });

  it("filters on the cheapest size, matching the price the card shows", () => {
    const p = product({
      sizes: [
        { id: "1kg", label: "1 kg", weightGrams: 1000, priceMinor: 1850000, compareAtMinor: null, currency: "NGN" as const },
        { id: "250g", label: "250 g", weightGrams: 250, priceMinor: 650000, compareAtMinor: null, currency: "NGN" as const },
      ],
    });
    expect(applyFilters([p], parseFilters({ max: "10000" }))).toHaveLength(1);
    expect(applyFilters([p], parseFilters({ min: "10000" }))).toEqual([]);
  });

  it("excludes a product with no colour in stock", () => {
    const soldOut = product({
      slug: "sold-out",
      colours: [{ id: "black", name: "Black", hex: "#000000", inStock: false, imageUrl: null }],
    });
    expect(applyFilters([soldOut, product()], parseFilters({ stock: "in" })).map((p) => p.slug)).toEqual(["spool"]);
  });

  /* A product nobody has reviewed averages 0, which a naive descending sort
     would rank above a 4.8. Zero-review products go last. */
  it("sorts unreviewed products last under rating-desc, not first", () => {
    const unreviewed = product({ slug: "new", rating: { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] } });
    const great = product({ slug: "great", rating: { average: 4.8, count: 20, distribution: [0, 0, 0, 0, 0] } });
    const ok = product({ slug: "ok", rating: { average: 3.1, count: 4, distribution: [0, 0, 0, 0, 0] } });
    const out = applyFilters([unreviewed, ok, great], parseFilters({ sort: "rating-desc" }));
    expect(out.map((p) => p.slug)).toEqual(["great", "ok", "new"]);
  });

  it("does not mutate the array it was given", () => {
    const input = [product({ slug: "b", name: "B" }), product({ slug: "a", name: "A" })];
    applyFilters(input, parseFilters({ sort: "name-asc" }));
    expect(input.map((p) => p.slug)).toEqual(["b", "a"]);
  });
});

describe("facetsFor", () => {
  /* The rail must only ever offer a filter that can return something. */
  it("counts only known facet values", () => {
    const facets = facetsFor([product(), product({ slug: "mystery", material: null, diameterMm: null })]);
    expect(facets.materials).toEqual([{ value: "PLA", count: 1 }]);
    expect(facets.diameters).toEqual([{ value: 1.75, count: 1 }]);
  });

  it("counts a colour once per product, not once per variant", () => {
    const twice = product({
      colours: [
        { id: "black", name: "Black", hex: "#000000", inStock: true, imageUrl: null },
        { id: "black", name: "Black", hex: "#000000", inStock: false, imageUrl: null },
      ],
    });
    expect(facetsFor([twice]).colours).toEqual([
      { id: "black", name: "Black", hex: "#000000", count: 1 },
    ]);
  });

  it("reports [0, 0] price bounds for an empty catalogue rather than ±Infinity", () => {
    expect(facetsFor([]).priceBounds).toEqual([0, 0]);
  });
});

describe("facetsFor with a mystery box", () => {
  it("offers no colour facet for a box's nameless placeholder colour", () => {
    const box = product({
      slug: "box",
      boxMode: "pack",
      colours: [{ id: "default", name: "", hex: "#8a8a94", inStock: true, imageUrl: null }],
    });
    expect(facetsFor([product(), box]).colours.map((c) => c.id)).toEqual(["black"]);
  });
});
