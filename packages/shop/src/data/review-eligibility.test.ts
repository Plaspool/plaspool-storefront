import { afterEach, describe, expect, it, vi } from "vitest";

import { reviewEligibility } from "./reviews";

/**
 * WHAT THIS SHOPPER MAY REVIEW — the read that stops the product page offering
 * a form whose submission the API will refuse.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE BUG THIS EXISTS FOR: the review form was gated on IDENTITY ALONE, so a
 * shopper who had already reviewed a spool was shown the whole form again —
 * stars, headline, body, submit — on the same page as the review they had
 * already written. Reviewing is once per customer per product.
 *
 * ═══ IT FAILS OPEN, AND THAT IS THE LOAD-BEARING DECISION ═══
 * An unreadable answer must leave the page as it is rather than hiding the form
 * from everybody. A reviews service having a bad minute should cost one wasted
 * submission at most — never reviewing, replying and voting across the whole
 * shop, withdrawn silently with nothing on the page to explain it.
 *
 * That is the same rule `myReactions` follows for the same class of per-viewer
 * read: a failure costs a refinement, never the page. The server enforces both
 * rules itself regardless, so nothing here is a security boundary.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function stub(status: number, body: unknown = {}) {
  const spy = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response);
  global.fetch = spy as unknown as typeof fetch;
  return spy;
}

const ANSWER = {
  eligible: { "pla-basic": { canReview: true, hasReviewed: true } },
};

describe("reviewEligibility", () => {
  /* THE COOKIE IS THE WHOLE QUESTION. "Has this shopper reviewed this" cannot
     be answered without the session, and without credentials the API sees an
     anonymous caller and answers for nobody. */
  it("sends the session cookie", async () => {
    const spy = stub(200, ANSWER);
    await reviewEligibility(["pla-basic"]);
    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.credentials).toBe("include");
  });

  it("asks about the slugs it was given", async () => {
    const spy = stub(200, ANSWER);
    await reviewEligibility(["pla-basic"]);
    const [url] = spy.mock.calls[0] as unknown as [string];
    expect(url).toContain("/api/shop/reviews/eligibility");
    expect(url).toContain("products=pla-basic");
  });

  it("reports a shopper who has already reviewed the product", async () => {
    stub(200, ANSWER);
    const eligible = await reviewEligibility(["pla-basic"]);
    expect(eligible["pla-basic"]?.hasReviewed).toBe(true);
  });

  /* NOT A THROW, AND NOT A BLOCKED FORM. A client that read a refused or
     unreachable response as "has reviewed" would hide the form from every
     shopper in the shop the first minute the reviews service wobbled. */
  it("answers empty rather than throwing when the endpoint refuses", async () => {
    stub(401, { error: "unauthenticated" });
    await expect(reviewEligibility(["pla-basic"])).resolves.toEqual({});
  });

  it("answers empty rather than throwing when the request fails outright", async () => {
    global.fetch = (() => Promise.reject(new TypeError("cors"))) as unknown as typeof fetch;
    await expect(reviewEligibility(["pla-basic"])).resolves.toEqual({});
  });

  /* Nothing to ask about is not a request. A bare `?products=` is a `400` from
     the API, spent to learn what the caller already knew. */
  it("asks nothing when given no slugs", async () => {
    const spy = stub(200, ANSWER);
    await expect(reviewEligibility([])).resolves.toEqual({});
    expect(spy).not.toHaveBeenCalled();
  });
});
