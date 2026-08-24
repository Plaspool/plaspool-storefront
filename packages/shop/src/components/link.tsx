import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * The shop's `<Link>`. Identical to `next/link` in every respect except that
 * it does not prefetch.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ THIS FILE EXISTS BECAUSE THE WORKER IS SERVED FROM `*.workers.dev`, AND
 *   IT SHOULD BE DELETED THE DAY IT NO LONGER IS.
 *
 * Next warms a `<Link>` when it enters the viewport by fetching that route's
 * RSC payload. Every one of those is a SEPARATE HTTP REQUEST to the Worker —
 * they appear in the logs as `GET /store/products/…?_rsc=…`. On a
 * `*.workers.dev` hostname nothing absorbs them: that host bypasses
 * Cloudflare's CDN, so the `s-maxage=31536000` already sitting on the response
 * is inert. `x-opennext-cache` reports HIT, so these are KV reads rather than
 * renders — cheap individually, paid on every visit, for a page most shoppers
 * never open.
 *
 * `perf(web): point the marketing links at /store and stop prefetching the
 * splash` established this for the marketing chrome, where the fan-out was
 * three links. The shop's fan-out is not three. `/store/all` renders the whole
 * 38-product listing, every card is a `<Link>`, and each one warms as the grid
 * scrolls past it:
 *
 *     1 page request        ->   ~2 KV reads  (the page, plus its one
 *                                              surviving tag after
 *                                              `softTagFilter`)
 *   + up to 38 prefetches   ->  ~76 KV reads
 *
 * The free tier allows 100,000 KV reads AND 100,000 Worker requests per day.
 * At ~78 reads and 39 requests per listing view, both budgets are gone at
 * roughly 1,300 views — and they run out together, because they are the same
 * cause counted twice.
 *
 * ═══ THE COST, STATED PLAINLY ═══
 * A click is now a fetch rather than a paint. On a product grid — where
 * tapping a card IS the page — that is a real regression, not a free win. It
 * is accepted only because the alternative is the shop going dark partway
 * through the day once the budget is spent.
 *
 * ═══ HOW THIS GETS REMOVED ═══
 * THE FIX IS THE HOSTNAME, NOT THIS FILE. Put the Worker behind a real zone —
 * `plaspool.com`, which `packages/brand/src/site.ts` already claims and
 * `next.config.ts` already redirects `www` to — and the CDN starts honouring
 * that `s-maxage`. Product pages are prerendered through
 * `generateStaticParams`, so prefetches would then be served from the edge:
 * absorbed before the Worker, never counted as a request, never a KV read.
 * Prefetch becomes free again at that point and this wrapper becomes pure
 * loss. Delete it and restore `import Link from "next/link"` across the
 * package.
 *
 * ═══ THE BLOG IS NOT COVERED ═══
 * `packages/blog` has the same shape — `post-card.tsx` is a bare `<Link>` on
 * an index that lists many of them — and is deliberately left alone here
 * rather than swept along silently.
 *
 * An explicit `prefetch` still wins: the default is applied BEFORE the spread
 * precisely so that a link genuinely worth warming can say so at the call
 * site.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
