/**
 * Where a sign-in ends up, and how the round trip gets there.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PURE, AND IN ITS OWN FILE, FOR TWO REASONS.
 *
 * `sign-in.tsx` calls `createAuthClient()` at module scope, so importing it
 * from a test executes Neon's client in a Node environment. And these two
 * rules are the security boundary of the whole flow — an open redirect and a
 * redirect loop both live here — which is exactly the kind of thing that
 * should be provable without a DOM. Same argument `returns-cta.tsx` makes for
 * exporting `isOwnEntry`.
 *
 * ═══ THE BUG THAT PUT `bridgeCallbackUrl` HERE ═══
 * `handleGoogle` used to pass the destination straight to Neon as its
 * `callbackURL`. Neon honoured it, so a shopper who started at the
 * announcement bar's return prompt (`/sign-in?next=%2Freturns`) came back from
 * Google on `/returns` — a page that does not run the Neon → shop bridge. They
 * landed with a live Neon session, no `__Host-shop_session`, and every
 * `readShopSession()` in the shop answered `guest`. Signed in and signed out at
 * the same time, with nothing anywhere saying why.
 *
 * The bridge lives on `/sign-in` because it is the one page that can own a
 * single-use assertion. So the callback goes back THERE, always, carrying the
 * destination as a parameter — and `/sign-in` forwards on once the shop
 * session actually exists.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Where a shopper goes when nothing said otherwise.
 *
 * THE STORE, NOT `/sign-in`. The old default was this page itself, which is
 * how signing in from the header produced a bare "You're signed in" panel with
 * one "Sign out" button — on a route that sits outside both `(shop)` and
 * `(site)`, so it had no nav and no footer to escape through either. A
 * completed sign-in is the middle of a shopping trip, not the end of one.
 */
export const DEFAULT_DESTINATION = "/store";

/** The page that owns the Neon → shop handshake. */
const BRIDGE_PATH = "/sign-in";

/**
 * Marks the page load that is the TAIL of a sign-in round trip, rather than
 * the head of one.
 *
 * ═══ WHY THE PAGE CANNOT WORK THIS OUT FOR ITSELF ═══
 * `/sign-in?next=/returns` is the URL on BOTH legs: `GuestPrompt` links to it
 * on the way out, and Neon redirects to it on the way back. So `next` alone
 * cannot tell the page whether it is about to show a form or about to finish a
 * handshake — and it has to choose at first paint, before either session probe
 * has answered.
 *
 * Guessing costs a wrong frame either way. Assume "returning" and a first-time
 * guest reads "Signing you in…" when nobody is signing them in; assume "form"
 * and somebody who just cleared Google's consent screen watches a sign-in form
 * appear and vanish, which is precisely the "did that even work?" flicker this
 * whole change is about. The flag removes the guess.
 */
export const BRIDGE_FLAG = "bridge";

/** Whether this page load is Neon handing the shopper back after granting a
 *  session — see `BRIDGE_FLAG`. Takes the raw `location.search`. */
export function isBridgeReturn(search: string): boolean {
  return new URLSearchParams(search).get(BRIDGE_FLAG) === "1";
}

/**
 * A `next` value, reduced to something safe to navigate to.
 *
 * `next` arrives in a URL anybody can hand somebody else, so this is an
 * allow-list rather than a blocklist: a single leading `/`, no scheme, no
 * authority, nothing that resolves off this origin, and never back to the
 * sign-in page itself.
 */
export function safeDestination(next: string | null | undefined): string {
  if (!next) return DEFAULT_DESTINATION;

  /* Whitespace and C0 controls are how `//host` gets smuggled past a prefix
     test — browsers strip them before resolving, so a value containing any of
     them is judged on what the browser would do with it, not on how it reads.
     Refused outright rather than trimmed: nothing legitimate needs them. */
  if (/[\u0000-\u0020\u007f]/.test(next)) return DEFAULT_DESTINATION;

  /* One leading slash exactly. `//host` is a protocol-relative URL and
     `/\host` is the same thing to every browser that normalises backslashes. */
  if (!next.startsWith("/")) return DEFAULT_DESTINATION;
  if (next.startsWith("//") || next.startsWith("/\\")) return DEFAULT_DESTINATION;

  /* THE LOOP GUARD. Forwarding to `/sign-in` is the dead end this whole change
     removes, and a bookmarked `?next=%2Fsign-in` would rebuild it. Matched on
     a path boundary so `/sign-in-help` is still a real page. */
  const path = next.split(/[?#]/, 1)[0];
  if (path === BRIDGE_PATH || path.startsWith(`${BRIDGE_PATH}/`)) {
    return DEFAULT_DESTINATION;
  }

  return next;
}

/**
 * The `callbackURL` to hand Neon Auth: back to the bridging page, carrying
 * where the shopper was actually going.
 *
 * SANITISES FIRST. The destination is encoded into a URL Neon will redirect
 * to, so a hostile `next` must not survive being round-tripped — checking it
 * again on the way back would be one place too late to be the only check.
 */
export function bridgeCallbackUrl(destination: string): string {
  const next = encodeURIComponent(safeDestination(destination));
  return `${BRIDGE_PATH}?next=${next}&${BRIDGE_FLAG}=1`;
}
