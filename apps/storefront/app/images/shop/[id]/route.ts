import { COMMERCE_API_BASE } from "@plaspool/shop";

/**
 * `/images/shop/<id>` — the product-image proxy.
 *
 * THE BLOG SOLVED THIS AND THE SHOP DID NOT USE IT. `app/images/blog/[id]`
 * carries the full reasoning; this is the same route pointed at the commerce
 * API, and its header is worth reading rather than paraphrasing here.
 *
 * The short version: `/api/public/images/<id>` answers a 302 to a presigned R2
 * URL. The redirect carries `private, no-store` — correct upstream, because a
 * cached 302 would outlive the 5-minute credential inside it — and the R2 URL
 * differs on every presign, so NEITHER leg can be cached by anything. The blog
 * measured the result in production: more 3xx responses than 2xx.
 *
 * Product images went straight at that endpoint, cross-origin, so every card in
 * every grid re-paid two uncacheable round trips on every view — on a shop that
 * exists to sell to Nigerian mobile connections. Worse, with nothing cached
 * anywhere, an outage at the commerce API blanks every picture in the shop with
 * no copy to fall back on.
 *
 * Following the redirect server-side gives a URL that never changes, so the
 * response can finally carry `immutable`. Same-origin also means the browser
 * skips a connection setup and a preflight it was doing per image.
 */

const ID = /^[A-Za-z0-9_-]+$/;

const IMMUTABLE = "public, max-age=31536000, immutable";
/** Upstream said no. Cached briefly so a probed id cannot drive a
 *  request-per-view through to the commerce API. */
const NEGATIVE = "public, max-age=60";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ID.test(id)) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": NEGATIVE } });
  }

  /* Cloudflare's edge cache when it exists — absent in `next dev`, a documented
     no-op on workers.dev, real on the custom domain with no code change. */
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

  const upstream = await fetch(`${COMMERCE_API_BASE}/api/public/images/${id}`, {
    redirect: "follow",
  });
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
      /* The cache is an optimisation, never a precondition. */
    }
  }

  return new Response(bytes, { headers });
}
