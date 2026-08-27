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
 * ═══ AN ICON AND A NUMBER, NOT A SENTENCE ═══
 * This read "4 found this helpful" beside two labelled buttons, which is three
 * ways of saying the same thing stacked on one row. The count belongs against
 * the thumb it counts — the shape every threaded comment UI uses, and the one
 * shoppers already know how to read.
 *
 * THE BUTTONS ARE ICON-ONLY AND STILL HAVE NAMES. `aria-label` carries "Helpful"
 * and "Not helpful", including the tally, so a screen reader is told what the
 * glyph means and what the number counts. An icon button without a name is a
 * control only sighted users can use.
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

/* NO BORDER AND NO FILL. A row of outlined pills under every review competes
   with the review; these are glyphs that darken on hover, like the row this is
   modelled on. The tap target stays 32px via the padding. */
const CONTROL =
  "inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-sans text-muted-foreground transition-colors hover:bg-brand-soft hover:text-foreground disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {canVote ? (
        <>
          <button
            type="button"
            disabled={pending}
            aria-pressed={viewerReaction === "helpful"}
            aria-label={
              helpfulCount > 0 ? `Helpful, ${helpfulCount} so far` : "Helpful"
            }
            onClick={() => onVote(viewerReaction === "helpful" ? null : "helpful")}
            className={cn(CONTROL, viewerReaction === "helpful" && "text-brand")}
          >
            <ThumbsUp aria-hidden="true" className="h-4 w-4" />
            {/* ZERO SHOWS NOTHING. A "0" beside the thumb reads as a verdict on
                the review rather than as the absence of votes. */}
            {helpfulCount > 0 && (
              <span className="font-mono text-xs tabular-nums">{helpfulCount}</span>
            )}
          </button>

          {/* NO FIGURE BESIDE THIS ONE, EVER — see the file header. */}
          <button
            type="button"
            disabled={pending}
            aria-pressed={viewerReaction === "unhelpful"}
            aria-label="Not helpful"
            onClick={() => onVote(viewerReaction === "unhelpful" ? null : "unhelpful")}
            className={cn(CONTROL, viewerReaction === "unhelpful" && "text-brand")}
          >
            <ThumbsDown aria-hidden="true" className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          {/* SIGNED OUT STILL READS THE TALLY. Only the controls become a way
              in; a shopper deciding whether to trust a review should not have to
              sign in to see how many people found it useful. */}
          <span
            className="inline-flex items-center gap-1.5 px-2 py-1 font-sans text-xs text-muted-foreground"
            aria-label={helpfulCount > 0 ? `${helpfulCount} found this helpful` : undefined}
          >
            <ThumbsUp aria-hidden="true" className="h-4 w-4" />
            {helpfulCount > 0 && (
              <span className="font-mono tabular-nums">{helpfulCount}</span>
            )}
          </span>
          <Link
            href={signInHref}
            className="px-2 py-1 font-sans text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Sign in to vote
          </Link>
        </>
      )}
    </div>
  );
}
