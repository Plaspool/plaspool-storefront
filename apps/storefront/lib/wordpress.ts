// Description: WordPress API functions
// Used to fetch data from a WordPress site using the WordPress REST API
// Types are imported from `wp.d.ts`

import querystring from "query-string";
import type {
  Post,
  Category,
  Tag,
  Page,
  Author,
  FeaturedMedia,
} from "./wordpress.d";

const baseUrl = process.env.WORDPRESS_URL;

if (!baseUrl) {
  throw new Error("WORDPRESS_URL environment variable is not defined");
}

function getUrl(path: string, query?: Record<string, any>) {
  const params = query ? querystring.stringify(query) : null;
  return `${baseUrl}${path}${params ? `?${params}` : ""}`;
}

class WordPressAPIError extends Error {
  constructor(message: string, public status: number, public endpoint: string) {
    super(message);
    this.name = "WordPressAPIError";
  }
}

// Enhanced fetch function with retry logic and better error handling
async function wordpressFetch<T>(url: string, retries = 3, timeout = 8000): Promise<T> {
  const userAgent = "Next.js WordPress Client";

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": userAgent,
          "Accept": "application/json",
          "Cache-Control": "no-cache",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Log detailed error information
        console.error(`WordPress API Error (Attempt ${attempt}/${retries}):`, {
          status: response.status,
          statusText: response.statusText,
          url,
          timestamp: new Date().toISOString()
        });

        // Don't retry on client errors (4xx), only server errors (5xx)
        if (response.status >= 400 && response.status < 500 && attempt === 1) {
          throw new WordPressAPIError(
            `WordPress API request failed: ${response.statusText}`,
            response.status,
            url
          );
        }

        // For server errors, continue to retry
        if (attempt === retries) {
          throw new WordPressAPIError(
            `WordPress API request failed after ${retries} attempts: ${response.statusText}`,
            response.status,
            url
          );
        }
      } else {
        // Success - return the data
        return response.json();
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof WordPressAPIError) {
        throw error; // Re-throw our custom errors
      }

      console.error(`WordPress API Error (Attempt ${attempt}/${retries}):`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        url,
        timestamp: new Date().toISOString()
      });

      if (attempt === retries) {
        throw new WordPressAPIError(
          `WordPress API request failed after ${retries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
          502,
          url
        );
      }
    }

    // Exponential backoff between retries
    if (attempt < retries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 second delay
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new WordPressAPIError("Unexpected error in wordpressFetch", 502, url);
}

// Enhanced getAllPosts function with better error handling
export async function getAllPosts(filterParams?: {
  author?: string;
  tag?: string;
  category?: string;
  search?: string;
  page?: number;
  perPage?: number;
}): Promise<{ posts: Post[]; totalPages: number }> {
  const query: Record<string, any> = {
    // Only fetch essential fields instead of _embed to reduce payload size
    _fields: 'id,title,excerpt,slug,date,modified,author,categories,tags,featured_media,link',
    per_page: filterParams?.perPage ?? 4,
    page: filterParams?.page ?? 1,
    // Add context for better caching
    context: 'view',
  };

  // Apply filters
  if (filterParams?.search) query.search = filterParams.search;
  if (filterParams?.author) query.author = filterParams.author;
  if (filterParams?.tag) query.tags = filterParams.tag;
  if (filterParams?.category) query.categories = filterParams.category;

  const url = getUrl("/wp-json/wp/v2/posts", query);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for posts

    const response = await fetch(url, { 
      headers: { 
        Accept: "application/json",
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'User-Agent': 'Next.js App on Vercel',
      },
      signal: controller.signal,
      next: {
        revalidate: 300, // 5 minutes
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error("WordPress API error:", {
        status: response.status,
        statusText: response.statusText,
        url,
        timestamp: new Date().toISOString()
      });
      
      // Return empty result instead of throwing
      return { posts: [], totalPages: 1 };
    }

    const totalPages = parseInt(
      response.headers.get("X-WP-TotalPages") ?? "1",
      10
    );

    const posts: Post[] = await response.json();
    
    return { posts, totalPages };

  } catch (error) {
    console.error("WordPress API error in getAllPosts:", {
      error: error instanceof Error ? error.message : 'Unknown error',
      url,
      timestamp: new Date().toISOString()
    });
    
    // Return empty result to prevent app crashes
    return { posts: [], totalPages: 1 };
  }
}

// Enhanced getFilterOptions with better error handling
export async function getFilterOptions(): Promise<{
  authors: Author[];
  tags: Tag[];
  categories: Category[];
}> {
  const fetchOptions = {
    next: { revalidate: 3600 }, // 1 hour cache
    headers: { 
      'Cache-Control': 'public, max-age=3600',
      'Accept': 'application/json',
      'User-Agent': 'Next.js App on Vercel'
    }
  };

  try {
    const [authorsResponse, tagsResponse, categoriesResponse] = await Promise.allSettled([
      fetch(getUrl("/wp-json/wp/v2/users", { 
        _fields: 'id,name,slug',
        per_page: 100,
        context: 'view'
      }), fetchOptions),
      
      fetch(getUrl("/wp-json/wp/v2/tags", { 
        _fields: 'id,name,slug,count',
        per_page: 100,
        orderby: 'count',
        order: 'desc',
        context: 'view'
      }), fetchOptions),
      
      fetch(getUrl("/wp-json/wp/v2/categories", { 
        _fields: 'id,name,slug,count',
        per_page: 100,
        orderby: 'count',
        order: 'desc',
        context: 'view'
      }), fetchOptions)
    ]);

    // Handle each response individually
    const authors = authorsResponse.status === 'fulfilled' && authorsResponse.value.ok 
      ? await authorsResponse.value.json() 
      : [];
    
    const tags = tagsResponse.status === 'fulfilled' && tagsResponse.value.ok 
      ? await tagsResponse.value.json() 
      : [];
    
    const categories = categoriesResponse.status === 'fulfilled' && categoriesResponse.value.ok 
      ? await categoriesResponse.value.json() 
      : [];

    return { authors, tags, categories };

  } catch (error) {
    console.error("Error fetching filter options:", error);
    return { authors: [], tags: [], categories: [] };
  }
}

// Enhanced getFeaturedMediaById with retry logic
export async function getFeaturedMediaById(id: number): Promise<FeaturedMedia | null> {
  try {
    const url = getUrl(`/wp-json/wp/v2/media/${id}`);
    return await wordpressFetch<FeaturedMedia>(url);
  } catch (error) {
    console.error(`Error fetching featured media ${id}:`, error);
    // Return null instead of throwing to prevent crashes
    return null;
  }
}

// Rest of the functions with enhanced error handling
export async function getPostById(id: number): Promise<Post | null> {
  try {
    const url = getUrl(`/wp-json/wp/v2/posts/${id}`);
    return await wordpressFetch<Post>(url);
  } catch (error) {
    console.error(`Error fetching post ${id}:`, error);
    return null;
  }
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  try {
    const url = getUrl("/wp-json/wp/v2/posts", { slug });
    const response = await wordpressFetch<Post[]>(url);
    return response[0] || null;
  } catch (error) {
    console.error(`Error fetching post by slug ${slug}:`, error);
    return null;
  }
}

export async function getAllCategories(): Promise<Category[]> {
  try {
    const url = getUrl("/wp-json/wp/v2/categories");
    return await wordpressFetch<Category[]>(url);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

export async function getCategoryById(id: number): Promise<Category | null> {
  try {
    const url = getUrl(`/wp-json/wp/v2/categories/${id}`);
    return await wordpressFetch<Category>(url);
  } catch (error) {
    console.error(`Error fetching category ${id}:`, error);
    return null;
  }
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  try {
    const url = getUrl("/wp-json/wp/v2/categories", { slug });
    const response = await wordpressFetch<Category[]>(url);
    return response[0] || null;
  } catch (error) {
    console.error(`Error fetching category by slug ${slug}:`, error);
    return null;
  }
}

export async function getPostsByCategory(categoryId: number): Promise<Post[]> {
  try {
    const url = getUrl("/wp-json/wp/v2/posts", { categories: categoryId });
    return await wordpressFetch<Post[]>(url);
  } catch (error) {
    console.error(`Error fetching posts by category ${categoryId}:`, error);
    return [];
  }
}

export async function getPostsByTag(tagId: number): Promise<Post[]> {
  try {
    const url = getUrl("/wp-json/wp/v2/posts", { tags: tagId });
    return await wordpressFetch<Post[]>(url);
  } catch (error) {
    console.error(`Error fetching posts by tag ${tagId}:`, error);
    return [];
  }
}

export async function getTagsByPost(postId: number): Promise<Tag[]> {
  try {
    const url = getUrl("/wp-json/wp/v2/tags", { post: postId });
    return await wordpressFetch<Tag[]>(url);
  } catch (error) {
    console.error(`Error fetching tags by post ${postId}:`, error);
    return [];
  }
}

export async function getAllTags(): Promise<Tag[]> {
  try {
    const url = getUrl("/wp-json/wp/v2/tags");
    return await wordpressFetch<Tag[]>(url);
  } catch (error) {
    console.error("Error fetching tags:", error);
    return [];
  }
}

export async function getTagById(id: number): Promise<Tag | null> {
  try {
    const url = getUrl(`/wp-json/wp/v2/tags/${id}`);
    return await wordpressFetch<Tag>(url);
  } catch (error) {
    console.error(`Error fetching tag ${id}:`, error);
    return null;
  }
}

export async function getTagBySlug(slug: string): Promise<Tag | null> {
  try {
    const url = getUrl("/wp-json/wp/v2/tags", { slug });
    const response = await wordpressFetch<Tag[]>(url);
    return response[0] || null;
  } catch (error) {
    console.error(`Error fetching tag by slug ${slug}:`, error);
    return null;
  }
}

export async function getAllPages(): Promise<Page[]> {
  try {
    const url = getUrl("/wp-json/wp/v2/pages");
    return await wordpressFetch<Page[]>(url);
  } catch (error) {
    console.error("Error fetching pages:", error);
    return [];
  }
}

export async function getPageById(id: number): Promise<Page | null> {
  try {
    const url = getUrl(`/wp-json/wp/v2/pages/${id}`);
    return await wordpressFetch<Page>(url);
  } catch (error) {
    console.error(`Error fetching page ${id}:`, error);
    return null;
  }
}

export async function getPageBySlug(slug: string): Promise<Page | null> {
  try {
    const url = getUrl("/wp-json/wp/v2/pages", { slug });
    const response = await wordpressFetch<Page[]>(url);
    return response[0] || null;
  } catch (error) {
    console.error(`Error fetching page by slug ${slug}:`, error);
    return null;
  }
}

export async function getAllAuthors(): Promise<Author[]> {
  try {
    const url = getUrl("/wp-json/wp/v2/users");
    return await wordpressFetch<Author[]>(url);
  } catch (error) {
    console.error("Error fetching authors:", error);
    return [];
  }
}

export async function getAuthorById(id: number): Promise<Author | null> {
  try {
    const url = getUrl(`/wp-json/wp/v2/users/${id}`);
    return await wordpressFetch<Author>(url);
  } catch (error) {
    console.error(`Error fetching author ${id}:`, error);
    return null;
  }
}

export async function getAuthorBySlug(slug: string): Promise<Author | null> {
  try {
    const url = getUrl("/wp-json/wp/v2/users", { slug });
    const response = await wordpressFetch<Author[]>(url);
    return response[0] || null;
  } catch (error) {
    console.error(`Error fetching author by slug ${slug}:`, error);
    return null;
  }
}

export async function getPostsByAuthor(authorId: number): Promise<Post[]> {
  try {
    const url = getUrl("/wp-json/wp/v2/posts", { author: authorId });
    return await wordpressFetch<Post[]>(url);
  } catch (error) {
    console.error(`Error fetching posts by author ${authorId}:`, error);
    return [];
  }
}

export async function getPostsByAuthorSlug(authorSlug: string): Promise<Post[]> {
  try {
    const author = await getAuthorBySlug(authorSlug);
    if (!author) return [];
    
    const url = getUrl("/wp-json/wp/v2/posts", { author: author.id });
    return await wordpressFetch<Post[]>(url);
  } catch (error) {
    console.error(`Error fetching posts by author slug ${authorSlug}:`, error);
    return [];
  }
}

export async function getPostsByCategorySlug(categorySlug: string): Promise<Post[]> {
  try {
    const category = await getCategoryBySlug(categorySlug);
    if (!category) return [];
    
    const url = getUrl("/wp-json/wp/v2/posts", { categories: category.id });
    return await wordpressFetch<Post[]>(url);
  } catch (error) {
    console.error(`Error fetching posts by category slug ${categorySlug}:`, error);
    return [];
  }
}

export async function getPostsByTagSlug(tagSlug: string): Promise<Post[]> {
  try {
    const tag = await getTagBySlug(tagSlug);
    if (!tag) return [];
    
    const url = getUrl("/wp-json/wp/v2/posts", { tags: tag.id });
    return await wordpressFetch<Post[]>(url);
  } catch (error) {
    console.error(`Error fetching posts by tag slug ${tagSlug}:`, error);
    return [];
  }
}

export async function searchCategories(query: string): Promise<Category[]> {
  try {
    const url = getUrl("/wp-json/wp/v2/categories", {
      search: query,
      per_page: 100,
    });
    return await wordpressFetch<Category[]>(url);
  } catch (error) {
    console.error(`Error searching categories with query ${query}:`, error);
    return [];
  }
}

export async function searchTags(query: string): Promise<Tag[]> {
  try {
    const url = getUrl("/wp-json/wp/v2/tags", {
      search: query,
      per_page: 100,
    });
    return await wordpressFetch<Tag[]>(url);
  } catch (error) {
    console.error(`Error searching tags with query ${query}:`, error);
    return [];
  }
}

export async function searchAuthors(query: string): Promise<Author[]> {
  try {
    const url = getUrl("/wp-json/wp/v2/users", {
      search: query,
      per_page: 100,
    });
    return await wordpressFetch<Author[]>(url);
  } catch (error) {
    console.error(`Error searching authors with query ${query}:`, error);
    return [];
  }
}

// Optional: Search-specific function for better performance
export async function searchFilterOptions(searchTerm: string): Promise<{
  authors: Author[];
  tags: Tag[];
  categories: Category[];
}> {
  const fetchOptions = {
    next: { revalidate: 300 },
    headers: { 
      'Cache-Control': 'public, max-age=300',
      'Accept': 'application/json',
      'User-Agent': 'Next.js App on Vercel'
    }
  };

  try {
    const [authorsResponse, tagsResponse, categoriesResponse] = await Promise.allSettled([
      fetch(getUrl("/wp-json/wp/v2/users", { 
        search: searchTerm,
        _fields: 'id,name,slug',
        per_page: 20,
        context: 'view'
      }), fetchOptions),
      
      fetch(getUrl("/wp-json/wp/v2/tags", { 
        search: searchTerm,
        _fields: 'id,name,slug,count',
        per_page: 20,
        context: 'view'
      }), fetchOptions),
      
      fetch(getUrl("/wp-json/wp/v2/categories", { 
        search: searchTerm,
        _fields: 'id,name,slug,count',
        per_page: 20,
        context: 'view'
      }), fetchOptions)
    ]);

    const authors = authorsResponse.status === 'fulfilled' && authorsResponse.value.ok 
      ? await authorsResponse.value.json() 
      : [];
    
    const tags = tagsResponse.status === 'fulfilled' && tagsResponse.value.ok 
      ? await tagsResponse.value.json() 
      : [];
    
    const categories = categoriesResponse.status === 'fulfilled' && categoriesResponse.value.ok 
      ? await categoriesResponse.value.json() 
      : [];

    return { authors, tags, categories };

  } catch (error) {
    console.error("Error searching filter options:", error);
    return { authors: [], tags: [], categories: [] };
  }
}

export { WordPressAPIError };