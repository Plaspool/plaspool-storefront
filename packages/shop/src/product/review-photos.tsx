"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, cn } from "@plaspool/ui";

import { reviewPhotoSrc } from "../data/reviews";
import type { ReviewPhoto } from "../data/reviews";

/**
 * The photos on a published review: a row of square thumbnails under the body,
 * and a full-screen viewer that steps or swipes between them.
 *
 * `src` IS THE API'S URL, NOT THE STOREFRONT'S IMAGE PROXY — see `ReviewPhoto`.
 * A rejected review's photos must start answering 404, and an `immutable` copy
 * under `/images/shop` would keep serving them.
 *
 * The thumbnails are server-rendered with the rest of the tab; only the viewer
 * needs the client, and it mounts nothing until a photo is tapped.
 */
export function ReviewPhotoStrip({
  photos,
  authorName,
  className,
}: {
  photos: readonly ReviewPhoto[];
  authorName: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState<number | null>(null);
  if (photos.length === 0) return null;
  const alt = photoAlt(authorName);

  return (
    <>
      <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Photos from this review">
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setOpen(index)}
              className={cn(
                "block h-20 w-20 overflow-hidden rounded-md border border-brand-line bg-brand-soft",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
              aria-label={`Open photo ${index + 1} of ${photos.length}`}
            >
              {/* A plain <img>, like the blog's covers: the URL is a redirect to
                  a short-lived signed URL, which `next/image` cannot optimise on
                  Workers anyway (`images.unoptimized`). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={reviewPhotoSrc(photo.url)}
                alt={alt}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      {open !== null && (
        <ReviewPhotoViewer
          photos={photos}
          alt={alt}
          index={open}
          onIndexChange={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

export function photoAlt(authorName: string): string {
  return `Photo from ${authorName}'s review`;
}

/** Horizontal travel, in px, that counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD = 40;

function ReviewPhotoViewer({
  photos,
  alt,
  index,
  onIndexChange,
  onClose,
}: {
  photos: readonly ReviewPhoto[];
  alt: string;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const startX = React.useRef<number | null>(null);
  const count = photos.length;
  const photo = photos[index];
  const step = (delta: number) => onIndexChange((index + delta + count) % count);

  if (!photo) return null;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        onKeyDown={(event) => {
          if (count < 2) return;
          if (event.key === "ArrowRight") step(1);
          if (event.key === "ArrowLeft") step(-1);
        }}
        className={cn(
          /* Full screen, undoing the centred dialog's box. */
          "inset-0 left-0 top-0 flex h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0",
          "flex-col items-center justify-center gap-3 rounded-none border-0 bg-black p-4 shadow-none",
          "[&>button:last-child]:text-white",
        )}
      >
        <DialogTitle className="sr-only">
          Photo {index + 1} of {count}
        </DialogTitle>
        <DialogDescription className="sr-only">{alt}</DialogDescription>

        <div
          className="flex min-h-0 w-full flex-1 touch-pan-y items-center justify-center"
          onPointerDown={(event) => {
            startX.current = event.clientX;
          }}
          onPointerUp={(event) => {
            if (startX.current === null || count < 2) return;
            const travel = event.clientX - startX.current;
            startX.current = null;
            if (Math.abs(travel) >= SWIPE_THRESHOLD) step(travel < 0 ? 1 : -1);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={photo.id}
            src={reviewPhotoSrc(photo.url)}
            alt={alt}
            draggable={false}
            className="max-h-full max-w-full select-none object-contain"
            style={
              photo.width && photo.height
                ? { aspectRatio: `${photo.width} / ${photo.height}` }
                : undefined
            }
          />
        </div>

        {count > 1 && (
          <div className="flex items-center gap-4 text-white">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous photo"
              className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <ChevronLeft aria-hidden="true" className="h-6 w-6" />
            </button>
            <span className="font-mono text-sm tabular-nums" aria-live="polite">
              {index + 1} / {count}
            </span>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next photo"
              className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <ChevronRight aria-hidden="true" className="h-6 w-6" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
