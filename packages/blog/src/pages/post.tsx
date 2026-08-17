import { getPostBySlug, imageUrl, listPosts } from "../data/posts";
import { docToText, truncate } from "../data/doc";
import { DocRenderer } from "../components/doc-renderer";

import { ShareLinks } from "../components/share-links";

import { Section, Container, Article, Prose, JsonLd, badgeVariants, cn } from "@plaspool/ui";
import { siteConfig } from "@plaspool/brand";

import Link from "next/link";
import Balancer from "react-wrap-balancer";
import { notFound } from "next/navigation";

import type { Metadata } from "next";

export async function postMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  const description = post.excerpt || truncate(docToText(post.content));
  const url = `${siteConfig.site_domain}/posts/${post.slug}`;
  const image = post.coverImage ? imageUrl(post.coverImage.url) : undefined;

  return {
    title: post.title,
    description,
    alternates: { canonical: `/posts/${post.slug}` },
    openGraph: {
      title: post.title,
      description,
      type: "article",
      url,
      publishedTime: new Date(post.publishedAt).toISOString(),
      modifiedTime: new Date(post.updatedAt).toISOString(),
      authors: [post.author.name],
      ...(image ? { images: [{ url: image, alt: post.coverImage!.alt || post.title }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: post.title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export async function postParams(): Promise<{ slug: string }[]> {
  try {
    const { items } = await listPosts({ limit: 50 });
    return items.map((post) => ({ slug: post.slug }));
  } catch {
    // The blog may be empty or unreachable at build time. Pages render on
    // demand instead; failing the build over it would be worse.
    return [];
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const date = new Date(post.publishedAt).toLocaleDateString("en-NG", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || truncate(docToText(post.content)),
    datePublished: new Date(post.publishedAt).toISOString(),
    dateModified: new Date(post.updatedAt).toISOString(),
    author: { "@type": "Person", name: post.author.name },
    publisher: {
      "@type": "Organization",
      name: "PlaSpool",
      logo: { "@type": "ImageObject", url: `${siteConfig.site_domain}/brand/icon.png` },
    },
    mainEntityOfPage: `${siteConfig.site_domain}/posts/${post.slug}`,
    ...(post.coverImage ? { image: imageUrl(post.coverImage.url) } : {}),
  };

  return (
    <Section className="font-mono text-gray-800 bg-gray-50">
      <Container>
        {/* `headline`, `description` and `author.name` are CMS-authored, so
            this block must never be hand-injected — see `JsonLd`. */}
        <JsonLd data={jsonLd} />
        <Prose>
          <h1>
            <Balancer>
              <span className="font-mono">{post.title}</span>
            </Balancer>
          </h1>
          {post.subtitle && <p className="text-lg text-gray-600">{post.subtitle}</p>}
          <div className="flex font-mono justify-between items-center gap-4 text-sm mb-4">
            <h5>
              Published {date} by {post.author.name} · {post.readingTime} min read
            </h5>
            {post.category && (
              <Link
                href={`/posts?category=${encodeURIComponent(post.category)}`}
                className={cn(badgeVariants({ variant: "outline" }), "!no-underline text-gray-800")}
              >
                {post.category}
              </Link>
            )}
          </div>
          {post.coverImage && (
            <div className="h-full my-12 md:h-[500px] overflow-hidden flex items-center justify-center border rounded-lg bg-accent/25">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="w-full h-full object-cover my-0"
                style={{ objectPosition: post.coverImage.focalPoint || undefined }}
                src={imageUrl(post.coverImage.url)}
                alt={post.coverImage.alt || post.title}
              />
            </div>
          )}
        </Prose>

        <Article className="font-mono">
          <DocRenderer doc={post.content} />
        </Article>

        <ShareLinks title={post.title} slug={post.slug} />
      </Container>
    </Section>
  );
}
