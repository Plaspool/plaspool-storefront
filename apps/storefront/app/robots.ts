import type { MetadataRoute } from "next";
import { siteConfig } from "@plaspool/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteConfig.site_domain}/sitemap.xml`,
  };
}
