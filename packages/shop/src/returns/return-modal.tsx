"use client";

import * as React from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Skeleton,
  SkeletonRegion,
  TextSkeleton,
  cn,
} from "@plaspool/ui";

import { ReturnForm } from "./return-form";
import { readShopSession } from "../data/auth-api";
import type { ShopSession } from "../data/auth-api";
import type { ServiceArea } from "../data/returns-api";
import type { RewardsProgram } from "../data/marketing";

/**
 * The request form, opened as a dialog over whatever page the shopper was on.
 *
 * ═══ GUEST HANDLING LIVES HERE, NOT IN `ReturnForm` ═══
 * `ReturnForm` already has an `unauthenticated` branch of its own, but that
 * one is for a session that dies WHILE the shopper is filling the form in —
 * see that file's header. This dialog can be opened by a shopper who was
 * never signed in to begin with, and asking `ReturnForm` to also own that
 * would be the same state living in two places. So the check happens once,
 * here, before the form is ever mounted.
 *
 * ═══ THREE STATES, AND `kind: "unknown"` IS NOT A THIRD KIND OF "NO" ═══
 * `readShopSession()`'s own header explains why the distinction exists: a
 * flaky connection once told a signed-in shopper they were signed out,
 * permanently. So a session that could not be read renders NEITHER the form
 * NOR a sign-in prompt — only the skeleton of the form's own box, for as long
 * as the answer stays unknown. Re-checked every time the dialog opens, on the
 * chance the shopper signed in or out in another tab since the last time.
 *
 * ═══ `onDone` CLOSES THIS DIALOG, AND ONLY FROM THE CONFIRMATION ═══
 * `ReturnForm`'s own header is explicit that `onDone` fires from the
 * confirmation's "Done" control, never automatically on a successful submit —
 * doing that here would unmount the form in the same tick React would
 * otherwise paint the one screen `requestId` is ever shown on. Do not "fix"
 * this by closing on success.
 */
export interface ReturnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: RewardsProgram;
  areas: ServiceArea[];
}

/** The one line of framing this dialog needs, identical to `/returns`'s own
 *  intro paragraph — the page and the dialog are two presentations of one
 *  form. No unit or points noun here; the form's own arithmetic line is
 *  where those are spelled, from `program`. */
const RETURNS_DESCRIPTION = "Tell us how many you're sending back and where to collect them.";

export function ReturnModal({ open, onOpenChange, program, areas }: ReturnModalProps) {
  const [session, setSession] = React.useState<ShopSession["kind"]>("unknown");

  React.useEffect(() => {
    if (!open) return;
    /* Re-checked on every open rather than trusted from the last one — the
       whole point of asking again is that it can have changed since. Not
       reset to "unknown" first: `session` already starts there for the very
       first open, and on a later one the last answer is still the best guess
       available until this read lands, with `ReturnForm`'s own `unauthenticated`
       branch as the backstop if a stale "customer" turns out to be wrong by
       the time the shopper actually submits. */
    let cancelled = false;
    void readShopSession().then((result) => {
      if (!cancelled) setSession(result.kind);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Required by Radix for the dialog's accessible name. `program.name`,
            never a spelled noun — the same choice the page's `<h1>` makes. */}
        <DialogTitle>{program.name}</DialogTitle>
        <DialogDescription>{RETURNS_DESCRIPTION}</DialogDescription>

        {session === "customer" && (
          <ReturnForm program={program} areas={areas} onDone={() => onOpenChange(false)} />
        )}
        {session === "guest" && <GuestPrompt />}
        {session === "unknown" && <FormSkeleton />}
      </DialogContent>
    </Dialog>
  );
}

/** A shopper who opened the dialog without ever having signed in. Styled the
 *  same way `ReturnForm` styles its own `already-open` and `sign-in`
 *  placements, for the one form the two files share the look of. */
function GuestPrompt() {
  return (
    <div className="border-2 border-foreground bg-brand-soft px-4 py-3">
      <p className="font-sans text-sm font-semibold text-foreground">
        Sign in to send a return request.
      </p>
      <p className="mt-0.5 font-sans text-sm text-muted-foreground">
        Signing in will bring you back here.
      </p>
      <Link
        href={`/sign-in?next=${encodeURIComponent("/returns")}`}
        className="mt-1.5 inline-block font-sans text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Sign in
      </Link>
    </div>
  );
}

/**
 * The wait, drawn as the form's own shape — one box per field, at that
 * field's own control height, in the form's own `gap-5` rhythm. Matches
 * `ReturnForm`'s real geometry: `h-10` inputs and the district select,
 * the textarea's `min-h-[80px]`, and the `h-12` submit button.
 */
function FormSkeleton() {
  return (
    <SkeletonRegion label="Checking your account" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <TextSkeleton className="w-56 max-w-full font-sans text-sm" />
        <Skeleton className="h-10 w-full rounded-md" />
        {/* The arithmetic line under the quantity field. */}
        <TextSkeleton className="mt-1.5 w-40 max-w-full font-sans text-xs" />
      </div>
      <FieldSkeleton width="w-16" />
      <FieldSkeleton width="w-16" />
      <FieldSkeleton width="w-32" controlClassName="h-20" />
      <FieldSkeleton width="w-24" />
      <Skeleton className="h-12 w-full rounded-md" />
    </SkeletonRegion>
  );
}

function FieldSkeleton({
  width,
  controlClassName = "h-10",
}: {
  width: string;
  controlClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <TextSkeleton className={cn(width, "font-sans text-sm")} />
      <Skeleton className={cn(controlClassName, "w-full rounded-md")} />
    </div>
  );
}
