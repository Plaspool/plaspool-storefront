import { imageUrl } from "../data/posts";
import type { PublicCoverImage } from "../data/types";

/**
 * The one way a cover image reaches an `<img>` (issue #14).
 *
 * Every call site used to hand-assemble the tag, and every one of them
 * skipped `width`/`height` — despite the API sending both — so the browser
 * had no intrinsic ratio until the bytes arrived. The fixed-height containers
 * hid most of the shift; this stops relying on them.
 *
 * `src` goes through `imageUrl()`, which routes API-hosted images to the
 * same-origin caching proxy. `priority` marks the LCP image — a post page's
 * hero — and switches lazy loading off for it; everything below the fold
 * stays lazy.
 *
 * What this deliberately does NOT do is emit `srcset`: there is no resizer
 * in this stack today (Workers has no sharp, and Cloudflare Image Resizing
 * is unavailable on workers.dev). The component exists so that when one
 * arrives, multi-resolution sources land here once instead of at four call
 * sites. That gap is recorded on #14.
 */
export function CoverImg({
  image,
  fallbackAlt,
  className,
  priority = false,
}: {
  image: PublicCoverImage;
  /** Usually the post title — an empty CMS alt must not strand the reader. */
  fallbackAlt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={imageUrl(image.url)}
      alt={image.alt || fallbackAlt}
      width={image.width || undefined}
      height={image.height || undefined}
      style={{ objectPosition: image.focalPoint || undefined }}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      // React 19 lowercases this correctly; it reaches the browser as
      // fetchpriority and promotes the hero in the preload scanner.
      fetchPriority={priority ? "high" : undefined}
    />
  );
}
