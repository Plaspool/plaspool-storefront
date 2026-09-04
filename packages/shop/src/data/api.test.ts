import { describe, expect, it } from "vitest";

import {
  coloursFrom,
  lineImagesFrom,
  sizesFrom,
  toProduct,
  variantIdsFrom,
  type AdaptContext,
  type ApiProduct,
  type ApiVariant,
} from "./api";

/**
 * THE OPTION-NAME CONTRACT, PINNED.
 *
 * `ApiVariant.optionValues` is FREE TEXT — the admin lets a shop owner name a
 * variant axis whatever they like — while this adapter has to read it by key.
 * That asymmetry has one catastrophic failure mode and it has already happened
 * in production:
 *
 *   A product whose weight axis was labelled `Size` rather than `Weight`
 *   produced no sizes, so `toProduct` returned null, so the product vanished
 *   from EVERY catalogue surface and its own detail page 404'd — while the
 *   category tile beside it still said "1 product", because that count is
 *   computed server-side and never passes through this file.
 *
 * Nothing threw and nothing logged. The shop simply had no products in it.
 *
 * These tests exist so that the accepted spellings are a thing somebody has to
 * delete an assertion to change, rather than a detail buried in five separate
 * `??` chains that can drift apart one call site at a time.
 */

const variant = (over: Partial<ApiVariant>): ApiVariant =>
  ({
    id: "v",
    sku: "sku",
    optionValues: {},
    position: 0,
    weightGrams: null,
    status: "active",
    colorHex: null,
    price: { amount: 2350000, currency: "NGN" },
    available: 10,
    backorderable: false,
    ...over,
  }) as ApiVariant;

/* The exact variant the live commerce API served for `pla-basic`: the weight
   axis is `Size`, the colour axis is the American `Color`, and neither is the
   spelling this file was written against. */
const LIVE_OPTIONS = { Size: "1kg", Color: "Black" };

describe("the weight axis", () => {
  it("is read from `Size` as well as `Weight`", () => {
    const [size] = sizesFrom([variant({ optionValues: LIVE_OPTIONS })]);
    expect(size.label).toBe("1kg");
    expect(size.weightGrams).toBe(1000);
    expect(size.priceMinor).toBe(2350000);
    expect(size.currency).toBe("NGN");
  });

  it("still prefers `Weight` when a variant carries both", () => {
    const sizes = sizesFrom([
      variant({ optionValues: { Weight: "1 kg", Size: "one kilo" } }),
    ]);
    expect(sizes.map((s) => s.label)).toEqual(["1 kg"]);
  });
});

describe("the colour axis", () => {
  it("is read from `Color` as well as `Colour`", () => {
    const [colour] = coloursFrom([variant({ optionValues: LIVE_OPTIONS })]);
    expect(colour.name).toBe("Black");
    expect(colour.id).toBe("black");
    expect(colour.inStock).toBe(true);
  });

  it("still prefers `Colour` when a variant carries both", () => {
    const colours = coloursFrom([
      variant({ optionValues: { Colour: "Black", Color: "Noir" } }),
    ]);
    expect(colours.map((c) => c.name)).toEqual(["Black"]);
  });
});

describe("the buyable (colour, size) map", () => {
  /* A key missing here is a swatch that accepts a click and does nothing, so
     the aliases have to reach this call site too and not just the two lists
     the buy box is built from. */
  it("keys a variant whose axes are `Size` and `Color`", () => {
    expect(variantIdsFrom([variant({ id: "var_1", optionValues: LIVE_OPTIONS })])).toEqual({
      "black:1kg": "var_1",
    });
  });
});

describe("order-line images", () => {
  it("reads grams from a `Size` label when `weightGrams` is null", () => {
    const product = {
      slug: "pla-basic",
      coverImageUrl: null,
      variants: [variant({ id: "var_1", optionValues: LIVE_OPTIONS })],
    } as unknown as ApiProduct;
    /* `?.` because `noUncheckedIndexedAccess` types an index read as possibly
       undefined, and it is the honest spelling here: if the variant is missing
       the expectation reads `undefined` and still fails, where a `!` would
       assert away the very thing under test. */
    expect(lineImagesFrom([product]).var_1?.weightGrams).toBe(1000);
  });
});

describe("toProduct on the payload that emptied the shop", () => {
  const ctx: AdaptContext = {
    categorySlugByName: new Map([["filament", "filament"]]),
    now: 1787745900000,
  };

  const liveProduct = {
    id: "prd_1",
    slug: "pla-basic",
    title: "PLA Basic",
    description: { type: "doc", content: [] },
    status: "active",
    category: "Filament",
    tags: ["3D Printing", "Filament", "PLA"],
    coverImageUrl: "/api/public/images/img_1",
    imageUrls: [],
    createdAt: 1787744142166,
    updatedAt: 1787745606769,
    publishedAt: 1787745606769,
    deletedAt: null,
    seoTitle: "PlaSpool PLA Basic",
    seoDescription: null,
    variants: [variant({ id: "var_1", optionValues: LIVE_OPTIONS })],
  } as unknown as ApiProduct;

  it("keeps the product rather than dropping it", () => {
    const product = toProduct(liveProduct, ctx);
    expect(product).not.toBeNull();
    expect(product?.slug).toBe("pla-basic");
  });

  it("quotes it at the price the API sent", () => {
    const product = toProduct(liveProduct, ctx);
    expect(product?.sizes.map((s) => s.priceMinor)).toEqual([2350000]);
  });

  it("gives it the real colour rather than the no-colour fallback", () => {
    const product = toProduct(liveProduct, ctx);
    expect(product?.colours.map((c) => c.name)).toEqual(["Black"]);
  });

  /* The two halves of the buy box have to agree, or the swatch is a no-op. */
  it("can name the variant behind its own (colour, size) pair", () => {
    const product = toProduct(liveProduct, ctx);
    const colourId = product!.colours[0].id;
    const sizeId = product!.sizes[0].id;
    expect(product?.variantIds[`${colourId}:${sizeId}`]).toBe("var_1");
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * A VARIANT WITH NO WEIGHT AXIS AT ALL, WHICH IS A DIFFERENT BUG FROM THE ONE
 * ABOVE AND FAILS THE SAME WAY.
 *
 * The block above pins a product whose weight WAS there and was read by the
 * wrong key — an axis spelled `Size` where this file expected `Weight`. This
 * one has no weight axis on the variant and `weightGrams: null` beside it, so
 * there is no weight anywhere to find and none to invent. `sizeLabelOf` runs
 * out of places to look and answers `""`, which is the third step it documents
 * as a real answer: one size, nobody said how big it is.
 *
 * THE EMPTY LABEL IS LOAD-BEARING IN TWO PLACES THAT DERIVE THEIR KEY
 * SEPARATELY AND MUST AGREE:
 *
 *   - `sizesFrom` keys the size by `sizeIdOf`, which falls back to `UNSIZED`
 *   - `variantIdsFrom` builds `"<colourId>:<sizeId>"` from that same helper
 *
 * Either one going back to requiring a weight fails silently and totally. An
 * empty size list makes `toProduct` return null, and the product vanishes from
 * every catalogue surface while its own detail page 404s — the exact shape of
 * the outage this file's opening comment describes. A size list that survives
 * while `variantIds` empties is worse in a quieter way: the buy box renders,
 * the swatch looks buyable, and Add to cart has no variant to add. Nothing
 * throws and nothing logs in either case.
 *
 * The payload is the one the live commerce API served for `basic`: a single
 * variant carrying a colour and nothing else.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("a product whose only variant has no weight axis", () => {
  const ctx: AdaptContext = {
    categorySlugByName: new Map([["filament", "filament"]]),
    now: 1787745900000,
  };

  /* Colour only. No `Weight`, no `Size`, and no structured `weightGrams` to
     fall back to — every route to a weight is genuinely absent. */
  const SIZELESS_OPTIONS = { Colour: "black" };

  const sizeless = variant({
    id: "var_mta1zqxcdf6ab5ec6ec34e6e",
    optionValues: SIZELESS_OPTIONS,
    weightGrams: null,
    price: { amount: 2000000, currency: "NGN" },
  });

  const sizelessProduct = {
    id: "prd_2",
    slug: "basic",
    title: "Basic",
    description: { type: "doc", content: [] },
    status: "active",
    category: "Filament",
    tags: ["Filament"],
    coverImageUrl: null,
    imageUrls: [],
    createdAt: 1787744142166,
    updatedAt: 1787745606769,
    publishedAt: 1787745606769,
    deletedAt: null,
    variants: [sizeless],
  } as unknown as ApiProduct;

  it("still produces one size rather than none", () => {
    const sizes = sizesFrom([sizeless]);
    expect(sizes).toHaveLength(1);
  });

  /* The label stays empty and the grams stay 0. Both are the honest reading of
     a catalogue that records no weight, and the surfaces are built to render
     around them — asserting them here stops a later "friendlier" `One size` or
     an invented `0 g` being put in the seller's mouth without a test failing. */
  it("leaves that size unlabelled rather than inventing a weight", () => {
    const [size] = sizesFrom([sizeless]);
    expect(size.label).toBe("");
    expect(size.weightGrams).toBe(0);
    expect(size.priceMinor).toBe(2000000);
  });

  it("keeps the product rather than dropping it", () => {
    const product = toProduct(sizelessProduct, ctx);
    expect(product).not.toBeNull();
    expect(product?.slug).toBe("basic");
  });

  /* The half that PR #72 fixed second. `variantIdsFrom` used to require a
     weight axis and skipped every variant without one, which left this map
     empty for exactly this product. */
  it("can still be bought, because the (colour, size) map is not empty", () => {
    expect(variantIdsFrom([sizeless])).toEqual({
      "black:default": "var_mta1zqxcdf6ab5ec6ec34e6e",
    });
  });

  /* The same agreement the block above pins, on the payload where the two keys
     are derived through the UNSIZED fallback rather than from a real label. */
  it("names the variant behind its own (colour, size) pair", () => {
    const product = toProduct(sizelessProduct, ctx);
    const colourId = product!.colours[0].id;
    const sizeId = product!.sizes[0].id;
    expect(product?.variantIds[`${colourId}:${sizeId}`]).toBe(
      "var_mta1zqxcdf6ab5ec6ec34e6e",
    );
  });
});
