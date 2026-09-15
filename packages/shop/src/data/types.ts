import type { CurrencyCode } from "./currency-config";

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
  /**
   * MINOR UNITS, in `currency` — not whole naira.
   *
   * ═══ THIS FIELD WAS `priceNaira`, AND THE RENAME IS THE POINT ═══
   * It held `Math.round(minor / 100)` with the currency thrown away, which was
   * exactly right for a shop that could only charge naira and is a silent
   * mispricing for one that can charge dollars: $49.99 became the number 50,
   * and every render printed `₦50`. Not an error, not a `NaN` — a plausible
   * price, in the wrong currency, in the wrong denomination.
   *
   * Minor units are also the only honest place to apply a bulk rung: the
   * ladder is basis points, and rounding to a whole unit BEFORE taking a
   * percentage off it loses a hundredth of the precision the server keeps.
   */
  priceMinor: number;
  /** Struck-through reference, minor units in the same `currency`, or null
   *  when there is no discount. */
  compareAtMinor: number | null;
  /** What `priceMinor` and `compareAtMinor` are denominated in. Read off the
   *  variant's own `price.currency` — never assumed, never inferred from the
   *  shop's default. */
  currency: CurrencyCode;
  /**
   * MYSTERY BOXES ONLY: how many surprise items one box holds — the promise the
   * size button makes. Null on an ordinary size, and null on a box size whose
   * pool the owner has not set up yet, which cannot be sold.
   *
   * Optional so a fixture need not spell it; `sizesFrom` always sets it, and
   * `boxItemCountOf` in `mystery-box.ts` is the one reader.
   */
  boxItemCount?: number | null;
}

/**
 * How the admin assembles a mystery box. Only `null` versus non-null matters
 * to a shopper: `"built"` and `"auto"` are later admin phases and change
 * nothing on this side, so no surface may branch on which one it is.
 */
export type BoxMode = "pack" | "built" | "auto";

/** A quantity ladder. `minQty` ascending, no duplicates. */
/**
 * One rung of the quantity ladder, as the API resolves it.
 *
 * `percentBps` IS BASIS POINTS — 10000 is 100%, so 1000 is 10%. This field was
 * `discountPct` (a whole-number percentage) while the ladder was a storefront
 * policy constant; the two differ by a factor of a hundred, so anything still
 * reading the old spelling quotes a 1000% discount. `percentFromBps` in
 * `bulk.ts` is the one place that conversion happens.
 *
 * The ladder arrives ASCENDING BY `minQty` and ALREADY RESOLVED: the store-wide
 * default, any per-product override and the on/off switch have all been applied
 * server-side. An empty ladder means this product has no bulk discount, which is
 * a complete answer and never a reason to substitute one of our own.
 */
export interface BulkTier {
  minQty: number;
  percentBps: number;
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

export type Badge = "Bulk sale" | "New" | "Low stock" | "Sale";

export interface Product {
  slug: string;
  name: string;
  /**
   * Non-null when the owner has switched this product into a mystery box.
   * Optional on the type so fixtures need not spell it; `toProduct` always
   * sets it, and `isMysteryBox` is the one reader.
   */
  boxMode?: BoxMode | null;
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
  /**
   * One line under the title — the API's `overview`.
   *
   * ALWAYS A STRING, and used exactly as sent. The server decides whether it is
   * the owner's own summary or a trim of the description, and has already cut
   * it to 300 characters on a word boundary; nothing downstream may trim it
   * again. This was `summary`, derived here from the description's first
   * paragraph, which is the hack the field replaces.
   */
  overview: string;
  /**
   * Owner-written search-engine copy (the admin's "Search engine listing"),
   * or null to fall back to `name` and `summary`. `seoTitle` is used VERBATIM
   * as the page <title> when present — the owner wrote the whole title, so
   * nothing is appended to it.
   */
  seoTitle: string | null;
  seoDescription: string | null;
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
  /**
   * `"<colourId>:<sizeId>"` → what the shelf holds for that variant.
   *
   * ═══ THE COUNT USED TO DIE HERE, AND THE SHOP OVERSOLD BECAUSE OF IT ═══
   * `ApiVariant.available` is a NUMBER, and the API has been sending real ones
   * all along. The catalogue mapping reduced it to `Colour.inStock`, a boolean,
   * ROLLED UP ACROSS SIZES — a colour counted as in stock if any one of its
   * weights was. By the time a buy box rendered, "four left of the 1kg black"
   * had become "black: true", so the stepper offered 99 and the shopper found
   * out at the checkout freeze.
   *
   * Kept as a SIBLING MAP rather than folded into `Colour` or `SizeOption`
   * because stock is a property of the variant — the (colour, size) pair — and
   * neither axis alone can hold it without lying about the other. That is the
   * same reason `variantIds` is shaped this way, and the two are keyed
   * identically on purpose: `variantIdsFrom` and `variantStockFrom` walk the
   * same variants and build the same keys, so a pair that can be bought always
   * has a shelf, and one that cannot has neither.
   */
  variantStock: Record<string, VariantStock>;
}

/**
 * What the catalogue knows about one variant's shelf.
 *
 * Lives here rather than beside the rule that reads it (`cart/stock.ts`) so the
 * data layer does not import from the cart to describe its own response.
 */
export interface VariantStock {
  /**
   * Units on the shelf, or NULL when nothing tracks this variant.
   *
   * NULL IS NOT ZERO — the same distinction `ApiVariant.available` draws, and
   * for the same reason: an untracked product read as "none left" would be
   * capped at one unit per order across the whole shop.
   */
  available: number | null;
  /**
   * Sold past zero on purpose, so no stock ceiling applies at all.
   *
   * Its `available` goes NEGATIVE to record an oversell, which is honest data
   * and not corruption — `server/shop/admin/inventory.ts` in the admin repo
   * says so at length.
   */
  backorderable: boolean;
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
