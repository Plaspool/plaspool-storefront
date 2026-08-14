import { listPosts, listCategories, listTags } from "../data/posts";
import { Section, Container, Prose } from "@plaspool/ui";
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
    <Section>
      <Container className="space-y-8">
        <Prose className="mb-8">
          <h1 className="mb-2">Posts</h1>
          <p className="text-muted-foreground">
            3D printing guides, material notes and case studies from Nigeria.
          </p>
        </Prose>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <SearchInput defaultValue={search} />
          <FilterPosts
            categories={categories.map((c) => c.name)}
            tags={tags.map((t) => t.name)}
            selectedCategory={category}
            selectedTag={tag}
          />
        </div>

        {page.items.length === 0 ? (
          <div className="h-24 w-full border rounded-lg bg-accent/25 flex items-center justify-center">
            <p className="text-muted-foreground">No posts found.</p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-4">
              {page.items.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
            <LoadMore initialCursor={page.nextCursor} params={params} />
          </>
        )}
      </Container>
    </Section>
  );
}
