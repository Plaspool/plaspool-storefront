import { listTags } from "../data/posts";

import Link from "next/link";

import type { Metadata } from "next";

export const tagsPageMetadata: Metadata = {
  title: "All Tags",
  description: "Browse all tags of our blog posts.",
  alternates: { canonical: "/posts/tags" },
};

export default async function TagsPage() {
  const tags = await listTags().catch(() => []);

  return (
    <div className="blog">
      <div className="blog-shell">
        <header>
          <h1 className="blog-head__title">All Tags</h1>
          <p className="blog-head__sub">Browse posts by tag.</p>
        </header>

        {tags.length === 0 ? (
          <div className="blog-empty">
            <p>No tags found.</p>
          </div>
        ) : (
          <ul className="term-list">
            {tags.map((tag) => (
              <li key={tag.name}>
                <Link className="chip" href={`/posts?tag=${encodeURIComponent(tag.name)}`}>
                  {tag.name}
                  <span className="term-count">{tag.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
