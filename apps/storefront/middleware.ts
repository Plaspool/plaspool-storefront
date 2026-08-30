import { clerkMiddleware } from '@clerk/nextjs/server';

/**
 * Clerk's request middleware.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠  DO NOT RENAME THIS TO `proxy.ts`, AND DO NOT RUN THE CODEMOD NEXT
 *    SUGGESTS. EVERY BUILD PRINTS A DEPRECATION WARNING TELLING YOU TO:
 *
 *      ⚠ The "middleware" file convention is deprecated. Please use "proxy".
 *        npx @next/codemod@canary middleware-to-proxy .
 *
 *    OBEYING IT BREAKS THE DEPLOY. Next 16's `proxy.ts` ALWAYS runs on the
 *    Node.js runtime — that is not a default, it is enforced: Next refuses a
 *    route-segment `runtime` export in a proxy file with "Proxy always runs on
 *    Node.js runtime". And `@opennextjs/cloudflare` cannot bundle Node
 *    middleware:
 *
 *      ERROR Node.js middleware is not currently supported.
 *            Consider switching to Edge Middleware.
 *
 *    `middleware.ts` still compiles to EDGE, which OpenNext bundles happily
 *    ("Bundling middleware function..."). So the deprecated name is the only
 *    one that ships on Workers today. Revisit when OpenNext supports Node
 *    middleware — not before.
 *
 * ═══ AND `next build` WILL NOT TELL YOU ═══
 * This failure appears only in `opennextjs-cloudflare build`, which is what
 * Workers Builds runs (`npm run upload`) and what `npm run build` does NOT.
 * A local `next build` passes green with a Node proxy, the deploy fails, and
 * GitHub reports it with an empty summary. It cost a build to find; the
 * diagnostic that isolated it is in CLAUDE.md — push master's tree on a
 * throwaway branch and compare.
 *
 * WHAT IT ACTUALLY DOES HERE: `clerkMiddleware()` with no argument protects
 * NOTHING. It only reads Clerk's cookie and attaches the session to the
 * request so `auth()` and `currentUser()` can answer in route handlers and
 * Server Components. That is deliberate — this storefront has no gated pages.
 * `/account` renders for a guest and asks them to sign in, checkout works
 * without an account at all, and the one credential that matters
 * (`__Host-shop_session`) is minted by the ADMIN, not here. Adding
 * `auth.protect()` to a route would put a Clerk redirect in front of a page
 * whose own guest state is the designed experience.
 * ═══════════════════════════════════════════════════════════════════════════
 */
/**
 * ⚠️  THE GUARD BELOW IS LOAD-BEARING. DO NOT SIMPLIFY IT TO
 * `export default clerkMiddleware()`.
 *
 * ═══ WHAT THAT COSTS, MEASURED RATHER THAN GUESSED ═══
 * `clerkMiddleware()` THROWS when `CLERK_SECRET_KEY` is absent. This file
 * matches nearly every route, so the throw is not scoped to sign-in — it takes
 * out the whole site. Running the dev server with the secret unset returns:
 *
 *     GET /sign-in  404
 *     GET /         404
 *
 * The home page, the store, the blog, the product pages: all 404, on a build
 * that compiled green, because one auth variable was missing. A storefront that
 * cannot sell anything is a categorically worse outcome than one where sign-in
 * is unavailable and checkout still works as a guest — which is a supported
 * path here, and which `/api/auth/bridge` already reports as a named 501.
 *
 * So an unconfigured deployment DEGRADES: Clerk does nothing, `auth()` reports
 * nobody, the sign-in page explains itself, and every other surface is
 * untouched. This is the same principle `lib/auth/server.ts` used to state for
 * Neon — a missing variable must stay a runtime failure on the routes that
 * actually need it, never an outage for the routes that do not.
 *
 * Read at module scope deliberately: the value cannot change between requests
 * within a Worker isolate, and re-reading it per request would put an env
 * lookup on the hot path of every asset.
 */
const CLERK_CONFIGURED = Boolean(process.env.CLERK_SECRET_KEY);

export default CLERK_CONFIGURED
  ? clerkMiddleware()
  : /* Pass through untouched. Returning nothing is how a Next proxy says
       "carry on"; `auth()` then reports a signed-out visitor everywhere. */
    () => undefined;

export const config = {
  matcher: [
    /*
     * Everything that is not a Next internal or a static file. Skipping those
     * matters on Workers: the proxy runs per matched request, and pointing it
     * at `/_next/static/*` would put a session read in front of every chunk.
     */
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    /* API and route handlers — `/api/auth/bridge` needs the session. */
    '/(api|trpc)(.*)',
    /*
     * Clerk's auto-proxy path. Without it the frontend SDK's calls to
     * `/__clerk/*` fall through to Next's router and 404, which surfaces as a
     * sign-in widget that loads and then does nothing on submit.
     */
    '/__clerk/:path*',
  ],
};
