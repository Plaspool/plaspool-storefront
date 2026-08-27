"use client";

import * as React from "react";
import { Link } from "../components/link";
import { usePathname, useRouter } from "next/navigation";
import { LifeBuoy, LogOut, Package, Settings, User } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@plaspool/ui";

import { Avatar } from "./avatar";
import { signInHref } from "./sign-in-href";
import { readShopSession, signOutEverywhere, type ShopSession } from "../data/auth-api";

/**
 * The header's account control.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT USED TO BE A LINK WEARING A DISGUISE. One grey `User` glyph rendered
 * whether somebody was signed in or not, and a one-shot session probe quietly
 * changed where it pointed — `/sign-in` for a guest, `/account/orders` once a
 * session resolved. So the nav gave no signal about session state at all, and a
 * signed-in shopper's only account action was "orders": no sign-out, no
 * support, nowhere to go.
 *
 * SIGNED OUT IT STAYS A LINK. A menu whose every item says "sign in first" is
 * worse than the link it replaced, so there is no menu until there is an
 * account to menu about.
 *
 * SIGNED IN IT IS A REAL MENU BUTTON. Radix supplies the roving focus, the
 * Escape handling and `aria-expanded`; what does not come free is the trigger's
 * accessible name, so it says who it belongs to rather than "Account".
 *
 * ═══ IT DOES NOT CLAIM YOU ARE SIGNED OUT UNTIL IT KNOWS ═══
 * The first cut initialised to `null` — the same value as confirmed-guest — so
 * the server HTML and every frame before the probe landed rendered "Sign in" to
 * a signed-in shopper, and a transport failure left it there permanently
 * because `getShopCustomer` collapsed a network error into `null` too.
 * `readShopSession` keeps `unknown` separate, and this renders a control with
 * no claim in it until the answer arrives. It cannot be server-rendered — the
 * session cookie is on the API's registrable domain, not this one — but "not
 * yet known" and "definitely nobody" are different, and only one of them is
 * safe to assert.
 *
 * THE SIZE IS FIXED ACROSS ALL THREE STATES, so the header does not shift a
 * beat after paint. That means a fixed width at `xl` too: the glyph branch and
 * the avatar-plus-name branch measured up to 39px apart, and the whole cluster
 * is `ml-auto`, so search and cart slid sideways when the probe landed.
 * ═══════════════════════════════════════════════════════════════════════════
 */
/**
 * ONE WIDTH FOR ALL THREE STATES. `w-10` below `xl` and a fixed `9rem` at `xl`,
 * so the unknown, guest and signed-in controls occupy the same box and the
 * header's right cluster never moves when the probe resolves.
 */
const ACCOUNT_SLOT = "h-10 w-10 shrink-0 xl:w-36 xl:justify-start xl:gap-2 xl:px-3";

export function AccountMenu({ className }: { className?: string }) {
  const router = useRouter();
  /* So signing in returns the shopper to the page they were looking at rather
     than to a fixed landing page — see `sign-in-href.ts`. `usePathname` and
     not `useSearchParams`: this control sits in `ShopShell`, so it renders on
     every shop route, and `useSearchParams` would opt all of them out of
     static rendering to preserve a filter. */
  const pathname = usePathname();
  const signIn = signInHref(pathname);
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

  const signOut = React.useCallback(async () => {
    setSigningOut(true);
    await signOutEverywhere();
    /* BOTH, and in this order. `refresh()` re-runs the server components that
       may have rendered something identity-shaped; `setCustomer(null)` flips
       this control immediately rather than waiting for that round trip. */
    setSession({ kind: "guest" });
    router.refresh();
    router.push("/");
  }, [router]);

  /*
   * NOT YET KNOWN — OR NOT KNOWABLE, since a failed probe never retries.
   *
   * The first version rendered a non-interactive, `aria-hidden` box: no false
   * claim, but also no control. On a failed probe that is permanent, so the
   * shop had no route to sign in at all and assistive tech could not see the
   * slot existed. Avoiding a lie is not worth removing the door.
   *
   * "Account" pointing at `/sign-in` claims nothing either way — that page
   * resolves the session itself, and a visitor who turns out to already have
   * one is forwarded straight back here rather than shown a form or a
   * dead-end panel. The label is the neutral one; only the resolved states
   * say "Sign in" or name a person.
   */
  if (session.kind === "unknown") {
    return (
      <Button
        asChild
        variant="ghost"
        size="icon"
        aria-label="Account"
        className={cn(ACCOUNT_SLOT, "focus-visible:ring-brand focus-visible:ring-offset-background", className)}
      >
        <Link href={signIn}>
          <User aria-hidden="true" className="h-4 w-4" />
          <span className="hidden xl:inline">Account</span>
        </Link>
      </Button>
    );
  }

  if (!customer) {
    return (
      <Button
        asChild
        variant="ghost"
        size="icon"
        aria-label="Sign in"
        className={cn(ACCOUNT_SLOT, "focus-visible:ring-brand focus-visible:ring-offset-background", className)}
      >
        <Link href={signIn}>
          <User aria-hidden="true" className="h-4 w-4" />
          <span className="hidden xl:inline">Sign in</span>
        </Link>
      </Button>
    );
  }

  const label = customer.name?.trim() || customer.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Account: ${label}`}
          className={cn(ACCOUNT_SLOT, "focus-visible:ring-brand focus-visible:ring-offset-background", className)}
        >
          <Avatar name={customer.name} email={customer.email} colourKey={customer.id} />
          {/* The name is a nicety at the widest breakpoint only; the avatar is
              the control at every other one. `truncate` inside a FIXED slot
              rather than `max-w` inside an auto one — the slot's width is the
              same in all three states, so nothing beside it can move. */}
          <span className="hidden min-w-0 truncate xl:inline">{label}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {/* WHICH ACCOUNT AM I IN. The commonest reason to open this menu on a
            shared machine, and it should not need a trip to a settings page. */}
        <div className="px-2 py-2">
          <p className="truncate text-sm font-semibold text-foreground">{label}</p>
          {customer.name?.trim() && (
            <p className="truncate text-xs text-muted-foreground">{customer.email}</p>
          )}
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/account" className="cursor-pointer gap-2">
            <User aria-hidden="true" className="h-4 w-4" />
            Your account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/orders" className="cursor-pointer gap-2">
            <Package aria-hidden="true" className="h-4 w-4" />
            Orders
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/settings" className="cursor-pointer gap-2">
            <Settings aria-hidden="true" className="h-4 w-4" />
            Account settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/contact" className="cursor-pointer gap-2">
            <LifeBuoy aria-hidden="true" className="h-4 w-4" />
            Help &amp; support
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signingOut}
          onSelect={(e) => {
            /* Radix closes the menu on select and unmounts the item; letting it
               do that mid-request would drop the promise. */
            e.preventDefault();
            void signOut();
          }}
          className="cursor-pointer gap-2"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
