import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * The blog's `<Link>`. Identical to `next/link` except that it does not
 * prefetch.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ TEMPORARY, AND TIED TO THE HOSTNAME.
 *
 * The full record of why prefetching is off — the `*.workers.dev` CDN bypass
 * that makes the `s-maxage` on every RSC response inert, the free tier's
 * 100,000 reads and 100,000 requests per day, and the condition for deleting
 * this — lives in `packages/shop/src/components/link.tsx`. Read that first.
 * This is the same decision applied to the blog, and THE TWO ARE REMOVED IN
 * THE SAME COMMIT: they exist for one reason and it is fixed in one place.
 *
 * Blog cannot import the shop's copy — `@plaspool/shop` depends on
 * `@plaspool/blog`, so that edge runs the wrong way — and `@plaspool/ui`
 * imports nothing from `next/*` today, which is a property worth keeping.
 * Hence a second file rather than a shared one.
 *
 * ═══ WHAT IS DIFFERENT HERE, AND WHY IT IS WORSE THAN THE SHOP'S CASE ═══
 *
 * Most links on the blog carry a query string: `/posts?tag=…` from every card
 * and every chip, `/posts?category=…` from the category index. They all land
 * on `/posts`, and `PostsIndexPage` awaits `searchParams`, so a query-carrying
 * request RENDERS DYNAMICALLY — the route's `revalidate = 300` describes the
 * unfiltered page, not these.
 *
 * So a prefetch here is not a KV read against a cached page, which is what a
 * warmed product card costs. IT IS A FULL RENDER on the Worker, against the
 * 10ms CPU budget that storefront #9 (Error 1102) was only just brought back
 * inside — the same budget `open-next.config.ts` is written around.
 *
 * And the fan-out multiplies rather than adds. A post index warms the hit link
 * on every card AND a chip for every tag on every card; `/posts/tags` warms
 * one per tag in the whole blog; `/posts/categories` one per category. Every
 * one of those is a dynamic render waiting to be paid for by a reader who
 * scrolled past a chip they never clicked.
 *
 * Prefetching a dynamic route is the expensive case of an already expensive
 * habit. That is why the blog gets this treatment despite carrying a fraction
 * of the shop's traffic.
 *
 * An explicit `prefetch` still wins: the default is applied BEFORE the spread,
 * so a link genuinely worth warming can say so at the call site.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
