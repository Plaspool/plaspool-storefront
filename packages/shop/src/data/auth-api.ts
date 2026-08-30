import { COMMERCE_API_BASE } from "./config";

/**
 * The sign-in handshake — the storefront's half of the Clerk → admin bridge.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO STEPS, AND THE SECOND ONE RUNS IN THE BROWSER.
 *
 *   1. POST /api/auth/bridge (same origin)              -> { assertion }
 *   2. POST {COMMERCE_API_BASE}/api/shop/customer/session/exchange
 *        body { assertion }, credentials: 'include'      -> Set-Cookie __Host-shop_session
 *
 * Step 2 sends cookies for the same reason `cart-api.ts` does: `__Host-shop_session`
 * is set on the admin's own registrable domain, and without `credentials: 'include'`
 * the browser drops the `Set-Cookie` silently — the customer stays a guest and
 * nothing anywhere says why.
 *
 * AN ASSERTION IS SINGLE-USE. The admin burns its `jti` on first exchange, so a
 * retry of the same value always answers 400. `completeSignIn` never retries
 * internally — a caller that wants another attempt has to start over at step 1,
 * which mints a fresh assertion.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type SignInFailureReason =
  | "no_session"
  | "email_unverified"
  | "not_configured"
  | "assertion"
  /*
   * DISTINCT FROM `assertion`, because the admin deliberately distinguishes
   * them and the shopper's remedy differs. `assertion` means replayed or forged
   * — nothing to be done. `assertion_expired` means the 60-second window closed
   * between minting and exchanging, which a slow connection can do on its own,
   * and the fix is simply to go again. Collapsing the two told somebody on a
   * bad connection they had reused a link they had never used.
   */
  | "assertion_expired"
  | "network";

export type CompleteSignInResult = { ok: true } | { ok: false; reason: SignInFailureReason };

async function requestBridgeAssertion(): Promise<
  { ok: true; assertion: string } | { ok: false; reason: SignInFailureReason }
> {
  let res: Response;
  try {
    res = await fetch("/api/auth/bridge", { method: "POST" });
  } catch {
    return { ok: false, reason: "network" };
  }

  if (res.status === 401) return { ok: false, reason: "no_session" };
  if (res.status === 501) return { ok: false, reason: "not_configured" };
  if (res.status === 403) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    if (body?.detail === "email_unverified") return { ok: false, reason: "email_unverified" };
    return { ok: false, reason: "network" };
  }
  if (!res.ok) return { ok: false, reason: "network" };

  const body = (await res.json().catch(() => null)) as { assertion?: string } | null;
  if (!body?.assertion) return { ok: false, reason: "network" };
  return { ok: true, assertion: body.assertion };
}

/**
 * Runs the whole handshake once and reports what happened, rather than
 * throwing — this is called from a `useEffect`, and a rejected promise there
 * is a silent failure, not a caught one.
 */
export async function completeSignIn(): Promise<CompleteSignInResult> {
  const step1 = await requestBridgeAssertion();
  if (!step1.ok) return step1;

  let res: Response;
  try {
    res = await fetch(`${COMMERCE_API_BASE}/api/shop/customer/session/exchange`, {
      method: "POST",
      /* The whole point of step 2. See the file header. */
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assertion: step1.assertion }),
    });
  } catch {
    return { ok: false, reason: "network" };
  }

  if (res.status === 501) return { ok: false, reason: "not_configured" };
  if (res.status === 400) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    return {
      ok: false,
      reason: body?.detail === "assertion_expired" ? "assertion_expired" : "assertion",
    };
  }
  if (!res.ok) return { ok: false, reason: "network" };
  return { ok: true };
}

/** The shop customer, as `/api/shop/customer/me` describes it. */
export interface ShopCustomer {
  id: string;
  email: string;
  name: string | null;
}

/**
 * The current shop session, if any. Never 401s — a guest answers
 * `{ customer: null }` — so this answers `null` for a guest and for any
 * transport failure alike, the same "never throw" rule `cart-api.ts` follows.
 *
 * KEPT AS-IS for the callers that only need "who, if anyone". Anything that
 * renders a DIFFERENT CONTROL for a guest should use `readShopSession` below,
 * because for those "we could not ask" is not the same as "nobody".
 */
export async function getShopCustomer(): Promise<ShopCustomer | null> {
  const result = await readShopSession();
  return result.kind === "customer" ? result.customer : null;
}

/**
 * The session, with "we could not ask" kept distinct from "nobody is signed in".
 *
 * ═══ WHY THE DISTINCTION HAS TO EXIST ═══
 * `getShopCustomer` collapses a network failure into `null`, and the nav used
 * that `null` to render its signed-out control. So a flaky connection did not
 * merely delay the account menu — it told a signed-in shopper they were signed
 * out, permanently, with no retry, and sent them to a sign-in page if they
 * tapped it. `unknown` is the state a header needs in order to say nothing
 * rather than to say something false.
 */
export type ShopSession =
  | { kind: "customer"; customer: ShopCustomer }
  | { kind: "guest" }
  | { kind: "unknown" };

export async function readShopSession(): Promise<ShopSession> {
  try {
    const res = await fetch(`${COMMERCE_API_BASE}/api/shop/customer/me`, {
      credentials: "include",
    });
    /* A non-2xx is the API answering badly, not the browser answering for it —
       so it is unknown rather than guest. The route does not 401 a guest; it
       answers 200 with `customer: null`. */
    if (!res.ok) return { kind: "unknown" };
    const body = (await res.json()) as { customer: ShopCustomer | null };
    return body.customer ? { kind: "customer", customer: body.customer } : { kind: "guest" };
  } catch {
    return { kind: "unknown" };
  }
}

/**
 * Sign out of both sessions, the identity provider's first.
 *
 * THE ORDER IS THE WHOLE POINT — see `app/api/auth/sign-out/route.ts`.
 * Clearing the admin session first and leaving a live Clerk session behind
 * means the next page load just re-bridges: a logout that does not log out.
 */
export async function signOutEverywhere(destination?: string): Promise<void> {
  try {
    await fetch("/api/auth/sign-out", { method: "POST" });
  } catch {
    /* best effort — Clerk's own cookie expires on its own schedule regardless */
  }
  try {
    await fetch(`${COMMERCE_API_BASE}/api/shop/customer/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    /* best effort */
  }

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * A HARD NAVIGATION, AND IT IS PART OF THE LOGOUT — NOT A CONVENIENCE.
   *
   * The route above revokes the session at Clerk and deletes its cookies. What
   * it cannot touch is CLERK-JS ITSELF, which is still running in this page
   * holding the session in memory. Every caller used to finish with
   * `router.refresh()` / `router.push()` — client-side navigations that keep
   * that instance alive. It can then rewrite the very cookies the route just
   * cleared, and the next visit to `/sign-in` bridges straight back into a
   * fresh 30-day shop session: a logout that quietly undoes itself.
   *
   * Tearing the document down is what actually ends it. The next load boots
   * clerk-js with no cookies, so it starts signed out.
   *
   * `assign` and not `replace`: the page they signed out FROM should still be
   * in history — they may well want to go back and sign in again.
   *
   * Defaults to reloading wherever they are, so signing out of the header menu
   * on `/store` leaves them on `/store` rather than throwing them home.
   * ═══════════════════════════════════════════════════════════════════════════
   */
  if (typeof window !== "undefined") {
    window.location.assign(destination ?? window.location.pathname);
  }
}
