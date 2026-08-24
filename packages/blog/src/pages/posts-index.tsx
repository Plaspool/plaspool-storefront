import { Link } from "../components/link";

import { listPosts, listCategories, listFeaturedPosts, selectFeatured } from "../data/posts";
import { PostCard } from "../components/post-card";
import { LoadMore } from "../components/load-more";
import { SearchInput } from "../components/search-input";
import { CategoryChips } from "../components/category-chips";
import { FeaturedCarousel } from "../components/featured-carousel";

import type { Metadata } from "next";

export const postsIndexMetadata: Metadata = {
  title: "Blog — 3D printing tips, materials and case studies in Nigeria",
  description:
    "Expert articles on 3D printing in Nigeria: material guides, prototyping tips, project case studies and industry trends.",
  alternates: { canonical: "/posts" },
};

/**
 * `/posts` — the reader's front page.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS PAGE IS FOR SOMEBODY WITH NO POST IN MIND.
 *
 * It used to be the admin's listing with the edit controls taken off: a
 * left-aligned heading, a filter toolbar, and one flat grid of every post in
 * publish order. That is the correct shape for a work queue — the author
 * knows which post they are looking for, and equal weight is the point.
 *
 * A reader arriving cold is the opposite case. Nothing on that page said what
 * to read, so the first post won by being newest, which is an accident of
 * scheduling rather than an editorial decision. So the page now leads: a
 * centred masthead that says what this blog is, then a featured rail, then
 * everything else.
 *
 * ═══ THE FEATURED RAIL IS RUNNING ON A FALLBACK TODAY ═══
 * There is no curated-posts endpoint yet — `listFeaturedPosts()` 404s and
 * answers `null`, and `selectFeatured()` stands the newest posts in so the
 * section is not an empty heading. See the TODO(backend) / TODO(admin-ui)
 * block above `listFeaturedPosts` in `data/posts.ts` for the contract and the
 * invariants. When that ships, this page changes in NO WAY.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export default async function PostsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; category?: string; search?: string }>;
}) {
  const { tag, category, search } = await searchParams;
  const params = { tag, category, search };

  /*
   * `listFeaturedPosts` joins the same parallel batch rather than being
   * awaited after it. It is the one call here that is EXPECTED to fail today,
   * and it already swallows its own failure — so putting it in the batch
   * costs nothing and keeps the page's latency the slowest single call rather
   * than the sum of two.
   *
   * `listTags` is gone from the batch: the tag dropdown it fed is gone, and
   * the tag pill below needs only the tag already in the URL.
   */
  const [page, categories, featured] = await Promise.all([
    listPosts(params).catch(() => ({ items: [], nextCursor: null })),
    listCategories().catch(() => []),
    listFeaturedPosts(),
  ]);

  /*
   * THE RAIL IS SUPPRESSED WHENEVER THE READER HAS NARROWED THE PAGE.
   *
   * Featured posts are a property of the blog, not of a search result. Left
   * in, a search for "PETG" would show a rail of posts that do not match it,
   * directly above a grid of posts that do — which reads as the search having
   * partly failed. The rail belongs to the unfiltered front page.
   */
  const browsing = !tag && !category && !search;
  const featuredPosts = browsing ? selectFeatured(featured, page.items) : [];

  return (
    <div className="blog">
      <div className="blog-shell">
        <header className="blog-head--center">
          <h1 className="blog-head__title">
            The latest from PlaSpool:
            <br />
            guides, stories and product updates
          </h1>
          <p className="blog-head__sub">
            3D printing guides, material notes and case studies from Nigeria.
          </p>
        </header>

        <div className="blog-toolbar blog-toolbar--center">
          <SearchInput defaultValue={search} />
          <CategoryChips categories={categories.map((c) => c.name)} selected={category} search={search} />
          {tag && (
            /* Tags arrive by being clicked on a card, so there is no picker to
               go back to — what is needed is to see the filter and drop it. */
            <p className="tag-filter">
              <span>
                Tagged <strong>{tag}</strong>
              </span>
              <Link href={category ? `/posts?category=${encodeURIComponent(category)}` : "/posts"} className="cat-chip">
                Clear
              </Link>
            </p>
          )}
        </div>

        {featuredPosts.length > 0 && (
          <section aria-labelledby="featured-heading">
            <h2 id="featured-heading" className="section-head">
              Featured blog posts
            </h2>
            <FeaturedCarousel posts={featuredPosts} labelledBy="featured-heading" />
          </section>
        )}

        {page.items.length === 0 ? (
          <div className="blog-empty">
            <p>No posts found.</p>
          </div>
        ) : (
          <section aria-labelledby="latest-heading">
            {/* The heading stays honest under a filter: what is below is no
                longer "the latest", it is what matched. */}
            <h2 id="latest-heading" className="section-head">
              {browsing ? "Latest blog posts" : "Results"}
            </h2>
            <div className="post-grid">
              {page.items.map((post, i) => (
                <PostCard key={post.id} post={post} index={i} />
              ))}
            </div>
            <LoadMore initialCursor={page.nextCursor} params={params} />
          </section>
        )}
      </div>
    </div>
  );
}
