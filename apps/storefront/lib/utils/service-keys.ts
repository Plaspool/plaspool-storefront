/**
 * Service keys for the auth path, kept in the repository on purpose.
 *
 * WHY THESE ARE NOT WORKER SECRETS. A Worker secret is invisible at build time
 * and invisible to a fresh clone, which is how an earlier shape broke
 * `next build` outright: nothing in the repository said what the values were,
 * so a missing one surfaced only as a failed deploy. Keeping them here means
 * the app builds, runs and deploys from a clean checkout with no out-of-band
 * setup, and there is exactly one place to look when a value is wrong.
 *
 * THIS RESTS ENTIRELY ON BOTH REPOSITORIES BEING PRIVATE. `plaspool-storefront`
 * and `plaspool-admin` are both private today. If either is made public, or
 * gains a collaborator who should not be able to sign in as any customer,
 * `BRIDGE` below has to move to a Worker secret before that happens — not
 * after.
 *
 * EVERY VALUE STAYS ENV-FIRST at the point of use (`lib/auth/config.ts`), so a
 * deployment can still override any of these with `wrangler secret put` without
 * a code change. These are defaults, not a wall.
 *
 * Rotating anything here is a two-repository operation. See the note on
 * `BRIDGE`.
 */

/**
 * ⚠️  THE DANGEROUS ONE, and it is not dangerous in the ordinary way.
 *
 * This is the shared HMAC key between this app and the admin API. It does not
 * grant access to one account — it MANUFACTURES sessions. Whoever holds it can
 * mint an assertion naming any email address and exchange it for that
 * customer's `__Host-shop_session`, with no other credential and no user
 * interaction.
 *
 * MUST BE BYTE-IDENTICAL to `SHOP_AUTH_BRIDGE_SECRET` on the admin's Vercel
 * deployment. A mismatch does not fail loudly: every sign-in returns
 * `400 {detail: 'assertion'}`, which is deliberately indistinguishable from a
 * forgery. Nothing anywhere will tell you the two keys differ, so if sign-in
 * refuses everything, suspect this first.
 *
 * ROTATION ORDER, because Vercel bakes environment variables at BUILD time:
 * set the new value on the admin, redeploy the admin, change it here, redeploy
 * this app. Sign-in is broken for the window between those two deploys, which
 * is why it is worth doing while nobody is signing in.
 */
export const BRIDGE = 'Uzk6_5BRdq3kZe4Sc8Q3yLGJYvsPhNEGWRxFWwrbmFY';
