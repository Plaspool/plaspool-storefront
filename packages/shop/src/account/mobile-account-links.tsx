"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LifeBuoy, LogOut, Package, Settings, User } from "lucide-react";
import { SheetClose, cn } from "@plaspool/ui";

import { Avatar } from "./avatar";
import { getShopCustomer, signOutEverywhere, type ShopCustomer } from "../data/auth-api";

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
  const [customer, setCustomer] = React.useState<ShopCustomer | null>(null);
  const [signingOut, setSigningOut] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void getShopCustomer().then((next) => {
      if (!cancelled) setCustomer(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

      <button
        type="button"
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true);
          await signOutEverywhere();
          setCustomer(null);
          router.refresh();
          router.push("/");
        }}
        className={cn(linkClassName, "w-full text-left disabled:opacity-60")}
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
