import * as React from "react";

import { cn } from "../cn";

/**
 * A placeholder shaped like the thing that is coming.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULE THIS EXISTS TO ENFORCE (see `CLAUDE.md`, "Loading states"): once a
 * section's layout is known, its loading state renders that layout — never a
 * sentence standing in for content. `Loading your order…` tells a shopper
 * nothing they did not already know from having clicked; a stack of order-line
 * shapes tells them what is arriving and roughly how much of it.
 *
 * IT MUST MATCH THE REAL BOX. A skeleton whose widths, heights, gaps or count
 * differ from the resolved content produces a reflow at exactly the moment the
 * shopper starts reading, which is worse than having shown nothing. Compose the
 * placeholder out of the same layout classes the real markup uses rather than
 * eyeballing a similar-looking stack.
 *
 * IT IS INVISIBLE TO ASSISTIVE TECH. Every element here is `aria-hidden` — a
 * screen reader has no use for a wall of empty boxes. Announce the wait ONCE,
 * on the region, with `aria-busy="true"` and a live label; `SkeletonRegion`
 * below does that so the two halves cannot drift apart.
 *
 * THE SHIMMER IS OPTIONAL AND OPT-OUT-ABLE. `animate-pulse` is dropped under
 * `prefers-reduced-motion`, leaving a static tint that still reads as "not yet
 * content".
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-muted animate-pulse motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A placeholder for ONE LINE OF TEXT, at that text's own height.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PASS THE TYPE, NOT A HEIGHT. `<TextSkeleton className="w-40 text-sm" />` is a
 * bar exactly as tall as the `text-sm` line it stands in for, at every
 * breakpoint and every root font size, for ever — because it is a line box of
 * that type rather than a number somebody measured once.
 *
 * ═══ WHY THIS IS A COMPONENT AND NOT AN IDIOM ═══
 * The idiom was `<Skeleton className="text-sm">{" "}</Skeleton>`, and the
 * character is load-bearing: an empty `Skeleton` has no line box and collapses
 * to ZERO height, and so does one holding a plain ASCII space, because CSS
 * discards a lone collapsible space. Only a NO-BREAK space survives.
 *
 * Written out by hand twelve times across this shop, it was already wrong in
 * EIGHT of them — a `{" "}` that looks identical to a `{" "}` in every
 * diff, every review and every editor, and produced 0px bars. The measured
 * fallout: a rewards ledger row 36px short of the row it stood in for, every
 * row; the balance panel 44px short; four account-hub rows 16px each. Nothing
 * about that is visible by reading, which is exactly why it may not be an idiom.
 *
 * So the character lives here, once, and no caller ever types it.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function TextSkeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton className={className} {...props}>
      {" "}
    </Skeleton>
  );
}

/**
 * The wrapper that tells assistive tech a wait is happening, once.
 *
 * `aria-busy` alone is not announced by most screen readers, so the label is
 * carried in a visually hidden live region that the placeholders themselves do
 * not duplicate. `label` should name what is loading — "Loading your order" —
 * because "Loading" alone is the same non-answer the prose states were.
 */
export function SkeletonRegion({
  label,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { label: string }) {
  return (
    <div aria-busy="true" className={className} {...props}>
      <span role="status" aria-live="polite" className="sr-only">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * A run of text-shaped lines.
 *
 * `widths` is per line and defaults to a short last line, because a paragraph
 * skeleton of equal-width bars reads as a table rather than as prose.
 */
export function SkeletonText({
  lines = 3,
  widths,
  className,
}: {
  lines?: number;
  widths?: string[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", widths?.[i] ?? (i === lines - 1 ? "w-2/5" : "w-full"))}
        />
      ))}
    </div>
  );
}
