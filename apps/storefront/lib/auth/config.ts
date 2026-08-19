import { BRIDGE, NEON_COOKIE } from '../utils/service-keys';

/**
 * Neon Auth configuration — ONE place that names every value auth needs.
 *
 * Before this file the three values were read as bare `process.env.X!` at their
 * point of use, spread across three route modules. Nothing in the repository
 * said what they were or which were sensitive, so the only way to discover a
 * missing one was a failed deploy — and in one case a failed BUILD, because a
 * module-scope `createNeonAuth` throws when the cookie secret is absent.
 *
 * WHAT IS COMMITTED AND WHAT IS NOT. The base URL is here in full: it is not a
 * secret by any definition — the browser connects to it directly, so it is in
 * the page's network traffic and named in the CSP `connect-src` list. Keeping
 * it in the repository means a fresh clone builds and a deploy needs one fewer
 * piece of out-of-band setup.
 *
 * The two actual secrets fall back to `../utils/service-keys`, which holds them
 * in the repository. That decision, and the condition it depends on — both
 * repositories being private — is argued in that file. Everything here stays
 * env-first, so `wrangler secret put` still overrides either value without a
 * code change.
 */

/**
 * The project's hosted auth endpoint. NOT a secret. Overridable by
 * `NEON_AUTH_BASE_URL` so a preview or a branch database can point elsewhere.
 */
export const NEON_AUTH_BASE_URL =
  process.env.NEON_AUTH_BASE_URL ??
  'https://ep-late-math-ayvz1kdi.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth';

/**
 * Encrypts the first-party Neon session cookie this app sets on its own origin.
 *
 * THIS IS NOT `__Host-shop_session`. It is Neon's cookie, it never leaves this
 * origin, and it is not the credential the admin API trusts — the bridge route
 * translates one into the other.
 *
 * Falls back to `NEON_COOKIE` in `../utils/service-keys`. Override per
 * deployment with `npx wrangler secret put NEON_AUTH_COOKIE_SECRET`.
 */
export const NEON_AUTH_COOKIE_SECRET = process.env.NEON_AUTH_COOKIE_SECRET ?? NEON_COOKIE;

/**
 * ⚠️  THE DANGEROUS ONE. Read before changing how this is stored.
 *
 * The shared HMAC key between this app and the admin API. Whoever holds it can
 * mint an assertion naming ANY email address and exchange it for that
 * customer's `__Host-shop_session` — full account takeover, for every customer,
 * with no other credential and no user interaction. It is not a session token;
 * it is the thing that manufactures session tokens.
 *
 * Falls back to `BRIDGE` in `../utils/service-keys`, which is where the real
 * value and the reasoning both live. The bridge route still checks this before
 * it touches Neon Auth, so an empty override answers `501 not_implemented`
 * rather than crashing.
 *
 *   npx wrangler secret put SHOP_AUTH_BRIDGE_SECRET
 *
 * MUST BE BYTE-IDENTICAL to the admin's `SHOP_AUTH_BRIDGE_SECRET` on Vercel. A
 * mismatch does not fail loudly — every sign-in returns
 * `400 {detail: 'assertion'}`, which is indistinguishable from a forgery by
 * design. Nothing anywhere will tell you the two keys differ, so if sign-in
 * refuses everything, suspect this first.
 *
 * Rotation order, because Vercel bakes environment variables at BUILD time:
 * set the new value on both sides, redeploy the admin, then redeploy this app.
 * Sign-in is broken between those two deploys.
 */
export const AUTH_BRIDGE_SECRET = process.env.SHOP_AUTH_BRIDGE_SECRET ?? BRIDGE;
