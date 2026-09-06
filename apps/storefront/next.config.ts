import type { NextConfig } from "next";
import { ENVIRONMENTS, resolveTarget } from "@plaspool/brand/environment";

/**
 * WHICH DEPLOYMENT THIS BUILD IS. Resolved exactly once, here, in Node — where
 * `WORKERS_CI_BRANCH` is visible — and handed to the rest of the app by the
 * assignment below. `packages/brand/src/environment.ts` carries the full
 * argument for why it is derived rather than written down, and for why the
 * client must be told the answer instead of computing it.
 */
const TARGET = resolveTarget();
const ENV = ENVIRONMENTS[TARGET];

/**
 * ⚠  ASSIGNED BEFORE THE BUILD READS IT. THIS IS WHAT REACHES THE BROWSER.
 *
 * `next.config.ts` is evaluated in Node before compilation starts, so mutating
 * `process.env` here is visible to the bundler when it inlines
 * `NEXT_PUBLIC_*` — which is how `packages/brand/src/environment.ts` gets a
 * literal instead of a lookup. Setting it here rather than in the environment
 * keeps the promise that nobody configures this: the branch decides, and this
 * line carries the decision across the server/client boundary.
 *
 * DO NOT REPLACE THIS WITH THE `env` CONFIG KEY. That is what was here first,
 * and it does not inline into the client bundle under Turbopack — which this
 * app builds with. The result was a development site whose browser called the
 * production API; the long note in `environment.ts` has the compiled evidence.
 */
process.env.NEXT_PUBLIC_PLASPOOL_TARGET = TARGET;

/**
 * Third-party origins the storefront actually talks to. Named here rather than
 * inlined so the policy below reads as a list of decisions, and so adding a
 * vendor is one edit in one place.
 */
/**
 * The admin API, which serves BOTH the blog and the commerce endpoints — one
 * deployment, one host, named once here.
 *
 * ⚠  IT IS ALSO `COMMERCE_API_BASE`. The cart, the session exchange and the
 * account all talk to this origin FROM THE BROWSER with `credentials:
 * "include"`, so a stale value here does not merely break blog covers — it
 * blocks every credentialed call in `connect-src` and the shop reports
 * "We couldn't load your cart" with nothing saying why.
 *
 * IT USED TO SAY "change it here, `packages/blog/src/data/config.ts` and
 * `packages/shop/src/data/config.ts` together, or not at all" — three copies
 * kept in step by hand. All three now read one table
 * (`packages/brand/src/environment.ts`), so there is one place to change and
 * the three cannot drift apart.
 */
const BLOG_API = ENV.api;
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
 * OpenStreetMap's geocoder, which the checkout's "Fill in from my location"
 * button calls FROM THE BROWSER with the device's fix — `connect-src` only.
 * `packages/shop/src/checkout/address-autofill.ts` carries the usage policy
 * that call keeps to.
 */
const NOMINATIM = "https://nominatim.openstreetmap.org";

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
  `connect-src 'self' ${BLOG_API} ${R2} ${WAITLISTER} ${GTM} ${GA.join(" ")} ${VERCEL_INSIGHTS} ${CLERK} ${NOMINATIM}`,
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
  /**
   * `geolocation=(self)`, NOT `()`. The checkout asks for the device's
   * position — the address fill, and the rider's spot when the config offers
   * it — and `()` refuses the call to this origin's own scripts, not only to
   * frames; the button then fails as if the shopper had said no. Camera and
   * microphone stay closed: nothing here asks.
   */
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
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
  /**
   * ⚠  THE HALF OF THE NOINDEX PAIR THAT ACTUALLY PREVENTS INDEXING.
   *
   * `app/robots.ts` serves `Disallow: /` on every non-production deployment,
   * and that stops a crawler FETCHING a page — it does not stop the URL being
   * indexed from a link elsewhere, which Google does routinely, listing the
   * bare URL with no snippet. `noindex` is the directive that removes it.
   *
   * The two only work together: `noindex` alone would be invisible to a
   * crawler that robots.txt kept away from the page carrying it, and
   * `Disallow` alone leaves the URL indexable. Change one, change the other.
   *
   * Spread rather than pushed so the array stays a flat list of decisions.
   */
  ...(ENV.indexable
    ? []
    : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]),
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
  /**
   * PRODUCTION ONLY, and the reason is `permanent: true`.
   *
   * A 308 is cached by the browser more or less forever. The rule is inert on
   * `dev.plaspool.com` today — nothing resolves `www.plaspool.com` to the
   * development Worker — but shipping a permanent redirect to the production
   * origin from a build that is not production is a loaded gun: the day
   * anything points a `www.` host at this Worker, every visitor is bounced to
   * production and pinned there by their own cache.
   */
  async redirects() {
    if (TARGET !== "production") return [];

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
