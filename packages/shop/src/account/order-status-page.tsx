"use client";

import * as React from "react";
import { Link } from "../components/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, PackageX } from "lucide-react";
import { Button, Skeleton, SkeletonRegion, TextSkeleton, cn } from "@plaspool/ui";

import { Breadcrumb } from "../components/breadcrumb";
import { EmptyState } from "../components/empty-state";
import { StatusTimeline, StatusTimelineSkeleton } from "./status-timeline";
import { headlineFor } from "./order-progress";
import { orderHref, orderTrail } from "./order-detail";
import { getOrder, getOrderEvents } from "../data/orders-api";
import type { Order, OrderEvent } from "../data/orders-api";
import { majorUnits } from "../data/cart-api";
import { formatNaira } from "../data/money";
import { AccountShell } from "./account-shell";

/**
 * `/account/orders/[orderNumber]/status` — the whole journey of one order.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A PAGE, NOT A DISCLOSURE, AND THAT IS THE DECISION WORTH RECORDING.
 *
 * The detail page already carries the five-stop track and used to carry the
 * event log folded into a `<details>` at the bottom. Both were right for what
 * they were — a glance, and an audit trail nobody arrives for — and neither
 * answered "walk me through what happened to my parcel", which is a different
 * question and the one a shopper asks when a delivery is late.
 *
 * It is a ROUTE rather than an expanding panel because it is a destination:
 * a shopper who has been here once returns to it by URL, the back button means
 * what they expect, and — the part a disclosure cannot do — a support
 * conversation can be pointed at it. The cost is one more fetch of an order the
 * previous page had already loaded, and that cost is named here rather than
 * hidden: it is a single cached-by-the-browser GET, and it buys a surface that
 * survives a reload.
 *
 * ═══ IT DECIDES NOTHING ABOUT WHERE THE ORDER IS ═══
 * The headline is `headlineFor`, the stops are `resolveStops`, the outcome is
 * `outcomeOf` — every one of them the same function the detail page's track
 * calls. This page is a different VIEW of one answer, never a second opinion
 * about it. Two screens one click apart that disagree about a parcel is the
 * defect this package's ledger keeps recording; the way it stays fixed is that
 * there is only ever one implementation to be right.
 *
 * The fetch is the detail page's, verbatim in shape: order and events in
 * parallel, a failed `/events` degrading to `[]` rather than blocking the page,
 * `?token=` passed through for the guest who arrived from an emailed link, and
 * every lookup failure collapsing to one `not_found`.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function OrderStatusPage() {
  const params = useParams<{ orderNumber: string }>();
  const searchParams = useSearchParams();
  const orderNumber = decodeURIComponent(params.orderNumber);
  const token = searchParams.get("token");

  const [state, setState] = React.useState<
    | { kind: "loading" }
    | { kind: "not_found" }
    | { kind: "error" }
    | { kind: "ready"; order: Order; events: OrderEvent[] }
  >({ kind: "loading" });
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
          /* A failed `/events` call still shows the journey — the stops fall
             back to the order's own `placedAt`/`paidAt`/`fulfilledAt`, so the
             timeline draws with stamps and simply carries no messages under
             them. Blocking the page on the log would be trading the answer for
             the footnotes. */
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

  if (state.kind === "loading") {
    return <OrderStatusSkeleton orderNumber={orderNumber} isGuest={token !== null} token={token} />;
  }

  if (state.kind !== "ready") {
    const notFound = state.kind === "not_found";
    return (
      <Shell>
        {/* THE WAY BACK SURVIVES THE FAILURE — the trail is answerable from the
            URL alone, so it is drawn before the order arrives and does not
            vanish because the order never did. The same argument the detail
            page's dead ends already make. */}
        <StatusTrail orderNumber={orderNumber} isGuest={token !== null} token={token} />
        <EmptyState
          icon={<PackageX aria-hidden="true" />}
          title={notFound ? "Couldn't find that order" : "Couldn't load that order"}
          body={
            notFound
              ? "We can't find that order. Double-check the link, or sign in to see your orders."
              : "Something went wrong reaching your order — try again in a moment."
          }
          action={
            notFound ? (
              <Button asChild>
                <Link href="/store">Go to the store</Link>
              </Button>
            ) : (
              <Button type="button" onClick={retry}>
                Try again
              </Button>
            )
          }
        />
      </Shell>
    );
  }

  const { order, events } = state;
  const naira = (minor: number) => formatNaira(majorUnits({ amount: minor, currency: order.currency }));

  return (
    <Shell>
      <StatusTrail orderNumber={orderNumber} isGuest={token !== null} token={token} />

      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Status history
        </h1>
        {/* THE ORDER IS NAMED UNDER THE TITLE, NOT IN IT. "Status history for
            order 1416643962" is a heading that wraps to three lines at 320px
            and buries the two words that say which page this is. */}
        <p className="mt-1 text-sm text-muted-foreground">
          Order {order.orderNumber} · {itemsPlaced(order)}
        </p>
      </header>

      {/* ═══ THE ANSWER, BEFORE THE JOURNEY ═══
          Somebody who came here because a parcel is late needs the one-line
          state before they need six timestamps. The tinted field and the
          largest type under the title are the same "start here" the detail
          page's status panel uses — the two surfaces should feel like one
          thing, so they say it the same way. */}
      <section aria-labelledby="status-now" className="mt-6 bg-brand-soft/50 px-4 py-5 sm:px-6">
        <h2
          id="status-now"
          className="text-lg font-semibold tracking-tight text-foreground sm:text-xl"
        >
          {headlineFor(order, events)}
        </h2>
      </section>

      <section aria-labelledby="status-journey" className="mt-8">
        <h2
          id="status-journey"
          className="border-b border-brand-line pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Every step
        </h2>
        <StatusTimeline
          order={order}
          events={events}
          refundAmount={order.refundedTotal > 0 ? naira(order.refundedTotal) : undefined}
          className="mt-6"
        />
      </section>

      {/* NO NEOBRUTALIST TREATMENT ON THIS PAGE, DELIBERATELY. That stroke and
          shadow mark the one thing a screen wants you to DO — add to basket,
          pay, order it again. This page has no such thing: it is a record, and
          the way out of it is navigation. A loud button here would be shouting
          "go back", which is not an offer worth shouting. */}
      <div className="mt-10 border-t border-brand-line pt-6">
        <Button asChild variant="outline" className="gap-2">
          <Link href={orderHref(orderNumber, token)}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to the order
          </Link>
        </Button>
      </div>
    </Shell>
  );
}

/** "placed 1 Jun 2025" — what the page can say about the order WITHOUT its
 *  lines, which this page deliberately does not fetch. It advertised an item
 *  count in an earlier draft and the comment outlived the count; an item count
 *  needs the lines, and this page has none. */
function itemsPlaced(order: Order): string {
  return `placed ${new Date(order.placedAt).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

function StatusTrail({
  orderNumber,
  isGuest,
  token,
}: {
  orderNumber: string;
  isGuest: boolean;
  token: string | null;
}) {
  return <Breadcrumb trail={orderTrail({ orderNumber, isGuest, token, sub: "Status history" })} />;
}

/**
 * The wait, shaped like the page — and rendering what it already knows.
 *
 * The trail and the order number are in the URL, so both are drawn rather than
 * placeheld: a bar standing in for text the page is already holding is a bar
 * that will be replaced by identical text, which is a flicker with no purpose.
 * Everything below is the real geometry: the same tinted panel at the same
 * padding, the same `mt-8` section head, and `StatusTimelineSkeleton`'s five
 * rows at the timeline's own row height.
 */
export function OrderStatusSkeleton({
  orderNumber,
  isGuest,
  token,
}: {
  orderNumber: string;
  isGuest: boolean;
  token: string | null;
}) {
  return (
    <Shell>
      <StatusTrail orderNumber={orderNumber} isGuest={isGuest} token={token} />
      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Status history
        </h1>
        <SkeletonRegion label="Loading this order's status history">
          {/* `text-sm`'s own line box, not an `h-4` bar picked to look about
              right — the subtitle under the title is one line of `text-sm` and
              this has to be exactly that tall or the panel below it moves. */}
          <TextSkeleton className={cn("mt-1 w-56 max-w-full text-sm")} />
        </SkeletonRegion>
      </header>

      <div aria-hidden="true">
        <div className="mt-6 bg-brand-soft/50 px-4 py-5 sm:px-6">
          {/* `h-7` at every width: `text-lg` and `sm:text-xl` both carry a
              1.75rem line-height in this preset, so the real heading measures
              28px below `sm` as well. */}
          <Skeleton className="h-7 w-52 max-w-full" />
        </div>

        <div className="mt-8">
          <div className="border-b border-brand-line pb-2">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="mt-6">
            <StatusTimelineSkeleton />
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <AccountShell width="wide">{children}</AccountShell>;
}
