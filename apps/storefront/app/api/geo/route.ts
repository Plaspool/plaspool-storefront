import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { detectGeoHint } from "@plaspool/shop";

/**
 * `GET /api/geo` — where this connection seems to be, as the edge sees it.
 *
 * The checkout preselects the delivery country from this (see
 * `packages/shop/src/data/geo-hint.ts` for what is and is not done with it).
 * It is the storefront's own route rather than a browser-side lookup because
 * Cloudflare already knows the answer for every request and hands it to the
 * Worker for free — no third party, no key, no extra round trip to anyone.
 *
 * `getCloudflareContext()` THROWS OUTSIDE A WORKER — which includes `next
 * dev`, where this route still has to answer. There the `cf` object is simply
 * absent and the hint is empty, which is the documented local-dev condition
 * (`lib/images/proxy.ts` handles the same call the same way).
 *
 * PRIVATE AND UNCACHED. The answer is about the caller's IP, so it must never
 * be served to the next caller from a shared cache.
 */

export const dynamic = "force-dynamic";

function cfProperties(): Record<string, unknown> | undefined {
  try {
    return getCloudflareContext().cf as Record<string, unknown> | undefined;
  } catch {
    return undefined;
  }
}

export function GET(request: Request) {
  return NextResponse.json(detectGeoHint(request.headers, cfProperties()), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
