"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createAuthClient } from "@neondatabase/auth/next";
import { Button, Input, Label, Separator, cn, NEO_SURFACE } from "@plaspool/ui";
import {
  completeSignIn,
  getShopCustomer,
  type ShopCustomer,
  type SignInFailureReason,
} from "@plaspool/shop";

import {
  bridgeCallbackUrl,
  isBridgeReturn,
  safeDestination,
} from "./sign-in-destination";

/**
 * `/sign-in` — the one page a customer uses to keep their basket, addresses
 * and order history across devices. It is a DOORWAY, never a destination.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE BRIDGE RUNS FROM HERE, AND WHY THE CALLBACK COMES BACK HERE.
 *
 * The Neon → shop handshake exists in exactly one place: the `useEffect`
 * below. It can only live in one place, because the assertion it exchanges is
 * single-use. So this page has to be on the return path of BOTH flows that
 * grant a Neon session — the Google OAuth callback and the magic-link click.
 *
 * IT ONCE WAS, AND THEN QUIETLY STOPPED BEING. When `next` was added so a
 * shopper bounced here from `/account/settings` would be returned there, the
 * destination was handed to Neon as its `callbackURL` directly. Neon obeyed:
 * Google returned the shopper to `/returns`, a page that does not bridge. They
 * arrived holding a live Neon session and no `__Host-shop_session`, so every
 * `readShopSession()` in the shop called them a guest — the header offered
 * "Sign in", the returns form offered `GuestPrompt` — and signing in again
 * just repeated the loop. Nothing logged an error; both halves were behaving
 * exactly as written.
 *
 * `bridgeCallbackUrl` is the repair. Neon is always sent back HERE, with the
 * real destination riding along as `next`, and this page forwards on once the
 * shop session it just minted actually exists.
 *
 * ═══ AND A RESOLVED SESSION IS A DEPARTURE, NOT A PAGE ═══
 * This used to render a "You're signed in" panel — a heading, an email, and a
 * "Sign out" button. `/sign-in` sits outside both `(shop)` and `(site)`, so it
 * carries no nav and no footer: a shopper who signed in from the header landed
 * in a room with one door, and that door logged them out. There is no signed-in
 * state of this page any more. Resolving a session means leaving.
 *
 * ONE ATTEMPT PER MOUNT. `attempted` is a ref, not state, because it must
 * survive without triggering a re-render, and it is never reset — a genuine
 * retry needs a fresh Neon session, which only a full navigation back here
 * (a new OAuth round trip, a new magic-link click) can mint. Re-running the
 * same assertion would just burn a 400, because it is single-use.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const authClient = createAuthClient();

const FAILURE_COPY: Record<SignInFailureReason, string> = {
  no_session: "Could not reach the server. Check your connection and try again.",
  email_unverified:
    "Verify your email address first — check your inbox for the code we sent.",
  not_configured: "Sign-in is not available yet. You can still check out as a guest.",
  assertion: "That sign-in link has already been used. Request a new one.",
  network: "Could not reach the server. Check your connection and try again.",
};

type FormState =
  | { kind: "idle" }
  | { kind: "bridging" }
  | { kind: "sending_link" }
  | { kind: "link_sent"; email: string }
  | { kind: "failed"; reason: SignInFailureReason };

export default function SignInPage() {
  const router = useRouter();
  const session = authClient.useSession();
  /**
   * Where to go back to after signing in.
   *
   * ═══ A DESTINATION THAT SURVIVES THE DETOUR ═══
   * Both callbacks used to be the literal string `/sign-in`, so a shopper
   * bounced here from `/account/settings` by an expired session signed in and
   * landed... back on `/sign-in`. The page they asked for was forgotten at the
   * moment they were redirected, and nothing carried it.
   *
   * READ FROM `location` RATHER THAN `useSearchParams` so this component does
   * not need a Suspense boundary it did not previously have. The validation
   * itself — same-site only, and never back to this page — lives in
   * `safeDestination`, where it is unit-testable without a DOM; see that
   * module for the open redirect and the redirect loop it is holding shut.
   */
  const returnTo = React.useMemo(() => {
    if (typeof window === "undefined") return safeDestination(null);
    return safeDestination(new URLSearchParams(window.location.search).get("next"));
  }, []);
  /**
   * Whether this page load is the TAIL of a sign-in round trip rather than the
   * head of one — the difference between showing a form and finishing a
   * handshake, which has to be decided at first paint. See `BRIDGE_FLAG`.
   */
  const returning = React.useMemo(
    () => typeof window !== "undefined" && isBridgeReturn(window.location.search),
    [],
  );
  const [customer, setCustomer] = React.useState<ShopCustomer | null | undefined>(undefined);
  const [form, setForm] = React.useState<FormState>({ kind: "idle" });
  const [email, setEmail] = React.useState("");
  const attempted = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    getShopCustomer().then((c) => {
      if (!cancelled) setCustomer(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (customer === undefined) return; // shop session check still in flight
    if (customer) return; // already have a shop session
    if (session.isPending) return; // neon session still resolving
    if (!session.data) return; // no neon session to bridge from
    if (attempted.current) return;
    attempted.current = true;

    setForm({ kind: "bridging" });
    completeSignIn().then((result) => {
      if (result.ok) {
        getShopCustomer().then(setCustomer);
        setForm({ kind: "idle" });
      } else {
        setForm({ kind: "failed", reason: result.reason });
      }
    });
  }, [customer, session.data, session.isPending]);

  /**
   * A SESSION IS A DEPARTURE. The moment one resolves — bridged just now, or
   * already live when the page mounted — the shopper leaves for wherever they
   * were headed. `replace` and not `push`, so Back goes to the page they came
   * from rather than to a sign-in page that would immediately bounce them
   * forward again.
   */
  React.useEffect(() => {
    if (!customer) return;
    router.replace(returnTo);
  }, [customer, returnTo, router]);

  const handleGoogle = React.useCallback(() => {
    void authClient.signIn.social({
      provider: "google",
      /* Back HERE, carrying the destination — never straight to the
         destination. See the file header for what that cost. */
      callbackURL: bridgeCallbackUrl(returnTo),
    });
  }, [returnTo]);

  const handleSendLink = React.useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const address = email.trim();
      if (!address) return;

      setForm({ kind: "sending_link" });
      try {
        const { error } = await authClient.signIn.magicLink({
          email: address,
          /* The same round trip the Google button takes, for the same
             reason — the link has to land on the page that bridges. */
          callbackURL: bridgeCallbackUrl(returnTo),
        });
        if (error) {
          setForm({ kind: "failed", reason: "network" });
        } else {
          setForm({ kind: "link_sent", email: address });
        }
      } catch {
        setForm({ kind: "failed", reason: "network" });
      }
    },
    [email, returnTo],
  );

  const working = form.kind === "bridging" || form.kind === "sending_link";

  /**
   * Nobody is signed in anywhere, and both probes have said so.
   *
   * THE HANG THIS PREVENTS. `returning` is read off the URL, so a hand-typed
   * or stale `?bridge=1` claims a handshake that is not happening. Without
   * this, such a visit would sit on "Signing you in…" forever, because the
   * effect above returns early when there is no Neon session to bridge FROM
   * and nothing else would ever move `form` off `idle`.
   */
  const noSessionAnywhere = customer === null && !session.isPending && !session.data;

  /**
   * The handshake is the whole page: either it is running, or it finished and
   * the redirect above is on its way. A failure is NOT one of these — that
   * falls back to the form with its reason, which is the only state a shopper
   * can actually act on.
   */
  const finishing =
    form.kind !== "failed" &&
    !noSessionAnywhere &&
    (Boolean(customer) || form.kind === "bridging" || returning);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-16 sm:py-24">
      {finishing ? (
        <FinishingPanel arrived={Boolean(customer)} />
      ) : (
        <>
          <div>
            <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Keep your cart across devices
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Sign in and your basket, addresses and order history follow you.
            </p>
          </div>

          {form.kind === "failed" && (
            <p className="font-sans text-sm text-foreground" role="alert">
              {FAILURE_COPY[form.reason]}
            </p>
          )}

          {form.kind === "link_sent" ? (
            <LinkSentPanel email={form.email} onSendAnother={() => setForm({ kind: "idle" })} />
          ) : (
            <>
              <Button
                type="button"
                onClick={handleGoogle}
                disabled={working}
                className={cn(
                  "h-12 w-full justify-center gap-3 border-2 border-foreground bg-background text-base text-foreground hover:bg-background",
                  NEO_SURFACE,
                )}
              >
                <GoogleMark />
                {form.kind === "bridging" ? "Signing you in…" : "Continue with Google"}
              </Button>

              <div className="flex items-center gap-4">
                <Separator className="flex-1" />
                <span className="font-sans text-xs uppercase tracking-wide text-muted-foreground">
                  or
                </span>
                <Separator className="flex-1" />
              </div>

              <form onSubmit={handleSendLink} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sign-in-email" className="font-sans text-foreground">
                    Email
                  </Label>
                  <Input
                    id="sign-in-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={working}
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={working}
                  className={cn(
                    "h-12 w-full justify-center border-2 border-foreground bg-background text-base text-foreground hover:bg-background",
                    NEO_SURFACE,
                  )}
                >
                  {form.kind === "sending_link" ? "Sending…" : "Email me a sign-in link"}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                You don&apos;t need an account to check out.
              </p>
            </>
          )}
        </>
      )}
    </main>
  );
}

function LinkSentPanel({
  email,
  onSendAnother,
}: {
  email: string;
  onSendAnother: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-foreground bg-brand-soft px-6 py-10 text-center">
      <h2 className="font-sans text-lg font-semibold text-foreground">Check your email</h2>
      <p className="max-w-sm text-sm leading-6 text-muted-foreground">
        We sent a sign-in link to <span className="font-medium text-foreground">{email}</span>.
        Open it on this device to finish signing in.
      </p>
      <Button
        type="button"
        variant="link"
        onClick={onSendAnother}
        className="font-sans text-sm text-foreground underline underline-offset-4"
      >
        Send another link
      </Button>
    </div>
  );
}

/**
 * The only thing this page shows once a session is in play: the handshake
 * running, and then the shopper leaving.
 *
 * ═══ TEXT RATHER THAN A SKELETON, DELIBERATELY ═══
 * The house rule is that a known layout loads as its own shape, never as a
 * line of prose. This is the documented exception: nothing is arriving to be
 * drawn here. The wait is a PROCESS the shopper is watching — two round trips
 * between Neon and the commerce API — and the page they are waiting for is a
 * different page. A skeleton of a form nobody is going to fill in would be a
 * shape that never resolves.
 *
 * `role="status"` so a screen reader is told the same thing the sighted
 * shopper is, without stealing focus mid-navigation.
 */
function FinishingPanel({ arrived }: { arrived: boolean }) {
  return (
    <div role="status" className="flex flex-col gap-2">
      <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {arrived ? "You're signed in" : "Signing you in…"}
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        {arrived
          ? "Taking you back to the shop."
          : "One moment while we finish setting up your account."}
      </p>
    </div>
  );
}

/** Google's mark, inline so the button needs no extra request. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-4 w-4 shrink-0">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.03l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.97l3.01 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}
