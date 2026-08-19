"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, PackageX } from "lucide-react";
import { Button } from "@plaspool/ui";

import { EmptyState } from "../components/empty-state";
import { getOrder, getOrderEvents } from "../data/orders-api";
import type { Order, OrderEvent, OrderLine } from "../data/orders-api";
import { majorUnits } from "../data/cart-api";
import { formatNaira } from "../data/money";

/**
 * `/account/orders/[orderNumber]` — one order: lines, totals, status and its
 * timeline.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WORKS FOR BOTH A SIGNED-IN CUSTOMER AND A GUEST WITH `?token=…`. The token
 * is read straight from the URL and passed through to both `getOrder` and
 * `getOrderEvents` unchanged — this page never tries to tell which case it
 * is in, because the API answers the same either way when authorization
 * succeeds.
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
             rather than blocking the whole page on it. */
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
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="font-sans text-sm text-muted-foreground">Loading your order…</p>
      </div>
    );
  }

  if (state.kind === "not_found") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
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
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
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
      </div>
    );
  }

  const { order, lines, events } = state;
  const naira = (minorUnits: number) =>
    formatNaira(majorUnits({ amount: minorUnits, currency: order.currency }));
  const address = readAddress(order.shippingAddress);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Order {order.orderNumber}
        </h1>
        <p className="font-sans text-sm text-muted-foreground">
          {formatDate(order.placedAt)} · {order.status}
        </p>
      </div>

      {order.refundedTotal > 0 && (
        <p className="mt-4 border-2 border-foreground bg-brand-soft px-4 py-3 font-sans text-sm text-foreground">
          {naira(order.refundedTotal)} refunded on this order.
        </p>
      )}

      <div className="mt-6 border-2 border-foreground p-4">
        <p className="font-sans text-sm font-semibold text-foreground">Items</p>
        <ul className="mt-3 flex flex-col gap-3">
          {lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1 font-sans text-muted-foreground">
                {line.title} × {line.qty}
                {line.fulfilledQty > 0 && line.fulfilledQty < line.qty && (
                  <span className="block text-xs">{line.fulfilledQty} of {line.qty} shipped</span>
                )}
                {line.fulfilledQty >= line.qty && line.qty > 0 && (
                  <span className="block text-xs">Shipped</span>
                )}
              </span>
              <span className="shrink-0 font-mono tabular-nums text-foreground">
                {naira(line.lineTotal)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 border-2 border-foreground p-4">
        <TotalRow label="Subtotal" value={naira(order.subtotal)} />
        <TotalRow label="Delivery" value={naira(order.shippingTotal)} />
        {order.taxTotal > 0 && <TotalRow label="Tax" value={naira(order.taxTotal)} />}
        <div className="mt-1 flex items-center justify-between border-t border-brand-line pt-2">
          <span className="font-sans text-base font-semibold text-foreground">Total</span>
          <span className="font-mono text-base font-bold tabular-nums text-foreground">
            {naira(order.grandTotal)}
          </span>
        </div>
      </div>

      {address && (
        <div className="mt-4 border-2 border-foreground p-4">
          <p className="font-sans text-sm font-semibold text-foreground">Delivered to</p>
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            {[address.name, address.line1, address.line2, address.city, address.region]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
      )}

      {events.length > 0 && (
        <div className="mt-4 border-2 border-foreground p-4">
          <p className="font-sans text-sm font-semibold text-foreground">Timeline</p>
          <ul className="mt-3 flex flex-col gap-3">
            {events.map((event) => (
              <li key={event.id} className="flex items-start gap-2 text-sm">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span className="min-w-0 flex-1">
                  <span className="block font-sans text-foreground">{event.message}</span>
                  <span className="block font-sans text-xs text-muted-foreground">
                    {formatDate(event.occurredAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="font-sans text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums text-foreground">{value}</span>
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
  return {
    name: str("name"),
    line1: str("line1"),
    line2: str("line2"),
    city: str("city"),
    region: str("region"),
  };
}

/** `placedAt`/`occurredAt` are epoch ms, not ISO strings. */
function formatDate(epochMs: number): string {
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
