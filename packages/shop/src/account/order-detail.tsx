"use client";

import * as React from "react";
import { Link } from "../components/link";
import { useParams, useSearchParams } from "next/navigation";
import { ChevronRight, LifeBuoy, PackageX, RotateCcw } from "lucide-react";
import { Button, Skeleton, SkeletonRegion, TextSkeleton, cn } from "@plaspool/ui";

import { Breadcrumb } from "../components/breadcrumb";
import type { BreadcrumbItem } from "../components/breadcrumb";
import { EmptyState } from "../components/empty-state";
import { LineThumb, LineThumbSkeleton } from "../components/line-thumb";
import {
  OrderProgress,
  TrackColumn,
  TrackLineSkeleton,
  TrackNoteSkeleton,
  TrackRule,
  TrackShell,
  headlineFor,
} from "./order-progress";
/* ONE DEFINITION OF "HOW MANY ITEMS AN ORDER IS", not a second copy of it.
   This page had the `reduce` inline and the list had its own; the list's is
   exported and carries the note about the bug that came from having two, so
   this reads that one rather than adding a third. Its own header says the
   moment a THIRD surface needs it is the moment to lift it into
   `orders-api.ts` — that moment is not this change. */
import { itemCount } from "./orders-list";
import { useCart } from "../cart/cart-context";
import { getOrder, getOrderEvents } from "../data/orders-api";
import type { Order, OrderEvent, OrderLine } from "../data/orders-api";
import type { LineImageIndex } from "../data/catalog";
import { majorUnits } from "../data/cart-api";
import { formatNaira } from "../data/money";
import { formatStamp } from "./stamp";
import { AccountShell } from "./account-shell";

/**
 * `/account/orders/[orderNumber]` — one order.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WORKS FOR BOTH A SIGNED-IN CUSTOMER AND A GUEST WITH `?token=…`. The token
 * is read straight from the URL and passed through to both `getOrder` and
 * `getOrderEvents` unchanged — this page never tries to tell which case it
 * is in, because the API answers the same either way when authorization
 * succeeds. The one place it matters is the TRAIL above the title: a guest has
 * no orders list, so they are not offered a crumb pointing at one. See
 * `orderTrail`.
 *
 * EVERY LOOKUP FAILURE — absent order, someone else's order, a wrong or
 * expired token — is the SAME 404, and this page renders exactly one honest
 * "couldn't find that order" for all of them. Do not add copy here that
 * tries to guess which case happened; the API collapsed them on purpose.
 *
 * MONEY IS A PLAIN NUMBER IN MINOR UNITS ON AN ORDER, not `ApiMoney` — one
 * `order.currency` covers every amount on it. `naira()` below wraps each
 * field through `majorUnits({amount, currency})` so the /100 stays in the
 * one place that owns it, rather than being hand-rolled here.
 *
 * ═══ THE SHAPE OF THIS PAGE, AND WHY IT CHANGED ═══
 * It used to be four identically-weighted slabs — items, totals, address,
 * timeline — stacked in one column, so nothing was primary and the eye had no
 * entry point. See `design/order-detail-research.md`. The order now is the
 * order of the jobs that bring somebody here:
 *
 *   1. WHERE IS IT — a progress track that shows the stops still to come, not
 *      just the ones that have passed. First thing under the title.
 *   2. I WANT THAT AGAIN — reordering is this shop's stated value ("a reorder
 *      in March matches the batch you printed in January"), so it is an action
 *      on the page rather than a hunt back through the catalogue.
 *   3. DID I ORDER THE RIGHT THING — items, with their options and unit price.
 *   4. WHAT DID I PAY — the receipt, secondary and beside the address.
 *   5. WHO DO I TALK TO — a permanent, quiet support line at the bottom.
 *
 * The full event log survives as a `<details>`: an audit trail somebody
 * occasionally wants, never the thing they came for.
 *
 * ═══ THE PICTURES SIT BETWEEN 1 AND 2, AND THEY TRIED TO LEAD THE PAGE FIRST ═══
 * A band of thumbnails ran above the title for one round. Two measurements
 * killed it and both are recorded on `OrderContents`: the 80px it cost pushed
 * the status headline behind the shop's own cookie dialog on a 375×667 and a
 * 360×640 first landing — the exact visit a `?token=` guest from an emailed
 * link is, by construction — and the pictures themselves were five copies of
 * one photograph, because every variant in this catalogue resolves to the same
 * product cover.
 *
 * So the pictures answer "what is in it" in the first slot UNDER the track, one
 * square per picture the shop can actually source, with the order's contents in
 * words beside them. "1. WHERE IS IT" keeps the top of the page, which is what
 * this list has said all along.
 *
 * ═══ `lineImages` COMES FROM THE ROUTE, AND NOTHING ELSE DOES ═══
 * A line carries no image field, so a picture is resolved `variantId` →
 * catalogue. The catalogue is public and the same for every visitor, so the
 * route reads it on the server once and hands it down; the order itself is
 * still fetched here, over the caller's cookie or their `?token=`, because it
 * is theirs. That split is the whole reason this prop exists rather than a
 * fetch inside the component.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function OrderDetailPage({ lineImages }: { lineImages: LineImageIndex }) {
  const params = useParams<{ orderNumber: string }>();
  const searchParams = useSearchParams();
  const orderNumber = decodeURIComponent(params.orderNumber);
  const token = searchParams.get("token");

  const [state, setState] = React.useState<
    | { kind: "loading" }
    | { kind: "not_found" }
    | { kind: "error" }
    | { kind: "ready"; order: Order; lines: OrderLine[]; events: OrderEvent[] }
  >({ kind: "loading" });
  /* Bumped by the "Try again" button. The effect below re-runs on a change,
     which is the state->effect direction the lint rule wants — the "loading"
     state itself is set from the click handler, never synchronously inside
     the effect body. */
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([getOrder(orderNumber, token), getOrderEvents(orderNumber, token)]).then(
      ([orderResult, eventsResult]) => {
        if (cancelled) return;
        if (!orderResult.ok) {
          setState(orderResult.reason === "not_found" ? { kind: "not_found" } : { kind: "error" });
          return;
        }
        setState({
          kind: "ready",
          order: orderResult.order,
          lines: orderResult.lines,
          /* The timeline is secondary to the order itself — a failed
             `/events` call still shows the order with an empty timeline
             rather than blocking the whole page on it. The progress track
             falls back to the order's own `placedAt`/`paidAt`/`fulfilledAt`
             in that case, so it still draws. */
          events: eventsResult.ok ? eventsResult.events : [],
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [orderNumber, token, attempt]);

  const retry = React.useCallback(() => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  if (state.kind === "loading")
    return <OrderDetailSkeleton orderNumber={orderNumber} isGuest={token !== null} />;

  if (state.kind === "not_found") {
    return (
      <Shell>
        {/* ═══ THE WAY BACK SURVIVES THE FAILURE ═══
            Both dead ends used to render the empty state and nothing else, so a
            signed-in customer who mistyped an order number was offered "Go to
            the store" and never their own orders list — the one page that would
            have shown them the number they meant. The trail is answerable from
            the URL alone, which is the argument `OrderDetailSkeleton` already
            makes for drawing it before the order arrives; it should not then
            vanish because the order never did. */}
        <OrderTrail orderNumber={orderNumber} isGuest={token !== null} />
        <EmptyState
          icon={<PackageX aria-hidden="true" />}
          title="Couldn't find that order"
          body="We can't find that order. Double-check the link, or sign in to see your orders."
          action={
            <Button asChild>
              <Link href="/store">Go to the store</Link>
            </Button>
          }
        />
      </Shell>
    );
  }

  if (state.kind === "error") {
    return (
      <Shell>
        {/* Same reasoning as `not_found` above. */}
        <OrderTrail orderNumber={orderNumber} isGuest={token !== null} />
        <EmptyState
          icon={<PackageX aria-hidden="true" />}
          title="Couldn't load that order"
          body="Something went wrong reaching your order — refresh to try again."
          action={
            <Button type="button" onClick={retry}>
              Try again
            </Button>
          }
        />
      </Shell>
    );
  }

  return <OrderDetail {...state} isGuest={token !== null} token={token} lineImages={lineImages} />;
}

/** Exported so a fixture can render every state of this page without a live
 *  order behind it — the states that matter (waiting for payment, in transit,
 *  cancelled, refunded) are otherwise unreachable in a dev environment. */
export function OrderDetail({
  order,
  lines,
  events,
  isGuest,
  token = null,
  lineImages,
}: {
  order: Order;
  lines: OrderLine[];
  events: OrderEvent[];
  isGuest: boolean;
  /**
   * The guest's signed link, when this visitor arrived on one.
   *
   * SEPARATE FROM `isGuest` RATHER THAN DERIVED FROM IT, because they answer
   * different questions: `isGuest` decides whether the trail offers "Your
   * orders" — a page a guest has no session for — while this is the credential
   * that makes a link to a SUB-PAGE of this order resolve at all. A guest
   * carrying no token here is a caller that built the props by hand (the bench,
   * a test); the status link is suppressed in that case rather than pointing at
   * a URL that would 404 for the only person who could follow it.
   */
  token?: string | null;
  /**
   * `variantId` → the picture that line may honestly show, from one cached
   * catalogue read the route already made.
   *
   * THE CONTRACT, NOT A DESCRIPTION OF THIS PAGE: draw an entry with
   * `LineThumb`, and with nothing else. A variant absent from this index — or
   * present carrying neither a photograph nor a colour — has no appearance that
   * can be sourced, and `LineThumb` owns what that renders as, so no strip can
   * quietly substitute a spool in a colour taken from the line's own text.
   */
  lineImages: LineImageIndex;
}) {
  const naira = (minorUnits: number) =>
    formatNaira(majorUnits({ amount: minorUnits, currency: order.currency }));
  const address = readAddress(order.shippingAddress);
  const headline = headlineFor(order, events);
  const cancelled = order.cancelledAt !== null || order.status === "cancelled";
  const paid = order.paidAt !== null;
  const units = itemCount(lines);
  /* A delivered order's rows must not say "Shipped" while the track above them
     says "Delivered" — the row is the same parcel. */
  const delivered = events.some((e) => e.type === "delivered");

  return (
    <Shell>
      <OrderTrail orderNumber={order.orderNumber} isGuest={isGuest} />

      <header className="mt-4 flex flex-col gap-1">
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Order {order.orderNumber}
        </h1>
        <p className="font-sans text-sm text-muted-foreground">
          Placed {formatStamp(order.placedAt, { dateOnly: true })}
        </p>
      </header>

      {/* ═══ 1. WHERE IS IT ═══
          Primary by TYPE AND SPACE rather than by weight. This page was four
          2px-stroked slabs with an offset shadow on this one; the neobrutalist
          treatment belongs on the things a shopper clicks — the product CTAs,
          the blog cards — and turned a page somebody reads into a stack of
          boxes shouting equally. A tinted field and the largest type on the
          page is enough to say "start here". */}
      <section
        aria-labelledby="order-status-heading"
        /* NO PIXEL FLOOR HERE. An earlier cut pinned this to `min-h-[173px]`
           so the skeleton could match it; that number was only true between
           375px and 639px, and above the `sm:` padding step it pulled the
           primary button 11px UP on resolve. The track now reserves its own
           "Now" line in every state (see `order-progress.tsx`), so the panel is
           one height by construction and the skeleton matches it at any width.
           A cancelled or refunded order still exceeds it by its one extra note
           line — reserving for that too would put ~30px of empty tint under
           every ordinary order, and that settle moves content DOWN, away from
           the reader rather than out from under them. */
        className="mt-6 bg-brand-soft/50 px-4 py-5 sm:px-6 sm:py-6"
      >
        <h2
          id="order-status-heading"
          className="font-sans text-lg font-semibold tracking-tight text-foreground sm:text-xl"
        >
          {headline}
        </h2>
        <OrderProgress
          order={order}
          events={events}
          refundAmount={order.refundedTotal > 0 ? naira(order.refundedTotal) : undefined}
          className="mt-5"
        />

        {/* ═══ THE WAY INTO THE JOURNEY, WHERE SOMEBODY IS ALREADY LOOKING ═══
            This replaces the `<details>` "Full activity" log that used to sit
            at the very bottom of the page. The log itself was right to exist
            and wrong to live down there: a shopper whose parcel is late reads
            the track, wants the next level of detail, and was offered it eight
            sections further on behind a disclosure triangle. The detail now has
            a page of its own and the way to it is attached to the thing that
            raises the question.
            A LINK, NOT A BUTTON, AND NOT A LOUD ONE. It goes to a page; the
            page's own primary action is elsewhere. It is `text-sm` and
            underlined on hover so it reads as continuation rather than as a
            second call to action competing with "Order it again" 100px below.
            NO `events.length` GATE. The stops fall back to the order's own
            `placedAt`/`paidAt`/`fulfilledAt`, so the journey draws even when
            the event log is empty or its call failed — gating this on events
            would hide the page in exactly the state a shopper most wants it. */}
        {(!isGuest || token) && (
          <Link
            href={statusHref(order.orderNumber, token)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-sm font-sans text-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            See every step
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        )}
      </section>

      {/* ═══ WHAT IS IN IT ═══
          Not a numbered job, and deliberately between two that are: it is the
          answer a shopper checks BEFORE deciding to reorder, and it cannot go
          above the track without putting "where is it" behind the cookie
          dialog on a phone. Every decision in it, and both measurements, are on
          `OrderContents`. */}
      <OrderContents lines={lines} lineImages={lineImages} className="mt-6" />

      {/* ═══ 2. I WANT THAT AGAIN ═══
          NOT ON AN ORDER THAT HAS NOT BEEN PAID FOR. The page offered its one
          full-width primary button — "Order it again" — as the only control on
          a "Waiting for payment" order, so the loudest thing on screen invited
          a shopper to put a SECOND copy of an unpaid order into their basket.
          What is still to come there is payment, not another purchase. The
          order carries no payment intent or checkout URL, so the page cannot
          offer to take the money; it says who it is waiting on instead, in the
          receipt, and leaves support as the way forward. */}
      {paid || cancelled ? (
        <ReorderAction lines={lines} className="mt-4" />
      ) : (
        /* AN UNPAID ORDER GETS AN ACTION, NOT AN EMPTY SLOT. Suppressing the
           reorder button here was right — inviting a second copy of an order
           that has not been paid for is the wrong verb — but leaving the slot
           empty pulled the receipt 84px up the page on resolve, in the one
           state where the shopper is most anxious and the number they came for
           is "Total due". The order carries no payment intent or checkout URL,
           so the shop cannot take the money from this page; the honest primary
           action is the one it CAN offer. */
        <PaymentHelpAction className="mt-4" />
      )}

      {/* ═══ 3. DID I ORDER THE RIGHT THING ═══ */}
      <section aria-labelledby="order-items-heading" className="mt-8">
        <h2
          id="order-items-heading"
          className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {/* UNITS, like the cart badge and like the reorder message — the
              heading counted LINES, so a two-line order of three spools read
              "2 items" with "3 items added to your cart" printed under it. */}
          {units === 1 ? "1 item" : `${units} items`}
        </h2>
        <ul className="mt-2 divide-y divide-brand-line border-y border-brand-line">
          {lines.map((line) => (
            <li key={line.id} className="flex items-start justify-between gap-4 py-3">
              {/* THE PICTURE AND THE WORDS ARE ONE THING, so they share a gap
                  of their own; `gap-4` stays between that pair and the money,
                  which is what the row already read as. */}
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {/* DECORATIVE, AND FOR `cart-drawer.tsx`'s REASON RATHER THAN
                    THE LIST'S. The title, the colour, the size and the quantity
                    are printed inches to the right of it — naming the picture
                    too is a second reading of the same row. (The list's own
                    reason, that a whole row is one link whose name would swell,
                    does not apply: nothing here is a link.)

                    A LINE THE CATALOGUE CANNOT DESCRIBE STILL GETS ITS BOX.
                    `LineThumb` draws the dashed "no picture" square for it, so
                    the column stays a column and the row still says, without a
                    word, that we have no photograph of this one. */}
                <LineThumb line={line} images={lineImages} size={ROW_THUMB_PX} />
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm font-medium text-foreground">{line.title}</p>
                  <p className="mt-0.5 font-sans text-xs text-muted-foreground">
                    {[...Object.values(line.optionValues ?? {}), `${line.qty} ×`]
                      .filter(Boolean)
                      .join(" · ")}{" "}
                    {naira(line.unitAmount)}
                  </p>
                  <LineFulfilment line={line} delivered={delivered} />
                </div>
              </div>
              <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                {naira(line.lineTotal)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ═══ 4. WHAT DID I PAY, AND WHERE IS IT GOING ═══
          Side by side from `sm`, because they are two short blocks and stacking
          them was half the length of the old page. */}
      <div className="mt-8 grid gap-8 sm:grid-cols-2 sm:gap-6">
        <section aria-labelledby="order-totals-heading">
          <h2
            id="order-totals-heading"
            className="border-b border-brand-line pb-2 font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Payment
          </h2>
          <dl className="mt-3">
            <TotalRow label="Subtotal" value={naira(order.subtotal)} />
            <TotalRow label="Delivery" value={naira(order.shippingTotal)} />
            {order.taxTotal > 0 && <TotalRow label="Tax" value={naira(order.taxTotal)} />}
            {/* ═══ THE BOLDEST NUMBER ON THE PAGE HAS TO BE TRUE ═══
                This row said "Total" in every state, so a cancelled order that
                was never charged printed a bold ₦72,500 directly under a track
                reading "Paid — did not happen", and an unpaid order printed the
                same figure under a heading asserting payment. `paidAt` is on the
                order already; the label follows it. */}
            <div className="mt-1 flex items-center justify-between border-t border-brand-line pt-2">
              <dt
                className={cn(
                  "font-sans font-semibold text-foreground",
                  order.refundedTotal > 0 ? "text-sm" : "text-base",
                )}
              >
                {/* THREE STATES, NOT TWO. `paid ? … : "Total due"` printed a
                    live balance owed on a CANCELLED order — a debt that does
                    not and will never exist — in the boldest type on the page,
                    directly under a track reading "Paid — did not happen". A
                    cancelled order's total is a historical figure, not a bill. */}
                {cancelled ? "Order total" : paid ? "Total paid" : "Total due"}
              </dt>
              <dd
                className={cn(
                  "font-mono font-bold tabular-nums text-foreground",
                  order.refundedTotal > 0 ? "text-sm" : "text-base",
                )}
              >
                {naira(order.grandTotal)}
              </dd>
            </div>
            {!paid && (
              <p className="mt-2 font-sans text-sm text-muted-foreground">
                {cancelled
                  ? "You weren't charged for this order."
                  : "We haven't received payment for this order, and nothing has been charged. If that looks wrong, get in touch below."}
              </p>
            )}
            {/* ═══ THE REFUND GOES AFTER THE TOTAL, AND CARRIES A NET ═══
                It sat above it first, which put "Refunded −₦23,000" over an
                unchanged "Total ₦72,500" and left the shopper to work out for
                themselves which number they were actually out. A refund is not a
                line item in the order; it is something that happened to the
                order afterwards, so it is stated after the total is closed and
                the arithmetic is finished for them. */}
            {order.refundedTotal > 0 && (
              <div className="mt-3 border-t border-brand-line pt-2">
                <TotalRow
                  label="Refunded"
                  value={`− ${naira(order.refundedTotal)}`}
                />
                {/* THE BOLDEST FIGURE IS THE ONE THAT IS STILL TRUE. On a
                    fully refunded order "Total paid" is history and the net is
                    what the shopper is actually out, so the emphasis moves. */}
                <div className="flex items-center justify-between py-1">
                  <dt className="font-sans text-base font-semibold text-foreground">
                    Net after refund
                  </dt>
                  <dd className="font-mono text-base font-bold tabular-nums text-foreground">
                    {naira(Math.max(0, order.grandTotal - order.refundedTotal))}
                  </dd>
                </div>
              </div>
            )}
          </dl>
        </section>

        {address && (
          <section aria-labelledby="order-address-heading">
            <h2
              id="order-address-heading"
              className="border-b border-brand-line pb-2 font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Delivery address
            </h2>
            <address className="mt-3 flex flex-col font-sans text-sm not-italic text-muted-foreground">
              {[address.name, address.line1, address.line2, address.city, address.region]
                .filter(Boolean)
                .map((part) => (
                  <span key={part}>{part}</span>
                ))}
            </address>
          </section>
        )}
      </div>

      {/* ═══ THE FOLDED-AWAY EVENT LOG USED TO BE HERE, AND IT IS GONE ═══
          It was a `<details>` holding every event with its date — the same rows
          the status history now files under the stage they happened in, one
          click from the track that raises the question. Keeping both would put
          the same log on two screens a click apart, which is how two surfaces
          start disagreeing: one gets a fix, the other does not. The page keeps
          the ANSWER (the track) and hands off the RECORD.
          Nothing else moved. This sat between the address block and the support
          line, and both keep the margins they had — `<details>` carried its own
          `mt-8` and `SupportLine` carries its own spacing, so removing it
          closes the gap it occupied rather than leaving one behind. */}

      {/* ═══ 5. WHO DO I TALK TO ═══
          Quiet, permanent, and last. A shopper who needs it is looking for it;
          a shopper who does not should not have it competing with the track. */}
      <SupportLine orderNumber={order.orderNumber} />
    </Shell>
  );
}

/**
 * "Order it again".
 *
 * WHAT IT PROMISES IS WHAT IT DOES: the lines go into the basket and the drawer
 * opens, so the shopper sees the result rather than being told about it. It
 * does NOT check out — a one-click repurchase of a physical order with no
 * confirmation is a mis-tap that costs somebody money.
 *
 * A LINE THE SHOP NO LONGER SELLS IS REPORTED, not silently dropped. `addVariants`
 * counts what it skipped, and a basket quietly one item shorter than the order
 * it was built from is exactly the "silently edits itself" failure the cart is
 * written to avoid everywhere else.
 */
function ReorderAction({ lines, className }: { lines: OrderLine[]; className?: string }) {
  const cart = useCart();
  const [result, setResult] = React.useState<{
    added: number;
    failed: number;
    skippedVariantIds: string[];
  } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const reorder = React.useCallback(async () => {
    setBusy(true);
    setResult(null);
    try {
      setResult(
        await cart.addVariants(lines.map((l) => ({ variantId: l.variantId, qty: l.qty }))),
      );
    } finally {
      setBusy(false);
    }
  }, [cart, lines]);

  /* NAMED, not counted. The shopper cannot diff a basket against an order by
     eye, and "1 item was left out" of a five-line order is a puzzle rather than
     an answer. */
  const skippedTitles = React.useMemo(() => {
    const ids = new Set(result?.skippedVariantIds ?? []);
    const names = lines
      .filter((l) => ids.has(l.variantId))
      .map((l) => [l.title, ...Object.values(l.optionValues ?? {})].filter(Boolean).join(" · "));
    return [...new Set(names)];
  }, [result, lines]);

  /* ═══ THE NET FIRST, ALWAYS ═══
     "so they were left out" is only meaningful beside something that went IN.
     When every line is skipped it described a remainder of a basket that never
     changed — and in the same grey a full success uses. What happened to the
     cart leads; the reason follows. */
  const nothingAdded = result !== null && result.added === 0;

  const message = React.useMemo(() => {
    if (!result) return "";
    const parts: string[] = [];
    if (result.added > 0) {
      parts.push(`${result.added === 1 ? "1 item" : `${result.added} items`} added to your cart.`);
    } else {
      parts.push("Nothing was added to your cart.");
    }
    if (result.failed > 0) {
      parts.push(
        result.added > 0
          ? "The rest couldn't be added — check your connection and try again."
          : "We couldn't reach your cart — try again.",
      );
    }
    if (skippedTitles.length > 0) {
      parts.push(
        `We no longer sell ${skippedTitles.join(", ")}, so ${skippedTitles.length === 1 ? "it is" : "they are"} not available to reorder.`,
      );
    }
    return parts.join(" ");
  }, [result, skippedTitles]);

  if (lines.length === 0) return null;

  return (
    <section aria-labelledby="order-reorder-heading" className={className}>
      <h2 id="order-reorder-heading" className="sr-only">
        Order these items again
      </h2>
      <Button
        type="button"
        onClick={reorder}
        disabled={busy || !cart.hydrated}
        className="w-full gap-2 sm:w-auto"
      >
        <RotateCcw aria-hidden="true" className="h-4 w-4" />
        {busy ? "Adding to cart…" : "Order it again"}
      </Button>
      {/* MOUNTED ALWAYS, AND ITS HEIGHT RESERVED. A `role="status"` inserted
          into the DOM together with its text is announced unreliably by NVDA,
          JAWS and VoiceOver — the region has to exist before the message does.
          `min-h` keeps the message from shoving the receipt 28px down the page
          at the exact moment the shopper starts reading it. */}
      <p
        role="status"
        className={cn(
          "mt-2 min-h-[2.5rem] font-sans text-sm",
          /* Anything that put nothing in the basket reads as a problem, not as
             a quieter shade of success.

             `text-destructive-strong`, NOT `text-destructive`. The base token
             is tuned as a
             BUTTON FILL — white on it clears 17:1 — but as text on the page it
             measures 3.76:1, under AA. This page darkened its greys for exactly
             that reason; the one string that reports a failure must not then be
             the least legible thing on it. */
          nothingAdded ? "text-destructive-strong" : "text-muted-foreground",
        )}
      >
        {message}
      </p>
    </section>
  );
}

/**
 * What an unpaid order offers instead of a reorder.
 *
 * Same slot, same height, so the skeleton above it reserves one shape rather
 * than two — and the shopper gets somewhere to go rather than a gap.
 */
function PaymentHelpAction({ className }: { className?: string }) {
  return (
    <section aria-labelledby="order-payment-heading" className={className}>
      <h2 id="order-payment-heading" className="sr-only">
        Payment for this order
      </h2>
      <Button asChild variant="outline" className="w-full gap-2 sm:w-auto">
        <Link href="/contact">
          <LifeBuoy aria-hidden="true" className="h-4 w-4" />
          Ask about this payment
        </Link>
      </Button>
      <p className="mt-2 min-h-[2.5rem] font-sans text-sm text-muted-foreground">
        We haven&apos;t received payment for this order yet.
      </p>
    </section>
  );
}

/** Per-line fulfilment, as a state rather than a sentence — it sits under an
 *  item, where a full clause would compete with the item's own name. */
function LineFulfilment({ line, delivered }: { line: OrderLine; delivered: boolean }) {
  if (line.qty <= 0) return null;
  if (line.fulfilledQty >= line.qty) {
    return (
      <p className="mt-1 font-sans text-xs font-medium text-foreground">
        {delivered ? "Delivered" : "Shipped"}
      </p>
    );
  }
  if (line.fulfilledQty > 0) {
    return (
      <p className="mt-1 font-sans text-xs font-medium text-foreground">
        {line.fulfilledQty} of {line.qty} shipped
      </p>
    );
  }
  return null;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE TRAIL, AND THE ONE CRUMB A GUEST MUST NOT BE OFFERED.
 *
 * This was a lone `←` and "All orders" — a back BUTTON, which says where you
 * would go and not where you are. The shop already answers both at once on
 * `/store/[category]` and `/store/products/[slug]`, with the same component and
 * the same three-crumb shape, so the order page now reads the way the rest of
 * the shop does: `Home › Your orders › Order 2026-000007-F`.
 *
 * ═══ A GUEST'S TRAIL IS SHORTER, AND THAT IS THE WHOLE POINT ═══
 * Half the visitors here arrived from an emailed link carrying `?token=…` and
 * have no account at all. `/account/orders` would bounce them to sign-in, so
 * for them there is nothing between the site root and this order, and the trail
 * says exactly that: `Home › Order 2026-000007-F`. A trail whose middle crumb
 * is a dead end is worse than no trail — it spends the shopper's one click on a
 * sign-in wall while their parcel is the thing they were looking at.
 *
 * `Home › Store › Order …` WAS THE OTHER CANDIDATE FOR A GUEST, and it is what
 * the old link did (it read "Back to the store"). Rejected: an order is not
 * under `/store`, and the two crumbs before it would then be a path this page
 * has never been at. The shop's nav sits above every one of these pages with
 * "Store" in it, so the store is still one click away — it just is not claimed
 * to be this page's parent. What a guest loses is a shopping invitation; what
 * they gain is a trail that is true, and the page keeps "Order it again"
 * anyway.
 *
 * THE LAST CRUMB CARRIES THE ORDER NUMBER, SO IT IS THE ONE THAT TRUNCATES —
 * `Breadcrumb` gives `min-w-0 truncate` to the current page and
 * `whitespace-nowrap` to its ancestors, which at 320px ellipsises
 * "Order 2026-000007-F" rather than pushing the page sideways. Verified at
 * 320px on `/dev/orders`.
 *
 * SPLIT OUT AS A PURE FUNCTION because "which crumb does a guest get" is a
 * branch with a real consequence and no pixels in it — `order-detail.test.tsx`
 * pins it, which a screenshot could never do.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function orderTrail({
  orderNumber,
  isGuest,
  token,
  sub,
}: {
  orderNumber: string;
  isGuest: boolean;
  /** A guest's signed link. Only needed when `sub` makes the order crumb a
   *  LINK — without it that link 404s for the guest who followed it, because
   *  the order is only theirs while they carry the token. */
  token?: string | null;
  /** A page BELOW the order — the status history. Naming one turns the order
   *  crumb into a link and appends this as the unlinked current page. */
  sub?: string;
}): BreadcrumbItem[] {
  return [
    { label: "Home", href: "/" },
    /* NAMED FOR THE PAGE IT OPENS — `/account/orders` puts "Your orders" in its
       own `<h1>`, and a crumb that renames its destination is a small lie the
       shopper only finds out about after clicking. */
    ...(isGuest ? [] : [{ label: "Your orders", href: "/account/orders" }]),
    /* No `href` when this IS the page: `Breadcrumb` marks the last crumb
       `aria-current="page"` and leaves it unlinked. */
    { label: `Order ${orderNumber}`, ...(sub ? { href: orderHref(orderNumber, token) } : {}) },
    ...(sub ? [{ label: sub }] : []),
  ];
}

/** The order's own URL, carrying a guest's token when there is one. The single
 *  place that spells this path, so a link back from a sub-page cannot drop the
 *  one query param that makes it reachable. */
export function orderHref(orderNumber: string, token?: string | null): string {
  return withToken(`/account/orders/${encodeURIComponent(orderNumber)}`, token);
}

/** The status history's URL. Same rule as `orderHref`: the guest's token has to
 *  survive the hop or the page it lands on cannot look the order up. */
export function statusHref(orderNumber: string, token?: string | null): string {
  return withToken(`/account/orders/${encodeURIComponent(orderNumber)}/status`, token);
}

function withToken(path: string, token?: string | null): string {
  return token ? `${path}?token=${encodeURIComponent(token)}` : path;
}

/** Rendered by the resolved page AND by the skeleton, from the same call: the
 *  order number is in the URL and `?token=` says which trail it is, so both are
 *  answerable before the order arrives — and the two cannot disagree about the
 *  height of the thing above the title. */
function OrderTrail({ orderNumber, isGuest }: { orderNumber: string; isGuest: boolean }) {
  return <Breadcrumb trail={orderTrail({ orderNumber, isGuest })} />;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS IN IT — ONE SQUARE PER PICTURE THE SHOP CAN ACTUALLY SOURCE, AND THE
 * ORDER'S CONTENTS IN WORDS BESIDE THEM.
 *
 * ═══ THE FIRST CUT WAS FIVE COPIES OF ONE PHOTOGRAPH, AND SILENT ═══
 * It drew one square per LINE, in a band above the title, `aria-hidden`.
 * Against this catalogue that is not a picture of the order. `lineImagesFrom`
 * resolves `src = the variant's own photograph ?? the product's cover`, and
 * every one of the seven live variants carries `imageUrl: null` — so every line
 * in this shop resolves to the SAME cover, with `ofThisColour: false`, which is
 * the catalogue saying in a field that this photograph is not of this variant.
 * `lineImageAlt` honours that and refuses to name the colour. The band showed
 * it once per line anyway, with no text beside it, so a five-colour order
 * rendered as five identical unlabelled squares — and every order in the shop
 * rendered the same band, differing only in how many squares were in it.
 *
 * `api.ts` had already written the argument against this, one seam upstream and
 * about the colour picker: the cover is right for an order line because "an
 * order line is not choosing anything", and wrong for a rail "where seven
 * identical covers destroy the control". A rail of five HERE had less to
 * disambiguate it than the picker does — no swatch, no colour name, no adjacent
 * text of any kind — so that sentence condemns this harder, not less. And being
 * `aria-hidden` in one piece meant nothing downstream could correct it.
 *
 * ═══ SO THE SQUARES COLLAPSE ONTO THE PICTURES, AND THE WORDS CARRY THE ORDER ═══
 * `orderPictureGroups` keys a line by WHAT IT RESOLVED TO — the photograph's
 * URL, or the drawn spool's hex and weight, or "nothing can be sourced" — and
 * draws one square per distinct answer. Today that is one square for every
 * order in the shop, which is the honest number: there is one photograph. The
 * day a per-colour shot is uploaded the same code draws two, and nothing here
 * changes.
 *
 * WHAT COLLAPSING COST IS NOT LOST, IT MOVED. The words beside the squares
 * state the whole order — every product in it, every colour in it, and how many
 * items it is, in `itemCount`'s units, the same function and the same noun the
 * list heading below prints. So the squares cannot imply an order smaller than
 * it is, which is the property `orders-list.tsx` refused to collapse without —
 * and could not have had: its rail is inside a link, where a sentence would
 * land in the link's own accessible name.
 *
 * A LINE THE CATALOGUE CANNOT DESCRIBE IS ITS OWN GROUP. `LineThumb` draws the
 * dashed "no picture" square for it, and the words beside it still name its
 * colour, because that comes from the ORDER and not from the catalogue. Nothing
 * is invented, and no line is dropped from the count.
 *
 * ═══ IT SITS UNDER THE STATUS PANEL, AND THAT IS A MEASUREMENT ═══
 * It led the page in the first cut, between the title and the panel. Measured
 * on the real route at 375×667: the shop's cookie dialog is `position: fixed`
 * across 325.25–659px, and the 80px that band cost put the status headline at
 * 361px — behind it, on a first visit, entirely. At 360×640 the dialog starts
 * at 298.25px, which leaves 17px of budget above the panel: nothing fits in 17
 * pixels. Beside the title is no better — "Order 2026-000007-F" measures
 * 224.8px at `text-2xl`, so 320px leaves 63.2px of it, room for one 48px
 * square, and an order number one character longer wraps the heading and costs
 * 32px of height instead.
 *
 * A `?token=` guest arriving from an emailed link is a first-time visitor on
 * that device BY CONSTRUCTION, so that dialog is not an edge case for the
 * branch this page exists to serve. "Where is it" keeps the top of the page,
 * which is what this file's section ordering has said all along; the pictures
 * take the first slot under it, ahead of the reorder button, because what is in
 * the order is what you check before asking for it again.
 *
 * ═══ DECORATIVE, AND THE BLOCK ITSELF IS IN THE TREE ═══
 * `cart-drawer.tsx`'s rule, and now actually true here: the products, the
 * colours and the count are printed in text immediately beside the picture, so
 * naming the picture too is a second reading of the same line. What is NOT
 * hidden any more is the block — the words are real content and reach the
 * accessibility tree, which is the correction the `aria-hidden` band made
 * impossible.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** The square's edge, and the block's height with it — one number, so the
 *  skeleton reserves the resolved box by construction. */
const PICTURE_PX = 64;

/**
 * How many squares fit beside a sentence at 320px.
 *
 * The shell's content box is 288px there. One square leaves 212px for the
 * words, two leave 140px, three leave 68px — and 68px is not a sentence, it is
 * "PLA F…". So two; the words describe the whole order whatever this number is,
 * which is the thing that makes capping it safe at all.
 */
const MAX_PICTURES = 2;

/** The block's box, in one string and one style, because the resolved page and
 *  the skeleton both have to be it — the way `orders-list.tsx` shares `ROW_BOX`. */
const PICTURE_BOX = "flex items-center gap-3";
const PICTURE_STYLE = { height: PICTURE_PX };

/** One square, and the lines that came out looking like it. */
export interface OrderPictureGroup {
  /** Any line from the group — every line in it resolves to the same picture,
   *  which is what made it a group. `LineThumb` resolves it again from the
   *  index, so nothing here decides what gets drawn. */
  line: OrderLine;
  /** The lines that collapsed onto this square, in the order's own order. */
  lines: OrderLine[];
}

/**
 * The order's lines, grouped by the picture they resolve to.
 *
 * THE KEY IS THE RENDERED APPEARANCE, NOT THE VARIANT. Two variants with
 * different ids and different colour NAMES resolve to one photograph in this
 * shop today, and that is exactly the collapse this exists for. `LineThumb`
 * draws from `src` when there is one and from `colourHex` + `weightGrams` when
 * there is not, so those three fields are the whole of what makes two squares
 * look alike. `ofThisColour` is deliberately absent: it changes only what a
 * picture may be CALLED, and nothing here is called anything.
 *
 * "NOTHING CAN BE SOURCED" IS A GROUP TOO. A variant absent from the index and
 * a variant carrying neither photograph nor hex draw the same dashed box, so
 * they collapse together — the condition below is `LineThumb`'s own `drawable`,
 * repeated in the same shape rather than guessed at, because the two have to
 * agree about which lines produce which square.
 *
 * EVERY LINE LANDS IN EXACTLY ONE GROUP. That is the property the words beside
 * the squares depend on, and `order-detail.test.tsx` pins it.
 */
export function orderPictureGroups(
  lines: OrderLine[],
  images: LineImageIndex,
): OrderPictureGroup[] {
  const byPicture = new Map<string, OrderPictureGroup>();
  for (const line of lines) {
    const image = images[line.variantId];
    const drawable = image !== undefined && (image.src !== null || image.colourHex !== null);
    const key = !drawable
      ? "none"
      : image.src !== null
        ? `photo:${image.src}`
        : `spool:${image.colourHex}:${image.weightGrams}`;
    const group = byPicture.get(key);
    if (group) group.lines.push(line);
    else byPicture.set(key, { line, lines: [line] });
  }
  return [...byPicture.values()];
}

/**
 * What the block says in words, which is what makes one square honest about a
 * five-line order.
 *
 * BOTH STRINGS COME FROM THE ORDER, NEVER FROM THE CATALOGUE. `title` and
 * `optionValues.Colour` are the purchase-time snapshot — what the customer
 * bought and what it was called when they bought it — so a product renamed
 * since does not rename their order, and a variant the catalogue has since
 * forgotten still gets its colour said out loud. It is also why this may name a
 * colour that `lineImageAlt` may not: the photograph does not show that colour,
 * and this is not a caption on the photograph, it is the order's contents.
 *
 * THE COUNT COMES FIRST, because it is the part that must survive the ellipsis.
 * Colours after it, distinct, in the order's own order.
 */
export function orderContentsWords(lines: OrderLine[]): { products: string; contents: string } {
  const distinct = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  const items = itemCount(lines);
  const colours = distinct(
    lines.map((l) => l.optionValues?.Colour ?? l.optionValues?.colour ?? ""),
  );
  return {
    products: distinct(lines.map((l) => l.title)).join(", "),
    contents:
      (items === 1 ? "1 item" : `${items} items`) +
      (colours.length > 0 ? ` · ${colours.join(", ")}` : ""),
  };
}

function OrderContents({
  lines,
  lineImages,
  className,
}: {
  lines: OrderLine[];
  lineImages: LineImageIndex;
  className?: string;
}) {
  const groups = orderPictureGroups(lines, lineImages);
  /* NOTHING TO PICTURE IS NOT AN EMPTY BAND. An order with no lines draws no
     block — 64px of blank would be the page reserving space for goods it is not
     showing. That order also loses the reorder button (`ReorderAction` returns
     null), so the skeleton is already holding a shape it cannot fill; it is
     degenerate, and an empty box would not make it less so. */
  if (groups.length === 0) return null;

  const words = orderContentsWords(lines);

  return (
    <section aria-labelledby="order-contents-heading" className={className}>
      <h2 id="order-contents-heading" className="sr-only">
        What is in this order
      </h2>
      <div className={PICTURE_BOX} style={PICTURE_STYLE}>
        <div className="flex shrink-0 items-center gap-2">
          {groups.slice(0, MAX_PICTURES).map((group) => (
            /* `decorative` left at its default, which is true — and no `alt` of
               this file's own, which `LineThumb` does not offer and must not. */
            <LineThumb
              key={group.line.id}
              line={group.line}
              images={lineImages}
              size={PICTURE_PX}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          {/* TRUNCATED, BOTH LINES, so the block is one height whatever the
              order contains and a long list of colours costs a tail rather than
              a second row. The item list below carries all of it, in full. */}
          <p className="truncate font-sans text-sm font-medium text-foreground">
            {words.products}
          </p>
          <p className="mt-0.5 truncate font-sans text-xs text-muted-foreground">
            {words.contents}
          </p>
        </div>
      </div>
    </section>
  );
}

/** The square on an item row. Bigger than the list's 40px — this page has one
 *  order on it and can afford it — and it is `LineThumb`'s own default, which
 *  that file calls "a list row's thumbnail" for exactly this row. */
const ROW_THUMB_PX = 48;

/** Rendered during loading too — the order number comes from the URL, so this
 *  is answerable before the order arrives, and a shopper who has hit a problem
 *  should not have to wait on a fetch to find out who to ask. */
function SupportLine({ orderNumber }: { orderNumber: string }) {
  return (
    <p className="mt-6 flex items-center gap-2 font-sans text-sm text-muted-foreground">
      <LifeBuoy aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span>
        Something wrong with this order?{" "}
        <Link
          href="/contact"
          className="text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Get help
        </Link>
        . Quote {orderNumber}.
      </span>
    </p>
  );
}

/** One column, one width, one set of gutters — every state of this route uses
 *  it so an error page and a loaded page do not shift the layout between them. */
function Shell({ children }: { children: React.ReactNode }) {
  return <AccountShell width="wide">{children}</AccountShell>;
}

/**
 * The loading state, shaped like the page — and rendering what it already knows.
 *
 * `CLAUDE.md`, "Loading states — skeletons, never prose".
 *
 * THE TRAIL, THE TITLE AND THE SUPPORT LINE ARE REAL HERE, not placeholders.
 * The order number is in the URL, so a shopper who has just clicked a link to
 * order PS-10428 should not watch a grey bar where its number will be. Drawing
 * a placeholder over something already known is the same failure as prose, one
 * step subtler: it withholds an answer the page is holding. The trail is real
 * for a second reason as well: `?token=` decides its shape, that is in the URL
 * too, and one `OrderTrail` call in both places is the only way the block above
 * the title cannot change height on resolve.
 *
 * EVERYTHING ELSE MATCHES THE RESOLVED BOX. The first cut was ~330px shorter
 * than the page it stood in for — its stops had no date or "Now" line, its item
 * rows were two bars where a shipped line renders three, its column headings
 * had no rule, and the activity disclosure had no placeholder at all — so every
 * block below the status panel jumped downward on resolve, which is the exact
 * reflow the rule exists to prevent. Two item rows is still a guess at a
 * variable-length list; it is the only mismatch left, and it is bounded.
 */
export function OrderDetailSkeleton({
  orderNumber,
  isGuest,
}: {
  orderNumber: string;
  isGuest: boolean;
}) {
  return (
    <Shell>
      <OrderTrail orderNumber={orderNumber} isGuest={isGuest} />

      <header className="mt-4 flex flex-col gap-1">
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Order {orderNumber}
        </h1>
        <SkeletonRegion label="Loading your order">
          <Skeleton className="mt-1 h-4 w-40" />
        </SkeletonRegion>
      </header>

      <div aria-hidden="true">
        <div className="mt-6 bg-brand-soft/50 px-4 py-5 sm:px-6 sm:py-6">
          {/* `h-7` AT EVERY WIDTH, not `h-6 sm:h-7`. `text-lg` and `sm:text-xl`
              both carry a 1.75rem line-height in this preset, so the real
              heading measures 28px at 320px as well — the responsive bar was
              4px short below `sm` and nobody had measured it there. */}
          <Skeleton className="h-7 w-48" />

          {/* ═══ THE TRACK'S OWN BOXES, NOT A COPY OF THEM ═══
              This used to be a hand-built stack of `h-3`/`h-2.5` bars in a
              `gap-2` column standing in for a `gap-0.5` one. It was wrong at
              every width — the label bars sat 8px high, the second line 2px
              low, the third 4px low — and it passed every check anyone ran,
              because two of the errors happened to cancel to within a pixel of
              the right TOTAL height. It now renders `TrackShell`/`TrackColumn`/
              `TrackLineSkeleton` from `order-progress.tsx`, which is where the
              gaps and the line boxes are stated once. Do not re-type them here.

              WHAT THE PLACEHOLDER ASSUMES, AND WHY. It knows there are five
              stops and that exactly one of them — the furthest reached — draws
              a third line; it cannot know which. So it assumes a mid-flight
              order, stop 3 of 5: stamps under the first three stops, the third
              line under stop 3. That is the assumption that moves fewest bars
              across the eight real states.

              IT DOES NOT ASSUME A MARKER SIZE. The live track enlarges the
              furthest-reached marker, and drawing that guess in the wrong
              column made a marker SHRINK in one place and GROW in another on
              resolve — the loudest movement on the panel, twice, in six states
              out of eight. Five plain 24px markers move one of them, once. The
              32px ROW is still reserved, by `TrackColumn`, so the geometry is
              unaffected either way. */}
          <div className="mt-5">
            <TrackShell>
              {Array.from({ length: 5 }, (_, i) => (
                <TrackColumn
                  key={i}
                  marker={
                    <>
                      {i < 4 && <TrackRule className="bg-muted" />}
                      <Skeleton className="h-6 w-6" />
                    </>
                  }
                >
                  <TrackLineSkeleton kind="label" width="w-12" />
                  {i <= 2 && <TrackLineSkeleton kind="meta" width="w-9" />}
                  {i === 2 && <TrackLineSkeleton kind="meta" width="w-7" />}
                </TrackColumn>
              ))}
            </TrackShell>
            {/* The note under the track is drawn in EVERY state now (see
                `OrderProgress`), so it is reserved here too. Without it the
                panel resolved 52.8px taller on a cancelled or refunded order
                and took the reorder button down the page with it. */}
            <TrackNoteSkeleton />
          </div>

          {/* ═══ AND THE LINK OUT OF THE PANEL, RESERVED IN EVERY STATE ═══
              "See every step" is `mt-4` above a `text-sm` line box, so it is
              36px of panel that would otherwise appear at the instant the order
              lands and push the reorder button down by exactly that much.
              IT IS RESERVED UNCONDITIONALLY, which is correct rather than
              approximate: the resolved link is gated on `!isGuest || token`,
              and the only caller that renders this skeleton derives
              `isGuest` as `token !== null` — so the gate is true in every
              state this component is ever drawn in. The gate exists for
              hand-built props (the bench, a test), which never render a
              skeleton first.
              The bar carries the link's own type rather than an `h-5` picked to
              look about right — the rule `TrackLineSkeleton` established. */}
          <TextSkeleton className="mt-4 w-32 font-sans text-sm" />
        </div>

        {/* ═══ THE PICTURE BLOCK, WHICH IS ONE HEIGHT WHATEVER RESOLVES ═══
            How many squares are coming is not knowable here — it is the number
            of DISTINCT pictures the order's lines resolve to, which needs both
            the lines and the catalogue. It does not have to be: `PICTURE_PX`
            fixes the square, the square fixes the row, and the words beside it
            are two truncated lines that cannot wrap. So the button below lands
            in the same place whether the order turns out to be one photograph
            or two.

            ONE SQUARE, because that is what every order in this shop resolves
            to today — there is one product cover and `imageUrl` is null on
            every live variant. It is a guess at a variable count, and it is
            bounded: nothing about the geometry depends on it, only how wide the
            grey is. */}
        {/* The margin sits on the wrapper rather than on the box, because the
            resolved page hangs `mt-6` on a `<section>` and puts `PICTURE_BOX`
            inside it untouched. Same geometry, and the one class string stays
            byte-identical in both — which is the only way a test can see it. */}
        <div className="mt-6">
          <div className={PICTURE_BOX} style={PICTURE_STYLE}>
            <LineThumbSkeleton size={PICTURE_PX} />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-5 w-32 max-w-full" />
              <Skeleton className="mt-0.5 h-4 w-48 max-w-full" />
            </div>
          </div>
        </div>

        {/* The button's real width at `sm`, so it does not pop sideways. */}
        <Skeleton className="mt-4 h-10 w-full sm:w-[8.75rem]" />
        <div className="mt-2 min-h-[2.5rem]" />

        <div className="mt-8">
          <Skeleton className="h-4 w-16" />
          <div className="mt-2 border-t border-brand-line">
            {Array.from({ length: 2 }, (_, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-4 border-b border-brand-line py-3"
              >
                {/* THE THUMBNAIL RAISED THE FLOOR UNDER THIS ROW, and that
                    made the three bars a BETTER guess rather than a worse one.
                    A resolved row is now `max(48, its text)`: 48px where the
                    line is not shipped (the text alone was 38px) and 58px where
                    it is. The bars measure 52px, which is between the two — so
                    the row that used to resolve 14px shorter than its
                    placeholder now resolves 4px shorter, and the shipped one is
                    6px taller, as it already was. Two rows is still a guess at
                    a variable-length list; it is the only mismatch left here
                    and it is smaller than it was. */}
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <LineThumbSkeleton size={ROW_THUMB_PX} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-40 max-w-full" />
                    <Skeleton className="h-3 w-28 max-w-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-8 sm:grid-cols-2 sm:gap-6">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i}>
              {/* The ruled column heading, at its real height. */}
              <div className="border-b border-brand-line pb-2">
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="mt-3 flex flex-col gap-2.5">
                {Array.from({ length: 4 }, (_, j) => (
                  <Skeleton key={j} className={cn("h-4", j === 3 ? "w-2/5" : "w-full")} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-brand-line py-3">
          <Skeleton className="h-5 w-32" />
        </div>
      </div>

      <SupportLine orderNumber={orderNumber} />
    </Shell>
  );
}

function TotalRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <dt className={cn("font-sans text-sm", emphasis ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </dt>
      <dd
        className={cn(
          "font-mono text-sm tabular-nums",
          emphasis ? "font-semibold text-foreground" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** `shippingAddress` is an untyped `Record<string, unknown>` on the wire —
 *  read the handful of string fields a receipt needs, defensively, rather
 *  than assuming a shape the order type does not actually promise. */
function readAddress(
  raw: Record<string, unknown>,
): { name?: string; line1?: string; line2?: string; city?: string; region?: string } | null {
  if (!raw || Object.keys(raw).length === 0) return null;
  const str = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : undefined);
  const out = {
    name: str("name"),
    line1: str("line1"),
    line2: str("line2"),
    city: str("city"),
    region: str("region"),
  };
  return Object.values(out).some(Boolean) ? out : null;
}

