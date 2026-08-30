/**
 * Clerk's PUBLISHABLE key — public by design, and committed on purpose.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS NOT A SECRET, AND WHY IT IS NOT AN ENVIRONMENT VARIABLE EITHER.
 *
 * A publishable key identifies the Clerk instance to the BROWSER. It is
 * compiled into the client bundle, served to every visitor, and readable with
 * View Source. It authorises nothing on its own — `CLERK_SECRET_KEY` is the one
 * that does, and that one is a Worker secret and must stay one.
 *
 * It lived in `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and that is precisely how it
 * broke production:
 *
 *   `NEXT_PUBLIC_*` IS INLINED BY `next build`. On Cloudflare, Workers Builds
 *   keeps BUILD variables separate from RUNTIME secrets, and a value set only
 *   as a runtime secret is invisible to the build. The bundle then ships with
 *   nothing in its place, Clerk's frontend SDK never initialises, and the
 *   sign-in page renders perfectly and does nothing. The build is green
 *   throughout. Confirmed on the live Worker: the key was absent from all 16
 *   deployed chunks.
 *
 * There is also no `wrangler` command for build variables — they are dashboard
 * configuration — so the failure could not even be fixed from this repository.
 *
 * Committing it removes the whole class of failure: a fresh clone builds, a
 * preview builds, and production builds, with no out-of-band setup and nothing
 * to forget. This is the same argument `NEON_AUTH_BASE_URL` made in
 * `config.ts` — "not a secret by any definition — the browser connects to it
 * directly" — applied to its successor.
 *
 * ═══ ITS OWN FILE, AWAY FROM `service-keys.ts` ═══
 * That module holds `BRIDGE`, which manufactures customer sessions. This value
 * is deliberately handed to a Server Component and serialised into the RSC
 * payload, so it must not sit in a module a careless refactor could drag toward
 * the client alongside something that must never go there.
 *
 * STILL ENV-FIRST, so a preview or a second Clerk instance can override it
 * without a code change.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const CLERK_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? 'pk_live_Y2xlcmsucGxhc3Bvb2wuY29tJA';
