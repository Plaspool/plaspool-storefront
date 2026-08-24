/**
 * The `/sign-in` link a header control should point at, from wherever the
 * shopper currently is.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BECAUSE A BARE `/sign-in` FORGETS THE PAGE THEY WERE ON.
 *
 * Every account control in the nav linked to `/sign-in` with nothing attached,
 * so a shopper who signed in from the home page, a category, or a product
 * finished the round trip somewhere else entirely. `/sign-in` reads `next` and
 * forwards there once the shop session exists; this is the other half of that,
 * and without it the parameter only ever gets set by the two or three screens
 * that bounce an expired session.
 *
 * ═══ IT MIRRORS `safeDestination`, IT DOES NOT SHARE IT ═══
 * The authoritative check is `packages/web`'s `safeDestination`, which runs on
 * the value as it comes back OFF the URL — the leg that matters, because that
 * is the one an attacker controls. This cannot import it: `@plaspool/web`
 * depends on `@plaspool/shop`, so the arrow only points one way. What it can do
 * is refuse to WRITE a value the reader would reject, so the two never
 * disagree about a link the shop itself produced.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const SIGN_IN = "/sign-in";

export function signInHref(pathname: string | null | undefined): string {
  if (!pathname) return SIGN_IN;
  if (/[\u0000-\u0020\u007f]/.test(pathname)) return SIGN_IN;
  if (!pathname.startsWith("/")) return SIGN_IN;
  if (pathname.startsWith("//") || pathname.startsWith("/\\")) return SIGN_IN;
  /* Already here. Adding `?next=/sign-in` would build the exact loop the
     sign-in page's own guard exists to break. */
  if (pathname === SIGN_IN || pathname.startsWith(`${SIGN_IN}/`)) return SIGN_IN;
  return `${SIGN_IN}?next=${encodeURIComponent(pathname)}`;
}
