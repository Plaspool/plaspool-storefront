import { describe, expect, it } from "vitest";

import {
  SKEW_TOLERANCE_MS,
  decodeSnapshot,
  earnedSince,
  encodeSnapshot,
  orderMatchesSnapshot,
} from "./receipt-snapshot";
import type { ReceiptSnapshot } from "./receipt-snapshot";
import type { Order, OrderLine } from "../data/orders-api";
import type { LedgerEntry } from "../data/points-api";

/**
 * THE RECEIPT SNAPSHOT, AND THE TWO PREDICATES THAT READ IT BACK.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS ACTUALLY DANGEROUS HERE IS SHOWING SOMEBODY THE WRONG ORDER NUMBER.
 *
 * `/checkout/complete` cannot ask "which order did this payment become?" — the
 * customer view of an order strips `paymentIntentId` and `checkoutId` on
 * purpose, so there is no join. `orderMatchesSnapshot` infers the answer
 * instead, and an inference that fires too eagerly prints a PREVIOUS order's
 * number under the words "Payment received" — which is worse than printing no
 * number at all, because the shopper has no reason to doubt it.
 *
 * So every test below that asserts `false` is the load-bearing half. The
 * predicate is deliberately built to fail closed: when it cannot tell, the
 * page says "it will appear in your orders shortly" and nobody is misled.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Plain functions rather than the page, because the page is a client component
 * and this suite is `environment: "node"` — the same reason `basket-spent.ts`
 * is a module of its own.
 */

const SNAPSHOT: ReceiptSnapshot = {
  v: 1,
  intentId: "pi_abc123",
  startedAt: 1_700_000_000_000,
  email: "buyer@example.com",
  currency: "NGN",
  lines: [
    {
      variantId: "var_black_1kg",
      title: "PLA Filament",
      colour: "Black",
      size: "1kg",
      qty: 2,
      unitPrice: 4500,
      effectiveUnitPrice: 4000,
      bulkPercentBps: 1000,
      lineTotal: 8000,
    },
    {
      variantId: "var_white_1kg",
      title: "PLA Filament",
      colour: "White",
      size: "1kg",
      qty: 1,
      unitPrice: 4500,
      effectiveUnitPrice: 4000,
      bulkPercentBps: 1000,
      lineTotal: 4000,
    },
  ],
  address: {
    name: "A Buyer",
    line1: "12 Example Road",
    line2: null,
    city: "Lagos",
    region: "Lagos",
    postalCode: null,
    countryCode: "NG",
    phone: "+2348000000000",
  },
  totals: {
    subtotal: 1_200_000,
    shippingTotal: 150_000,
    taxTotal: 90_000,
    adjustmentTotal: -50_000,
    grandTotal: 1_390_000,
    shippingLabel: "Standard delivery",
    taxLabel: "VAT",
    taxRateBps: 750,
    adjustments: [{ code: "points", label: "Spool Points", amount: -50_000 }],
  },
};

function orderWith(over: Partial<Order> = {}): Order {
  return {
    id: "ord_1",
    orderNumber: "103",
    customerId: "cus_1",
    email: "buyer@example.com",
    currency: "NGN",
    subtotal: 1_200_000,
    shippingTotal: 150_000,
    taxTotal: 90_000,
    grandTotal: 1_390_000,
    refundedTotal: 0,
    status: "paid",
    shippingAddress: {},
    billingAddress: {},
    placedAt: SNAPSHOT.startedAt + 20_000,
    paidAt: SNAPSHOT.startedAt + 20_000,
    fulfilledAt: null,
    cancelledAt: null,
    revision: 1,
    ...over,
  };
}

function linesWith(over: Array<Partial<OrderLine>> = []): OrderLine[] {
  const base: OrderLine[] = [
    {
      id: "ol_1",
      lineNo: 1,
      variantId: "var_black_1kg",
      sku: "PLA-BLK-1K",
      title: "PLA Filament",
      optionValues: {},
      qty: 2,
      unitAmount: 400_000,
      lineTotal: 800_000,
      fulfilledQty: 0,
    },
    {
      id: "ol_2",
      lineNo: 2,
      variantId: "var_white_1kg",
      sku: "PLA-WHT-1K",
      title: "PLA Filament",
      optionValues: {},
      qty: 1,
      unitAmount: 400_000,
      lineTotal: 400_000,
      fulfilledQty: 0,
    },
  ];
  return base.map((line, i) => ({ ...line, ...(over[i] ?? {}) }));
}

describe("encodeSnapshot / decodeSnapshot", () => {
  it("round-trips a snapshot for the intent it was written against", () => {
    const decoded = decodeSnapshot(encodeSnapshot(SNAPSHOT), "pi_abc123");
    expect(decoded).toEqual(SNAPSHOT);
  });

  it("refuses a snapshot written for a DIFFERENT payment attempt", () => {
    /* The one that actually bites: a shopper who abandons a payment, comes
       back, builds a new cart and pays again in the same tab has TWO attempts
       behind one `sessionStorage` key. Reading the stale one would print the
       abandoned cart's items beside the new payment's total. */
    expect(decodeSnapshot(encodeSnapshot(SNAPSHOT), "pi_somethingelse")).toBeNull();
  });

  it("answers null when nothing was ever stored", () => {
    expect(decodeSnapshot(null, "pi_abc123")).toBeNull();
  });

  it("answers null for malformed JSON rather than throwing", () => {
    /* Storage is shared with extensions and with older builds of this app. A
       parse error here must degrade the page to its no-snapshot fallback, not
       take the whole confirmation down at the moment somebody has just paid. */
    expect(decodeSnapshot("{not json", "pi_abc123")).toBeNull();
  });

  it("answers null for a snapshot from a future schema version", () => {
    const raw = JSON.stringify({ ...SNAPSHOT, v: 2 });
    expect(decodeSnapshot(raw, "pi_abc123")).toBeNull();
  });

  it("answers null when the stored value is JSON but not a snapshot", () => {
    expect(decodeSnapshot(JSON.stringify({ hello: "world" }), "pi_abc123")).toBeNull();
    expect(decodeSnapshot(JSON.stringify([1, 2, 3]), "pi_abc123")).toBeNull();
    expect(decodeSnapshot(JSON.stringify(null), "pi_abc123")).toBeNull();
  });

  it("answers null when lines are missing, so the receipt never renders half a basket", () => {
    const raw = JSON.stringify({ ...SNAPSHOT, lines: undefined });
    expect(decodeSnapshot(raw, "pi_abc123")).toBeNull();
  });
});

describe("orderMatchesSnapshot", () => {
  const paid = SNAPSHOT.totals.grandTotal;

  it("matches the order this payment became", () => {
    expect(orderMatchesSnapshot(orderWith(), linesWith(), SNAPSHOT, paid)).toBe(true);
  });

  it("matches regardless of the order the API returns the lines in", () => {
    /* Composition is a SET comparison. Nothing promises `lineNo` ordering
       survives the round trip, and a false negative here costs the shopper
       their order number for no reason. */
    expect(
      orderMatchesSnapshot(orderWith(), [...linesWith()].reverse(), SNAPSHOT, paid),
    ).toBe(true);
  });

  it("rejects an order whose total is not the amount that was actually paid", () => {
    expect(
      orderMatchesSnapshot(orderWith({ grandTotal: 1_000_000 }), linesWith(), SNAPSHOT, paid),
    ).toBe(false);
  });

  it("rejects an order containing a variant this checkout never had", () => {
    const lines = linesWith([{}, { variantId: "var_something_else" }]);
    expect(orderMatchesSnapshot(orderWith(), lines, SNAPSHOT, paid)).toBe(false);
  });

  it("rejects an order whose quantities differ from this checkout's", () => {
    const lines = linesWith([{ qty: 5 }]);
    expect(orderMatchesSnapshot(orderWith(), lines, SNAPSHOT, paid)).toBe(false);
  });

  it("rejects an order with FEWER lines than this checkout, even when the total agrees", () => {
    /* A subset that happens to total the same amount is the pathological case
       the composition check exists for. */
    expect(
      orderMatchesSnapshot(orderWith(), [linesWith()[0]], SNAPSHOT, paid),
    ).toBe(false);
  });

  it("rejects an order placed before this checkout even began", () => {
    /* The whole reason `startedAt` is in the snapshot: a repeat customer's
       PREVIOUS identical order is the thing most likely to satisfy every other
       test here, and it is exactly the wrong number to print. */
    const stale = orderWith({ placedAt: SNAPSHOT.startedAt - SKEW_TOLERANCE_MS - 1 });
    expect(orderMatchesSnapshot(stale, linesWith(), SNAPSHOT, paid)).toBe(false);
  });

  it("tolerates a client clock that runs ahead of the server's", () => {
    /* `startedAt` is the BROWSER's clock and `placedAt` is the SERVER's. A
       device a few minutes fast would otherwise never match its own order and
       the shopper would never see a number. The tolerance is bounded well
       inside the 15-minute reservation window, so it cannot reach back to a
       previous shopping session. */
    const skewed = orderWith({ placedAt: SNAPSHOT.startedAt - 60_000 });
    expect(orderMatchesSnapshot(skewed, linesWith(), SNAPSHOT, paid)).toBe(true);
  });
});

describe("earnedSince", () => {
  function entry(over: Partial<LedgerEntry> = {}): LedgerEntry {
    return {
      id: "le_1",
      kind: "earn",
      delta: 139,
      balanceAfter: 439,
      reason: "Order 103",
      createdAt: SNAPSHOT.startedAt + 30_000,
      ...over,
    };
  }

  it("reads the points this order earned", () => {
    expect(earnedSince([entry()], SNAPSHOT.startedAt)).toBe(139);
  });

  it("ignores the SPEND entry this same checkout wrote", () => {
    /* A checkout that redeems points writes a negative entry at almost the
       same instant as the earn. Summing the ledger would net them off and
       under-report what the order actually earned. */
    const spend = entry({ id: "le_0", delta: -500, createdAt: SNAPSHOT.startedAt + 5_000 });
    expect(earnedSince([entry(), spend], SNAPSHOT.startedAt)).toBe(139);
  });

  it("ignores entries from before this checkout started", () => {
    const old = entry({ id: "le_old", delta: 999, createdAt: SNAPSHOT.startedAt - 86_400_000 });
    expect(earnedSince([old], SNAPSHOT.startedAt)).toBeNull();
  });

  it("answers null on an empty ledger rather than zero", () => {
    /* Null is "we do not know yet" and renders nothing. Zero would render
       "you earned 0 points", which is a worse thing to say than nothing. */
    expect(earnedSince([], SNAPSHOT.startedAt)).toBeNull();
  });

  it("tolerates the same clock skew the order match does", () => {
    const skewed = entry({ createdAt: SNAPSHOT.startedAt - 60_000 });
    expect(earnedSince([skewed], SNAPSHOT.startedAt)).toBe(139);
  });
});

/**
 * The add-on rows, which are optional on the snapshot for the same reason
 * they are optional on the frozen totals: a receipt written before add-ons
 * existed has none, and that is the truth about that order rather than a
 * version to migrate away from.
 */
describe("a snapshot's add-ons", () => {
  it("reads back a snapshot written before add-ons existed, at the same version", () => {
    const decoded = decodeSnapshot(encodeSnapshot(SNAPSHOT), SNAPSHOT.intentId);
    expect(decoded).not.toBeNull();
    expect(decoded?.totals.addOns).toBeUndefined();
  });

  it("carries the rows across the hand-off unchanged", () => {
    const withAddOns: ReceiptSnapshot = {
      ...SNAPSHOT,
      totals: {
        ...SNAPSHOT.totals,
        addOns: [
          { title: "Velvet pouch", mode: "chosen", amount: 150_000 },
          { title: "Padded packing", mode: "included", amount: 0 },
        ],
      },
    };
    const decoded = decodeSnapshot(encodeSnapshot(withAddOns), SNAPSHOT.intentId);
    expect(decoded?.totals.addOns).toEqual(withAddOns.totals.addOns);
  });
});
