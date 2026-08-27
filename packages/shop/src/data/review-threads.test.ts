import { afterEach, describe, expect, it, vi } from "vitest";

import { myReactions, setReaction, threadReplies } from "./reviews";
import type { ReviewReply } from "./reviews";

/**
 * REPLY THREADS AND REACTIONS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THREE RULES FROM THE API BRIEF, EACH OF WHICH FAILS SILENTLY IF IGNORED.
 *
 *   - Every reply, INCLUDING NESTED ONES, arrives in one FLAT array. The tree
 *     is built by grouping on `parentId`; expecting nesting in the JSON loses
 *     every second-level reply without erroring.
 *   - The array is ALREADY ordered oldest-first. Re-sorting it is at best a
 *     no-op and at worst reorders a conversation.
 *   - `authorKind` says who wrote it. Matching on the NAME breaks the day a
 *     customer is called PlaSpool, and is exactly the mistake the field exists
 *     to prevent.
 *
 * And one from §6.3: there is no public dislike count. `unhelpful` is a vote
 * this client may CAST and must never DISPLAY a tally of.
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

const reply = (over: Partial<ReviewReply>): ReviewReply => ({
  id: "rpl_1",
  parentId: null,
  depth: 0,
  body: "…",
  authorKind: "customer",
  authorName: "Dara",
  createdAt: 1787788800000,
  ...over,
});

describe("threadReplies", () => {
  it("hangs a depth-0 reply off the review", () => {
    const tree = threadReplies([reply({ id: "a" })]);
    expect(tree).toHaveLength(1);
    expect(tree[0].reply.id).toBe("a");
    expect(tree[0].children).toEqual([]);
  });

  /* THE FLAT-ARRAY RULE. A nested reply is a sibling in the JSON; only
     `parentId` says otherwise. */
  it("nests a depth-1 reply under the reply it names", () => {
    const tree = threadReplies([
      reply({ id: "a" }),
      reply({ id: "b", parentId: "a", depth: 1 }),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((c) => c.id)).toEqual(["b"]);
  });

  it("keeps the order the API sent, oldest first", () => {
    const tree = threadReplies([
      reply({ id: "a", createdAt: 3 }),
      reply({ id: "b", createdAt: 1 }),
      reply({ id: "c", createdAt: 2 }),
    ]);
    expect(tree.map((t) => t.reply.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps children in the order the API sent too", () => {
    const tree = threadReplies([
      reply({ id: "a" }),
      reply({ id: "x", parentId: "a", depth: 1, createdAt: 9 }),
      reply({ id: "y", parentId: "a", depth: 1, createdAt: 2 }),
    ]);
    expect(tree[0].children.map((c) => c.id)).toEqual(["x", "y"]);
  });

  /* A child whose parent is not in the array would otherwise vanish. Better a
     visible top-level reply than a silently dropped one. */
  it("does not lose a reply whose parent is absent", () => {
    const tree = threadReplies([reply({ id: "orphan", parentId: "missing", depth: 1 })]);
    expect(tree.map((t) => t.reply.id)).toEqual(["orphan"]);
  });

  it("answers nothing for a review with no replies", () => {
    expect(threadReplies([])).toEqual([]);
  });
});

describe("setReaction", () => {
  it("names the state it wants rather than asking for a toggle", async () => {
    const spy = stub(200, { reviewId: "rev_1", viewerReaction: "helpful", helpfulCount: 4 });
    await setReaction("rev_1", "helpful");
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toContain("/api/shop/reviews/rev_1/reactions");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ kind: "helpful" });
    expect(init.credentials).toBe("include");
  });

  /* CLEARING IS `null`, SENT DELIBERATELY. The server does not flip state for
     us — two tabs doing that would land on arrival order. */
  it("clears a vote by sending null", async () => {
    const spy = stub(200, { reviewId: "rev_1", viewerReaction: null, helpfulCount: 3 });
    await setReaction("rev_1", null);
    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ kind: null });
  });

  /* THE RESPONSE CARRIES THE NEW COUNT — using it is what avoids refetching
     the whole list after every click. */
  it("answers the new count from the response", async () => {
    stub(200, { reviewId: "rev_1", viewerReaction: "helpful", helpfulCount: 4 });
    await expect(setReaction("rev_1", "helpful")).resolves.toMatchObject({ helpfulCount: 4 });
  });

  it("tells a signed-out shopper apart from a broken connection", async () => {
    stub(401, { error: "unauthenticated" });
    await expect(setReaction("rev_1", "helpful")).rejects.toMatchObject({ kind: "signed-out" });
  });
});

describe("myReactions", () => {
  /* SIGNED OUT IS A 200 WITH AN EMPTY MAP, NOT A 401. Reading a product page
     signed out is not an error, and a client that handles 401 here has the
     wrong contract. */
  it("answers an empty map rather than throwing when signed out", async () => {
    stub(200, { reactions: {} });
    await expect(myReactions(["rev_a"])).resolves.toEqual({});
  });

  it("returns only the reviews this viewer voted on", async () => {
    stub(200, { reactions: { rev_a: "helpful", rev_c: "unhelpful" } });
    await expect(myReactions(["rev_a", "rev_b", "rev_c"])).resolves.toEqual({
      rev_a: "helpful",
      rev_c: "unhelpful",
    });
  });

  /* AN EMPTY LIST IS A 400 ON THE WIRE, so it must never reach the wire. */
  it("does not call the API for an empty list", async () => {
    const spy = stub(200, { reactions: {} });
    await expect(myReactions([])).resolves.toEqual({});
    expect(spy).not.toHaveBeenCalled();
  });

  /* THE API CAPS A REQUEST AT 100 IDS and answers 400 beyond it. */
  it("never asks for more than a hundred at once", async () => {
    const spy = stub(200, { reactions: {} });
    await myReactions(Array.from({ length: 250 }, (_, i) => `rev_${i}`));
    for (const call of spy.mock.calls) {
      const url = new URL(String((call as unknown as [string])[0]));
      /* NOT "exactly 100" — the last batch of 250 is 50, and the rule is a
         ceiling rather than a quota. The first cut asserted equality and
         failed on correct code. */
      const ids = (url.searchParams.get("reviews") ?? "").split(",");
      expect(ids.length).toBeLessThanOrEqual(100);
      expect(ids.length).toBeGreaterThan(0);
    }
    expect(spy.mock.calls.length).toBeGreaterThan(1);
  });

  /* A FAILURE HERE COSTS THE FILLED STATE OF A BUTTON, never the page. */
  it("answers an empty map when the request fails", async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(myReactions(["rev_a"])).resolves.toEqual({});
  });
});
