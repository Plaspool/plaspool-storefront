import { createNeonAuth } from '@neondatabase/auth/next/server';

/**
 * Neon Auth, server side.
 *
 * `NEON_AUTH_BASE_URL` is the project's own auth endpoint and is NOT a secret —
 * the browser talks to it directly. `NEON_AUTH_COOKIE_SECRET` is, and encrypts
 * the first-party session cookie this sets on the storefront's own origin.
 *
 * THIS COOKIE IS NOT `__Host-shop_session`. It is Neon's, it is first-party
 * here, and it never reaches the admin API. The bridge route translates it.
 */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
});
