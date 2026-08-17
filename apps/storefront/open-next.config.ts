import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

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
 * Query-carrying listing requests (/store/all?q=…) still render dynamically
 * by design — a filtered view is shareable and crawlable. They ride the
 * same KV-backed fetch cache, and with the unfiltered baseline served from
 * cache they are the rare case, not every case.
 */
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  queue: memoryQueue,
  enableCacheInterception: true,
});
