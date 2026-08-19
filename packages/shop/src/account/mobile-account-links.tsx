"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LifeBuoy, LogOut, Package, Settings, User } from "lucide-react";
import { SheetClose, Skeleton, SkeletonRegion, cn } from "@plaspool/ui";

import { Avatar } from "./avatar";
import { readShopSession, signOutEverywhere, type ShopSession } from "../data/auth-api";

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
  const router = useRouter();
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

  /* The sheet unmounts when closed, so this remounts and re-probes on every
     open. Rendering "Sign in" while it does would flash the wrong state at a
     signed-in shopper each time — so until the answer arrives, it draws the
     shape of the answer instead of guessing at it. */
  if (session.kind === "unknown") {
    return (
      <SkeletonRegion label="Checking your account" className="flex flex-col gap-3 px-1 py-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
      </SkeletonRegion>
    );
  }

  if (!customer) {
    return (
      <SheetClose asChild>
        <Link href="/sign-in" className={linkClassName}>
          <User aria-hidden="true" className="h-4 w-4" />
          Sign in
        </Link>
      </SheetClose>
    );
  }

  const label = customer.name?.trim() || customer.email;

  return (
    <div className="flex flex-col">
      {/* Which account, before the actions on it — the same question the
          dropdown's header answers. */}
      <div className="flex items-center gap-2 px-1 py-2">
        <Avatar name={customer.name} email={customer.email} colourKey={customer.id} />
        <span className="min-w-0">
          <span className="block truncate font-sans text-sm font-semibold text-foreground">
            {label}
          </span>
          {customer.name?.trim() && (
            <span className="block truncate font-sans text-xs text-muted-foreground">
              {customer.email}
            </span>
          )}
        </span>
      </div>

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
          onClick={async () => {
            setSigningOut(true);
            await signOutEverywhere();
            setSession({ kind: "guest" });
            router.refresh();
            router.push("/");
          }}
          className={cn(linkClassName, "w-full text-left disabled:opacity-60")}
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </SheetClose>
    </div>
  );
}
