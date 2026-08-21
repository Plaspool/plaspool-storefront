import { COMMERCE_API_BASE } from "@plaspool/shop";

import { proxyImage } from "@/lib/images/proxy";

/**
 * `/images/shop/<id>` — the product-image proxy.
 *
 * The same route as `app/images/blog/[id]` pointed at the commerce API; both
 * now share one implementation, so the caching policy cannot drift between
 * them. That policy, and the reasoning behind every part of it, is in
 * `lib/images/proxy.ts`.
 *
 * Product images went straight at `/api/public/images/<id>` cross-origin
 * before this existed, so every card in every grid re-paid two uncacheable
 * round trips on every view — on a shop that exists to sell to Nigerian mobile
 * connections.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxyImage(request, id, {
    upstream: `${COMMERCE_API_BASE}/api/public/images/${id}`,
  });
}
