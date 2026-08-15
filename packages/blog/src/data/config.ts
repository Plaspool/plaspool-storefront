/** Hardcoded on purpose — the storefront has no env file. */
export const BLOG_API_BASE = "https://blog-admin-app-gold.vercel.app";
export const BLOG_API = `${BLOG_API_BASE}/api/public`;

export const POSTS_PER_PAGE = 9;

/** ISR windows. Lists move often, a published post rarely. */
export const LIST_REVALIDATE = 300;
export const DETAIL_REVALIDATE = 3600;
