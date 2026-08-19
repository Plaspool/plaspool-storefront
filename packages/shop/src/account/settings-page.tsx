"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LifeBuoy, LogOut, Package } from "lucide-react";
import { Button, Skeleton, SkeletonRegion, cn } from "@plaspool/ui";

import { Avatar } from "./avatar";
import { getShopCustomer, signOutEverywhere, type ShopCustomer } from "../data/auth-api";

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
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function AccountSettingsPage() {
  const router = useRouter();
  const [state, setState] = React.useState<
    { kind: "loading" } | { kind: "guest" } | { kind: "ready"; customer: ShopCustomer }
  >({ kind: "loading" });
  const [signingOut, setSigningOut] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void getShopCustomer().then((customer) => {
      if (cancelled) return;
      if (!customer) {
        setState({ kind: "guest" });
        router.replace("/sign-in");
        return;
      }
      setState({ kind: "ready", customer });
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

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

      <div className="mt-8 flex flex-col divide-y divide-brand-line border-y border-brand-line">
        <Row href="/account/orders" icon={<Package aria-hidden="true" className="h-4 w-4" />}>
          Orders
          <span className="block font-sans text-xs text-muted-foreground">
            Everything you&apos;ve bought, and where it is
          </span>
        </Row>
        <Row href="/contact" icon={<LifeBuoy aria-hidden="true" className="h-4 w-4" />}>
          Help &amp; support
          <span className="block font-sans text-xs text-muted-foreground">
            Ask about an order, a delivery or a refund
          </span>
        </Row>
      </div>

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

function Row({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-start gap-3 py-4 font-sans text-sm font-medium text-foreground",
        "transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0">{children}</span>
    </Link>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">{children}</div>;
}
