import { getAuth } from '@/lib/auth/server';

/**
 * Sign out of BOTH sessions, Neon's first.
 *
 * THE ORDER IS THE WHOLE POINT. Clearing `__Host-shop_session` first leaves a
 * live Neon session behind, and the next page load re-bridges from it and mints
 * a fresh customer session — a logout that does not log out, and one that looks
 * like a caching bug rather than an auth bug.
 *
 * `__Host-shop_cart` IS NOT TOUCHED, on either side. Logging out is losing the
 * person, not the basket; destroying the basket here would also destroy the
 * anonymous cart of whoever uses this browser next. `identity/cookies.ts` makes
 * the same argument at length.
 */
export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  await getAuth().signOut();
  return Response.json({ ok: true });
}
