"use client";

import * as React from "react";
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
import { GuestPrompt } from "./guest-prompt";
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
 * chance the shopper signed in or out in another tab since the last time —
 * and reset to "unknown" the instant it opens, so that re-check is honoured
 * on screen and not just on the wire. See the reset below `session` itself
 * for why that reset almost got lost to a lint fix.
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

/**
 * The dialog's one line of framing, under the title — and it has to stay
 * true across all THREE states below, not just the `customer` one that
 * shows the form.
 *
 * This used to be borrowed verbatim from `/returns`'s own intro paragraph
 * ("Tell us how many you're sending back..."), which was wrong here: that
 * sentence is only true once the form is actually on screen, and it was
 * rendering above a sign-in prompt and above a loading skeleton, describing
 * content that was not there yet. The page keeps the more specific line,
 * because the page only ever shows it directly above the real form — see
 * its own header for why the two diverged. No unit or points noun either
 * way; the form's own arithmetic line is where those are spelled, from
 * `program`.
 */
const RETURNS_DESCRIPTION = "Request a pickup for what you're sending back.";

export function ReturnModal({ open, onOpenChange, program, areas }: ReturnModalProps) {
  const [session, setSession] = React.useState<ShopSession["kind"]>("unknown");

  /*
   * RESET DURING RENDER, NOT INSIDE THE EFFECT BELOW.
   *
   * This is React's own sanctioned "adjust state when a prop changes"
   * pattern — https://react.dev/learn/you-might-not-need-an-effect — and it
   * exists here because a previous version of this file dropped the reset
   * entirely to satisfy `react-hooks/set-state-in-effect`, which quietly
   * inverted the doctrine above: without it, once `session` had been
   * anything other than "unknown", every LATER open kept rendering that
   * STALE answer for the whole round trip of the fresh read underneath it —
   * a `guest` prompt with a live sign-in link shown to a shopper who had
   * since signed in elsewhere, or worse, a `customer` form unmounting
   * mid-type the moment the fresh read landed as `guest`. Exactly
   * `readShopSession()`'s own stated failure mode, reached by a different
   * route. Adjusting during render rather than in an effect means React
   * folds this into the same render pass instead of committing a stale
   * frame first, so the lint rule has nothing to object to.
   */
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession("unknown");
  }

  React.useEffect(() => {
    if (!open) return;
    // Re-checked on every open rather than trusted from the last one — the
    // whole point of asking again is that it can have changed since.
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
