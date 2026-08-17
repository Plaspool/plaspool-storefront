/** Hardcoded on purpose — the storefront has no env file. */
export const BLOG_API_BASE = "https://blog-admin-app-gold.vercel.app";
export const BLOG_API = `${BLOG_API_BASE}/api/public`;

export const POSTS_PER_PAGE = 9;

/** ISR windows. Lists move often, a published post rarely. */
export const LIST_REVALIDATE = 300;
export const DETAIL_REVALIDATE = 3600;

/**
 * Same-origin path of the cover-image proxy
 * (`apps/storefront/app/images/blog/[id]/route.ts`), which replaces the
 * uncacheable upstream 302 with a cacheable response. The dev harness maps
 * the same path with a rewrite in `packages/blog/next.config.ts`.
 */
export const BLOG_IMAGE_PATH = "/images/blog";

/**
 * The admin's reader consults a `settings` object for these; the public API
 * has no settings endpoint (issue #15 records the gap), so the storefront's
 * defaults live here. `magazine` mirrors `resolveTemplate()`'s floor in the
 * admin app; the author's per-post choice always wins over it.
 */
export const BLOG_DEFAULT_TEMPLATE = "magazine" as const;
export const SHOW_READING_TIME = true;
