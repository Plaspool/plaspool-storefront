import { listTags } from "../data/posts";
import { Section, Container, Prose } from "@plaspool/ui";

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
    <Section>
      <Container className="space-y-8">
        <Prose className="mb-8">
          <h1 className="mb-2">All Tags</h1>
          <p className="text-muted-foreground">
            Browse posts by tag.
          </p>
        </Prose>

        {tags.length === 0 ? (
          <div className="h-24 w-full border rounded-lg bg-accent/25 flex items-center justify-center">
            <p className="text-muted-foreground">No tags found.</p>
          </div>
        ) : (
          <ul className="grid gap-2">
            {tags.map((tag) => (
              <li key={tag.name}>
                <Link href={`/posts?tag=${encodeURIComponent(tag.name)}`}>
                  {tag.name} ({tag.count})
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </Section>
  );
}
