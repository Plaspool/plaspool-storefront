import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ProductCard } from "./product-card";
import { CartProvider } from "../cart/cart-context";
import type { Product } from "../data/types";

/**
 * A mystery box on a listing card. Its one colour is a nameless grey
 * placeholder, so the swatch row must not draw it: the card says "Mystery box"
 * in that slot instead, and an ordinary card keeps its swatches.
 */

const product = (over: Partial<Product> = {}): Product =>
  ({
    slug: "spool",
    name: "Spool",
    categorySlug: "filament",
    overview: "",
    material: "PLA",
    diameterMm: 1.75,
    featured: false,
    badges: [],
    bulkTiers: [],
    coverImageUrl: "/images/shop/img_cover",
    imageUrls: [],
    rating: { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] },
    colours: [{ id: "black", name: "Black", hex: "#000000", inStock: true, imageUrl: null }],
    sizes: [{ id: "1kg", label: "1 kg", weightGrams: 1000, priceMinor: 1850000, compareAtMinor: null, currency: "NGN" }],
    variantIds: {},
    variantStock: {},
    ...over,
  }) as Product;

const render = (p: Product) =>
  renderToStaticMarkup(
    <CartProvider catalog={[]}>
      <ProductCard product={p} />
    </CartProvider>,
  );

describe("ProductCard", () => {
  it("draws swatches for an ordinary product", () => {
    const html = render(product());
    expect(html).toContain("Colours available for Spool");
    expect(html).not.toContain("Mystery box");
  });

  it("draws no swatch for a box, and says what it is instead", () => {
    const html = render(
      product({
        name: "Mystery Box",
        boxMode: "pack",
        colours: [{ id: "default", name: "", hex: "#8a8a94", inStock: true, imageUrl: null }],
      }),
    );
    expect(html).not.toContain("Colours available for");
    expect(html).not.toContain("#8a8a94");
    expect(html).toContain("Mystery box");
    expect(html).not.toContain("spool in");
  });
});
