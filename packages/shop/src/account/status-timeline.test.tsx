import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  MEANING,
  MEANING_MAX_CHARS,
  StatusTimeline,
  StatusTimelineSkeleton,
  fileEventsByStop,
} from "./status-timeline";
import { outcomeOf, resolveStops } from "./order-progress";
import { orderHref, statusHref } from "./order-detail";
import type { Order, OrderEvent } from "../data/orders-api";

/**
 * THE STATUS HISTORY'S TWO INVARIANTS, AND THE ONE URL THAT CARRIES A GUEST.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS CAN AND CANNOT PROVE. The timeline's other half is geometry — a
 * hairline that has to land on every marker's centre, and an animation that has
 * to leave the thing it animated VISIBLE — and no assertion in a node process
 * measures pixels or runs a keyframe. Those are measured on `/dev/account` with
 * `getBoundingClientRect()`, and the numbers are in `GAUNTLET.md`.
 *
 * What a test CAN pin is the two rules that are pure logic and that would fail
 * silently:
 *
 *   1. NOTHING IS EVER DROPPED. `OrderEvent.type` is an open set — the admin
 *      writes types this package has never heard of — so filing events by TYPE
 *      ALONE would swallow them, and filing by TIME alone mis-files the common
 *      case (paying at checkout makes `placedAt === paidAt`, and the tie went
 *      to the wrong stop). The rule is type where a type names a stop, time
 *      everywhere else; the property worth pinning is conservation — every
 *      event in, every event out, in order — plus the tie.
 *   2. THE TIMELINE AND THE TRACK NEVER DISAGREE. Both read `resolveStops` and
 *      `outcomeOf`; a second implementation on either side is how one screen
 *      ends up saying "Shipped" while the screen one click away says "Packed".
 *
 * And the URL: a guest's `?token=` is the only thing that makes their own order
 * readable, so a link from the order to its status history that drops the token
 * is a 404 for the one person who could follow it.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const AUG_1 = 1785542400000;
const DAY = 86_400_000;

function order(over: Partial<Order> = {}): Order {
  return {
    id: "ord_t",
    orderNumber: "2026-000009-F",
    customerId: "cus_t",
    email: "t@example.com",
    currency: "NGN",
    subtotal: 100000,
    shippingTotal: 0,
    taxTotal: 0,
    grandTotal: 100000,
    refundedTotal: 0,
    status: "paid",
    shippingAddress: {},
    billingAddress: {},
    placedAt: AUG_1,
    paidAt: AUG_1 + DAY,
    fulfilledAt: AUG_1 + 2 * DAY,
    cancelledAt: null,
    revision: 1,
    ...over,
  };
}

function ev(type: string, at: number, message = `msg-${type}`): OrderEvent {
  return { id: `evt_${type}_${at}`, type, message, occurredAt: at, actorId: null };
}

describe("filing events under the stage they happened in", () => {
  /** The five stops as the timeline sees them: the event types that satisfy
   *  each, and when it happened. */
  const stops = [
    { types: ["placed"], at: AUG_1 },
    { types: ["paid", "payment_authorized"], at: AUG_1 + DAY },
    { types: ["fulfillment_created"], at: AUG_1 + 2 * DAY },
    { types: ["shipped"], at: null },
    { types: ["delivered"], at: null },
  ];

  it("keeps every event, including types it has never heard of", () => {
    /* THE WHOLE REASON THIS FILES BY TIME. `note_added` and
       `courier_reassigned` are not stops and never will be; filing by type
       would drop both and nobody would notice, because an audit trail's job is
       to be complete and there is nothing to compare it against. */
    const events = [
      ev("placed", AUG_1),
      ev("note_added", AUG_1 + DAY / 2),
      ev("paid", AUG_1 + DAY),
      ev("courier_reassigned", AUG_1 + 3 * DAY),
    ];
    const filed = fileEventsByStop(stops, events);
    expect(filed.flat()).toHaveLength(events.length);
    expect(new Set(filed.flat().map((e) => e.id))).toEqual(new Set(events.map((e) => e.id)));
  });

  it("puts each event under the last stop that had already happened", () => {
    const filed = fileEventsByStop(stops, [
      ev("note_added", AUG_1 + DAY / 2), // after Placed, before Paid
      ev("packed_note", AUG_1 + 2 * DAY + 1), // after Packed
    ]);
    expect(filed[0]!.map((e) => e.type)).toEqual(["note_added"]);
    expect(filed[2]!.map((e) => e.type)).toEqual(["packed_note"]);
  });

  it("reads forwards whichever way the API answered", () => {
    /* The list endpoint answers newest-first. A journey reads oldest-first, and
       sorting here rather than trusting the order means the page is right
       either way — including for a caller that has already reversed it. */
    const a = ev("a", AUG_1 + 1);
    const b = ev("b", AUG_1 + 2);
    const c = ev("c", AUG_1 + 3);
    for (const input of [[a, b, c], [c, b, a], [b, c, a]]) {
      expect(fileEventsByStop(stops, input)[0]!.map((e) => e.type)).toEqual(["a", "b", "c"]);
    }
  });

  it("keeps an event that predates every stop rather than dropping it", () => {
    /* Clock skew between the admin's writer and the order's own columns is not
       hypothetical, and "somewhere slightly wrong" beats "gone" for an audit
       trail. */
    const filed = fileEventsByStop(stops, [ev("early", AUG_1 - DAY)]);
    expect(filed.flat()).toHaveLength(1);
    expect(filed[0]!.map((e) => e.type)).toEqual(["early"]);
  });

  it("survives a timeline with no dated stops at all", () => {
    const undated = stops.map((s) => ({ ...s, at: null }));
    expect(fileEventsByStop(undated, [ev("x", AUG_1)]).flat()).toHaveLength(1);
  });

  it("files a stop's OWN event under that stop, even when two stops share an instant", () => {
    /* ═══ THE COMMON CASE, AND IT WAS WRONG ═══
       Paying at checkout makes `placedAt === paidAt`. Filing purely by "the
       last stop whose timestamp is `<= this event`" resolved that tie in favour
       of the LATER stop, so the `placed` event filed under Paid and Placed
       showed nothing at all. A type that names a stop is unambiguous evidence
       of which stop it belongs to, so it wins over the clock. */
    const tied = [
      { types: ["placed"], at: AUG_1 },
      { types: ["paid", "payment_authorized"], at: AUG_1 },
      { types: ["fulfillment_created"], at: null },
      { types: ["shipped"], at: null },
      { types: ["delivered"], at: null },
    ];
    const filed = fileEventsByStop(tied, [ev("placed", AUG_1), ev("paid", AUG_1)]);
    expect(filed[0]!.map((e) => e.type)).toEqual(["placed"]);
    expect(filed[1]!.map((e) => e.type)).toEqual(["paid"]);
  });

  it("files an alternative type onto the stop that accepts it", () => {
    /* `payment_authorized` satisfies Paid as surely as `paid` does — the stop
       carries a list, not one string. */
    const filed = fileEventsByStop(stops, [ev("payment_authorized", AUG_1 + 5 * DAY)]);
    expect(filed[1]!.map((e) => e.type)).toEqual(["payment_authorized"]);
  });

  it("still files an unrecognised type by time, and never drops it", () => {
    const filed = fileEventsByStop(stops, [ev("courier_reassigned", AUG_1 + 2 * DAY + 1)]);
    expect(filed.flat()).toHaveLength(1);
    expect(filed[2]!.map((e) => e.type)).toEqual(["courier_reassigned"]);
  });
});

describe("the timeline and the track cannot disagree", () => {
  /* Both surfaces call these two functions and neither has its own copy. The
     assertion is that the timeline RENDERS what they answer — if somebody adds
     a local heuristic to either screen, one of these breaks. */
  const cases: { label: string; order: Order; events: OrderEvent[] }[] = [
    { label: "unpaid", order: order({ status: "pending", paidAt: null, fulfilledAt: null }), events: [] },
    { label: "paid", order: order({ fulfilledAt: null }), events: [ev("paid", AUG_1 + DAY)] },
    { label: "delivered", order: order({ status: "fulfilled" }), events: [ev("delivered", AUG_1 + 4 * DAY)] },
    {
      label: "cancelled",
      order: order({ status: "cancelled", cancelledAt: AUG_1 + DAY }),
      events: [ev("cancelled", AUG_1 + DAY)],
    },
    {
      label: "refunded with no events at all",
      order: order({ status: "refunded", refundedTotal: 100000 }),
      events: [],
    },
    {
      /* NOT "over". The admin lets a partially refunded order be packed and
         shipped (`createFulfillment` guards on `status IN
         ('paid','partially_refunded')`), so this one keeps a current stop. */
      label: "partly refunded and still moving",
      order: order({ status: "partially_refunded", refundedTotal: 40000 }),
      events: [],
    },
  ];

  for (const { label, order: o, events } of cases) {
    it(`marks the same stop as \`resolveStops\` on a ${label} order`, () => {
      const html = renderToStaticMarkup(<StatusTimeline order={o} events={events} />);
      const outcome = outcomeOf(o, events);
      /* `outcome.over`, the same argument the component passes. `kind !== null`
         was the old spelling and it is the bug this pair exists to catch: a
         part refund has a kind and is not over. */
      const stops = resolveStops(o, events, outcome.kind === "cancelled", outcome.over);

      /* The stop `resolveStops` calls current is the one and only row marked
         `aria-current="step"`. An order that is OVER has no current stop, and
         the timeline must not invent one. */
      const current = stops.filter((s) => s.state === "current");
      expect((html.match(/aria-current="step"/g) ?? []).length).toBe(current.length);

      /* Every stop is named, in order, whatever state it is in. */
      for (const stop of stops) expect(html).toContain(stop.label);
    });
  }

  it("makes no present-tense promise on an order that stopped", () => {
    /* ═══ THE WORST THING THIS PAGE DID ═══
       `MEANING` is written about a parcel that is still moving. A cancelled or
       refunded order's furthest stop is `done` rather than `current`, so a
       guard of "not upcoming" let it through: the cancelled case read "Payment
       is in. We're picking and packing it." directly under a headline saying
       "Order cancelled", and the refunded one promised a courier forty pixels
       above "₦26,000 refunded". The page contradicting itself inside one panel.
       Asserted as a PROPERTY — no `MEANING` string may appear on a stopped
       order — rather than against the two sentences that happened to show, so
       adding a sixth stop cannot reintroduce it. */
    const live = ["is on its way", "picking and packing", "waiting for the courier"];
    /* A PART REFUND IS NOT IN THIS LIST, and its absence is the point. Only the
       two states that actually END an order are silenced; an order still being
       shipped with some money returned keeps its explanation, because the
       parcel really is still coming. See `outcomeOf`. */
    for (const stopped of [
      order({ status: "cancelled", cancelledAt: AUG_1 + DAY }),
      order({ status: "refunded", refundedTotal: 100000 }),
    ]) {
      const html = renderToStaticMarkup(
        <StatusTimeline order={stopped} events={[ev("paid", AUG_1 + DAY)]} />,
      );
      for (const phrase of live) expect(html).not.toContain(phrase);
      /* Every one of them, not just the two that were caught. */
      expect(html).not.toMatch(/We're picking|on its way to you|waiting for the courier/);
    }
  });

  it("keeps every explanation short enough not to wrap at 320px", () => {
    /* THE CONSTRAINT THAT KEEPS THE ROW ONE HEIGHT. At 320px the explanation's
       column is 244px — about 36 characters of `text-sm` Titillium — and a
       sentence over that wraps, making the marked row 20px taller than the
       placeholder holding its space. Measured: 103.75px against 83.75px.
       Bounded here so lengthening one is a test failure rather than a settle
       nobody re-measures. */
    for (const [stop, sentence] of Object.entries(MEANING)) {
      expect(`${stop}: ${sentence}`.length - stop.length - 2).toBeLessThanOrEqual(
        MEANING_MAX_CHARS,
      );
    }
  });

  it("keeps a part-refunded order moving, and says so without ending it", () => {
    /* ═══ THE ORDER THE LIST WAS HIDING ═══
       `isRefunded` is true of ANY money coming back, and everything downstream
       read that as "over": the order was filed under the tab named for orders
       that stopped, its track marked nothing as current, and the timeline told
       the shopper "The money has gone back to how you paid." when most of it
       had not. */
    const partial = order({
      status: "partially_refunded",
      refundedTotal: 40000,
      grandTotal: 100000,
    });
    const events = [ev("paid", AUG_1 + DAY), ev("shipped", AUG_1 + 3 * DAY)];
    const html = renderToStaticMarkup(
      <StatusTimeline order={partial} events={events} refundAmount="₦400" />,
    );
    /* It is still going: exactly one stop is "you are here". */
    expect((html.match(/aria-current="step"/g) ?? []).length).toBe(1);
    /* The refund is STATED — it is a fact the page must not hide … */
    expect(html).toContain("₦400");
    /* … but never as the end of the order. */
    expect(html).not.toContain("The money has gone back to how you paid");
    expect(html).toContain("still on its way");
    /* And `outcomeOf` agrees, which is what the orders list splits on. */
    expect(outcomeOf(partial, events).over).toBe(false);
    expect(outcomeOf(partial, events).kind).toBe("partly_refunded");
  });

  it("still explains itself on an order that is still moving", () => {
    /* The other half of the guard: suppressing the sentence everywhere would
       have "fixed" the bug by deleting the feature. */
    const html = renderToStaticMarkup(
      <StatusTimeline order={order({ fulfilledAt: null })} events={[ev("paid", AUG_1 + DAY)]} />,
    );
    expect(html).toContain("picking and packing");
  });

  it("ends a stopped order with a terminal row, and a live one without", () => {
    const cancelled = renderToStaticMarkup(
      <StatusTimeline
        order={order({ status: "cancelled", cancelledAt: AUG_1 + DAY })}
        events={[ev("cancelled", AUG_1 + DAY)]}
      />,
    );
    expect(cancelled).toContain("Cancelled");
    expect(cancelled).toContain("Nothing further will be sent");

    const live = renderToStaticMarkup(<StatusTimeline order={order()} events={[]} />);
    expect(live).not.toContain("Nothing further will be sent");
  });

  it("states the refunded amount only when the page supplied one", () => {
    const o = order({ status: "refunded", refundedTotal: 100000 });
    /* WITHOUT the amount the line still has to be true and complete — the FACT
       of the refund is on the order, the amount is the page's to format. */
    expect(renderToStaticMarkup(<StatusTimeline order={o} events={[]} />)).toContain("Refunded");
    expect(
      renderToStaticMarkup(<StatusTimeline order={o} events={[]} refundAmount="₦1,000" />),
    ).toContain("₦1,000 refunded");
  });

  it("says a done stop has no recorded date rather than leaving a silence", () => {
    /* An order that shipped but whose `fulfillment_created` event never reached
       us: "Packed" over nothing reads as a date that failed to load. */
    const html = renderToStaticMarkup(
      <StatusTimeline
        order={order({ fulfilledAt: null })}
        events={[ev("delivered", AUG_1 + 4 * DAY)]}
      />,
    );
    expect(html).toContain("Date not recorded");
  });
});

describe("the motion cannot hide the content", () => {
  /*
   * ═══ THE FAILURE THIS GUARDS IS A BLANK TIMELINE ═══
   * Every animated element starts at `opacity: 0` or `scaleY(0)` and is brought
   * to its resting state by a keyframe. If the animation is dropped — which is
   * exactly what `motion-reduce:animate-none` does for a shopper who asked for
   * less motion — the element must be left in the RESTING state, not the
   * starting one. That property lives in the keyframes (each ends at rest, and
   * all three run `both`), and what a test can pin here is that the opt-out is
   * actually attached to every animated element. An `animate-*` without its
   * `motion-reduce:animate-none` twin is a timeline that stays invisible.
   */
  it("pairs every animation with a reduced-motion opt-out", () => {
    for (const html of [
      renderToStaticMarkup(<StatusTimeline order={order()} events={[ev("paid", AUG_1 + DAY)]} />),
      renderToStaticMarkup(
        <StatusTimeline
          order={order({ status: "cancelled", cancelledAt: AUG_1 + DAY })}
          events={[]}
        />,
      ),
    ]) {
      const animated = html.match(/class="[^"]*\banimate-(rule-draw|stop-in|row-in)\b[^"]*"/g) ?? [];
      expect(animated.length).toBeGreaterThan(0);
      for (const cls of animated) expect(cls).toContain("motion-reduce:animate-none");
    }
  });

  it("draws no rule below the last row", () => {
    /* A rule whose length is the row's height is correct by construction — but
       only while the last row has none, because there is no next marker for it
       to reach. */
    const html = renderToStaticMarkup(<StatusTimeline order={order()} events={[]} />);
    const rows = html.split("<li").length - 1;
    const rules = (html.match(/animate-rule-draw/g) ?? []).length;
    expect(rules).toBe(rows - 1);
  });
});

describe("the wait is the same shape as the timeline", () => {
  it("draws five rows at the same row rhythm", () => {
    const skeleton = renderToStaticMarkup(<StatusTimelineSkeleton />);
    const live = renderToStaticMarkup(<StatusTimeline order={order()} events={[]} />);
    expect(skeleton.split("<li").length).toBe(live.split("<li").length);
    /* The marker column and its `h-8` row are what hold every marker's centre
       on one line; the placeholder has to use the same two or the rule the
       shopper's eye follows moves when the data lands. */
    for (const markup of [skeleton, live]) {
      expect(markup).toContain("w-8 shrink-0 justify-center self-stretch");
      expect(markup).toContain("h-8");
    }
  });

  it("is invisible to assistive technology", () => {
    expect(renderToStaticMarkup(<StatusTimelineSkeleton />)).toContain('aria-hidden="true"');
  });
});

describe("a guest's token survives every hop", () => {
  /*
   * A guest reaches their order through a signed `?token=`, and it is the only
   * thing that makes the order theirs. Every lookup failure on that route is
   * deliberately the same 404, so a dropped token is indistinguishable from a
   * deleted order — to the shopper AND to whoever is debugging it.
   */
  it("carries the token onto the status history and back", () => {
    expect(statusHref("2026-1", "tok+en/1")).toBe(
      "/account/orders/2026-1/status?token=tok%2Ben%2F1",
    );
    expect(orderHref("2026-1", "tok+en/1")).toBe("/account/orders/2026-1?token=tok%2Ben%2F1");
  });

  it("omits the parameter entirely for a signed-in customer", () => {
    expect(statusHref("2026-1")).toBe("/account/orders/2026-1/status");
    expect(statusHref("2026-1", null)).toBe("/account/orders/2026-1/status");
    /* An empty token is not a token. `?token=` would be sent to the API as a
       credential and answered with the same 404 as a wrong one. */
    expect(statusHref("2026-1", "")).toBe("/account/orders/2026-1/status");
  });

  it("escapes an order number that needs it", () => {
    expect(statusHref("a/b")).toBe("/account/orders/a%2Fb/status");
  });
});
