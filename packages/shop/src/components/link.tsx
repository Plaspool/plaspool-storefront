"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

import { currencyFromPathname, currencyHref } from "../data/currency-routing";

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
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * IT ALSO KEEPS A SHOPPER INSIDE THE CURRENCY THEY ARE BROWSING IN.
 *
 * The currency is a path segment (`/usd/store/…`, see `currency-routing.ts`),
 * because a cookie read server-side would make the whole catalogue dynamic and
 * cost it the prerendering that keeps it off the Worker's critical path. That
 * leaves one problem: every card, breadcrumb and nav item in this package
 * links to `/store/…`, and following one out of `/usd/store` would drop the
 * shopper silently back into naira mid-journey.
 *
 * ═══ READ FROM THE PATHNAME, NOT A PROP AND NOT A CONTEXT ═══
 * A context cannot be read here, because `Link` is rendered from Server
 * Components throughout this package. Threading a `currency` prop would touch
 * nearly every component in it to restate something the URL already says. The
 * page a shopper is ON is the statement of which currency they are browsing
 * in, so a link out of it stays in the same tree — one place, no plumbing, and
 * impossible to forget at a call site.
 *
 * ONLY CATALOGUE PATHS MOVE. `/cart`, `/checkout` and `/account` are returned
 * untouched: a cart's currency is written server-side at creation and is
 * authoritative, so a URL asserting a different one would contradict it. See
 * `currencyHref`.
 *
 * ═══ THIS IS WHY THE FILE IS NOW `"use client"` ═══
 * `usePathname()` requires it. In practice nothing is added to the bundle that
 * was not already there — `next/link` is itself a client component, so every
 * `<Link>` already crossed this boundary; the wrapper simply crosses it one
 * level earlier.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const pathname = usePathname();
  /* Only a string href is rewritten. Next also accepts a `UrlObject`, which no
     call site in this package uses; one arriving here is passed through
     untouched rather than being half-understood. */
  const next =
    typeof href === "string" ? currencyHref(href, currencyFromPathname(pathname)) : href;
  return <NextLink prefetch={false} href={next} {...props} />;
}
