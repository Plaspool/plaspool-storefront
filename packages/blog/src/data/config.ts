/**
 * Hardcoded on purpose — the storefront has no env file.
 *
 * A SUBDOMAIN OF THE SITE ITSELF, not the deployment's `*.vercel.app` name.
 * The blog's own reads are server-side and would not care, but this is the
 * same host `COMMERCE_API_BASE` uses, and the cart's credentialed calls very
 * much do — see the long note there for what being on a different registrable
 * domain cost. One host, changed in both places together.
 */
export const BLOG_API_BASE = "https://admin.plaspool.com";
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

/**
 * How many posts the featured rail may hold.
 *
 * A ceiling shared by three places and owned by none of them: the backend
 * enforces it on write, the admin UI counts against it, and the storefront
 * caps whatever it is handed (`listFeaturedPosts`). Four because the rail is
 * one post at a time and dot indicators stop being countable at a glance
 * shortly after that.
 */
export const MAX_FEATURED = 4;
