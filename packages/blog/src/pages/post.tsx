import { getPostBySlug, imageUrl, listPosts } from "../data/posts";
import { docToText, truncate } from "../data/doc";
import { ArticleTemplate } from "../components/templates";
import { ShareLinks } from "../components/share-links";

import { JsonLd } from "@plaspool/ui";
import { siteConfig } from "@plaspool/brand";

import { notFound } from "next/navigation";

import type { Metadata } from "next";

/**
 * `/posts/<slug>` — the reading view.
 *
 * The page itself decides almost nothing any more: the whole article — head,
 * cover, byline, body, tags — is one of the four ported reading templates,
 * chosen by the post's own `template` field (#15). What stays here is what
 * is not the article: metadata, structured data, and the share row.
 */

/** Absolute form for metadata surfaces that must name a full URL. */
function absoluteImage(url: string): string {
  return new URL(imageUrl(url), siteConfig.site_domain).toString();
}

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
  const image = post.coverImage ? absoluteImage(post.coverImage.url) : undefined;

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
    // Absolute on purpose: `imageUrl()` now emits the site-relative proxy
    // path, and structured-data consumers resolve nothing.
    ...(post.coverImage ? { image: absoluteImage(post.coverImage.url) } : {}),
  };

  return (
    <div className="blog">
      {/* `headline`, `description` and `author.name` are CMS-authored, so
          this block must never be hand-injected — see `JsonLd`. */}
      <JsonLd data={jsonLd} />

      <ArticleTemplate post={post} />

      <div className="blog-share">
        <ShareLinks title={post.title} slug={post.slug} />
      </div>
    </div>
  );
}
