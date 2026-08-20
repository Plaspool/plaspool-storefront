import {
  BLOG_API_BASE,
  BLOG_IMAGE_PATH,
  DETAIL_REVALIDATE,
  LIST_REVALIDATE,
  MAX_FEATURED,
  POSTS_PER_PAGE,
} from "./config";
import { BlogAPIError, blogFetch } from "./client";
import type {
  ListParams,
  PostList,
  PublicPost,
  PublicPostDetail,
  PublicTerm,
} from "./types";

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

/* ══════════════════════════════════════════════════════════════════════════
 * FEATURED POSTS
 *
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ TODO(backend) — THE ENDPOINT THIS CALLS DOES NOT EXIST YET.             │
 * │                                                                        │
 * │ Until it does, `listFeaturedPosts()` gets a 404, answers `null`, and    │
 * │ `selectFeatured()` falls back to the newest posts. The storefront is    │
 * │ already finished: shipping the endpoint switches the rail from "newest" │
 * │ to real curation with NO frontend change.                               │
 * │                                                                        │
 * │ CONTRACT                                                                │
 * │   GET /api/public/posts/featured                                        │
 * │   200 → { items: PublicPost[] }                                         │
 * │                                                                        │
 * │   - `items` is 0..MAX_FEATURED long, already in the curated display     │
 * │     order. The storefront does not re-sort it.                          │
 * │   - Each item is the SAME shape `/posts` returns. No extra fields; the  │
 * │     rail renders the same `PublicPost` the grid does.                   │
 * │   - Published posts only, like every other public endpoint.             │
 * │                                                                        │
 * │ STORAGE                                                                 │
 * │   Two columns on the post: `featured BOOLEAN NOT NULL DEFAULT false`    │
 * │   and `featured_rank INTEGER NULL`. Rank is the display order; it is    │
 * │   unique among featured rows and only meaningful when `featured`.       │
 * │                                                                        │
 * │ INVARIANTS — all four enforced server-side, not just in the admin UI.   │
 * │   1. A post must be PUBLISHED before it can be featured. Featuring a    │
 * │      draft → 422. (The public endpoint filters by published anyway, so  │
 * │      without this a "featured" draft is a silently invisible one.)      │
 * │   2. At most MAX_FEATURED (4) featured at a time. The 5th → 409, and    │
 * │      the response body should NAME the current four so the admin UI     │
 * │      can offer "unfeature one of these" instead of a dead error.        │
 * │   3. Unpublishing or deleting a featured post clears `featured` and     │
 * │      `featured_rank` IN THE SAME TRANSACTION. Otherwise the rail        │
 * │      silently shrinks to three and nothing in the admin says why.       │
 * │   4. Reordering rewrites all ranks in ONE transaction — a partial       │
 * │      reorder leaves two posts sharing a rank and the order goes         │
 * │      non-deterministic.                                                 │
 * │                                                                        │
 * │ CACHING                                                                 │
 * │   Give it its own cache tag (`featured`, as used below) rather than     │
 * │   reusing `posts`: curation changes far less often than the post list,  │
 * │   and sharing a tag means every publish blows away the rail's cache.    │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ TODO(admin-ui) — nothing can be curated until this exists.              │
 * │                                                                        │
 * │   1. A "Feature this post" toggle in the post editor, DISABLED while    │
 * │      the post is a draft, with a tooltip saying why rather than a       │
 * │      toggle that fails on click.                                        │
 * │   2. A featured manager: the four in rank order, drag to reorder,       │
 * │      remove from the rail. Reorder posts the whole list, not one row    │
 * │      (invariant 4).                                                     │
 * │   3. A live "3 of 4 featured" counter next to the toggle. On the 5th,   │
 * │      surface the 409's list and let the editor swap one out in place.   │
 * │   4. Unpublishing a featured post must WARN that it will leave the      │
 * │      rail (invariant 3) — it is a side effect on a different page than  │
 * │      the one being edited.                                              │
 * └────────────────────────────────────────────────────────────────────────┘
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * The curated rail, or `null` if the API does not serve one.
 *
 * ═══ NULL AND [] ARE DIFFERENT ANSWERS, AND BOTH ARE REAL ═══
 * `null` means "this API has no opinion" — the endpoint 404s because it is
 * not built, or the call failed. `[]` means "asked and answered: nothing is
 * curated". Collapsing them here would throw away the only signal
 * `selectFeatured` has to reason with, so the distinction is kept at this
 * boundary even though today's caller happens to treat both the same way.
 *
 * NEVER THROWS. A missing rail is a section that does not render; it is not a
 * reason for `/posts` to 500. Same "never throw" rule the shop's
 * `cart-api.ts` follows, for the same reason.
 */
export async function listFeaturedPosts(): Promise<PublicPost[] | null> {
  try {
    const body = await blogFetch<{ items: PublicPost[] }>("/posts/featured", {
      revalidate: LIST_REVALIDATE,
      /* Its own tag, not `posts` — see CACHING in the contract above. */
      tags: ["featured"],
    });
    if (!Array.isArray(body?.items)) return null;
    /* The cap is the backend's invariant; this is the edge declining to
       render a rail that outgrew it anyway. */
    return body.items.slice(0, MAX_FEATURED);
  } catch {
    return null;
  }
}

/**
 * What the featured rail actually shows.
 *
 * Pure, and separate from the fetch, because the interesting behaviour is all
 * in the decision rather than the transport — and because the fallback is the
 * part that gets deleted one day, so it is worth being able to point at it.
 *
 * ═══ THE FALLBACK IS TEMPORARY AND KNOWS IT ═══
 * With no curated rail the newest posts stand in, so the section is not an
 * empty heading while the backend TODO above is open. It is a stand-in, not a
 * feature: real curation wins at any size, but a fallback backs out entirely
 * (`[]`) when it would merely reprint the grid below it under a second
 * heading — which is what happens on a blog of four posts or fewer.
 *
 * Duplication ABOVE that threshold is intentional: the reference design leads
 * with a post and shows it again in the grid, the way a magazine puts its
 * cover story in the contents.
 */
export function selectFeatured(
  featured: PublicPost[] | null,
  latest: PublicPost[],
): PublicPost[] {
  if (featured && featured.length > 0) return featured.slice(0, MAX_FEATURED);

  if (latest.length <= MAX_FEATURED) return [];
  /* Sorted rather than sliced: the caller's order is whatever the list
     endpoint's `sort` produced, and this fallback's claim is specifically
     "the newest". */
  return [...latest].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, MAX_FEATURED);
}
