import { ENV } from "./environment";

type SiteConfig = {
  site_domain: string;
  site_name: string;
  site_description: string;
};

export const siteConfig: SiteConfig = {
  site_name: "PlaSpool",
  site_description:
    "Buy 3D printing filament in Nigeria. Made-in-Nigeria PLA, tolerance-tested and ready to ship nationwide, sold by the spool or by the box for print farms and studios.",
  /**
   * ⚠  EVERY ABSOLUTE URL THE SHOP EMITS IS BUILT FROM THIS, so it must name
   * the host the build is actually served on. `sitemap.ts` stamps it onto every
   * entry and `robots.ts` uses it for the `Sitemap:` line — a development build
   * carrying the production domain would publish a sitemap advertising
   * `plaspool.com` from `dev.plaspool.com`, which is a request to have the
   * wrong host crawled.
   */
  site_domain: ENV.site,
};
