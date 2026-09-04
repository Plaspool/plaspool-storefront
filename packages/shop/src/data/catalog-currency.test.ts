import { describe, expect, it } from "vitest";

import { currencyQuery } from "./catalog";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * "OMIT THE PARAMETER FOR NAIRA" IS A CACHING RULE, NOT A FORMATTING ONE.
 *
 * `getJson` keys Next's fetch cache by URL. `/api/shop/products` and
 * `/api/shop/products?currency=NGN` are therefore TWO entries holding byte-
 * identical responses — so a stray `?currency=NGN` would make every naira page
 * miss the entry this shop has been filling since it launched, and each miss
 * costs a KV write to refill.
 *
 * That is not a cosmetic waste here. `CLAUDE.md` records deploys already
 * failing against the free tier's 1,000 KV writes a day, with the live site
 * silently freezing on stale entries when the cap is hit. Doubling the
 * catalogue's cache entries for no change in the response is the cheapest way
 * back into that failure.
 * ═══════════════════════════════════════════════════════════════════════════
 */

describe("the currency query string", () => {
  it("sends nothing for the default currency, so the existing cache entry is reused", () => {
    expect(currencyQuery("NGN")).toBe("");
    expect(currencyQuery(undefined)).toBe("");
  });

  it("sends the parameter for a non-default currency", () => {
    expect(currencyQuery("USD")).toBe("?currency=USD");
  });

  it("takes the DEFAULT from the shop rather than assuming naira", () => {
    /* A shop whose configured default is USD should be the one paying nothing
       for its own pages, and NGN should be the variant. Nothing in the
       storefront hardcodes which currency is "normal" — that is the currency
       config's answer, and this argument is how it reaches the URL. */
    expect(currencyQuery("USD", "USD")).toBe("");
    expect(currencyQuery("NGN", "USD")).toBe("?currency=NGN");
  });

  it("produces a URL a purge still reaches", () => {
    /* Both currencies are tagged `CATALOG_TAG` (see `listProducts`), so this
       is only about the URL being well-formed enough to append to a path that
       has no query of its own — which every catalogue path here does not. */
    expect(`/api/shop/products${currencyQuery("USD")}`).toBe("/api/shop/products?currency=USD");
    expect(`/api/shop/products/pla${currencyQuery("USD")}`).toBe(
      "/api/shop/products/pla?currency=USD",
    );
  });
});
