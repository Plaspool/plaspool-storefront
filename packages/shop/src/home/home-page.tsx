import type { Metadata } from "next";

import { primaryCategoryLink } from "../data/catalog";
import { currencyFromSegment } from "../data/currency-routing";
import { HeroCarousel } from "./hero-carousel";
import { CategoryTiles } from "./category-tiles";
import { FeaturedProducts } from "./featured-products";
import { WhyShop } from "./why-shop";
import { BulkPromo } from "./bulk-promo";
import { RewardsBand } from "./rewards-band";
import { BlogStrip } from "./blog-strip";

/**
 * `/store`. The announcement bar, nav and footer around this come from
 * `ShopShell`, mounted once by the `(shop)` layout — this component is only
 * the six sections between them, in the spec's order.
 *
 * `BlogStrip` is async and renders `null` when the content API is empty or
 * unreachable, which is its normal state today. Nothing else on the page
 * depends on it, so it simply drops out.
 *
 * `RewardsBand` and `BulkPromo` now behave the same way — the first when no
 * rewards programme is configured, the second when there is no bulk discount
 * ladder to advertise (or, failing that, no catalogue price to quote it
 * against). Three of the sections on this page can therefore be absent, and
 * the page is composed so that any of them dropping out leaves a shorter page
 * rather than a gap.
 *
 * ═══ REWARDS SITS ABOVE `WhyShop`, NOT AFTER `BulkPromo` ═══
 * It used to close the money conversation — buy by the box, then what happens
 * to the empties — which put the one section on this page that is unique to
 * PlaSpool sixth, below three claims any filament shop could make. Sending
 * empty spools back for points is the thing a shopper cannot get elsewhere, so
 * it now comes straight off the featured products, while they are still
 * looking at spools, and `WhyShop` follows as the supporting argument it
 * always was.
 *
 * IT IS ALSO PAINTED NOW, which is what makes the order safe. `RewardsBand`
 * and `BulkPromo` are both `bg-brand` bands, and `WhyShop` sitting between
 * them is what keeps the page from ending on two purples with no seam — the
 * fault the marketing landing page's CTA comment describes from the other
 * side. Reordering these three again means checking that no two painted
 * sections end up adjacent.
 */

export const storeHomeMetadata: Metadata = {
  title: "Buy 3D printer filament in Nigeria — PLA, PETG, ABS, TPU",
  description:
    "PLA, PLA+, PETG, ABS, ASA and TPU filament extruded in Abuja and measured to ±0.02 mm. Next-day delivery in Abuja, 2–4 days nationwide.",
  alternates: { canonical: "/store" },
};

/* ASYNC ONLY FOR THE HERO'S LINK, AND IT COSTS NOTHING EXTRA: `CategoryTiles`
   below and `ShopShell` around this both call `listCategories()` already, so
   this is the same cached fetch on the same 300s window rather than a third
   request or a shorter window for the route. */
export async function StoreHomePage({
  params,
}: {
  /* OPTIONAL, BECAUSE THIS COMPONENT SERVES TWO ROUTES. `/store` has no
     params at all; `/usd/store` supplies the segment. An absent `currency`
     IS the default currency — see `currency-routing.ts`. */
  params?: Promise<{ currency?: string }>;
} = {}) {
  const currency = currencyFromSegment((await params)?.currency);
  const primary = await primaryCategoryLink();
  return (
    <>
      <HeroCarousel primary={primary} />
      <CategoryTiles />
      {/* Only the sections that QUOTE A PRICE take the currency. The category
          tiles, the returns band and the blog strip carry no figures from the
          catalogue, so threading it into them would be plumbing with nothing
          on the other end. */}
      <FeaturedProducts currency={currency} />
      <RewardsBand />
      <WhyShop />
      <BulkPromo currency={currency} />
      <BlogStrip />
    </>
  );
}
