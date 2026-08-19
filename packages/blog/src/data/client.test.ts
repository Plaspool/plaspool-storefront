import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BLOG_API } from "./config";
import { BlogAPIError, blogFetch } from "./client";

/**
 * `blogFetch` is the only door onto the blog API, and its retry rule is a
 * policy rather than an implementation detail: a 4xx is an ANSWER, not an
 * outage, so retrying it burns the timeout budget to arrive at the same
 * response. These tests pin the call counts, because the failure mode of
 * getting it wrong is a slow page rather than a broken one — invisible until
 * someone measures it.
 */

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

/** Drives the backoff sleeps without waiting for them in real time. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  const result = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  const outcome = await result;
  if ("error" in outcome) throw outcome.error;
  return outcome.value;
}

describe("url building", () => {
  it("hangs the path off the hardcoded API base", async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    await settle(blogFetch("/posts", { revalidate: 300 }));
    expect(fetchMock.mock.calls[0][0]).toBe(`${BLOG_API}/posts`);
  });

  it("drops undefined, null and empty query values rather than sending them", async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    await settle(
      blogFetch("/posts", {
        revalidate: 300,
        query: { search: "", category: undefined, tag: null, cursor: "abc", limit: 9 },
      }),
    );
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("cursor")).toBe("abc");
    expect(url.searchParams.get("limit")).toBe("9");
    expect(url.searchParams.has("search")).toBe(false);
    expect(url.searchParams.has("category")).toBe(false);
    expect(url.searchParams.has("tag")).toBe(false);
  });

  it("passes the ISR window and tags straight through to Next", async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    await settle(blogFetch("/posts", { revalidate: 3600, tags: ["posts", "post-x"] }));
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      next: { revalidate: 3600, tags: ["posts", "post-x"] },
    });
  });
});

describe("error mapping", () => {
  it("throws BlogAPIError carrying the status and the endpoint", async () => {
    fetchMock.mockResolvedValue(json({}, 404));
    const error = await settle(blogFetch("/posts/nope", { revalidate: 300 })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BlogAPIError);
    expect((error as BlogAPIError).status).toBe(404);
    expect((error as BlogAPIError).endpoint).toContain("/posts/nope");
    expect((error as BlogAPIError).name).toBe("BlogAPIError");
  });

  it("does not retry a 4xx — it is an answer, not an outage", async () => {
    fetchMock.mockResolvedValue(json({}, 404));
    await expect(settle(blogFetch("/posts/nope", { revalidate: 300 }))).rejects.toBeInstanceOf(BlogAPIError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a 5xx and returns the body once it recovers", async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({ items: [1] }));
    await expect(settle(blogFetch("/posts", { revalidate: 300, retries: 3 }))).resolves.toEqual({ items: [1] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after `retries` attempts and reports the last status", async () => {
    fetchMock.mockResolvedValue(json({}, 500));
    const error = await settle(blogFetch("/posts", { revalidate: 300, retries: 3 })).catch((e: unknown) => e);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((error as BlogAPIError).status).toBe(500);
  });

  it("maps a network failure to a 502 BlogAPIError, never a raw TypeError", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const error = await settle(blogFetch("/posts", { revalidate: 300, retries: 2 })).catch((e: unknown) => e);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(error).toBeInstanceOf(BlogAPIError);
    expect((error as BlogAPIError).status).toBe(502);
    expect((error as BlogAPIError).message).toBe("fetch failed");
  });
});
