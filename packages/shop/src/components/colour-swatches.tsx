"use client";

import * as React from "react";
import { cn } from "@plaspool/ui";

import type { Colour } from "../data/types";

/**
 * The one place an inline colour is correct: `hex` is the product, not a
 * styling decision.
 *
 * Two modes, and the difference is structural rather than cosmetic. Without
 * `onSelect` this is a list, because a product card is a single link and a
 * `<button>` inside an `<a>` is invalid markup that breaks keyboard use. With
 * `onSelect` it is a radio group with roving focus.
 */

const SWATCH: Record<NonNullable<ColourSwatchesProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
};

/** Cards truncate; a buy box must never hide a colour you could order. */
const STATIC_MAX = 6;

export interface ColourSwatchesProps {
  colours: Colour[];
  selectedId?: string;
  /** Supplying this switches the component into its interactive mode. */
  onSelect?: (id: string) => void;
  /** Defaults to six in the static mode and to "all of them" in the
   *  interactive one. */
  max?: number;
  /** Defaults to `sm` in the static mode and `md` in the interactive one,
   *  where the swatch is a tap target. */
  size?: "sm" | "md";
  className?: string;
  /** Names the group. Defaults to "Colours" / "Colour". */
  label?: string;
}

/** The disc itself, shared by both modes. */
function Swatch({
  colour,
  selected,
  size,
}: {
  colour: Colour;
  selected: boolean;
  size: NonNullable<ColourSwatchesProps["size"]>;
}) {
  return (
    <span
      className={cn(
        "relative block shrink-0 rounded-full ring-1 ring-brand-line",
        SWATCH[size],
        selected && "ring-2 ring-brand ring-offset-2 ring-offset-background",
      )}
    >
      <span
        className={cn("absolute inset-0 rounded-full", !colour.inStock && "opacity-40")}
        style={{ backgroundColor: colour.hex }}
      />
      {/* ═══ THE SOLD-OUT TREATMENT IS NOW A FALLBACK, NOT THE NORMAL PATH ═══
          Every caller filters through `availableColours()`, which drops
          out-of-stock colours rather than striking them: a 16px disc with a
          diagonal line and no name beside it reads as noise, and it spends a
          slot in a truncating row on something nobody can buy. What reaches
          here is the one case that helper cannot filter — a product whose
          EVERY colour is gone, where showing them struck is the only way to
          say "they are all gone" rather than "this product has no colours".

          Opacity alone is a colour cue; the strike is the one that survives
          low vision and greyscale. */}
      {!colour.inStock && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 rotate-45 bg-foreground"
        />
      )}
    </span>
  );
}

export function ColourSwatches({
  colours,
  selectedId,
  onSelect,
  max,
  size,
  className,
  label,
}: ColourSwatchesProps) {
  const interactive = typeof onSelect === "function";
  const limit = max ?? (interactive ? colours.length : STATIC_MAX);
  const resolvedSize = size ?? (interactive ? "md" : "sm");
  const shown = colours.slice(0, Math.max(0, limit));
  const overflow = colours.length - shown.length;

  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = React.useState<number | null>(null);

  if (shown.length === 0) return null;

  if (!interactive) {
    return (
      <ul
        aria-label={label ?? "Colours"}
        className={cn("flex flex-wrap items-center gap-1.5", className)}
      >
        {shown.map((colour) => (
          <li key={colour.id} aria-disabled={colour.inStock ? undefined : true}>
            <Swatch colour={colour} selected={colour.id === selectedId} size={resolvedSize} />
            <span className="sr-only">
              {colour.inStock ? colour.name : `${colour.name}, out of stock`}
            </span>
          </li>
        ))}
        {overflow > 0 && (
          <li className="font-mono text-xs tabular-nums text-muted-foreground">
            +{overflow}
            <span className="sr-only"> more colours</span>
          </li>
        )}
      </ul>
    );
  }

  const selectedIndex = shown.findIndex((colour) => colour.id === selectedId);
  /* Clamped, so a `colours` list that shrinks after a focus move cannot leave
     the group with no tabbable member and drop it out of the tab order. */
  const activeIndex = Math.min(
    focusIndex ?? (selectedIndex >= 0 ? selectedIndex : 0),
    shown.length - 1,
  );

  const move = (from: number, delta: number) => {
    const next = (from + delta + shown.length) % shown.length;
    setFocusIndex(next);
    refs.current[next]?.focus();
    const colour = shown[next];
    /* Out-of-stock swatches are `aria-disabled`, not `disabled`: focus still
       reaches them so they can be read, but they do not become the choice. */
    if (colour.inStock) onSelect?.(colour.id);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        move(index, 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        move(index, -1);
        break;
      case "Home":
        event.preventDefault();
        move(-1, 1);
        break;
      case "End":
        event.preventDefault();
        move(0, -1);
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label ?? "Colour"}
      className={cn("flex flex-wrap items-center gap-1", className)}
    >
      {shown.map((colour, index) => (
        <button
          key={colour.id}
          type="button"
          role="radio"
          ref={(node) => {
            refs.current[index] = node;
          }}
          aria-checked={colour.id === selectedId}
          aria-disabled={colour.inStock ? undefined : true}
          aria-label={colour.inStock ? colour.name : `${colour.name}, out of stock`}
          tabIndex={index === activeIndex ? 0 : -1}
          onClick={() => {
            setFocusIndex(index);
            if (colour.inStock) onSelect?.(colour.id);
          }}
          onKeyDown={(event) => onKeyDown(event, index)}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            colour.inStock ? "cursor-pointer" : "cursor-not-allowed",
          )}
        >
          <Swatch colour={colour} selected={colour.id === selectedId} size={resolvedSize} />
        </button>
      ))}
      {overflow > 0 && (
        <span className="ml-1 font-mono text-xs tabular-nums text-muted-foreground">
          +{overflow}
          <span className="sr-only"> more colours</span>
        </span>
      )}
    </div>
  );
}
