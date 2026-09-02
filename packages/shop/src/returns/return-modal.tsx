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

import { DIALOG_BOTTOM_INSET, ReturnForm } from "./return-form";
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
 * The breathing room at the bottom of a step, which `DialogContent` no longer
 * provides — see the `pb-0` note at the call site for why it cannot.
 *
 * Re-exported from `ReturnForm` rather than declared here so the pinned bar,
 * the confirmation card and every non-form step are provably the same number:
 * they all draw the bottom of this one dialog, and a disagreement between them
 * shows up as the dialog's bottom edge changing depth depending on which state
 * you happen to be looking at.
 */
export const STEP_BOTTOM_INSET = DIALOG_BOTTOM_INSET;

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
    const region = stepRef.current;
    if (!region) return;

    /*
     * ═══ `preventScroll`, AND THEN THE SCROLL BY HAND ═══
     * A plain `.focus()` here dumped the shopper at the BOTTOM of the form.
     * Focusing scrolls the element into view, and the browser does that by
     * moving the minimum distance needed — for a region TALLER than the
     * scrollport, "the minimum" is to align its bottom edge, so pressing
     * "Next" landed on the submit with every field scrolled off above it.
     *
     * The two halves are both needed. `preventScroll` stops the browser
     * choosing, and the explicit reset is what actually puts the shopper at
     * the top of the step they just asked for — the dialog keeps whatever
     * scroll offset the PREVIOUS step left behind otherwise, since it is one
     * scroll container reused across both.
     */
    region.focus({ preventScroll: true });
  }, [step]);

  /** The dialog's scroll container — `DialogContent` itself, which Radix
   *  renders with `role="dialog"`. Found by role rather than by
   *  `parentElement` so an extra wrapper between the two cannot silently
   *  break it. */
  function scroller(): Element | null {
    return stepRef.current?.closest('[role="dialog"]') ?? null;
  }

  /* The one step that ends in a pinned bar, and so supplies its own bottom
     inset. Every other step — the explanation, the sign-in prompt, the
     loading skeleton — ends in ordinary flowed content and needs the dialog's
     old padding back. */
  const barCarriesInset = step === "form" && session === "customer";

  function goTo(next: ReturnStep) {
    if (next === step) return;
    moved.current = true;
    /* SYNCHRONOUSLY, HERE — not in the effect above. Both steps share one
       scroll container, so the incoming step inherits whatever offset the
       outgoing one left. Resetting in an effect is allowed to run after
       paint, which lets the new step render one frame at the old offset and
       then snap, mid-way through its own entrance animation. Doing it in the
       handler means the scroll is already 0 before React re-renders, and
       there is no frame to catch. */
    const el = scroller();
    if (el) el.scrollTop = 0;
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
      {/* A bottom sheet on a phone, the centred dialog everywhere else — one
          mounted dialog either way, switched in CSS. See `SHEET_ON_MOBILE` in
          `@plaspool/ui`'s `dialog.tsx` for why this is not a `Sheet`.

          ═══ `pb-0`, AND IT IS LOAD-BEARING ═══
          This is the scroll container. A sticky footer inside it is confined
          to its containing block — the `<form>` — whose content box STOPS
          where this element's bottom padding starts. With any padding here,
          `bottom-0` parks the pinned bar that far above the true bottom edge
          and every field scrolls visibly through the strip underneath it,
          which is precisely the defect this fixes: the District select was
          showing below the "Send return request" bar.

          So the bottom inset belongs to whatever sits at the end of a step,
          never to the scroller: the pinned bar carries it for the form, and
          `STEP_BOTTOM_INSET` below carries it for every other step. */}
      {/* `scroll-pb-24` = 96px of scroll padding at the bottom, which is what
          makes `scrollIntoView` inside this scroller aim ABOVE the pinned bar
          rather than underneath it. The bar measures 89px in the centred
          dialog and 77px on the sheet (hairline + `pt` + `h-12` + inset), so
          without this, `block: "nearest"` parks an error message in exactly
          the band the bar covers — the message is placed, the scroll happens,
          and the shopper still sees nothing. Set on the scroller so every
          scroll-into-view in the form inherits it, rather than each call site
          remembering a magic number. */}
      <DialogContent mobile="sheet" className="pb-0 scroll-pb-24">
        {/* Required by Radix for the dialog's accessible name. `program.name`,
            never a spelled noun — the same choice the page's `<h1>` makes.
            `sr-only` on the explanation step, where `ReturnIntro`'s slogan is
            the visible heading and this would be a second one above it. */}
        {/* ═══ THE STEP BAR IS ROW ONE, ON BOTH STEPS, AND THAT IS THE POINT ═══
            It used to sit below the title/description group, which is
            `sr-only` on the explanation step — and `sr-only` is
            `position:absolute`, so that group occupies no grid row there at
            all. The indicator was therefore row 1 on one step and row 2 on
            the other, and jumped ~68px between them with no transition, while
            the content beside it slid a decorative 16px. The one element whose
            whole job is to hold still was the one that moved furthest.
            Putting it first makes its position independent of whether
            anything above it is rendered. */}
        <ReturnSteps step={step} onSelect={goTo} />

        {/* TITLE AND DESCRIPTION ARE ONE GROUP, not two rows of the dialog's
            grid. As siblings they inherited its `gap-4`, so a heading sat 16px
            off its own subtitle — the same distance as from there to the form,
            which flattens the hierarchy into evenly spaced things instead of a
            header followed by content. `gap-1` binds the pair.

            THE HAIRLINE DOES THE SEPARATING, not more space. The dialog's own
            `gap-4`/`gap-3` between groups is SMALLER than the `gap-5`/`gap-3.5`
            between fields inside the form, so spacing alone said the header
            was part of the form. Winning that with a bigger gap would mean an
            arms race against the form's own rhythm; a rule is what both
            overlay comparators in this package already use — see
            `filter-drawer.tsx`'s header `border-b` and `cart-drawer.tsx`'s
            footer `border-t`.

            The wrapper goes `sr-only` as a unit on the explanation step, where
            `ReturnIntro` owns every visible word — see its header. */}
        <div
          className={cn(
            "flex flex-col gap-1",
            step === "intro" ? "sr-only" : "border-b border-brand-line pb-4",
          )}
        >
          <DialogTitle>{program.name}</DialogTitle>
          <DialogDescription>
            {step === "intro" ? introDescription(program) : RETURNS_DESCRIPTION}
          </DialogDescription>
        </div>

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
            /* Every step owns its own bottom inset now, EXCEPT the one whose
               pinned bar already carries it — putting it here as well would
               re-open the very gap the bar exists to close. */
            !barCarriesInset && STEP_BOTTOM_INSET,
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
                <ReturnForm
                  program={program}
                  areas={areas}
                  /* Only from here. `/returns` renders the same form with no
                     scrolling ancestor to pin against — see the prop's own
                     note for what that would do instead. */
                  pinSubmit
                  onDone={() => onOpenChange(false)}
                />
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
