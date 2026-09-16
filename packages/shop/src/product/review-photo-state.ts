import { MAX_REVIEW_PHOTOS } from "../data/reviews";
import type { PhotoUploadError } from "../data/reviews";

/**
 * The photos attached to a review form, before the review exists.
 *
 * ═══ PURE, SO IT CAN BE TESTED WITHOUT A BROWSER ═══
 * The suite runs in node with no jsdom, and the rules that matter here — the
 * cap of four counts photos that FAILED as well, the order sent is the order on
 * screen, and submit waits for every upload — are exactly the kind that break
 * silently. So they live in this reducer and `useReviewPhotoUploads` only wires
 * it to `fetch` and object URLs.
 */

export type PhotoItemStatus = "uploading" | "done" | "error";

export interface PhotoItem {
  /** Local identity; the server's id arrives later, or never. */
  key: string;
  /** `URL.createObjectURL` of the picked file — revoked when the item goes. */
  previewUrl: string;
  status: PhotoItemStatus;
  photoId: string | null;
  error: PhotoUploadError | null;
}

export type PhotoAction =
  | { type: "add"; items: { key: string; previewUrl: string }[] }
  | { type: "uploaded"; key: string; photoId: string }
  | { type: "failed"; key: string; error: PhotoUploadError }
  | { type: "retry"; key: string }
  | { type: "remove"; key: string };

/**
 * How many more photos may be picked. A failed thumbnail still counts: it is on
 * screen with a retry button, and letting a fifth in beside it would turn a
 * successful retry into a review the API refuses.
 */
export function remainingSlots(items: readonly PhotoItem[]): number {
  return Math.max(0, MAX_REVIEW_PHOTOS - items.length);
}

export function photoReducer(items: PhotoItem[], action: PhotoAction): PhotoItem[] {
  switch (action.type) {
    case "add":
      return [
        ...items,
        ...action.items.slice(0, remainingSlots(items)).map((item) => ({
          ...item,
          status: "uploading" as const,
          photoId: null,
          error: null,
        })),
      ];
    case "uploaded":
      return items.map((item) =>
        item.key === action.key
          ? { ...item, status: "done", photoId: action.photoId, error: null }
          : item,
      );
    case "failed":
      return items.map((item) =>
        item.key === action.key ? { ...item, status: "error", error: action.error } : item,
      );
    case "retry":
      return items.map((item) =>
        item.key === action.key ? { ...item, status: "uploading", error: null } : item,
      );
    case "remove":
      /* Nothing is deleted on the server — an id never sent is simply unused. */
      return items.filter((item) => item.key !== action.key);
  }
}

/** Ids to send, in display order. Failed and in-flight photos are not sent. */
export function photoIdsInOrder(items: readonly PhotoItem[]): string[] {
  return items.flatMap((item) => (item.status === "done" && item.photoId ? [item.photoId] : []));
}

export function anyUploading(items: readonly PhotoItem[]): boolean {
  return items.some((item) => item.status === "uploading");
}

/**
 * A failed thumbnail blocks submit too. Sending the review without it would
 * quietly publish three photos of the four the customer can see attached.
 */
export function anyFailed(items: readonly PhotoItem[]): boolean {
  return items.some((item) => item.status === "error");
}

export const PHOTO_ERROR_MESSAGES: Record<PhotoUploadError, string> = {
  "signed-out": "You've been signed out. Sign in again to add photos.",
  "review-link-invalid": "This review link has expired or isn't valid.",
  "file-type": "That file isn't a photo we can use. Try a JPEG or PNG.",
  "file-too-large": "That photo is too large.",
  file: "That photo didn't come through. Try again.",
  storage: "Photo uploads aren't available right now.",
  "rate-limited": "Too many photos at once. Wait a moment and retry.",
  failed: "Upload failed. Check your connection and retry.",
};

/**
 * The longest side a photo is sent at. The API accepts 10 MB; a phone photo
 * re-encoded at this size is roughly 300 KB, which is the difference between a
 * quick upload and a stalled one on mobile data.
 */
export const MAX_PHOTO_EDGE = 2000;

/** Scale `width × height` down so neither side exceeds `max`. Never scales up. */
export function fitWithin(
  width: number,
  height: number,
  max: number = MAX_PHOTO_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
