import { createNeonAuth, type NeonAuth } from '@neondatabase/auth/next/server';

/**
 * Neon Auth, server side.
 *
 * `NEON_AUTH_BASE_URL` is the project's own auth endpoint and is NOT a secret —
 * the browser talks to it directly. `NEON_AUTH_COOKIE_SECRET` is, and encrypts
 * the first-party session cookie this sets on the storefront's own origin.
 *
 * THIS COOKIE IS NOT `__Host-shop_session`. It is Neon's, it is first-party
 * here, and it never reaches the admin API. The bridge route translates it.
 *
 * `getAuth()` and not `export const auth`: a module-scope call to
 * `createNeonAuth` evaluates at import time, and `createNeonAuth` throws
 * synchronously when `NEON_AUTH_COOKIE_SECRET` is missing or short. On an
 * unconfigured deployment that turns *importing this file* — which happens
 * for every route under `app/api/auth/`, including ones like the bridge that
 * are supposed to fail cleanly with a named 501 — into a build-time crash
 * during Next's "Collecting page data" phase, before any request-time check
 * ever runs. Constructing on first use instead means a missing variable stays
 * a runtime error on the route that actually needs Neon Auth, never an
 * import-time or build-time one. The instance is cached after first
 * construction, so this still behaves like the singleton the upstream docs
 * describe.
 */
let cached: NeonAuth | null = null;

export function getAuth(): NeonAuth {
  if (cached) return cached;
  return (cached = createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
  }));
}
