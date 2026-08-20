import Link from "next/link";

/**
 * The category row — "All" plus one chip per category, as LINKS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS NOT THE `FilterPosts` DROPDOWNS.
 *
 * `filter.tsx` is a client component wrapping two shadcn `Select`s and a
 * router push. That is the right control for the ADMIN, where a category is
 * one of several filters being combined against a work queue. A reader is
 * browsing: they want to see the categories that exist, and land in one.
 * A dropdown hides the options behind a click and makes the answer to "what
 * is this blog about" a thing you have to go looking for.
 *
 * AND IT IS A SERVER COMPONENT AGAIN. Links, not handlers, so there is no
 * client bundle for this row at all, each chip is a real URL a reader can
 * open in a new tab or share, and the current category survives a reload
 * because it was never component state to begin with.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface CategoryChipsProps {
  categories: string[];
  selected?: string;
  /** Carried through so choosing a category does not silently drop the
   *  reader's search term. `tag` is deliberately NOT carried — see below. */
  search?: string;
}

export function CategoryChips({ categories, selected, search }: CategoryChipsProps) {
  if (categories.length === 0) return null;

  /*
   * A tag is dropped when a category is chosen, on purpose. Tags cross
   * categories, so the intersection is very often empty — and "No posts
   * found" immediately after clicking a category reads as the category being
   * broken rather than as two filters colliding. Choosing a category is a
   * fresh start within that category.
   */
  const href = (category?: string) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search) params.set("search", search);
    const q = params.toString();
    return q ? `/posts?${q}` : "/posts";
  };

  return (
    <nav className="cat-row" aria-label="Post categories">
      <Link
        href={href()}
        className={`cat-chip${selected ? "" : " is-on"}`}
        aria-current={selected ? undefined : "page"}
      >
        All
      </Link>
      {categories.map((c) => (
        <Link
          key={c}
          href={href(c)}
          className={`cat-chip${c === selected ? " is-on" : ""}`}
          aria-current={c === selected ? "page" : undefined}
        >
          {c}
        </Link>
      ))}
    </nav>
  );
}
