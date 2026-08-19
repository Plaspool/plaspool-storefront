"use client";

import * as React from "react";
import { createAuthClient } from "@neondatabase/auth/next";
import { Button, Input, Label, Separator, cn, NEO_SURFACE } from "@plaspool/ui";
import {
  completeSignIn,
  getShopCustomer,
  signOutEverywhere,
  type ShopCustomer,
  type SignInFailureReason,
} from "@plaspool/shop";

/**
 * `/sign-in` — the one page a customer uses to keep their basket, addresses
 * and order history across devices.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE BRIDGE RUNS FROM HERE.
 *
 * Neon Auth lands the customer back on this page after both paths that grant
 * it a session — the Google OAuth callback, and the magic-link click — so a
 * `useEffect` here that fires once a Neon session exists but the shop session
 * does not covers both without hooking either flow separately.
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
   * not need a Suspense boundary it did not previously have, and RESTRICTED TO
   * A SAME-SITE PATH: `next` arrives in a URL anybody can hand somebody else,
   * and a value like `https://evil.example` would turn this page into an open
   * redirect off the back of a real sign-in. Only a path beginning with a
   * single `/` is honoured — `//host` is a protocol-relative URL, not a path.
   */
  const returnTo = React.useMemo(() => {
    if (typeof window === "undefined") return "/sign-in";
    const next = new URLSearchParams(window.location.search).get("next");
    return next && /^\/(?!\/)/.test(next) ? next : "/sign-in";
  }, []);
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

  const handleGoogle = React.useCallback(() => {
    void authClient.signIn.social({ provider: "google", callbackURL: returnTo });
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
          callbackURL: returnTo,
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

  const handleSignOut = React.useCallback(async () => {
    await signOutEverywhere();
    setCustomer(null);
    attempted.current = false;
  }, []);

  const working = form.kind === "bridging" || form.kind === "sending_link";

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-16 sm:py-24">
      {customer ? (
        <SignedInPanel customer={customer} onSignOut={handleSignOut} />
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

function SignedInPanel({
  customer,
  onSignOut,
}: {
  customer: ShopCustomer;
  onSignOut: () => void;
}) {
  const [signingOut, setSigningOut] = React.useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          You&apos;re signed in
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{customer.email}</span>.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={signingOut}
        onClick={() => {
          setSigningOut(true);
          onSignOut();
        }}
        className={cn(
          "h-12 w-full justify-center border-2 border-foreground bg-background text-base text-foreground hover:bg-background",
          NEO_SURFACE,
        )}
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>
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
