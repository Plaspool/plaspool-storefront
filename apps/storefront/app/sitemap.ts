import { MetadataRoute } from "next";
import { listPosts } from "@plaspool/blog";
import { siteConfig } from "@plaspool/brand";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { items: posts } = await listPosts({ limit: 100 }).catch(() => ({
    items: [],
    nextCursor: null,
  }));

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: `${siteConfig.site_domain}`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 1,
    },
    {
      url: `${siteConfig.site_domain}/posts`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteConfig.site_domain}/posts/categories`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteConfig.site_domain}/posts/tags`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteConfig.site_domain}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteConfig.site_domain}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const postUrls: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${siteConfig.site_domain}/posts/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticUrls, ...postUrls];
}

// Must match DETAIL_REVALIDATE in packages/blog/src/data/config.ts.
// Next.js requires route segment config to be a statically analysable
// literal, so this cannot import the constant.
export const revalidate = 3600;
