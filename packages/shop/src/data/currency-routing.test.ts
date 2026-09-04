import { describe, expect, it } from "vitest";

import {
  DEFAULT_CURRENCY,
  canonicalPath,
  currencyFromPathname,
  currencyFromSegment,
  currencyHref,
  segmentFor,
  withCurrency,
} from "./currency-routing";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE URL SPACE, PINNED — BECAUSE GETTING IT WRONG IS EITHER A 404 OR AN
 * OUTAGE.
 *
 * The currency is a path segment so that every catalogue page stays STATIC.
 * The alternative — a cookie read with `cookies()` — makes the routes dynamic,
 * which discards `generateStaticParams`, stops `/store` being served from KV,
 * and full-renders on every view. That is the storefront #9 Error 1102 shape.
 *
 * Two rules below are the ones a careless edit breaks:
 *
 *   1. The DEFAULT currency has no segment. `/store`, never `/ngn/store`.
 *      Every existing link, bookmark and search result points at the bare
 *      path.
 *   2. Only the CATALOGUE is prefixed. `/cart` and `/checkout` read the
 *      currency off the cart, which the server wrote at creation and which is
 *      authoritative; `/usd/cart` is a route that does not exist, and if it
 *      did it would contradict the cart it claims to describe.
 * ═══════════════════════════════════════════════════════════════════════════
 */

describe("the default currency owns the bare path", () => {
  it("has no segment of its own", () => {
    expect(segmentFor(DEFAULT_CURRENCY)).toBeNull();
    expect(segmentFor("NGN")).toBeNull();
  });

  it("gives every other currency a lower-case segment", () => {
    expect(segmentFor("USD")).toBe("usd");
  });

  it("never rewrites an href when the currency is the default", () => {
    expect(currencyHref("/store/products/pla", "NGN")).toBe("/store/products/pla");
    expect(currencyHref("/store/products/pla", undefined)).toBe("/store/products/pla");
  });

  it("adds no segment to a route's params for the default currency", () => {
    /* `/ngn/store` must not exist: it would be a duplicate of `/store` for
       search engines to choose between. `withCurrency` is where a literal
       route injects the segment, so this is where that has to hold. */
    return expect(withCurrency(Promise.resolve({ slug: "pla" }), "NGN")).resolves.toEqual({
      slug: "pla",
    });
  });
});

describe("only the catalogue carries a currency", () => {
  it("prefixes the catalogue", () => {
    expect(currencyHref("/store", "USD")).toBe("/usd/store");
    expect(currencyHref("/store/all", "USD")).toBe("/usd/store/all");
    expect(currencyHref("/store/products/pla", "USD")).toBe("/usd/store/products/pla");
    expect(currencyHref("/store?sort=price-asc", "USD")).toBe("/usd/store?sort=price-asc");
  });

  it("leaves the cart and checkout alone, because the CART owns its currency", () => {
    /* Written server-side at creation and never updated. A URL asserting a
       different one would be a second, contradictory answer. */
    for (const href of ["/cart", "/checkout", "/checkout/complete", "/returns"]) {
      expect(currencyHref(href, "USD")).toBe(href);
    }
  });

  it("leaves the account alone, because an order is in whatever it was placed in", () => {
    for (const href of ["/account", "/account/orders", "/account/orders/ord_1", "/account/rewards"]) {
      expect(currencyHref(href, "USD")).toBe(href);
    }
  });

  it("does not staple a prefix onto something that is not a site path", () => {
    for (const href of ["https://example.com/store", "mailto:a@b.c", "#reviews", "store/x"]) {
      expect(currencyHref(href, "USD")).toBe(href);
    }
  });

  it("is not fooled by a path that merely starts with the same letters", () => {
    /* `/stores` and `/storefront` are not the catalogue. */
    expect(currencyHref("/stores", "USD")).toBe("/stores");
    expect(currencyHref("/storefront/x", "USD")).toBe("/storefront/x");
  });
});

describe("reading the currency back out of a URL", () => {
  it("recognises a currency segment", () => {
    expect(currencyFromSegment("usd")).toBe("USD");
    expect(currencyFromPathname("/usd/store/products/pla")).toBe("USD");
  });

  it("answers undefined for the bare path, which is the default currency", () => {
    expect(currencyFromPathname("/store/products/pla")).toBeUndefined();
    expect(currencyFromPathname("/")).toBeUndefined();
    expect(currencyFromPathname(null)).toBeUndefined();
  });

  it("refuses the default's own segment, which is never generated", () => {
    expect(currencyFromSegment("ngn")).toBeUndefined();
    expect(currencyFromPathname("/ngn/store")).toBeUndefined();
  });

  it("refuses an upper-case spelling, so there is only ONE URL per page", () => {
    /* `/USD/store` answering would be a duplicate of `/usd/store` — the same
       content at two addresses, for a search engine to choose between. */
    expect(currencyFromSegment("USD")).toBeUndefined();
    expect(currencyFromPathname("/USD/store")).toBeUndefined();
  });

  it("refuses a segment that is not a currency at all", () => {
    expect(currencyFromSegment("cart")).toBeUndefined();
    expect(currencyFromSegment("ghs")).toBeUndefined();
    expect(currencyFromSegment("")).toBeUndefined();
  });

  it("round-trips with `currencyHref`", () => {
    expect(currencyFromPathname(currencyHref("/store/products/pla", "USD"))).toBe("USD");
  });
});

describe("the canonical URL, so two currencies do not compete in search", () => {
  it("points a currency variant back at the default one", () => {
    expect(canonicalPath("/usd/store/products/pla")).toBe("/store/products/pla");
    expect(canonicalPath("/usd/store")).toBe("/store");
  });

  it("leaves the default's own paths untouched", () => {
    expect(canonicalPath("/store/products/pla")).toBe("/store/products/pla");
    expect(canonicalPath("/cart")).toBe("/cart");
  });

  it("is idempotent, so it cannot eat a real segment by being applied twice", () => {
    const once = canonicalPath("/usd/store/products/pla");
    expect(canonicalPath(once)).toBe(once);
  });
});

describe("withCurrency — how a literal route tells a shared component which tree it is", () => {
  it("adds the segment a page component will read back", async () => {
    const params = await withCurrency(Promise.resolve({ slug: "pla" }), "USD");
    expect(params).toEqual({ slug: "pla", currency: "usd" });
    /* Round-trips through the SAME validator a dynamic segment would have
       gone through, which is the point of injecting a segment rather than
       passing a `CurrencyCode` prop: one place decides what a valid currency
       segment is. */
    expect(currencyFromSegment(params.currency)).toBe("USD");
  });

  it("leaves the params untouched for the default currency", async () => {
    await expect(withCurrency(Promise.resolve({ category: "all" }), "NGN")).resolves.toEqual({
      category: "all",
    });
  });

  it("keeps every other param, because the route still needs them", async () => {
    await expect(
      withCurrency(Promise.resolve({ slug: "pla", other: 1 }), "USD"),
    ).resolves.toEqual({ slug: "pla", other: 1, currency: "usd" });
  });
});
