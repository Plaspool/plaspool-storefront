"use client";

import * as React from "react";
import { MessageSquareText } from "lucide-react";
import { Skeleton, SkeletonText, cn } from "@plaspool/ui";

import { REVIEWS_PER_PAGE } from "../data/config";
import { listReviewsFromBrowser, starsFromAggregate } from "../data/reviews";
import { myReactions, setReaction } from "../data/reviews";
import { ReviewReplies } from "./review-replies";
import { ReviewReactions } from "./review-reactions";
import { ReplyForm } from "./reply-form";
import { readShopSession } from "../data/auth-api";
import { signInHref } from "../account/sign-in-href";
import { usePathname } from "next/navigation";
import type { PublicReview, ReactionKind, ReviewAggregate } from "../data/reviews";
import { RatingStars } from "../components/rating-stars";
import { EmptyState } from "../components/empty-state";
import { ReviewFormGate } from "./review-form-gate";

/**
 * Real customer reviews: the aggregate, the distribution, the approved
 * reviews themselves, and the form for adding one.
 *
 * THE FIXTURES ARE GONE. This tab used to render invented reviews behind a
 * "sample data" notice, kept off a live store by a flag. There is a real API
 * now, so the flag, the fixtures and the notice are all deleted — what renders
 * here either came from a customer or is the honest empty state.
 *
 * The first page arrives as props, fetched on the server so the reviews are
 * in the HTML for a crawler and cost the reader nothing. Everything past it
 * is fetched in the browser on demand, which is also why this component is a
 * client one.
 */

/** Five down to one — the order a distribution is read in. */
const STAR_ROWS = ["5", "4", "3", "2", "1"] as const;

function DistributionBars({ aggregate }: { aggregate: ReviewAggregate }) {
  return (
    <ul className="flex w-full max-w-xs flex-col gap-1.5">
      {STAR_ROWS.map((stars) => {
        const n = aggregate.distribution[stars] ?? 0;
        const pct = aggregate.count > 0 ? Math.round((n / aggregate.count) * 100) : 0;
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

/**
 * `createdAt` is epoch milliseconds from the API, and this renders on both
 * sides of hydration — so the format is pinned to `en-NG` and UTC rather than
 * left to the runtime's locale and zone, which differ between the Worker and
 * the reader's browser and would mismatch.
 */
const DATE_FORMAT = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function ReviewCard({
  review,
  viewerReaction,
  helpfulCount,
  pending,
  canVote,
  onVote,
  signIn,
}: {
  review: PublicReview;
  viewerReaction: ReactionKind | null;
  helpfulCount: number;
  pending: boolean;
  canVote: boolean;
  onVote: (kind: ReactionKind | null) => void;
  signIn: string;
}) {
  const date = new Date(review.createdAt);
  return (
    <li className="border-b border-brand-line py-6 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <RatingStars rating={review.rating} />
        {review.title && (
          <h4 className="font-sans text-sm font-semibold text-foreground">{review.title}</h4>
        )}
      </div>

      {/* Customer-written text, rendered as a text node. It never becomes
          markup — see the blog's DocRenderer for the same rule stated at
          length. */}
      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">
        {review.body}
      </p>

      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="text-foreground">{review.authorName}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={date.toISOString()} className="font-mono tabular-nums">
          {DATE_FORMAT.format(date)}
        </time>
      </p>

      {/* THE COUNT IS THE SERVER'S, OVERRIDDEN BY THE LAST VOTE'S ANSWER. The
          reactions endpoint returns the new `helpfulCount`, so a click updates
          from the response rather than refetching a list that is cached
          `public` and would not show the change anyway. */}
      <ReviewReactions
        className="mt-3"
        helpfulCount={helpfulCount}
        viewerReaction={viewerReaction}
        pending={pending}
        canVote={canVote}
        onVote={onVote}
        signInHref={signIn}
      />

      {/* The thread, then one control for adding to it. `replyControl` is
          offered only on depth-0 rows — see `ReviewReplies`. */}
      <ReviewReplies
        replies={review.replies ?? []}
        replyControl={(parentId) => (
          <ReplyForm
            reviewId={review.id}
            parentId={parentId}
            canReply={canVote}
            signInHref={signIn}
          />
        )}
      />

      <div className="mt-3">
        <ReplyForm reviewId={review.id} canReply={canVote} signInHref={signIn} />
      </div>
    </li>
  );
}

export interface ReviewsTabProps {
  productSlug: string;
  productName: string;
  /**
   * Whether the printing-parameters tab is actually on the page.
   *
   * The empty state used to send readers to it unconditionally, which became a
   * dangling reference the moment `product.parameters` could be null: the tab is
   * hidden when the catalogue has no figures for a product, and pointing at a
   * tab that is not there is worse than not offering the consolation.
   */
  hasParameters: boolean;
  aggregate: ReviewAggregate;
  /** The first page, server-rendered. */
  initialReviews: PublicReview[];
  initialCursor: string | null;
  className?: string;
}

export function ReviewsTab({
  productSlug,
  productName,
  hasParameters,
  aggregate,
  initialReviews,
  initialCursor,
  className,
}: ReviewsTabProps) {
  const [extra, setExtra] = React.useState<PublicReview[]>([]);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const pathname = usePathname();
  const signIn = signInHref(pathname);
  /* ONLY A CONFIRMED CUSTOMER MAY VOTE. `unknown` shows the sign-in link, which
     resolves the session itself and forwards a shopper who already has one —
     the same neutral answer `ReviewFormGate` gives, for the same reason. */
  const [canVote, setCanVote] = React.useState(false);
  const [mine, setMine] = React.useState<Record<string, ReactionKind>>({});
  /* Counts the server sent, overwritten per review by the answer to a vote. */
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [voting, setVoting] = React.useState<string | null>(null);

  const shown = React.useMemo(
    () => [...initialReviews, ...extra],
    [initialReviews, extra],
  );

  /* PER-VIEWER, AND A SECOND CALL ON PURPOSE. The reviews list is served
     `Cache-Control: public`, so a shared cache can hand one reader's copy to
     another; "did I vote on this" varies per reader and must never ride on it.
     Signed out answers `200 {}` rather than 401, so there is nothing to branch
     on beyond having no ids yet. */
  React.useEffect(() => {
    let cancelled = false;
    const ids = shown.map((r) => r.id);
    void readShopSession().then(async (session) => {
      if (cancelled) return;
      setCanVote(session.kind === "customer");
      if (session.kind !== "customer" || ids.length === 0) return;
      const reactions = await myReactions(ids);
      if (!cancelled) setMine(reactions);
    });
    return () => {
      cancelled = true;
    };
  }, [shown]);

  async function vote(reviewId: string, kind: ReactionKind | null) {
    if (voting) return;
    setVoting(reviewId);
    try {
      const result = await setReaction(reviewId, kind);
      setMine((prev) => {
        const next = { ...prev };
        if (result.viewerReaction) next[reviewId] = result.viewerReaction;
        else delete next[reviewId];
        return next;
      });
      /* THE ANSWER'S COUNT, NOT AN INCREMENT OF OUR OWN — the server is the only
         thing that knows what the tally is after everybody else's votes. */
      setCounts((prev) => ({ ...prev, [reviewId]: result.helpfulCount }));
    } catch {
      /* A vote that did not land leaves the button as it was. Nothing is said:
         the control is a nicety, and an error banner over a review list is a
         worse answer than a click that visibly did nothing. */
    } finally {
      setVoting(null);
    }
  }

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const page = await listReviewsFromBrowser(productSlug, cursor, REVIEWS_PER_PAGE);
      setExtra((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  /* `shown` is the same list, memoised above so the reactions effect does not
     re-run on every render. */
  const reviews = shown;

  return (
    <div className={cn("max-w-3xl", className)}>
      {aggregate.count === 0 ? (
        <EmptyState
          icon={<MessageSquareText aria-hidden="true" className="h-6 w-6" />}
          title="No reviews yet"
          body={
            hasParameters
              ? "Nobody has reviewed this spool. If you have printed with it, yours would be the first — the printing parameters tab has the temperatures and tolerance in the meantime."
              : "Nobody has reviewed this spool. If you have printed with it, yours would be the first."
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-6 border-b border-brand-line pb-8 sm:flex-row sm:items-center sm:gap-12">
            <div className="flex flex-col gap-1">
              <p className="font-mono text-4xl font-bold tabular-nums text-foreground">
                {/* One decimal from the API's integer hundredths: `433` reads
                    as `4.3`, never `4.33` and never `4.0`. */}
                {Number(starsFromAggregate(aggregate).toFixed(1))}
              </p>
              <RatingStars rating={starsFromAggregate(aggregate)} size="md" />
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-mono tabular-nums text-foreground">
                  {aggregate.count}
                </span>{" "}
                {aggregate.count === 1 ? "review" : "reviews"}
              </p>
            </div>

            <DistributionBars aggregate={aggregate} />
          </div>

          <ul className="flex flex-col">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                viewerReaction={mine[review.id] ?? null}
                helpfulCount={counts[review.id] ?? review.helpfulCount ?? 0}
                pending={voting === review.id}
                canVote={canVote}
                onVote={(kind) => void vote(review.id, kind)}
                signIn={signIn}
              />
            ))}
            {/* The next page, shaped like a review — see the same treatment on
                the orders list, and `CLAUDE.md`'s "Loading states" rule. */}
            {loading &&
              Array.from({ length: 2 }, (_, i) => (
                <li key={`pending-${i}`} aria-hidden="true" className="border-b border-brand-line py-6">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <SkeletonText className="mt-3" lines={3} />
                </li>
              ))}
          </ul>

          {cursor && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                aria-busy={loading}
                className={cn(
                  "inline-flex h-10 items-center justify-center rounded-md border border-brand-line px-4 font-sans text-sm",
                  "transition-colors hover:border-foreground motion-reduce:transition-none disabled:opacity-50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                Load more reviews
              </button>
              {failed && (
                <p role="alert" className="text-sm text-destructive-strong">
                  Could not load more reviews. Try again.
                </p>
              )}
            </div>
          )}
        </>
      )}

      <div className="mt-10 border-t border-brand-line pt-8">
        <ReviewFormGate productSlug={productSlug} productName={productName} />
      </div>
    </div>
  );
}
