import { auth, currentUser } from '@clerk/nextjs/server';
import { AUTH_BRIDGE_SECRET, CLERK_SECRET_KEY } from '@/lib/auth/config';
import { mintAssertion, verifiedPrimaryEmail } from '@/lib/auth/assertion';

/**
 * Mint a short-lived assertion that the BROWSER carries to the admin API.
 *
 * WHY THE BROWSER AND NOT THIS SERVER. `__Host-shop_session` is set by the
 * admin on its own registrable domain. A server-to-server call cannot plant a
 * cookie in the customer's browser, so the browser has to make that request
 * itself with `credentials: 'include'` — and the only thing it may be given to
 * carry is something that expires in a minute and works exactly once.
 *
 * WHY NOT HAND THE BROWSER CLERK'S SESSION TOKEN. Not because it is out of
 * reach — `__session` is written by Clerk's own script and is NOT httpOnly, and
 * `__client_uat` cannot be, since that script has to read it. The reason is
 * scope: this assertion names one email, dies in sixty seconds and works once,
 * whereas Clerk's token authenticates that user to Clerk for its whole
 * lifetime. Forwarding the token would hand the admin — and anything that ever
 * intercepted the request — a credential far broader than the question being
 * asked.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE PAYLOAD IS UNCHANGED FROM THE NEON AUTH ERA, ON PURPOSE.
 *
 * The admin verifies this HMAC and then calls
 * `findOrCreateCustomerByEmail(db, assertion.email)`. It keys customers on
 * EMAIL and never on `sub`, and its `verifyAssertion` only requires `sub` to be
 * a non-empty string — the "a uuid" in its comment is documentation, not a
 * check. So a Clerk user id (`user_2abc…`) satisfies it exactly as a Neon uuid
 * did, and every existing customer kept their orders, addresses and reviews
 * across the provider swap with no admin-side migration.
 *
 * DO NOT "TIDY" `sub` AWAY: the admin rejects an empty one as malformed, so
 * dropping it breaks every sign-in. But do not credit it with more than it
 * does either — the admin verifies it and then DISCARDS it. Nothing stores,
 * logs or correlates it.
 *
 * ⚠  WHICH MEANS EMAIL IS IDENTITY, WITH NO SECOND KEY BEHIND IT. If a customer
 * changes their primary address at Clerk, their next sign-in resolves to a NEW
 * `shop_customers` row and their order history is orphaned, silently. Nothing
 * in either repository currently prevents that; fixing it means the admin
 * persisting `sub` on first exchange and matching on it thereafter.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  const secret = AUTH_BRIDGE_SECRET;
  /*
   * Both keys are required to mint anything, and a missing one is a
   * DEPLOYMENT fault rather than a customer fault — so it is reported as the
   * same named 501 the storefront already knows how to explain ("Sign-in is
   * not available yet. You can still check out as a guest."), not as a 500.
   * `CLERK_SECRET_KEY` is checked here rather than left to `auth()` because
   * Clerk throws an opaque error when it is absent, which would reach the
   * shopper as a generic network failure.
   */
  if (!secret || !CLERK_SECRET_KEY) {
    return Response.json({ error: 'not_implemented', feature: 'identity-bridge' }, { status: 501 });
  }

  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  /*
   * `currentUser()` costs one Clerk Backend API call, which `auth()` alone
   * would not. It is worth it: the alternative is putting the email and its
   * verification state into the session token as custom claims, which is
   * dashboard configuration this repository cannot express or verify. This
   * route runs ONCE PER SIGN-IN, not per request, so the round trip is paid on
   * a path the shopper is already waiting on.
   */
  const user = await currentUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  /*
   * WHICH ADDRESS, AND WHETHER IT IS ALLOWED TO GRANT A SESSION — both live in
   * `lib/auth/assertion.ts`, with the reasoning and the tests. They are the
   * security boundary here, and this route cannot be run on `localhost` at all
   * (the commerce API refuses this origin by CORS), so they are deliberately
   * provable without a request.
   */
  const email = verifiedPrimaryEmail(user);

  /*
   * A MISSING PRIMARY ADDRESS TAKES THE SAME EXIT AS AN UNVERIFIED ONE. Clerk
   * permits phone-only and username-only users, and this bridge has nothing to
   * say about one — there is no email to resolve a customer by. Reported as
   * `email_unverified` rather than a new reason because the shopper's remedy is
   * identical: add and verify an address. A separate code would be a string the
   * storefront has no better sentence for.
   */
  if (!email) {
    return Response.json({ error: 'forbidden', detail: 'email_unverified' }, { status: 403 });
  }

  return Response.json({ assertion: mintAssertion(secret, { sub: userId, email }) });
}
