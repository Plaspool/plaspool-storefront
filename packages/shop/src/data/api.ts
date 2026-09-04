import { COMMERCE_API_BASE } from "./config";
import { isCurrencyCode, type CurrencyCode } from "./currency-config";
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
  VariantStock,
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
  /**
   * FREE TEXT, AND THE KEYS ARE WHATEVER THE OWNER TYPED. `{ Colour, Weight,
   * Diameter }` is this catalogue's convention, but the admin does not enforce
   * it and live data has arrived as `{ Size, Color }`. Never read a key off
   * this object directly — go through `option()` and the `*_KEYS` lists, which
   * document why in full.
   */
  optionValues: Record<string, string>;
  position: number;
  /** Null on every live variant today; the weight is in `optionValues`. */
  weightGrams: number | null;
  status: string;
  colorHex: string | null;
  /** Null is a real state — a variant created but not yet priced. */
  price: ApiMoney | null;
  /**
   * MINOR UNITS, like `price.amount`, in the price's own currency. The
   * struck-through reference figure; null means "not on sale". The admin
   * stores whatever the owner typed, so whether it actually DRAWS is decided
   * at render time by `compareAt > amount` — a reference at or below the real
   * price is stored honestly and never shown.
   */
  compareAtMinor?: number | null;
  /** Null when the variant has no inventory row at all, which is not zero. */
  available: number | null;
  backorderable: boolean;
  /** Relative (`/api/public/images/…`); null until this colour is photographed.
   *  Resolved server-side — see `Plaspool/plaspool-admin#39`. */
  imageUrl?: string | null;
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
  /** Owner-written <title>/<meta description> copy; null falls back to the
   *  title and the derived summary. Optional: an older API omits them. */
  seoTitle?: string | null;
  seoDescription?: string | null;
  /**
   * The shop owner's summary, or the server's own trim of the description's
   * first block to 300 characters on a word boundary. Which of the two it is,
   * is deliberately not visible here, and deliberately not this file's business.
   *
   * ALWAYS A STRING — never null, never absent. Empty when the owner wrote
   * nothing and the description has no prose to derive from, which is a real
   * answer ("there is no summary") rather than a missing one.
   */
  overview: string;
  /**
   * The derived value the ADMIN EDITOR renders as a placeholder under the
   * summary box. DELIBERATELY UNREAD: `overview` already accounts for it, so
   * preferring this would be preferring the admin's draft state to its answer.
   * Declared so the field is documented as ignored rather than merely missing.
   */
  overviewFallback?: string | null;
  /**
   * The resolved quantity ladder: store-wide default, per-product override and
   * the on/off switch all applied server-side. Ascending by `minQty`.
   *
   * An empty array means no bulk discount on this product, which is a complete
   * answer. Absent means the deploy has not landed — read the same way, because
   * the alternative is inventing a discount the till will not honour.
   */
  bulkTiers?: { minQty: number; percentBps: number }[] | null;
  /**
   * INFORMATIONAL, AND READ BY NOTHING. The switch is already reflected in
   * `bulkTiers`; consulting it here would be a second rule, and a product whose
   * ladder survived a `false` would lose its discount in the shop while the
   * till still applied it. Declared so that is a documented decision.
   */
  bulkDiscountEnabled?: boolean | null;
  /**
   * Present on BOTH the list and the detail response.
   *
   * This said "Detail responses only" and had been wrong since
   * `Plaspool/plaspool-admin#14` put variants on the list so a card could be
   * priced without a second call — which is the whole reason `listProducts()`
   * is one request rather than `1 + N`. The comment survived the change and
   * then argued against reading variants off a list, which is exactly what
   * `getLineImages()` does. Optional here because the field is optional on the
   * wire, not because one shape of response omits it.
   */
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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * READING A FREE-TEXT AXIS, IN ONE PLACE, FROM A LIST OF ACCEPTED SPELLINGS.
 *
 * `optionValues` is free text — the admin lets a shop owner name a variant
 * axis whatever they type — and this file has to find it by key. That
 * asymmetry has exactly one failure mode, and it is not a small one:
 *
 *   A product whose weight axis was labelled `Size` rather than `Weight`
 *   produced no sizes from `sizesFrom`, so `toProduct` returned null, so the
 *   product disappeared from EVERY catalogue surface and its own page 404'd —
 *   while the category tile beside it still read "1 product", because that
 *   count is computed server-side and never passes through here.
 *
 * Nothing threw. Nothing logged. The shop just had no products in it, and the
 * only way to see why was to diff the live payload against these key names.
 *
 * SO THE SPELLINGS LIVE IN ONE CONSTANT PER AXIS AND ARE READ BY ONE FUNCTION.
 * They used to be a `??` chain repeated at five call sites, which is five
 * chances for a sixth spelling to be added to four of them — and a `Colour`
 * that reaches the swatch list but not `variantIdsFrom` is a swatch that
 * accepts a click and silently does nothing.
 *
 * ORDER IS PRECEDENCE. The British spellings this catalogue was built on stay
 * first, so a variant carrying both is read the way it always was; the
 * American and `Size` forms are a fallback for data that did not know the
 * convention, never an override of data that did.
 *
 * BLANKS DO NOT COUNT AS PRESENT. `{ Weight: "  ", Size: "1kg" }` has to fall
 * through to `Size`, because an empty axis is what the admin writes when
 * somebody clears a field, and treating it as an answer would drop the product
 * exactly as before.
 * ═══════════════════════════════════════════════════════════════════════════
 */
function option(variant: ApiVariant, names: readonly string[]): string {
  for (const name of names) {
    const raw = variant.optionValues[name];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return "";
}

/** The size axis. `Size` is accepted because live data uses it — see `option`. */
const WEIGHT_KEYS = ["Weight", "weight", "Size", "size"] as const;

/** The colour axis, both spellings of the word. */
const COLOUR_KEYS = ["Colour", "colour", "Color", "color"] as const;

/** The diameter axis. One spelling in both dialects; listed here so no axis is
 *  read by a different mechanism from its neighbours. */
const DIAMETER_KEYS = ["Diameter", "diameter"] as const;

/** `1000` -> `"1 kg"`, `100` -> `"100 g"`. Whole kilos only, so 1500 stays
 *  `"1500 g"` rather than becoming a `1.5 kg` this catalogue never wrote. */
function labelFromGrams(grams: number): string {
  return grams >= 1000 && grams % 1000 === 0 ? `${grams / 1000} kg` : `${grams} g`;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE SIZE LABEL, IN THREE STEPS, AND THE LAST ONE IS EMPTY ON PURPOSE.
 *
 * A weight used to be readable one way — the free-text axis — and a variant
 * without one was skipped, which emptied `sizesFrom` and made `toProduct`
 * drop the whole product. That cost a live product with a price, stock and a
 * recorded weight its entire presence in the shop.
 *
 *   1. the weight axis, whatever the owner spelled it
 *   2. else `weightGrams`, the STRUCTURED field — null on every variant when
 *      this file was written, which is why it was only ever a fallback, and
 *      no longer true: `basic` ships `weightGrams: 100` and no axis at all
 *   3. else `""` — the catalogue genuinely records no weight
 *
 * AN EMPTY LABEL IS A REAL ANSWER, NOT A FAILURE. It means "this product has
 * one size and nobody said how big it is", which is a thing a shop is allowed
 * to sell. The surfaces render around it rather than printing a blank or an
 * invented `0 g`: the buy box drops the Size control, the weight filter builds
 * no bucket, and a cart line joins what it has. Inventing `"One size"` here
 * would put a claim in the seller's mouth on a page somebody buys from.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function sizeLabelOf(variant: ApiVariant): string {
  const label = option(variant, WEIGHT_KEYS);
  if (label) return label;
  const grams = variant.weightGrams;
  return typeof grams === "number" && grams > 0 ? labelFromGrams(grams) : "";
}

/** What an unlabelled size is keyed by. One per product, since a product with
 *  no weight axis has exactly one size by definition. */
const UNSIZED = "default";

/**
 * The size id. `sizesFrom` and `variantIdsFrom` MUST agree on this — a buy box
 * builds its key from a `SizeOption.id` and looks it up in `variantIds`, so an
 * id derived two ways is an Add to cart button that does nothing.
 */
export function sizeIdOf(variant: ApiVariant): string {
  const label = sizeLabelOf(variant);
  return label ? idOf(label) : UNSIZED;
}

/** `"1.75 mm"` → `1.75`. Null for anything that is not one of the two this
 *  store sells, for the same reason `materialFrom` returns null. */
export function diameterFrom(variants: ApiVariant[]): DiameterMm | null {
  for (const variant of variants) {
    const raw = option(variant, DIAMETER_KEYS);
    const value = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
    if (value === 1.75 || value === 2.85) return value;
  }
  return null;
}

/** `"1 kg"` → `1000`, `"750 g"` → `750`. Null when the label says neither.
 *
 *  EXPORTED BECAUSE `weightGrams` IS NULL ON EVERY LIVE VARIANT and the weight
 *  only exists in the free-text weight axis (`WEIGHT_KEYS`, read by `option`).
 *  `sizesFrom` has always needed that fallback; `lineImagesFrom` needs the same
 *  one to fill the drawn spool, and two copies of this parse would be two ways
 *  to read one label. */
export function gramsFrom(label: string): number | null {
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
 * What a variant with no `colorHex` is drawn in ON THE CATALOGUE SURFACES.
 *
 * A NEUTRAL GREY RATHER THAN A DROPPED FIELD, because `hex` drives the
 * generated spool as well as the swatch and something has to be drawn. Grey
 * reads as "no colour set" rather than as a claim that the filament is grey —
 * which is the distinction that matters, since the alternative is picking a
 * plausible colour and asserting it.
 *
 * ═══ AN ORDER LINE DOES NOT GET THIS, AND THE DIFFERENCE IS THE CAPTION ═══
 * `lineImagesFrom` used to apply the same fallback and it was wrong. On a
 * listing, the grey spool sits beside a swatch row and a colour NAME the
 * shopper is choosing between — the picture is one input among several, and
 * grey visibly abstains. On an order line, the picture stands alone as the
 * record of what arrived in the box, and `lineImageAlt` would then put the
 * line's own colour on top of it: `aria-label="PLA Filament, Red"` over a grey
 * spool. Same constant, opposite meaning, so `LineImage.colourHex` keeps null
 * instead and the order surfaces show no picture at all.
 */
const NO_COLOUR_SET = "#8a8a94";

/**
 * The colour axis, from the variants that carry one.
 *
 * A colour is IN STOCK when any variant of that colour can be bought — some
 * available, or backorderable. `available: null` means the variant has no
 * inventory row, which is "not tracked" rather than "none left", so it does not
 * make a colour out of stock on its own.
 *
 * `hex` FALLS BACK TO `NO_COLOUR_SET` rather than being dropped, for the
 * reason that constant records.
 */
export function coloursFrom(variants: ApiVariant[]): Colour[] {
  const byName = new Map<
    string,
    { name: string; hex: string | null; inStock: boolean; imageUrl: string | null }
  >();
  for (const variant of variants) {
    const name = option(variant, COLOUR_KEYS);
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
      existing.imageUrl = existing.imageUrl ?? variant.imageUrl ?? null;
    } else {
      byName.set(key, {
        name,
        hex: variant.colorHex,
        inStock: sellable,
        imageUrl: variant.imageUrl ?? null,
      });
    }
  }
  return [...byName.entries()].map(([id, c]) => ({
    id,
    name: c.name,
    hex: c.hex ?? NO_COLOUR_SET,
    inStock: c.inStock,
    /* THE FIRST PHOTOGRAPH WINS. A colour is several variants — one per weight —
       and they are the same spool in the same colour, so the first one anybody
       photographed is the picture of it. */
    imageUrl: imageUrl(c.imageUrl),
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
/**
 * The variant's currency, or naira.
 *
 * A code this build cannot render has no symbol and no precision rule, so
 * printing a figure beside it would be a number with no stated denomination.
 * Falls back rather than propagating — and the fallback is only ever reached
 * by a response this storefront was not built for.
 */
function currencyOf(code: string): CurrencyCode {
  return isCurrencyCode(code) ? code : "NGN";
}

export function sizesFrom(variants: ApiVariant[]): SizeOption[] {
  const byLabel = new Map<
    string,
    {
      label: string;
      grams: number | null;
      minor: number;
      compareMinor: number | null;
      currency: CurrencyCode;
    }
  >();
  for (const variant of variants) {
    if (!variant.price) continue;
    const label = sizeLabelOf(variant);
    const key = sizeIdOf(variant);
    const grams = variant.weightGrams ?? gramsFrom(label);
    const existing = byLabel.get(key);
    if (existing) {
      /* THE COMPARE-AT TRAVELS WITH THE PRICE THAT WON. A size aggregates
         colours at the cheapest quote, and striking through one variant's
         reference beside another variant's price would pair numbers that were
         never about the same thing. */
      if (variant.price.amount < existing.minor) {
        existing.minor = variant.price.amount;
        existing.compareMinor = variant.compareAtMinor ?? null;
        /* THE CURRENCY TRAVELS WITH THE PRICE THAT WON, for the same reason
           the compare-at does. Variants of one size should all be quoted in
           the shop's requested currency, but a mixed response must not leave
           the winning figure labelled with a losing variant's code. */
        existing.currency = currencyOf(variant.price.currency);
      }
      existing.grams = existing.grams ?? grams;
    } else {
      byLabel.set(key, {
        label,
        grams,
        minor: variant.price.amount,
        compareMinor: variant.compareAtMinor ?? null,
        currency: currencyOf(variant.price.currency),
      });
    }
  }
  return [...byLabel.entries()]
    .map(([id, s]) => ({
      id,
      label: s.label,
      weightGrams: s.grams ?? 0,
      /* ═══ NO CONVERSION HAPPENS HERE ANY MORE ═══
         This used to be `Math.round(s.minor / 100)`, which turned the API's
         minor units into whole naira and dropped the currency on the way. It
         now carries what the server sent, and `formatMoney` does the division
         at the point of RENDER, where the currency is still attached and its
         own precision is known. */
      priceMinor: s.minor,
      /* Whether it DRAWS is still `Price`'s render-time `compareAt > amount` —
         a reference at or below the price is carried honestly and never
         shown. */
      compareAtMinor: s.compareMinor,
      currency: s.currency,
    }))
    .sort((a, b) => a.priceMinor - b.priceMinor);
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
    const colour = option(variant, COLOUR_KEYS);
    if (!colour) continue;
    /* NO WEIGHT REQUIRED ANY MORE. Demanding one here dropped every variant of
       a product with no weight axis, so the buy box rendered and Add to cart
       had nothing to add — a control that accepts a click and does nothing. */
    const key = `${idOf(colour)}:${sizeIdOf(variant)}`;
    /* First wins, which is `position` order — the same variant `sizesFrom`
       quotes when two share a (colour, weight) pair. */
    if (!(key in out)) out[key] = variant.id;
  }
  return out;
}

export function variantKey(colourId: string, sizeId: string): string {
  return `${colourId}:${sizeId}`;
}

/**
 * `"<colourId>:<sizeId>"` → the shelf, for the variants that are for sale.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE NUMBER THE STOREFRONT USED TO THROW AWAY.
 *
 * `coloursFrom` above reduces `variant.available` to a per-COLOUR boolean, and
 * that boolean is all the buy box ever saw. It is doubly lossy: the count is
 * gone, and the answer is rolled up across sizes, so a black spool with four
 * 1kg and none of the 3kg reads as "black: in stock" either way. The stepper
 * therefore offered 99 of a thing there were four of, and the only gate left
 * was `POST /checkout/freeze` — after the address, after the delivery choice.
 *
 * That boolean is still exactly right for what it drives, which is whether a
 * SWATCH can be clicked. This map is the second question — how many — and it is
 * kept separate rather than folded into `Colour` because stock belongs to the
 * variant, and a colour spanning three weights has three different answers.
 *
 * DELIBERATELY THE SAME FILTER AS `variantIdsFrom`: priced variants only, first
 * wins on a duplicate key, same `idOf`/`sizeIdOf` derivation. The two maps are
 * read together — one to name the variant, one to bound it — and a pair present
 * in one but not the other is a buy box that can add a line it cannot cap, or
 * cap a line it cannot add.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function variantStockFrom(variants: ApiVariant[]): Record<string, VariantStock> {
  const out: Record<string, VariantStock> = {};
  for (const variant of variants) {
    if (!variant.price) continue;
    const colour = option(variant, COLOUR_KEYS);
    if (!colour) continue;
    const key = `${idOf(colour)}:${sizeIdOf(variant)}`;
    if (key in out) continue;
    /* CARRIED THROUGH UNTOUCHED, INCLUDING THE NULL AND THE NEGATIVE. `?? 0`
       here would turn "nothing tracks this" into "none left" and cap an
       untracked product at one unit; `Math.max(0, …)` would erase the record of
       an oversold backorder. Both are decisions for `maxQtyFor`, which has the
       `backorderable` flag in hand to make them with. */
    out[key] = { available: variant.available, backorderable: variant.backorderable };
  }
  return out;
}

// -------------------------------------------------------------- order lines

/**
 * The picture an ORDER LINE may honestly show, and how much of it is a claim
 * about that line's own colour.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AN ORDER LINE HAS NO IMAGE FIELD, AND THAT IS NOT AN OVERSIGHT. A line is a
 * purchase-time SNAPSHOT — `variantId`, `sku`, `title`, `optionValues`, `qty`,
 * amounts — so a customer's history shows what they bought rather than what the
 * catalogue says today. A rename or a repricing must not rewrite an old order,
 * which is exactly why the title and the money are frozen onto the line.
 *
 * A PICTURE CANNOT BE FROZEN THAT WAY, because none was ever stored. The only
 * field on a line that can find one is `variantId`, so a photograph on an order
 * page is unavoidably a claim sourced from the CURRENT catalogue about a PAST
 * purchase. Everything in this type exists to keep that claim narrow enough to
 * stay true.
 *
 * ═══ FOUR CASES, AND THE FOURTH WAS MISSING FOR A ROUND ═══
 * The two fields below are a pair, and the pair — not either one alone —
 * decides what may be drawn and what may be said:
 *
 *   src ≠ null, ofThisColour  → a photograph OF this colour. Name both.
 *   src ≠ null, !ofThisColour → the product's cover standing in. Name the
 *                               product only. Today this is EVERY live line.
 *   src = null, hex ≠ null    → no photograph, but the catalogue records this
 *                               variant's colour. Draw the spool in it and name
 *                               it: the hex IS the catalogue's answer to "what
 *                               colour is this", so the drawing is evidence.
 *   src = null, hex = null    → the catalogue has the variant and knows neither.
 *                               NOTHING may be drawn and nothing may be said.
 *
 * THE FOURTH IS WHY `colourHex` IS NULLABLE. It was `string`, defaulted to
 * `NO_COLOUR_SET`, and the renderer inferred "we know the colour" from
 * `src === null` — which is true of the third case and false of the fourth. The
 * result, reproduced in a browser, was a spool filled `#8a8a94` under
 * `aria-label="PLA Filament, Red"`: a grey picture asserting a colour, which is
 * verbatim the `gallery.tsx` bug this type was written to shut out. A default
 * that stands in for missing knowledge cannot also be the signal that the
 * knowledge is missing, so the absence is now spelled `null` and no caller can
 * infer it wrongly.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export interface LineImage {
  /**
   * The photograph, same-origin through `imageUrl()`, or null when neither this
   * colour nor its product has been photographed at all.
   *
   * Null is the DRAWN SPOOL *IF* `colourHex` IS NOT ALSO NULL. With a hex,
   * `ProductPhoto` renders `SpoolImage` tinted to it, which is a truthful
   * picture of the colour rather than a hole in the row. Without one, null here
   * means there is nothing to draw at all — read the two fields together, never
   * this one alone.
   */
  src: string | null;
  /**
   * Whether `src` is a photograph OF THIS COLOUR, or the product's cover
   * standing in for one.
   *
   * ═══ THIS FLAG IS THE REASON THE TYPE EXISTS ═══
   * `gallery.tsx` records the bug it prevents in its own words: the product
   * page's stage built its `alt` from the SELECTED colour unconditionally, so
   * when it fell back to the cover the same bytes were announced as "PLA
   * Filament, Black", then "…, Red", then "…, Grey" as the shopper clicked
   * along the rail — a false statement made to precisely the people who cannot
   * check it. An order line is that trap with the same shape, and worse odds:
   * NO live variant has its own photograph today, so EVERY line resolves to the
   * cover and a name built from the line's colour would be wrong on every row
   * in the shop.
   *
   * A caller may name the colour when this is true. When it is false the
   * picture is of the product, and only the product may be named.
   */
  ofThisColour: boolean;
  /**
   * The filament's own colour, straight from the catalogue, for the drawn spool
   * and for nothing else.
   *
   * NULL IS "THE CATALOGUE DOES NOT RECORD ONE", and it is a rendering
   * instruction, not a missing value to paper over: with no photograph either,
   * there is nothing honest left to draw, so `LineThumb` shows its "no picture"
   * box. Deliberately NOT defaulted to `NO_COLOUR_SET` — that constant's own
   * note explains why the swatch surfaces can take a grey and an order line
   * cannot.
   */
  colourHex: string | null;
  /**
   * Drives the drawn spool's fill level, and is read only when the spool is
   * drawn.
   *
   * `0` WHEN NEITHER `weightGrams` NOR THE `Weight` OPTION SAYS, which draws a
   * spool with no filament on it. That is an imprecision and it is the chosen
   * one: the alternatives are defaulting to a full spool, which claims more
   * than we know, or refusing to draw at all, which throws away the colour we
   * do know. Every live variant carries `Weight` in `optionValues`, so this is
   * a shape the catalogue does not currently produce; if it starts to, the
   * answer is an "unknown level" mode in `SpoolImage`, not a guess here.
   */
  weightGrams: number;
}

/**
 * `variantId` → `LineImage`, for every variant the catalogue can currently
 * describe.
 *
 * ═══ AN ABSENT KEY IS THE HONEST ANSWER, NOT A MISSING ONE ═══
 * A line whose variant is not in here is a line the catalogue cannot describe:
 * a discontinued product, a deleted variant, or a catalogue that could not be
 * reached at all. Those three are DELIBERATELY collapsed, and the collapse is
 * argued in `getLineImages()` — the caller must render "there is no picture of
 * this", never a spool in a guessed colour.
 *
 * A PLAIN OBJECT RATHER THAN A `Map`, because this crosses the server/client
 * boundary as a prop. A `Map` is not serialisable by React's flight protocol
 * and would arrive at the client as `{}` — silently, and only in the build that
 * matters. `AdaptContext.categorySlugByName` is a `Map` because it never
 * leaves the server.
 *
 * THE VALUE IS `| undefined` ON PURPOSE, and it is not noise. This repo's
 * `strict` does not include `noUncheckedIndexedAccess`, so a plain
 * `Record<string, LineImage>` hands every caller a `LineImage` for a key that
 * is not there and lets `image.colourHex` typecheck its way to a crash — or,
 * worse here, lets somebody skip the absent branch entirely and never learn
 * that it exists. Spelling it out makes the one case this whole seam is about
 * unskippable at the call site.
 */
export type LineImageIndex = Record<string, LineImage | undefined>;

/**
 * Every variant in a catalogue response, indexed by id.
 *
 * ═══ NOTHING IS FILTERED OUT HERE, AND THAT IS THE DIFFERENCE FROM
 * `toProduct` ═══
 * `toProduct` drops a product with no slug (no page to link to) and one with no
 * priced size (nothing that can be quoted), and filters variants to
 * `status === "active"` (nothing that can be added to a cart). Every one of
 * those tests asks "can this be SOLD?".
 *
 * An order page asks a different question: "what does the thing they ALREADY
 * BOUGHT look like?" A spool that has been delisted, unpriced or deactivated
 * since January is still the spool in the box, and its photograph is still the
 * right picture of it. Filtering here would silently blank the pictures on
 * exactly the oldest orders — the ones whose owner is least able to remember
 * what they ordered — so it does not filter.
 *
 * THAT IS ALSO WHY THIS DOES NOT REUSE `listProducts()`: not only would that
 * drag the reviews aggregate onto two order routes for nothing, it would hand
 * back the sellable projection and lose precisely the lines that need help.
 */
export function lineImagesFrom(products: ApiProduct[]): LineImageIndex {
  const index: LineImageIndex = {};
  for (const product of products) {
    const cover = imageUrl(product.coverImageUrl);
    for (const variant of product.variants ?? []) {
      /* THE VARIANT'S OWN PHOTOGRAPH FIRST, THE COVER SECOND — the stage's
         rule in `gallery.tsx`, for the stage's reason: the main image "is the
         product", and a colour nobody has photographed is better served by the
         product's picture than by a hole. What the rail does instead (colour's
         own photograph, then the drawing, NEVER the cover) is right for a
         colour PICKER, where seven identical covers destroy the control. An
         order line is not choosing anything. */
      const own = imageUrl(variant.imageUrl ?? null);
      index[variant.id] = {
        src: own ?? cover,
        ofThisColour: own !== null,
        /* PASSED THROUGH, NOT DEFAULTED. A grey stand-in here would be
           indistinguishable downstream from a colour the catalogue actually
           records, and `lineImageAlt` would then name the line's colour over a
           picture of grey. Null travels; the renderer decides. */
        colourHex: variant.colorHex,
        /* `weightGrams` is null on every live variant and the weight lives in
           the free-text option, so `gramsFrom` is the real reader here rather
           than the fallback it looks like. */
        weightGrams:
          variant.weightGrams ?? gramsFrom(option(variant, WEIGHT_KEYS)) ?? 0,
      };
    }
  }
  return index;
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
  /* The SAME `compareAt > price` rule the buy box renders by, so the card's
     claim and the page's strikethrough can never disagree: a badge is emitted
     only when at least one sellable variant would actually draw the line. */
  const onSale = variants.some(
    (v) => v.price !== null && v.compareAtMinor != null && v.compareAtMinor > v.price.amount,
  );
  if (onSale) badges.push("Sale");
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
    colours: colours.length
      ? colours
      : [
          {
            id: "default",
            name: "Standard",
            hex: NO_COLOUR_SET,
            inStock: true,
            imageUrl: imageUrl(api.coverImageUrl),
          },
        ],
    sizes,
    /* THE API'S RESOLVED LADDER, OR NONE. This was `STANDARD_TIERS`, a
       storefront policy constant — the ladder is product data now and the
       server has already applied the default, the override and the switch.
       Absent or null reads as no discount rather than as a default, because a
       ladder invented here would price a spool differently from the till. */
    bulkTiers: api.bulkTiers ?? [],
    badges: badgesFrom(variants, api.publishedAt, ctx.now),
    /* ═══ THE SERVER'S SUMMARY, USED AS SENT ═══
       NEVER RE-TRIMMED. It arrives already cut to 300 characters on a word
       boundary; the `deriveSummary` this replaced cut at 160, so a second pass
       would visibly truncate a line the owner wrote whole and the admin
       previews whole. There is no fallback and there must not be one — deriving
       a summary here is how the storefront and the admin come to show different
       words for the same product. */
    overview: api.overview,
    /* `''` never arrives — the admin normalises empty to NULL at the write
       boundary — but `?? null` also covers an older API omitting the fields. */
    seoTitle: api.seoTitle ?? null,
    seoDescription: api.seoDescription ?? null,
    features: [],
    overviewClaims: [],
    description,
    parameters: null,
    /* ═══ THE PICTURES THE SHOP ACTUALLY UPLOADED ═══
       The API has sent `coverImageUrl`/`imageUrls` all along and this mapper
       dropped them, so every surface in the storefront drew the generated
       `SpoolImage` instead and a photograph set in the admin never reached a
       customer. Absolute here, because `imageUrl()` owns the one place the
       API's origin is prefixed. */
    coverImageUrl: imageUrl(api.coverImageUrl),
    imageUrls: (api.imageUrls ?? []).map((u) => imageUrl(u)).filter((u): u is string => !!u),
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
    variantStock: variantStockFrom(variants),
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

/**
 * `/api/public/images/<id>` on the wire → `/images/shop/<id>` in the page.
 *
 * ═══ SAME-ORIGIN, AND THAT IS THE WHOLE POINT ═══
 * This used to prefix `COMMERCE_API_BASE` and point an `<img>` straight at the
 * commerce API. That endpoint answers a 302 to a presigned R2 URL: the redirect
 * carries `private, no-store` because a cached 302 would outlive the credential
 * inside it, and the R2 URL differs on every presign — so NEITHER leg could be
 * cached by the browser or by an edge. The blog measured exactly this in
 * production and built `app/images/blog/[id]` to fix it; the shop kept paying
 * two uncacheable cross-origin round trips per picture, per view, on a shop
 * that sells to mobile connections.
 *
 * `app/images/shop/[id]` follows the redirect server-side and serves the bytes
 * under a URL that never changes, so the response can carry `immutable`.
 *
 * ANYTHING THAT IS NOT THAT PATH IS LEFT ALONE. An absolute URL is already
 * somewhere else's problem, and an unrecognised shape is passed through
 * prefixed rather than mangled into a proxy path that would 404 — the API
 * gaining a second image route should degrade to "works, uncached", not to
 * "broken".
 */
const IMAGE_PATH = /^\/api\/public\/images\/([A-Za-z0-9_-]+)$/;

export function imageUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const id = IMAGE_PATH.exec(path)?.[1];
  return id ? `/images/shop/${id}` : `${COMMERCE_API_BASE}${path}`;
}
