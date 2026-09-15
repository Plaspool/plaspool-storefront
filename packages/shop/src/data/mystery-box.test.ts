import { describe, expect, it } from "vitest";

import { lineImagesFrom, toProduct, type AdaptContext, type ApiProduct, type ApiVariant } from "./api";
import {
  boxCountLine,
  boxCuesOf,
  boxItemCountOf,
  boxQuickAddSize,
  boxSizeSellable,
  boxStock,
  isMysteryBox,
  mysteryBoxOf,
  normaliseMysteryBox,
  parseAvailability,
  proxiedAvailabilityPath,
} from "./mystery-box";
import { maxQtyFor, stockOf } from "../cart/stock";

/**
 * THE MYSTERY BOX, AT THE DATA SEAM — the dedicated-product version (admin
 * PR #155): one variant, `optionValues: {}`, one price, one item count, and NO
 * STOCK OF ITS OWN (it sits at zero or below with backorders on).
 *
 * Field names were read live on 2026-09-15 with `boxMode` null everywhere; the
 * non-null shapes are from the merged admin code. Every null and absent case is
 * pinned, and so is the leftover-fields ordinary product production still has.
 */

const variant = (over: Partial<ApiVariant>): ApiVariant =>
  ({
    id: "var_a",
    sku: "sku",
    optionValues: {},
    position: 0,
    weightGrams: null,
    status: "active",
    colorHex: null,
    price: { amount: 1500000, currency: "NGN" },
    available: 24,
    backorderable: false,
    ...over,
  }) as ApiVariant;

const ctx: AdaptContext = { categorySlugByName: new Map(), now: 0 };

/** The box as the admin now sends it: a negative, backorderable, meaningless shelf. */
const BOX_VARIANT = variant({
  id: "var_box",
  optionValues: {},
  boxItemCount: 3,
  boxPoolTag: null,
  available: -2,
  backorderable: true,
});

const box = (over: Partial<ApiProduct> = {}): ApiProduct =>
  ({
    id: "prd_box",
    slug: "mystery-box",
    title: "Mystery Box",
    description: null,
    status: "active",
    category: "Filament",
    tags: [],
    coverImageUrl: null,
    imageUrls: [],
    publishedAt: null,
    overview: "A surprise mix of PLA Silk and PLA+.",
    bulkTiers: [],
    boxMode: "pack",
    variants: [BOX_VARIANT],
    ...over,
  }) as ApiProduct;

describe("toProduct on the mystery box", () => {
  it("marks the product as the box, and an ordinary or older product as not", () => {
    expect(toProduct(box(), ctx)?.boxMode).toBe("pack");
    expect(isMysteryBox(toProduct(box(), ctx)!)).toBe(true);
    for (const mode of ["built", "auto"] as const) {
      expect(isMysteryBox(toProduct(box({ boxMode: mode }), ctx)!)).toBe(true);
    }
    expect(toProduct(box({ boxMode: null }), ctx)?.boxMode).toBeNull();
    const older = box();
    delete (older as { boxMode?: unknown }).boxMode;
    expect(toProduct(older, ctx)?.boxMode).toBeNull();
    expect(isMysteryBox({})).toBe(false);
  });

  it("has one size with no label and the item count, and no weight", () => {
    const product = toProduct(box(), ctx)!;
    expect(product.sizes.map((s) => [s.label, s.boxItemCount, s.weightGrams])).toEqual([["", 3, 0]]);
  });

  it("can be added to a cart: the one variant has an id", () => {
    const product = toProduct(box(), ctx)!;
    const [colour] = product.colours;
    expect(product.variantIds[`${colour.id}:${product.sizes[0].id}`]).toBe("var_box");
  });

  it("ignores the box's own negative, backorderable stock", () => {
    const product = toProduct(box(), ctx)!;
    const [colour] = product.colours;
    expect(stockOf(product, colour.id, product.sizes[0].id)).toEqual({ available: null, backorderable: false });
    expect(product.badges).not.toContain("Low stock");
    expect(colour.inStock).toBe(true);
    expect(colour.name).toBe("");
  });

  it("renders the API's fallback words as ordinary product words", () => {
    expect(toProduct(box(), ctx)!.overview).toBe("A surprise mix of PLA Silk and PLA+.");
  });

  it("treats an ordinary product with LEFTOVER box fields as ordinary", () => {
    /* PLA Basic on production, 2026-09-15: boxMode null, but four variants
       still carried boxItemCount: 3 and a pool tag from an earlier admin. */
    const plaBasic = toProduct(
      box({
        slug: "pla-basic",
        boxMode: null,
        variants: [
          variant({
            id: "var_black",
            optionValues: { Size: "1kg", Color: "Black" },
            boxItemCount: 3,
            boxPoolTag: "mystery-pla",
            available: 4,
          }),
        ],
      }),
      ctx,
    )!;
    expect(isMysteryBox(plaBasic)).toBe(false);
    expect(plaBasic.sizes[0].label).toBe("1kg");
    expect(plaBasic.sizes[0].boxItemCount).toBeNull();
    expect(plaBasic.colours[0].name).toBe("Black");
    expect(stockOf(plaBasic, "black", "1kg")).toEqual({ available: 4, backorderable: false });
    expect(JSON.stringify(plaBasic)).not.toContain("mystery-pla");
  });

  it("flags only the box's variant in the order-line image index", () => {
    const index = lineImagesFrom([
      box(),
      box({ slug: "plain", boxMode: null, variants: [variant({ id: "var_plain", boxItemCount: 3 })] }),
    ]);
    expect(index.var_box?.isBox).toBe(true);
    expect(index.var_plain?.isBox).toBeUndefined();
  });
});

describe("box counts", () => {
  it("reads a count, and treats null, absent and zero as none", () => {
    expect(boxItemCountOf({ boxItemCount: 3 })).toBe(3);
    expect(boxItemCountOf({ boxItemCount: null })).toBeNull();
    expect(boxItemCountOf({})).toBeNull();
    expect(boxItemCountOf({ boxItemCount: 0 })).toBeNull();
  });

  it("words the promise, singular and plural", () => {
    expect(boxCountLine({ boxItemCount: 3 })).toBe("3 surprise items in every box.");
    expect(boxCountLine({ boxItemCount: 1 })).toBe("1 surprise item in every box.");
    expect(boxCountLine({ boxItemCount: null })).toBeNull();
  });
});

describe("availability", () => {
  const read = (over: object) =>
    parseAvailability({ variantId: "var_box", available: 5, backorderable: true, canFill: 5, ...over });

  it("parses the live shape, and an older one with no canFill", () => {
    expect(read({})).toEqual({ variantId: "var_box", available: 5, backorderable: true, canFill: 5, box: null });
    expect(parseAvailability({ variantId: "var_a", available: 0, backorderable: false })?.canFill).toBeNull();
    expect(parseAvailability(null)).toBeNull();
    expect(parseAvailability({ available: 1 })).toBeNull();
  });

  it("is buyable until a read lands, when it failed, and with no canFill", () => {
    expect(boxSizeSellable({ boxItemCount: 3 }, undefined)).toBe(true);
    expect(boxSizeSellable({ boxItemCount: 3 }, null)).toBe(true);
    expect(boxSizeSellable({ boxItemCount: 3 }, read({ canFill: null }))).toBe(true);
  });

  it("reads canFill only: sold out at zero, whatever available and backorderable say", () => {
    expect(boxSizeSellable({ boxItemCount: 3 }, read({ canFill: 0 }))).toBe(false);
    expect(boxSizeSellable({ boxItemCount: 3 }, read({ canFill: 0, available: 24 }))).toBe(false);
    /* Before admin PR #156 the route's `available` read 0 for a box that can fill. */
    expect(boxSizeSellable({ boxItemCount: 3 }, read({ canFill: 4, available: 0 }))).toBe(true);
    expect(boxSizeSellable({ boxItemCount: 3 }, read({ canFill: 4, available: -2 }))).toBe(true);
  });

  it("is never sellable without a count", () => {
    expect(boxSizeSellable({ boxItemCount: null }, read({}))).toBe(false);
    expect(boxSizeSellable({}, null)).toBe(false);
  });

  it("caps the stepper at canFill once known, and is untracked before", () => {
    expect(boxStock(null)).toEqual({ available: null, backorderable: false });
    expect(boxStock(read({ canFill: 2, available: 0 }))).toEqual({ available: 2, backorderable: false });
    expect(maxQtyFor(boxStock(read({ canFill: 2 })))).toBe(2);
  });

  it("quick-adds the box while it can be filled, and nothing when it cannot", () => {
    const sizes = [{ id: "default", priceMinor: 1500000, boxItemCount: 3 }];
    expect(boxQuickAddSize(sizes, () => null)?.id).toBe("default");
    expect(boxQuickAddSize(sizes, () => read({ canFill: 0 }))).toBeNull();
    expect(boxQuickAddSize([{ id: "default", priceMinor: 1, boxItemCount: null }], () => null)).toBeNull();
  });

  it("asks the same-origin proxy", () => {
    expect(proxiedAvailabilityPath("var_box")).toBe("/api/variants/var_box/availability");
  });
});

describe("the box's admin-written content", () => {
  const CONTENT = {
    size: "Large",
    itemCount: 3,
    howItWorks: { title: "How it works", steps: ["One.", "Two."] },
  };

  it("is carried onto the box product", () => {
    expect(toProduct(box({ mysteryBox: CONTENT }), ctx)!.mysteryBox).toEqual(CONTENT);
    expect(mysteryBoxOf(toProduct(box({ mysteryBox: CONTENT }), ctx)!)?.size).toBe("Large");
  });

  it("is null on an ordinary product, even if a stray value arrives", () => {
    expect(toProduct(box({ boxMode: null, mysteryBox: null }), ctx)!.mysteryBox).toBeNull();
    expect(toProduct(box({ boxMode: null, mysteryBox: CONTENT }), ctx)!.mysteryBox).toBeNull();
    expect(mysteryBoxOf({ boxMode: null, mysteryBox: CONTENT })).toBeNull();
  });

  it("is null when an older API sends none", () => {
    expect(toProduct(box(), ctx)!.mysteryBox).toBeNull();
    expect(normaliseMysteryBox(undefined)).toBeNull();
  });

  it("defaults a missing title, missing steps and a blank size", () => {
    expect(normaliseMysteryBox({ size: "  ", howItWorks: {} })).toEqual({
      size: null,
      itemCount: null,
      howItWorks: { title: "How it works", steps: [] },
    });
    expect(normaliseMysteryBox({ size: null, howItWorks: { title: "Custom", steps: ["a", "", 3, " b "] } })?.howItWorks).toEqual({
      title: "Custom",
      steps: ["a", "b"],
    });
  });

  it("labels the cart line with the size the variant carries", () => {
    const product = toProduct(
      box({ mysteryBox: CONTENT, variants: [{ ...BOX_VARIANT, optionValues: { Size: "Large" } }] }),
      ctx,
    )!;
    expect(product.sizes[0].label).toBe("Large");
  });
});

describe("the box's live cues", () => {
  it("parses cues in order, keeps unknown kinds, drops textless ones", () => {
    const parsed = parseAvailability({
      variantId: "var_box",
      available: 5,
      backorderable: true,
      canFill: 5,
      box: {
        onSaleSince: 1789400000000,
        cues: [
          { kind: "low_stock", text: "Only 22 left" },
          { kind: "future_kind", text: "Something new" },
          { kind: "selling_fast", text: "" },
          { text: "No kind" },
        ],
      },
    });
    expect(parsed?.box?.onSaleSince).toBe(1789400000000);
    expect(boxCuesOf(parsed)).toEqual([
      { kind: "low_stock", text: "Only 22 left" },
      { kind: "future_kind", text: "Something new" },
      { kind: "", text: "No kind" },
    ]);
  });

  it("has no cues before a read, for an ordinary variant, and on an older API", () => {
    expect(boxCuesOf(null)).toEqual([]);
    expect(boxCuesOf(parseAvailability({ variantId: "v", available: 1, backorderable: false, canFill: null, box: null }))).toEqual([]);
    expect(boxCuesOf(parseAvailability({ variantId: "v", available: 1, backorderable: false }))).toEqual([]);
    expect(parseAvailability({ variantId: "v", available: 1, backorderable: false, box: { cues: "nope" } })?.box).toEqual({
      onSaleSince: null,
      cues: [],
    });
  });
});
