import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { CATALOG_TAG, productTag } from "@plaspool/shop";

/**
 * `POST /api/revalidate` — the admin telling the storefront the catalogue moved.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ THIS ENDPOINT IS UNAUTHENTICATED, ON PURPOSE, AND IT IS A KNOWN DEBT.
 *
 * Written out in full HERE rather than pointed at a document, because `*.md`
 * is gitignored repo-wide and a note in CLAUDE.md does not survive a clone.
 * This comment is the record.
 *
 * Anyone who can reach the storefront can call this. It takes no secret, no
 * signature and no allow-listed origin. It ships this way because the
 * alternative was shipping nothing, and an hour-stale price is a worse bug
 * today than a theoretical one — but the trade is real and it is this:
 *
 *   CACHE-BUSTING AS A DENIAL OF WALLET. Each call forces the next request for
 *   every catalogue page to miss cache and re-render against the commerce API.
 *   A loop against this path turns a shop that serves almost everything out of
 *   KV back into one that full-renders on every view — which is exactly the
 *   condition (27ms median CPU against a 10ms budget) that made storefront #9
 *   an Error 1102 outage. The blast radius of abusing this is a repeat of #9.
 *
 *   AMPLIFICATION. One small POST costs the caller nothing and costs the
 *   Worker a full render plus upstream fetches, per page, per purge.
 *
 *   IT IS NOT A DATA BUG. Nothing here reads, writes or exposes catalogue,
 *   customer or order data. The worst available outcome is load.
 *
 * TO FIX: put a `REVALIDATE_SECRET` in Cloudflare and require it as a bearer
 * token or an HMAC over the body — note that this makes the storefront's
 * "exactly one secret" property false, which is documented in two places — or
 * put a Cloudflare rate-limiting rule in front of this path, or both. The
 * admin that fires this webhook needs the same secret added.
 *
 * The two mitigations that cost nothing are here, and neither is a substitute
 * for the secret:
 *
 *   1. THE TAG SPACE IS AN ALLOW-LIST. The body names a SLUG, never a tag.
 *      A caller cannot purge an arbitrary tag, cannot reach the blog's or the
 *      marketing fetches' caches, and cannot invent a tag that matches
 *      something it should not. The worst it can name is a product.
 *   2. POST ONLY. A GET that mutates cache state gets fired by every crawler,
 *      link preview and browser prefetch that ever sees the URL — it would be
 *      self-DoSing without an attacker. There is deliberately no GET handler,
 *      which also means you cannot test this from the address bar.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ═══ WHY `{ expire: 0 }` AND NOT `updateTag` ═══
 * Next 16 made the second argument to `revalidateTag` required: without it the
 * call still works but logs a deprecation. `updateTag` is the "expire right
 * now" call and it THROWS in a route handler — it is Server-Action-only, by an
 * explicit check on `page.endsWith("/route")`. So the immediate-expiry profile
 * is spelled inline here.
 */

/* A purge is a write. Nothing about this route may be prerendered or cached. */
export const dynamic = "force-dynamic";

/**
 * What a slug is allowed to look like.
 *
 * Lowercase, digits and hyphens, starting on a word character, capped at 80.
 * Every slug the commerce API mints fits this; anything that does not is
 * either a typo or somebody probing, and both get the same 400. The cap
 * matters independently of the character set — a tag is a KV key, and an
 * unbounded one from a stranger is an unbounded key from a stranger.
 */
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

/** Immediate expiry. See the header for why this is spelled out. */
const NOW = { expire: 0 } as const;

export async function POST(request: NextRequest) {
  /* AN EMPTY OR UNPARSEABLE BODY IS NOT AN ERROR — it means "the whole
     catalogue", which is the shape a bulk import or a category rename wants,
     and demanding a slug for it would push the caller into sending one request
     per product. `request.json()` rejects on a missing body as readily as on
     malformed JSON, so both land here as `null`.

     Typed `unknown` rather than left as `json()`'s `any`: `slug` comes from a
     stranger, and `any` would let it reach `productTag()` without the check
     below ever being required to exist. */
  const body: unknown = await request.json().catch(() => null);
  const slug =
    body !== null && typeof body === "object" ? (body as { slug?: unknown }).slug : undefined;

  const revalidated: string[] = [];

  /* ALWAYS THE CATALOGUE TAG, EVEN WHEN A SLUG IS NAMED. Editing one product
     changes the listings it appears in — its price on a card, its badges, its
     swatch row, whether it appears in a category at all — and those are the
     `listProducts()` fetch, not the detail one. Purging only the product tag
     would fix the product page and leave every grid in the shop quoting the
     old price, which is the more visible half of the bug. */
  revalidateTag(CATALOG_TAG, NOW);
  revalidated.push(CATALOG_TAG);

  if (slug !== undefined && slug !== null) {
    if (typeof slug !== "string" || !SLUG.test(slug)) {
      return NextResponse.json(
        { ok: false, message: "slug must match /^[a-z0-9][a-z0-9-]{0,79}$/" },
        { status: 400 },
      );
    }
    const tag = productTag(slug);
    revalidateTag(tag, NOW);
    revalidated.push(tag);
  }

  /* The caller gets back exactly what was purged rather than a bare `ok`, so a
     misconfigured admin sending `{ id: 42 }` instead of `{ slug: "..." }` can
     see in its own logs that only the catalogue tag went — rather than reading
     a 200 as "the product page is fixed" and debugging the storefront. */
  return NextResponse.json({ ok: true, revalidated });
}
