import { describe, expect, it } from "vitest";

import { partitionLines } from "./sellable";
import type { VariantMatch } from "./sellable";
import type { ApiCartLine } from "../data/cart-api";
import type { CartCatalogEntry } from "./cart-context";

/**
 * WHICH SERVER LINES THE BADGE IS ALLOWED TO COUNT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT THESE EXIST TO PREVENT COMING BACK.
 *
 * The cart kept two projections of one server state. `itemCount` reduced over
 * the RAW `lines` array; the drawer, the cart page and the checkout all read
 * `resolved`, which drops any line the catalogue can no longer explain. Nothing
 * anywhere read `available`.
 *
 * So a cart holding one line whose variant had left the catalogue showed a
 * badge reading 1 beside a drawer reading "Your cart is empty" — and because
 * every surface that renders a Remove button iterates `resolved`, there was no
 * control anywhere that could take it out. The basket stayed stuck at 1 until
 * it expired, and `/checkout` answered `unresolved_lines` — "go back to the
 * cart and remove it" — about a row the cart could not draw.
 *
 * The two assertions that matter are therefore a PAIR, and neither alone is the
 * fix: an unbuyable line must leave the count, AND it must stay reachable so it
 * can be removed. Dropping it from both is how a silent stuck cart is built.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const COLOUR = { id: "black", name: "Black", hex: "#000000", inStock: true, imageUrl: null };
const SIZE = { id: "1kg", label: "1kg", weightGrams: 1000, priceMinor: 2350000, compareAtMinor: null, currency: "NGN" as const };

const ENTRY: CartCatalogEntry = {
  slug: "pla-basic",
  name: "PLA Basic",
  colours: [COLOUR],
  sizes: [SIZE],
  bulkTiers: [],
  variantIds: { "black:1kg": "var_live" },
  coverImageUrl: null,
};

/** The catalogue as `cart-context` builds it: variant id → the triple the UI
 *  names a row by. A variant absent from here is one this storefront cannot
 *  draw or price. */
const KNOWN = new Map<string, VariantMatch>([
  ["var_live", { entry: ENTRY, colourId: "black", sizeId: "1kg" }],
]);

/** One server line. Defaults to the healthy case so each test states only the
 *  one thing it is about. */
function line(over: Partial<ApiCartLine> = {}): ApiCartLine {
  return {
    id: "crl_1",
    variantId: "var_live",
    qty: 1,
    available: true,
    sku: "10",
    title: "PLA Basic",
    optionValues: { Colour: "Black", Weight: "1kg" },
    unit: { amount: 2350000, currency: "NGN" },
    inStock: 10,
    ...over,
  };
}

describe("partitionLines", () => {
  it("counts units rather than lines for a line that can be bought", () => {
    expect(partitionLines([line({ qty: 3 })], KNOWN).itemCount).toBe(3);
  });

  /* THE REPORTED BUG, in the shape the API actually sent it: a cart holding
     `var_msrw93s668288c75cbc24106` against a catalogue whose only variant is
     `var_mta1jf8g678763dbb28b4566`. Everything the API could not resolve came
     back null, and the badge counted it anyway. */
  it("does not count a line whose variant has left the catalogue", () => {
    const gone = line({ variantId: "var_gone", available: false, unit: null, inStock: 0 });
    expect(partitionLines([gone], KNOWN).itemCount).toBe(0);
  });

  it("does not count a catalogued line the server marked unavailable", () => {
    expect(partitionLines([line({ available: false, inStock: 0 })], KNOWN).itemCount).toBe(0);
  });

  /* THE OTHER HALF OF THE FIX. Leaving it out of the count while also leaving
     it out of the lists is what turns a wrong badge into a silent stuck cart. */
  it("keeps a line whose variant has left the catalogue removable", () => {
    const gone = line({ id: "crl_gone", variantId: "var_gone", qty: 2, available: false });
    expect(partitionLines([gone], KNOWN).unsellable).toEqual([
      { lineId: "crl_gone", variantId: "var_gone", qty: 2, name: null },
    ]);
  });

  /* A line the catalogue still explains can be NAMED while it is being
     refused, so the row says which spool rather than "an item". */
  it("names an unavailable line the catalogue still explains", () => {
    const [row] = partitionLines([line({ available: false })], KNOWN).unsellable;
    expect(row.name).toBe("PLA Basic");
  });

  /* THE SAME DIVERGENCE, ONE LAYER DOWN. `resolved` needed a Colour and a
     SizeOption as well as a variant, and dropped the row when the entry had
     lost either — so a split that only checked the variant map would hand the
     badge a line the drawer still could not draw. The colour and size lookups
     belong to this decision, not to the component downstream of it. */
  it("does not count a line whose colour the entry has lost", () => {
    const orphan = new Map<string, VariantMatch>([
      ["var_live", { entry: { ...ENTRY, colours: [] }, colourId: "black", sizeId: "1kg" }],
    ]);
    const split = partitionLines([line()], orphan);
    expect(split.itemCount).toBe(0);
    expect(split.unsellable.map((u) => u.lineId)).toEqual(["crl_1"]);
  });

  it("does not count a line whose size the entry has lost", () => {
    const orphan = new Map<string, VariantMatch>([
      ["var_live", { entry: { ...ENTRY, sizes: [] }, colourId: "black", sizeId: "1kg" }],
    ]);
    expect(partitionLines([line()], orphan).itemCount).toBe(0);
  });

  /* The sellable side carries the resolved Colour and SizeOption, so the
     provider maps rather than filters — there is no second place left for a
     line to be silently dropped. */
  it("resolves the colour and size onto a sellable line", () => {
    const [row] = partitionLines([line()], KNOWN).sellable;
    expect(row.colour).toBe(COLOUR);
    expect(row.size).toBe(SIZE);
    expect(row.entry).toBe(ENTRY);
  });

  /**
   * THE REPORTED BASKET, VERBATIM.
   *
   * `GET /api/shop/cart` returned this line while the live catalogue held one
   * variant, `var_mta1jf8g678763dbb28b4566`. Every field the API could not
   * resolve came back null — which is also why `ApiCartLine.sku` and
   * `.optionValues` are nullable now; they were declared as guarantees while
   * the server was already sending null for both.
   *
   * The badge read 1. The drawer read "Your cart is empty".
   */
  it("counts nothing, and offers a Remove, for the cart that was reported", () => {
    const reported: ApiCartLine = {
      id: "crl_mt74r4cka7ff493b1d244afd",
      variantId: "var_msrw93s668288c75cbc24106",
      qty: 1,
      available: false,
      sku: null,
      title: null,
      optionValues: null,
      unit: null,
      inStock: 0,
    };
    const live = new Map<string, VariantMatch>([
      [
        "var_mta1jf8g678763dbb28b4566",
        { entry: ENTRY, colourId: "black", sizeId: "1kg" },
      ],
    ]);

    const split = partitionLines([reported], live);

    expect(split.itemCount).toBe(0);
    expect(split.sellable).toEqual([]);
    expect(split.unsellable).toEqual([
      {
        lineId: "crl_mt74r4cka7ff493b1d244afd",
        variantId: "var_msrw93s668288c75cbc24106",
        qty: 1,
        name: null,
      },
    ]);
  });

  it("splits a mixed basket without losing a line", () => {
    const split = partitionLines(
      [line({ id: "crl_ok", qty: 2 }), line({ id: "crl_bad", variantId: "var_gone" })],
      KNOWN,
    );
    expect(split.sellable.map((s) => s.line.id)).toEqual(["crl_ok"]);
    expect(split.unsellable.map((u) => u.lineId)).toEqual(["crl_bad"]);
    expect(split.itemCount).toBe(2);
  });
});
