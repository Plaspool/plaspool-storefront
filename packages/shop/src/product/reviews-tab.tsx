import { MessageSquareText, TriangleAlert } from "lucide-react";
import { cn } from "@plaspool/ui";

import type { Review } from "../data/types";
import { ratingSummary } from "../data/money";
import { SHOW_FIXTURE_REVIEWS } from "../data/config";
import { RatingStars } from "../components/rating-stars";
import { EmptyState } from "../components/empty-state";

/**
 * Rating summary, distribution bars, individual reviews — and, on day one, the
 * empty state, which is the state this tab is actually most likely to be in.
 *
 * THE FIXTURE REVIEWS ARE INVENTED AND MUST NEVER BE PRESENTED AS REAL.
 * `SHOW_FIXTURE_REVIEWS` is the switch:
 *
 *   `false` → the empty state renders, whatever is in the fixtures. This is
 *             the shippable setting until real reviews exist.
 *   `true`  → the fixtures render behind an unmissable sample-data notice.
 *
 * The notice is not subtle and is not dismissible, deliberately. A tasteful
 * one is a notice someone ships past.
 */

/** Five down to one, matching `RatingSummary.distribution`'s own order. */
const STAR_ROWS = [5, 4, 3, 2, 1] as const;

function DistributionBars({
  distribution,
  count,
}: {
  distribution: readonly number[];
  count: number;
}) {
  return (
    <ul className="flex w-full max-w-xs flex-col gap-1.5">
      {STAR_ROWS.map((stars, index) => {
        const n = distribution[index] ?? 0;
        const pct = count > 0 ? Math.round((n / count) * 100) : 0;
        return (
          <li key={stars} className="flex items-center gap-3 text-xs">
            <span className="w-10 shrink-0 font-mono tabular-nums text-muted-foreground">
              {stars}
              <span className="sr-only"> star</span>
              <span aria-hidden="true"> ★</span>
            </span>
            <span
              aria-hidden="true"
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-brand-soft"
            >
              <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </span>
            <span className="w-8 shrink-0 text-right font-mono tabular-nums text-muted-foreground">
              {n}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <li className="border-b border-brand-line py-6 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <RatingStars rating={review.rating} />
        <h4 className="font-sans text-sm font-semibold text-foreground">{review.title}</h4>
      </div>

      <p className="mt-3 text-sm leading-6 text-muted-foreground">{review.body}</p>

      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="text-foreground">{review.author}</span>
        <span aria-hidden="true">·</span>
        {/* A literal ISO string from the fixtures, never `Date.now()` — it has
            to render identically on the server and the client. */}
        <time dateTime={review.publishedAt} className="font-mono tabular-nums">
          {review.publishedAt}
        </time>
        {review.verifiedPurchase && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-foreground">Verified purchase</span>
          </>
        )}
      </p>
    </li>
  );
}

export interface ReviewsTabProps {
  reviews: Review[];
  className?: string;
}

export function ReviewsTab({ reviews, className }: ReviewsTabProps) {
  const suppressed = !SHOW_FIXTURE_REVIEWS;
  const shown = suppressed ? [] : reviews;

  if (shown.length === 0) {
    return (
      <div className={cn("max-w-3xl", className)}>
        <EmptyState
          icon={<MessageSquareText aria-hidden="true" className="h-6 w-6" />}
          title="No reviews yet"
          body="This spool has not been reviewed. The printing parameters tab has the temperatures, speeds and tolerance if you are deciding without them."
        />
      </div>
    );
  }

  const summary = ratingSummary(shown);

  return (
    <div className={cn("max-w-3xl", className)}>
      <p className="mb-6 flex items-start gap-3 rounded-lg border border-brand-line bg-brand-soft p-4 text-sm leading-6 text-foreground">
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <span>
          <span className="font-semibold">Sample data.</span> These reviews are
          invented, written to build this page against. They are not customer
          reviews and will be replaced before the store takes orders.
        </span>
      </p>

      <div className="flex flex-col gap-6 border-b border-brand-line pb-8 sm:flex-row sm:items-center sm:gap-12">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-4xl font-bold tabular-nums text-foreground">
            {summary.average}
          </p>
          <RatingStars rating={summary.average} size="md" />
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">{summary.count}</span>{" "}
            {summary.count === 1 ? "review" : "reviews"}
          </p>
        </div>

        <DistributionBars distribution={summary.distribution} count={summary.count} />
      </div>

      <ul className="flex flex-col">
        {shown.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </ul>
    </div>
  );
}
