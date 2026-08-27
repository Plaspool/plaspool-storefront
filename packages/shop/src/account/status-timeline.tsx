import * as React from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { Skeleton, TextSkeleton, cn } from "@plaspool/ui";

import { SR_STATE, TRACK_LINE, outcomeOf, resolveStops } from "./order-progress";
import type { Order, OrderEvent } from "../data/orders-api";
import { formatStamp } from "./stamp";

/**
 * The status history — the whole journey, vertically, with the shop's own
 * record of it filed under the stage it happened in.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS WHEN `OrderProgress` ALREADY DRAWS THE STOPS.
 *
 * They answer different questions and they are deliberately not the same
 * component. The horizontal track on the detail page answers "where is it" in
 * one glance and has room for a five-character date; this answers "what has
 * happened to it, and when, exactly" and has room for a sentence. The detail
 * page keeps the glance. This is one click further in, for the shopper who
 * wants the receipt of the journey rather than its headline.
 *
 * THE STOPS ARE THE SAME FIVE, FROM THE SAME `resolveStops`, AND THAT IS THE
 * POINT. The two surfaces cannot disagree about where an order is, because
 * neither of them decides it — `order-progress.ts` does, once, and both read
 * the answer. A second implementation here would eventually say "Shipped" on
 * one screen and "Packed" on the other, which is the defect this codebase's
 * own ledger keeps recording: the instance fixed, the sibling left.
 *
 * ═══ THE EVENTS ARE FILED BY TIME, NOT BY TYPE, AND NOTHING IS DROPPED ═══
 * `OrderEvent.message` is free text written by the admin, and its `type` is an
 * open set — only five of them map onto a stop. Filing by type would therefore
 * silently swallow every event the storefront has not heard of, which is the
 * one thing an audit trail may not do. So an event is filed under the LAST
 * STOP THAT HAD ALREADY HAPPENED WHEN IT OCCURRED: the stage the order was in
 * at the time. Every event lands somewhere, in order, and an unrecognised type
 * files itself correctly without this file knowing it exists.
 *
 * ═══ THE MOTION EXPLAINS THE SEQUENCE. IT IS NOT DECORATION ═══
 * The rule draws downward, each marker lands, and the words beside it follow —
 * in the order the events actually happened. That is the one thing a static
 * list of dates cannot show, and it is why this animates and the horizontal
 * track does not.
 *
 * Under `prefers-reduced-motion` NOTHING MOVES, and the timeline is complete
 * rather than half-drawn. That is a property of the keyframes, not of a branch
 * here: every one of the three ends in the resting state and runs with
 * `animation-fill-mode: both`, so removing the animation leaves the finished
 * frame. See `packages/ui/tailwind-preset.ts`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Milliseconds between one stop starting and the next.
 *
 * The sequence has to read as travelling DOWN the timeline rather than as
 * everything arriving at once — and it has to be OVER before somebody who came
 * for a date is kept waiting for it.
 *
 * ═══ IT WAS 110, AND THE LAST ROW WAS THE ONE THAT PAID ═══
 * `animation-fill-mode: both` supplies the backwards fill through the delay, so
 * every row is genuinely at `opacity: 0` until its turn. At 110 the terminal
 * row of a cancelled order — the row that says WHY it stopped — held blank for
 * 5×110 + 40 + 280 = 870ms. At 75 the same row lands at 695ms and the five
 * ordinary stops finish in 620ms, which still reads as a sequence.
 * The headline above the timeline is not animated and never was, so the
 * one-line answer is on screen at 0ms in every state; this paces the detail
 * underneath it, not the answer.
 */
const STEP_MS = 75;

/** Event types the TERMINAL ROW already accounts for — see `filed` below. */
const TERMINAL_TYPES = new Set(["cancelled", "refunded"]);

/** The rule leaves after its own marker has landed, so the line is drawn BY
 *  the stop above rather than racing it. */
const RULE_OFFSET_MS = 90;

/** The words follow their marker closely enough to read as one event. */
const ROW_OFFSET_MS = 40;

/**
 * What each stop MEANS, in the shopper's words — shown on the stop the order
 * has actually reached and nowhere else.
 *
 * ONE LINE, ON ONE ROW. A sentence under all five turns an audit trail into a
 * wall of explanation nobody asked for; a sentence under none leaves the one
 * row that matters — the row the shopper opened this page for — saying a
 * single word. So the furthest stop reached gets to explain itself and the
 * rest state themselves plainly.
 */
export const MEANING: Record<string, string> = {
  Placed: "Payment is what happens next.",
  Paid: "We're picking and packing it.",
  Packed: "It's waiting for the courier.",
  Shipped: "It's on its way to you.",
  Delivered: "It arrived. Thanks for shopping.",
};

/**
 * ═══ EVERY ONE OF THOSE FITS ON ONE LINE AT 320px, AND THAT IS A CONSTRAINT
 * RATHER THAN A COINCIDENCE ═══
 *
 * They were a sentence longer each — "Payment is in. We're picking and packing
 * it." — and at 320px the marked row's explanation wrapped to two lines, making
 * that row 103.75px against the 83.75px its placeholder reserved. A 20px settle
 * on the one row a shopper opened the page to read.
 *
 * The obvious repairs are both worse. Reserving TWO lines in the skeleton is
 * right at 320px and 20px too tall everywhere else, because the wrap point is
 * around 360px and no breakpoint sits there. Truncating the real line throws
 * away the half of the sentence that explains anything.
 *
 * So the copy is bounded instead: at 320px this column is 244px wide, which is
 * ~36 characters of `text-sm` Titillium. Keep every string above under that and
 * the row is ONE height at every width, by construction, with no arithmetic
 * anywhere and nothing for a placeholder to guess at. A longer sentence here is
 * a layout shift, not a wording change.
 */
export const MEANING_MAX_CHARS = 36;

export interface StatusTimelineProps {
  order: Order;
  events: OrderEvent[];
  /** The refunded sum, already formatted by the page that owns the currency —
   *  the same prop `OrderProgress` takes, for the same reason: without it the
   *  timeline cannot tell a part refund from a whole one. */
  refundAmount?: string;
  className?: string;
}

/**
 * Which stop each event belongs under.
 *
 * Exported because it is the one piece of judgement on this page and a test
 * can hold it still. Returns an array parallel to `stops`.
 */
export function fileEventsByStop(
  stops: { types: string[]; at: number | null }[],
  events: OrderEvent[],
): OrderEvent[][] {
  const filed: OrderEvent[][] = stops.map(() => []);
  /* Oldest first. The admin's own events read is already `ORDER BY occurred_at
     ASC` — an earlier version of this comment claimed the opposite — so this
     sort is belt and braces rather than a correction: a journey reads forwards,
     and depending on a remote ORDER BY for the page's meaning is a dependency
     nobody would notice breaking. */
  const ordered = [...events].sort((a, b) => a.occurredAt - b.occurredAt);

  for (const event of ordered) {
    /* ═══ AN EVENT THAT IS A STOP FILES UNDER ITS OWN STOP ═══
       Time alone was not enough, and the case it broke is the COMMON one.
       Paying at checkout makes `placedAt === paidAt`, and "the last stop whose
       timestamp is `<= this event`" then resolves the tie in favour of the
       LATER stop — so the `placed` event filed under Paid, and Placed showed
       nothing at all. Measured on the bench's "Paid — one item" case: both
       events under stop 2, stop 1 empty.
       A type that names a stop is unambiguous evidence of which stop it belongs
       to, so it is used first. This is not the "file by type" scheme the header
       rejects — that one DROPPED anything unrecognised. Here type is a
       shortcut for the five known cases and time is still the answer for
       everything else, so nothing is ever lost. */
    const byType = stops.findIndex((s) => s.types.includes(event.type));
    if (byType !== -1) {
      filed[byType]!.push(event);
      continue;
    }

    /* The last stop that had already happened. An event predating every stop,
       which a clock skew can produce, files under the first rather than being
       dropped: "somewhere slightly wrong" beats "gone". */
    let index = 0;
    stops.forEach((stop, i) => {
      if (stop.at !== null && stop.at <= event.occurredAt) index = i;
    });
    filed[index]!.push(event);
  }
  return filed;
}

export function StatusTimeline({ order, events, refundAmount, className }: StatusTimelineProps) {
  const outcome = outcomeOf(order, events);
  /* `outcome.over`, not `outcome.kind !== null` — a part refund leaves the order
     in flight, so its track keeps a current stop and a "you are here". */
  const stops = resolveStops(order, events, outcome.kind === "cancelled", outcome.over);
  /* ═══ THE EVENT THAT ENDED THE ORDER IS NOT ALSO A STAGE NOTE ═══
     `cancelled` and `refunded` name no stop, so `fileEventsByStop`'s time
     fallback filed them under whichever stage they happened during — and the
     terminal row below then said the same thing again, a few rows down. One
     fact, twice, in the two places a shopper is most likely to compare. The
     terminal row is where an ending belongs, so the log does not repeat it. */
  const filed = fileEventsByStop(
    stops,
    events.filter((e) => !TERMINAL_TYPES.has(e.type)),
  );

  /* The furthest stop reached — the one that gets to explain itself. Computed
     the same way `OrderProgress` computes its own marked column, because the
     two must emphasise the same row. */
  const markedIndex = stops.reduce(
    (found, stop, i) => (stop.state === "done" || stop.state === "current" ? i : found),
    0,
  );

  /* A stopped order gets a terminal row rather than a sixth stop. It did not
     progress to "cancelled" — it stopped being an order in progress, and the
     shape on the page should say so: no marker in the sequence, a rule that
     ends, and the reason. */
  const terminal = !outcome.over
    ? null
    : outcome.kind === "cancelled"
      ? {
          icon: <X aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />,
          label: "Cancelled",
          at: outcome.at,
          meaning: "This order stopped here. Nothing further will be sent.",
        }
      : {
          icon: <RotateCcw aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />,
          label: refundAmount ? `${refundAmount} refunded` : "Refunded",
          at: outcome.at,
          meaning: "The money has gone back to how you paid.",
        };

  /* ═══ A PART REFUND IS A NOTE, NOT AN ENDING ═══
     It used to take the terminal row above, which said "The money has gone back
     to how you paid." when only part of it had — on an order still being
     shipped, under a track that had been told to stop marking anything as
     current. The refund is a fact worth stating and it is stated; what it may
     not do is end a journey the shop is still on. */
  const partialRefund =
    outcome.kind === "partly_refunded"
      ? refundAmount
        ? `${refundAmount} of this order was refunded${outcome.at !== null ? ` on ${formatStamp(outcome.at)}` : ""}. The rest is still on its way.`
        : "Part of this order was refunded. The rest is still on its way."
      : null;

  const lastIndex = stops.length - 1;

  return (
    /* `role="list"` is implicit on `<ol>`; the label is what a screen reader
       user needs to know they have landed on the history rather than the
       order. No `<nav>` — there is nothing here to navigate to. */
    <ol aria-label="Status history" className={cn("relative", className)}>
      {stops.map((stop, i) => {
        const delay = i * STEP_MS;
        const stopEvents = filed[i] ?? [];
        /* The rule below this stop is drawn when the NEXT stop has been
           reached — the same test the horizontal track's connector uses, so
           the two surfaces shade the journey identically. The terminal row
           needs one below the last stop as well. */
        const nextReached =
          i < lastIndex
            ? stops[i + 1]?.state === "done" || stops[i + 1]?.state === "current"
            : terminal !== null || partialRefund !== null;
        const hasRule = i < lastIndex || terminal !== null || partialRefund !== null;

        return (
          <li
            key={stop.label}
            aria-current={stop.state === "current" ? "step" : undefined}
            className="flex gap-3 sm:gap-4"
          >
            <StopColumn
              delay={delay}
              hasRule={hasRule}
              ruleReached={nextReached}
              marker={<StopMarker state={stop.state} />}
            />

            {/* `pb-6` ON THE CONTENT, NOT ON THE ROW. The rule's height is the
                row's height, so padding that belongs to the row would be
                measured into the rule and the geometry would still be right —
                but padding on the CONTENT is what keeps the last row from
                carrying trailing space under a rule that no longer exists. */}
            <div
              className={cn("min-w-0 flex-1 animate-row-in motion-reduce:animate-none", i === lastIndex && !terminal ? "pb-1" : "pb-6")}
              style={{ animationDelay: `${delay + ROW_OFFSET_MS}ms` }}
            >
              <StopHeading stop={stop} />

              {/* ═══ NOT ON AN ORDER THAT STOPPED ═══
                  `MEANING` is written in the present tense about a parcel that
                  is still moving — "It's with the courier and on its way to
                  you." On a CANCELLED or REFUNDED order the furthest stop
                  reached is `done` rather than `current`, so a guard of "not
                  upcoming" let it through: the cancelled case read "Payment is
                  in. We're picking and packing it." directly under a headline
                  saying "Order cancelled", and the refunded one promised a
                  courier 40px above "₦26,000 refunded".
                  That is the page contradicting itself inside one panel, which
                  is the failure this whole file is written against. A stopped
                  order's explanation is the TERMINAL ROW at the bottom, which
                  says what actually happened; the stops above it are a record
                  of how far it got, and a record does not make promises. */}
              {i === markedIndex && !outcome.over && MEANING[stop.label] && stop.state !== "upcoming" && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {MEANING[stop.label]}
                </p>
              )}

              <EventList events={stopEvents} stopAt={stop.at} />
            </div>
          </li>
        );
      })}

      {partialRefund && (
        <li className="flex gap-3 sm:gap-4">
          <StopColumn
            delay={stops.length * STEP_MS}
            hasRule={false}
            ruleReached={false}
            marker={
              <TerminalMarker>
                <RotateCcw aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
              </TerminalMarker>
            }
          />
          <div
            className="min-w-0 flex-1 animate-row-in pb-1 motion-reduce:animate-none"
            style={{ animationDelay: `${stops.length * STEP_MS + ROW_OFFSET_MS}ms` }}
          >
            <p className="text-sm text-muted-foreground">{partialRefund}</p>
          </div>
        </li>
      )}

      {terminal && (
        <li className="flex gap-3 sm:gap-4">
          <StopColumn
            delay={stops.length * STEP_MS}
            hasRule={false}
            ruleReached={false}
            marker={<TerminalMarker>{terminal.icon}</TerminalMarker>}
          />
          <div
            className="min-w-0 flex-1 animate-row-in pb-1 motion-reduce:animate-none"
            style={{ animationDelay: `${stops.length * STEP_MS + ROW_OFFSET_MS}ms` }}
          >
            <p className="text-sm font-semibold text-foreground">{terminal.label}</p>
            {terminal.at !== null && (
              <p className={cn(TRACK_LINE.meta, "mt-0.5 text-muted-foreground")}>
                {formatStamp(terminal.at)}
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">{terminal.meaning}</p>
          </div>
        </li>
      )}
    </ol>
  );
}

/**
 * The marker and the rule under it — one column, `self-stretch`, so the rule's
 * height is the row's height.
 *
 * ═══ CENTRE TO CENTRE, EXACTLY AS THE HORIZONTAL TRACK DOES IT ═══
 * `top-4 h-full` inside a column stretched to the row's height reaches from
 * this marker's centre to the next one's, because the next row's marker centre
 * is one row-height below this one's. So each end of the rule finishes deep
 * INSIDE an opaque marker: there is nothing to align at the join, and no
 * second half-rule to disagree with it. `top-4` is the middle of the `h-8`
 * marker row, and the two are a pair — change one without the other and the
 * line comes off the markers' centres.
 *
 * `transform-origin: top` is what makes the draw read as downward travel. It
 * is an inline style rather than `origin-top` for no reason other than that it
 * sits beside the delay it belongs with; either is correct.
 */
function StopColumn({
  delay,
  hasRule,
  ruleReached,
  marker,
}: {
  delay: number;
  hasRule: boolean;
  ruleReached: boolean;
  marker: React.ReactNode;
}) {
  return (
    <div className="relative flex w-8 shrink-0 justify-center self-stretch">
      {hasRule && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-1/2 top-4 h-full w-px -translate-x-1/2 animate-rule-draw motion-reduce:animate-none",
            /* Dark behind you, muted ahead of you — `muted-foreground` measures
               5.05:1 on the page background; `brand-line` is 1.83:1 and under
               the 3:1 a graphic needs. */
            ruleReached ? "bg-foreground" : "bg-muted-foreground",
          )}
          style={{ animationDelay: `${delay + RULE_OFFSET_MS}ms`, transformOrigin: "top" }}
        />
      )}
      {/* AFTER the rule in the DOM so the marker paints over it — both sit at
          `z-index: auto`, so tree order decides. `h-8` whatever size marker
          this row holds, so every marker's centre is one `top-4` down. */}
      <span
        className="relative flex h-8 items-center justify-center animate-stop-in motion-reduce:animate-none"
        style={{ animationDelay: `${delay}ms` }}
      >
        {marker}
      </span>
    </div>
  );
}

/** The stop's name and its stamp. */
function StopHeading({ stop }: { stop: ReturnType<typeof resolveStops>[number] }) {
  return (
    <>
      <p
        className={cn(
          "text-sm",
          (stop.state === "done" || stop.state === "current") && "font-semibold text-foreground",
          stop.state === "current" && "text-foreground",
          stop.state === "upcoming" && "text-foreground/70",
          /* Struck through, because this stop is not merely pending — it is
             never going to happen. */
          stop.state === "stopped" && "text-foreground/70 line-through",
        )}
      >
        {stop.label}
        <span className="sr-only">{SR_STATE[stop.state]}</span>
      </p>
      {/* ═══ THE SECOND LINE IS RESERVED ON EVERY ROW, SAID OR NOT ═══
          It used to render only when there was something to say, so an
          un-reached stop was one line tall and a reached one was two — and the
          loading state, which cannot know which is which, stood 15.75px too
          tall over every stop still to come. Measured: skeleton rows
          [59.75 × 4, 39.75] against a waiting order's [83.75, 44, 44, 44, 32].
          `OrderProgress` hit exactly this on the horizontal track and fixed it
          by holding the line's space with `invisible`; the vertical timeline
          never inherited the fix. Same remedy, so every row is the same height
          at any width and any type size, by construction rather than by
          arithmetic.
          NO DATE IS STILL NOT A BLANK LINE, though. A stop that is done without
          a stamp — the order shipped but its `fulfillment_created` event never
          reached us — says so, because "Packed" over silence reads as a date
          that failed to load rather than one the shop does not have. */}
      <p
        aria-hidden={metaLine(stop) === null ? "true" : undefined}
        className={cn(
          TRACK_LINE.meta,
          "mt-0.5 text-muted-foreground",
          metaLine(stop) === null && "invisible",
        )}
      >
        {metaLine(stop) ?? "—"}
      </p>
    </>
  );
}

/**
 * The shop's own record of what happened at this stage.
 *
 * QUIETER THAN THE STOP IT SITS UNDER, and indented by a hairline rather than
 * by whitespace: these are supporting detail, and a reader scanning stop names
 * needs them to fall away. The rule is `brand-line` because it is decoration
 * here — it separates, it does not carry the meaning the timeline's own rule
 * does.
 */
function EventList({ events, stopAt }: { events: OrderEvent[]; stopAt: number | null }) {
  /* ═══ AN EVENT WITH NOTHING TO SAY IS NOT A ROW ═══
     `OrderEvent.message` is admin free text and machine-written events leave it
     blank. An empty message rendered a bullet holding nothing but a timestamp
     the stop above had ALREADY printed — so a shopper read the same instant two
     and three times in a row and learned nothing from any of them. A stage with
     no note now shows no note. */
  const said = events.filter((event) => event.message.trim() !== "");
  if (said.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-col gap-2 border-l border-brand-line pl-3">
      {said.map((event) => (
        <li key={event.id} className="text-xs">
          <span className="text-foreground">{event.message}</span>
          {/* ═══ AND IT DOES NOT RESTATE THE STOP'S OWN STAMP ═══
              The stop's date is DERIVED from one of these events —
              `resolveStops` reads the same log — so the event that dated the
              stop would print the identical string one line under it. Only an
              event at a DIFFERENT instant from its stop carries new
              information, and only that one is dated. */}
          {event.occurredAt !== stopAt && (
            <>
              {" "}
              <span className="whitespace-nowrap text-muted-foreground">
                {formatStamp(event.occurredAt)}
              </span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The stop's own second line, or `null` when it has nothing to say — in which
 *  case the caller reserves the space rather than closing it up. */
function metaLine(stop: ReturnType<typeof resolveStops>[number]): string | null {
  if (stop.at !== null) return formatStamp(stop.at);
  return stop.state === "done" ? "Date not recorded" : null;
}


/**
 * The marker. Deliberately the same vocabulary as the horizontal track's:
 * square, hairline, filled when done, BIGGER and ringed when current.
 *
 * Size is what separates "here" from "done" — colour is the last cue added,
 * not the one carrying the meaning, so the track still reads in greyscale and
 * on a bad screen. `outline` rather than `ring` for the same reason it is an
 * outline over there: a ring-offset is an opaque box-shadow in the page's own
 * colour and it would eat three pixels of the rule; an outline-offset is
 * transparent and the rule runs through it.
 */
function StopMarker({ state }: { state: string }) {
  const current = state === "current";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex shrink-0 items-center justify-center border bg-background transition-colors",
        current ? "h-8 w-8" : "h-6 w-6",
        state === "done" && "border-foreground bg-foreground text-background",
        current &&
          "border-brand bg-brand text-background outline outline-1 outline-brand outline-offset-2",
        state === "upcoming" && "border-dashed border-muted-foreground",
        state === "stopped" && "border-dashed border-muted-foreground",
      )}
    >
      {state === "done" && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      {current && <Check className="h-4 w-4" strokeWidth={3} />}
    </span>
  );
}

/** The end of a stopped order. Hollow with a solid stroke — it is not a stop
 *  that was reached, so it does not wear a reached stop's fill. */
function TerminalMarker({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="relative flex h-6 w-6 shrink-0 items-center justify-center border border-foreground bg-background text-foreground"
    >
      {children}
    </span>
  );
}

/**
 * The timeline's wait.
 *
 * Five rows, the same column, the same `h-8` marker row and the same `pb-6` —
 * so nothing moves when the events land. It draws no rule: a rule whose length
 * is a row's height is correct by construction in the real timeline, and a
 * placeholder that guessed at one would be the first thing to drift.
 */
export function StatusTimelineSkeleton() {
  return (
    <ol aria-hidden="true" className="relative">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="flex gap-3 sm:gap-4">
          <div className="relative flex w-8 shrink-0 justify-center self-stretch">
            <span className="flex h-8 items-center justify-center">
              <Skeleton className="h-6 w-6" />
            </span>
          </div>
          <div className={cn("min-w-0 flex-1", i === 4 ? "pb-1" : "pb-6")}>
            {/* The placeholder takes its height from the type it stands in for,
                never from a bar picked to look about right — the rule
                `TrackLineSkeleton` established next door. Both lines are drawn
                on every row because the resolved timeline reserves both on
                every row; see `StopHeading`. */}
            <TextSkeleton className="w-24 text-sm" />
            <TextSkeleton className={cn(TRACK_LINE.meta, "mt-0.5 w-40")} />
            {/* ═══ ONE ROW CARRIES A THIRD LINE, AND THIS GUESSES WHICH ═══
                The furthest stop reached explains itself in a sentence, and
                which stop that is, is precisely what has not loaded yet. Stop 3
                of 5 is assumed — a mid-flight order — for the same reason the
                horizontal track's placeholder assumes it: it is the guess that
                moves fewest bars across the states this actually renders in.
                Unreserved, the row it lands on grew 24px on resolve. */}
            {i === 2 && <TextSkeleton className="mt-1 w-52 max-w-full text-sm" />}
          </div>
        </li>
      ))}
    </ol>
  );
}

