import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { CartProvider } from "../cart/cart-context";
import type { Colour, Product, SizeOption } from "../data/types";
import { emptyAggregate } from "../data/reviews";
import { BuyBox } from "./buy-box";

/**
 * The sold-out buy box, as a shopper actually saw it.
 *
 * Live catalogue (Nov 2026): every colour of every product was gone. The page
 * still said "Buy Now", still said "Pick another colour", and still said
 * "Only 1 left" — three lies stacked on a pair of buttons that did nothing.
 * These assertions are the sentence the page now has to tell instead.
 */

const COLOUR: Colour = { id: "clear", name: "Clear", hex: "#eeeeee", inStock: false, imageUrl: null };
const OTHER: Colour = { id: "grey", name: "Light Grey", hex: "#bbbbbb", inStock: false, imageUrl: null };
const SIZE: SizeOption = {
  id: "1kg",
  label: "1kg",
  weightGrams: 1000,
  priceMinor: 2650000,
  compareAtMinor: null,
  currency: "NGN",
};

const product = (over: Partial<Product> = {}): Product =>
  ({
    slug: "pla-basic",
    name: "PLA Basic",
    categorySlug: "filament",
    overview: "Reliable PLA.",
    material: "PLA",
    diameterMm: 1.75,
    featured: false,
    badges: [],
    bulkTiers: [],
    coverImageUrl: null,
    imageUrls: [],
    features: [],
    overviewClaims: [],
    description: [],
    parameters: null,
    seoTitle: null,
    seoDescription: null,
    rating: { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] },
    colours: [COLOUR, OTHER],
    sizes: [SIZE],
    variantIds: {},
    variantStock: { "clear:1kg": { available: 0, backorderable: false } },
    ...over,
  }) as Product;

const noop = () => {};

const render = (p: Product, colour: Colour = COLOUR, maxQty = 1) =>
  renderToStaticMarkup(
    <CartProvider catalog={[]}>
      <BuyBox
        product={p}
        colour={colour}
        size={SIZE}
        quantity={1}
        reviewAggregate={emptyAggregate(p.slug)}
        onColourChange={noop}
        onSizeChange={noop}
        onQuantityChange={noop}
        maxQty={maxQty}
      />
    </CartProvider>,
  );

describe("BuyBox sold-out state", () => {
  it("says the product is out of stock, not that the buttons are shy", () => {
    const html = render(product());
    expect(html).toContain("This product is out of stock.");
    expect(html).toContain("Out of stock");
    expect(html).toContain("Clear — out of stock");
    expect(html).not.toContain("Pick another colour");
    expect(html).not.toContain("Buy Now");
    expect(html).not.toContain("Add to cart");
    expect(html).not.toContain("Only 1 left");
  });

  it("invites another colour only when one can actually be bought", () => {
    const red: Colour = { id: "red", name: "Red", hex: "#ff0000", inStock: true, imageUrl: null };
    const html = render(product({ colours: [COLOUR, red] }), COLOUR);
    expect(html).toContain("Clear is out of stock. Pick another colour.");
    expect(html).toContain("Out of stock");
    expect(html).not.toContain("Buy Now");
  });

  it("keeps Buy Now when the chosen colour can be bought", () => {
    const red: Colour = { id: "red", name: "Red", hex: "#ff0000", inStock: true, imageUrl: null };
    const html = render(product({ colours: [red] }), red, 8);
    expect(html).toContain("Buy Now");
    expect(html).toContain("Add to cart");
    expect(html).not.toContain("This product is out of stock.");
  });
});
