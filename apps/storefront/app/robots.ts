import type { MetadataRoute } from "next";
import { siteConfig } from "@plaspool/brand";

/**
 * `/robots.txt` — crawl policy.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ THIS FILE MUST NEVER BLOCK A SEARCH ENGINE, AND THAT IS THE WHOLE POINT
 *   OF WRITING IT OUT RATHER THAN REACHING FOR A BLOCKLIST OFF THE INTERNET.
 *
 * This storefront exists to be found. `app/layout.tsx` carries the keyword set,
 * the JSON-LD `OnlineStore` block and the OpenGraph metadata; `app/sitemap.ts`
 * advertises every post. A rule that catches Googlebot or Bingbot in a general
 * sweep would cost the shop its customers to save it some CPU, which is a trade
 * nobody wants and one that is invisible until traffic has already gone.
 *
 * So the blocklist below is EXPLICIT AND NAMED. Nothing here is a wildcard over
 * user agents, no rule is `Disallow: /` for `*`, and `robots.test.ts` asserts
 * that the major search crawlers are never caught by any rule in this file.
 *
 * ═══ WHAT THIS DOES AND DOES NOT FIX ═══
 * ROBOTS.TXT IS ADVISORY. It is a request, not an access control. Well-behaved
 * crawlers honour it; the ones generating the most load are frequently the ones
 * that do not — Bytespider has been widely documented ignoring it outright.
 *
 * That means this file reduces load from the polite majority and DOES NOTHING
 * to a scraper that lies about its user agent. The enforcement counterpart is
 * Cloudflare-side and cannot live in this repository: Bot Fight Mode (free) on
 * the zone, plus a WAF rate-limiting rule if a specific agent keeps coming
 * back. Treat this file as the first of two layers, never the only one.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Paths with nothing to index and a real cost to render.
 *
 * Everything under `/account` is `force-dynamic` and cookie-gated, so a crawler
 * gets a signed-out shell for a full dynamic render — the most expensive
 * possible response with the least possible value. `/dev/*` are internal
 * harness pages that should never have been discoverable at all. `/checkout`
 * and `/cart` are states, not documents, and `/checkout/complete` additionally
 * takes a payment reference in its query string that has no business in an
 * index.
 */
const PRIVATE_PATHS = [
  "/account",
  "/api/",
  "/cart",
  "/checkout",
  "/dev/",
  /* The uncached mirror of the catalogue. Every page under it is a duplicate
     of one already indexed under /store, rendered on demand rather than served
     from KV — so letting a crawler walk it would buy duplicate content with
     Worker invocations. The pages carry `noindex` as well; this keeps a
     crawler from spending the render to find that out. */
  "/preview/",
  "/sign-in",
];

/**
 * Crawlers that train models or feed datasets.
 *
 * Grouped separately from the SEO tools below because the reasoning differs:
 * these are not wrong to exist, they simply return nothing to a shop selling
 * filament in Lagos while costing it Worker invocations per page.
 *
 * NOTE THE `-Extended` PAIRS. `Google-Extended` and `Applebot-Extended` control
 * ONLY training corpus inclusion — blocking them does not affect Googlebot's
 * ranking or Applebot's Siri/Spotlight indexing, which is why the plain agents
 * are deliberately absent from this list.
 *
 * `OAI-SearchBot` is ALSO deliberately absent: it powers ChatGPT's cited search
 * results, so blocking it forfeits referral traffic rather than saving waste.
 * `GPTBot` (training) and `ChatGPT-User` (per-request fetches) are the ones
 * that cost without returning, and they are named.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
  "FacebookBot",
  "PerplexityBot",
  "Diffbot",
  "Omgilibot",
  "ImagesiftBot",
  "YouBot",
  "cohere-ai",
  "Timpibot",
];

/**
 * Backlink and rank-tracking crawlers.
 *
 * These serve somebody else's dashboard. They are worth naming separately
 * because they are typically the heaviest crawlers a small site ever sees —
 * they re-crawl aggressively to keep a link graph fresh — and the site owner
 * gets nothing unless they are personally a customer of the tool.
 *
 * If a tool here is ever subscribed to, delete that one line. Blocking the
 * crawler also blocks the audit you paid for.
 */
const SEO_CRAWLERS = [
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "rogerbot",
  "DataForSeoBot",
  "BLEXBot",
  "Barkrowler",
  "serpstatbot",
  "ZoominfoBot",
  "SeekportBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      /*
       * Everyone else, INCLUDING every search engine. Allowed everywhere the
       * shop is meant to be found, kept out of the states and the internals.
       *
       * `crawlDelay` is honoured by Bing, Yandex and Seznam and ignored by
       * Google, which paces itself from Search Console instead. Ten seconds is
       * chosen against how little there is to crawl — a handful of static
       * pages, one product, a blog — not against a cadence anyone needs.
       */
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
        crawlDelay: 10,
      },
      {
        userAgent: [...AI_CRAWLERS, ...SEO_CRAWLERS],
        disallow: "/",
      },
    ],
    sitemap: `${siteConfig.site_domain}/sitemap.xml`,
  };
}
