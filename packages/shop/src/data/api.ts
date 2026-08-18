import { COMMERCE_API_BASE } from "./config";
import { STANDARD_TIERS } from "./policy";
import type {
  Badge,
  Category,
  Colour,
  DescriptionBlock,
  DiameterMm,
  Material,
  Product,
  RatingSummary,
  SizeOption,
} from "./types";

/**
 * The commerce API client and the adapter that turns its shapes into this
 * package's own.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ADAPTER LIVES HERE SO THE API'S SHAPE STOPS AT THIS FILE.
 *
 * `catalog.ts` is the seam every component reads through, and its header
 * promised that when the commerce API landed "only their bodies change". This
 * is what makes that true: `Product` and `Category` are unchanged shapes owned
 * by the storefront, and nothing above this file knows the wire has different
 * field names, prices in kobo, or option tuples instead of two axes.
 *
 * THE TWO MODELS DISAGREE ABOUT WHERE PRICE LIVES, and that is the one thing
 * worth understanding before reading `toProduct`. This package models a product
 * as `colours[]` AND `sizes[]` — two independent axes, with price hanging off
 * SIZE only, so eight colours of 1 kg PLA are one price. The API models a flat
 * `variants[]` list keyed by an option tuple (Colour × Weight × Diameter) with
 * price on EACH variant, so eight colours can legitimately be eight prices.
 *
 * This package's model is therefore a PROJECTION of the API's, and it is only
 * a faithful one while price does not vary by colour. `sizesFrom` takes the
 * CHEAPEST priced variant of each weight, so a colour-varying price shows the
 * lowest — which is the honest direction to be wrong in, since it is the price
 * the card already promises with "From ₦X". If that ever stops being a rare
 * case, the fix is a real second axis here, not a different `Math.min`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ------------------------------------------------------------------ the wire

/** ProseMirror JSON, as the blog's `DocNode` is. Redeclared rather than
 *  imported: `packages/shop` does not depend on `packages/blog`, and a wire
 *  type is exactly the kind of thing two packages may each own a copy of. */
export interface DocNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
}

export interface ApiMoney {
  /** MINOR UNITS. `2300000` is ₦23,000. */
  amount: number;
  currency: string;
}

export interface ApiVariant {
  id: string;
  sku: string;
  /** Free text, `{ Colour, Weight, Diameter }` in this catalogue. */
  optionValues: Record<string, string>;
  position: number;
  /** Null on every live variant today; the weight is in `optionValues`. */
  weightGrams: number | null;
  status: string;
  colorHex: string | null;
  /** Null is a real state — a variant created but not yet priced. */
  price: ApiMoney | null;
  /** Null when the variant has no inventory row at all, which is not zero. */
  available: number | null;
  backorderable: boolean;
}

export interface ApiProduct {
  id: string;
  /** Nullable server-side. A product without one has no page, so it is dropped. */
  slug: string | null;
  title: string;
  description: DocNode | null;
  status: string;
  /** A display NAME (`"Filament"`), not a slug. Mapped through the categories. */
  category: string;
  tags: string[];
  /** Relative (`/api/public/images/…`), so it needs the base prefixed. */
  coverImageUrl: string | null;
  imageUrls: string[];
  publishedAt: number | null;
  /** Detail responses only. */
  variants?: ApiVariant[];
}

export interface ApiCategory {
  slug: string;
  name: string;
  blurb: string;
  accentHex: string | null;
  position: number;
  count: number;
}

// ------------------------------------------------------------------ document

/** The text of a node and everything under it, space-joined. */
function textOf(node: DocNode): string {
  if (typeof node.text === "string") return node.text;
  return (node.content ?? []).map(textOf).join("");
}

/**
 * `DocNode` → `DescriptionBlock[]`.
 *
 * `description-tab.tsx` says it renders blocks "rather than from markup, so the
 * same component serves a CMS later without changing" — so this is the mapping
 * that was anticipated, and the component is untouched.
 *
 * AN ALLOW-LIST, not a switch with a default: a node type this build has never
 * heard of contributes nothing rather than throwing. That is the same rule the
 * blog's `doc-renderer` follows and the reason a CMS can grow a block type
 * without breaking a deployed store.
 *
 * `figure` HAS NO SOURCE AND IS NEVER EMITTED. It carries a `colourHex` rather
 * than a URL because there is no product photography in this store, and nothing
 * in a document says which colour a figure should be. An `image` node is
 * therefore dropped, not turned into a spool of an invented colour.
 */
export function docToBlocks(doc: DocNode | null): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  for (const node of doc?.content ?? []) {
    switch (node.type) {
      case "heading": {
        const text = textOf(node).trim();
        if (text) blocks.push({ kind: "heading", text });
        break;
      }
      case "paragraph": {
        const text = textOf(node).trim();
        if (text) blocks.push({ kind: "paragraph", text });
        break;
      }
      case "blockquote": {
        const text = textOf(node).trim();
        if (text) blocks.push({ kind: "paragraph", text });
        break;
      }
      case "bulletList":
      case "orderedList": {
        const items = (node.content ?? [])
          .map((item) => textOf(item).trim())
          .filter((item) => item.length > 0);
        if (items.length) blocks.push({ kind: "bullets", items });
        break;
      }
      case "table": {
        const rows = (node.content ?? []).map((row) =>
          (row.content ?? []).map((cell) => textOf(cell).trim()),
        );
        if (!rows.length) break;
        /* A leading `tableHeader` row is the head; a table with no header row
           keeps every row as a body row rather than promoting the first, which
           would silently relabel data as column names. */
        const first = (node.content ?? [])[0];
        const headed = (first?.content ?? []).every((c) => c.type === "tableHeader");
        blocks.push({
          kind: "table",
          caption: "",
          head: headed ? rows[0] : [],
          rows: headed ? rows.slice(1) : rows,
        });
        break;
      }
      default:
        break;
    }
  }
  return blocks;
}

/**
 * The one line under the title, taken from the product's FIRST PARAGRAPH.
 *
 * Derived rather than invented, and rather than left blank. The API has no
 * `summary` field, but it does have the product's own prose — so this is the
 * seller's words, trimmed, not marketing this file made up. Blank when there is
 * no prose, which the buy box renders as nothing.
 */
export function deriveSummary(blocks: DescriptionBlock[], limit = 160): string {
  const first = blocks.find((b) => b.kind === "paragraph");
  if (!first || first.kind !== "paragraph") return "";
  const text = first.text.trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 80 ? space : limit).trimEnd()}…`;
}

// -------------------------------------------------------------------- fields

/** What a product with no reviews carries. Renders nothing. */
const NO_RATING: RatingSummary = {
  average: 0,
  count: 0,
  distribution: [0, 0, 0, 0, 0],
};

const MATERIALS: Material[] = ["PLA+", "PLA", "PETG", "ABS", "ASA", "TPU"];

/**
 * The material, from `tags`.
 *
 * `PLA+` IS TESTED BEFORE `PLA` and the order of `MATERIALS` is load-bearing:
 * a tag of `PLA+` contains `PLA`, so the looser match first would classify
 * every PLA+ spool as PLA and quietly break the material filter for a whole
 * product line.
 *
 * NULL WHEN NO TAG NAMES ONE, rather than defaulting to `"PLA"`. A default here
 * would put a product in a filter bucket it does not belong to, which is worse
 * than leaving it out of every material filter — the filter is a claim about
 * what the product IS.
 */
export function materialFrom(tags: string[]): Material | null {
  const folded = tags.map((t) => t.trim().toUpperCase());
  for (const material of MATERIALS) {
    if (folded.includes(material.toUpperCase())) return material;
  }
  return null;
}

/** `"1.75 mm"` → `1.75`. Null for anything that is not one of the two this
 *  store sells, for the same reason `materialFrom` returns null. */
export function diameterFrom(variants: ApiVariant[]): DiameterMm | null {
  for (const variant of variants) {
    const raw = variant.optionValues.Diameter ?? variant.optionValues.diameter;
    const value = Number.parseFloat(String(raw ?? "").replace(/[^0-9.]/g, ""));
    if (value === 1.75 || value === 2.85) return value;
  }
  return null;
}

/** `"1 kg"` → `1000`, `"750 g"` → `750`. Null when the label says neither. */
function gramsFrom(label: string): number | null {
  const value = Number.parseFloat(label.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  return /kg/i.test(label) ? Math.round(value * 1000) : Math.round(value);
}

/** Stable, url-safe, and derived the same way everywhere. */
function idOf(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown"
  );
}

/**
 * The colour axis, from the variants that carry one.
 *
 * A colour is IN STOCK when any variant of that colour can be bought — some
 * available, or backorderable. `available: null` means the variant has no
 * inventory row, which is "not tracked" rather than "none left", so it does not
 * make a colour out of stock on its own.
 *
 * `hex` FALLS BACK TO A NEUTRAL GREY rather than being dropped. `hex` drives
 * the generated spool image as well as the swatch, so a missing one has to
 * render as something; grey reads as "no colour set" rather than as a claim.
 */
export function coloursFrom(variants: ApiVariant[]): Colour[] {
  const byName = new Map<string, { name: string; hex: string | null; inStock: boolean }>();
  for (const variant of variants) {
    const name = (variant.optionValues.Colour ?? variant.optionValues.colour ?? "").trim();
    if (!name) continue;
    const key = idOf(name);
    /* SELLABLE MEANS PRICED *AND* AVAILABLE, not just available. An unpriced
       variant is absent from `variantIds`, so a swatch that looked in stock
       would accept a click and then do nothing at all — the silent no-op is a
       worse answer than a swatch that says it cannot be bought. `sizesFrom`
       drops unpriced weights for the same reason. */
    const sellable =
      !!variant.price && ((variant.available ?? 0) > 0 || variant.backorderable);
    const existing = byName.get(key);
    if (existing) {
      existing.inStock = existing.inStock || sellable;
      existing.hex = existing.hex ?? variant.colorHex;
    } else {
      byName.set(key, { name, hex: variant.colorHex, inStock: sellable });
    }
  }
  return [...byName.entries()].map(([id, c]) => ({
    id,
    name: c.name,
    hex: c.hex ?? "#8a8a94",
    inStock: c.inStock,
  }));
}

/**
 * The size axis, from PRICED variants only.
 *
 * AN UNPRICED WEIGHT IS NOT A SIZE. `price: null` is a real state — a variant
 * created but not yet priced — and `quote()` treats it as not sellable, so
 * offering it here would put a size in the buy box that cannot be added to a
 * cart, with no price to show beside it.
 *
 * The consequence is load-bearing upstream: a product where NO weight is priced
 * has no sizes, and `cheapestSize()` in `money.ts` is a `reduce` with no
 * initial value — it THROWS on an empty array. `toProduct` therefore drops such
 * a product entirely rather than returning one that crashes the first card that
 * renders it.
 */
export function sizesFrom(variants: ApiVariant[]): SizeOption[] {
  const byLabel = new Map<string, { label: string; grams: number | null; minor: number }>();
  for (const variant of variants) {
    if (!variant.price) continue;
    const label = (variant.optionValues.Weight ?? variant.optionValues.weight ?? "").trim();
    if (!label) continue;
    const key = idOf(label);
    const grams = variant.weightGrams ?? gramsFrom(label);
    const existing = byLabel.get(key);
    if (existing) {
      existing.minor = Math.min(existing.minor, variant.price.amount);
      existing.grams = existing.grams ?? grams;
    } else {
      byLabel.set(key, { label, grams, minor: variant.price.amount });
    }
  }
  return [...byLabel.entries()]
    .map(([id, s]) => ({
      id,
      label: s.label,
      weightGrams: s.grams ?? 0,
      /* MINOR UNITS BECOME WHOLE NAIRA HERE AND NOWHERE ELSE. `Math.round`
         rather than a truncation, and no float arithmetic survives the call. */
      priceNaira: Math.round(s.minor / 100),
      /* No `compare_at` column exists, so there is no reference price to strike
         through. Null renders nothing, which is the honest state. */
      compareAtNaira: null,
    }))
    .sort((a, b) => a.priceNaira - b.priceNaira);
}


/**
 * `"<colourId>:<sizeId>"` → variant id, for the variants that are actually for
 * sale.
 *
 * PRICED AND ACTIVE ONLY, matching `sizesFrom`: an unpriced variant is not a
 * size the buy box offers, so a key pointing at one would let `add()` put a line
 * in the cart the API then refuses to quote. A combination absent from this map
 * is a combination that cannot be bought.
 *
 * The ids are derived by the same `idOf` the colour and size lists use, so a key
 * built from a `Colour.id` and a `SizeOption.id` finds its variant by
 * construction rather than by the two happening to agree.
 */
export function variantIdsFrom(variants: ApiVariant[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const variant of variants) {
    if (!variant.price) continue;
    const colour = (variant.optionValues.Colour ?? variant.optionValues.colour ?? "").trim();
    const weight = (variant.optionValues.Weight ?? variant.optionValues.weight ?? "").trim();
    if (!colour || !weight) continue;
    const key = `${idOf(colour)}:${idOf(weight)}`;
    /* First wins, which is `position` order — the same variant `sizesFrom`
       quotes when two share a (colour, weight) pair. */
    if (!(key in out)) out[key] = variant.id;
  }
  return out;
}

export function variantKey(colourId: string, sizeId: string): string {
  return `${colourId}:${sizeId}`;
}

/** Thirty days. Long enough that a slow week still shows something new. */
const NEW_FOR_MS = 30 * 24 * 60 * 60 * 1000;
/** At or below this, a colour count is worth warning about rather than hiding. */
const LOW_STOCK_AT = 5;

/**
 * Badges, derived from stock and publication.
 *
 * `"Bulk sale"` IS NEVER EMITTED. It would be a claim about a discount, and
 * discounts are a storefront policy constant right now rather than per-product
 * data (see `policy.ts`) — so a badge naming one product as the bulk deal would
 * be picking a product out for a reason that is not true of it specifically.
 *
 * `now` is a PARAMETER rather than `Date.now()` inside, because a badge derived
 * from the clock during render is a hydration mismatch waiting to happen: the
 * server and the client would evaluate it milliseconds apart, and around a
 * boundary they disagree. The caller reads the clock once per fetch.
 */
export function badgesFrom(variants: ApiVariant[], publishedAt: number | null, now: number): Badge[] {
  const badges: Badge[] = [];
  if (publishedAt !== null && now - publishedAt < NEW_FOR_MS) badges.push("New");
  const tracked = variants.filter((v) => v.available !== null);
  if (tracked.length) {
    const total = tracked.reduce((sum, v) => sum + (v.available ?? 0), 0);
    const backorderable = variants.some((v) => v.backorderable);
    if (total > 0 && total <= LOW_STOCK_AT && !backorderable) badges.push("Low stock");
  }
  return badges;
}

// ------------------------------------------------------------------- adapter

export interface AdaptContext {
  /** Category display name (folded) → slug, from `GET /api/shop/categories`. */
  categorySlugByName: Map<string, string>;
  /** Read once per fetch, never inside a render. See `badgesFrom`. */
  now: number;
  /**
   * slug → star summary, from `GET /api/public/reviews/aggregates`.
   *
   * OPTIONAL, AND AN ABSENT ENTRY MEANS "no reviews" RATHER THAN "unknown".
   * A card renders nothing at `count: 0`, so a missing aggregate and a genuine
   * zero look identical to a reader — which is the honest collapse, because the
   * reviews API answering slowly should cost a star line, never a product.
   */
  ratings?: Map<string, RatingSummary>;
}

/**
 * One API product as this package's `Product`, or `null` when it cannot be one.
 *
 * NULL IS RETURNED FOR TWO REASONS, and both are "this cannot be shown"
 * rather than "this is broken":
 *
 *   - **no slug** — the product has no URL, so no page and no card can link to
 *     it. `slug` is nullable server-side.
 *   - **no priced size** — nothing about it can be quoted, and `cheapestSize()`
 *     would throw on the empty array. See `sizesFrom`.
 *
 * WHAT IS DELIBERATELY EMPTY RATHER THAN INVENTED. `features`,
 * `overviewClaims` and `parameters` have no column behind them, so they arrive
 * empty or null and the surfaces that render them show nothing or hide. Filling
 * them with plausible defaults would put words in the seller's mouth on a page
 * a customer buys from. Tracked as a gap on Plaspool/plaspool-admin#1.
 */
export function toProduct(api: ApiProduct, ctx: AdaptContext): Product | null {
  if (!api.slug) return null;
  const variants = (api.variants ?? []).filter((v) => v.status === "active");
  const sizes = sizesFrom(variants);
  if (!sizes.length) return null;

  const colours = coloursFrom(variants);
  const description = docToBlocks(api.description);

  return {
    slug: api.slug,
    name: api.title,
    /* The API sends a display NAME; every route in this package is keyed by
       slug. Unknown names fall back to a slugified form so the product still
       has a category page to belong to rather than vanishing from the nav. */
    categorySlug:
      ctx.categorySlugByName.get(api.category.trim().toLowerCase()) ?? idOf(api.category),
    material: materialFrom(api.tags),
    diameterMm: diameterFrom(variants),
    colours: colours.length ? colours : [{ id: "default", name: "Standard", hex: "#8a8a94", inStock: true }],
    sizes,
    /* A POLICY CONSTANT, NOT PRODUCT DATA — `policy.ts` sets out why, and why
       every product currently gets the same ladder. */
    bulkTiers: STANDARD_TIERS,
    badges: badgesFrom(variants, api.publishedAt, ctx.now),
    summary: deriveSummary(description),
    features: [],
    overviewClaims: [],
    description,
    parameters: null,
    /* Reviews are their own API and their own cache window — the product page
       fetches the prose beside this rather than through it, so a review write
       never invalidates the catalogue. What a CARD needs is one number, and
       that arrives already aggregated for the whole grid. */
    rating: ctx.ratings?.get(api.slug) ?? NO_RATING,
    /* No `featured` column. `listFeaturedProducts()` picks the newest rather
       than reading this, so nothing here claims an editorial choice nobody
       made. */
    featured: false,
    variantIds: variantIdsFrom(variants),
  };
}

export function toCategory(api: ApiCategory): Category {
  return {
    slug: api.slug,
    name: api.name,
    blurb: api.blurb,
    /* Null means "no tint chosen", which the tile has to render as something.
       The brand navy is the neutral choice and reads as a default rather than
       as a claim about the material. */
    accentHex: api.accentHex ?? "#231C50",
    /* Counted server-side over active, untrashed products — the same predicate
       the product list uses, so a tile and its page cannot disagree. */
    productCount: api.count,
  };
}

/** Relative on the wire, because the API serves images from its own origin. */
export function imageUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `${COMMERCE_API_BASE}${path}`;
}
