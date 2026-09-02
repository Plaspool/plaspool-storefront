"use client";

import { ArrowLeft } from "lucide-react";
import { cn } from "@plaspool/ui";

import { introDismissed } from "./intro-dismissed";

/**
 * Where the shopper is in the return dialog, and the way back.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A TWO-STEP FLOW, DELIBERATELY NOT A CAROUSEL.
 *
 * `FeaturedCarousel` in `packages/blog` sets `aria-roledescription="carousel"`
 * and is right to: its slides are peers, browsing them costs nothing, and
 * there is no order in which they must be read. Neither is true here. Step two
 * is a form that submits a real pickup request, step one is the explanation
 * that precedes it, and telling a screen-reader user to expect rotating
 * content would promise them the wrong thing. So: `aria-current="step"`, a
 * named group, and no roledescription at all.
 *
 * ═══ THE DOTS ARE BUTTONS, AND THE POSITION NEVER MOVES ═══
 * An indicator that is only an indicator is a control a mouse user can see and
 * a keyboard user cannot reach, so each dot is a real `<button>` carrying its
 * own name — the same choice `FeaturedCarousel`'s dots make, and for the same
 * reason: the circle is 8px and the label is what makes it a control.
 *
 * This bar sits in ONE place, above the step content, on BOTH steps. The
 * alternative considered was putting it in each step's own footer, which would
 * have moved the indicator between screens and put a second row of controls
 * under `ReturnForm`'s full-width submit — two things competing to be the last
 * thing on the screen.
 *
 * ═══ NO BACK CONTROL ON THE FIRST STEP ═══
 * Not disabled, absent. A disabled control is one a shopper spends attention
 * deciding whether to press; there is simply nothing behind step one, and the
 * dialog's own × is how you leave from there.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type ReturnStep = "intro" | "form";

/** Named here rather than at each call site so the dots, the labels and the
 *  ordering cannot disagree. No programme noun in either: an operator renaming
 *  the scheme does not rename "how it works". */
const STEPS: { id: ReturnStep; label: string }[] = [
  { id: "intro", label: "How it works" },
  { id: "form", label: "Your request" },
];

/**
 * The step a freshly-opened dialog should show.
 *
 * ═══ ASKED ON EVERY OPEN, NEVER ONCE AT MOUNT ═══
 * A `ReturnsCta` stays mounted for as long as the page it sits in — the
 * announcement bar's instance survives every navigation inside `(shop)` — so
 * a flag read at mount would be a flag read before the shopper had any chance
 * to set it. It can change between two opens of the SAME mounted dialog (the
 * box ticked in the previous open) or in another tab entirely, which is the
 * same reason `ReturnModal` re-reads the session on every open rather than
 * trusting the last answer.
 *
 * Here rather than inline in `ReturnModal` so it is reachable by a suite that
 * cannot render past a Radix portal — see this file's header.
 */
export function stepOnOpen(): ReturnStep {
  return introDismissed() ? "form" : "intro";
}

export interface ReturnStepsProps {
  step: ReturnStep;
  onSelect: (step: ReturnStep) => void;
}

export function ReturnSteps({ step, onSelect }: ReturnStepsProps) {
  const index = STEPS.findIndex((s) => s.id === step);

  return (
    /* THREE COLUMNS SO THE DOTS ARE TRULY CENTRED, and that is a collision fix
       rather than a taste: `DialogContent` puts its × at `absolute right-4
       top-4`, which is exactly where a `justify-between` row would have put
       them. Centring also means the indicator does not shift when "Back"
       appears beside it on the second step. */
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
      {/* Renders nothing on the first step. The column holds the row's left
          edge regardless, so the dots do not move when "Back" appears. */}
      {index > 0 ? (
        <button
          type="button"
          onClick={() => onSelect(STEPS[index - 1]!.id)}
          className={cn(
            "-ml-2 mr-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1",
            "text-sm text-muted-foreground hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
            "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>
      ) : (
        <span />
      )}

      <div role="group" aria-label="Progress" className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const current = s.id === step;
          return (
            <button
              key={s.id}
              type="button"
              aria-current={current ? "step" : undefined}
              onClick={() => onSelect(s.id)}
              className={cn(
                "h-2 w-2 rounded-full transition-colors motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                current ? "bg-foreground" : "bg-brand-line hover:bg-muted-foreground",
              )}
            >
              <span className="sr-only">{`Step ${i + 1} of ${STEPS.length}: ${s.label}`}</span>
            </button>
          );
        })}
      </div>

      {/* The third column. Empty on purpose — it is what centres the dots. */}
      <span />
    </div>
  );
}
