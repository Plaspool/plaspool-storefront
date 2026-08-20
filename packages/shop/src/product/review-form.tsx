"use client";

import * as React from "react";
import { Check, Star } from "lucide-react";
import { Button, Input, Textarea, cn } from "@plaspool/ui";

import { ReviewSubmitError, submitReview } from "../data/reviews";
import type { SubmitError } from "../data/reviews";

/**
 * Writing a review.
 *
 * MODERATION IS SAID OUT LOUD, BEFORE AND AFTER. Every review enters the queue
 * as `pending` and appears only once a human approves it, so the form says so
 * above the fields and the confirmation says it again. A form that accepts a
 * review and then shows a page without it reads as a bug, and the customer's
 * next move is to write it a second time.
 *
 * The API is the validator; the rules below mirror it so a too-short body is
 * reported by the field beside it rather than by a 400 from another origin.
 * Where the two could drift the API wins, and its refusal renders here as an
 * error rather than being second-guessed.
 *
 * There is no account yet — the auth bundle is sequenced after this — so the
 * name and email are typed. The email is never published (the public
 * projection cannot return it) and the form says so where it asks, because
 * "why do you want my email" is the question that stops someone submitting.
 */

/** The API's own floor: "not left holding a single character by accident". */
const BODY_MIN = 10;
const BODY_MAX = 5000;

const MESSAGES: Record<SubmitError, string> = {
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
  className?: string;
}

export function ReviewForm({ productSlug, productName, className }: ReviewFormProps) {
  const [rating, setRating] = React.useState(0);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [authorName, setAuthorName] = React.useState("");
  const [authorEmail, setAuthorEmail] = React.useState("");

  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<SubmitError | null>(null);
  const [done, setDone] = React.useState(false);
  /* Validation appears only after a submit attempt. Telling someone their
     review is too short before they have finished the first sentence is the
     form arguing with them while they type. */
  const [attempted, setAttempted] = React.useState(false);

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
    authorName: authorName.trim() ? null : "Tell us what to call you.",
    authorEmail: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(authorEmail.trim())
      ? null
      : "We need a valid email address.",
  };
  const valid = Object.values(problems).every((problem) => problem === null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setAttempted(true);
    setError(null);
    if (!valid || sending) return;

    setSending(true);
    try {
      await submitReview({ productSlug, rating, title, body, authorName, authorEmail });
      setDone(true);
    } catch (err) {
      setError(err instanceof ReviewSubmitError ? err.kind : "failed");
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
        <div className="text-sm leading-6">
          <p className="font-semibold text-foreground">Thank you — we have your review.</p>
          <p className="text-muted-foreground">
            Every review is read before it goes up, so it will appear on this page
            shortly rather than straight away.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={cn("flex flex-col gap-5", className)}>
      <div>
        <h4 className="font-sans text-base font-semibold text-foreground">Write a review</h4>
        <p id={id("moderation")} className="mt-1 text-sm text-muted-foreground">
          Tell other printers how {productName} behaved for you. Reviews are read
          before they are published.
        </p>
      </div>

      <div>
        <span className="mb-2 block font-sans text-sm font-semibold text-foreground">
          Rating
        </span>
        <StarPicker value={rating} onChange={setRating} describedBy={id("moderation")} />
        {attempted && problems.rating && (
          <p className="mt-1.5 text-sm text-destructive-strong">{problems.rating}</p>
        )}
      </div>

      <div>
        <label
          htmlFor={id("title")}
          className="mb-2 block font-sans text-sm font-semibold text-foreground"
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
          className="mb-2 block font-sans text-sm font-semibold text-foreground"
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

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor={id("name")}
            className="mb-2 block font-sans text-sm font-semibold text-foreground"
          >
            Name
          </label>
          <Input
            id={id("name")}
            value={authorName}
            maxLength={120}
            autoComplete="name"
            aria-invalid={attempted && problems.authorName ? true : undefined}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder="Shown with your review"
          />
          {attempted && problems.authorName && (
            <p className="mt-1.5 text-sm text-destructive-strong">{problems.authorName}</p>
          )}
        </div>

        <div>
          <label
            htmlFor={id("email")}
            className="mb-2 block font-sans text-sm font-semibold text-foreground"
          >
            Email
          </label>
          <Input
            id={id("email")}
            type="email"
            value={authorEmail}
            maxLength={254}
            autoComplete="email"
            aria-invalid={attempted && problems.authorEmail ? true : undefined}
            aria-describedby={id("email-note")}
            onChange={(event) => setAuthorEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <p id={id("email-note")} className="mt-1.5 text-xs text-muted-foreground">
            Never published — only so we can reach you about the review.
          </p>
          {attempted && problems.authorEmail && (
            <p className="mt-1.5 text-sm text-destructive-strong">{problems.authorEmail}</p>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive-strong">
          {MESSAGES[error]}
        </p>
      )}

      <div>
        <Button type="submit" disabled={sending} className="h-11 px-6">
          {sending ? "Sending…" : "Submit review"}
        </Button>
      </div>
    </form>
  );
}
