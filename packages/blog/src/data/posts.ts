import {
  BLOG_API_BASE,
  BLOG_IMAGE_PATH,
  DETAIL_REVALIDATE,
  LIST_REVALIDATE,
  POSTS_PER_PAGE,
} from "./config";
import { BlogAPIError, blogFetch } from "./client";
import type { ListParams, PostList, PublicPostDetail, PublicTerm } from "./types";

/**
 * The image id when `url` is the API's stable `/api/public/images/<id>`
 * form; `null` for anything else (absolute pasted images in post bodies).
 */
export function publicImageId(url: string): string | null {
  const m = /^\/api\/public\/images\/([A-Za-z0-9_-]+)$/.exec(url);
  return m ? m[1] : null;
}

/**
 * The URL a rendered `<img>` may carry.
 *
 * API-hosted images map to the same-origin proxy (`/images/blog/<id>`)
 * instead of the upstream `/api/public/images/<id>`: the upstream form 302s
 * to a presigned R2 URL with a 300-second TTL and `private, no-store` on the
 * redirect, so every single view paid two round trips and nothing was
 * cacheable anywhere (issue #14 — production showed more 3xx responses than
 * 2xx). The proxy serves the bytes from a stable URL with long caching.
 *
 * The presigned URL itself must still never reach HTML — that rule is
 * unchanged; the proxy follows the redirect server-side, per request.
 *
 * Anything already absolute passes through untouched, which keeps pasted
 * remote images in post bodies working.
 */
export function imageUrl(url: string): string {
  const id = publicImageId(url);
  if (id) return `${BLOG_IMAGE_PATH}/${id}`;
  return url.startsWith("http") ? url : `${BLOG_API_BASE}${url}`;
}

export function listPosts(params: ListParams = {}): Promise<PostList> {
  return blogFetch<PostList>("/posts", {
    query: {
      category: params.category,
      tag: params.tag,
      search: params.search,
      cursor: params.cursor,
      limit: params.limit ?? POSTS_PER_PAGE,
      sort: params.sort,
    },
    revalidate: LIST_REVALIDATE,
    tags: ["posts"],
  });
}

/** `null` for both absent and unpublished — the API makes them one 404. */
export async function getPostBySlug(slug: string): Promise<PublicPostDetail | null> {
  try {
    const { post } = await blogFetch<{ post: PublicPostDetail }>(
      `/posts/${encodeURIComponent(slug)}`,
      { revalidate: DETAIL_REVALIDATE, tags: ["posts", `post-${slug}`] },
    );
    return post;
  } catch (error) {
    if (error instanceof BlogAPIError && error.status === 404) return null;
    throw error;
  }
}

async function terms(path: "/categories" | "/tags"): Promise<PublicTerm[]> {
  const { items } = await blogFetch<{ items: PublicTerm[] }>(path, {
    revalidate: DETAIL_REVALIDATE,
    tags: ["terms"],
  });
  return items;
}

export const listCategories = () => terms("/categories");
export const listTags = () => terms("/tags");
