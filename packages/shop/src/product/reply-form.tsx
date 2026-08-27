"use client";

import * as React from "react";
import { Button, Textarea } from "@plaspool/ui";

import { Link } from "../components/link";
import { REPLY_MAX, REPLY_MIN, ReviewSubmitError, postReply } from "../data/reviews";
import type { SubmitError } from "../data/reviews";

/**
 * Replying to a review, or to a reply on one.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT LANDS `pending`, AND SAYING SO IS THE WHOLE JOB OF THE CONFIRMATION.
 *
 * Only approved replies appear — including to the person who wrote them. A form
 * that accepts a reply and then shows a thread without it produces a customer
 * who assumes it failed and posts again, which is how a moderation queue fills
 * with duplicates of the same sentence.
 *
 * ═══ NO BYLINE FIELD ═══
 * `authorName` is optional on the wire and the account already carries one.
 * Offering a field here would reopen, one level down, exactly the door the
 * review form just closed: a typed name that need not be the writer's.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const MESSAGES: Record<SubmitError, string> = {
  "signed-out": "You have been signed out. Sign in again and your reply can be posted.",
  gone: "That review is no longer available.",
  "rate-limited": "That is a few replies in a short time. Give it a moment and try again.",
  rejected: "We could not accept a reply from this page. Please try again later.",
  invalid: "Something in the reply was not accepted. Check it and try again.",
  failed: "The reply could not be sent. Check your connection and try again.",
};

export function ReplyForm({
  reviewId,
  parentId = null,
  canReply,
  signInHref,
  onPosted,
}: {
  reviewId: string;
  /** Null replies to the review itself. */
  parentId?: string | null;
  canReply: boolean;
  signInHref: string;
  onPosted?: () => void;
}) {
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<SubmitError | null>(null);
  const [done, setDone] = React.useState(false);

  if (!canReply) {
    return (
      <Link
        href={signInHref}
        className="inline-block font-sans text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Sign in to reply
      </Link>
    );
  }

  if (done) {
    return (
      <p role="status" className="font-sans text-xs text-muted-foreground">
        {/* THE SENTENCE THIS COMPONENT EXISTS FOR. */}
        Thanks — your reply is with us and will appear once it has been read.
      </p>
    );
  }

  const trimmed = body.trim();
  const tooShort = trimmed.length < REPLY_MIN;

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (tooShort || sending) return;
        setSending(true);
        setError(null);
        try {
          await postReply(reviewId, { body: trimmed, parentId });
          setDone(true);
          onPosted?.();
        } catch (err) {
          setError(err instanceof ReviewSubmitError ? err.kind : "failed");
        } finally {
          setSending(false);
        }
      }}
    >
      <Textarea
        value={body}
        maxLength={REPLY_MAX}
        rows={2}
        aria-label="Your reply"
        placeholder="Add to this conversation"
        onChange={(event) => setBody(event.target.value)}
      />
      {error && (
        <p role="alert" className="font-sans text-xs text-destructive-strong">
          {MESSAGES[error]}
        </p>
      )}
      <div>
        <Button type="submit" size="sm" disabled={sending || tooShort} className="h-8 px-3">
          {sending ? "Sending…" : "Reply"}
        </Button>
      </div>
    </form>
  );
}
