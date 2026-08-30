"use client";

import * as React from "react";
import Link from "next/link";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

import { bridgeCallbackUrl, safeDestination } from "./sign-in-destination";

/**
 * The OAuth landing strip. Clerk's component does the work: read the result off
 * the URL, activate the session, forward on.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT MUST BE TOLD WHERE TO FORWARD TO, AND THAT IS THE WHOLE POINT OF THIS FILE.
 *
 * Mounted bare — `<AuthenticateWithRedirectCallback />` with no props — Clerk
 * falls back to its dashboard-configured after-sign-in URL, which for this
 * instance is `/`. That silently breaks the one invariant the sign-in flow is
 * built around: a shopper who arrives here on the TRANSFER path (a Google
 * account signing in for the first time, which Clerk routes through sign-up)
 * lands on the home page holding a live Clerk session and NO
 * `__Host-shop_session`. Every `readShopSession()` in the shop then calls them
 * a guest — the header offers "Sign in", `/returns` offers `GuestPrompt` — and
 * signing in again just repeats it. That is exactly the split-brain state
 * `sign-in-destination.ts` documents, reached by a different road.
 *
 * So BOTH force-redirect URLs are set, and both point back at
 * `/sign-in?next=…&bridge=1` — the one page that owns the Clerk → shop
 * exchange. `next` rides in on this page's own query string, put there by
 * `handleGoogle`, so the shopper's real destination survives the round trip
 * instead of collapsing to `/store`.
 *
 * FORCE rather than FALLBACK: a fallback yields to whatever Clerk has stored,
 * and the whole problem is that the stored value is wrong for this app.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * How long to wait before admitting nothing is going to happen.
 *
 * ═══ WHY THERE IS A TIMEOUT AT ALL ═══
 * `handleRedirectCallback` has no failure output this component surfaces. If
 * the shopper presses Cancel on Google's consent screen, or the OAuth state is
 * stale because they sat on the screen too long, or an extension eats Clerk's
 * script, this route renders "One moment while we finish setting up your
 * account." and never moves — on a page with no nav and no footer, so the only
 * exit is the browser's Back button. Twelve seconds is well past a slow-but-
 * working handshake and well short of the shopper deciding the shop is broken.
 */
const GIVE_UP_MS = 12_000;

export function SsoCallback({ next = null }: { next?: string | null }) {
  const [stalled, setStalled] = React.useState(false);
  const destination = React.useMemo(() => safeDestination(next), [next]);
  const back = React.useMemo(() => bridgeCallbackUrl(destination), [destination]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setStalled(true), GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main
      id="content"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-2 px-4"
    >
      {stalled ? (
        <div role="alert">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            That didn&apos;t finish
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The sign-in was cancelled, or it took too long. Nothing was changed —
            you can try again, or carry on shopping as a guest.
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <Link
              href="/sign-in"
              className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
            >
              Try signing in again
            </Link>
            <Link
              href={destination}
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Keep shopping
            </Link>
          </div>
        </div>
      ) : (
        /*
         * TEXT AND NOT A SKELETON, for the reason `/sign-in`'s `FinishingPanel`
         * gives: nothing is arriving to be drawn here. The wait is a process,
         * and the page being waited for is a different page.
         */
        <div role="status">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Signing you in…
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            One moment while we finish setting up your account.
          </p>
        </div>
      )}

      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl={back}
        signUpForceRedirectUrl={back}
        /* Where Clerk sends a handshake it cannot complete on its own. Without
           it, such a case has nowhere to go and joins the stall above.
           CARRIES `next`: a bare `/sign-in` would drop the destination, so a
           shopper who pressed Cancel on Google's consent screen would restart
           and then land on `/store` instead of the page they came from. */
        signInUrl={`/sign-in?next=${encodeURIComponent(destination)}`}
        /*
         * Where a Google identity goes when Clerk needs more from it than
         * Google supplied (an instance with extra required fields). Clerk
         * otherwise defaults this to its own sign-up route plus `/continue` —
         * and THIS APP HAS NO `/sign-up` ROUTE, so that default is a 404
         * reached while holding a live Clerk session and no shop session. Sent
         * back to the bridge instead.
         */
        continueSignUpUrl={back}
      />
    </main>
  );
}
