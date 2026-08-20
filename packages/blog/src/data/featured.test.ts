import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_FEATURED } from "./config";
import { listFeaturedPosts, selectFeatured } from "./posts";
import type { PublicPost } from "./types";

const json = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Drives the client's backoff sleeps without waiting for them in real time. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  const result = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  const outcome = await result;
  if ("error" in outcome) throw outcome.error as Error;
  return outcome.value;
}

/** Only the fields the selection logic reads. */
function post(id: string, publishedAt: number): PublicPost {
  return {
    id,
    slug: id,
    title: id,
    subtitle: "",
    excerpt: "",
    coverImage: null,
    category: "",
    tags: [],
    template: null,
    publishedAt,
    updatedAt: publishedAt,
    wordCount: 100,
    readingTime: 1,
    author: { name: "Test" },
  };
}

describe("listFeaturedPosts", () => {
  it("returns the curated items when the API serves them", async () => {
    fetchMock.mockResolvedValue(json({ items: [post("a", 3), post("b", 2)] }));

    const items = await settle(listFeaturedPosts());

    expect(items?.map((p) => p.id)).toEqual(["a", "b"]);
  });

  /* THE CASE THAT EXISTS TODAY. The endpoint is not built yet, so the API
     404s it. That is "no such feature", not "no featured posts", and the
     caller has to be able to tell the two apart to know whether to fall
     back — so it is null rather than an empty array. */
  it("answers null when the endpoint does not exist yet", async () => {
    fetchMock.mockResolvedValue(json({ error: "not found" }, 404));

    await expect(settle(listFeaturedPosts())).resolves.toBeNull();
  });

  it("answers null rather than throwing when the API is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("network"));

    await expect(settle(listFeaturedPosts())).resolves.toBeNull();
  });

  /* The cap is a backend invariant, but a listing that suddenly renders nine
     "featured" posts because someone relaxed a check server-side is a broken
     page. Enforced at the edge too. */
  it("caps an over-long response at MAX_FEATURED", async () => {
    const many = Array.from({ length: 9 }, (_, i) => post(`p${i}`, 9 - i));
    fetchMock.mockResolvedValue(json({ items: many }));

    const items = await settle(listFeaturedPosts());

    expect(items).toHaveLength(MAX_FEATURED);
  });

  it("tolerates a malformed body instead of throwing", async () => {
    fetchMock.mockResolvedValue(json({ nope: true }));

    await expect(settle(listFeaturedPosts())).resolves.toBeNull();
  });
});

describe("selectFeatured", () => {
  const latest = [post("n1", 5), post("n2", 4), post("n3", 3), post("n4", 2), post("n5", 1)];

  it("prefers real curation over the fallback", () => {
    const curated = [post("c1", 1), post("c2", 2)];

    expect(selectFeatured(curated, latest).map((p) => p.id)).toEqual(["c1", "c2"]);
  });

  it("keeps curation even on a blog too small to justify a fallback", () => {
    const curated = [post("c1", 1)];

    expect(selectFeatured(curated, [post("n1", 5)]).map((p) => p.id)).toEqual(["c1"]);
  });

  it("falls back to the newest posts when the endpoint is absent", () => {
    expect(selectFeatured(null, latest).map((p) => p.id)).toEqual(["n1", "n2", "n3", "n4"]);
  });

  /* An empty curated list and no curated list look identical to a reader:
     nobody has chosen anything. Both fall back, so the section does not go
     blank the day the endpoint ships but before the admin UI can fill it. */
  it("falls back when the endpoint answers with nothing curated", () => {
    expect(selectFeatured([], latest).map((p) => p.id)).toEqual(["n1", "n2", "n3", "n4"]);
  });

  /* Five, not three: fewer than MAX_FEATURED + 1 posts trips the hide guard
     below and there is no ordering left to assert. */
  it("orders the fallback by publish date, newest first", () => {
    const shuffled = [
      post("oldest", 1),
      post("newest", 9),
      post("mid", 5),
      post("older", 3),
      post("newer", 7),
    ];

    expect(selectFeatured(null, shuffled).map((p) => p.id)).toEqual([
      "newest",
      "newer",
      "mid",
      "older",
    ]);
  });

  /* ═══ WHY A SMALL BLOG GETS NO FEATURED SECTION ═══
     The fallback is the newest four, and the grid underneath is also the
     newest posts — so on a blog with four posts the reader would scroll past
     the same four cards twice under two different headings. Real curation is
     an editorial decision and is honoured at any size; this guard only backs
     out of a selection WE invented. */
  it("hides the section when a fallback would just repeat the whole grid", () => {
    const four = latest.slice(0, MAX_FEATURED);

    expect(selectFeatured(null, four)).toEqual([]);
  });

  it("hides the section when there are no posts at all", () => {
    expect(selectFeatured(null, [])).toEqual([]);
  });
});
