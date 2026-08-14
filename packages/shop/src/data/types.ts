export type Material = "PLA" | "PLA+" | "PETG" | "ABS" | "ASA" | "TPU";
export type DiameterMm = 1.75 | 2.85;

/** `hex` drives both the swatch and the generated spool image, so it is the
 *  colour of the filament itself and never a UI colour. */
export interface Colour {
  id: string;
  name: string;
  hex: string;
  inStock: boolean;
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
  material: Material;
  diameterMm: DiameterMm;
  colours: Colour[];
  sizes: SizeOption[];
  bulkTiers: BulkTier[];
  badges: Badge[];
  /** One line under the title. Not marketing — what the material is for. */
  summary: string;
  /** Exactly four, shown in the buy box. */
  features: string[];
  overviewClaims: OverviewClaim[];
  description: DescriptionBlock[];
  parameters: PrintingParameters;
  reviews: Review[];
  featured: boolean;
}

export interface Category {
  slug: string;
  name: string;
  blurb: string;
  /** The tile's spool tint. A filament colour, per the design system. */
  accentHex: string;
}

export interface RatingSummary {
  average: number;
  count: number;
  /** Index 0 is five stars, index 4 is one star. */
  distribution: [number, number, number, number, number];
}
