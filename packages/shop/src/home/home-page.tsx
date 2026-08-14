import type { Metadata } from "next";

import { HeroCarousel } from "./hero-carousel";
import { CategoryTiles } from "./category-tiles";
import { FeaturedProducts } from "./featured-products";
import { WhyShop } from "./why-shop";
import { BulkPromo } from "./bulk-promo";
import { BlogStrip } from "./blog-strip";

/**
 * `/store`. The announcement bar, nav and footer around this come from
 * `ShopShell`, mounted once by the `(shop)` layout — this component is only
 * the six sections between them, in the spec's order.
 *
 * `BlogStrip` is async and renders `null` when the content API is empty or
 * unreachable, which is its normal state today. Nothing else on the page
 * depends on it, so it simply drops out.
 */

export const storeHomeMetadata: Metadata = {
  title: "Buy 3D printer filament in Nigeria — PLA, PETG, ABS, TPU",
  description:
    "PLA, PLA+, PETG, ABS, ASA and TPU filament extruded in Lagos and measured to ±0.02 mm. Next-day delivery in Lagos, 2–4 days nationwide, and up to 22% off by the box.",
  alternates: { canonical: "/store" },
};

export function StoreHomePage() {
  return (
    <>
      <HeroCarousel />
      <CategoryTiles />
      <FeaturedProducts />
      <WhyShop />
      <BulkPromo />
      <BlogStrip />
    </>
  );
}
