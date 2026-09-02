/**
 * "Don't show this again", for the return dialog's explanation step.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ONLY THING IN `packages/shop` THAT PERSISTS ANYTHING IN THE BROWSER.
 *
 * `cart/storage.ts` was deleted precisely because a cart in `localStorage` and
 * a cart on the server is two carts (see `cart-context.tsx`), and the receipt
 * uses `sessionStorage` so it cannot outlive the tab. Neither objection
 * applies here: this is a per-device display preference with no server-side
 * counterpart to disagree with, and losing it costs a shopper one extra tap on
 * "Next". It is deliberately NOT part of the customer's account for the same
 * reason — a preference about a dialog is not worth a write to the commerce
 * API, and it must work for a guest, who has no account to write to.
 *
 * ═══ `globalThis`, NOT `window` — AND THAT IS WHAT MAKES IT TESTABLE ═══
 * The suite runs on `environment: "node"` (see `vitest.config.mts`), where
 * `window` does not exist. Reading through `globalThis` means the SSR path and
 * the test path are the SAME path, so "no storage at all" is a case the suite
 * actually exercises rather than one that only happens in production. In a
 * browser the two are the same object, so nothing is given up for it.
 *
 * ═══ EVERY FAILURE READS AS "NOT DISMISSED" ═══
 * Safari in private mode leaves `localStorage` in place and throws on every
 * call; a browser set to block site data may have no property at all. Neither
 * is a shopper who asked to skip the explanation, so both answer `false`. This
 * mirrors `readShopSession()`'s doctrine one file over — a read that failed is
 * never reported as an answer — with the difference that the cost of guessing
 * wrong here is one extra screen rather than a wrongly signed-out shopper, so
 * there is no third "unknown" state to model.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Namespaced the way `plaspool:install-dismissed` already is, so everything
 *  this app owns in a shopper's storage is greppable by one prefix. */
export const INTRO_DISMISSED_KEY = "plaspool:returns-intro-dismissed";

/** The stored value. Only its presence is read; this is what gets written so
 *  a human looking at devtools sees something meaningful. */
const DISMISSED = "1";

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    /* Accessing the property itself can throw where site data is blocked. */
    return undefined;
  }
}

/** Whether this device has asked not to see the explanation again. */
export function introDismissed(): boolean {
  try {
    return storage()?.getItem(INTRO_DISMISSED_KEY) === DISMISSED;
  } catch {
    return false;
  }
}

/**
 * Records the choice — or clears it, which is a real branch: unchecking the
 * box removes the key rather than storing a falsy value, so there is exactly
 * one representation of "show it" and no string for a future reader to
 * misjudge the truthiness of.
 */
export function setIntroDismissed(next: boolean): void {
  const store = storage();
  if (!store) return;
  try {
    if (next) store.setItem(INTRO_DISMISSED_KEY, DISMISSED);
    else store.removeItem(INTRO_DISMISSED_KEY);
  } catch {
    /* A storage that refuses the write is one the shopper sees the
       explanation from again. Nothing here is worth an exception escaping
       into the dialog's render. */
  }
}
