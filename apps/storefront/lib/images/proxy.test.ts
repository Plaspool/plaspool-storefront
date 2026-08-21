import { afterEach, describe, expect, it, vi } from "vitest";

import { proxyImage } from "./proxy";

/**
 * The image proxy's cost behaviour, pinned.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THESE ARE COST ASSERTIONS, NOT RENDERING ONES. `/images/{blog,shop}/<id>` is
 * a WORKER ROUTE, so every picture in the shop is a billable invocation that
 * cannot be served by the assets binding. What this file defends is the two
 * ways that invocation used to cost more than it had to:
 *
 *   1. A MISS BOUGHT NOTHING FOR THE NEXT MISS. Upstream 404s were returned
 *      with a browser `max-age` and never written to the edge cache, so an id
 *      that does not exist was a fresh round trip to the commerce/blog API on
 *      EVERY request for it. That is the one path a stranger controls — the id
 *      is in the URL — so it is the one that must not be a free amplifier.
 *
 *   2. THE CACHE WRITE WAS ON THE CRITICAL PATH. `await cache.put(...)` before
 *      returning charges the shopper's latency, and the Worker's CPU budget,
 *      for work that exists to help the NEXT request. Error 1102 (#9) is what
 *      that budget being exceeded looks like, so the write belongs in
 *      `waitUntil`.
 *
 * The invariant that outranks both: A BROKEN CACHE MUST NEVER BREAK AN IMAGE.
 * Every cache interaction here is best-effort, and the tests below assert the
 * bytes still arrive when each one throws.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const UPSTREAM = "https://example.test/api/public/images/img_abc";

afterEach(() => {
  vi.restoreAllMocks();
});

/** A `Cache`-shaped stub recording what the route asked of it. */
function fakeCache(hit?: Response) {
  const put = vi.fn(async () => {});
  const match = vi.fn(async () => hit);
  return { put, match } as unknown as Cache & {
    put: ReturnType<typeof vi.fn>;
    match: ReturnType<typeof vi.fn>;
  };
}

/** Collects deferred work instead of running it, so a test can assert the
 *  response did not wait on it. */
function collector() {
  const work: Promise<unknown>[] = [];
  return { work, background: (p: Promise<unknown>) => void work.push(p) };
}

function upstreamOk(body = "PNGBYTES", type = "image/png") {
  return vi.fn(async () => new Response(body, { status: 200, headers: { "content-type": type } }));
}

const request = () => new Request("https://plaspool.com/images/shop/img_abc");

describe("proxyImage — id validation", () => {
  it("refuses a malformed id without ever calling upstream", async () => {
    const fetchImpl = upstreamOk();
    const res = await proxyImage(request(), "../../etc/passwd", { upstream: UPSTREAM, fetchImpl });

    expect(res.status).toBe(404);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("proxyImage — edge cache hit", () => {
  it("serves the cached response and never calls upstream", async () => {
    const cache = fakeCache(new Response("CACHED", { status: 200 }));
    const fetchImpl = upstreamOk();

    const res = await proxyImage(request(), "img_abc", { upstream: UPSTREAM, cache, fetchImpl });

    expect(await res.text()).toBe("CACHED");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("still serves the image when the cache read throws", async () => {
    const cache = fakeCache();
    cache.match.mockRejectedValue(new Error("cache exploded"));
    const fetchImpl = upstreamOk("REALBYTES");

    const res = await proxyImage(request(), "img_abc", { upstream: UPSTREAM, cache, fetchImpl });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("REALBYTES");
  });
});

describe("proxyImage — successful upstream", () => {
  it("returns the bytes with an immutable browser AND edge TTL", async () => {
    const res = await proxyImage(request(), "img_abc", {
      upstream: UPSTREAM,
      fetchImpl: upstreamOk("REALBYTES", "image/webp"),
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("REALBYTES");
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Cache-Control")).toContain("immutable");
    // The edge needs its own directive: `Cache-Control` alone leaves
    // Cloudflare's own TTL to zone defaults, which do not cache a Worker
    // response at all.
    expect(res.headers.get("CDN-Cache-Control")).toContain("max-age=31536000");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("defers the cache write instead of awaiting it", async () => {
    const cache = fakeCache();
    const { work, background } = collector();

    // `put` never settles. If the write were awaited, this would hang.
    cache.put.mockReturnValue(new Promise(() => {}));

    const res = await proxyImage(request(), "img_abc", {
      upstream: UPSTREAM,
      cache,
      background,
      fetchImpl: upstreamOk(),
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("PNGBYTES");
    expect(work).toHaveLength(1);
  });

  it("still serves the image when the cache write throws", async () => {
    const cache = fakeCache();
    cache.put.mockRejectedValue(new Error("cache exploded"));

    const res = await proxyImage(request(), "img_abc", {
      upstream: UPSTREAM,
      cache,
      fetchImpl: upstreamOk(),
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("PNGBYTES");
  });
});

describe("proxyImage — upstream said no", () => {
  it("caches the negative at the edge so a probed id is not a free amplifier", async () => {
    const cache = fakeCache();
    const { work, background } = collector();
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 404 }));

    const res = await proxyImage(request(), "img_abc", {
      upstream: UPSTREAM,
      cache,
      background,
      fetchImpl,
    });

    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(res.headers.get("CDN-Cache-Control")).toBe("public, max-age=60");
    // THE POINT OF THE TEST: the 404 was written to the edge, so the next
    // request for this id is answered without a second upstream round trip.
    expect(work).toHaveLength(1);
    await Promise.all(work);
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it("treats an unreachable upstream as a short-lived negative, not a throw", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });

    const res = await proxyImage(request(), "img_abc", { upstream: UPSTREAM, fetchImpl });

    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
  });
});
