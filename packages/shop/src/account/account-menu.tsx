"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { getShopCustomer, signOutEverywhere, type ShopCustomer } from "../data/auth-api";

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
 * THE SIZE IS FIXED BEFORE THE PROBE RESOLVES. The session check is async and
 * the control is in the header, so anything that changed size on resolve would
 * shift the whole nav a beat after paint. The glyph and the avatar are both
 * 28px inside the same button.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function AccountMenu({ className }: { className?: string }) {
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

  const signOut = React.useCallback(async () => {
    setSigningOut(true);
    await signOutEverywhere();
    /* BOTH, and in this order. `refresh()` re-runs the server components that
       may have rendered something identity-shaped; `setCustomer(null)` flips
       this control immediately rather than waiting for that round trip. */
    setCustomer(null);
    router.refresh();
    router.push("/");
  }, [router]);

  if (!customer) {
    return (
      <Button
        asChild
        variant="ghost"
        size="icon"
        aria-label="Sign in"
        className={cn(
          "xl:h-10 xl:w-auto xl:gap-2 xl:px-4 focus-visible:ring-brand focus-visible:ring-offset-background",
          className,
        )}
      >
        <Link href="/sign-in">
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
          className={cn(
            "xl:h-10 xl:w-auto xl:gap-2 xl:px-3 focus-visible:ring-brand focus-visible:ring-offset-background",
            className,
          )}
        >
          <Avatar name={customer.name} email={customer.email} colourKey={customer.id} />
          {/* The name is a nicety at the widest breakpoint only; the avatar is
              the control at every other one. `max-w` so a long name cannot
              stretch the header. */}
          <span className="hidden max-w-[10ch] truncate xl:inline">{label}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {/* WHICH ACCOUNT AM I IN. The commonest reason to open this menu on a
            shared machine, and it should not need a trip to a settings page. */}
        <div className="px-2 py-2">
          <p className="truncate font-sans text-sm font-semibold text-foreground">{label}</p>
          {customer.name?.trim() && (
            <p className="truncate font-sans text-xs text-muted-foreground">{customer.email}</p>
          )}
        </div>
        <DropdownMenuSeparator />

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
