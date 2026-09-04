import { StoreHomePage, storeHomeMetadata, withCurrency } from "@plaspool/shop";

/**
 * `/usd/store` — the shop home, priced in dollars.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE SAME COMPONENT AS `/store`, with one extra param. There is no second
 * implementation of anything here and there must not be: two copies of the
 * shop home is how the two currencies start disagreeing about what the shop
 * sells.
 *
 * ═══ WHY A PATH SEGMENT RATHER THAN A COOKIE ═══
 * Reading a cookie server-side needs `cookies()`, which makes the route
 * dynamic — discarding prerendering, taking `/store` off the KV cache, and
 * full-rendering every view. That is the storefront #9 Error 1102 condition.
 * A segment keeps both currencies static. `currency-routing.ts` sets the whole
 * argument out, including what it costs.
 *
 * ═══ AND WHY THE SEGMENT IS LITERAL ═══
 * `[currency]` was tried and removed: a dynamic segment here is greedy enough
 * that `@next/next/no-html-link-for-pages` began reading `/contact` as a match
 * for it. Paystack closes the set at NGN and USD, so the filesystem can too.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export default function UsdStoreHome() {
  return <StoreHomePage params={withCurrency(Promise.resolve({}), "USD")} />;
}

export const metadata = storeHomeMetadata;

/* Matches `/store` exactly. The two trees revalidate on the same window
   because they are the same catalogue quoted twice — a dollar page going
   stale slower than its naira twin would be a difference with no cause. */
export const revalidate = 300;
