"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@plaspool/ui";

interface FilterPostsProps {
  categories: string[];
  tags: string[];
  selectedCategory?: string;
  selectedTag?: string;
}

export function FilterPosts({
  categories,
  tags,
  selectedCategory,
  selectedTag,
}: FilterPostsProps) {
  const router = useRouter();

  const handleFilterChange = (type: string, value: string) => {
    const newParams = new URLSearchParams(window.location.search);
    if (value === "all") newParams.delete(type);
    else newParams.set(type, value);

    const query = newParams.toString();
    router.push(query ? `/posts?${query}` : "/posts");
  };

  const hasTags = tags.length > 0;
  const hasCategories = categories.length > 0;
  const hasFilter = Boolean(selectedTag || selectedCategory);

  /*
   * Nothing to filter by — render nothing at all.
   *
   * The previous version showed two disabled selects reading "No tags found"
   * and "No categories found", which is three controls telling the reader
   * about an absence they cannot act on. An empty taxonomy is the normal
   * state of a blog that has not been populated yet, so the honest UI is no
   * UI. The selects reappear on their own the moment the API returns terms.
   */
  if (!hasTags && !hasCategories) return null;

  return (
    /*
     * Each control sizes to its content and the row wraps as a whole, so a
     * label never breaks across two lines — `whitespace-nowrap` on the
     * triggers plus `w-auto` is what keeps "All Categories" and "Reset
     * filters" each on one line at every width. The old fixed
     * `md:grid-cols-[1fr_1fr_0.5fr]` gave the reset button a third of the
     * space of a select and wrapped its label in two.
     */
    <div className="flex flex-wrap items-center gap-2">
      {hasTags && (
        <Select
          value={selectedTag || "all"}
          onValueChange={(value) => handleFilterChange("tag", value)}
        >
          <SelectTrigger className="blog-ctl w-auto min-w-[9rem] whitespace-nowrap">
            <SelectValue placeholder="All tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag} value={tag} className="whitespace-nowrap">
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasCategories && (
        <Select
          value={selectedCategory || "all"}
          onValueChange={(value) => handleFilterChange("category", value)}
        >
          <SelectTrigger className="blog-ctl w-auto min-w-[11rem] whitespace-nowrap">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem
                key={category}
                value={category}
                className="whitespace-nowrap"
              >
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Only offered once something is actually filtered — a reset that resets
          nothing is a dead control. */}
      {hasFilter && (
        <button
          type="button"
          className="btn btn--outline whitespace-nowrap"
          onClick={() => router.push("/posts")}
        >
          Reset filters
        </button>
      )}
    </div>
  );
}
