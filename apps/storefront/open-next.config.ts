import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";
import kvNextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/kv-next-tag-cache";

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
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  queue: memoryQueue,
  tagCache: kvNextTagCache,
  enableCacheInterception: true,
});
