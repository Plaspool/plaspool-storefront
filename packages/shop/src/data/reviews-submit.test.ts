import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewSubmitError, submitReview } from "./reviews";

/**
 * SUBMITTING A REVIEW AS THE SIGNED-IN CUSTOMER.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE API DERIVES THE AUTHOR FROM THE SESSION NOW, and answers
 * `401 {"error":"unauthenticated"}` without one — verified against the live
 * endpoint, not read from a spec.
 *
 * That makes two of this client's habits wrong at once:
 *
 *   - it sent `authorName`/`authorEmail` in the body, which is the shopper's
 *     email crossing the wire to say something the cookie already says;
 *   - it sent no credentials AT ALL, so every submission would now be refused.
 *
 * And a third, quieter one: `401` fell through to the catch-all, which tells a
 * signed-out shopper "check your connection" about a connection that is fine.
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

const INPUT = {
  productSlug: "pla-basic",
  rating: 5,
  title: "Typeshii",
  body: "It printed properly and perfectly",
};

describe("submitReview", () => {
  /* THE COOKIE IS THE AUTHOR. Without this every submission is a 401, and the
     shopper is told their connection is at fault. */
  it("sends the session cookie", async () => {
    const spy = stub(200, { reviewId: "rev_1", status: "pending", sentiment: "neutral" });
    await submitReview(INPUT);
    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.credentials).toBe("include");
  });

  /* THE EMAIL MUST NOT LEAVE THE ACCOUNT. The form stopped asking for it; this
     is the other half — the browser stops sending it. */
  it("sends no author name and no author email", async () => {
    const spy = stub(200, { reviewId: "rev_1", status: "pending", sentiment: "neutral" });
    await submitReview(INPUT);
    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(sent).not.toHaveProperty("authorName");
    expect(sent).not.toHaveProperty("authorEmail");
    expect(JSON.stringify(sent)).not.toMatch(/@/);
  });

  it("still sends what a review actually is", async () => {
    const spy = stub(200, { reviewId: "rev_1", status: "pending", sentiment: "neutral" });
    await submitReview(INPUT);
    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(sent).toMatchObject({
      productSlug: "pla-basic",
      rating: 5,
      title: "Typeshii",
      body: "It printed properly and perfectly",
    });
  });

  /* AN UNTOUCHED HEADLINE IS OMITTED, not sent blank — the API takes `title`
     as optional and rejects an empty string. Pre-existing behaviour, asserted
     so the reshaping of this body did not quietly drop it. */
  it("omits an empty headline rather than sending it blank", async () => {
    const spy = stub(200, { reviewId: "rev_1", status: "pending", sentiment: "neutral" });
    await submitReview({ ...INPUT, title: "   " });
    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).not.toHaveProperty("title");
  });

  /* ═══ 401 IS ITS OWN ANSWER ═══
     It fell through to `failed`, whose copy is "check your connection" — said
     to a shopper whose connection is perfect and who is merely signed out. */
  it("distinguishes a signed-out shopper from a broken connection", async () => {
    stub(401, { error: "unauthenticated" });
    await expect(submitReview(INPUT)).rejects.toMatchObject({ kind: "signed-out" });
  });

  it("keeps the failures it already told apart", async () => {
    stub(429);
    await expect(submitReview(INPUT)).rejects.toMatchObject({ kind: "rate-limited" });
    stub(403);
    await expect(submitReview(INPUT)).rejects.toMatchObject({ kind: "rejected" });
    stub(400);
    await expect(submitReview(INPUT)).rejects.toMatchObject({ kind: "invalid" });
  });

  it("answers a ReviewSubmitError when the network is genuinely gone", async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(submitReview(INPUT)).rejects.toBeInstanceOf(ReviewSubmitError);
  });
});
