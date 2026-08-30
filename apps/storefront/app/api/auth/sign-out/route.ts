import { cookies } from 'next/headers';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { CLERK_SECRET_KEY } from '@/lib/auth/config';

/**
 * Sign out of BOTH sessions, the identity provider's first.
 *
 * THE ORDER IS THE WHOLE POINT. Clearing `__Host-shop_session` first leaves a
 * live Clerk session behind, and the next page load re-bridges from it and
 * mints a fresh customer session — a logout that does not log out, and one that
 * looks like a caching bug rather than an auth bug. `auth-api.ts`'s
 * `signOutEverywhere` calls this route before the admin's logout for that
 * reason; do not reorder them.
 *
 * `__Host-shop_cart` IS NOT TOUCHED, on either side. Logging out is losing the
 * person, not the basket; destroying the basket here would also destroy the
 * anonymous cart of whoever uses this browser next. The admin's
 * `identity/cookies.ts` makes the same argument at length.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠  CLEARING THE COOKIES IS THE MECHANISM. REVOCATION IS THE BACKSTOP.
 *
 * It is tempting to assume the opposite — revoke at Clerk and treat the browser
 * as cosmetic — and that assumption is WRONG in a way that silently reopens the
 * exact hole above:
 *
 *   `auth()` DOES NOT ASK CLERK WHETHER THE SESSION STILL EXISTS. It verifies
 *   the `__session` JWT's signature against cached JWKS and checks `exp`. There
 *   is no status lookup on that path. So a session revoked through the Backend
 *   API keeps verifying locally until its token expires, and for that whole
 *   window `POST /api/auth/bridge` will happily mint an assertion and hand back
 *   a brand-new 30-day `__Host-shop_session`.
 *
 * WORSE, ONE COOKIE RE-MINTS THE OTHERS. Clerk's `__refresh_<suffix>` exists
 * only in suffixed form, and the proxy uses it to issue a fresh session token
 * on the next GET navigation once `__session` is gone. Clearing two literal
 * names and leaving that behind produces a logout that appears to work and then
 * quietly undoes itself on the shopper's next click.
 *
 * Hence: every Clerk cookie is enumerated off the REQUEST and cleared by its
 * actual name, suffix included, rather than by a hard-coded list that goes
 * stale the first time Clerk adds an instance suffix.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const runtime = 'nodejs';

/**
 * Cookie-name prefixes Clerk owns on this origin.
 *
 * `__session` is the token, `__client_uat` the signed-in-at stamp its script
 * reads, `__refresh` the one that re-mints the first two, and `__clerk_db_jwt`
 * a development-instance artefact. Matched by PREFIX because every one of them
 * may carry an instance suffix (`__session_abc123`), and the suffix is not
 * knowable from here.
 */
const CLERK_COOKIE_PREFIXES = ['__session', '__client_uat', '__refresh', '__clerk_db_jwt'];

export async function POST(): Promise<Response> {
  /*
   * Revocation first, while the cookie is still readable — it needs the session
   * id off the very token that is about to be deleted. Best effort: a Backend
   * API blip must not turn a logout into an error, because the caller has no
   * branch for one and the cookie clearing below is what actually signs the
   * shopper out of this browser.
   *
   * It is still worth doing. Clearing cookies only ends the session HERE; the
   * revocation is what ends it on the shopper's other devices, and what stops a
   * token copied off this machine from outliving the logout.
   */
  if (CLERK_SECRET_KEY) {
    try {
      const { sessionId } = await auth();
      if (sessionId) {
        await (await clerkClient()).sessions.revokeSession(sessionId);
      }
    } catch {
      /* See above — deliberately swallowed. */
    }
  }

  const response = Response.json({ ok: true });

  const jar = await cookies();
  for (const cookie of jar.getAll()) {
    if (!CLERK_COOKIE_PREFIXES.some((prefix) => cookie.name.startsWith(prefix))) continue;
    /*
     * NO `HttpOnly` AND NO `Secure` ON THE DELETION. A browser matches a
     * clearing `Set-Cookie` on name/domain/path alone, and omitting the flags
     * keeps this working on `http://localhost` too, where `Secure` cookies are
     * not stored and a `Secure` delete would therefore miss.
     */
    response.headers.append(
      'Set-Cookie',
      `${cookie.name}=; Path=/; Max-Age=0; SameSite=Lax`,
    );
  }

  return response;
}
