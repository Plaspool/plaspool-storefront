import { createHmac } from 'node:crypto';
import { expect, it } from 'vitest';

import { TTL_MS, mintAssertion, verifiedPrimaryEmail, type UserLike } from './assertion';

/**
 * The identity bridge's two decisions.
 *
 * ═══ WHY THIS IS THE ONLY PLACE THEY GET CHECKED ═══
 * The route these back cannot be exercised in a browser on `localhost` — the
 * commerce API sends no CORS header for this origin, so the handshake is only
 * observable on a deployed Worker (CLAUDE.md). Everything below is therefore
 * the last gate before a change to WHO GETS A SESSION reaches customers.
 */

const SECRET = 'test-secret-not-the-real-one';

function user(over: Partial<UserLike> = {}): UserLike {
  return {
    primaryEmailAddressId: 'idn_primary',
    emailAddresses: [
      {
        id: 'idn_primary',
        emailAddress: 'Shopper@Example.COM',
        verification: { status: 'verified' },
      },
    ],
    ...over,
  };
}

/** Decode what the admin would decode. */
function decode(assertion: string) {
  const [payload, mac] = assertion.split('.');
  return {
    payload,
    mac,
    claims: JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')),
  };
}

it('lowercases and trims the address, because the admin resolves customers by it', () => {
  expect(verifiedPrimaryEmail(user())).toBe('shopper@example.com');
  expect(
    verifiedPrimaryEmail(
      user({
        emailAddresses: [
          { id: 'idn_primary', emailAddress: '  spaced@example.com  ', verification: { status: 'verified' } },
        ],
      }),
    ),
  ).toBe('spaced@example.com');
});

/**
 * ═══ THE ACCOUNT-TAKEOVER THIS CLOSES ═══
 * The admin resolves `shop_customers` BY EMAIL. An unverified address would let
 * anyone claim an existing customer's account by signing up with their address.
 */
it('refuses any address that is not verified', () => {
  for (const status of ['unverified', 'transferable', 'failed', 'expired']) {
    expect(
      verifiedPrimaryEmail(
        user({
          emailAddresses: [
            { id: 'idn_primary', emailAddress: 'a@b.com', verification: { status } },
          ],
        }),
      ),
    ).toBeNull();
  }

  expect(
    verifiedPrimaryEmail(
      user({
        emailAddresses: [{ id: 'idn_primary', emailAddress: 'a@b.com', verification: null }],
      }),
    ),
  ).toBeNull();
});

/**
 * ═══ THE SPLIT ORDER HISTORY THIS CLOSES ═══
 * A Clerk user may carry several addresses and the array's order is not a
 * promise. Taking `emailAddresses[0]` would let one shopper resolve to two
 * different `shop_customers` rows on two different sign-ins.
 */
it('takes the PRIMARY address, never merely the first or any other verified one', () => {
  const multi = user({
    primaryEmailAddressId: 'idn_second',
    emailAddresses: [
      { id: 'idn_first', emailAddress: 'first@example.com', verification: { status: 'verified' } },
      { id: 'idn_second', emailAddress: 'primary@example.com', verification: { status: 'verified' } },
    ],
  });
  expect(verifiedPrimaryEmail(multi)).toBe('primary@example.com');
});

it('refuses a user with no primary address at all (phone- or username-only)', () => {
  expect(verifiedPrimaryEmail(user({ primaryEmailAddressId: null }))).toBeNull();
  expect(
    verifiedPrimaryEmail(user({ primaryEmailAddressId: 'idn_missing' })),
  ).toBeNull();
});

it('signs a payload the admin will accept, with a Clerk user id as `sub`', () => {
  const now = 1_700_000_000_000;
  const assertion = mintAssertion(SECRET, { sub: 'user_2abcDEF', email: 'a@b.com' }, now, 'jti1');
  const { payload, mac, claims } = decode(assertion);

  expect(claims).toEqual({
    v: 1,
    sub: 'user_2abcDEF',
    email: 'a@b.com',
    iat: now,
    exp: now + TTL_MS,
    jti: 'jti1',
  });
  /* The admin recomputes exactly this. */
  expect(mac).toBe(createHmac('sha256', SECRET).update(payload).digest('base64url'));
});

/**
 * ═══ ZERO MARGIN, AND THAT IS THE POINT ═══
 * The admin refuses `exp - iat > ASSERTION_TTL_MS` (60 000). Widening the
 * window on this side alone makes EVERY sign-in return a 400 that is
 * deliberately indistinguishable from a forgery — nothing anywhere would say
 * why. This test fails the moment somebody raises `TTL_MS` here without doing
 * the admin first.
 */
it('claims a window of exactly 60s, which is the widest the admin allows', () => {
  const { claims } = decode(mintAssertion(SECRET, { sub: 's', email: 'a@b.com' }, 1_000));
  expect(claims.exp - claims.iat).toBe(60_000);
});

it('gives every assertion a distinct jti, so a replay cannot be manufactured', () => {
  const seen = new Set(
    Array.from({ length: 50 }, () => decode(mintAssertion(SECRET, { sub: 's', email: 'a@b.com' })).claims.jti),
  );
  expect(seen.size).toBe(50);
});

it('a different secret yields a different MAC over the same payload', () => {
  const now = 1_700_000_000_000;
  const a = mintAssertion(SECRET, { sub: 's', email: 'a@b.com' }, now, 'jti1');
  const b = mintAssertion('another-secret', { sub: 's', email: 'a@b.com' }, now, 'jti1');
  expect(decode(a).payload).toBe(decode(b).payload);
  expect(decode(a).mac).not.toBe(decode(b).mac);
});
