import type { NextConfig } from "next";

/**
 * Third-party origins the storefront actually talks to. Named here rather than
 * inlined so the policy below reads as a list of decisions, and so adding a
 * vendor is one edit in one place.
 */
const BLOG_API = "https://blog-admin-app-gold.vercel.app";
/** Cover images 302 from the blog API to a presigned account-scoped R2 host. */
const R2 = "https://*.r2.cloudflarestorage.com";
const WAITLISTER = "https://waitlister.me";
const GTM = "https://www.googletagmanager.com";
const GA = ["https://www.google-analytics.com", "https://*.analytics.google.com"];
const VERCEL_INSIGHTS = "https://vitals.vercel-insights.com";
/**
 * Clerk, which replaced Neon Auth.
 *
 * ═══ WHY THIS IS THREE ENTRIES AND NOT ONE ═══
 * Clerk serves its frontend SDK and its API from an instance-specific host,
 * and that host is DIFFERENT between environments: `clerk.plaspool.com` once
 * the production instance is attached to the domain, and a generated
 * `*.clerk.accounts.dev` subdomain for development instances. Both are listed
 * so a preview build and production share one policy — an origin nobody is
 * using costs nothing, whereas a missing one is a sign-in page that loads and
 * then silently refuses to submit.
 *
 * Clerk's script is fetched AND called, so these belong in `script-src` and
 * `connect-src` alike. Google's OAuth redirect is a top-level navigation
 * rather than a `fetch`, so it still needs nothing here.
 */
const CLERK = "https://clerk.plaspool.com https://*.clerk.accounts.dev";
/** Avatars Clerk hosts for accounts that have one — `img-src` only. */
const CLERK_IMG = "https://img.clerk.com";
/**
 * Cloudflare Turnstile, which Clerk mounts in an iframe for its bot-protection
 * challenge. Absent from `frame-src`, the challenge renders blank and sign-up
 * cannot be completed — with nothing in the console pointing at the frame.
 */
const TURNSTILE = "https://challenges.cloudflare.com";

/**
 * Content-Security-Policy — REPORT-ONLY for now.
 *
 * Shipped unenforced on purpose. A CSP written from reading the source is a
 * hypothesis: the vendor scripts here (GA4, the Waitlister embed) redirect and
 * chain-load at runtime in ways the repo does not spell out. Report-Only puts
 * the policy in front of real traffic so the violations show up in the browser
 * console before they can break a page. Flip the header name to
 * `Content-Security-Policy` once a period of real traffic is clean.
 *
 * `script-src` carries `'unsafe-inline'` and it is not decoration:
 *
 *   - Next's App Router inlines its hydration bootstrap and streams further
 *     inline `<script>` chunks as the RSC payload arrives. Nonce-ing those
 *     needs a per-request nonce from middleware, which forces every route to
 *     render dynamically — that would cost this app its ISR (300s lists,
 *     3600s post detail), which is most of what keeps it inside the Workers
 *     CPU budget. See the companion `/store/all` resource-limit issue.
 *   - The GA4 init block in `packages/web/src/consent/analytics.tsx` is inline.
 *
 * So this is a considered trade, not an oversight: no nonce until the app can
 * afford dynamic rendering. `object-src 'none'`, `base-uri 'self'` and
 * `form-action 'self'` are what still carry weight with inline allowed, and
 * the JSON-LD escaping fix is the actual defence against injected script —
 * CSP is the second layer, not the first.
 *
 * `style-src` allows inline for Tailwind's runtime-injected styles and
 * `next/font`'s critical CSS, which have the same nonce problem.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${WAITLISTER} ${GTM} ${CLERK} ${TURNSTILE}`,
  "style-src 'self' 'unsafe-inline'",
  // `data:` for the engine's generated textures, `blob:` for canvas readback.
  `img-src 'self' data: blob: ${BLOG_API} ${R2} ${GTM} ${GA[0]} ${CLERK_IMG}`,
  // next/font self-hosts Inter at build time, so no external font origin.
  "font-src 'self' data:",
  `connect-src 'self' ${BLOG_API} ${R2} ${WAITLISTER} ${GTM} ${GA.join(" ")} ${VERCEL_INSIGHTS} ${CLERK}`,
  // The /shop waitlist is an iframe embed; Turnstile is Clerk's bot challenge.
  `frame-src 'self' ${WAITLISTER} ${TURNSTILE}`,
  /*
   * Clerk instantiates a Web Worker from a blob to refresh its session token
   * off the main thread. Without `blob:` here the worker is refused and the
   * session silently stops refreshing — the shopper is signed out at the next
   * token expiry rather than at sign-out.
   */
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // The modern half of X-Frame-Options, which stays below for older clients.
  // Note this one is REPORTED, not applied, while the header is Report-Only —
  // X-Frame-Options is what is actually refusing frames today.
  "frame-ancestors 'self'",
  // `upgrade-insecure-requests` is deliberately absent. It is ignored in a
  // report-only policy and browsers log an error saying so on every page load,
  // which would bury the real violation reports this header exists to collect.
  // Add it back in the same commit that flips the header to enforcing.
  // Until then HSTS is what keeps the connection off plain HTTP.
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  /**
   * A year, now that logins are live.
   *
   * HSTS is a promise the browser holds you to: it will refuse plain HTTP to
   * this host for the whole `max-age` and there is no way to reach the people
   * already carrying the header to retract it early. The short `max-age=86400`
   * stood until sign-in and checkout carried real credentials and payment
   * detail across this origin — logins are that trigger, and a year is the
   * standard duration once a domain is serving HTTPS cleanly and staying that
   * way is worth committing to.
   *
   * Do NOT add `preload` — that ships the domain into a browser-baked list and
   * is effectively irreversible.
   */
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy-Report-Only", value: CSP },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@plaspool/ui", "@plaspool/brand", "@plaspool/web", "@plaspool/blog", "@plaspool/shop"],
  experimental: {
    // Barrel-export packages pulled in wholesale via transpilePackages inflate
    // First Load JS on every route that imports from them; this makes Next
    // trace and tree-shake the actual imports instead of the full re-export.
    optimizePackageImports: ["@plaspool/ui", "@plaspool/brand", "@plaspool/web", "@plaspool/blog", "@plaspool/shop"],
  },
  images: {
    // Cloudflare Workers has no sharp, so on-the-fly optimisation is not
    // available there. This is not currently a loss: no code path passes a
    // remote URL to next/image today — blog covers use a plain <img> with an
    // explicit @next/next/no-img-element disable (see packages/blog), and
    // next/image only appears in packages/web/src/pages/landing.tsx with
    // local, build-time-known assets. If a future blog cover switches to
    // next/image, it will need this loader disabled or a custom loader —
    // there is no remote pattern configured to fall back on.
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.plaspool.com",
          },
        ],
        destination: "https://plaspool.com/:path*",
        permanent: true,
      }
    ];
  },
};

export default nextConfig;
