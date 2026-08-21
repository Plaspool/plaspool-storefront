import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";
import queueCache from "@opennextjs/cloudflare/overrides/queue/queue-cache";
import kvNextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/kv-next-tag-cache";
import {
  softTagFilter,
  withFilter,
} from "@opennextjs/cloudflare/overrides/tag-cache/tag-cache-filter";

/*
 * The configuration that makes `revalidate` true in production (#9).
 *
 * This file used to be `defineCloudflareConfig()` with a comment noting that
 * ISR "will not persist across Worker instances" without a cache binding.
 * The practical consequence was worse than non-persistence: OpenNext's
 * default incremental cache is a no-op, so every request to every
 * `revalidate` route was a cache miss and a full server render. /store/all
 * rebuilt the entire 38-product listing — grid, facets, inline spool SVGs,
 * RSC serialisation — on every single view, and the blog re-fetched its API
 * upstream on every view. The dashboard read 27.4ms MEDIAN CPU against the
 * free plan's 10ms budget; Error 1102 was the difference being enforced.
 *
 * - `kvIncrementalCache`: rendered pages and fetch-cache entries persist in
 *   the NEXT_INC_CACHE_KV namespace (see wrangler.jsonc), so a revalidate
 *   window means what it says. Deploy seeds the build-time prerenders in.
 *
 * - `enableCacheInterception: true`: cached pages are served BEFORE Next's
 *   request pipeline boots — the difference between "cheap render" and
 *   "almost no render" for the exact hits that were tipping the budget.
 *   Must be revisited if PPR is ever enabled; they are incompatible.
 *
 * - `memoryQueue`: stale ISR entries revalidate by the Worker calling
 *   itself (WORKER_SELF_REFERENCE binding), deduped per isolate. The DO
 *   queue is the heavier alternative if duplicate revalidations across
 *   isolates ever show up as real cost in the logs — with observability
 *   now on, that is checkable rather than guessable.
 *
 * - `kvNextTagCache`: WITHOUT THIS, `revalidateTag()` IS A SILENT NO-OP.
 *   `POST /api/revalidate` would return 200, the admin would log a success,
 *   and the page would keep serving the old price until its window ran out —
 *   the worst failure shape available, because it looks like it worked. The
 *   tag cache is where "this tag was purged at T" is written, and cache
 *   interception reads it (`hasBeenRevalidated`) before serving a cached page.
 *
 *   KV RATHER THAN D1 OR THE SHARDED DO, and the reason is #9 again. That
 *   `hasBeenRevalidated` read is on the HOT PATH — every cached page serve
 *   does it. D1 makes it a database query per request against a 10ms CPU
 *   budget that Error 1102 was already enforcing; KV makes it an edge read
 *   next to the incremental-cache read that is happening anyway, against a
 *   binding type this Worker already runs.
 *
 *   THE PRICE IS EVENTUAL CONSISTENCY, AND IT IS STATED PLAINLY BY UPSTREAM:
 *   a KV write can take up to 60s to be visible everywhere, so a purge lands
 *   within about a minute rather than instantly, and two tags purged together
 *   can disagree for that minute. Against the hour this replaces that is not a
 *   close call. If a purge ever needs to be immediate, the sharded DO tag
 *   cache is the upgrade — it is strongly consistent and it costs a Durable
 *   Object, not a rewrite of anything here.
 *
 * Query-carrying listing requests (/store/all?q=…) still render dynamically
 * by design — a filtered view is shareable and crawlable. They ride the
 * same KV-backed fetch cache, and with the unfiltered baseline served from
 * cache they are the rare case, not every case.
 */
/*
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ `softTagFilter` — THE FREE KV READ TIER IS SPENT ON TAGS NOTHING PURGES.
 *
 * The free plan allows 100,000 KV READS PER DAY, and a bulk read is billed one
 * read PER KEY, not one per call. That matters here because a cached page serve
 * is not one KV read, it is:
 *
 *     1  (the page, from NEXT_INC_CACHE_KV)
 *   + N  (one per cache tag, from NEXT_TAG_CACHE_KV, via `hasBeenRevalidated`)
 *
 * and N is the `x-next-cache-tags` list Next writes at build time. Measured
 * from this app's own build output:
 *
 *     /                              5 tags  ->  6 reads per request
 *     /store/all                     7 tags  ->  8 reads per request
 *     /store/products/[slug]         9 tags  -> 10 reads per request
 *     /posts/[slug]                  8 tags  ->  9 reads per request
 *     /privacy, /terms, /shipping    5 tags  ->  6 reads per request
 *
 * FIVE TO SEVEN OF EVERY ONE OF THOSE TAGS IS A `_N_T_/…` SOFT TAG — Next's
 * internal per-segment tags (`_N_T_/layout`, `_N_T_/(shop)/store/[category]/page`
 * and so on). They only ever get purged by `revalidatePath()`, WHICH THIS APP
 * DOES NOT CALL ANYWHERE. `POST /api/revalidate` purges `catalog` and
 * `product:<slug>` and nothing else. So the shop was spending roughly three
 * quarters of its daily read budget looking up tags that can never change.
 *
 * The filter drops them before they reach KV. Pages whose tags are ALL soft —
 * the home page, the legal pages — short-circuit to zero tag reads without
 * touching KV at all. The rest fall to one or two. Average request cost goes
 * from ~8 reads to ~2.
 *
 * ⚠ THE PRECONDITION IS THE `revalidatePath` ONE, AND IT IS LOAD-BEARING. The
 * day someone adds a `revalidatePath()` call, it will appear to work and do
 * nothing, because the tag it writes is filtered out on the way in AND on the
 * way out. If that call is ever wanted, delete this filter in the same commit.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * `queueCache` — WITHOUT IT, ONE STALE PAGE RE-RENDERS ONCE PER REQUEST.
 *
 * `memoryQueue` de-dupes revalidations per isolate, but look at how long it
 * holds the de-dupe key: it `delete`s it in a `finally`, the moment the
 * revalidation returns. So it only ever collapses revalidations that are
 * IN FLIGHT AT THE SAME INSTANT, not ones that arrive a second apart.
 *
 * That interacts badly with the eventual consistency this file already accepts
 * above. The sequence is:
 *
 *   1. A request finds the page stale and fires a self-call to re-render it.
 *   2. The re-render finishes and WRITES the fresh entry to KV.
 *   3. KV takes UP TO 60 SECONDS to make that write visible everywhere.
 *   4. Every request arriving inside that window still reads the OLD entry,
 *      still concludes "stale", and — the de-dupe key having been dropped at
 *      step 2 — fires ANOTHER full re-render. And another.
 *
 * So the cost of a stale page is not one re-render, it is one re-render per
 * request for up to a minute: double the Worker invocations, a full render
 * each, plus a KV write each against a free tier that allows ONE THOUSAND
 * WRITES A DAY.
 *
 * `queueCache` holds the de-dupe key in the Cache API instead of an isolate's
 * `Set`, so it survives past the revalidation AND is shared by every isolate in
 * the colo. 60s rather than the 5s default is deliberate: the window being
 * closed is KV's propagation delay, and upstream names that as up to 60s.
 * Nothing is served staler for it — the entry was already being served stale
 * through that minute; the only thing suppressed is the redundant re-rendering
 * of it.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  queue: queueCache(memoryQueue, { regionalCacheTtlSec: 60 }),
  tagCache: withFilter({ tagCache: kvNextTagCache, filterFn: softTagFilter }),
  enableCacheInterception: true,
});
