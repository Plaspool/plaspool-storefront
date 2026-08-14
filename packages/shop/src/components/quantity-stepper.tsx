"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@plaspool/ui";

/**
 * Minus, a mono figure, plus. Used in the buy box and on every cart line, so
 * the value is a polite live region — a keyboard user who holds the plus key
 * hears where they have got to.
 */

export interface QuantityStepperProps {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
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
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
        className={STEP_BUTTON}
      >
        <Minus aria-hidden="true" className="h-4 w-4" />
      </button>
      <span
        role="status"
        aria-live="polite"
        className="min-w-[2.5rem] px-1 text-center font-mono text-sm font-bold tabular-nums text-foreground"
      >
        <span className="sr-only">{label ? `Quantity of ${label}: ` : "Quantity: "}</span>
        {value}
      </span>
      <button
        type="button"
        aria-label={label ? `Increase quantity of ${label}` : "Increase quantity"}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className={STEP_BUTTON}
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
