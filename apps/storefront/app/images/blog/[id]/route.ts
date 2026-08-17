import { BLOG_API } from "@plaspool/blog";

/**
 * `/images/blog/<id>` — the cover-image proxy (issue #14).
 *
 * The blog API's `/api/public/images/<id>` answers with a 302 to a presigned
 * R2 URL. That indirection is correct upstream — a 5-minute credential must
 * never be baked into ISR-cached HTML — but it made every image view two
 * uncached round trips: the redirect carries `private, no-store` because a
 * cached 302 would outlive the credential inside it, and the R2 URL it points
 * at is different on every presign, so neither leg could ever hit a cache.
 * Production showed the result plainly: more 3xx responses than 2xx.
 *
 * This route follows the redirect SERVER-SIDE and serves the bytes from a
 * URL that never changes, so the response can finally carry real caching.
 *
 * WHY `immutable` IS SAFE: an image id names one committed upload — replacing
 * a post's cover means uploading a new image, which gets a NEW id. The HTML
 * that references the id re-renders within the existing ISR windows (300s
 * lists / 3600s detail), so a replaced cover changes the URL rather than the
 * bytes behind an old one. That is the content-addressed pattern `immutable`
 * exists for, and it is what keeps #14's "no regression in freshness"
 * criterion: freshness rides on the HTML, exactly as it did before.
 *
 * The body is buffered rather than streamed because the edge cache needs a
 * second read of it, and a cover image comfortably fits Worker memory.
 */

const ID = /^[A-Za-z0-9_-]+$/;

const IMMUTABLE = "public, max-age=31536000, immutable";
/** Upstream said no (unpublished, deleted, never existed). Cached briefly so
 *  a probed id cannot drive a request-per-view through to the blog API. */
const NEGATIVE = "public, max-age=60";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!ID.test(id)) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": NEGATIVE } });
  }

  /*
   * Cloudflare's edge cache, when it exists. Worker responses are not
   * edge-cached automatically; `caches.default` is the opt-in. Guarded
   * because it is absent in `next dev` (Node), and a documented no-op on
   * workers.dev — it becomes real the day this runs on the custom domain,
   * with no code change. Browser caching via the header below works
   * everywhere today.
   */
  const edge = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = new Request(request.url);
  if (edge) {
    try {
      const hit = await edge.match(cacheKey);
      if (hit) return hit;
    } catch {
      /* A broken cache must never break the image. */
    }
  }

  const upstream = await fetch(`${BLOG_API}/images/${id}`, { redirect: "follow" });
  if (!upstream.ok) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": NEGATIVE } });
  }

  const bytes = await upstream.arrayBuffer();
  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
    "Cache-Control": IMMUTABLE,
    "X-Content-Type-Options": "nosniff",
  });

  if (edge) {
    try {
      await edge.put(cacheKey, new Response(bytes.slice(0), { headers }));
    } catch {
      /* Same rule: the cache is an optimisation, never a precondition. */
    }
  }

  return new Response(bytes, { headers });
}
