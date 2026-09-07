import { COMMERCE_API_BASE, clampAddOnQty, productAddOnsPath } from "@plaspool/shop";

/**
 * `/api/add-ons/for-product/<slug>?qty=<n>` — the buy box's read of the
 * add-ons a product would be offered, proxied onto this origin.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS EXISTS FOR ONE REASON: THE UPSTREAM ROUTE SENDS NO CORS HEADER.
 * `GET /api/shop/cart` answers a cross-origin request with
 * `Access-Control-Allow-Origin`; `GET /api/shop/add-ons/for-product/<slug>`
 * answers with none. Verified 2026-09-07 on `admin.plaspool.com` with
 * `Origin: https://plaspool.com` and on `admin.dev.plaspool.com` with
 * `Origin: https://dev.plaspool.com` — the cart carries the header, this route
 * does not. Its `OPTIONS` preflight advertises a full policy, which makes the
 * omission easy to miss, but a simple `GET` is never preflighted: the browser
 * reads the response's own headers, finds none, and blocks it.
 *
 * The quantity stepper has to re-ask as it moves — a rule's ceiling means the
 * offer VANISHES at five items rather than growing, so multiplying client-side
 * would promise a saving the cart refuses — and the browser cannot ask the API
 * directly. So it asks here, and the Worker asks upstream, where CORS does not
 * apply. Exactly the trick `/images/shop/<id>` plays for product pictures.
 *
 * DELETE THIS ROUTE the day the API sends the header; `fetchProductAddOns` in
 * `packages/shop/src/data/add-ons-api.ts` is the only caller and would point
 * straight at the API instead.
 *
 * ═══ WHAT IT WILL NOT DO ═══
 * It is a READ of a PUBLIC, per-product estimate, and nothing more:
 *
 *   - No cookie, no `Authorization`, no credentials are forwarded. The
 *     upstream route needs none, and a proxy that passed a session on would
 *     turn a cacheable public read into a per-viewer one.
 *   - The slug is matched against the same allow-list `/api/revalidate` uses,
 *     so no caller can steer the upstream path. `qty` is clamped to the
 *     schema's own 1–1000 before it is sent, because the upstream is strict
 *     and a `400` here would take out a buy box over a stepper.
 *   - Unknown query parameters are DROPPED rather than forwarded. The upstream
 *     schema rejects them with a `400`, and this route is not a place to
 *     discover that.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** The same shape `/api/revalidate` accepts, and for the same reason: a slug
 *  is the only thing a caller may name, and it may not contain a path. */
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

/** Matches `getProductAddOns`'s server-side window. An add-on rule is edited
 *  in the admin with no deploy, so it moves on marketing time, not the
 *  catalogue's hour. */
const REVALIDATE = 300;

export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!SLUG.test(slug)) {
    return Response.json({ error: "bad_slug" }, { status: 400 });
  }

  const raw = Number(new URL(request.url).searchParams.get("qty") ?? "1");
  const qty = clampAddOnQty(raw);

  let upstream: Response;
  try {
    upstream = await fetch(`${COMMERCE_API_BASE}${productAddOnsPath(slug, qty)}`, {
      next: { revalidate: REVALIDATE },
    });
  } catch {
    /* THE BUY BOX TREATS EVERY FAILURE AS "NO OFFERS", so an unreachable API
       costs a shopper one control rather than the page. 502 rather than a
       fabricated empty body: a cache must not keep "no offers" from an outage
       for five minutes. */
    return Response.json({ error: "upstream_unreachable" }, { status: 502 });
  }

  if (!upstream.ok) {
    /* Pass the status through — a `404` is a slug that is not a live product,
       which the client reads as "no control here" — but never the body, which
       is the API's own error shape and not this route's to publish. */
    return Response.json({ error: "unavailable" }, { status: upstream.status });
  }

  const body = await upstream.text();
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      /* Public because the answer is identical for every viewer — the upstream
         carries no `choice` and no per-viewer field, by construction and by a
         server test. `stale-while-revalidate` so a stepper press never waits
         on the API twice for the same number. */
      "cache-control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=600`,
    },
  });
}
