import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * The shared implementation behind `/images/blog/<id>` and `/images/shop/<id>`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE PROXY EXISTS AT ALL (issue #14, and the shop's repeat of it).
 *
 * Both upstreams answer `/api/public/images/<id>` with a 302 to a presigned R2
 * URL. That indirection is correct upstream — a 5-minute credential must never
 * be baked into ISR-cached HTML — but it made every image view two uncacheable
 * round trips: the redirect carries `private, no-store`, because a cached 302
 * would outlive the credential inside it, and the R2 URL it points at differs
 * on every presign, so neither leg could ever hit a cache. Production showed
 * the result plainly: more 3xx responses than 2xx.
 *
 * Following the redirect SERVER-SIDE gives a URL that never changes, so the
 * response can finally carry real caching. Same-origin also means the browser
 * skips a connection setup and a preflight it was doing per image.
 *
 * WHY `immutable` IS SAFE: an image id names one committed upload — replacing a
 * cover or a product photo means uploading a new image, which gets a NEW id.
 * The HTML referencing the id re-renders within the existing ISR windows, so a
 * replaced picture changes the URL rather than the bytes behind an old one.
 * That is the content-addressed pattern `immutable` exists for.
 *
 * ═══ ONE FILE RATHER THAN TWO NEAR-IDENTICAL ROUTES ═══
 * The blog route came first and the shop route was copied from it, differing
 * only in which host it asks. They then had to be kept in sync by hand, and the
 * caching fixes below would have had to be applied twice and stay applied. The
 * routes are now thin: they supply an upstream URL, this supplies the policy.
 *
 * ═══ WHAT THIS COSTS, WHICH IS THE PART THAT KEEPS BEING UNDERESTIMATED ═══
 * A WORKER ROUTE IS A BILLABLE INVOCATION PER IMAGE. Unlike `/_next/static/*`,
 * which the assets binding serves for free without waking the Worker, every
 * `<img src="/images/...">` on every page is a request against the Worker's
 * daily allowance — and `caches.default` does NOT change that. An edge hit
 * saves the upstream round trip and the CPU; the invocation is still counted.
 *
 * THE ONLY THING THAT STOPS THE INVOCATION IS A CACHE RULE IN FRONT OF THE
 * WORKER — a Cloudflare Cache Rule on `/images/*` with "Eligible for cache"
 * and an Edge TTL, which is dashboard configuration and cannot be expressed in
 * this repository. `CDN-Cache-Control` below is what makes that rule behave
 * once it exists. Until it does, assume one invocation per image per cold
 * browser cache and size the catalogue's picture count accordingly.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Ids are opaque upstream identifiers: word characters, hyphen, underscore. */
const ID = /^[A-Za-z0-9_-]+$/;

/** A year, and safe for the reason argued in the header. */
const IMMUTABLE = "public, max-age=31536000, immutable";

/**
 * Upstream said no (unpublished, deleted, never existed).
 *
 * SHORT, BUT NOT ZERO, AND IT IS CACHED AT THE EDGE TOO. The id is the part of
 * this URL a stranger controls, so an uncached negative is a free amplifier:
 * one cheap request in, one full round trip to the commerce or blog API out,
 * repeatable. Sixty seconds collapses a probe loop to one upstream call a
 * minute per id while staying short enough that an image published moments ago
 * is not missing for long.
 */
const NEGATIVE = "public, max-age=60";

/** Deferred work: runs after the response is sent, never blocking it. */
type Background = (work: Promise<unknown>) => void;

export interface ImageProxyOptions {
  /** The upstream URL to follow, redirects and all. */
  upstream: string;
  /**
   * Cloudflare's edge cache. Absent in `next dev` (Node has no `caches`) and a
   * documented no-op on `workers.dev`; real on the custom domain with no code
   * change. Injectable so the tests can assert what was written.
   */
  cache?: Cache;
  /** Defaults to the Worker's `waitUntil`. */
  background?: Background;
  /** Defaults to the platform `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * `waitUntil` when there is a Worker to ask, inline otherwise.
 *
 * `getCloudflareContext()` THROWS OUTSIDE A WORKER — which includes `next dev`,
 * where these routes still have to work. Falling back to letting the promise
 * settle on its own is right there: Node will not tear the process down
 * mid-write the way an idle Worker is evicted.
 */
function platformBackground(): Background {
  return (work) => {
    const swallow = work.catch(() => {
      /* Best-effort by construction — see `store()`. */
    });
    try {
      getCloudflareContext().ctx.waitUntil(swallow);
    } catch {
      void swallow;
    }
  };
}

function platformCache(): Cache | undefined {
  return (globalThis as { caches?: { default?: Cache } }).caches?.default;
}

/** A cache write is an optimisation, never a precondition. */
async function store(cache: Cache | undefined, key: Request, response: Response): Promise<void> {
  if (!cache) return;
  try {
    await cache.put(key, response);
  } catch {
    /* A full, disabled or unhappy cache must never affect what was served. */
  }
}

function negative(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": NEGATIVE, "CDN-Cache-Control": NEGATIVE },
  });
}

export async function proxyImage(
  request: Request,
  id: string,
  options: ImageProxyOptions,
): Promise<Response> {
  const {
    upstream,
    cache = platformCache(),
    background = platformBackground(),
    fetchImpl = fetch,
  } = options;

  /* Cheapest possible rejection: no cache lookup, no upstream call. A
     malformed id cannot name anything, so there is nothing to go and ask. */
  if (!ID.test(id)) return negative();

  const cacheKey = new Request(request.url);

  if (cache) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    } catch {
      /* A broken cache must never break the image. */
    }
  }

  let response: Response;
  try {
    response = await fetchImpl(upstream, { redirect: "follow" });
  } catch {
    /* Unreachable upstream is a transient negative, not a 500 on the page that
       embedded the picture. Short TTL means it heals on its own. */
    return negative();
  }

  if (!response.ok) {
    const miss = negative();
    background(store(cache, cacheKey, miss.clone()));
    return miss;
  }

  const bytes = await response.arrayBuffer();
  const served = new Response(bytes, {
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": IMMUTABLE,
      /* The edge's own directive. `Cache-Control` governs the browser; without
         this, Cloudflare applies zone defaults, which do not cache a Worker
         response at all — so the Cache Rule described in the header would have
         nothing to act on. */
      "CDN-Cache-Control": IMMUTABLE,
      "X-Content-Type-Options": "nosniff",
    },
  });

  /* AFTER the response, not before it. Awaiting the write charged every
     shopper's latency, and the Worker's CPU budget, for work that only helps
     the NEXT request — and that budget is the one Error 1102 (#9) enforces. */
  background(store(cache, cacheKey, served.clone()));

  return served;
}
