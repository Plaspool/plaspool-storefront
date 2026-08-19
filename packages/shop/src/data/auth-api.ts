import { COMMERCE_API_BASE } from "./config";

/**
 * The sign-in handshake — the storefront's half of Neon Auth → admin bridge.
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
  if (res.status === 400) return { ok: false, reason: "assertion" };
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
 */
export async function getShopCustomer(): Promise<ShopCustomer | null> {
  try {
    const res = await fetch(`${COMMERCE_API_BASE}/api/shop/customer/me`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { customer: ShopCustomer | null };
    return body.customer;
  } catch {
    return null;
  }
}

/**
 * Sign out of both sessions, Neon's first.
 *
 * THE ORDER IS THE WHOLE POINT — see `app/api/auth/sign-out/route.ts`.
 * Clearing the admin session first and leaving a live Neon session behind
 * means the next page load just re-bridges: a logout that does not log out.
 */
export async function signOutEverywhere(): Promise<void> {
  try {
    await fetch("/api/auth/sign-out", { method: "POST" });
  } catch {
    /* best effort — Neon's own cookie expires on its own schedule regardless */
  }
  try {
    await fetch(`${COMMERCE_API_BASE}/api/shop/customer/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    /* best effort */
  }
}
