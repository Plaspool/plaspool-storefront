import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { OrderProgress, TRACK_LINE, headlineFor, resolveStops, shortStatusFor } from "./order-progress";
import { OrderDetailSkeleton } from "./order-detail";
import type { Order, OrderEvent } from "../data/orders-api";

/**
 * THE TRACK'S GEOMETRY, PINNED AS MARKUP — AND THE LOADING STATE THAT HAS TO
 * MATCH IT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS CAN AND CANNOT PROVE. The defects these tests guard are VISUAL —
 * a connecting rule that stepped 4px as it passed the current stop, and a
 * skeleton whose lines sat 2–8px away from the ones they stood in for — and no
 * assertion in a node process measures pixels. What a test can pin is the
 * CONSTRUCTION, and every way these bugs come back is a change to the markup.
 *
 * ═══ IT ASSERTS PROPERTIES, NOT SPELLINGS ═══
 * An earlier cut of this file pinned the literal utilities — it demanded
 * `top-4` — which got the job exactly backwards: a correct reimplementation
 * (`top-1/2 -translate-y-1/2`, or an SVG rule) FAILED it, while changing the
 * list's one alignment class from `items-start` to `items-center` — a 15.75px
 * step, four times the bug this file exists for — PASSED all sixty-three
 * assertions, because nothing here had ever looked at the list.
 *
 * So the properties, and the reason each one is a property:
 *   · four rules, not eight halves — halves are free to disagree;
 *   · all four rules positioned IDENTICALLY, whatever the spelling — that is
 *     the actual invariant, "they cannot sit at different heights";
 *   · the rules are not flex items — a flex child inherits its row's height;
 *   · the columns are top-aligned, and separately, that the columns really are
 *     unequal — which is WHY the alignment is load-bearing;
 *   · one marker row class for all five columns — no row sized to its marker;
 *   · exactly one marker larger than the rest — the accessibility fix this
 *     file already reversed once, and the tempting wrong way to fix the line;
 *   · no `ring-offset`, which is an opaque band in the panel's own colour;
 *   · one reserved "Now" slot and one note row in EVERY state — the two things
 *     that make the panel one height;
 *   · and the skeleton renders the live track's own boxes, byte for byte.
 *
 * The pixel proof lives on `/dev/orders`: every rule's
 * `getBoundingClientRect().top` inside one track must be a single value, and
 * the panel must measure the same in all eight states, at 320/375/768/1280px.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const DAY = 86_400_000;
const PLACED = 1_763_208_000_000; // 15 Nov 2025, a literal — never `Date.now()`.

function order(over: Partial<Order> = {}): Order {
  return {
    id: "ord_test",
    orderNumber: "2026-000001-F",
    customerId: "cus_test",
    email: "shopper@example.com",
    currency: "NGN",
    subtotal: 2_300_000,
    shippingTotal: 300_000,
    taxTotal: 0,
    grandTotal: 2_600_000,
    refundedTotal: 0,
    status: "paid",
    shippingAddress: {},
    billingAddress: {},
    placedAt: PLACED,
    paidAt: null,
    fulfilledAt: null,
    cancelledAt: null,
    revision: 1,
    ...over,
  };
}

const ev = (type: string, occurredAt: number): OrderEvent => ({
  id: `evt_${type}`,
  type,
  message: "",
  occurredAt,
  actorId: null,
});

/** Every state the track can be in — the same set the `/dev/orders` bench
 *  renders, so a failure here names the case to go and look at. */
const STATES: { name: string; order: Order; events: OrderEvent[] }[] = [
  {
    name: "waiting for payment",
    order: order({ status: "pending" }),
    events: [ev("placed", PLACED)],
  },
  {
    name: "paid",
    order: order({ paidAt: PLACED }),
    events: [ev("placed", PLACED), ev("paid", PLACED)],
  },
  {
    name: "packed",
    order: order({ paidAt: PLACED, fulfilledAt: PLACED + DAY }),
    events: [ev("placed", PLACED), ev("paid", PLACED), ev("fulfillment_created", PLACED + DAY)],
  },
  {
    name: "shipped",
    order: order({ status: "fulfilled", paidAt: PLACED, fulfilledAt: PLACED + DAY }),
    events: [
      ev("placed", PLACED),
      ev("paid", PLACED),
      ev("fulfillment_created", PLACED + DAY),
      ev("shipped", PLACED + 2 * DAY),
    ],
  },
  {
    name: "delivered",
    order: order({ status: "fulfilled", paidAt: PLACED, fulfilledAt: PLACED + DAY }),
    events: [
      ev("placed", PLACED),
      ev("paid", PLACED),
      ev("fulfillment_created", PLACED + DAY),
      ev("shipped", PLACED + 2 * DAY),
      ev("delivered", PLACED + 4 * DAY),
    ],
  },
  {
    name: "cancelled",
    order: order({ status: "cancelled", paidAt: PLACED, cancelledAt: PLACED + DAY }),
    events: [ev("placed", PLACED), ev("paid", PLACED), ev("cancelled", PLACED + DAY)],
  },
  {
    name: "refunded",
    order: order({
      status: "refunded",
      paidAt: PLACED,
      fulfilledAt: PLACED + DAY,
      refundedTotal: 2_600_000,
    }),
    events: [
      ev("placed", PLACED),
      ev("paid", PLACED),
      ev("fulfillment_created", PLACED + DAY),
      ev("shipped", PLACED + DAY),
      ev("refunded", PLACED + 2 * DAY),
    ],
  },
];

const SETTLED = ["delivered", "cancelled", "refunded"];
const NO_CURRENT = ["cancelled", "refunded"];

const render = (s: (typeof STATES)[number]) =>
  renderToStaticMarkup(
    <OrderProgress order={s.order} events={s.events} refundAmount="₦26,000" />,
  );

/**
 * The whole loading page, MINUS ITS BREADCRUMB.
 *
 * The helpers below find the track by being the one `<ol>` of `<li>`s in the
 * markup they are handed, and since the back link became a trail that is no
 * longer true of the page — `Breadcrumb` is a list too, three items long, above
 * the title. Dropping that one element keeps every assertion here about the
 * track, rather than teaching eight helpers to skip a list they have no
 * business knowing about.
 */
const skeleton = () =>
  renderToStaticMarkup(
    <OrderDetailSkeleton orderNumber="2026-000001-F" isGuest={false} />,
  ).replace(/<nav aria-label="Breadcrumb".*?<\/nav>/s, "");

/* ── locating things by POSITION, so the assertions are free to be about
      properties rather than about the class names used to find them ────────── */

/** The one `<ol>`: the five columns' container. */
const listClass = (html: string): string => /<ol\b[^>]*?\sclass="([^"]*)"/.exec(html)?.[1] ?? "";

/** Each `<li>`: one stop's column. */
const columns = (html: string): string[] =>
  [...html.matchAll(/<li\b[^>]*?\sclass="([^"]*)"/g)].map((m) => m[1]);

/** Each column's FIRST child div: the marker row. */
const markerRows = (html: string): string[] =>
  [...html.matchAll(/<li\b[^>]*?\sclass="[^"]*"><div class="([^"]*)"/g)].map((m) => m[1]);

/** The one `<p>` the track renders: the note under it. */
const noteRow = (html: string): string | null => /<p class="([^"]*)"/.exec(html)?.[1] ?? null;

/** Everything with the rule's one structural giveaway — a 1px height. */
const rules = (html: string): string[] =>
  [...html.matchAll(/class="([^"]*)"/g)].map((m) => m[1]).filter((c) => /\bh-px\b/.test(c));

/** The markers: square, bordered, sized. */
const markers = (html: string): string[] =>
  [...html.matchAll(/class="([^"]*)"/g)]
    .map((m) => m[1])
    .filter((c) => /\bshrink-0\b/.test(c) && /\bborder\b/.test(c));

/** Each column's marker, found through its row rather than by its own classes:
 *  the square inside the reserved `h-8` row, after this gap's rule if there is
 *  one. Returns the `h-N w-N` size of each. */
const markerSizes = (html: string): string[] =>
  [
    ...html.matchAll(
      /<div class="[^"]*\bh-8 w-full\b[^"]*">(?:<span[^>]*><\/span>)?<(?:div|span)[^>]*?\sclass="([^"]*)"/g,
    ),
  ]
    .map((m) => /\bh-(\d+) w-\1\b/.exec(m[1])?.[1])
    .filter((n): n is string => n !== undefined);

/** How many typed lines each column carries. `leading-tight` is on both
 *  `TRACK_LINE` variants and on nothing else in either component. */
const linesPerColumn = (html: string): number[] =>
  html
    .split(/<li\b/)
    .slice(1)
    .map((chunk) => (chunk.match(/\bleading-tight\b/g) ?? []).length);

describe("the connecting rule is one element per gap", () => {
  /* ═══ THE HALF-CONNECTOR IS THE BUG ═══
     Each gap used to be drawn twice — the right-hand connector of one stop and
     the left-hand connector of the next — so the two halves were free to sit at
     different heights, which is exactly what they did. Five stops have four
     gaps, and four is the whole count. */
  it.each(STATES)("draws exactly four rules on the $name track", (state) => {
    expect(rules(render(state))).toHaveLength(4);
  });

  it.each(STATES)("positions all four rules identically on the $name track", (state) => {
    /* THE INVARIANT, IN THE ONLY FORM A NODE PROCESS CAN CHECK IT: the four
       rules cannot sit at different heights if they carry the same positioning.
       This says nothing about WHICH offset — `top-4`, `top-1/2 -translate-y-1/2`
       and an inset pair all pass, and all three are correct. */
    const positioning = new Set(
      rules(render(state)).map((c) =>
        c
          .split(/\s+/)
          .filter((u) => !u.startsWith("bg-"))
          .sort()
          .join(" "),
      ),
    );
    expect(positioning.size).toBe(1);
  });

  it.each(STATES)("gives the rule an explicit vertical offset on $name", (state) => {
    /* Explicit, because the alternative is inheriting one from the row — which
       is how a 24px row and a 32px row ended up 4px apart. */
    for (const rule of rules(render(state))) {
      expect(rule).toMatch(/\b-?(top-|bottom-|inset-y-|translate-y-)/);
    }
  });

  it.each(STATES)("keeps the rule out of the flex flow on the $name track", (state) => {
    /* A rule that is a flex child of the marker's row inherits that row's
       height. `flex-1`/`grow` on a rule is the shape of the old bug. */
    for (const rule of rules(render(state))) {
      expect(rule).not.toMatch(/\b(flex-1|flex-auto|grow)\b/);
    }
  });
});

describe("the five columns start together", () => {
  /* ═══ THE ONE-WORD MUTATION ═══
     `items-start` → `items-center` on the list measures a 15.75px step, four
     times the defect this file was written for, and the whole suite used to
     pass it because nothing looked at the list. The property is not the word:
     it is that columns of UNEQUAL height must be aligned to their starts, so
     that every marker row begins at the same y. `items-stretch` satisfies it
     too; centring, end-aligning and baselining do not. */
  it.each(STATES)("top-aligns the columns on the $name track", (state) => {
    const list = listClass(render(state));
    expect(list).toMatch(/\bitems-(start|stretch)\b/);
    expect(list).not.toMatch(/\bitems-(center|end|baseline)\b/);
  });

  it.each(STATES)("and the $name columns really are unequal, which is why", (state) => {
    /* The premise the assertion above rests on, checked rather than assumed:
       exactly one column carries a third line, so the columns cannot be made
       to agree by luck. */
    const lines = linesPerColumn(render(state));
    expect(lines).toHaveLength(5);
    expect(lines.filter((n) => n === 3)).toHaveLength(1);
    expect(Math.min(...lines)).toBeLessThan(3);
  });

  it.each(STATES)("reserves one marker row, one size, in all five $name columns", (state) => {
    /* The step came from rows as tall as their own marker: 24px in four
       columns, 32px in one, so `items-center` inside them put their contents
       4px apart. One class string for all five means one height. */
    const rows = markerRows(render(state));
    expect(rows).toHaveLength(5);
    expect(new Set(rows).size).toBe(1);
  });

  it("reserves the same marker row whichever column is the current one", () => {
    /* Across states the larger marker moves from column 1 to column 5. If the
       row's height still tracked its marker, these would differ. */
    const rows = STATES.flatMap((s) => markerRows(render(s)));
    expect(new Set(rows).size).toBe(1);
  });
});

describe("size, not colour, still separates 'here' from 'done'", () => {
  /* ═══ THE OTHER WAY TO "FIX" THE LINE ═══
     Making every marker the same size makes the step disappear too, and undoes
     the accessibility fix this file already made once: brand-vs-black fills
     measured 1.28:1 apart and vanished in greyscale, so the current stop is
     LARGER instead. A line fix that flattens the sizes fails here. */
  it.each(STATES.filter((s) => !NO_CURRENT.includes(s.name)))(
    "draws exactly one larger marker on the $name track",
    (state) => {
      const drawn = markers(render(state));
      expect(drawn).toHaveLength(5);
      const sized = drawn.map((c) => /\bh-(\d+) w-\1\b/.exec(c)?.[1]).filter(Boolean);
      expect(sized).toHaveLength(5);
      const big = Math.max(...sized.map(Number));
      const small = Math.min(...sized.map(Number));
      expect(big).toBeGreaterThan(small);
      expect(sized.filter((n) => Number(n) === big)).toHaveLength(1);
    },
  );

  it("rings the current marker without painting over the rule", () => {
    /* `ring-offset-<colour>` is a box-shadow filled with the PANEL'S OWN
       COLOUR, painted over whatever is underneath — which is the rule. It ate
       three pixels of line on one side of the marker and a pixel of ring on the
       other. Any ring whose offset is transparent is fine; that one is not. */
    const html = render(STATES[1]);
    expect(html).not.toMatch(/ring-offset/);
    const current = markers(html).find((c) => /\bh-8 w-8\b/.test(c));
    expect(current).toMatch(/\b(outline|ring)\b/);
  });
});

describe("every state is the same height by construction", () => {
  /* The skeleton has to stand in for ALL of these, so no state may draw a
     shorter panel than another. Two things hold that: the reserved "Now" line
     inside the tallest column, and the note row under the track. */
  it.each(STATES)("reserves exactly one 'Now' slot on the $name track", (state) => {
    expect(render(state).match(/>Now</g) ?? []).toHaveLength(1);
  });

  it.each(STATES.filter((s) => !SETTLED.includes(s.name)))(
    "shows the word on the moving $name track",
    (state) => {
      const html = render(state);
      expect(html).toMatch(/text-brand[^"]*">Now</);
      expect(html).not.toMatch(/invisible[^"]*">Now</);
    },
  );

  it.each(STATES.filter((s) => SETTLED.includes(s.name)))(
    "hides the word, and only the word, on the settled $name track",
    (state) => {
      const html = render(state);
      expect(html).toMatch(/invisible[^"]*">Now</);
      expect(html).toMatch(/aria-hidden="true"[^>]*>Now</);
    },
  );

  it.each(STATES)("draws the note row on the $name track, never conditionally", (state) => {
    /* ═══ THE 52.8px REFLOW ═══
       The note used to appear only on a cancelled or a refunded order, so the
       panel was 183.5px in six states and 236.3px in two, against a skeleton
       that could only match one shape. Everything below it — the reorder button
       first — dropped half an inch when the fetch landed. */
    const note = noteRow(render(state));
    expect(note).not.toBeNull();
    expect(render(state).match(/<p class="/g) ?? []).toHaveLength(1);
  });

  it("gives the note row the same box in every state", () => {
    expect(new Set(STATES.map((s) => noteRow(render(s)))).size).toBe(1);
  });

  it("never leaves the reserved note row blank", () => {
    /* Reserving it empty would have fixed the geometry and left 53px of blank
       tint under six orders in eight. Every state says something true in it. */
    for (const state of STATES) {
      const text = /<p class="[^"]*">.*?<\/p>/s.exec(render(state))?.[0] ?? "";
      expect(text.replace(/<[^>]*>/g, "").trim().length).toBeGreaterThan(4);
    }
  });
});

describe("the stepper's semantics survive the layout", () => {
  it.each(STATES.filter((s) => !NO_CURRENT.includes(s.name)))(
    "marks one stop as the current step on the $name track",
    (state) => {
      expect(render(state).match(/aria-current="step"/g) ?? []).toHaveLength(1);
    },
  );

  it.each(STATES.filter((s) => NO_CURRENT.includes(s.name)))(
    "marks no step as current on the settled $name track",
    (state) => {
      /* Nothing is "now" on an order that is over — it is not that the track
         forgot where it got to, it is that it stopped getting anywhere. */
      expect(render(state)).not.toMatch(/aria-current/);
    },
  );

  it.each(STATES)("keeps the group role and a state word per stop on $name", (state) => {
    const html = render(state);
    expect(html).toMatch(/role="group"/);
    expect(html).toMatch(/aria-label="Order progress"/);
    const spoken = html.match(/ — (done|where your order is now|not yet|did not happen)/g) ?? [];
    expect(spoken).toHaveLength(5);
  });

  it("still puts the mark on the furthest stop reached, not the next one owed", () => {
    const stops = resolveStops(STATES[1].order, STATES[1].events);
    expect(stops.map((s) => s.state)).toEqual([
      "done",
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });
});

describe("the loading skeleton renders the track's own boxes", () => {
  /* ═══ WHY THIS BLOCK EXISTS ═══
     Both of the reflows found in this component's second review lived in
     `OrderDetailSkeleton`, and nothing tested it. Hand-copied from the track,
     it used `gap-2` where the track uses `gap-0.5` and 12/10/10px bars where
     the track has 16/13.75/13.75px line boxes — two errors that cancelled to
     within a pixel of the right TOTAL, so every height check passed while every
     line inside was 2–8px out. A total-height assertion would not have caught
     it; these compare the boxes themselves. */
  const live = render(STATES[1]);
  const skel = skeleton();

  it("uses the live track's list, column and marker row, byte for byte", () => {
    expect(listClass(skel)).toBe(listClass(live));
    expect(new Set(columns(skel))).toEqual(new Set(columns(live)));
    expect(new Set(markerRows(skel))).toEqual(new Set(markerRows(live)));
  });

  it("draws five columns, each with its marker row", () => {
    expect(columns(skel)).toHaveLength(5);
    expect(markerRows(skel)).toHaveLength(5);
  });

  it("types its bars with the track's own line classes", () => {
    /* The placeholder's height comes from the line it stands in for, not from
       a number that once matched it. */
    expect(skel).toContain(TRACK_LINE.label);
    expect(skel).toContain(TRACK_LINE.meta);
    expect(live).toContain(TRACK_LINE.label);
    expect(live).toContain(TRACK_LINE.meta);
  });

  it("stands one column three lines tall, exactly like the track", () => {
    const skelLines = linesPerColumn(skel);
    const liveLines = linesPerColumn(live);
    expect(skelLines).toHaveLength(5);
    expect(Math.max(...skelLines)).toBe(Math.max(...liveLines));
    expect(skelLines.filter((n) => n === 3)).toHaveLength(1);
  });

  it("reserves the note row, in the track's own box", () => {
    /* `<div>` rather than `<p>` — a `Skeleton` is a block and a block inside a
       paragraph closes it — but the same classes, so the same height. */
    const box = /<div class="([^"]*)"><div aria-hidden="true" class="[^"]*h-4 w-4/.exec(skel)?.[1];
    expect(box).toBe(noteRow(live));
  });

  it("draws the connecting rule rather than only the markers", () => {
    /* Four gaps, four rules — the one mark that makes the placeholder read as a
       track rather than as five loose squares. */
    expect(rules(skel)).toHaveLength(4);
  });

  it("guesses no marker size", () => {
    /* The live track enlarges whichever marker is the furthest reached. Drawing
       that guess in a fixed column made one marker SHRINK and another GROW on
       resolve — the loudest movement on the panel, twice, in six states out of
       eight. The 32px ROW is still reserved above, so the height is unaffected
       either way. */
    expect(markerSizes(skel)).toHaveLength(5);
    expect(new Set(markerSizes(skel)).size).toBe(1);
    /* And the live track is why the guess was tempting: it has two. */
    expect(new Set(markerSizes(live)).size).toBe(2);
  });
});

/**
 * ═══ THE TWO SURFACES MUST NOT DISAGREE ABOUT ONE ORDER ═══
 *
 * A list row calls `shortStatusFor` with NO events (the list endpoint sends
 * none); the page it opens calls `headlineFor` with them. Both defects below
 * were found by reading one order on both surfaces and getting two answers, and
 * neither was visible from inside either surface alone — which is why they
 * belong here, pinned as a pair, rather than in either file's own tests.
 */
describe("the row and the page it opens", () => {
  /** The row's word must be reachable from the page's sentence, not contradict
   *  it. These are the pairings the bench renders. */
  const AGREES: { name: string; order: Order; events: OrderEvent[]; row: string }[] = [
    {
      name: "packed but not yet dispatched",
      /* ═══ THIS FIXTURE WAS AN ORDER THE ADMIN CANNOT EMIT ═══
         It was `{ paidAt, fulfilledAt: PLACED + DAY }` with `status` left at
         `paid`, described as "the shape a real order has between packing and
         dispatch", and it asserted the row says "Packed". Neither half is true.
         `fulfilled_at` has exactly ONE writer in the admin and that statement
         also sets `status = 'fulfilled'` — the column means EVERY LINE HAS
         SHIPPED. Packing writes no column: `createFulfillment` appends a
         `fulfillment_created` timeline row and leaves `status = 'paid'`,
         `fulfilled_at` NULL. So the fixture below is the real shape, and the
         row's answer is "Paid" — which is COARSER than the page's "Packed and
         waiting to go out", and true of it. The list holds no events and
         genuinely cannot know about a packing record; being less specific is
         not the same as contradicting, and the test that follows pins exactly
         that distinction. */
      order: order({ paidAt: PLACED, fulfilledAt: null }),
      events: [ev("placed", PLACED), ev("paid", PLACED), ev("fulfillment_created", PLACED + DAY)],
      row: "Paid",
    },
    {
      name: "delivered",
      /* No column records delivery, so the row cannot say it. What it says must
         still be TRUE of a delivered parcel — "Shipped" is not, because it reads
         as still-in-transit. */
      order: order({ paidAt: PLACED, fulfilledAt: PLACED + DAY, status: "fulfilled" }),
      events: [
        ev("placed", PLACED),
        ev("paid", PLACED),
        ev("fulfillment_created", PLACED + DAY),
        ev("shipped", PLACED + 2 * DAY),
        ev("delivered", PLACED + 4 * DAY),
      ],
      row: "Sent",
    },
    {
      name: "paid, nothing packed yet",
      order: order({ paidAt: PLACED }),
      events: [ev("placed", PLACED), ev("paid", PLACED)],
      row: "Paid",
    },
    {
      name: "waiting for payment",
      order: order({ status: "pending" }),
      events: [ev("placed", PLACED)],
      row: "Placed",
    },
  ];

  for (const c of AGREES) {
    it(`says "${c.row}" in the row for an order that is ${c.name}`, () => {
      expect(shortStatusFor(c.order)).toBe(c.row);
    });
  }

  it("never names a stop the page has not reached", () => {
    /* ═══ THE PROPERTY, INSTEAD OF A SPELLING ═══
       The row has no events and the page does, so the row is allowed to be
       COARSER — "Paid" under a page saying "Packed and waiting to go out" is
       less information, not a contradiction. What it may never be is AHEAD:
       a row claiming a stage the page has not reached is the list asserting
       something it does not know.
       Asserted over every pairing above rather than against one string, so a
       sixth stop or a reworded row cannot slip past it. */
    for (const c of AGREES) {
      const reached = resolveStops(c.order, c.events)
        .filter((s) => s.state === "done" || s.state === "current")
        .map((s) => s.label);
      /* "Sent" is the row's word for a dispatched parcel — deliberately not a
         stop label, because a list cannot tell shipped from delivered. It is
         satisfied by having reached Shipped. */
      const claimed = shortStatusFor(c.order) === "Sent" ? "Shipped" : shortStatusFor(c.order);
      expect(reached).toContain(claimed);
    }
  });

  it("reads `fulfilledAt` as shipped, not as packed", () => {
    /* The column's meaning, pinned. An order whose `/events` call failed —
       which both order pages degrade to `events: []` BY DESIGN — used to
       headline "Packed and waiting to go out" about a parcel already with the
       courier, because `fulfilledAt` hung off the Packed stop. */
    const shipped = order({ status: "fulfilled", paidAt: PLACED, fulfilledAt: PLACED + DAY });
    expect(headlineFor(shipped, [])).toBe("On its way to you");
    expect(headlineFor(shipped, [])).not.toBe("Packed and waiting to go out");
  });

  it("reaches `Packed` only from a packing record", () => {
    /* And that record is the ONLY thing in the system that means packed. */
    const packed = order({ paidAt: PLACED, fulfilledAt: null });
    const events = [ev("placed", PLACED), ev("paid", PLACED), ev("fulfillment_created", PLACED + DAY)];
    expect(headlineFor(packed, events)).toBe("Packed and waiting to go out");
    expect(headlineFor(packed, [])).toBe("Paid — we're getting it ready");
  });

  it("does not call a delivered parcel one that is still on its way", () => {
    const c = AGREES[1]!;
    expect(headlineFor(c.order, c.events)).toBe("Delivered");
    /* "Shipped" would be the contradiction — the row asserting transit under a
       page that says it arrived. */
    expect(shortStatusFor(c.order)).not.toBe("Shipped");
    expect(shortStatusFor(c.order)).not.toBe("Packed");
  });
});

/**
 * ═══ A REFUNDED ORDER IS OVER, WHETHER OR NOT ITS EVENT LOG ARRIVED ═══
 *
 * `order-detail.tsx` passes `events: []` on ANY events-fetch failure, by design.
 * Closure used to be derived from the refund's DATE, which only the event log
 * carries — so that failure left the panel headlining "Refunded" above a track
 * announcing "Packed — where your order is now", with a live "Now" badge, and no
 * mention of the money. `cancellation()` had a fallback; its twin did not.
 */
describe("a refunded order with no events", () => {
  const refunded = order({
    paidAt: PLACED,
    fulfilledAt: PLACED + DAY,
    status: "refunded",
    refundedTotal: 2_600_000,
  });
  const markup = renderToStaticMarkup(
    <OrderProgress order={refunded} events={[]} refundAmount="₦26,000" />,
  );

  it("marks no stop as where the order is now", () => {
    expect(markup).not.toContain('aria-current="step"');
    expect(markup).not.toContain("where your order is now");
  });

  it("still says the money came back, and does not date it from a parcel stop", () => {
    expect(markup).toContain("₦26,000 refunded");
    /* The packing stamp is the wrong date to hang a refund on, and it is the one
       a naive fallback would have reached for. */
    expect(markup).not.toMatch(/₦26,000 refunded\s*\d/);
  });

  it("reads the same as a refunded order whose events did arrive", () => {
    const withEvents = renderToStaticMarkup(
      <OrderProgress
        order={refunded}
        events={[ev("placed", PLACED), ev("paid", PLACED), ev("refunded", PLACED + 2 * DAY)]}
        refundAmount="₦26,000"
      />,
    );
    /* Same closure either way — the events add the date, not the fact. */
    expect(withEvents).not.toContain('aria-current="step"');
    expect(withEvents).toContain("₦26,000 refunded");
  });
});
