import { listPosts, listCategories, listTags } from "../data/posts";
import { PostCard } from "../components/post-card";
import { LoadMore } from "../components/load-more";
import { FilterPosts } from "../components/filter";
import { SearchInput } from "../components/search-input";

import type { Metadata } from "next";

export const postsIndexMetadata: Metadata = {
  title: "Blog — 3D printing tips, materials and case studies in Nigeria",
  description:
    "Expert articles on 3D printing in Nigeria: material guides, prototyping tips, project case studies and industry trends.",
  alternates: { canonical: "/posts" },
};

export default async function PostsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; category?: string; search?: string }>;
}) {
  const { tag, category, search } = await searchParams;
  const params = { tag, category, search };

  const [page, categories, tags] = await Promise.all([
    listPosts(params).catch(() => ({ items: [], nextCursor: null })),
    listCategories().catch(() => []),
    listTags().catch(() => []),
  ]);

  return (
    <div className="blog">
      <div className="blog-shell">
        <header>
          <h1 className="blog-head__title">Posts</h1>
          <p className="blog-head__sub">
            3D printing guides, material notes and case studies from Nigeria.
          </p>
        </header>

        <div className="blog-toolbar">
          <SearchInput defaultValue={search} />
          <FilterPosts
            categories={categories.map((c) => c.name)}
            tags={tags.map((t) => t.name)}
            selectedCategory={category}
            selectedTag={tag}
          />
        </div>

        {page.items.length === 0 ? (
          <div className="blog-empty">
            <p>No posts found.</p>
          </div>
        ) : (
          <>
            <div className="post-grid">
              {page.items.map((post, i) => (
                <PostCard key={post.id} post={post} index={i} />
              ))}
            </div>
            <LoadMore initialCursor={page.nextCursor} params={params} />
          </>
        )}
      </div>
    </div>
  );
}
