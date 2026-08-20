import type * as React from "react";
import Image from "next/image";
import { cn } from "@plaspool/ui";

const ART = {
  lockup: { light: "/brand/logo-light.png", dark: "/brand/logo-dark.png" },
  mark: { light: "/brand/logomark-light.png", dark: "/brand/logomark-dark.png" },
} as const;

// Intrinsic pixel dimensions of the source artwork (verified against the
// actual PNGs — do not guess these, a wrong ratio distorts the render).
const SIZE = {
  lockup: { width: 4800, height: 980 },
  mark: { width: 1080, height: 1080 },
} as const;

export function BrandLogo({
  variant = "lockup",
  tone = "light",
  priority = true,
  alt = "PlaSpool",
  style,
  className,
}: {
  variant?: "lockup" | "mark";
  tone?: "light" | "dark";
  /**
   * Whether this copy is worth blocking on.
   *
   * DEFAULTS TRUE BECAUSE THE FIRST CALLERS WERE THE NAV AND THE FOOTER — a
   * lockup in the header is above the fold on every page and should not pop in.
   * A caller that draws the mark MANY TIMES on one screen must pass `false`:
   * `priority` on a repeated decorative image asks the browser to preload the
   * same file once per instance and pushes the real content down the queue.
   */
  priority?: boolean;
  /**
   * Empty when the mark is decoration rather than identification.
   *
   * A logo standing in for a missing product photograph is NOT a picture of the
   * product and must not acquire a name that suggests it is — the rule
   * `lineImageAlt` sets out next door. `""` makes it decorative; the surrounding
   * text carries the item.
   */
  alt?: string;
  /** For a size that is a runtime number rather than a breakpoint — a
   *  thumbnail whose edge the calling surface owns. A class cannot be composed
   *  from a runtime value without a safelist. */
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <Image
      src={ART[variant][tone]}
      alt={alt}
      width={SIZE[variant].width}
      height={SIZE[variant].height}
      priority={priority}
      style={style}
      /* `w-auto` LAST-IN-WINS IS NOT A THING IN TAILWIND — both `w-auto` and a
         caller's width utility compile to the same property and the ORDER IN
         THE STYLESHEET decides, not the order in this string. A caller sizing
         by `style` (above) wins regardless, because an inline style beats any
         class; a caller sizing by class should pass a height utility and let
         this keep the width proportional, which is what every caller does. */
      className={cn("w-auto", className)}
    />
  );
}
