import { COMMERCE_API_BASE } from "@plaspool/shop";

/**
 * `/api/variants/<id>/availability` — a mystery box's live, pool-aware stock,
 * proxied onto this origin.
 *
 * THE SAME REASON `/api/add-ons/for-product/<slug>` EXISTS: the upstream route
 * sends no `Access-Control-Allow-Origin`. Verified 2026-09-15 on
 * `admin.plaspool.com` with `Origin: https://plaspool.com` — a 200 with no CORS
 * header, so the browser blocks the read. Delete this route the day the API
 * sends one; `fetchVariantAvailability` in `packages/shop/src/data/mystery-box.ts`
 * is the only caller.
 *
 * UNCACHED ON PURPOSE. A box sells out when its POOL empties, which happens on
 * somebody else's order, and a cached "3 can be packed" is exactly the stale
 * answer the read exists to replace. No credentials are forwarded; the id is
 * allow-listed so no caller can steer the upstream path.
 */

export const dynamic = "force-dynamic";

const VARIANT_ID = /^var_[a-z0-9]{1,64}$/;

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!VARIANT_ID.test(id)) {
    return Response.json({ error: "bad_variant" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${COMMERCE_API_BASE}/api/shop/variants/${encodeURIComponent(id)}/availability`,
      { cache: "no-store" },
    );
  } catch {
    return Response.json({ error: "upstream_unreachable" }, { status: 502 });
  }

  if (!upstream.ok) {
    return Response.json({ error: "unavailable" }, { status: upstream.status });
  }

  return new Response(await upstream.text(), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
