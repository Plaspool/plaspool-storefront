"use client";

import * as React from "react";
import { Link } from "../components/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, LogOut, Package, Settings, User } from "lucide-react";
import { SheetClose, cn } from "@plaspool/ui";

import { Avatar } from "./avatar";
import { signInHref } from "./sign-in-href";
import { readShopSession, signOutEverywhere, type ShopCustomer, type ShopSession } from "../data/auth-api";

/**
 * The account actions inside the mobile menu.
 *
 * THE SAME SET AS THE DROPDOWN, laid out for touch rather than nested in one —
 * a sheet that is already a list of links should not open a second list inside
 * itself, and a dropdown inside a sheet is two dismissal gestures deep.
 *
 * The sheet used to carry a single "Account" link whose destination flipped
 * after a session probe, so a signed-in shopper on a phone had no way to sign
 * out at all.
 */
export function MobileAccountLinks({ linkClassName }: { linkClassName: string }) {
  /* The same return path the dropdown carries — see `sign-in-href.ts`. */
  const signIn = signInHref(usePathname());
  const [session, setSession] = React.useState<ShopSession>({ kind: "unknown" });
  const [signingOut, setSigningOut] = React.useState(false);
  const customer = session.kind === "customer" ? session.customer : null;

  React.useEffect(() => {
    let cancelled = false;
    void readShopSession().then((next) => {
      if (!cancelled) setSession(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * The sheet unmounts when closed, so this remounts and re-probes on every
   * open — and rendering "Sign in" while it does would flash the wrong state at
   * a signed-in shopper each time.
   *
   * BUT A SKELETON HERE WAS A DEAD END. The probe never retries, so on a failed
   * one it shimmered forever: a loading state that cannot finish is worse than
   * an honest neutral control. "Account" points at `/sign-in`, which resolves
   * the session itself and forwards a shopper who already has one straight
   * back here, so it is correct whichever the answer turns out to be.
   */
  if (session.kind === "unknown") {
    return (
      <SheetClose asChild>
        <Link href={signIn} className={linkClassName}>
          <User aria-hidden="true" className="h-4 w-4" />
          Account
        </Link>
      </SheetClose>
    );
  }

  if (!customer) {
    return (
      <SheetClose asChild>
        <Link href={signIn} className={linkClassName}>
          <User aria-hidden="true" className="h-4 w-4" />
          Sign in
        </Link>
      </SheetClose>
    );
  }

  return (
    <SignedInAccountLinks
      customer={customer}
      linkClassName={linkClassName}
      signingOut={signingOut}
      onSignOut={async () => {
        setSigningOut(true);
        /* The navigation is `signOutEverywhere`'s own, and it is a full
           document load — see `auth-api.ts`. */
        await signOutEverywhere("/");
      }}
    />
  );
}

/**
 * The signed-in half of the mobile menu.
 *
 * SPLIT OUT SO IT CAN BE RENDERED WITHOUT A SESSION PROBE. The parent only
 * reaches this branch after `readShopSession()` answers with a customer, which
 * happens in an effect — and effects do not run under `react-dom/server`, so
 * for as long as this markup lived inside the parent there was no way to render
 * it in a test at all. That is precisely how a crash in here reached
 * production: every automated check of this file could only ever see the
 * signed-OUT branches.
 */
export function SignedInAccountLinks({
  customer,
  linkClassName,
  signingOut,
  onSignOut,
}: {
  customer: ShopCustomer;
  linkClassName: string;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  const label = customer.name?.trim() || customer.email;

  return (
    <div className="flex flex-col">
      {/* Which account, before the actions on it — the same question the
          dropdown's header answers. */}
      <div className="flex items-center gap-2 px-1 py-2">
        <Avatar name={customer.name} email={customer.email} colourKey={customer.id} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">
            {label}
          </span>
          {customer.name?.trim() && (
            <span className="block truncate text-xs text-muted-foreground">
              {customer.email}
            </span>
          )}
        </span>
      </div>

      {/* ONE `SheetClose` PER LINK, and never one wrapped around several.
          These two shared a single `asChild` close, which Radix's `Slot`
          refuses — `React.Children.count(children) > 1` throws — so the whole
          page went to the error boundary as "Something went wrong" the moment
          this branch rendered. It only reached signed-in shoppers, and only
          after `readShopSession()` resolved, so the menu appeared to work for a
          second before taking the page down with it. */}
      <SheetClose asChild>
        <Link href="/account" className={linkClassName}>
          <User aria-hidden="true" className="h-4 w-4" />
          Your account
        </Link>
      </SheetClose>
      <SheetClose asChild>
        <Link href="/account/orders" className={linkClassName}>
          <Package aria-hidden="true" className="h-4 w-4" />
          Orders
        </Link>
      </SheetClose>
      <SheetClose asChild>
        <Link href="/account/settings" className={linkClassName}>
          <Settings aria-hidden="true" className="h-4 w-4" />
          Account settings
        </Link>
      </SheetClose>
      <SheetClose asChild>
        <Link href="/contact" className={linkClassName}>
          <LifeBuoy aria-hidden="true" className="h-4 w-4" />
          Help &amp; support
        </Link>
      </SheetClose>

      {/* WRAPPED LIKE EVERY SIBLING. It was the one row not inside a
          `SheetClose`, and Radix's uncontrolled Sheet does not close on a route
          change — so signing out left the menu open, scroll-locked and
          focus-trapped over the page it had just pushed you to, now offering
          "Sign in". */}
      <SheetClose asChild>
        <button
          type="button"
          disabled={signingOut}
          onClick={onSignOut}
          className={cn(linkClassName, "w-full text-left disabled:opacity-60")}
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </SheetClose>
    </div>
  );
}
