"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, MapPin } from "lucide-react";
import { Button, Skeleton, SkeletonRegion } from "@plaspool/ui";

import { Avatar } from "./avatar";
import { readShopSession, signOutEverywhere, type ShopCustomer } from "../data/auth-api";
import { listSavedAddresses } from "../data/orders-api";
import { readSavedAddress } from "../checkout/saved-address";
import type { Address } from "../data/checkout-api";
import { AccountShell } from "./account-shell";

/**
 * `/account/settings` — who you are signed in as, and the things that can
 * actually be done about it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS DELIBERATELY DOES NOT DO IS PRETEND TO BE A PROFILE EDITOR.
 *
 * There is no endpoint to change an email or a display name — identity comes
 * from the auth provider, and the shop's `shop_customers` row is keyed on the
 * email that arrives across the bridge. A form that looked editable and then
 * had nowhere to submit would be worse than no page: it would promise something
 * the shop cannot do.
 *
 * So this states the account plainly, says where the parts of it are changed
 * that CAN be changed, and offers the one action that is genuinely here —
 * signing out. When a profile endpoint exists, this is where it goes.
 *
 * ═══ AND IT SHOWS THE ADDRESSES, WHICH IS WHAT MAKES IT A PAGE ═══
 * The first cut listed Orders, Help & support and Sign out — every one of which
 * is in the menu you clicked "Account settings" from, so the page was a second
 * copy of its own entry point. Meanwhile the shop knows every address the
 * shopper has shipped to and surfaced them nowhere but inside a checkout, while
 * the sign-in page promises "your basket, addresses and order history follow
 * you". This is where the addresses live. They are read-only for the same
 * reason the email is: they are derived from orders, so there is nothing to
 * edit — an order is a record of something that happened.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function AccountSettingsPage() {
  const router = useRouter();
  const [state, setState] = React.useState<
    | { kind: "loading" }
    | { kind: "guest" }
    | { kind: "failed" }
    | { kind: "ready"; customer: ShopCustomer }
  >({ kind: "loading" });
  const [signingOut, setSigningOut] = React.useState(false);
  const [addresses, setAddresses] = React.useState<Address[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    void readShopSession().then((result) => {
      if (cancelled) return;
      /* An unreachable API is not a signed-out shopper — see `orders-list.tsx`.
         Reported here rather than redirected: being bounced to a login screen
         by a timeout is the same lie the header was fixed to stop telling. */
      if (result.kind === "unknown") {
        setState({ kind: "failed" });
        return;
      }
      const customer = result.kind === "customer" ? result.customer : null;
      if (!customer) {
        setState({ kind: "guest" });
        /* `?next=` SO SIGNING IN RETURNS YOU HERE. Without it a shopper whose
           session expired was bounced to a generic sign-in page and then
           abandoned on it — the destination they asked for forgotten. */
        router.replace(`/sign-in?next=${encodeURIComponent("/account/settings")}`);
        return;
      }
      setState({ kind: "ready", customer });
      void listSavedAddresses().then((saved) => {
        if (cancelled) return;
        setAddresses(saved.map(readSavedAddress).filter((a): a is Address => a !== null));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state.kind === "failed") {
    return (
      <Shell>
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Account
        </h1>
        <p
          role="alert"
          /* WAS `red-700`, HAND-PICKED. Same colour, now a token
             (`--destructive-strong`), so the one grep in
             `destructive-text.test.ts` can hold every failure line in this
             folder to it instead of each one being someone's memory. */
          className="mt-6 border border-destructive-strong px-4 py-3 font-sans text-sm text-destructive-strong"
        >
          We couldn&apos;t reach your account just now. This doesn&apos;t mean you&apos;re signed
          out — try again in a moment.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.location.reload()}
          className="mt-4"
        >
          Try again
        </Button>
      </Shell>
    );
  }

  if (state.kind !== "ready") {
    /* The layout is known, so it is drawn — see `CLAUDE.md`, "Loading states". */
    return (
      <Shell>
        <SkeletonRegion label="Loading your account">
          <Skeleton className="h-8 w-56 sm:h-9" />
          <div className="mt-8 flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-52" />
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-3 border-t border-brand-line pt-6">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </SkeletonRegion>
      </Shell>
    );
  }

  const { customer } = state;
  const name = customer.name?.trim();

  return (
    <Shell>
      <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Account
      </h1>

      <div className="mt-8 flex items-center gap-3">
        <Avatar
          name={customer.name}
          email={customer.email}
          colourKey={customer.id}
          className="h-12 w-12 text-base"
        />
        <div className="min-w-0">
          <p className="truncate font-sans text-base font-semibold text-foreground">
            {name || customer.email}
          </p>
          {name && (
            <p className="truncate font-sans text-sm text-muted-foreground">{customer.email}</p>
          )}
        </div>
      </div>

      <p className="mt-6 font-sans text-sm text-muted-foreground">
        You&apos;re signed in with this email address. It comes from the account you signed in
        with, so it isn&apos;t changed here — sign in with a different one to use a different
        address.
      </p>

      <section aria-labelledby="account-addresses" className="mt-10">
        <h2
          id="account-addresses"
          className="border-b border-brand-line pb-2 font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Delivery addresses
        </h2>
        {addresses.length === 0 ? (
          <p className="mt-4 font-sans text-sm text-muted-foreground">
            Nowhere yet. Addresses appear here once something has been delivered to them, and
            they&apos;re offered at checkout so you don&apos;t retype them.
          </p>
        ) : (
          <>
            <ul className="mt-4 flex flex-col divide-y divide-brand-line border-b border-brand-line">
              {addresses.map((a, i) => (
                <li key={`${a.line1}-${i}`} className="flex items-start gap-3 py-3">
                  <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <address className="min-w-0 font-sans text-sm not-italic">
                    <span className="block font-medium text-foreground">{a.name}</span>
                    <span className="block text-muted-foreground">
                      {[a.line1, a.line2, a.city, a.region, a.postalCode].filter(Boolean).join(", ")}
                    </span>
                    {a.phone && <span className="block text-muted-foreground">{a.phone}</span>}
                  </address>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-sans text-xs text-muted-foreground">
              These are the addresses your orders went to, so there is nothing to edit here —
              checkout offers them, and a new one is saved by using it.
            </p>
          </>
        )}
      </section>

      <Button
        type="button"
        variant="outline"
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true);
          await signOutEverywhere();
          router.refresh();
          router.push("/");
        }}
        className="mt-8 gap-2"
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
