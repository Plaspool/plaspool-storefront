import { TARGET, type Target } from '@plaspool/brand/environment';

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
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠  ONE PER ENVIRONMENT, AND THEY MUST NOT BE SHARED. THIS IS THE WHOLE
 *    REASON THIS IS A TABLE RATHER THAN A STRING.
 *
 * Everything the note above says about what this key does — it MANUFACTURES
 * sessions for any email address, with no other credential — is why production
 * and development cannot use the same one. Share it, and the value committed
 * for the development environment is a working production account-takeover key
 * for every customer. The development environment is by nature the looser of
 * the two: more branches deploy to it, more people have reason to poke at it,
 * and its admin is not guarded like the real one.
 *
 * Separate values mean a compromise of the development environment stops at
 * the development database.
 *
 * ⚠  EACH VALUE MUST BE BYTE-IDENTICAL TO ITS OWN ADMIN'S
 *    `SHOP_AUTH_BRIDGE_SECRET`:
 *
 *      production   <->  admin.plaspool.com
 *      development  <->  admin.dev.plaspool.com
 *
 * A mismatch does not fail loudly. Every sign-in returns
 * `400 {detail: 'assertion'}`, deliberately indistinguishable from a forgery,
 * and nothing anywhere will tell you the two differ. If sign-in on ONE
 * environment refuses everything while the other is fine, this table is the
 * first place to look — it means that environment's admin has not been given
 * its half.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const BRIDGE_KEYS: Record<Target, string> = {
  production: 'Uzk6_5BRdq3kZe4Sc8Q3yLGJYvsPhNEGWRxFWwrbmFY',
  /*
   * INSTALLED ON `admin.dev.plaspool.com` AND CONFIRMED AGAINST IT. This note
   * used to say the opposite — that the development admin had not been given
   * its half yet, so every sign-in there would answer `400 {detail:
   * 'assertion'}`. That was true when the key was generated and is no longer,
   * and a stale warning here is expensive: it names a plausible cause for a
   * broken sign-in that is not the actual one, and the real fault the day this
   * was corrected lay somewhere else entirely (`CLERK_SECRET_KEY` missing on
   * the development Worker, which answers `501 not_implemented` instead).
   *
   * ═══ HOW TO RE-CHECK IT WITHOUT MINTING A SESSION ═══
   * The obvious test — sign in and see — needs a browser and a Clerk account,
   * and a working assertion IS an account takeover for the email it names, so
   * it is not something to generate casually.
   *
   * There is a safe discriminator. The admin's `verifyAssertion`
   * (`server/shop/cart/identity/bridge.ts`) checks the MAC BEFORE it checks
   * expiry, so sign a payload whose `exp` is already in the past and POST it to
   * `/api/shop/customer/session/exchange`. It cannot create anything, and the
   * rejection says which half failed:
   *
   *   400 {detail: 'assertion_expired'}  -> the MAC verified. Keys MATCH.
   *   400 {detail: 'assertion'}          -> the MAC failed.  Keys DIFFER.
   *
   * Send `Origin: https://dev.plaspool.com` with it, or the origin guard
   * answers 403 first and both cases look identical.
   */
  development: 'ZOeinw-rmsZG7mRLm8oq6qY9vWS5MlrX-byrEeFLF24',
};

export const BRIDGE = BRIDGE_KEYS[TARGET];
