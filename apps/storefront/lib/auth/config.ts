import { BRIDGE } from '../utils/service-keys';

/**
 * Auth configuration — ONE place that names every value auth needs.
 *
 * Before this file the values were read as bare `process.env.X!` at their point
 * of use, spread across three route modules. Nothing in the repository said
 * what they were or which were sensitive, so the only way to discover a missing
 * one was a failed deploy.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CLERK REPLACED NEON AUTH, AND THE TWO CLERK KEYS ARE **NOT** COMMITTED.
 *
 * `../utils/service-keys` argues at length for keeping this app's own secrets
 * in a private repository. That argument does not extend to Clerk's keys, for a
 * reason worth stating rather than assuming:
 *
 *   - They are a THIRD PARTY'S credential, rotated in Clerk's dashboard rather
 *     than by editing this repository. A committed copy goes stale silently the
 *     first time somebody rotates it there, and the failure looks like an
 *     outage rather than a stale constant.
 *   - `CLERK_SECRET_KEY` authenticates this app to Clerk's Backend API for
 *     EVERY user in the instance. That is a wider blast radius than `BRIDGE`,
 *     which at least stops at this one commerce database.
 *
 * So both are env-only and there is no fallback. A missing one is a loud
 * runtime failure on the routes that need it, which is the correct outcome —
 * see `bridge/route.ts` for how that failure is reported.
 *
 * WHERE THEY COME FROM ON CLOUDFLARE, AND WHY THE TWO ARE SET DIFFERENTLY:
 *
 *   CLERK_SECRET_KEY                    -> `wrangler secret put`, or a
 *                                          Workers Builds secret. Runtime only.
 *                                          Never reaches the browser.
 *   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   -> MUST be a **build** variable in
 *                                          Workers Builds, not only a runtime
 *                                          secret.
 *
 * ⚠  THAT SECOND ONE IS THE TRAP. `NEXT_PUBLIC_*` is inlined into the client
 * bundle by `next build`. A value that exists only as a Worker secret is
 * invisible at build time, so the bundle ships with `undefined` baked in and
 * Clerk's frontend SDK never initialises — the sign-in page renders, the
 * buttons do nothing, and the build was green the whole way. If sign-in is
 * inert in production but fine locally, check this before anything else.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Clerk's server-side key. Absent means the bridge cannot verify anybody, so
 * `bridge/route.ts` answers a named 501 rather than crashing.
 */
export const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? '';

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
 * it touches Clerk, so an empty override answers `501 not_implemented` rather
 * than crashing.
 *
 *   npx wrangler secret put SHOP_AUTH_BRIDGE_SECRET
 *
 * MUST BE BYTE-IDENTICAL to the admin's `SHOP_AUTH_BRIDGE_SECRET` on Vercel. A
 * mismatch does not fail loudly — every sign-in returns
 * `400 {detail: 'assertion'}`, which is indistinguishable from a forgery by
 * design. Nothing anywhere will tell you the two keys differ, so if sign-in
 * refuses everything, suspect this first.
 *
 * UNCHANGED BY THE MOVE TO CLERK, and that is the point: the admin verifies
 * this HMAC and then resolves the customer BY EMAIL
 * (`findOrCreateCustomerByEmail`). It never learns which identity provider
 * minted the session, so swapping Neon Auth for Clerk needed no admin-side
 * change and no customer lost their orders.
 */
export const AUTH_BRIDGE_SECRET = process.env.SHOP_AUTH_BRIDGE_SECRET ?? BRIDGE;
