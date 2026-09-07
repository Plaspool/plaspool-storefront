import type { Metadata } from "next";

import { currencyFromSegment } from "../data/currency-routing";
import { CategoryTiles } from "./category-tiles";
import { FeaturedProducts } from "./featured-products";
import { WhyShop } from "./why-shop";
import { BulkPromo } from "./bulk-promo";
import { RewardsBand } from "./rewards-band";
import { BlogStrip } from "./blog-strip";

/**
 * `/store`. The announcement bar, nav and footer around this come from
 * `ShopShell`, mounted once by the `(shop)` layout — this component is only
 * the five sections between them, in the spec's order.
 *
 * ═══ THE HERO CAROUSEL IS GONE, AND THE PAGE OPENS ON PRODUCT ═══
 * `HeroCarousel` stood first: two auto-advancing slides of brand copy over a
 * tinted spool, a whole phone screen deep before the first thing a shopper
 * could buy. It sold the shop to somebody who had already walked into it, and
 * on a 375 px screen the featured grid began below the fold.
 *
 * NOTHING IT SAID WAS LOST. Both of its slides are claims `WhyShop` already
 * makes further down, in the same words — "Made in Nigeria / Extruded in
 * Abuja" and "Tolerance tested / ±0.02 mm" — where they support a decision
 * instead of delaying one. Its single CTA pointed at `primaryCategoryLink()`,
 * which is where `CategoryTiles` and the nav both go anyway; that call left
 * this file with it.
 *
 * The component itself is still built and exported from the package
 * (`home/hero-carousel.tsx`) — it is simply not mounted, the way
 * `ShippingPolicy` outlives the route that 404s. Putting a hero back is an
 * import and a line, not a rewrite.
 *
 * `BlogStrip` is async and renders `null` when the content API is empty or
 * unreachable, which is its normal state today. Nothing else on the page
 * depends on it, so it simply drops out.
 *
 * `RewardsBand` and `BulkPromo` now behave the same way — the first when no
 * rewards programme is configured, the second when there is no bulk discount
 * ladder to advertise (or, failing that, no catalogue price to quote it
 * against). `CategoryTiles` is a fourth: it renders nothing below two
 * categories, which is the state the shelf is in today and the reason the
 * featured row is what a shopper now lands on. Four of the sections on this
 * page can therefore be absent, and the page is composed so that any of them
 * dropping out leaves a shorter page rather than a gap.
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

/* STILL ASYNC, BUT ONLY FOR `params` NOW. It used to be async for the hero's
   `primaryCategoryLink()` as well, which was free because `CategoryTiles` and
   `ShopShell` call `listCategories()` on the same cached window. That call
   left with the hero; the `await` below is the whole reason for the keyword. */
export async function StoreHomePage({
  params,
}: {
  /* OPTIONAL, BECAUSE THIS COMPONENT SERVES TWO ROUTES. `/store` has no
     params at all; `/usd/store` supplies the segment. An absent `currency`
     IS the default currency — see `currency-routing.ts`. */
  params?: Promise<{ currency?: string }>;
} = {}) {
  const currency = currencyFromSegment((await params)?.currency);
  return (
    <>
      {/* THE PAGE'S `h1`, AND IT IS HIDDEN BECAUSE THE HERO THAT CARRIED THE
          VISIBLE ONE IS GONE. Every section below opens with an `h2`, so
          without this the store's own landing page would be the only page in
          the shop with no top-level heading — see the `<h1>` on each of
          `account/`, `listing-page.tsx` and `product/buy-box.tsx`. Nothing is
          drawn for it on purpose: a page title standing over the featured grid
          is the chrome this change removed. Same pattern, and the same reason,
          as `checkout/checkout-complete.tsx`. */}
      <h1 className="sr-only">Buy 3D printer filament in Nigeria</h1>
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
