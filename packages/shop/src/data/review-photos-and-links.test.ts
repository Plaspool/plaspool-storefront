import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getReviewLink,
  reviewPhotoSrc,
  reviewPhotos,
  uploadReviewPhoto,
} from "./reviews";
import { COMMERCE_API_BASE } from "./config";

/**
 * REVIEW PHOTOS AND REVIEW LINKS — the client half of the contract in the
 * admin's `feat/review-links-and-photos` brief.
 */

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function stub(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  const spy = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  }) as unknown as Response);
  global.fetch = spy as unknown as typeof fetch;
  return spy;
}

describe("uploadReviewPhoto", () => {
  /* The browser writes the multipart boundary; a hand-set content-type drops
     it and the server cannot parse the body. */
  it("posts multipart with credentials and no content-type of its own", async () => {
    const spy = stub(201, { photoId: "rvp_1", width: 1600, height: 1200 });
    const result = await uploadReviewPhoto(new Blob(["x"], { type: "image/jpeg" }));
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${COMMERCE_API_BASE}/api/shop/reviews/photos`);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get("file")).toBeInstanceOf(Blob);
    expect(form.has("reviewLink")).toBe(false);
    expect(result).toEqual({ photoId: "rvp_1", width: 1600, height: 1200 });
  });

  it("sends the review link in the form data when given one", async () => {
    const spy = stub(201, { photoId: "rvp_1" });
    await uploadReviewPhoto(new Blob(["x"]), { reviewLink: "tok.sig" });
    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.body as FormData).get("reviewLink")).toBe("tok.sig");
  });

  it.each([
    [401, {}, "signed-out"],
    [403, { reason: "review_link_invalid" }, "review-link-invalid"],
    [400, { detail: "file_type" }, "file-type"],
    [400, { detail: "file_too_large" }, "file-too-large"],
    [400, { detail: "file" }, "file"],
    [400, { detail: "storage" }, "storage"],
    [500, {}, "failed"],
  ])("maps %i %j to %s", async (status, body, kind) => {
    stub(status, body);
    await expect(uploadReviewPhoto(new Blob(["x"]))).rejects.toMatchObject({ kind });
  });

  it("carries retry-after on a 429", async () => {
    stub(429, {}, { "retry-after": "30" });
    await expect(uploadReviewPhoto(new Blob(["x"]))).rejects.toMatchObject({
      kind: "rate-limited",
      retryAfter: 30,
    });
  });
});

describe("getReviewLink", () => {
  const LINK = {
    orderNumber: "2026-000123-K",
    firstName: "Ada",
    expiresAt: 1796000000000,
    products: [{ slug: "pla-silk", title: "PLA Silk", imageUrl: null, reviewed: false }],
  };

  it("fetches uncached with the token encoded", async () => {
    const spy = stub(200, LINK);
    const result = await getReviewLink("eyJ+/=.3f9a");
    const [url, init] = spy.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toContain("/api/shop/reviews/link?token=eyJ%2B%2F%3D.3f9a");
    expect(init.cache).toBe("no-store");
    expect(result).toEqual({ kind: "ok", link: LINK });
  });

  /* An expired link and an unreachable API are different pages: one says ask
     for a new link, the other says the link is fine. */
  it("tells an invalid link apart from an outage", async () => {
    stub(403, { reason: "review_link_invalid" });
    expect(await getReviewLink("t")).toEqual({ kind: "invalid" });
    stub(502);
    expect(await getReviewLink("t")).toEqual({ kind: "failed" });
    global.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await getReviewLink("t")).toEqual({ kind: "failed" });
  });

  it("does not call the API without a token", async () => {
    const spy = stub(200, LINK);
    expect(await getReviewLink("")).toEqual({ kind: "invalid" });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("review photos on the public wire", () => {
  /* A product page frozen in the cache before photos shipped has no key. */
  it("tolerates a review with no photos field", () => {
    expect(reviewPhotos({})).toEqual([]);
  });

  it("prefixes the API origin onto the relative url", () => {
    expect(reviewPhotoSrc("/api/public/reviews/photos/rvp_1")).toBe(
      `${COMMERCE_API_BASE}/api/public/reviews/photos/rvp_1`,
    );
    expect(reviewPhotoSrc("https://cdn.example/x.jpg")).toBe("https://cdn.example/x.jpg");
  });
});
