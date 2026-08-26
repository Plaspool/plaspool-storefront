import { describe, expect, it } from "vitest";

import { toProduct, type AdaptContext, type ApiProduct, type ApiVariant } from "./api";

/**
 * `overview` AND `bulkTiers`, AS THE ADAPTER MUST READ THEM.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Both fields are owned by the admin and RESOLVED THERE. The whole risk in this
 * file is the storefront quietly keeping a second opinion:
 *
 *   - a summary re-truncated here would cut a 280-character line the owner
 *     wrote deliberately, and the shop would show something the admin's own
 *     preview does not;
 *   - a ladder defaulted here would price a spool differently from the till.
 *
 * So the assertions below are mostly about what this adapter must NOT do.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const variant = (over: Partial<ApiVariant> = {}): ApiVariant =>
  ({
    id: "var_1",
    sku: "sku",
    optionValues: { Size: "1kg", Colour: "Black" },
    position: 0,
    weightGrams: null,
    status: "active",
    colorHex: null,
    price: { amount: 2350000, currency: "NGN" },
    available: 10,
    backorderable: false,
    ...over,
  }) as ApiVariant;

const CTX: AdaptContext = {
  categorySlugByName: new Map([["filament", "filament"]]),
  now: 1787745900000,
};

function paragraph(text: string) {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

function product(over: Record<string, unknown> = {}): ApiProduct {
  return {
    id: "prd_1",
    slug: "pla-basic",
    title: "PLA Basic",
    description: paragraph("Matte PLA from the description."),
    /* Always present on the wire — the adapter has no fallback, so every
       fixture must carry one just as every live response does. */
    overview: "PLA Basic, in one line.",
    status: "active",
    category: "Filament",
    tags: ["Filament"],
    coverImageUrl: null,
    imageUrls: [],
    createdAt: 1787744142166,
    updatedAt: 1787745606769,
    publishedAt: 1787745606769,
    deletedAt: null,
    seoTitle: null,
    seoDescription: null,
    variants: [variant()],
    ...over,
  } as unknown as ApiProduct;
}

describe("overview", () => {
  it("is the API's string, used as sent", () => {
    const p = toProduct(product({ overview: "Matte PLA that prints clean at 205°C." }), CTX);
    expect(p?.overview).toBe("Matte PLA that prints clean at 205°C.");
  });

  /* THE SERVER HAS ALREADY TRIMMED IT, to 300 on a word boundary. Trimming
     again would cut a hand-written summary the owner made 280 long — and this
     adapter's own `deriveSummary` cuts at 160, so a second pass would visibly
     truncate a line the admin shows whole. */
  it("is never truncated a second time", () => {
    const long = "x".repeat(280);
    expect(toProduct(product({ overview: long }), CTX)?.overview).toBe(long);
    expect(toProduct(product({ overview: long }), CTX)?.overview).toHaveLength(280);
  });

  /* `overviewFallback` is the derived value the ADMIN EDITOR renders as a
     placeholder. `overview` already accounts for it, so reading it here would
     be preferring the admin's draft state over its answer. */
  it("ignores `overviewFallback` entirely", () => {
    const p = toProduct(
      product({ overview: "The owner's own words.", overviewFallback: "Derived placeholder." }),
      CTX,
    );
    expect(p?.overview).toBe("The owner's own words.");
  });

  /* ═══ NO FALLBACK, AND THAT IS THE POINT ═══
     `deriveSummary` used to take the description's first paragraph, and this
     asserts the hack has not crept back. An empty `overview` beside a
     description full of prose is the exact shape that would tempt one — and
     taking those words would mean the shop showing a summary the admin's own
     preview does not, for a product whose owner deliberately has none. */
  it("does not derive a summary from the description when the API sends none", () => {
    const p = toProduct(product({ overview: "" }), CTX);
    expect(p?.overview).toBe("");
    expect(p?.overview).not.toContain("Matte PLA from the description.");
  });

  /* The live API sends `""` for a product whose owner wrote no summary and
     whose description has no prose to derive from. That is a real answer —
     "there is no summary" — and it renders as nothing rather than as a hole. */
  it("carries an empty summary through as an empty string", () => {
    expect(toProduct(product({ overview: "" }), CTX)?.overview).toBe("");
  });
});

describe("bulkTiers", () => {
  const LADDER = [
    { minQty: 3, percentBps: 500 },
    { minQty: 5, percentBps: 1000 },
    { minQty: 10, percentBps: 1500 },
  ];

  it("is the resolved ladder the API sent", () => {
    expect(toProduct(product({ bulkTiers: LADDER }), CTX)?.bulkTiers).toEqual(LADDER);
  });

  /* AN ABSENT LADDER IS NO DISCOUNT, never a default of our own. This is the
     assertion that stops `STANDARD_TIERS` — or anything like it — coming back:
     a storefront ladder would price a spool differently from the till. */
  it("is empty when the API sends none", () => {
    expect(toProduct(product(), CTX)?.bulkTiers).toEqual([]);
    expect(toProduct(product({ bulkTiers: null }), CTX)?.bulkTiers).toEqual([]);
  });

  it("is empty, not defaulted, when the API sends an empty ladder", () => {
    expect(toProduct(product({ bulkTiers: [] }), CTX)?.bulkTiers).toEqual([]);
  });

  /* `bulkDiscountEnabled` IS INFORMATIONAL. The switch has already been applied
     to the ladder server-side, so reading it here is a second rule — and a
     product whose ladder survived a `false` flag would lose its discount in the
     shop while the till still gave it. */
  it("does not let `bulkDiscountEnabled` overrule the resolved ladder", () => {
    const p = toProduct(product({ bulkDiscountEnabled: false, bulkTiers: LADDER }), CTX);
    expect(p?.bulkTiers).toEqual(LADDER);
  });
});
