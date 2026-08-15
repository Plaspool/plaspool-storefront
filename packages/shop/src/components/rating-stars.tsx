import { Star } from "lucide-react";
import { cn } from "@plaspool/ui";

/**
 * Five stars, filled to the nearest half. Navy rather than gold, because on
 * this store the only colour on a page belongs to the filament.
 */

const STAR: Record<NonNullable<RatingStarsProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
};

const COUNT: Record<NonNullable<RatingStarsProps["size"]>, string> = {
  sm: "text-xs",
  md: "text-sm",
};

/** `4` → `4`, `4.5` → `4.5`. Never `4.0`. */
function formatRating(rating: number): string {
  return Number.isInteger(rating) ? String(rating) : String(Number(rating.toFixed(1)));
}

export interface RatingStarsProps {
  /** 0 to 5. Drawn to the nearest half, announced at full precision. */
  rating: number;
  /** Number of reviews. Renders as a mono `(6)`. */
  count?: number;
  size?: "sm" | "md";
  className?: string;
}

export function RatingStars({ rating, count, size = "sm", className }: RatingStarsProps) {
  const clamped = Math.min(5, Math.max(0, rating));
  const halves = Math.round(clamped * 2);

  const label = [
    `Rated ${formatRating(clamped)} out of 5`,
    count === undefined ? null : `from ${count} ${count === 1 ? "review" : "reviews"}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span role="img" aria-label={label} className={cn("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden="true" className="inline-flex items-center gap-0.5">
        {[0, 1, 2, 3, 4].map((index) => {
          const filledHalves = Math.min(2, Math.max(0, halves - index * 2));
          if (filledHalves === 2) {
            return <Star key={index} className={cn(STAR[size], "fill-brand text-brand")} />;
          }
          if (filledHalves === 0) {
            return <Star key={index} className={cn(STAR[size], "fill-none text-brand-line")} />;
          }
          /* Half: an outline star with a filled one clipped to its left half.
             Lucide has no half-star glyph, and clipping keeps the two shapes
             identical so the join is invisible. */
          return (
            <span key={index} className={cn("relative inline-block", STAR[size])}>
              <Star className={cn(STAR[size], "fill-none text-brand-line")} />
              <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
                <Star className={cn(STAR[size], "fill-brand text-brand")} />
              </span>
            </span>
          );
        })}
      </span>
      {count !== undefined && (
        <span
          aria-hidden="true"
          className={cn("font-mono tabular-nums text-muted-foreground", COUNT[size])}
        >
          ({count})
        </span>
      )}
    </span>
  );
}
