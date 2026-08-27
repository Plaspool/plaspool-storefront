import * as React from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { Skeleton, cn } from "@plaspool/ui";

import type { Order, OrderEvent } from "../data/orders-api";
import { formatStamp } from "./stamp";

/**
 * Where the order has got to, and — the part that was missing — WHAT IS LEFT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE OLD TIMELINE ONLY LOOKED BACKWARDS. It listed events that had already
 * happened, each behind an identical green check, so nothing marked where the
 * order actually WAS and nothing at all showed what was still to come. The
 * question that brings a shopper to this page is "where is my order?", and a
 * list of things that already happened is not an answer to it.
 *
 * FIVE STOPS, AND EVERY ONE OF THEM IS DERIVABLE FROM DATA WE ACTUALLY HAVE.
 * `OrderTimelineType` in the admin's `orders/repo/orders.ts` is the source:
 * `placed`, `paid`, `fulfillment_created`, `shipped`, `delivered` map one-to-one
 * onto the stops below. `Order` carries `placedAt`/`paidAt`/`fulfilledAt` as a
 * fallback for an order whose `/events` call failed, so the track still draws
 * when the timeline does not.
 *
 * ═══ THE MARKED STOP IS THE FURTHEST ONE REACHED, NOT THE NEXT ONE OWED ═══
 * This was wrong in the first cut and it was the worst thing on the page. The
 * emphasis sat on the first stop that had NOT happened, so a parcel in transit
 * put its one filled marker under "Delivered", and an unpaid order announced
 * "Paid — in progress" to a screen reader when nothing was in progress and the
 * shopper was the one who had to act. A tracker's highlight has to mean "you
 * are here"; anywhere else it is a claim about the future.
 *
 * WHAT IS DELIBERATELY NOT DRAWN. No delivery estimate, no courier, no tracking
 * number, no map. Nothing in the order model carries any of them, and a
 * plausible-looking ETA on a page a shopper trusts is a promise the shop never
 * made. The track says what has happened and what has not; it does not guess
 * when.
 *
 * ═══ COLOUR IS NEVER THE ONLY SIGNAL, AND THE CONTRAST IS MEASURED AGAINST
 * THE PANEL THIS SITS ON ═══
 * The current stop is a LARGER square with a ring; done is a smaller filled
 * check; upcoming is hollow and dashed; a stop that will never happen is struck
 * through. Size and glyph carry the whole sequence, so it survives greyscale —
 * the first cut leaned on brand-vs-black fills that measured 1.28:1 apart and
 * vanished the moment colour did.
 *
 * The secondary text is `foreground/70`, NOT `muted-foreground` — and THE
 * NUMBERS THIS NOTE USED TO GIVE WERE WRONG. It claimed `muted-foreground`
 * measured 4.74:1 on white and 4.30:1 on the panel, "under AA". Re-measured off
 * the rendered page: `muted-foreground` resolves to rgb(104,104,104), the
 * `bg-brand-soft/50` panel flattens to rgb(244,243,249), and the pair is
 * 5.57:1 on white and 5.05:1 on the panel. It PASSES AA on both. `foreground/70`
 * stays on its own merits — 7.30:1 on the panel, headroom this type scale wants
 * at 11px, and one token across every secondary line here — not because the
 * alternative failed. The half of the old note that was true is the method:
 * contrast is a property of a pair, and the pair is the panel, not the page.
 *
 * ═══ ONE RULE PER GAP, DRAWN AT A HEIGHT NOTHING CAN MOVE ═══
 * The connecting line used to be TWO half-rules per gap — the right-hand
 * connector of one stop and the left-hand connector of the next — laid out as
 * flex siblings of the marker inside a row whose height was whatever that
 * stop's marker happened to be. `items-center` therefore centred each row's
 * halves on ITS OWN marker: 12px down a 24px row, 16px down a 32px one. The
 * line stepped 4px at both edges of the current stop (measured on `Paid` at
 * 1280px: 6283.8px against 6287.8px), the current stop's LABEL sat 8px below
 * its neighbours' for the same reason, and the two halves of one gap, being
 * independent elements, were free to disagree about anything else too.
 *
 * The rule is now ONE element per gap, absolutely positioned from this stop's
 * centre to the next one's, inside a marker row that is ALWAYS `h-8` — the
 * tallest marker's height — whatever size marker it holds. Every rule sits one
 * `top-4` below the top of a track whose columns all start together, so there
 * is no arithmetic to get wrong and no second half to disagree with, at any
 * width and any type size (both are `rem`, so they scale as a pair).
 *
 * DO NOT "SIMPLIFY" THIS BACK INTO FLEX SIBLINGS OF THE MARKER. A rule that is
 * a flex child of the marker's row inherits that row's height, and the moment
 * two rows differ in height — which is the entire point of the current marker
 * — the line breaks again. Making every marker the same size would also
 * "fix" it, and that is the accessibility regression this file already reversed
 * once: see above, size is the cue that survives greyscale.
 *
 * ═══ AND THE CURRENT MARKER IS RINGED WITH `outline`, NOT `ring` ═══
 * `ring-offset-2 ring-offset-brand-soft/50` paints a 2px band of the PANEL'S
 * OWN COLOUR around the marker as a box-shadow, over whatever was drawn
 * underneath — which is the rule. The marker's shadow covered the rule on its
 * left (drawn earlier in the row) and the rule covered the ring on its right
 * (drawn later): one seam, mirrored, three pixels wide. `outline-offset-2`
 * leaves that band transparent instead, so the rule runs through it, and the
 * ring reads exactly as it did — a 1px brand stroke, 2px clear of the marker.
 * ═══════════════════════════════════════════════════════════════════════════
 */

interface Stop {
  /** The shopper's word for it. Never the enum. */
  label: string;
  /** Event types that satisfy this stop, most specific first. */
  types: string[];
  /** Timestamp from the order itself: a fallback for every stop except
   *  `Placed`, where the order's own column is the canonical answer. */
  fallback?: (order: Order) => number | null;
  /** `Placed` prefers `order.placedAt` so the stop cannot disagree with the
   *  "Placed <date>" the page header prints from the same field. */
  preferOrder?: boolean;
}

/*
 * ═══ `fulfilledAt` HANGS OFF **SHIPPED**, AND IT USED TO HANG OFF PACKED ═══
 *
 * That was a misreading of the column, and it made the page lie in a path it
 * actually takes. In the admin, `fulfilled_at` has EXACTLY ONE WRITER
 * (`orders/repo/orders.ts`, `SET status = 'fulfilled', fulfilled_at = ${now}`)
 * and it means every line has SHIPPED. Packing writes no column at all —
 * `createFulfillment` only appends a `fulfillment_created` timeline row and
 * leaves `status = 'paid'`, `fulfilled_at` NULL.
 *
 * So on an order whose `/events` call failed — which `order-detail.tsx` and
 * `order-status-page.tsx` both degrade to `events: []` BY DESIGN — a fully
 * shipped order resolved its furthest stop to `Packed` and the page headlined
 * "Packed and waiting to go out" about a parcel already with the courier.
 *
 * Hung off `Shipped`, the same order reads "On its way to you", which is what
 * the column means. `Packed` is now reachable only from a `fulfillment_created`
 * EVENT — correct, because that event is the only thing in the system that
 * means packed — and an order with no events simply skips a stop it cannot
 * evidence, which `resolveStops` already renders as done-without-a-date.
 */
const STOPS: Stop[] = [
  { label: "Placed", types: ["placed"], fallback: (o) => o.placedAt, preferOrder: true },
  { label: "Paid", types: ["paid", "payment_authorized"], fallback: (o) => o.paidAt },
  { label: "Packed", types: ["fulfillment_created"] },
  { label: "Shipped", types: ["shipped"], fallback: (o) => o.fulfilledAt },
  { label: "Delivered", types: ["delivered"] },
];

type StopState = "done" | "current" | "upcoming" | "stopped";

interface ResolvedStop extends Stop {
  state: StopState;
  at: number | null;
}

/**
 * A stop is reached when an event satisfies it. The LAST reached stop is the
 * current one — "you are here" — and everything after it is still to come.
 *
 * A completed order has no "in progress" stop: the last reached stop is
 * `Delivered` and there is nothing ahead of it, so the caller draws no "Now".
 */
export function resolveStops(
  order: Order,
  events: OrderEvent[],
  cancelled = false,
  settled = false,
): ResolvedStop[] {
  const firstOf = (types: string[]): number | null => {
    for (const type of types) {
      const hit = events.find((e) => e.type === type);
      if (hit) return hit.occurredAt;
    }
    return null;
  };

  const timed = STOPS.map((stop) => ({
    ...stop,
    at: stop.preferOrder
      ? (stop.fallback?.(order) ?? firstOf(stop.types))
      : (firstOf(stop.types) ?? stop.fallback?.(order) ?? null),
  }));

  /* The furthest stop with a timestamp, so a gap in the middle — an order whose
     `paid` event is missing but which has shipped — still marks the true
     position rather than stalling the highlight at the hole. */
  let lastReached = -1;
  timed.forEach((stop, i) => {
    if (stop.at !== null) lastReached = i;
  });

  return timed.map((stop, i) => ({
    ...stop,
    state:
      i === lastReached
        ? /* Nothing is "now" on an order that stopped, and nothing is "now" on
             one that has been refunded — both are over. The furthest stop each
             reached is simply the last thing that happened to it. */
          cancelled || settled
          ? "done"
          : "current"
        : /* ═══ ANYTHING BEFORE THE FURTHEST STOP IS DONE, DATED OR NOT ═══
             A stop with no timestamp used to fall through to "upcoming", so an
             order whose `fulfillment_created` event was missing drew a track
             reading "Shipped — where your order is now" beside "Packed — not
             yet": a parcel in transit that was never packed. Fulfilment is
             linear — delivered implies shipped implies packed — so a later stop
             having happened is proof this one did. It renders as done WITHOUT a
             date, because the date is the part we genuinely do not know. */
          i < lastReached
          ? "done"
          : /* ═══ `settled` TOO, NOT JUST `cancelled` ═══
               A fully refunded order that never shipped drew "Delivered — not
               yet" inside a panel declaring the order over: "not yet" is a
               promise about a future this order does not have. Both states end
               it, so both strike the stops that will never come.
               A part refund is NOT settled (see `outcomeOf`), so a still-moving
               order keeps its ordinary "not yet". */
            cancelled || settled
            ? "stopped"
            : "upcoming",
  }));
}

/**
 * When the order stopped rather than progressed, as a timestamp.
 *
 * The track is KEPT and re-stated rather than replaced. Replacing it with the
 * words "Order cancelled" threw away the one thing a cancelled order still has
 * to say — how far it had got before it stopped — and repeated a heading that
 * was already directly above it.
 */
function cancellation(order: Order, events: OrderEvent[]): number | null {
  if (order.cancelledAt) return order.cancelledAt;
  if (order.status !== "cancelled") return null;
  return events.find((e) => e.type === "cancelled")?.occurredAt ?? order.placedAt;
}

/**
 * WHETHER the order was refunded — a fact the order itself carries.
 *
 * ═══ SEPARATED FROM *WHEN*, AND THAT SEPARATION IS THE WHOLE POINT ═══
 * These used to be one function returning a date, and `settled` was derived from
 * that date being non-null. The order has no `refunded_at` column, so the date
 * can only ever come from the event log — which meant an order whose `/events`
 * call failed (`order-detail.tsx` passes `events: []` on any fetch failure, by
 * design) read as NOT settled. It then headlined "Refunded" from `order.status`
 * while the track under it announced "Packed — where your order is now", with a
 * live "Now" badge and a green check, and never mentioned the money at all: the
 * page contradicting itself inside one panel, from data it was holding.
 *
 * `cancellation()` directly above already had this fallback — it degrades to
 * `order.placedAt` rather than to "not cancelled". This is the same repair on
 * the twin that was missed, which is the shape this codebase's defects keep
 * taking: the instance fixed, the sibling left.
 */
function isRefunded(order: Order): boolean {
  return order.refundedTotal > 0 || order.status === "refunded";
}

/** WHEN the refund was issued, if the event log reached us. Null is a real and
 *  survivable answer: the note states the refund without a date, exactly as a
 *  stop renders "done" without one when its own event is missing. */
function refundedAt(order: Order, events: OrderEvent[]): number | null {
  if (!isRefunded(order)) return null;
  return events.find((e) => e.type === "refunded")?.occurredAt ?? null;
}

/**
 * WHETHER THE ORDER STOPPED RATHER THAN PROGRESSED, AND WHEN — as one answer.
 *
 * The three functions above are the pieces; this is the question every caller
 * actually has, and it exists so there is exactly one place that knows a
 * cancellation outranks a refund. `OrderProgress`'s note below is built from
 * it, and so is the status history's terminal row — two surfaces that must
 * never disagree about whether an order is over, because a shopper reads them
 * one click apart.
 *
 * `at: null` WITH A NON-NULL `kind` IS A REAL AND SURVIVABLE ANSWER, and the
 * reason this returns a pair rather than a date. The FACT of a refund is on the
 * order (`refundedTotal`, `status`); the DATE only ever comes from the event
 * log, and `order-detail.tsx` passes `events: []` on any fetch failure by
 * design. Collapsing the two would make an order whose `/events` call failed
 * read as not refunded — the exact defect `isRefunded` was split out to stop.
 */
export function outcomeOf(order: Order, events: OrderEvent[]): Outcome {
  const stopped = cancellation(order, events);
  if (stopped !== null) return { kind: "cancelled", at: stopped, over: true };

  if (isRefunded(order)) {
    /* ═══ A PART REFUND DOES NOT END AN ORDER, AND TREATING IT AS ONE WAS A LIE
       ═══
       `isRefunded` is true for ANY money coming back — `refundedTotal > 0` — and
       everything downstream read that as "this order is over". The admin
       explicitly allows the opposite: `createFulfillment`'s guard is
       `status IN ('paid','partially_refunded')`, so an order with one line
       refunded can be packed and shipped afterwards. That order was filed under
       the list's "Cancelled & refunded" tab and its track marked NOTHING as
       current — a parcel a courier was carrying, listed under orders that
       stopped, with no "you are here" on it.
       So "over" is now the STRICT test and it is separate from "money came
       back". Fully refunded means the whole grand total came back, or the admin
       said so with `status`; anything less is an order still in flight that
       happens to have had a refund on it. */
    const whole = order.status === "refunded" || order.refundedTotal >= order.grandTotal;
    return {
      kind: whole ? "refunded" : "partly_refunded",
      at: refundedAt(order, events),
      over: whole,
    };
  }

  return { kind: null, at: null, over: false };
}

export interface Outcome {
  /** What happened to the money, if anything did. */
  kind: "cancelled" | "refunded" | "partly_refunded" | null;
  /** When — `null` with a non-null `kind` is real and survivable; see above. */
  at: number | null;
  /**
   * WHETHER THE ORDER IS FINISHED. The question every caller actually asks:
   * which tab it belongs in, whether the track still has a "you are here", and
   * whether the page may make a present-tense promise about a parcel.
   * `kind !== null` is NOT this test — a part refund has a kind and is not
   * over.
   */
  over: boolean;
}

/**
 * The one-line answer, in the shopper's words.
 *
 * NEVER `order.status`. The page used to print the enum — a customer read
 * `partially_refunded` in the header, which is internal vocabulary aimed at a
 * person who did not write the schema. Every string below is what somebody
 * would say out loud about a parcel.
 *
 * MONEY STATES OUTRANK PROGRESS STATES. A refunded order may well also be
 * "delivered", but the refund is the thing the shopper needs to see first, so
 * it is checked first.
 */
export function headlineFor(order: Order, events: OrderEvent[]): string {
  if (cancellation(order, events) !== null) return "Order cancelled";
  if (order.status === "refunded") return "Refunded";
  if (order.status === "partially_refunded") return "Partly refunded";

  const stops = resolveStops(order, events);
  const reached = stops.filter((s) => s.state === "done" || s.state === "current");
  const furthest = reached[reached.length - 1]?.label;

  switch (furthest) {
    case "Placed":
      return "Waiting for payment";
    case "Paid":
      return "Paid — we're getting it ready";
    case "Packed":
      return "Packed and waiting to go out";
    case "Shipped":
      return "On its way to you";
    case "Delivered":
      return "Delivered";
    default:
      return "Order received";
  }
}

/**
 * One word for a list row — the furthest stop the order has actually reached.
 *
 * The orders list printed `order.status` too, so a row read
 * `… · 2 items · partially_refunded`. This is the same vocabulary the detail
 * page uses, cut to fit a row: a list needs the state, not the sentence.
 */
export function shortStatusFor(order: Order, events: OrderEvent[] = []): string {
  if (cancellation(order, events) !== null) return "Cancelled";
  if (order.status === "refunded") return "Refunded";
  if (order.status === "partially_refunded") return "Partly refunded";

  const reached = resolveStops(order, events).filter(
    (s) => s.state === "done" || s.state === "current",
  );
  const furthest = reached[reached.length - 1]?.label ?? "Placed";

  /* ═══ THE LIST HAS NO EVENTS, SO IT READS THE ORDER'S OWN COLUMNS — AND IT
         USED TO THROW TWO OF THEM AWAY ═══
     This was an early return that consulted `order.status` ALONE, which meant a
     row ignored `paidAt` and `fulfilledAt` even though `resolveStops` reads both
     as its own fallbacks and answers correctly from them with no events at all.
     An order still `paid` but already packed listed as "Paid" and opened to
     "Packed and waiting to go out" — a row contradicting the page one click
     below it, from a column the row was already holding. The stops now run
     first, in every case, and `status` is consulted only for what no column
     records.

     ═══ WHICH IS EXACTLY ONE THING: THAT IT HAS LEFT US ═══
     `Shipped` and `Delivered` have no order-level column — `OrderStatus` in the
     admin (`orders/repo/orders.ts`) is `pending | paid | fulfilled | cancelled |
     refunded | partially_refunded`, and `delivered` is a TIMELINE type only. So
     a list row genuinely cannot tell a parcel in transit from one that arrived.

     "Sent", not "Shipped", and that is the whole repair: both words are true of
     a dispatched parcel, but "Shipped" reads as *still on its way*, so a
     delivered order listed as "Shipped" and opened to "Delivered" made the
     shopper arbitrate between two screens. "Sent" stays true after it arrives,
     so the row and the page agree instead of competing. The detail page loads
     the events and is where the finer answer lives. */
  if (events.length === 0 && order.status === "fulfilled") return "Sent";

  return furthest;
}

export function OrderProgress({
  order,
  events,
  refundAmount,
  className,
}: {
  order: Order;
  events: OrderEvent[];
  /** The refunded sum, already formatted by the page that owns the currency.
   *  Without it the track cannot tell a part refund from a whole one. */
  refundAmount?: string;
  className?: string;
}) {
  const outcome = outcomeOf(order, events);
  const cancelledAt = outcome.kind === "cancelled" ? outcome.at : null;
  const refunded = outcome.kind === "cancelled" ? null : outcome.at;
  /* A FULLY REFUNDED ORDER IS SETTLED, NOT IN FLIGHT. Its track was
     byte-identical to a happily-delivered one and still announced "Delivered —
     where your order is now", with the refund demoted to the quietest line on
     the panel. The whole of the money coming back ends the order as surely as a
     cancellation does.
     ═══ BUT A PART REFUND DOES NOT ═══
     This read `isRefunded(order)`, which is true of any refund at all, so an
     order with one line refunded and the rest on a courier's van had no current
     stop. `outcome.over` is the strict test — see `outcomeOf`. The NOTE below
     still states the refund in both cases; only the TRACK's aliveness changed. */
  const settled = outcome.over;
  const stops = resolveStops(order, events, cancelledAt !== null, settled);
  const lastIndex = stops.length - 1;
  /* ═══ THE COLUMN THAT RESERVES THE "NOW" LINE IS THE FURTHEST ONE REACHED,
     WHETHER OR NOT ANYTHING IS STILL MOVING ═══
     Hanging the reserved slot off `state === "current"` reserved nothing at all
     on a cancelled or a refunded order, because neither HAS a current stop —
     both are over, which is the point. Those two states therefore drew a track
     23.75px shorter than every other state and 23.75px shorter than the
     skeleton that stands in for them: the same reflow the reservation exists to
     prevent, in the two states nobody re-measured. The furthest stop reached
     exists in every state, so the slot hangs off that, and `inFlight` alone
     decides whether the word inside it is shown. */
  const markedIndex = stops.reduce(
    (found, stop, i) => (stop.state === "done" || stop.state === "current" ? i : found),
    0,
  );
  /* No "Now" on an order that is not moving — delivered (its last stop is the
     current one), cancelled, or refunded. The slot stays; the word goes. */
  const inFlight = cancelledAt === null && !settled && stops[lastIndex]?.state !== "current";
  const marked = stops[markedIndex];

  /* ═══ THE NOTE UNDER THE TRACK IS RENDERED IN EVERY STATE, AND IT IS NEVER
     BLANK ═══
     It used to appear only on a cancelled or a refunded order, which made the
     panel two different shapes: 183.5px in the six ordinary states and 236.3px
     in those two, against a skeleton that could only stand in for one of them.
     Everything below — the reorder button first — dropped 52.8px at the moment
     the fetch landed. That is more than twice the reflow the reserved "Now"
     line was added to kill, and this file's own skeleton note already says why
     a downward jump is the bad kind: on touch it is a mis-tap, not a shift.

     RESERVING THE ROW EMPTY WOULD HAVE FIXED THE GEOMETRY AND LEFT 53px OF
     BLANK TINT under six orders out of eight — over 40% of the panel, in the
     common case, holding nothing. So the row is reserved AND filled: the last
     thing that actually happened to this order, at full precision. The track's
     own stamps are deliberately short (no year this year, no clock, because a
     51px column cannot hold more), and the exact instant was otherwise only
     reachable by opening the collapsed activity log.

     FOLDING IT INTO THE TRACK'S THIRD LINE INSTEAD — the other obvious route —
     does not survive 320px: a column is 51px wide there and the refunded line
     is "₦26,000 refunded 19 Aug 2026, 1:00 pm". Making it fit means dropping
     the amount or the date, and both are there on purpose.

     The one cost, named so nobody has to rediscover it: on an unpaid order the
     row reads "Placed <stamp>" two lines under a page header that already says
     "Placed <date>". It is the same fact at higher precision, in one state out
     of eight, and it is the price of the panel being one shape. */
  const note =
    cancelledAt !== null
      ? {
          icon: <X aria-hidden="true" className="h-4 w-4 shrink-0" />,
          text: `Cancelled ${formatStamp(cancelledAt)}`,
        }
      : /* ANY refund gets the refund note, whether or not it ended the order —
           the money is a fact the panel must state either way. Only `settled`
           above, which decides whether the parcel is still moving, uses the
           strict test. */
        outcome.kind === "refunded" || outcome.kind === "partly_refunded"
        ? {
            icon: <RotateCcw aria-hidden="true" className="h-4 w-4 shrink-0" />,
            /* THE AMOUNT STAYS IN THE RECEIPT; this says when — and how much
               only when the page told us, because without it the track cannot
               tell a part refund from a whole one.

               ═══ AND THE DATE IS DROPPED RATHER THAN GUESSED ═══
               This branch is chosen by the FACT of the refund, which the order
               carries, not by the date, which only the event log has. When the
               events call failed there is no date, and the line says so by
               ending — "₦26,000 refunded" is true and complete. Falling back to
               a stop's timestamp here would date the refund to when the parcel
               was packed. */
            text: [
              refundAmount ? `${refundAmount} refunded` : "Refunded",
              refunded !== null ? formatStamp(refunded) : null,
            ]
              .filter(Boolean)
              .join(" "),
          }
        : {
            icon: <Check aria-hidden="true" className="h-4 w-4 shrink-0" />,
            /* The furthest stop reached always carries a timestamp — that is
               what made it the furthest one — so this line always has something
               true to say. `placedAt` is the belt-and-braces fallback for the
               impossible case where no stop has a date at all. */
            text: `${marked?.label ?? "Placed"} ${formatStamp(marked?.at ?? order.placedAt)}`,
          };

  return (
    /* `role="group"`, not `<nav>`. The track contains no links, and a screen
       reader user cycling landmarks should not be dropped into a navigation
       region with nothing to navigate. */
    <div role="group" aria-label="Order progress" className={className}>
      <TrackShell>
        {stops.map((stop, i) => (
          <TrackColumn
            key={stop.label}
            /* The standard stepper idiom, so assistive tech announces the
               position rather than relying on the hidden text alone. */
            ariaCurrent={stop.state === "current" ? "step" : undefined}
            marker={
              <>
                {/* Before the marker in the DOM, so the marker paints over it. */}
                {i < lastIndex && (
                  <Connector
                    reached={stops[i + 1]?.state === "done" || stops[i + 1]?.state === "current"}
                  />
                )}
                <Marker state={stop.state} />
              </>
            }
          >
            <span
              className={cn(
                TRACK_LINE.label,
                (stop.state === "done" || stop.state === "current") && "text-foreground",
                stop.state === "current" && "font-semibold",
                stop.state === "upcoming" && "text-foreground/70",
                /* Struck through, because this stop is not merely pending —
                   it is never going to happen. */
                stop.state === "stopped" && "text-foreground/70 line-through",
              )}
            >
              {stop.label}
              <span className="sr-only">{SR_STATE[stop.state]}</span>
            </span>
            {stop.at !== null && (
              <span className={cn(TRACK_LINE.meta, "text-foreground/70")}>
                {formatStamp(stop.at, { short: true })}
              </span>
            )}
            {/* ═══ THE SLOT IS RESERVED EVEN WHEN THE WORD IS NOT SHOWN ═══
                The furthest-reached column is the tallest one, so it sets the
                whole track's height — which meant a delivered order (no "Now")
                drew a track 15px shorter than every other state, and the
                loading skeleton could only match one of them. A pixel floor
                papered over that in one breakpoint band and broke either side
                of it. Holding the line's space instead makes every state the
                same height by construction, at any width and any type size. */}
            {i === markedIndex && (
              <span
                aria-hidden={inFlight ? undefined : "true"}
                className={cn(TRACK_LINE.meta, "font-semibold text-brand", !inFlight && "invisible")}
              >
                Now
              </span>
            )}
          </TrackColumn>
        ))}
      </TrackShell>

      <TrackNote icon={note.icon}>{note.text}</TrackNote>
    </div>
  );
}

/** What each state MEANS, for a screen reader. Exported because the vertical
 *  status history renders the same five stops and must announce them with the
 *  same words — it carried a byte-identical private copy, typed loosely enough
 *  to lose the exhaustiveness check, so rewording one surface would silently
 *  have left the other saying the old thing. */
export const SR_STATE: Record<StopState, string> = {
  done: " — done",
  current: " — where your order is now",
  upcoming: " — not yet",
  stopped: " — did not happen",
};

/* ═══════════════════════════════════════════════════════════════════════════
 * THE TRACK'S SHELL — ONE SET OF BOXES, TWO FILLINGS
 *
 * The live track above and `OrderDetailSkeleton` in `order-detail.tsx` both
 * render THESE components. Neither states a gap, a line height or the marker
 * row's height itself, and that is not tidiness: it is the only thing that has
 * ever kept the two in step.
 *
 * HAND-COPIED, THEY DRIFTED IMMEDIATELY AND INVISIBLY. The skeleton's column
 * used `gap-2` where the live one uses `gap-0.5`, and its bars were 12/10/10px
 * where the live lines are 16/13.75/13.75px line boxes. Those two errors
 * happened to cancel to within a pixel of the right TOTAL, so every height
 * check passed while every line inside sat 2–4px out of place — and correcting
 * either one on its own would have made the settle WORSE, which is exactly the
 * trap a total-height check sets.
 *
 * SO A PLACEHOLDER TAKES ITS HEIGHT FROM THE TYPOGRAPHY IT STANDS IN FOR.
 * `TrackLineSkeleton` is a `Skeleton` carrying `TRACK_LINE.label` (or `.meta`)
 * and a non-breaking space: the line box is the real one by construction, at
 * every breakpoint, for ever. Never an `h-3` bar picked to look about right.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** The five columns. */
export function TrackShell({ children }: { children: React.ReactNode }) {
  return (
    /* ═══ `items-start` IS LOAD-BEARING ═══
       The columns are NOT the same height — only the furthest-reached one
       carries a third line — so any alignment that centres or baselines them
       offsets each marker row by a different amount and breaks the rule running
       through them. `items-center` here measures a 15.75px step, four times the
       one this file was fixed for, and it is one word away. Top-aligned (or
       stretched, which starts them in the same place) is the requirement; the
       exact utility is not. */
    <ol className="flex items-start">{children}</ol>
  );
}

/** One stop: a marker row of a fixed height, then the lines under it. */
export function TrackColumn({
  ariaCurrent,
  marker,
  children,
}: {
  ariaCurrent?: "step";
  /** The marker row's contents — this gap's rule, then the marker itself. */
  marker: React.ReactNode;
  /** The stacked lines underneath, `TRACK_LINE`-typed. */
  children: React.ReactNode;
}) {
  return (
    <li aria-current={ariaCurrent} className="flex min-w-0 flex-1 flex-col items-center gap-2">
      {/* `h-8` WHATEVER SIZE MARKER THIS COLUMN HOLDS. The row reserves the
          tallest marker's height everywhere, so one offset is the centre of
          every marker on the track and the labels underneath all start on the
          same line. Sizing the row to its own marker is what broke both.
          `relative` is the rule's containing block. */}
      <div className="relative flex h-8 w-full items-center justify-center">{marker}</div>
      <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">{children}</div>
    </li>
  );
}

/** The type of the lines under a marker — the stop's name, then its stamps.
 *  The loading state hangs its bars off these same strings. */
export const TRACK_LINE = {
  label: "text-[11px] font-medium leading-tight sm:text-xs",
  meta: "whitespace-nowrap text-[11px] leading-tight",
} as const;

/** A placeholder for one of those lines. It lives HERE, beside the line it
 *  stands in for, and takes its height from that line's own type plus a
 *  non-breaking space — so it cannot be a number that used to match. */
export function TrackLineSkeleton({
  kind,
  width,
}: {
  kind: keyof typeof TRACK_LINE;
  width: string;
}) {
  return <Skeleton className={cn(TRACK_LINE[kind], width)}>{"\u00A0"}</Skeleton>;
}

const TRACK_NOTE =
  "mt-5 flex items-center gap-2 border-t border-foreground/20 pt-3 text-sm text-foreground/70";

/** The line under the track — see `OrderProgress`, it is drawn in every state. */
export function TrackNote({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className={TRACK_NOTE}>
      {icon}
      <span>{children}</span>
    </p>
  );
}

/** Its placeholder. A `<div>` rather than a `<p>`, because a `Skeleton` is a
 *  `<div>` and a block inside a paragraph closes the paragraph — same classes,
 *  same box, valid markup. */
export function TrackNoteSkeleton() {
  return (
    <div className={TRACK_NOTE}>
      <Skeleton className="h-4 w-4 shrink-0" />
      <Skeleton className="w-40">{"\u00A0"}</Skeleton>
    </div>
  );
}

/**
 * The marker.
 *
 * Square, because every other edge in this shop is square — but a hairline
 * rather than the 2px stroke this started with. The track is a supporting
 * diagram; at two pixels it competed with the heading it sits under.
 *
 * ═══ SIZE IS WHAT SEPARATES "HERE" FROM "DONE" ═══
 * Both used to be a filled square holding the same white check, differing only
 * in fill — brand against near-black, 1.28:1 apart and identical in greyscale.
 * The current stop is now visibly BIGGER and carries a ring, which reads at a
 * glance, in greyscale, and on a bad screen. Colour is the last cue added, not
 * the one carrying the meaning.
 *
 * `relative`, because the rule behind it is absolutely positioned and both sit
 * at `z-index: auto`: tree order decides, the marker comes second, and the rule
 * disappears behind an opaque fill instead of striking across it.
 *
 * `outline` rather than `ring` for the ring — see the header. A ring-offset is
 * an opaque box-shadow in the panel's own colour and it ate three pixels of the
 * rule; an outline-offset is transparent and the rule runs through it.
 */
function Marker({ state }: { state: StopState }) {
  const current = state === "current";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex shrink-0 items-center justify-center border transition-colors",
        current ? "h-8 w-8" : "h-6 w-6",
        state === "done" && "border-foreground bg-foreground text-background",
        current &&
          "border-brand bg-brand text-background outline outline-1 outline-brand outline-offset-2",
        /* Dashed and hollow at `muted-foreground`, which measures 5.05:1
           against this panel. `brand-line` is the obvious lighter alternative
           and it is 1.83:1 — under the 3:1 a graphic needs, and this is the
           half of the track that shows what is still to come. */
        state === "upcoming" && "border-dashed border-muted-foreground bg-background",
        state === "stopped" && "border-dashed border-muted-foreground bg-background",
      )}
    >
      {state === "done" && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      {current && <Check className="h-4 w-4" strokeWidth={3} />}
    </span>
  );
}

/**
 * The rule between one stop and the next — one element for the whole gap.
 *
 * CENTRE TO CENTRE, NOT EDGE TO EDGE. `left-1/2 w-full` inside a column that is
 * `flex-1` among equals reaches exactly the next stop's centre, so each end of
 * the rule finishes deep INSIDE an opaque marker rather than butting against
 * one. There is nothing to align at the join and nothing left to leave a seam —
 * not a marker's border, not its outline, not a sub-pixel column width.
 *
 * `top-4` is the middle of the `h-8` row above; the two are a pair. Change one
 * without the other and the line comes off the markers' centres again.
 *
 * `muted-foreground` on the stretch still to come — 5.05:1 against this panel.
 * The lighter `brand-line` measures 1.83:1, under the 3:1 a graphic needs.
 * `foreground` (17.95:1) on the stretch already travelled.
 */
export function TrackRule({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("absolute left-1/2 top-4 h-px w-full", className)} />;
}

/** The live track's rule: dark behind you, muted ahead of you. */
function Connector({ reached }: { reached: boolean }) {
  return <TrackRule className={reached ? "bg-foreground" : "bg-muted-foreground"} />;
}

