import { describe, expect, it } from "vitest";

import { lineImagesFrom, toProduct, type AdaptContext, type ApiProduct, type ApiVariant } from "./api";
import {
  boxCountLine,
  boxItemCountOf,
  boxSizeSellable,
  boxStock,
  isMysteryBox,
  parseAvailability,
  proxiedAvailabilityPath,
} from "./mystery-box";
import { stockOf } from "../cart/stock";

/**
 * MYSTERY BOXES, AT THE DATA SEAM.
 *
 * The fixtures here are shaped from the merged admin code (PR #153) and the
 * live product payload read on 2026-09-15, where `boxMode`, `boxItemCount` and
 * `canFill` were present and null. Every null and absent case is pinned, since
 * an older API build and an ordinary product both send them.
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
    overview: "",
    bulkTiers: [],
    boxMode: "pack",
    variants: [
      variant({ id: "var_pla3", optionValues: { Box: "PLA · 3 spools" }, boxItemCount: 3, boxPoolTag: "mystery-pla" }),
      variant({ id: "var_petg5", optionValues: { Box: "PETG · 5 spools" }, boxItemCount: 5, price: { amount: 2500000, currency: "NGN" } }),
    ],
    ...over,
  }) as ApiProduct;

describe("toProduct on a mystery box", () => {
  it("marks the product as a box, and an ordinary or older product as not", () => {
    expect(toProduct(box(), ctx)?.boxMode).toBe("pack");
    expect(isMysteryBox(toProduct(box(), ctx)!)).toBe(true);
    expect(toProduct(box({ boxMode: null }), ctx)?.boxMode).toBeNull();
    const older = box();
    delete (older as { boxMode?: unknown }).boxMode;
    expect(toProduct(older, ctx)?.boxMode).toBeNull();
    expect(isMysteryBox({})).toBe(false);
  });

  it("names each size as the owner wrote it, with its count and no weight", () => {
    const product = toProduct(box(), ctx)!;
    expect(product.sizes.map((s) => [s.label, s.boxItemCount, s.weightGrams])).toEqual([
      ["PLA · 3 spools", 3, 0],
      ["PETG · 5 spools", 5, 0],
    ]);
  });

  it("can be added to a cart: every size has a variant id and a shelf", () => {
    const product = toProduct(box(), ctx)!;
    for (const size of product.sizes) {
      const key = `${product.colours[0].id}:${size.id}`;
      expect(product.variantIds[key]).toMatch(/^var_/);
      expect(stockOf(product, product.colours[0].id, size.id)).not.toBeNull();
    }
  });

  it("gives the colour no name, so descriptors read as the box size alone", () => {
    const product = toProduct(box(), ctx)!;
    expect(product.colours).toHaveLength(1);
    expect(product.colours[0].name).toBe("");
  });

  it("never carries the internal pool tag anywhere on the product", () => {
    expect(JSON.stringify(toProduct(box(), ctx))).not.toContain("mystery-pla");
  });

  it("flags a box variant in the order-line image index", () => {
    const index = lineImagesFrom([box(), box({ slug: "plain", boxMode: null, variants: [variant({ id: "var_plain" })] })]);
    expect(index.var_pla3?.isBox).toBe(true);
    expect(index.var_plain?.isBox ?? false).toBe(false);
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
    expect(boxCountLine({ boxItemCount: 3 })).toBe("3 surprise items, packed for your order.");
    expect(boxCountLine({ boxItemCount: 1 })).toBe("1 surprise item, packed for your order.");
    expect(boxCountLine({ boxItemCount: null })).toBeNull();
  });
});

describe("availability", () => {
  const read = (over: object) =>
    parseAvailability({ variantId: "var_a", available: 5, backorderable: false, canFill: 5, ...over });

  it("parses the live shape, and an older one with no canFill", () => {
    expect(read({})).toEqual({ variantId: "var_a", available: 5, backorderable: false, canFill: 5 });
    expect(parseAvailability({ variantId: "var_a", available: 0, backorderable: false })?.canFill).toBeNull();
    expect(parseAvailability(null)).toBeNull();
    expect(parseAvailability({ available: 1 })).toBeNull();
  });

  it("is buyable until a read lands, and when the read failed", () => {
    expect(boxSizeSellable({ boxItemCount: 3 }, undefined)).toBe(true);
    expect(boxSizeSellable({ boxItemCount: 3 }, null)).toBe(true);
  });

  it("is sold out when the pool or the stock is empty", () => {
    expect(boxSizeSellable({ boxItemCount: 3 }, read({ available: 0, canFill: 0 }))).toBe(false);
    expect(boxSizeSellable({ boxItemCount: 3 }, read({ available: 0, canFill: null }))).toBe(false);
    expect(boxSizeSellable({ boxItemCount: 3 }, read({ available: 24, canFill: 0 }))).toBe(false);
    expect(boxSizeSellable({ boxItemCount: 3 }, read({}))).toBe(true);
    expect(boxSizeSellable({ boxItemCount: 3 }, read({ available: null, canFill: null }))).toBe(true);
  });

  it("is never sellable without a count, whatever the stock says", () => {
    expect(boxSizeSellable({ boxItemCount: null }, read({}))).toBe(false);
    expect(boxSizeSellable({}, null)).toBe(false);
  });

  it("replaces the catalogue's sales cap with the live count once it lands", () => {
    const shelf = { available: 24, backorderable: false };
    expect(boxStock(shelf, null)).toBe(shelf);
    expect(boxStock(shelf, read({ available: 1 }))).toEqual({ available: 1, backorderable: false });
  });

  it("asks the same-origin proxy", () => {
    expect(proxiedAvailabilityPath("var_a")).toBe("/api/variants/var_a/availability");
  });
});
