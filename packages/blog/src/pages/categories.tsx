import { listCategories } from "../data/posts";
import { Section, Container, Prose } from "@plaspool/ui";

import Link from "next/link";

import type { Metadata } from "next";

export const categoriesPageMetadata: Metadata = {
  title: "All Categories",
  description: "Browse all categories of our blog posts.",
  alternates: { canonical: "/posts/categories" },
};

export default async function CategoriesPage() {
  const categories = await listCategories().catch(() => []);

  return (
    <Section>
      <Container className="space-y-8">
        <Prose className="mb-8">
          <h1 className="mb-2">All Categories</h1>
          <p className="text-muted-foreground">
            Browse posts by category.
          </p>
        </Prose>

        {categories.length === 0 ? (
          <div className="h-24 w-full border rounded-lg bg-accent/25 flex items-center justify-center">
            <p className="text-muted-foreground">No categories found.</p>
          </div>
        ) : (
          <ul className="grid gap-2">
            {categories.map((category) => (
              <li key={category.name}>
                <Link href={`/posts?category=${encodeURIComponent(category.name)}`}>
                  {category.name} ({category.count})
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </Section>
  );
}
