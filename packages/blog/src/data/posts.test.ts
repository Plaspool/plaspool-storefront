import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BLOG_API_BASE, BLOG_IMAGE_PATH, POSTS_PER_PAGE } from "./config";
import { getPostBySlug, imageUrl, listPosts, publicImageId } from "./posts";

const json = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("publicImageId / imageUrl", () => {
  it("recognises the API's stable image form and nothing else", () => {
    expect(publicImageId("/api/public/images/abc-123_X")).toBe("abc-123_X");
    expect(publicImageId("/api/public/images/abc/extra")).toBeNull();
    expect(publicImageId("https://cdn.example.com/api/public/images/abc")).toBeNull();
    expect(publicImageId("/images/blog/abc")).toBeNull();
  });

  it("maps an API-hosted image to the same-origin proxy", () => {
    expect(imageUrl("/api/public/images/abc123")).toBe(`${BLOG_IMAGE_PATH}/abc123`);
  });

  it("passes an already-absolute image through untouched", () => {
    expect(imageUrl("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
  });

  it("prefixes the API base onto any other relative path", () => {
    expect(imageUrl("/uploads/a.png")).toBe(`${BLOG_API_BASE}/uploads/a.png`);
  });

  /* A presigned R2 URL has a 300-second TTL and must NEVER reach rendered
     HTML. The proxy follows the upstream redirect server-side, per request;
     nothing here may bake one into a src. */
  it("never produces a presigned URL — the output is always stable", () => {
    const out = imageUrl("/api/public/images/abc123");
    expect(out).not.toContain("X-Amz-Signature");
    expect(out).not.toContain("?");
  });
});

describe("listPosts", () => {
  it("defaults the page size and omits filters that were not asked for", async () => {
    fetchMock.mockResolvedValue(json({ items: [], nextCursor: null }));
    await listPosts();
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname.endsWith("/posts")).toBe(true);
    expect(url.searchParams.get("limit")).toBe(String(POSTS_PER_PAGE));
    expect(url.searchParams.has("cursor")).toBe(false);
    expect(url.searchParams.has("category")).toBe(false);
  });

  /* Pagination is cursor-based: no page numbers, no total count. The cursor
     the previous response returned is the only way to ask for the next page. */
  it("forwards the cursor from the previous page", async () => {
    fetchMock.mockResolvedValue(json({ items: [], nextCursor: "cursor-2" }));
    const first = await listPosts();
    expect(first.nextCursor).toBe("cursor-2");

    fetchMock.mockResolvedValue(json({ items: [], nextCursor: null }));
    await listPosts({ cursor: first.nextCursor ?? undefined, limit: 4, category: "news" });
    const url = new URL(fetchMock.mock.calls[1][0] as string);
    expect(url.searchParams.get("cursor")).toBe("cursor-2");
    expect(url.searchParams.get("limit")).toBe("4");
    expect(url.searchParams.get("category")).toBe("news");
  });
});

describe("getPostBySlug", () => {
  /* Absent and unpublished are one 404 from the API, and both mean `null` —
     which is what lets the route render notFound() instead of a 500. */
  it("returns null for a 404", async () => {
    fetchMock.mockResolvedValue(json({}, 404));
    await expect(getPostBySlug("missing")).resolves.toBeNull();
  });

  it("rethrows any other error rather than hiding an outage as an empty page", async () => {
    fetchMock.mockResolvedValue(json({}, 403));
    await expect(getPostBySlug("forbidden")).rejects.toThrow("Blog API 403");
  });

  it("unwraps the envelope and encodes the slug", async () => {
    fetchMock.mockResolvedValue(json({ post: { slug: "a b/c", title: "Hi" } }));
    await expect(getPostBySlug("a b/c")).resolves.toEqual({ slug: "a b/c", title: "Hi" });
    expect(fetchMock.mock.calls[0][0]).toContain("/posts/a%20b%2Fc");
  });
});
