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

/**
 * THE TWO REFUSALS A REVIEW MUTATION CARRIES, AND WHY THEY MUST NOT COLLAPSE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Every 403 mapped to `rejected`, whose copy is "Nothing is wrong with what you
 * wrote — please try again later." Said to somebody who has already reviewed
 * the spool that is a lie twice over: something IS wrong with what they wrote
 * (it is a duplicate), and trying again later will never work.
 *
 * The API names the reason in the body — `{"error":"forbidden","reason":…}` —
 * and `reason` is the key to branch on, NOT `error`, which stays `forbidden`
 * for both. A bare 403 with no reason keeps its old meaning so that every other
 * 403 in the API serialises and reads exactly as before.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("submitReview refusals", () => {
  it("tells a duplicate apart from a generic refusal", async () => {
    stub(403, { error: "forbidden", reason: "already_reviewed" });
    await expect(submitReview(INPUT)).rejects.toMatchObject({ kind: "already-reviewed" });
  });

  it("tells a shopper who has not bought it apart from a generic refusal", async () => {
    stub(403, { error: "forbidden", reason: "purchase_required" });
    await expect(submitReview(INPUT)).rejects.toMatchObject({ kind: "purchase-required" });
  });

  /* A REASON THIS CLIENT DOES NOT KNOW IS STILL A REFUSAL, not a crash and not
     a duplicate. The API may name a third one before this file hears about it. */
  it("falls back to a plain refusal for a reason it does not recognise", async () => {
    stub(403, { error: "forbidden", reason: "some_future_rule" });
    await expect(submitReview(INPUT)).rejects.toMatchObject({ kind: "rejected" });
  });

  /* The body is not guaranteed to be JSON — a proxy or an edge error can answer
     403 with HTML, and `res.json()` throws on it. That must not become a
     TypeError escaping a submit handler. */
  it("survives a 403 whose body is not JSON", async () => {
    const spy = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    }) as unknown as Response);
    global.fetch = spy as unknown as typeof fetch;
    await expect(submitReview(INPUT)).rejects.toMatchObject({ kind: "rejected" });
  });
});
