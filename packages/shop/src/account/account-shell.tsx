import type { ReactNode } from "react";
import { cn } from "@plaspool/ui";

/**
 * The box every `/account` screen sits in.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THERE WERE EIGHT COPIES OF THIS STRING AND ONE OF THEM HAD ALREADY DRIFTED.
 *
 * Five private `Shell` components plus three inlined `<div>`s, in three
 * spellings: `max-w-2xl px-4 py-12 sm:px-6 sm:py-16` (the hub, rewards,
 * settings), `max-w-3xl px-4 py-12 sm:px-6 sm:py-16` (order detail, status
 * history), and `max-w-3xl px-4 py-16 sm:px-6` (the orders list, three times).
 *
 * The third is the drift: it has no `py-12`, so `/account/orders` carried 64px
 * of top padding below `sm` where every other account screen carries 48px.
 * Tapping a row therefore moved the content 16px on a phone, between two pages
 * in the same flow. Nobody would ever find that by reading three files.
 *
 * ═══ TWO WIDTHS, AND THEY ARE A REAL DISTINCTION ═══
 * `wide` (48rem) is for screens carrying a horizontal thing that needs the
 * room — the five-stop progress track, a row with a picture rail, a totals
 * grid. `narrow` (42rem) is for screens that are a column of text and rows,
 * where a longer measure just makes them harder to read. Both are on this one
 * component so the choice is visible in the caller rather than buried in a
 * class string.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function AccountShell({
  width = "narrow",
  className,
  children,
}: {
  width?: "narrow" | "wide";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto px-4 py-12 sm:px-6 sm:py-16",
        width === "wide" ? "max-w-3xl" : "max-w-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
