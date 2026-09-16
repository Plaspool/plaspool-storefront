"use client";

import * as React from "react";
import { ImagePlus, Loader2, RotateCcw, X } from "lucide-react";
import { cn } from "@plaspool/ui";

import { MAX_REVIEW_PHOTOS } from "../data/reviews";
import { PHOTO_ERROR_MESSAGES } from "./review-photo-state";
import type { PhotoItem } from "./review-photo-state";

/**
 * The photo picker inside a review form. PRESENTATIONAL — the uploads live in
 * `useReviewPhotoUploads`, so every state here (uploading, failed, full) can be
 * rendered by a test without a browser.
 */
export function ReviewPhotoField({
  items,
  remaining,
  onPick,
  onRetry,
  onRemove,
  disabled,
}: {
  items: readonly PhotoItem[];
  remaining: number;
  onPick: (files: FileList) => void;
  onRetry: (key: string) => void;
  onRemove: (key: string) => void;
  disabled?: boolean;
}) {
  const uid = React.useId();
  const inputId = `${uid}-photos`;
  const hintId = `${uid}-photos-hint`;

  return (
    <div>
      <span className="mb-2 block text-sm font-semibold text-foreground">
        Photos <span className="font-normal text-muted-foreground">(optional)</span>
      </span>
      <p id={hintId} className="mb-3 text-sm text-muted-foreground">
        Add up to {MAX_REVIEW_PHOTOS}. They appear with your review once it&apos;s published.
      </p>

      <ul className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <li
            key={item.key}
            className="relative h-20 w-20 overflow-hidden rounded-md border border-brand-line bg-brand-soft"
            aria-busy={item.status === "uploading" || undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.previewUrl}
              alt={`Your photo ${index + 1}`}
              className={cn(
                "h-full w-full object-cover",
                item.status !== "done" && "opacity-50",
              )}
            />
            {item.status === "uploading" && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2
                  aria-hidden="true"
                  className="h-6 w-6 animate-spin text-foreground motion-reduce:animate-none"
                />
                <span className="sr-only">Uploading</span>
              </span>
            )}
            {item.status === "error" && (
              <button
                type="button"
                onClick={() => onRetry(item.key)}
                className="absolute inset-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                aria-label={`Retry photo ${index + 1}`}
              >
                <RotateCcw aria-hidden="true" className="h-6 w-6 text-destructive-strong" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onRemove(item.key)}
              aria-label={`Remove photo ${index + 1}`}
              className="absolute right-0.5 top-0.5 rounded-full border border-brand-line bg-background p-0.5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}

        {remaining > 0 && (
          <li>
            <label
              htmlFor={inputId}
              className={cn(
                "flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-brand-line text-xs text-muted-foreground",
                "hover:border-foreground hover:text-foreground",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
                disabled && "pointer-events-none opacity-50",
              )}
            >
              <ImagePlus aria-hidden="true" className="h-5 w-5" />
              Add photo
              <input
                id={inputId}
                type="file"
                accept="image/*"
                multiple
                disabled={disabled}
                aria-describedby={hintId}
                className="sr-only"
                onChange={(event) => {
                  if (event.target.files?.length) onPick(event.target.files);
                  /* Cleared so picking the same photo again after removing it
                     still fires `change`. */
                  event.target.value = "";
                }}
              />
            </label>
          </li>
        )}
      </ul>

      {items.some((item) => item.status === "error") && (
        <ul className="mt-2 flex flex-col gap-1">
          {items.map((item, index) =>
            item.status === "error" && item.error ? (
              <li key={item.key} role="alert" className="text-sm text-destructive-strong">
                Photo {index + 1}: {PHOTO_ERROR_MESSAGES[item.error]}
              </li>
            ) : null,
          )}
        </ul>
      )}
    </div>
  );
}
