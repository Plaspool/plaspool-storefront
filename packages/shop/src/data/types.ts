export type Material = "PLA" | "PLA+" | "PETG" | "ABS" | "ASA" | "TPU";
export type DiameterMm = 1.75 | 2.85;

/** `hex` drives both the swatch and the generated spool image, so it is the
 *  colour of the filament itself and never a UI colour. */
export interface Colour {
  id: string;
  name: string;
  hex: string;
  inStock: boolean;
  /**
   * The photograph of THIS colour, absolute, or null when nobody has uploaded
   * one. `hex` still drives the swatch and the generated spool either way.
   */
  imageUrl: string | null;
}

export interface SizeOption {
  id: string;
  label: string;
  weightGrams: number;
  /** Whole Naira. */
  priceNaira: number;
  /** Struck-through reference price, or null when there is no discount. */
  compareAtNaira: number | null;
}

/** A quantity ladder. `minQty` ascending, no duplicates. */
export interface BulkTier {
  minQty: number;
  discountPct: number;
}

export interface PrintingParameters {
  extruderTempC: [number, number];
  bedTempC: [number, number];
  printSpeedMmS: [number, number];
  fanPercent: number;
  densityGCm3: number;
  /** Plus/minus, in mm. Rendered as `±0.02 mm`. */
  diameterToleranceMm: number;
  dryingTempC: number;
  dryingHours: number;
  enclosureRequired: boolean;
  /** One plain-language handling warning. eSUN's "do not over-tighten the
   *  extruder on matte PLA" is the model: a sentence that prevents a return. */
  handlingNote: string;
}

export interface Review {
  id: string;
  author: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  /** ISO `YYYY-MM-DD`. A literal string, never `Date.now()` — fixtures must
   *  render identically on the server and the client. */
  publishedAt: string;
  verifiedPurchase: boolean;
}

export type OverviewIcon =
  | "factory" | "ruler" | "truck" | "layers" | "thermometer" | "shield";

export interface OverviewClaim {
  icon: OverviewIcon;
  title: string;
  body: string;
}

/** The Description tab's content, as data rather than markup, so the tab can
 *  be re-rendered from a CMS later without touching the component. */
export type DescriptionBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "table"; caption: string; head: string[]; rows: string[][] }
  | { kind: "figure"; colourHex: string; caption: string };

export type Badge = "Bulk sale" | "New" | "Low stock";

export interface Product {
  slug: string;
  name: string;
  categorySlug: string;
  /**
   * NULLABLE SINCE THE CATALOGUE WENT LIVE. The API has no material column —
   * `materialFrom` in `api.ts` reads it out of `tags` — so a product nobody
   * tagged has no material rather than a defaulted one. A default would put it
   * in a filter bucket it does not belong to, and the material filter is a
   * claim about what the product IS.
   */
  material: Material | null;
  /** Nullable for the same reason: parsed from a free-text option value. */
  diameterMm: DiameterMm | null;
  colours: Colour[];
  sizes: SizeOption[];
  bulkTiers: BulkTier[];
  /**
   * The product's own photographs, absolute and ready to render.
   *
   * ADDED LATE, AND THAT IS THE BUG THEY FIX. The API has sent these since the
   * catalogue went live; this type had no field for them, so `toProduct` threw
   * them away and every surface fell through to the generated `SpoolImage` —
   * meaning a photograph uploaded in the admin was never seen by anybody.
   *
   * `SpoolImage` REMAINS, as the fallback for a product nobody has photographed
   * yet. A shop with a half-filled catalogue should not show holes.
   */
  coverImageUrl: string | null;
  imageUrls: string[];
  badges: Badge[];
  /** One line under the title. Not marketing — what the material is for. */
  summary: string;
  /** Exactly four, shown in the buy box. */
  features: string[];
  overviewClaims: OverviewClaim[];
  description: DescriptionBlock[];
  /**
   * NULL WHEN THERE IS NOTHING TO SHOW. Nine typed printing figures with no
   * column behind any of them; the tab hides rather than rendering a table of
   * plausible-looking numbers on a page somebody buys from.
   */
  parameters: PrintingParameters | null;
  /**
   * The card's star line, and what "Best rated" sorts on.
   *
   * A SUMMARY RATHER THAN THE REVIEWS THEMSELVES. `reviews: Review[]` used to
   * live here and was derived into this shape by `ratingSummary`; that only
   * worked while the catalogue was a fixture carrying its own reviews. Reviews
   * are their own API now, with their own cache window, and a listing needs one
   * number per product rather than every paragraph — so the numbers arrive from
   * `GET /api/public/reviews/aggregates` and the prose is fetched only by the
   * product page that shows it.
   *
   * `count: 0` is the ordinary state and renders NOTHING. A card saying
   * "0.0 (0)" is worse than silence.
   */
  rating: RatingSummary;
  featured: boolean;
  /**
   * `"<colourId>:<sizeId>"` → the API variant that pair names.
   *
   * THE TWO MODELS KEY A LINE DIFFERENTLY, and this is the bridge. A cart line
   * here is a product, a colour and a size; a line in the commerce API is one
   * VARIANT id. Without this map the storefront could render a buy box and had
   * no way to say which of eight variants the customer had actually chosen.
   *
   * Empty for a fixture-free product with no variants, and a missing key is a
   * combination that is not for sale — `add()` refuses rather than guessing.
   */
  variantIds: Record<string, string>;
}

export interface Category {
  slug: string;
  name: string;
  blurb: string;
  /** The tile's spool tint. A filament colour, per the design system. */
  accentHex: string;
  /**
   * Sellable products in this category, counted BY THE API.
   *
   * Here rather than derived by the caller because the alternative is a fetch
   * per tile: `CategoryTiles` renders every category and used to call
   * `listProductsByCategory(slug).length` inside its `.map()`, which against a
   * real API is one subrequest per tile on a runtime with a 50-subrequest cap.
   * `GET /api/shop/categories` already counts them in SQL.
   */
  productCount: number;
}

export interface RatingSummary {
  average: number;
  count: number;
  /** Index 0 is five stars, index 4 is one star. */
  distribution: [number, number, number, number, number];
}
