import type { Order, OrderLine } from "../data/orders-api";
import type { LedgerEntry } from "../data/points-api";

/**
 * THE RECEIPT THE SHOPPER JUST AGREED TO PAY, CARRIED ACROSS PAYSTACK.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS AT ALL: `/checkout/complete` IS A LANDING PAGE WITH NO DATA.
 *
 * Paystack sends the customer back with one query parameter, `reference`. That
 * resolves to a `PaymentIntent` carrying `{status, amount, currency}` and
 * nothing else — no lines, no addresses, no breakdown. And the customer view
 * of an order strips `paymentIntentId` AND `checkoutId` before it leaves the
 * API (see the header on `data/orders-api.ts`), so there is no join from the
 * payment back to the order either. Both omissions are deliberate upstream;
 * neither is going to change for this page's convenience.
 *
 * So the confirmation page used to render one sentence, because one sentence
 * was all it could honestly say. This module is the other option: the checkout
 * flow ALREADY HOLDS the frozen totals, the resolved lines and the shipping
 * address at the instant it hands off to Paystack, so it writes them down
 * before it goes, and the return trip reads them back.
 *
 * ═══ THIS IS A DISPLAY COPY. IT IS NOT EVIDENCE OF ANYTHING. ═══
 * Everything here came out of the customer's own browser and could have been
 * edited there. NOTHING may be derived from it that the shopper could profit
 * from getting wrong: no "you paid" claim, no entitlement, no order state. The
 * page shows this beside a status that always comes from the API, and the one
 * number presented as "what you were charged" is `intent.amount`, never
 * `totals.grandTotal` from in here.
 *
 * `sessionStorage`, NOT `localStorage`. A receipt outliving the tab that
 * bought it means the next shopper on a shared machine opens a bookmarked
 * `/checkout/complete` and reads a stranger's address and basket. The tab is
 * the correct lifetime, and the return from Paystack is the same tab.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const KEY = "plaspool.receipt";

/**
 * How far a `placedAt` may sit BEFORE `startedAt` and still be this order.
 *
 * `startedAt` is written by the BROWSER's clock; `placedAt` comes from the
 * SERVER's. On a device running a few minutes fast, a strict comparison never
 * matches and the shopper never sees their order number — a silent failure on
 * the one page where a number is the point.
 *
 * Five minutes is well inside the checkout's own 15-minute reservation window,
 * so this cannot reach back into a previous shopping session, and it is only
 * ever the LAST of three tests — composition and amount must both agree first.
 */
export const SKEW_TOLERANCE_MS = 5 * 60 * 1000;

/** One line of the basket, denormalised to what the receipt draws. Naira, not
 *  minor units — these come from `ResolvedLine`, which is already in whole
 *  naira, and mixing the two scales in one object is how a receipt renders
 *  ₦1,390,000 for a ₦13,900 order. */
export interface ReceiptLine {
  /** The only field that finds a picture — `LineThumb` looks it up in the
   *  catalogue index the route fetches. */
  variantId: string;
  title: string;
  colour: string;
  size: string;
  qty: number;
  /** List price per unit, struck through when a bulk rung applied. */
  unitPrice: number;
  /** What they actually pay per unit. */
  effectiveUnitPrice: number;
  bulkPercentBps: number;
  lineTotal: number;
}

/** The shipping address, flattened from `checkout-api`'s `Address`. Kept as a
 *  copy rather than the live one so a shopper who edits their address later
 *  still sees where THIS order went. */
export interface ReceiptAddress {
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  countryCode: string;
  phone: string | null;
}

/** MINOR UNITS throughout, matching `FrozenTotals` — unlike `ReceiptLine`,
 *  which is naira. The two scales are deliberate and each matches its source;
 *  render these through `majorUnits`. */
export interface ReceiptTotals {
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  adjustmentTotal: number;
  grandTotal: number;
  /** The carrier option's own label, e.g. "Standard delivery". */
  shippingLabel: string | null;
  /** The API's own wording for the tax line ("VAT"). Null when the shop was
   *  not registered at the instant this total was frozen. Never invented
   *  here — see `FrozenTotals["tax"]`. */
  taxLabel: string | null;
  taxRateBps: number | null;
  /** Almost always empty. A points redemption is the one that shows up, and
   *  its `amount` is already negative. */
  adjustments: Array<{ code: string; label: string; amount: number }>;
  /**
   * The add-ons the freeze put on the order — `chosen` by the shopper on the
   * extras step, or `included` by the operator's rules — with what was
   * CHARGED for each (minor units, like the rest of this object; zero for an
   * included-free one). The title is the operator's, verbatim.
   *
   * OPTIONAL, and that needs no `v` bump by this file's own rule: a snapshot
   * written before add-ons existed simply has no rows to draw, which is the
   * truth about that order. Read it `?? []`.
   */
  addOns?: Array<{
    title: string;
    /** `removed` is the shopper's opt-out, and carries a NEGATIVE `amount`.
     *  See `FrozenAddOn.mode`. */
    mode: "chosen" | "included" | "removed";
    amount: number;
    /** Carried so a receipt can print "4 × ₦500 = − ₦2,000". Optional, because
     *  a snapshot written before per-item pricing has neither. */
    unitAmount?: number;
    units?: number;
    basis?: "order" | "item";
  }>;
}

export interface ReceiptSnapshot {
  /** Bumped whenever a field below stops being optional or changes meaning.
   *  A snapshot of any other version is discarded, not migrated — it lives for
   *  one tab, so there is never a population worth migrating. */
  v: 1;
  /** The payment intent this basket was handed off for. Read back only for
   *  the matching intent, so a second attempt in the same tab cannot render
   *  the first attempt's basket. */
  intentId: string;
  /** Browser clock, at the hand-off. See `SKEW_TOLERANCE_MS`. */
  startedAt: number;
  email: string;
  currency: string;
  lines: ReceiptLine[];
  address: ReceiptAddress | null;
  totals: ReceiptTotals;
}

export function encodeSnapshot(snapshot: ReceiptSnapshot): string {
  return JSON.stringify(snapshot);
}

/**
 * Read a snapshot back, for one specific payment intent.
 *
 * ANSWERS `null` FOR EVERY FAILURE and never throws. The caller's fallback is
 * the page this change replaced — honest, and already written — so there is no
 * failure mode here worth a distinct branch, and there is definitely none
 * worth an exception on the page somebody lands on after paying.
 */
export function decodeSnapshot(raw: string | null, intentId: string): ReceiptSnapshot | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const candidate = parsed as Partial<ReceiptSnapshot>;

  if (candidate.v !== 1) return null;
  if (candidate.intentId !== intentId) return null;
  if (typeof candidate.startedAt !== "number") return null;
  if (!Array.isArray(candidate.lines)) return null;
  if (!candidate.totals || typeof candidate.totals !== "object") return null;

  return candidate as ReceiptSnapshot;
}

/** `variantId → total qty`, so composition compares as a set. Two lines of the
 *  same variant are summed rather than counted twice — the cart can hold the
 *  same variant twice where the order merges them, and a receipt that failed
 *  to match on that would cost the shopper their order number. */
function composition(entries: Array<{ variantId: string; qty: number }>): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of entries) {
    map.set(entry.variantId, (map.get(entry.variantId) ?? 0) + entry.qty);
  }
  return map;
}

function sameComposition(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [variantId, qty] of a) {
    if (b.get(variantId) !== qty) return false;
  }
  return true;
}

/**
 * Is this order the one the payment became?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AN INFERENCE, AND IT FAILS CLOSED ON PURPOSE.
 *
 * There is no join from a payment intent to an order (see this file's header),
 * so the page asks the question the only way left: it reads the customer's
 * NEWEST order and tests whether it looks like the basket that was just paid
 * for. Three tests must all pass:
 *
 *   1. COMPOSITION — the same variants in the same quantities. This is the
 *      strong one, and it is clock-independent.
 *   2. AMOUNT — `grandTotal` equals what the provider says was captured. Note
 *      this compares against `paidAmount`, the INTENT's number, not against
 *      the snapshot's own total: the snapshot came out of the browser and is
 *      not evidence, while the intent came from the API.
 *   3. RECENCY — placed no earlier than this checkout began, allowing for
 *      clock skew.
 *
 * The failure that matters is a false POSITIVE: printing a previous order's
 * number under "Payment received" misleads somebody who has no reason to
 * doubt it. A false negative costs a number that the orders list carries
 * anyway, one tap away, and the page already has copy for that case.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function orderMatchesSnapshot(
  order: Order,
  lines: OrderLine[],
  snapshot: ReceiptSnapshot,
  /** `PaymentIntent.amount` — minor units, from the API, not from the browser. */
  paidAmount: number,
): boolean {
  if (order.grandTotal !== paidAmount) return false;
  if (order.placedAt < snapshot.startedAt - SKEW_TOLERANCE_MS) return false;
  return sameComposition(composition(lines), composition(snapshot.lines));
}

/**
 * The points this order earned, or `null` for "not known yet".
 *
 * The newest POSITIVE entry at or after the hand-off. Positive-only because a
 * checkout that redeemed points wrote a negative entry moments earlier in the
 * same ledger, and summing the two reports the net rather than the earn.
 *
 * `null` RATHER THAN `0` when nothing is found: the page renders nothing at
 * all in that case. "You earned 0 points" is a worse sentence than silence,
 * and the ledger legitimately lags the order by a moment.
 */
export function earnedSince(entries: LedgerEntry[], startedAt: number): number | null {
  const floor = startedAt - SKEW_TOLERANCE_MS;
  const earned = entries
    .filter((entry) => entry.delta > 0 && entry.createdAt >= floor)
    .sort((a, b) => b.createdAt - a.createdAt);
  return earned.length ? earned[0].delta : null;
}

/* ═══ THE BROWSER HALF ═══
   Separated from everything above so the logic stays testable under
   `environment: "node"`, which has no `sessionStorage`. Each of these is a
   no-op or a null in any context without storage — Safari's private mode
   throws on access, and a confirmation page must not die for it. */

export function saveReceiptSnapshot(snapshot: ReceiptSnapshot): void {
  try {
    sessionStorage.setItem(KEY, encodeSnapshot(snapshot));
  } catch {
    /* Storage disabled or full. The confirmation page falls back to the copy
       it showed before this existed; losing the receipt is not worth failing
       the click that takes the shopper to Paystack. */
  }
}

export function loadReceiptSnapshot(intentId: string): ReceiptSnapshot | null {
  try {
    return decodeSnapshot(sessionStorage.getItem(KEY), intentId);
  } catch {
    return null;
  }
}

export function clearReceiptSnapshot(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* Nothing to do — see `saveReceiptSnapshot`. */
  }
}
