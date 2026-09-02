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
import { ReturnIntro } from "./return-intro";
import { ReturnSteps, stepOnOpen } from "./return-steps";
import type { ReturnStep } from "./return-steps";
import { introDismissed, setIntroDismissed } from "./intro-dismissed";
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
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO STEPS: THE EXPLANATION, THEN THE FORM.
 *
 * `ReturnIntro` is what the programme IS; the three session states above are
 * how you join it. Both live in this one dialog because they are one errand,
 * and the shopper decides when to move between them — nothing here advances
 * on its own.
 *
 * ═══ THE EXPLANATION IS SHOWN TO EVERYONE, INCLUDING A GUEST ═══
 * The session branch moved DOWN a level: it now gates step two only. Step one
 * is public marketing that needs no account, and gating it would reproduce
 * exactly the defect `ReturnFormGate` was written to fix one file over — a
 * shopper told to sign in before being told what for. A guest now reads the
 * offer first and meets `GuestPrompt` only after choosing to act on it.
 *
 * ═══ WHICH STEP AN OPEN LANDS ON IS DECIDED DURING RENDER ═══
 * In the same `open !== wasOpen` block as the session reset below, not in an
 * effect. An effect would commit one frame of the explanation to a shopper who
 * ticked "don't show this again" — the flash is small, and it is the exact
 * thing they asked not to see. Reading `localStorage` during render is safe
 * HERE specifically because this branch only runs when `open` FLIPS, which on
 * the server never happens: `ReturnsCta` always mounts closed, so the initial
 * `wasOpen` equals `open` and the branch is skipped. `introDismissed()`
 * answers `false` where there is no storage anyway, so the server would render
 * the explanation rather than crash even if that ever stopped being true.
 * ═══════════════════════════════════════════════════════════════════════════
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

/**
 * The explanation step's accessible description — the sentence a screen reader
 * hears when the dialog opens, before it reaches the visible copy.
 *
 * Built from `program` like everything else: the same rule the whole package
 * follows, and the reason this is a function rather than a constant. Step one's
 * visible heading is `ReturnIntro`'s own slogan, so this and the title above it
 * are `sr-only` there — Radix's documented pattern for a dialog whose visible
 * heading is styled and placed differently from its accessible name.
 */
function introDescription(program: RewardsProgram): string {
  return `How ${program.name} works, and what you get for sending back your ${program.unitLabelPlural}.`;
}

export function ReturnModal({ open, onOpenChange, program, areas }: ReturnModalProps) {
  const [session, setSession] = React.useState<ShopSession["kind"]>("unknown");
  const [step, setStep] = React.useState<ReturnStep>("intro");
  /** The checkbox's own state. Separate from `step` on purpose: they read the
   *  same flag today, but "which screen do I open on" and "is the box ticked"
   *  are different questions, and only one of them is the shopper's to see. */
  const [dismissed, setDismissed] = React.useState(false);
  /* Which way the last move went, so the entering step slides in from the side
     it came from. Purely cosmetic, and `motion-reduce` drops it entirely. */
  const [forward, setForward] = React.useState(true);

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
    if (open) {
      setSession("unknown");
      /* Both asked fresh on every open, for the same reason the session is:
         the box may have been ticked in this dialog's own previous open, or in
         another tab, since this instance mounted. See the file header for why
         reading storage during render is safe at this one call site. */
      setStep(stepOnOpen());
      setDismissed(introDismissed());
      setForward(true);
    }
  }

  /*
   * Focus follows the step, but only when the SHOPPER moved it.
   *
   * The control that moves you is inside the step it leaves — "Earn <points>"
   * unmounts the instant it is pressed — so without this, focus lands back on
   * the dialog container and a keyboard user has to tab in from the top of a
   * screen they have already read. A ref rather than state gates it because
   * `react-hooks/set-state-in-effect` forbids the obvious version, and because
   * this is genuinely not rendered state: nothing on screen depends on whether
   * the last step change came from a click or from opening the dialog.
   */
  const stepRef = React.useRef<HTMLDivElement>(null);
  const moved = React.useRef(false);
  React.useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    stepRef.current?.focus();
  }, [step]);

  function goTo(next: ReturnStep) {
    if (next === step) return;
    moved.current = true;
    setForward(next === "form");
    setStep(next);
  }

  /* Persisted the moment it is ticked, NOT on the way to the next step. A
     shopper who ticks the box and then closes with × has still said what they
     want, and a preference that only counts if you keep going is a trap. */
  function onDismissedChange(next: boolean) {
    setDismissed(next);
    setIntroDismissed(next);
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
            never a spelled noun — the same choice the page's `<h1>` makes.
            `sr-only` on the explanation step, where `ReturnIntro`'s slogan is
            the visible heading and this would be a second one above it. */}
        <DialogTitle className={cn(step === "intro" && "sr-only")}>{program.name}</DialogTitle>
        <DialogDescription className={cn(step === "intro" && "sr-only")}>
          {step === "intro" ? introDescription(program) : RETURNS_DESCRIPTION}
        </DialogDescription>

        <ReturnSteps step={step} onSelect={goTo} />

        {/* `key={step}` restarts the entrance animation, which is what makes
            the move legible as movement rather than as the dialog silently
            becoming a different dialog — the same reasoning
            `FeaturedCarousel` re-keys its slide on. `tabIndex={-1}` exists
            only so the effect above has something to focus; it is never in
            the tab order. */}
        <div
          key={step}
          ref={stepRef}
          tabIndex={-1}
          className={cn(
            "outline-none duration-200 animate-in fade-in-0 motion-reduce:animate-none",
            forward ? "slide-in-from-right-4" : "slide-in-from-left-4",
          )}
        >
          {step === "intro" ? (
            <ReturnIntro
              program={program}
              dismissed={dismissed}
              onDismissedChange={onDismissedChange}
              onNext={() => goTo("form")}
            />
          ) : (
            <>
              {session === "customer" && (
                <ReturnForm program={program} areas={areas} onDone={() => onOpenChange(false)} />
              )}
              {session === "guest" && <GuestPrompt />}
              {session === "unknown" && <FormSkeleton />}
            </>
          )}
        </div>
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
        <TextSkeleton className="w-56 max-w-full text-sm" />
        <Skeleton className="h-10 w-full rounded-md" />
        {/* The arithmetic line under the quantity field. */}
        <TextSkeleton className="mt-1.5 w-40 max-w-full text-xs" />
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
      <TextSkeleton className={cn(width, "text-sm")} />
      <Skeleton className={cn(controlClassName, "w-full rounded-md")} />
    </div>
  );
}
