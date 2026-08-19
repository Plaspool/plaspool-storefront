import { createNeonAuth, type NeonAuth } from '@neondatabase/auth/next/server';
import { NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET } from './config';

/**
 * Neon Auth, server side.
 *
 * Both values come from `./config`, which is env-first with a committed
 * fallback — read that file for why they live in the repository at all, and
 * for what the bridge secret costs if this repository ever stops being private.
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
    baseUrl: NEON_AUTH_BASE_URL,
    cookies: { secret: NEON_AUTH_COOKIE_SECRET },
  }));
}
