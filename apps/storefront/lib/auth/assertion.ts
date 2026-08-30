import { createHmac, randomBytes } from 'node:crypto';

/**
 * The two decisions the identity bridge actually makes, separated from the
 * request handling so they can be tested.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THESE ARE NOT INLINE IN THE ROUTE ANY MORE.
 *
 * They are the security boundary of the whole sign-in flow — one of them
 * decides WHICH EMAIL a session is granted for, and the other manufactures the
 * credential that grants it. The route around them cannot be exercised on
 * `localhost` at all: the commerce API refuses this origin by CORS, so the only
 * way to see the handshake run is to deploy it (CLAUDE.md). Logic in that
 * position has to be provable without a browser, which means it has to be
 * importable without Clerk's server module and without a request.
 *
 * The route keeps the parts that genuinely need a request: reading the Clerk
 * session, and turning a refusal into a status code.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** The bridge's window. The admin refuses anything claiming a wider one. */
export const TTL_MS = 60_000;

/** Just enough of Clerk's `User` to choose an address. */
export interface EmailLike {
  id: string;
  emailAddress: string;
  verification: { status: string } | null;
}

export interface UserLike {
  primaryEmailAddressId: string | null;
  emailAddresses: EmailLike[];
}

/**
 * The address a session may be granted for, or `null` if there is none.
 *
 * ═══ THE PRIMARY ADDRESS SPECIFICALLY, NOT `emailAddresses[0]` ═══
 * A Clerk user may carry several addresses — one from Google, one added by
 * hand — and the array's order is not a promise. Signing whichever came back
 * first would let a customer's session resolve to a DIFFERENT `shop_customers`
 * row between one sign-in and the next, silently splitting their order history
 * in two, because the admin keys customers on the email this returns.
 *
 * ═══ AND IT MUST BE VERIFIED ═══
 * The admin resolves `shop_customers` BY EMAIL, so an unverified address would
 * let anyone claim an existing customer's account by signing up with their
 * address. Clerk verifies by code on the email path and inherently on Google;
 * this check is what makes that guarantee load-bearing rather than assumed.
 *
 * `transferable` — Clerk's state for an OAuth identity not yet attached to an
 * account — is NOT `verified`, and failing closed on it is deliberate.
 */
export function verifiedPrimaryEmail(user: UserLike): string | null {
  const primary = user.emailAddresses.find(
    (address) => address.id === user.primaryEmailAddressId,
  );
  if (!primary) return null;
  if (primary.verification?.status !== 'verified') return null;
  const email = primary.emailAddress.trim().toLowerCase();
  return email || null;
}

/**
 * Mint the assertion the browser carries to the admin.
 *
 * ═══ THE PAYLOAD IS UNCHANGED FROM THE NEON AUTH ERA, ON PURPOSE ═══
 * The admin verifies this HMAC and then calls
 * `findOrCreateCustomerByEmail(db, assertion.email)`. It keys customers on
 * EMAIL and never on `sub`, and its `verifyAssertion` only requires `sub` to be
 * a non-empty string — the "a uuid" in its comment is documentation, not a
 * check. So a Clerk user id (`user_2abc…`) satisfies it exactly as a Neon uuid
 * did, and every existing customer kept their orders across the provider swap
 * with no admin-side migration.
 *
 * ⚠  `exp - iat` IS EXACTLY `TTL_MS`, AND THE ADMIN REFUSES ANYTHING WIDER.
 * There is no margin here. Raising `TTL_MS` on this side alone makes every
 * sign-in on earth return `400 {detail:'assertion'}` — which the admin makes
 * deliberately indistinguishable from a forgery, so nothing anywhere will tell
 * you why. Change it on the admin first, or not at all.
 */
export function mintAssertion(
  secret: string,
  claims: { sub: string; email: string },
  now: number = Date.now(),
  jti: string = randomBytes(16).toString('base64url'),
): string {
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      sub: claims.sub,
      email: claims.email,
      iat: now,
      exp: now + TTL_MS,
      jti,
    }),
  ).toString('base64url');

  const mac = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}
