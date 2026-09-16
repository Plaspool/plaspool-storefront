import { describe, expect, it } from "vitest";

import {
  anyFailed,
  anyUploading,
  fitWithin,
  photoIdsInOrder,
  photoReducer,
  remainingSlots,
} from "./review-photo-state";
import type { PhotoItem } from "./review-photo-state";

const picked = (...keys: string[]) => keys.map((key) => ({ key, previewUrl: `blob:${key}` }));

describe("photoReducer", () => {
  it("caps a review at four photos, including ones picked in a later batch", () => {
    let items: PhotoItem[] = photoReducer([], { type: "add", items: picked("a", "b", "c") });
    items = photoReducer(items, { type: "add", items: picked("d", "e") });
    expect(items.map((i) => i.key)).toEqual(["a", "b", "c", "d"]);
    expect(remainingSlots(items)).toBe(0);
  });

  /* A failed thumbnail is still on screen with a retry button. */
  it("counts a failed photo against the cap", () => {
    let items = photoReducer([], { type: "add", items: picked("a", "b", "c", "d") });
    items = photoReducer(items, { type: "failed", key: "a", error: "failed" });
    expect(remainingSlots(items)).toBe(0);
  });

  it("sends ids in display order, skipping unfinished and failed ones", () => {
    let items = photoReducer([], { type: "add", items: picked("a", "b", "c") });
    items = photoReducer(items, { type: "uploaded", key: "c", photoId: "rvp_c" });
    items = photoReducer(items, { type: "uploaded", key: "a", photoId: "rvp_a" });
    expect(anyUploading(items)).toBe(true);
    items = photoReducer(items, { type: "failed", key: "b", error: "file-type" });
    expect(photoIdsInOrder(items)).toEqual(["rvp_a", "rvp_c"]);
    expect(anyUploading(items)).toBe(false);
    expect(anyFailed(items)).toBe(true);
  });

  it("retries back to uploading and removes without touching the others", () => {
    let items = photoReducer([], { type: "add", items: picked("a", "b") });
    items = photoReducer(items, { type: "failed", key: "a", error: "failed" });
    items = photoReducer(items, { type: "retry", key: "a" });
    expect(items[0]).toMatchObject({ status: "uploading", error: null });
    items = photoReducer(items, { type: "remove", key: "a" });
    expect(items.map((i) => i.key)).toEqual(["b"]);
  });
});

describe("fitWithin", () => {
  it("keeps the longest side at 2000px and the aspect ratio", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1500, height: 2000 });
  });

  it("never scales a small photo up", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
