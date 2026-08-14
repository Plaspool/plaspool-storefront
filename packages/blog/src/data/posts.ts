import { BLOG_API_BASE, DETAIL_REVALIDATE, LIST_REVALIDATE, POSTS_PER_PAGE } from "./config";
import { BlogAPIError, blogFetch } from "./client";
import type { ListParams, PostList, PublicPostDetail, PublicTerm } from "./types";

/**
 * Absolute URL for a cover image. The API returns `/api/public/images/<id>`,
 * which 302s to a presigned R2 URL with a 300-second TTL — so this stable form
 * is the only one that may ever reach rendered HTML.
 */
export function imageUrl(url: string): string {
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
