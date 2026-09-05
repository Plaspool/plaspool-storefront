/**
 * WHICH DEPLOYMENT THIS BUILD IS, AND EVERY HOST THAT FOLLOWS FROM IT.
 *
 * The storefront ships twice from one repository: production on
 * `plaspool.com` against `admin.plaspool.com`, and a development environment on
 * `dev.plaspool.com` against `admin.dev.plaspool.com`. Both tables are
 * committed here, in the open, because there is no `.env` in this project and
 * adding one for two hostnames would hide them.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE TARGET IS DERIVED FROM THE BRANCH RATHER THAN WRITTEN DOWN.
 *
 * The obvious shape is a `TARGET` constant flipped per branch — `production`
 * on `master`, `development` on `develop`. It was rejected, and the reason is
 * the merge, not the aesthetics: that one line conflicts on EVERY
 * `develop` -> `master` merge, and resolving it the wrong way once ships
 * production pointed at the development API. Nothing would fail. The build
 * would be green, the site would render, and the shop would be serving a
 * different database's catalogue — a failure that reads as a data outage
 * rather than a config slip, which is the most expensive kind to diagnose.
 *
 * Deriving it from the branch makes that mistake unrepresentable: this file is
 * BYTE-IDENTICAL on every branch, so there is nothing to conflict and nothing
 * to resolve wrongly. `master` cannot ship development config no matter what
 * anyone edits here.
 *
 * ═══ THE DEFAULT IS PRODUCTION, AND THAT DIRECTION IS DELIBERATE ═══
 * An unrecognised or absent branch resolves to `production`, which is exactly
 * what this app did before this file existed — a local `next build`, a
 * `wrangler deploy` from a laptop and a CI run with the variable missing all
 * behave as they always have.
 *
 * The other direction was considered and is worse. Defaulting to
 * `development` means a PRODUCTION build with a broken variable quietly points
 * the live store at the development API: real shoppers, wrong catalogue, wrong
 * prices, orders posted somewhere they will never be fulfilled from. Failing
 * towards production means the worst case is that `dev.plaspool.com` shows
 * production data — visible in one glance, and destructive to nothing.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type Target = "production" | "development";

/**
 * Everything that differs between the two deployments.
 *
 * KEEP THIS EXHAUSTIVE. A value that varies by environment but is not in this
 * table ends up hardcoded at its point of use, which is the state this file
 * exists to end — see the header on `site.ts` for how long
 * `https://plaspool.com` sat inside `siteConfig` describing a host the Worker
 * was not answering on.
 */
export interface Environment {
  /** The storefront's own origin. Absolute URLs in the sitemap are built from it. */
  readonly site: string;
  /**
   * The admin deployment, serving BOTH the blog's public API and the commerce
   * API. One host, which is why `BLOG_API_BASE` and `COMMERCE_API_BASE` both
   * read this field rather than each carrying their own copy.
   */
  readonly api: string;
  /**
   * Whether search engines may index this deployment.
   *
   * Production is the only `true`. `robots.ts` is written to never block a
   * crawler and has a test asserting it; this flag is the one sanctioned
   * exception, so that `dev.plaspool.com` does not enter the index as a second
   * copy of the shop competing with the real one.
   */
  readonly indexable: boolean;
}

/**
 * ⚠  THE HOSTS ARE A REGISTRABLE-DOMAIN PAIR, NOT TWO UNRELATED NAMES.
 *
 * `dev.plaspool.com` and `admin.dev.plaspool.com` share the registrable domain
 * `plaspool.com`, exactly as the production pair does. That is load-bearing for
 * the same reason the long note in `packages/shop/src/data/config.ts` gives:
 * the cart's `__Host-` cookies are same-site rather than third-party, so
 * Safari's tracking prevention does not silently drop them. A development API
 * on some other domain would appear to work and then fail only in the browsers
 * that matter.
 *
 * CORS still applies — same site is not same origin — so the development admin
 * must allow-list `https://dev.plaspool.com` in its `APP_ORIGINS`.
 */
const ENVIRONMENTS: Readonly<Record<Target, Environment>> = {
  production: {
    site: "https://plaspool.com",
    api: "https://admin.plaspool.com",
    indexable: true,
  },
  development: {
    site: "https://dev.plaspool.com",
    api: "https://admin.dev.plaspool.com",
    indexable: false,
  },
};

/** The branch Workers Builds deploys the development environment from. */
const DEVELOPMENT_BRANCH = "develop";

/**
 * Resolve the target from the build environment.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE TWO VARIABLES ARE READ IN THIS ORDER FOR A REASON, AND IT IS THE ONE
 * THING IN THIS FILE THAT IS NOT OBVIOUS.
 *
 * `WORKERS_CI_BRANCH` is set by Cloudflare Workers Builds and exists ONLY in
 * Node during the build. It is invisible in the browser — Next inlines
 * `NEXT_PUBLIC_*` into the client bundle and replaces every other
 * `process.env.X` with `undefined` there.
 *
 * THAT ASYMMETRY IS A TRAP, AND IT IS THE EXPENSIVE KIND. `COMMERCE_API_BASE`
 * is imported by `cart-api.ts`, which runs IN THE BROWSER with
 * `credentials: "include"`. Reading only the branch variable would give a
 * development build a server that knows it is development and a client that
 * resolves to `undefined` and therefore to `production` — so `dev.plaspool.com`
 * would render the development catalogue server-side and then have the shopper's
 * own browser post their cart to the PRODUCTION API. Nothing would look wrong
 * until real orders appeared from a site nobody thought was live.
 *
 * `PLASPOOL_TARGET` is how the answer crosses that boundary. `next.config.ts`
 * calls `resolveTarget()` once in Node, where the branch IS visible, and passes
 * the result through Next's `env` config key — which inlines it as a literal
 * into BOTH bundles. So the client reads a baked string rather than deriving
 * anything, and server and browser cannot disagree.
 *
 * Checked first because during `next.config.ts` evaluation it is not set yet,
 * so the fallback to the branch is what computes it in the first place.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function resolveTarget(env: Record<string, string | undefined> = process.env): Target {
  const explicit = env.NEXT_PUBLIC_PLASPOOL_TARGET;
  if (explicit === "production" || explicit === "development") return explicit;

  return env.WORKERS_CI_BRANCH === DEVELOPMENT_BRANCH ? "development" : "production";
}

/**
 * ⚠  WRITTEN OUT AS A LITERAL `process.env.NEXT_PUBLIC_…` EXPRESSION, AND IT
 *    MUST STAY THAT WAY. THIS LINE IS THE ENTIRE CLIENT-SIDE MECHANISM.
 *
 * A bundler inlines an environment variable by TEXTUALLY replacing the exact
 * source `process.env.NEXT_PUBLIC_PLASPOOL_TARGET` with a string literal before
 * the code ever runs. It cannot see through a function call, a destructure or a
 * parameter default.
 *
 * ═══ THIS SHIPPED BROKEN ONCE, EXACTLY HERE ═══
 * `TARGET` used to be `resolveTarget()`, which reads `env.PLASPOOL_TARGET` off a
 * parameter defaulting to `process.env`. The literal text therefore never
 * appeared in the source, nothing was inlined, and the browser ran the real
 * function against its own `process.env` shim — which carries ONLY
 * `NEXT_PUBLIC_*` — got `undefined` for both variables and fell to
 * `"production"`. The compiled chunk read:
 *
 *   function(e=t.default.env){let r=e.PLASPOOL_TARGET; …return"production"}
 *
 * So `dev.plaspool.com` rendered the development catalogue server-side and then
 * had the shopper's own browser call `admin.plaspool.com/api/shop/customer/me`.
 * The server and the client disagreed about which shop they were — the precise
 * failure the header above describes, delivered by the code written to prevent
 * it. Caught only by opening DevTools and reading a request URL.
 *
 * THE `NEXT_PUBLIC_` PREFIX IS ALSO LOAD-BEARING, and a previous note here
 * claimed the opposite. Next's `env` config key inlines under webpack; this app
 * builds with TURBOPACK, where `NEXT_PUBLIC_` is the guaranteed path. Nobody
 * sets this variable by hand — `next.config.ts` assigns it from the branch
 * before compilation — so the prefix documents its reach, not its origin.
 *
 * `resolveTarget()` is kept for the server, for tests, and as the fallback when
 * nothing was inlined; it is no longer what the browser depends on.
 */
const INLINED = process.env.NEXT_PUBLIC_PLASPOOL_TARGET;

/** The resolved target for this build. */
export const TARGET: Target =
  INLINED === "production" || INLINED === "development" ? INLINED : resolveTarget();

/** Every host and flag this build should be using. */
export const ENV: Environment = ENVIRONMENTS[TARGET];

/**
 * Both tables, for the one caller that needs the environment it is NOT running
 * as: `next.config.ts` builds the Content-Security-Policy, and a policy naming
 * the wrong admin origin blocks every credentialed call the cart makes.
 */
export { ENVIRONMENTS };

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE BROWSER'S CROSS-CHECK: WHICH DEPLOYMENT IS THIS PAGE ACTUALLY ON?
 *
 * Everything above is decided at BUILD time, which is unavoidable — a page
 * prerendered into HTML (`/store`, `/store/all`, `/robots.txt`) is rendered on a
 * machine with no request and no hostname, so the table is the only answer
 * available. That part is correct and stays.
 *
 * But it means the whole arrangement rests on the bundler having inlined a
 * literal, AND THAT ASSUMPTION FAILED ONCE ALREADY — silently, in the direction
 * that matters most. `dev.plaspool.com` served the development catalogue and
 * then had the shopper's own browser POST their cart to the PRODUCTION API.
 * Nothing errored; it took reading a request URL in DevTools to find.
 *
 * A hostname cannot be wrong in that way. The page is being served FROM a host;
 * asking which one is not a derivation that can drift from reality, it IS
 * reality. So in the browser the host decides, and the build-time answer is
 * only the fallback.
 *
 * ⚠  WHAT THIS DELIBERATELY DOES NOT COVER, AND WHY THAT IS FINE.
 * Only the COMMERCE API is resolved this way, because only the commerce API is
 * called from the browser with credentials — the cart, the session exchange,
 * the account, checkout. `site_domain` is NOT: it reaches `layout.tsx`'s
 * metadata and JSON-LD, which are server-rendered into the HTML, and a value
 * that disagreed between server and client there would be a hydration mismatch
 * rather than a fix. The blog API is server-only for the same reason it needs
 * nothing here.
 *
 * ⚠  AN UNKNOWN HOST FALLS BACK TO THE BUILD, IT DOES NOT GUESS. A preview on
 * `*.workers.dev`, a future hostname nobody added here, `localhost` — all of
 * them keep whatever the build decided. Mapping an unknown host to production
 * "because most hosts are" would be exactly the silent wrong answer this exists
 * to remove.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const HOSTS: Readonly<Record<string, Target>> = {
  "plaspool.com": "production",
  /* Redirected to the apex in production, but it costs nothing to be right
     during the hop, and a redirect that ever stops firing should not silently
     change which API the page talks to. */
  "www.plaspool.com": "production",
  "dev.plaspool.com": "development",
};

/**
 * The commerce API for a given hostname, or the build's answer when the host is
 * not one this app knows it is served on.
 *
 * Split from `commerceApiBase()` so it is testable: the suite runs in Node with
 * no `window`, and a parameter is safe here in a way it was NOT safe for
 * `TARGET` — this is resolved at RUNTIME, so nothing needs a bundler to
 * statically replace it.
 */
export function apiBaseForHost(hostname: string | null | undefined): string {
  const target = hostname ? HOSTS[hostname] : undefined;
  return target ? ENVIRONMENTS[target].api : ENV.api;
}

/** The commerce API this page should be talking to. */
export function commerceApiBase(): string {
  return apiBaseForHost(typeof window === "undefined" ? null : window.location.hostname);
}
