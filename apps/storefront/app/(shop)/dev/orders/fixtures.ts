import type { Order, OrderEvent, OrderLine, OrderListItem } from "@plaspool/shop";

/**
 * Synthetic orders, for the dev-only `/dev/orders` bench.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS. `GET /orders` is cookie-identified and the commerce API's
 * `APP_ORIGINS` does not include `localhost`, so every credentialed call from a
 * dev browser is CORS-blocked. That leaves the whole of `/account/orders` and
 * `/account/orders/[orderNumber]` unreachable in development — an earlier
 * review of these surfaces had to be done by reading source, which is guessing.
 *
 * THE VARIANT IDS ARE REAL. They are the live catalogue's own
 * (`GET /api/shop/products`), so the picture a line resolves to here is the
 * picture it resolves to in production — the one thing a hand-written fixture
 * must not fake, because resolving them is the feature under test.
 *
 * `MISSING_VARIANT` IS ALSO REAL, IN THE OTHER DIRECTION: an id that is not in
 * the catalogue, which is what a discontinued product looks like to an old
 * order. That case has to be visible on the bench, because it is the case where
 * a picture cannot be sourced and the page must say so by showing nothing
 * rather than by inventing something.
 *
 * EVERY TIMESTAMP IS A LITERAL. No `Date.now()` — the bench must render the
 * same bytes on the server and the client, the same rule the review fixtures
 * carried before them.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* Real, from the live catalogue. */
const BLACK = "var_msrw93s668288c75cbc24106";
const WHITE = "var_msrw9467fb4fc05b867a46b9";
const RED = "var_msrw959n544336048d714e4b";
const ORANGE = "var_msrw95mua7db062f4e28476a";
const YELLOW = "var_msrw95ztc43a2e2f483a4e40";

/** Deliberately absent from the catalogue. */
const MISSING_VARIANT = "var_discontinued_no_longer_sold";

const AUG_17 = 1787011200000; // 17 Aug 2026
const AUG_18 = 1787097600000;
const AUG_19 = 1787184000000;
const AUG_20 = 1787270400000;
const NOV_2025 = 1763208000000; // 15 Nov 2025 — exercises the year suffix

function line(
  n: number,
  variantId: string,
  sku: string,
  title: string,
  colour: string,
  qty: number,
  unitAmount: number,
  fulfilledQty = 0,
): OrderLine {
  return {
    id: `ln_${sku}_${n}`,
    lineNo: n,
    variantId,
    sku,
    title,
    optionValues: { Colour: colour, Weight: "1 kg", Diameter: "1.75 mm" },
    qty,
    unitAmount,
    lineTotal: unitAmount * qty,
    fulfilledQty,
  };
}

function order(over: Partial<Order> & Pick<Order, "orderNumber" | "placedAt">): Order {
  return {
    id: `ord_${over.orderNumber}`,
    customerId: "cus_bench",
    email: "shopper@example.com",
    currency: "NGN",
    subtotal: 2300000,
    shippingTotal: 300000,
    taxTotal: 0,
    grandTotal: 2600000,
    refundedTotal: 0,
    status: "paid",
    shippingAddress: {
      name: "Ada Obi",
      line1: "14 Adeola Odeku Street",
      city: "Victoria Island",
      region: "Lagos",
      country: "NG",
      phone: "+234 801 234 5678",
    },
    billingAddress: {},
    paidAt: null,
    fulfilledAt: null,
    cancelledAt: null,
    revision: 1,
    ...over,
  };
}

function ev(type: string, occurredAt: number, message = ""): OrderEvent {
  return { id: `evt_${type}_${occurredAt}`, type, message, occurredAt, actorId: null };
}

export interface Bench {
  /** The state this case exists to show. */
  label: string;
  /** Why it is on the bench — what breaks if it is not looked at. */
  note: string;
  order: Order;
  lines: OrderLine[];
  events: OrderEvent[];
}

export const BENCH: Bench[] = [
  {
    label: "Waiting for payment",
    note: "One line. No reorder button — the page offers payment help instead.",
    order: order({
      orderNumber: "2026-000001-F",
      placedAt: AUG_20,
      status: "pending",
      subtotal: 2300000,
      grandTotal: 2600000,
    }),
    lines: [line(1, BLACK, "PLA-BLACK-175MM-1KG", "PLA Filament", "Black", 1, 2300000)],
    events: [ev("placed", AUG_20)],
  },
  {
    label: "Paid — one item",
    note: "The state in the shop today. The current stop is the SECOND of five, so the track's line is asymmetric here.",
    order: order({
      orderNumber: "2026-000005-F",
      placedAt: AUG_19,
      paidAt: AUG_19,
      status: "paid",
      subtotal: 2300000,
      grandTotal: 2600000,
    }),
    lines: [line(1, BLACK, "PLA-BLACK-175MM-1KG", "PLA Filament", "Black", 1, 2300000)],
    events: [ev("placed", AUG_19), ev("paid", AUG_19)],
  },
  {
    label: "Packed — two lines",
    note: "Two different colours, so a list card has to show two pictures and a detail page a strip of two. ALSO the packed-but-not-dispatched shape, which is the only state where the row is deliberately COARSER than the page: the list holds no events, so it says \"Paid\" where the page says \"Packed and waiting to go out\".",
    order: order({
      orderNumber: "2026-000006-F",
      placedAt: AUG_18,
      paidAt: AUG_18,
      /* ═══ `fulfilledAt: null`, AND IT WAS `AUG_19` ═══
         With `status` left at `paid` that was an order the admin cannot emit.
         `fulfilled_at` has exactly ONE writer in the admin and that statement
         also sets `status = 'fulfilled'` — the column means every line has
         SHIPPED. Packing writes no column at all: `createFulfillment` appends
         the `fulfillment_created` event below and leaves both alone.
         A bench built on an impossible order teaches the wrong thing to
         everyone who reads it, and this one did: it was the fixture a test
         used to "prove" a list row can say "Packed", which no real order can
         make it say. */
      fulfilledAt: null,
      status: "paid",
      subtotal: 4600000,
      grandTotal: 4900000,
    }),
    lines: [
      line(1, BLACK, "PLA-BLACK-175MM-1KG", "PLA Filament", "Black", 1, 2300000),
      line(2, RED, "PLA-RED-175MM-1KG", "PLA Filament", "Red", 1, 2300000),
    ],
    events: [ev("placed", AUG_18), ev("paid", AUG_18), ev("fulfillment_created", AUG_19)],
  },
  {
    label: "Shipped — five lines",
    note: "The overflow case: more pictures than a row can hold. Also the widest line count for the detail strip.",
    order: order({
      orderNumber: "2026-000007-F",
      placedAt: AUG_17,
      paidAt: AUG_17,
      fulfilledAt: AUG_18,
      status: "fulfilled",
      subtotal: 11500000,
      grandTotal: 11800000,
    }),
    lines: [
      line(1, BLACK, "PLA-BLACK-175MM-1KG", "PLA Filament", "Black", 1, 2300000, 1),
      line(2, WHITE, "PLA-WHITE-175MM-1KG", "PLA Filament", "White", 1, 2300000, 1),
      line(3, RED, "PLA-RED-175MM-1KG", "PLA Filament", "Red", 1, 2300000, 1),
      line(4, ORANGE, "PLA-ORANGE-175MM-1KG", "PLA Filament", "Orange", 1, 2300000, 1),
      line(5, YELLOW, "PLA-YELLOW-175MM-1KG", "PLA Filament", "Yellow", 1, 2300000, 1),
    ],
    events: [
      ev("placed", AUG_17),
      ev("paid", AUG_17),
      ev("fulfillment_created", AUG_18),
      ev("shipped", AUG_19),
    ],
  },
  {
    label: "Delivered — last year",
    note: "Exercises the track's year suffix, and the one state that draws no 'Now'.",
    order: order({
      orderNumber: "2025-000042-F",
      placedAt: NOV_2025,
      paidAt: NOV_2025,
      fulfilledAt: NOV_2025 + 86400000,
      status: "fulfilled",
      subtotal: 4600000,
      grandTotal: 4900000,
    }),
    lines: [line(1, YELLOW, "PLA-YELLOW-175MM-1KG", "PLA Filament", "Yellow", 2, 2300000, 2)],
    events: [
      ev("placed", NOV_2025),
      ev("paid", NOV_2025),
      ev("fulfillment_created", NOV_2025 + 86400000),
      ev("shipped", NOV_2025 + 172800000),
      ev("delivered", NOV_2025 + 345600000),
    ],
  },
  {
    label: "Discontinued product",
    note: "THE HONESTY CASE. This line's variant is not in the catalogue, so no picture and no colour can be sourced for it. Nothing here may invent either.",
    order: order({
      orderNumber: "2025-000009-F",
      placedAt: NOV_2025,
      paidAt: NOV_2025,
      status: "paid",
      subtotal: 1800000,
      grandTotal: 2100000,
    }),
    lines: [
      line(1, MISSING_VARIANT, "PLA-VIOLET-175MM-1KG", "PLA Filament", "Violet", 1, 1800000),
    ],
    events: [ev("placed", NOV_2025), ev("paid", NOV_2025)],
  },
  {
    label: "Cancelled",
    note: "The track keeps its stops and strikes through what will never happen.",
    order: order({
      orderNumber: "2026-000003-F",
      placedAt: AUG_18,
      paidAt: AUG_18,
      cancelledAt: AUG_19,
      status: "cancelled",
      subtotal: 2300000,
      grandTotal: 2600000,
    }),
    lines: [line(1, RED, "PLA-RED-175MM-1KG", "PLA Filament", "Red", 1, 2300000)],
    events: [ev("placed", AUG_18), ev("paid", AUG_18), ev("cancelled", AUG_19)],
  },
  {
    label: "Refunded",
    note: "Settled, not in flight — no 'Now' anywhere on the track.",
    order: order({
      orderNumber: "2026-000004-F",
      placedAt: AUG_17,
      paidAt: AUG_17,
      fulfilledAt: AUG_18,
      status: "refunded",
      refundedTotal: 2600000,
      subtotal: 2300000,
      grandTotal: 2600000,
    }),
    lines: [line(1, ORANGE, "PLA-ORANGE-175MM-1KG", "PLA Filament", "Orange", 1, 2300000, 1)],
    events: [
      ev("placed", AUG_17),
      ev("paid", AUG_17),
      ev("fulfillment_created", AUG_18),
      ev("shipped", AUG_18),
      ev("refunded", AUG_19),
    ],
  },
];

/**
 * Two lines, for the thumbnail bench.
 *
 * TWO, NOT FOUR, BECAUSE THE LINE IS NOT WHAT VARIES. A picture is resolved
 * `variantId` → catalogue, so what changes between resolution cases is the
 * CATALOGUE's answer, not the order line. `inCatalogue` is rendered three times
 * against three different index entries — its own photograph, the product cover
 * standing in, and no photograph at all — which is the clearest way to show
 * that the same purchase can be pictured three ways depending on what has been
 * uploaded, and that only one of them may be named after its colour.
 *
 * `absent` is the fourth case and it is the one the catalogue cannot answer at
 * all.
 */
export const THUMB_LINES = {
  /** A live variant. Today it has no photograph of its own, so it resolves to
   *  the product cover — which is what EVERY line in the shop does right now. */
  inCatalogue: line(1, BLACK, "PLA-BLACK-175MM-1KG", "PLA Filament", "Black", 1, 2300000),
  /** `MISSING_VARIANT`: no picture and no colour can be sourced for it. */
  absent: line(1, MISSING_VARIANT, "PLA-VIOLET-175MM-1KG", "PLA Filament", "Violet", 1, 1800000),
};

/** The same orders as a list, newest first — what `/account/orders` renders. */
export const BENCH_LIST: OrderListItem[] = BENCH.map(({ order: o, lines }) => ({
  order: o,
  lines,
}));
