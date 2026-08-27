"use client";

import * as React from "react";
import { MessageSquareText } from "lucide-react";
import { Skeleton, SkeletonText, cn } from "@plaspool/ui";

import { REVIEWS_PER_PAGE } from "../data/config";
import { listReviewsFromBrowser, starsFromAggregate } from "../data/reviews";
import { myReactions, reviewEligibility, setReaction } from "../data/reviews";
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
import { reviewActionFor, reviewGateFor } from "./review-permissions";
import type { ReviewAction } from "./review-permissions";
import type { ProductEligibility } from "../data/reviews";
import type { ShopSession } from "../data/auth-api";

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
  action,
  onVote,
  signIn,
}: {
  review: PublicReview;
  viewerReaction: ReactionKind | null;
  helpfulCount: number;
  pending: boolean;
  /** Allowed, needs a session, or needs a purchase — never a boolean. */
  action: ReviewAction;
  onVote: (kind: ReactionKind | null) => void;
  signIn: string;
}) {
  const date = new Date(review.createdAt);
  return (
    <li className="border-b border-brand-line py-6 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <RatingStars rating={review.rating} />
        {review.title && (
          <h4 className="text-sm font-semibold text-foreground">{review.title}</h4>
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
      {/* ONE ROW: thumb, tally, thumb, reply — the shape of every threaded
          comment UI, and the one shoppers already know how to read. The reply
          control was on a line of its own beneath, which made two rows of
          chrome under a two-line review. */}
      <div className="mt-3 flex flex-wrap items-center gap-1">
        <ReviewReactions
          helpfulCount={helpfulCount}
          viewerReaction={viewerReaction}
          pending={pending}
          action={action}
          onVote={onVote}
          signInHref={signIn}
        />
        <ReplyForm reviewId={review.id} action={action} signInHref={signIn} />
      </div>

      {/* The thread, then one control for adding to it. `replyControl` is
          offered only on depth-0 rows — see `ReviewReplies`. */}
      <ReviewReplies
        replies={review.replies ?? []}
        replyControl={(parentId) => (
          <ReplyForm
            reviewId={review.id}
            parentId={parentId}
            action={action}
            signInHref={signIn}
          />
        )}
      />


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
  /* ═══ ONE READ FOR THE WHOLE TAB, AND ONE `setState` ═══
     Three surfaces here branch on the same two answers — the form gate, the
     vote row and the reply control — and this component renders all of them.
     Asking separately meant the product page already ran TWO `readShopSession`
     calls, and would have run two eligibility reads on top.

     BOTH ANSWERS LAND TOGETHER, deliberately: setting the session first would
     paint the form for a confirmed customer and then take it away a moment
     later when the eligibility answer arrived. `unknown` with an empty map is
     the neutral first frame, which is what every one of these surfaces rendered
     before this change. */
  const [viewer, setViewer] = React.useState<{
    kind: ShopSession["kind"];
    eligible: Record<string, ProductEligibility>;
  }>({ kind: "unknown", eligible: {} });
  const [mine, setMine] = React.useState<Record<string, ReactionKind>>({});
  /* Counts the server sent, overwritten per review by the answer to a vote. */
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [voting, setVoting] = React.useState<string | null>(null);

  const shown = React.useMemo(
    () => [...initialReviews, ...extra],
    [initialReviews, extra],
  );

  /* WHO IS READING, AND WHAT THEY MAY DO HERE. Both answers are per-viewer and
     credentialed, so neither may ride on the reviews list itself — that is
     served `Cache-Control: public` and a shared cache can hand one reader's
     copy to another. */
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await readShopSession();
      if (cancelled) return;
      if (session.kind !== "customer") {
        setViewer({ kind: session.kind, eligible: {} });
        return;
      }
      /* ONLY FOR A CONFIRMED CUSTOMER. The answer is per-viewer and
         credentialed; asking on behalf of a guest spends a cross-origin request
         to be told what the session already said. */
      const eligible = await reviewEligibility([productSlug]);
      if (!cancelled) setViewer({ kind: session.kind, eligible });
    })();
    return () => {
      cancelled = true;
    };
  }, [productSlug]);

  /* WHICH OF THE REVIEWS ON SCREEN THIS VIEWER HAS VOTED ON — a separate call
     for the same reason as the one above: "did I vote on this" varies per
     reader and must never ride on a response a shared cache can reuse.

     ITS OWN EFFECT because it re-runs on "load more" while the one above must
     not — a second page of reviews does not change who is reading. Signed out
     answers `200 {}` rather than 401, so the only thing to branch on is having
     no ids yet. */
  React.useEffect(() => {
    if (viewer.kind !== "customer") return;
    const ids = shown.map((r) => r.id);
    if (ids.length === 0) return;
    let cancelled = false;
    void myReactions(ids).then((reactions) => {
      if (!cancelled) setMine(reactions);
    });
    return () => {
      cancelled = true;
    };
  }, [shown, viewer.kind]);

  const action = reviewActionFor(viewer.kind, viewer.eligible, productSlug);

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
      {/* ═══ THE WRITING CONTROL COMES FIRST ═══
          It sat under the whole list, so on a product with reviews you had to
          scroll past every one of them to add your own — and on a product with
          none it was below an empty state telling you to be the first. Above
          the list is where every threaded comment UI puts it, and it is outside
          the branch below so it renders in both states rather than only when
          there is already something to read. */}
      <div className="mb-8 border-b border-brand-line pb-8">
        <ReviewFormGate
          gate={reviewGateFor(viewer.kind, viewer.eligible, productSlug)}
          productSlug={productSlug}
          productName={productName}
          signInHref={signIn}
        />
      </div>

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
                action={action}
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
                  "inline-flex h-10 items-center justify-center rounded-md border border-brand-line px-4 text-sm",
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

    </div>
  );
}
