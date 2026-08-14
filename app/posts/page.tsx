import {
  getAllPosts,
  getFilterOptions,
  searchFilterOptions,
} from "@/lib/wordpress";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import { Section, Container, Prose } from "@/components/craft";
import { PostCard } from "@/components/posts/post-card";
import { FilterPosts } from "@/components/posts/filter";
import { SearchInput } from "@/components/posts/search-input";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog Posts – 3D printing tips, materials & case studies Nigeria",
  description:
    "Explore expert articles on 3D printing in Nigeria, from material guides and prototyping tips to inspiring project case studies and industry trends.",
};

// Optimized caching configuration
export const dynamic = "auto";
export const revalidate = 300; // 5 minutes instead of 10 minutes

// Main page component - simplified without Suspense complexity
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    author?: string;
    tag?: string;
    category?: string;
    page?: string;
    search?: string;
  }>;
}) {
  const params = await searchParams;
  const { author, tag, category, page: pageParam, search } = params;

  // Pagination setup
  const page = pageParam ? parseInt(pageParam, 10) : 1;
  const postsPerPage = 3;

  // Fetch posts and filter options - but with error handling
  try {
    // Primary data fetch - posts
    const { posts, totalPages } = await getAllPosts({ 
      author, 
      tag, 
      category, 
      search, 
      page, 
      perPage: postsPerPage 
    });

    // Secondary data fetch - filter options (with fallback)
    let filterOptions: {
      authors: Awaited<ReturnType<typeof getFilterOptions>>['authors'],
      tags: Awaited<ReturnType<typeof getFilterOptions>>['tags'],
      categories: Awaited<ReturnType<typeof getFilterOptions>>['categories'],
    } = { authors: [], tags: [], categories: [] };
    try {
      filterOptions = search 
        ? await searchFilterOptions(search)
        : await getFilterOptions();
    } catch (filterError) {
      console.error("Failed to load filter options:", filterError);
      // Continue with empty filter options rather than crashing
    }

    // Create pagination URL helper
    const createPaginationUrl = (newPage: number) => {
      const urlParams = new URLSearchParams();
      if (newPage > 1) urlParams.set("page", newPage.toString());
      if (category) urlParams.set("category", category);
      if (author) urlParams.set("author", author);
      if (tag) urlParams.set("tag", tag);
      if (search) urlParams.set("search", search);
      return `/posts${urlParams.toString() ? `?${urlParams.toString()}` : ""}`;
    };

    return (
      <Section className="bg-white font-mono">
        <Container>
          <div className="space-y-8">
            <Prose>
              <h2 className="font-mono text-slate-800">All Posts</h2>
            </Prose>

            <div className="space-y-4">
              <SearchInput defaultValue={search} />
              
              <FilterPosts
                authors={filterOptions.authors}
                tags={filterOptions.tags}
                categories={filterOptions.categories}
                selectedAuthor={author}
                selectedTag={tag}
                selectedCategory={category}
              />
            </div>

            {posts.length > 0 ? (
              <div className="grid md:grid-cols-3 gap-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="h-24 w-full border rounded-lg bg-accent/25 flex items-center justify-center">
                <p>No posts found</p>
              </div>
            )}

            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  {/* Previous button */}
                  <PaginationItem>
                    <PaginationPrevious
                      className={
                        page <= 1 ? "pointer-events-none opacity-50" : "bg-[#2d2cb5] text-white"
                      }
                      href={page > 1 ? createPaginationUrl(page - 1) : "#"} 
                    />
                  </PaginationItem>

                  {/* Page numbers with better logic */}
                  {page > 2 && (
                    <PaginationItem>
                      <PaginationLink href={createPaginationUrl(1)} className="bg-[#2d2cb5] text-white">
                        1
                      </PaginationLink>
                    </PaginationItem>
                  )}
                  
                  {page > 3 && (
                    <PaginationItem>
                      <span className="px-2">...</span>
                    </PaginationItem>
                  )}
                  
                  {page > 1 && (
                    <PaginationItem>
                      <PaginationLink href={createPaginationUrl(page - 1)} className="bg-[#2d2cb5] text-white">
                        {page - 1}
                      </PaginationLink>
                    </PaginationItem>
                  )}

                  {/* Current page */}
                  <PaginationItem>
                    <PaginationLink 
                      href={createPaginationUrl(page)}
                      className="bg-[#2d2cb5] text-white hover:bg-[#2d2cb5]/90"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>

                  {page < totalPages && (
                    <PaginationItem>
                      <PaginationLink href={createPaginationUrl(page + 1)} className="bg-[#2d2cb5] text-white">
                        {page + 1}
                      </PaginationLink>
                    </PaginationItem>
                  )}
                  
                  {page < totalPages - 2 && (
                    <PaginationItem>
                      <span className="px-2">...</span>
                    </PaginationItem>
                  )}
                  
                  {page < totalPages - 1 && (
                    <PaginationItem>
                      <PaginationLink href={createPaginationUrl(totalPages)} className="bg-[#2d2cb5] text-white">
                        {totalPages}
                      </PaginationLink>
                    </PaginationItem>
                  )}

                  {/* Next button */}
                  <PaginationItem>
                    <PaginationNext
                      className={
                        page >= totalPages ? "pointer-events-none opacity-50" : "bg-[#2d2cb5] text-white"
                      }
                      href={page < totalPages ? createPaginationUrl(page + 1) : "#"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </Container>
      </Section>
    );

  } catch (error) {
    console.error("Error loading posts page:", error);
    
    // Fallback UI in case of complete failure
    return (
      <Section className="bg-white font-mono">
        <Container>
          <div className="space-y-8">
            <Prose>
              <h2 className="font-mono text-slate-800">All Posts</h2>
            </Prose>
            
            <div className="h-24 w-full border rounded-lg bg-red-50 flex items-center justify-center">
              <p className="text-red-600">Unable to load posts. Please try again later.</p>
            </div>
          </div>
        </Container>
      </Section>
    );
  }
}