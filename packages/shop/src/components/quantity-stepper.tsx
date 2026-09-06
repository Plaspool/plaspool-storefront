"use client";

import { Minus, Plus } from "lucide-react";
import { cn, TextSkeleton } from "@plaspool/ui";

/**
 * Minus, a mono figure, plus. Used in the buy box and on every cart line, so
 * the value is a polite live region — a keyboard user who holds the plus key
 * hears where they have got to.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ON A CART ROW, PRESSING IT USED TO DO NOTHING YOU COULD SEE.
 *
 * In the buy box the value is local state, so it moves on the same frame as the
 * click. On a cart row it is the SERVER's `qty` — the basket lives in the
 * commerce API and an edit is a round trip — so the figure cannot change until
 * the response lands, and nothing here said a request was in flight. For the
 * length of that round trip the control was indistinguishable from a broken
 * one, which is exactly how a shopper ends up pressing plus four times and
 * ordering four more than they meant to.
 *
 * `pending` is the fix, and the reason the figure becomes a SKELETON rather
 * than a spinner or a dimmed number: a dimmed number is a stale number still
 * being asserted, and the one honest thing to say about the quantity mid-write
 * is that we do not yet know it. `CLAUDE.md` ("Loading states") wants the shape
 * of what is coming, and what is coming is a figure of that exact size.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface QuantityStepperProps {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  /**
   * A write for THIS row is in flight: blank the figure and refuse further
   * presses until the server answers.
   *
   * Only cart surfaces pass it. The buy box's stepper is local state with no
   * round trip behind it, so a pending state there would be a placeholder over
   * a number that is already correct.
   */
  pending?: boolean;
  className?: string;
  /** Distinguishes the steppers on a cart with several lines. */
  label?: string;
}

const STEP_BUTTON =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors motion-reduce:transition-none hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  pending = false,
  className,
  label,
}: QuantityStepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-brand-line",
        className,
      )}
    >
      <button
        type="button"
        aria-label={label ? `Decrease quantity of ${label}` : "Decrease quantity"}
        disabled={pending || value <= min}
        onClick={() => onChange(clamp(value - 1))}
        className={STEP_BUTTON}
      >
        <Minus aria-hidden="true" className="h-4 w-4" />
      </button>
      <span
        role="status"
        aria-live="polite"
        /* `min-w-[2.5rem]` HOLDS THE BOX WHETHER OR NOT THERE IS A FIGURE IN
           IT, which is what lets the placeholder swap in without the two
           buttons sliding under the shopper's finger mid-press. */
        className="min-w-[2.5rem] px-1 text-center font-mono text-sm font-bold tabular-nums text-foreground"
      >
        <span className="sr-only">{label ? `Quantity of ${label}: ` : "Quantity: "}</span>
        {pending ? (
          /* ═══ A BAR, NOT THE OLD NUMBER GREYED OUT ═══
             The quantity mid-write is genuinely unknown — the server may clamp
             it to what is left — so showing the previous figure faintly is
             asserting something we are in the middle of finding out. The
             placeholder is `text-sm` like the figure it replaces, so it is that
             line's exact height and nothing moves when the real number lands.

             `aria-hidden` on the bar, because this `<span>` is already a polite
             live region: the label above it stays readable, and a screen reader
             is not asked to announce a rectangle. */
          <TextSkeleton aria-hidden="true" className="mx-auto w-4 text-sm" />
        ) : (
          value
        )}
      </span>
      <button
        type="button"
        aria-label={label ? `Increase quantity of ${label}` : "Increase quantity"}
        disabled={pending || value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className={STEP_BUTTON}
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
