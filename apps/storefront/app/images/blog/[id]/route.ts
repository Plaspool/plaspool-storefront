import { BLOG_API } from "@plaspool/blog";

import { proxyImage } from "@/lib/images/proxy";

/**
 * `/images/blog/<id>` — the cover-image proxy (issue #14).
 *
 * The policy — why the proxy exists, why `immutable` is safe, why negatives are
 * cached, why the cache write is deferred, and what a Worker invocation per
 * image actually costs — lives in `lib/images/proxy.ts` and is worth reading
 * rather than paraphrasing here. This route supplies the host and nothing else.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxyImage(request, id, { upstream: `${BLOG_API}/images/${id}` });
}
