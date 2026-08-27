"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@plaspool/ui";

import { Link } from "../components/link";
import type { ReactionKind } from "../data/reviews";

/**
 * "Was this helpful?" under a review.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `helpfulCount` IS PUBLIC. `unhelpful` IS NOT, ANYWHERE, EVER.
 *
 * A dislike tally on a product page is a scoreboard for brigading. The vote is
 * still worth collecting — the shop sees it in the admin — so the control stays
 * and only the NUMBER goes. Nothing here computes a ratio or a net score
 * either: the denominator does not exist on this side of the wire, and
 * inventing one misrepresents it.
 *
 * ═══ THE TOGGLE IS OURS, AND THAT IS DELIBERATE ═══
 * The API takes the STATE you want, not a flip: pressing "helpful" when it is
 * already helpful sends `{"kind": null}`. The server does not flip for us
 * because two tabs doing that would land on arrival order. `onVote` receives
 * the state to send, already resolved.
 *
 * ═══ SIGNED OUT STILL READS ═══
 * The count renders for everyone; only the CONTROLS become a way in. Reading a
 * product page signed out is not an error, and a vote button that silently
 * fails is worse than one that says what it needs.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export interface ReviewReactionsProps {
  helpfulCount: number;
  viewerReaction: ReactionKind | null;
  /** A vote is in flight; both controls disable rather than racing. */
  pending: boolean;
  /** False for a viewer with no session. */
  canVote: boolean;
  /** The state to send — never a toggle. Null clears. */
  onVote: (kind: ReactionKind | null) => void;
  signInHref: string;
  className?: string;
}

const CONTROL =
  "inline-flex items-center gap-1.5 border border-brand-line px-2 py-1 font-sans text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function ReviewReactions({
  helpfulCount,
  viewerReaction,
  pending,
  canVote,
  onVote,
  signInHref,
  className,
}: ReviewReactionsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {/* ZERO SAYS NOTHING. "0 found this helpful" reads as a verdict on the
          review rather than as the absence of votes. */}
      {helpfulCount > 0 && (
        <span className="font-sans text-xs text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">{helpfulCount}</span> found
          this helpful
        </span>
      )}

      {canVote ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            aria-pressed={viewerReaction === "helpful"}
            onClick={() => onVote(viewerReaction === "helpful" ? null : "helpful")}
            className={cn(CONTROL, viewerReaction === "helpful" && "border-brand text-brand")}
          >
            <ThumbsUp aria-hidden="true" className="h-3.5 w-3.5" />
            Helpful
          </button>

          {/* NO FIGURE BESIDE THIS ONE, EVER — see the file header. */}
          <button
            type="button"
            disabled={pending}
            aria-pressed={viewerReaction === "unhelpful"}
            onClick={() => onVote(viewerReaction === "unhelpful" ? null : "unhelpful")}
            className={cn(CONTROL, viewerReaction === "unhelpful" && "border-brand text-brand")}
          >
            <ThumbsDown aria-hidden="true" className="h-3.5 w-3.5" />
            Not helpful
          </button>
        </div>
      ) : (
        <Link
          href={signInHref}
          className="font-sans text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Sign in to say whether this helped
        </Link>
      )}
    </div>
  );
}
