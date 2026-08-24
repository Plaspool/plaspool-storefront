import { listCategories } from "../data/posts";

import { Link } from "../components/link";

import type { Metadata } from "next";

export const categoriesPageMetadata: Metadata = {
  title: "All Categories",
  description: "Browse all categories of our blog posts.",
  alternates: { canonical: "/posts/categories" },
};

export default async function CategoriesPage() {
  const categories = await listCategories().catch(() => []);

  return (
    <div className="blog">
      <div className="blog-shell">
        <header>
          <h1 className="blog-head__title">All Categories</h1>
          <p className="blog-head__sub">Browse posts by category.</p>
        </header>

        {categories.length === 0 ? (
          <div className="blog-empty">
            <p>No categories found.</p>
          </div>
        ) : (
          <ul className="term-list">
            {categories.map((category) => (
              <li key={category.name}>
                <Link
                  className="chip"
                  href={`/posts?category=${encodeURIComponent(category.name)}`}
                >
                  {category.name}
                  <span className="term-count">{category.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
