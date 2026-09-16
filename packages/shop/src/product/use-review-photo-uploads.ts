"use client";

import * as React from "react";

import { ReviewPhotoUploadError, uploadReviewPhoto } from "../data/reviews";
import {
  anyFailed,
  anyUploading,
  fitWithin,
  photoIdsInOrder,
  photoReducer,
  remainingSlots,
} from "./review-photo-state";

/**
 * Decode, straighten, shrink and re-encode one picked photo as a JPEG.
 *
 * ═══ WHY THIS IS REQUIRED, NOT AN OPTIMISATION ═══
 * The server strips EXIF so that a customer's home is never published in a
 * photo's GPS tags — and a phone's ROTATION lives in that same metadata. A photo
 * sent as-is loses its orientation and shows up sideways. Drawing it through
 * `createImageBitmap(…, { imageOrientation: "from-image" })` bakes the rotation
 * into the pixels first. It also turns HEIC into a JPEG the server accepts.
 */
export async function prepareReviewPhoto(file: Blob): Promise<Blob> {
  const bitmap = await decode(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new ReviewPhotoUploadError("file-type");
  context.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap) bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ReviewPhotoUploadError("file-type"))),
      "image/jpeg",
      0.85,
    );
  });
}

/**
 * `createImageBitmap` with the orientation option, falling back to an `<img>`
 * for a browser that rejects the option — which applies EXIF orientation by
 * default in every current engine. A format this browser cannot decode at all
 * (HEIC outside Safari) is `file-type`: the customer can pick another photo.
 */
async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* Fall through to the element. */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } catch {
    throw new ReviewPhotoUploadError("file-type");
  } finally {
    URL.revokeObjectURL(url);
  }
}

let counter = 0;

/**
 * Photo uploads for one review form: pick, preview, re-encode, upload, retry,
 * remove. The rules are in `review-photo-state.ts`; this is the wiring.
 */
export function useReviewPhotoUploads(reviewLink?: string) {
  const [items, dispatch] = React.useReducer(photoReducer, []);
  const files = React.useRef(new Map<string, Blob>());
  const previews = React.useRef(new Map<string, string>());

  /* Object URLs outlive the component unless revoked. */
  React.useEffect(() => {
    const urls = previews.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, []);

  const upload = React.useCallback(
    async (key: string, file: Blob) => {
      try {
        const prepared = await prepareReviewPhoto(file);
        const { photoId } = await uploadReviewPhoto(prepared, { reviewLink });
        dispatch({ type: "uploaded", key, photoId });
      } catch (err) {
        dispatch({
          type: "failed",
          key,
          error: err instanceof ReviewPhotoUploadError ? err.kind : "failed",
        });
      }
    },
    [reviewLink],
  );

  const add = React.useCallback(
    (picked: FileList | File[]) => {
      const accepted = Array.from(picked).slice(0, remainingSlots(items));
      if (accepted.length === 0) return;
      const added = accepted.map((file) => {
        counter += 1;
        const key = `photo-${counter}`;
        const previewUrl = URL.createObjectURL(file);
        files.current.set(key, file);
        previews.current.set(key, previewUrl);
        return { key, previewUrl, file };
      });
      dispatch({ type: "add", items: added.map(({ key, previewUrl }) => ({ key, previewUrl })) });
      for (const { key, file } of added) void upload(key, file);
    },
    [items, upload],
  );

  const retry = React.useCallback(
    (key: string) => {
      const file = files.current.get(key);
      if (!file) return;
      dispatch({ type: "retry", key });
      void upload(key, file);
    },
    [upload],
  );

  const remove = React.useCallback((key: string) => {
    const url = previews.current.get(key);
    if (url) URL.revokeObjectURL(url);
    previews.current.delete(key);
    files.current.delete(key);
    dispatch({ type: "remove", key });
  }, []);

  return {
    items,
    add,
    retry,
    remove,
    photoIds: photoIdsInOrder(items),
    uploading: anyUploading(items),
    failed: anyFailed(items),
    remaining: remainingSlots(items),
  };
}
