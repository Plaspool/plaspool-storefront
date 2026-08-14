/** TipTap/ProseMirror JSON. Block-oriented by construction. */
export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

export interface PublicCoverImage {
  /** Relative: `/api/public/images/<id>`. Pass through `imageUrl()`. */
  url: string;
  alt: string;
  focalPoint: string;
  width: number;
  height: number;
}

export type ReadingTemplate = "magazine" | "minimal" | "editorial" | "technical";

export interface PublicPost {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  coverImage: PublicCoverImage | null;
  category: string;
  tags: string[];
  template: ReadingTemplate | null;
  publishedAt: number;
  updatedAt: number;
  wordCount: number;
  readingTime: number;
  author: { name: string };
}

export interface PublicPostDetail extends PublicPost {
  content: DocNode;
}

export interface PublicTerm {
  name: string;
  count: number;
}

export type PublicSortKey = "published" | "oldest" | "alphabetical";

export interface ListParams {
  category?: string;
  tag?: string;
  search?: string;
  cursor?: string;
  limit?: number;
  sort?: PublicSortKey;
}

/**
 * NAMED `PostList`, not `PostPage` — `PostPage` is the post-detail page
 * component in the mount contract, and one name for both is a collision.
 */
export interface PostList {
  items: PublicPost[];
  nextCursor: string | null;
}
