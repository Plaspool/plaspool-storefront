import type { Product } from "../data/types";
import { priceFrom, ratingSummary } from "../data/money";

/**
 * The listing's URL contract, and the only place it is defined.
 *
 *   ?material=PLA,PETG&colour=obsidian-black&diameter=1.75&weight=1000
 *    &min=15000&max=30000&stock=in&q=matte&sort=price-asc
 *
 * Filter state lives in the URL and nowhere else: the grid stays server
 * rendered, a filtered view is shareable, and the back button undoes a filter.
 * Controls read `useSearchParams()` and write through `serialiseFilters`;
 * none of them keeps a local mirror.
 */

export const SORT_KEYS = [
  "featured",
  "price-asc",
  "price-desc",
  "name-asc",
  "rating-desc",
] as const;

export type SortKey = (typeof SORT_KEYS)[number];

export const SORT_LABELS: Record<SortKey, string> = {
  featured: "Featured",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  "name-asc": "Name: A to Z",
  "rating-desc": "Best rated",
};

export interface Filters {
  materials: string[];
  colours: string[];
  diameters: number[];
  weights: number[];
  minPrice: number | null;
  maxPrice: number | null;
  inStockOnly: boolean;
  query: string;
  sort: SortKey;
}

export interface Facets {
  materials: { value: string; count: number }[];
  colours: { id: string; name: string; hex: string; count: number }[];
  diameters: { value: number; count: number }[];
  weights: { value: number; count: number }[];
  priceBounds: [number, number];
}

/** Tolerant by design: a hand-edited or stale URL yields the unfiltered view
 *  rather than an error page. Unknown values are dropped, never thrown on. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) as string | undefined;
  const many = (k: string) =>
    (one(k) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const int = (k: string) => {
    const n = Number.parseInt(one(k) ?? "", 10);
    return Number.isFinite(n) ? n : null;
  };
  const sort = one("sort");
  return {
    materials: many("material"),
    colours: many("colour"),
    diameters: many("diameter")
      .map(Number)
      .filter((n) => n === 1.75 || n === 2.85),
    weights: many("weight").map(Number).filter(Number.isFinite),
    minPrice: int("min"),
    maxPrice: int("max"),
    inStockOnly: one("stock") === "in",
    query: (one("q") ?? "").trim(),
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : "featured",
  };
}

/** The exact inverse, minus every default. A URL that says nothing means the
 *  unfiltered view, so `sort=featured`, `stock=out` and empty lists never
 *  appear — two routes to the same view would split the shareable link. */
export function serialiseFilters(f: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (f.materials.length) params.set("material", f.materials.join(","));
  if (f.colours.length) params.set("colour", f.colours.join(","));
  if (f.diameters.length) params.set("diameter", f.diameters.join(","));
  if (f.weights.length) params.set("weight", f.weights.join(","));
  if (f.minPrice !== null) params.set("min", String(f.minPrice));
  if (f.maxPrice !== null) params.set("max", String(f.maxPrice));
  if (f.inStockOnly) params.set("stock", "in");
  if (f.query) params.set("q", f.query);
  if (f.sort !== "featured") params.set("sort", f.sort);
  return params;
}

/** Everything except `sort` and `q`, which have their own controls. Drives the
 *  drawer trigger's badge and whether "Clear all" is offered. */
export function activeFilterCount(f: Filters): number {
  return (
    f.materials.length +
    f.colours.length +
    f.diameters.length +
    f.weights.length +
    (f.minPrice !== null ? 1 : 0) +
    (f.maxPrice !== null ? 1 : 0) +
    (f.inStockOnly ? 1 : 0)
  );
}

export function formatWeight(grams: number): string {
  return grams >= 1000 ? `${grams / 1000} kg` : `${grams} g`;
}

export function formatDiameter(mm: number): string {
  return `${mm} mm`;
}

export function applyFilters(products: Product[], f: Filters): Product[] {
  const query = f.query.toLowerCase();

  const filtered = products.filter((p) => {
    /* A NULL MATERIAL MATCHES NO MATERIAL FILTER, and that is the point of it
       being nullable: the API has no material column, so `materialFrom` reads
       one out of `tags` and answers null when no tag names one. Treating null as
       a match would put an unclassified spool in every bucket; defaulting it to
       a material upstream would put it in one wrong bucket. Excluded from the
       filter, it is still reachable unfiltered, which is the honest state. */
    if (f.materials.length && (p.material === null || !f.materials.includes(p.material)))
      return false;
    if (f.colours.length && !p.colours.some((c) => f.colours.includes(c.id))) return false;
    if (f.diameters.length && (p.diameterMm === null || !f.diameters.includes(p.diameterMm)))
      return false;
    if (f.weights.length && !p.sizes.some((s) => f.weights.includes(s.weightGrams))) return false;

    const price = priceFrom(p);
    if (f.minPrice !== null && price < f.minPrice) return false;
    if (f.maxPrice !== null && price > f.maxPrice) return false;

    if (f.inStockOnly && !p.colours.some((c) => c.inStock)) return false;

    if (query) {
      /* `?? ""` and not template interpolation: a null material would stringify
         to the literal "null" and make every unclassified product a hit for the
         search term "null". */
      const haystack = `${p.name} ${p.summary} ${p.material ?? ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  return sortProducts(filtered, f.sort);
}

function sortProducts(products: Product[], sort: SortKey): Product[] {
  const out = [...products];
  switch (sort) {
    case "price-asc":
      return out.sort((a, b) => priceFrom(a) - priceFrom(b));
    case "price-desc":
      return out.sort((a, b) => priceFrom(b) - priceFrom(a));
    case "name-asc":
      return out.sort((a, b) => a.name.localeCompare(b.name));
    case "rating-desc":
      /* A product nobody has reviewed averages 0, which would otherwise put it
         above a 4.8 under a naive descending sort. Zero-review products go
         last, in their catalog order. */
      return out.sort((a, b) => {
        const ra = ratingSummary(a.reviews);
        const rb = ratingSummary(b.reviews);
        if (!ra.count && !rb.count) return 0;
        if (!ra.count) return 1;
        if (!rb.count) return -1;
        return rb.average - ra.average;
      });
    case "featured":
    default:
      /* Featured first, then catalog order — the merchandising order the
         fixtures already encode. */
      return out.sort((a, b) => Number(b.featured) - Number(a.featured));
  }
}

/** Counts come from the category's own products, so the rail only ever offers
 *  a filter that can return something. */
export function facetsFor(products: Product[]): Facets {
  const materials = new Map<string, number>();
  const colours = new Map<string, { id: string; name: string; hex: string; count: number }>();
  const diameters = new Map<number, number>();
  const weights = new Map<number, number>();

  for (const p of products) {
    /* Only counted when known. A `null` facet would render a checkbox with no
       label that selects nothing, which is worse than the option being absent —
       and `applyFilters` above cannot match it anyway. */
    if (p.material !== null) materials.set(p.material, (materials.get(p.material) ?? 0) + 1);
    if (p.diameterMm !== null)
      diameters.set(p.diameterMm, (diameters.get(p.diameterMm) ?? 0) + 1);

    for (const colour of new Map(p.colours.map((c) => [c.id, c])).values()) {
      const existing = colours.get(colour.id);
      if (existing) existing.count += 1;
      else
        colours.set(colour.id, {
          id: colour.id,
          name: colour.name,
          hex: colour.hex,
          count: 1,
        });
    }

    for (const grams of new Set(p.sizes.map((s) => s.weightGrams))) {
      weights.set(grams, (weights.get(grams) ?? 0) + 1);
    }
  }

  const prices = products.map(priceFrom);

  return {
    materials: [...materials.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value)),
    colours: [...colours.values()].sort((a, b) => a.name.localeCompare(b.name)),
    diameters: [...diameters.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value - b.value),
    weights: [...weights.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value - b.value),
    priceBounds: prices.length
      ? [Math.min(...prices), Math.max(...prices)]
      : [0, 0],
  };
}
