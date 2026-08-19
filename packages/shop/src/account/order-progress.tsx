import * as React from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { cn } from "@plaspool/ui";

import type { Order, OrderEvent } from "../data/orders-api";

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
 * The secondary text is `foreground/70`, NOT `muted-foreground`. That token
 * clears 4.74:1 against the white page and only 4.30:1 against the
 * `bg-brand-soft/50` panel the track actually renders inside — under AA, on
 * every upcoming label, every timestamp, and the one line that states a refund
 * or a cancellation. Contrast is a property of a pair, and the pair here is the
 * panel, not the page.
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

const STOPS: Stop[] = [
  { label: "Placed", types: ["placed"], fallback: (o) => o.placedAt, preferOrder: true },
  { label: "Paid", types: ["paid", "payment_authorized"], fallback: (o) => o.paidAt },
  { label: "Packed", types: ["fulfillment_created"], fallback: (o) => o.fulfilledAt },
  { label: "Shipped", types: ["shipped"] },
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
          : cancelled
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

/** When a refund was issued, if one was. */
function refundedAt(order: Order, events: OrderEvent[]): number | null {
  if (order.refundedTotal <= 0 && order.status !== "refunded") return null;
  return events.find((e) => e.type === "refunded")?.occurredAt ?? null;
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

  /* ═══ THE LIST HAS NO EVENTS, SO IT READS THE ORDER'S OWN COLUMNS ═══
     `Shipped` and `Delivered` have no order-level fallback — nothing outside the
     event log records them — so walking the stops with an empty event list
     could never get past `Packed`, and a delivered order listed as "Packed" and
     then opened to "Delivered". `status` is the coarser but HONEST answer at
     list resolution: `fulfilled` means it has left, and the detail page (which
     does load the events) is where "Delivered" is knowable. */
  if (events.length === 0) {
    if (order.status === "fulfilled") return "Shipped";
    if (order.status === "paid") return "Paid";
    return "Placed";
  }

  const reached = resolveStops(order, events).filter(
    (s) => s.state === "done" || s.state === "current",
  );
  return reached[reached.length - 1]?.label ?? "Placed";
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
  const cancelledAt = cancellation(order, events);
  const refunded = refundedAt(order, events);
  /* A REFUNDED ORDER IS SETTLED, NOT IN FLIGHT. Its track was byte-identical to
     a happily-delivered one and still announced "Delivered — where your order is
     now", with the refund demoted to the quietest line on the panel. The money
     coming back ends the order as surely as a cancellation does. */
  const settled = refunded !== null;
  const stops = resolveStops(order, events, cancelledAt !== null, settled);
  const lastIndex = stops.length - 1;
  /* No "Now" on a finished order: the last stop being current means it is
     delivered, and "Now" under it would suggest something is still moving. */
  const inFlight = cancelledAt === null && stops[lastIndex]?.state !== "current";

  return (
    /* `role="group"`, not `<nav>`. The track contains no links, and a screen
       reader user cycling landmarks should not be dropped into a navigation
       region with nothing to navigate. */
    <div role="group" aria-label="Order progress" className={className}>
      <ol className="flex items-start">
        {stops.map((stop, i) => (
          <li
            key={stop.label}
            /* The standard stepper idiom, so assistive tech announces the
               position rather than relying on the hidden text alone. */
            aria-current={stop.state === "current" ? "step" : undefined}
            className="flex min-w-0 flex-1 flex-col items-center gap-2"
          >
            <div className="flex w-full items-center">
              <Connector show={i > 0} reached={stop.state === "done" || stop.state === "current"} />
              <Marker state={stop.state} />
              <Connector
                show={i < lastIndex}
                reached={stops[i + 1]?.state === "done" || stops[i + 1]?.state === "current"}
              />
            </div>

            <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
              <span
                className={cn(
                  "font-sans text-[11px] font-medium leading-tight sm:text-xs",
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
                <span className="whitespace-nowrap font-sans text-[11px] leading-tight text-foreground/70">
                  {formatStamp(stop.at, { short: true })}
                </span>
              )}
              {/* ═══ THE SLOT IS RESERVED EVEN WHEN THE WORD IS NOT SHOWN ═══
                  The current column is the tallest one, so it sets the whole
                  track's height — which meant a delivered order (no "Now")
                  drew a track 15px shorter than every other state, and the
                  loading skeleton could only match one of them. A pixel floor
                  papered over that in one breakpoint band and broke either side
                  of it. Holding the line's space instead makes every state the
                  same height by construction, at any width and any type size. */}
              {stop.state === "current" && (
                <span
                  aria-hidden={inFlight ? undefined : "true"}
                  className={cn(
                    "font-sans text-[11px] font-semibold leading-tight text-brand",
                    !inFlight && "invisible",
                  )}
                >
                  Now
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* WHERE IT STOPPED, under the track it stopped on. The panel used to
          replace the whole track with the words "Order cancelled" — which the
          heading above it already said, and which threw away the one piece of
          information a cancelled order still carries: how far it had got. */}
      {cancelledAt !== null && (
        <Note icon={<X aria-hidden="true" className="h-4 w-4 shrink-0" />}>
          Cancelled {formatStamp(cancelledAt)}
        </Note>
      )}

      {/* THE REFUND'S DATE, ON THE TRACK. A refunded order's live question is
          where the MONEY is, not where the parcel is — and the date was
          reachable only by opening the collapsed activity log, which left the
          refunded state drawing a track identical to a plain delivered one. The
          amount stays in the receipt; this says when. */}
      {refunded !== null && cancelledAt === null && (
        <Note icon={<RotateCcw aria-hidden="true" className="h-4 w-4 shrink-0" />}>
          {refundAmount ? `${refundAmount} refunded` : "Refunded"} {formatStamp(refunded)}
        </Note>
      )}
    </div>
  );
}

const SR_STATE: Record<StopState, string> = {
  done: " — done",
  current: " — where your order is now",
  upcoming: " — not yet",
  stopped: " — did not happen",
};

function Note({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="mt-5 flex items-center gap-2 border-t border-foreground/20 pt-3 font-sans text-sm text-foreground/70">
      {icon}
      <span>{children}</span>
    </p>
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
 */
function Marker({ state }: { state: StopState }) {
  const current = state === "current";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center border transition-colors",
        current ? "h-8 w-8" : "h-6 w-6",
        state === "done" && "border-foreground bg-foreground text-background",
        current &&
          "border-brand bg-brand text-background ring-1 ring-brand ring-offset-2 ring-offset-brand-soft/50",
        /* Dashed and hollow at `muted-foreground`: the lighter `brand-line`
           measured ~2:1, and this is the half of the track that shows what is
           still to come. As a graphic it needs 3:1, which this clears. */
        state === "upcoming" && "border-dashed border-muted-foreground bg-background",
        state === "stopped" && "border-dashed border-muted-foreground bg-background",
      )}
    >
      {state === "done" && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      {current && <Check className="h-4 w-4" strokeWidth={3} />}
    </span>
  );
}

function Connector({ show, reached }: { show: boolean; reached: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "h-px min-w-0 flex-1",
        !show && "invisible",
        reached ? "bg-foreground" : "bg-muted-foreground",
      )}
    />
  );
}

/** Epoch ms. `short` drops the year and the clock — under a five-stop track
 *  there is room for a date and not for a sentence. */
function formatStamp(epochMs: number, opts: { short?: boolean } = {}): string {
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return "";
  /* The year is dropped from a short stamp only when it is THIS year. An order
     from last August reading "13 Aug" beside nothing carrying a year is a date
     the shopper has to guess at. */
  const thisYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(
    "en-NG",
    opts.short
      ? /* Two digits, and never wrapped. Under a five-stop track a 320px
           column is ~51px wide; "19 Aug 2025" wrapped to two lines there, which
           made the track ragged AND made it taller than the skeleton that
           reserves its space. "19 Aug 25" fits on one. */
        { day: "numeric", month: "short", ...(thisYear ? {} : { year: "2-digit" }) }
      : { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" },
  );
}
