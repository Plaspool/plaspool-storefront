"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight, LifeBuoy, PackageX, RotateCcw } from "lucide-react";
import { Button, Skeleton, SkeletonRegion, cn } from "@plaspool/ui";

import { EmptyState } from "../components/empty-state";
import { OrderProgress, headlineFor } from "./order-progress";
import { useCart } from "../cart/cart-context";
import { getOrder, getOrderEvents } from "../data/orders-api";
import type { Order, OrderEvent, OrderLine } from "../data/orders-api";
import { majorUnits } from "../data/cart-api";
import { formatNaira } from "../data/money";

/**
 * `/account/orders/[orderNumber]` — one order.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WORKS FOR BOTH A SIGNED-IN CUSTOMER AND A GUEST WITH `?token=…`. The token
 * is read straight from the URL and passed through to both `getOrder` and
 * `getOrderEvents` unchanged — this page never tries to tell which case it
 * is in, because the API answers the same either way when authorization
 * succeeds. The one place it matters is the back link: a guest has no orders
 * list to go back to, so they are offered the store instead.
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
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function OrderDetailPage() {
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

  return <OrderDetail {...state} isGuest={token !== null} />;
}

/** Exported so a fixture can render every state of this page without a live
 *  order behind it — the states that matter (waiting for payment, in transit,
 *  cancelled, refunded) are otherwise unreachable in a dev environment. */
export function OrderDetail({
  order,
  lines,
  events,
  isGuest,
}: {
  order: Order;
  lines: OrderLine[];
  events: OrderEvent[];
  isGuest: boolean;
}) {
  const naira = (minorUnits: number) =>
    formatNaira(majorUnits({ amount: minorUnits, currency: order.currency }));
  const address = readAddress(order.shippingAddress);
  const headline = headlineFor(order, events);
  const cancelled = order.cancelledAt !== null || order.status === "cancelled";
  const paid = order.paidAt !== null;
  const units = lines.reduce((sum, l) => sum + l.qty, 0);
  /* A delivered order's rows must not say "Shipped" while the track above them
     says "Delivered" — the row is the same parcel. */
  const delivered = events.some((e) => e.type === "delivered");

  return (
    <Shell>
      <BackLink isGuest={isGuest} />

      <header className="mt-4 flex flex-col gap-1">
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Order {order.orderNumber}
        </h1>
        <p className="font-sans text-sm text-muted-foreground">
          Placed {formatDate(order.placedAt, { dateOnly: true })}
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
      </section>

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

      {/* THE FULL LOG, FOLDED AWAY. Somebody occasionally wants the audit
          trail; nobody arrives for it. Collapsed keeps it one click from the
          shopper who does without spending the page's attention budget on the
          shopper who does not. */}
      {events.length > 0 && (
        <details className="group mt-8 border-t border-brand-line">
          <summary className="flex cursor-pointer list-none items-center gap-2 py-3 font-sans text-sm font-medium text-foreground marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <ChevronRight
              aria-hidden="true"
              className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
            />
            Full activity
            <span className="font-normal text-muted-foreground group-open:hidden">
              ({events.length})
            </span>
          </summary>
          <ol className="border-t border-brand-line py-3">
            {events.map((event) => (
              <li key={event.id} className="flex justify-between gap-4 py-1.5 text-sm">
                <span className="min-w-0 font-sans text-foreground">{event.message}</span>
                <span className="shrink-0 font-sans text-xs text-muted-foreground">
                  {formatDate(event.occurredAt)}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}

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

             `text-red-700`, NOT `text-destructive`. That token is tuned as a
             BUTTON FILL — white on it clears 17:1 — but as text on the page it
             measures 3.76:1, under AA. This page darkened its greys for exactly
             that reason; the one string that reports a failure must not then be
             the least legible thing on it. */
          nothingAdded ? "text-red-700" : "text-muted-foreground",
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

/** The way out, and it differs by who is looking: a guest arrived from an email
 *  link and has no orders list to go back to. */
function BackLink({ isGuest }: { isGuest: boolean }) {
  return (
    <Link
      href={isGuest ? "/store" : "/account/orders"}
      className="inline-flex items-center gap-1.5 font-sans text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      {isGuest ? "Back to the store" : "All orders"}
    </Link>
  );
}

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
  return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">{children}</div>;
}

/**
 * The loading state, shaped like the page — and rendering what it already knows.
 *
 * `CLAUDE.md`, "Loading states — skeletons, never prose".
 *
 * THE BACK LINK, THE TITLE AND THE SUPPORT LINE ARE REAL HERE, not placeholders.
 * The order number is in the URL, so a shopper who has just clicked a link to
 * order PS-10428 should not watch a grey bar where its number will be. Drawing
 * a placeholder over something already known is the same failure as prose, one
 * step subtler: it withholds an answer the page is holding.
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
      <BackLink isGuest={isGuest} />

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
          <Skeleton className="h-6 w-48 sm:h-7" />
          {/* THE SAME TRACK, INCLUDING ITS ODD ONE OUT. Five identical 24px
              markers made this 26px shorter than any live state, because the
              real track always has exactly one LARGER current marker and a
              third "Now" line under it — so the primary button below jumped
              down the page at the moment the fetch landed, which on touch is a
              mis-tap rather than merely a shift. */}
          <div className="mt-5 flex items-start">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <Skeleton className={i === 2 ? "h-8 w-8" : "h-6 w-6"} />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-2.5 w-9" />
                {i === 2 && <Skeleton className="h-2.5 w-7" />}
              </div>
            ))}
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
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-16" />
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

/** `placedAt`/`occurredAt` are epoch ms, not ISO strings.
 *
 *  `dateOnly` for the header, because the progress track directly under it
 *  already carries dates and a minute-precise clock beside them is noise a
 *  shopper has to read past. The event log keeps the clock — that IS the
 *  audit trail, and the time is the point of it. */
function formatDate(epochMs: number, opts: { dateOnly?: boolean } = {}): string {
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(opts.dateOnly ? {} : { hour: "numeric", minute: "2-digit" }),
  });
}
