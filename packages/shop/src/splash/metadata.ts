import type { Metadata } from "next";

/**
 * `/shop` is a gateway, not a page. It holds no content of its own — it plays
 * the opening sequence and hands over to `/store`, which is the canonical shop
 * entry and the URL every internal link uses.
 *
 * So it is `noindex, nofollow` and excluded from the sitemap. A search result
 * pointing at `/shop` would put a brand animation between someone and the
 * thing they searched for, and a crawler that cannot run the redirect would
 * index an empty page under the shop's own name.
 */
export const shopGatewayMetadata: Metadata = {
  title: "Entering the shop",
  robots: { index: false, follow: false },
  alternates: { canonical: "/store" },
};
