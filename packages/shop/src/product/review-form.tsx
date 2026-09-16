"use client";

import * as React from "react";
import { Check, Star } from "lucide-react";
import { Button, Input, Textarea, cn } from "@plaspool/ui";

import { Link } from "../components/link";
import { ReviewSubmitError, submitReview } from "../data/reviews";
import type { SubmitError } from "../data/reviews";
import { ReviewPhotoField } from "./review-photo-field";
import { useReviewPhotoUploads } from "./use-review-photo-uploads";

/**
 * Writing a review — on a product page for a signed-in buyer, or on `/review`
 * for somebody holding a review link from the shop.
 *
 * MODERATION IS SAID OUT LOUD, BEFORE AND AFTER. Every review enters the queue
 * as `pending` and appears only once a human approves it, so the form says so
 * above the fields and the confirmation says it again. Nothing is added to the
 * list optimistically.
 *
 * The API is the validator; the rules below mirror it so a too-short body is
 * reported by the field beside it rather than by a 400 from another origin.
 *
 * ═══ THE REVIEWER IS THE SESSION OR THE LINK. THE BYLINE IS TYPED. ═══
 * Who wrote the review is never sent — there is no `authorEmail`, and the API
 * ignores one. What IS sent, when filled in, is the name printed under it.
 * This form used to send neither, and every account without a display name —
 * most of them — got `400 detail:"authorName"` rendered as "invalid". The
 * server now falls back to the first name on the customer's order; the field
 * lets them choose, and is where that 400 is reported when there is no name
 * anywhere.
 */

/** The API's own floor: "not left holding a single character by accident". */
const BODY_MIN = 10;
const BODY_MAX = 5000;
const AUTHOR_NAME_MAX = 120;

const NAME_MISSING = "Please add the name to show on your review";

/** Messages shown beside the submit button. `author-name` lives on its field. */
const MESSAGES: Record<SubmitError, string> = {
  /* NOT "check your connection" — the connection is fine. A session can expire
     between opening the page and pressing the button. */
  "signed-out": "You've been signed out. Sign in again and your review can be posted.",
  gone: "That review is no longer available.",
  "already-reviewed": "You've already reviewed this.",
  "purchase-required": "You can review this once you've bought it.",
  "review-link-invalid": "This review link has expired or isn't valid. Ask us for a new one.",
  "author-name": NAME_MISSING,
  "photo-ids": "One of your photos didn't upload properly. Remove it and try again.",
  "rate-limited":
    "That is a few reviews in a short time. Give it fifteen minutes and try again.",
  rejected:
    "We could not accept a review from this page. Nothing is wrong with what you wrote — please try again later.",
  invalid: "Something in the review was not accepted. Check the fields and try again.",
  failed: "The review could not be sent. Check your connection and try again.",
};

/**
 * A radiogroup rather than five buttons: arrow keys move between the stars,
 * the whole control is one tab stop, and a screen reader announces one rating
 * out of five instead of five unrelated toggles.
 */
function StarPicker({
  value,
  onChange,
  describedBy,
}: {
  value: number;
  onChange: (rating: number) => void;
  describedBy?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Rating, out of five"
      aria-describedby={describedBy}
      className="flex items-center gap-1"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
            /* Exactly one stop in the tab order: the chosen star, or the
               first one while nothing is chosen. */
            tabIndex={value === star || (value === 0 && star === 1) ? 0 : -1}
            onClick={() => onChange(star)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                event.preventDefault();
                onChange(Math.min(5, (value || 0) + 1));
              } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                event.preventDefault();
                onChange(Math.max(1, (value || 1) - 1));
              }
            }}
            className={cn(
              "rounded-sm p-1 transition-transform motion-reduce:transition-none",
              "hover:scale-110 active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <Star
              aria-hidden="true"
              className={cn(
                "h-7 w-7",
                filled ? "fill-brand text-brand" : "fill-none text-brand-line",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export interface ReviewFormProps {
  productSlug: string;
  productName: string;
  /**
   * The token from `/review?token=…`. Present, it stands in for a session on
   * both the photo uploads and the submit — see `ReviewLinkPage`.
   */
  reviewLink?: string;
  /** Pre-fills "Name shown on your review" — the link's `firstName`. */
  defaultAuthorName?: string | null;
  /**
   * The name is required when nothing on the server could supply one — on a
   * review link whose order carries no first name. Elsewhere it is optional
   * and a blank field is omitted, letting the server fall back.
   */
  requireAuthorName?: boolean;
  /** Replaces the built-in thank-you panel; the caller renders its own. */
  onSubmitted?: () => void;
  /** A `403 already_reviewed` — the caller swaps the form for its notice. */
  onAlreadyReviewed?: () => void;
  /** Where "sign in again" goes after a `401`. */
  signInHref?: string;
  /** Hide "Write a review" and its intro, for a card that already titles it. */
  hideHeading?: boolean;
  className?: string;
}

export function ReviewForm({
  productSlug,
  productName,
  reviewLink,
  defaultAuthorName,
  requireAuthorName = false,
  onSubmitted,
  onAlreadyReviewed,
  signInHref,
  hideHeading = false,
  className,
}: ReviewFormProps) {
  const [rating, setRating] = React.useState(0);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [authorName, setAuthorName] = React.useState(defaultAuthorName ?? "");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<SubmitError | null>(null);
  const [done, setDone] = React.useState<"submitted" | "already-reviewed" | null>(null);
  /* Validation appears only after a submit attempt. Telling someone their
     review is too short before they have finished the first sentence is the
     form arguing with them while they type. */
  const [attempted, setAttempted] = React.useState(false);
  const photos = useReviewPhotoUploads(reviewLink);

  const uid = React.useId();
  const id = (part: string) => `${uid}-${part}`;

  const bodyLength = body.trim().length;
  const problems = {
    rating: rating < 1 ? "Choose a rating." : null,
    body:
      bodyLength === 0
        ? "Write a few words about the spool."
        : bodyLength < BODY_MIN
          ? `A little more — ${BODY_MIN} characters at least.`
          : null,
    authorName: requireAuthorName && authorName.trim().length === 0 ? NAME_MISSING : null,
    photos: photos.failed ? "Retry or remove the photo that didn't upload." : null,
  };
  const valid = Object.values(problems).every((problem) => problem === null);
  const nameError =
    (attempted && problems.authorName) || (error === "author-name" ? NAME_MISSING : null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setAttempted(true);
    setError(null);
    if (!valid || sending || photos.uploading) return;

    setSending(true);
    try {
      await submitReview({
        productSlug,
        rating,
        title,
        body,
        authorName,
        photoIds: photos.photoIds,
        reviewLink,
      });
      if (onSubmitted) onSubmitted();
      else setDone("submitted");
    } catch (err) {
      const kind = err instanceof ReviewSubmitError ? err.kind : "failed";
      if (kind === "already-reviewed") {
        if (onAlreadyReviewed) onAlreadyReviewed();
        else setDone("already-reviewed");
        return;
      }
      /* On a review link a missing purchase means the product was not on the
         order, which the page never offers — so it is the general error. */
      setError(reviewLink && kind === "purchase-required" ? "rejected" : kind);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div
        role="status"
        className={cn(
          "flex items-start gap-3 rounded-lg border border-brand-line bg-brand-soft p-4",
          className,
        )}
      >
        <Check aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <p className="text-sm font-semibold leading-6 text-foreground">
          {done === "submitted"
            ? "Thanks! Your review will appear once we've checked it."
            : "You've already reviewed this."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={cn("flex flex-col gap-5", className)}>
      {hideHeading ? (
        <p id={id("moderation")} className="sr-only">
          Reviews are read before they are published.
        </p>
      ) : (
        <div>
          <h4 className="text-base font-semibold text-foreground">Write a review</h4>
          <p id={id("moderation")} className="mt-1 text-sm text-muted-foreground">
            Tell other printers how {productName} behaved for you. Reviews are read
            before they are published.
          </p>
        </div>
      )}

      <div>
        <span className="mb-2 block text-sm font-semibold text-foreground">Rating</span>
        <StarPicker value={rating} onChange={setRating} describedBy={id("moderation")} />
        {attempted && problems.rating && (
          <p className="mt-1.5 text-sm text-destructive-strong">{problems.rating}</p>
        )}
      </div>

      <div>
        <label
          htmlFor={id("title")}
          className="mb-2 block text-sm font-semibold text-foreground"
        >
          Headline <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input
          id={id("title")}
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Prints clean straight out of the box"
        />
      </div>

      <div>
        <label
          htmlFor={id("body")}
          className="mb-2 block text-sm font-semibold text-foreground"
        >
          Your review
        </label>
        <Textarea
          id={id("body")}
          value={body}
          rows={5}
          maxLength={BODY_MAX}
          aria-invalid={attempted && problems.body ? true : undefined}
          aria-describedby={attempted && problems.body ? id("body-error") : undefined}
          onChange={(event) => setBody(event.target.value)}
          placeholder="How did it print? Any stringing, warping, or trouble with the first layer?"
        />
        {attempted && problems.body && (
          <p id={id("body-error")} className="mt-1.5 text-sm text-destructive-strong">
            {problems.body}
          </p>
        )}
      </div>

      <ReviewPhotoField
        items={photos.items}
        remaining={photos.remaining}
        onPick={photos.add}
        onRetry={photos.retry}
        onRemove={photos.remove}
        disabled={sending}
      />
      {attempted && problems.photos && (
        <p className="-mt-3 text-sm text-destructive-strong">{problems.photos}</p>
      )}

      <div>
        <label
          htmlFor={id("author")}
          className="mb-2 block text-sm font-semibold text-foreground"
        >
          Name shown on your review{" "}
          {!requireAuthorName && (
            <span className="font-normal text-muted-foreground">(optional)</span>
          )}
        </label>
        <Input
          id={id("author")}
          value={authorName}
          maxLength={AUTHOR_NAME_MAX}
          autoComplete="given-name"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? id("author-error") : undefined}
          onChange={(event) => {
            setAuthorName(event.target.value);
            if (error === "author-name") setError(null);
          }}
        />
        {nameError && (
          <p id={id("author-error")} className="mt-1.5 text-sm text-destructive-strong">
            {nameError}
          </p>
        )}
      </div>

      {error && error !== "author-name" && (
        <p role="alert" className="text-sm text-destructive-strong">
          {MESSAGES[error]}
          {error === "signed-out" && signInHref && (
            <>
              {" "}
              <Link href={signInHref} className="underline underline-offset-4">
                Sign in
              </Link>
            </>
          )}
        </p>
      )}

      <div>
        <Button
          type="submit"
          disabled={sending || photos.uploading}
          className="h-11 px-6"
        >
          {sending ? "Sending…" : photos.uploading ? "Uploading photos…" : "Submit review"}
        </Button>
      </div>
    </form>
  );
}
