"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, Link as LinkIcon, ShoppingCart, XCircle } from "lucide-react";
import { Button, NEO_SURFACE, cn } from "@plaspool/ui";

import { EmptyState } from "../components/empty-state";
import { confirmPaymentIntent, getPaymentIntent } from "../data/checkout-api";
import type { PaymentIntent } from "../data/checkout-api";
import { getShopCustomer } from "../data/auth-api";

/**
 * `/checkout/complete` — where Paystack sends the customer back.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A LANDING PAGE FOR SOMEONE ARRIVING FROM AN EXTERNAL SITE, NOT A ROUTE THE
 * APP NAVIGATES TO ITSELF. Paystack appends its own query parameters —
 * `reference` and `trxref`, the same value twice — on success AND on an
 * abandoned or declined payment alike. Their presence is not evidence of
 * anything; this page ASKS THE PROVIDER (via `confirmPaymentIntent`, which
 * calls the same reconciliation route the webhook itself completes through)
 * rather than trusting the URL.
 *
 * THE NORMAL CASE IS "CAPTURED, NO ORDER YET". Vercel freezes the function
 * after the webhook responds, so the order the capture creates can land up to
 * a minute after the customer is already looking at this page. That is not a
 * failure to render — it is the expected shape of the return trip, and this
 * page's whole job is to say so instead of guessing "payment failed" from an
 * order it cannot find. There is still no order-lookup call here — "pending"
 * is rendered from the intent's own status, never from a failed order fetch —
 * because this page has no order number to look up, only a payment intent id,
 * and the order response deliberately omits `paymentIntentId` so there is no
 * way back from one to the other. A signed-in customer is pointed at
 * `/account/orders` instead, where the order they just paid for will have
 * landed by the time they open it; a guest gets no link here, since there is
 * no order number to attach a guest token to yet.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `reference` IS OUR OWN `payment_intents.id` WITH UNDERSCORES TURNED TO
 * HYPHENS — `providerReferenceFor()` in the admin's `payments/ids.ts` is the
 * one-way version of this; reversing it here is how this page finds the
 * intent to ask about.
 */

type Phase =
  | { kind: "loading" }
  | { kind: "no_reference" }
  | { kind: "captured" }
  | { kind: "pending" }
  | { kind: "declined"; intent: PaymentIntent | null }
  | { kind: "not_found" };

function referenceToIntentId(reference: string): string {
  return reference.replace(/-/g, "_");
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️  THE POLL WINDOW IS COUPLED TO THE ADMIN'S SWEEP CRON. Changing either
 *     one alone is the trap.
 *
 * 12 attempts × 5s = SIXTY SECONDS before this settles on "still confirming".
 * That number is not arbitrary: the order is created by the outbox sweep in
 * `plaspool-admin`, not by the webhook — Vercel freezes the function after it
 * responds — so this window has to outlast the gap between sweeps.
 *
 * The cron currently runs every minute, which is inside this window, so a
 * customer watches the page flip from pending to confirmed. **If that cadence
 * is slowed** — and there is a live reason to slow it, since a 1-minute cron
 * keeps Neon's free-tier compute awake 24/7 and exhausts its monthly hours in
 * about a week — **this window must widen to match.** Leaving them mismatched
 * means every single order times out on screen, which reads as a failure to
 * the one person least able to tell the difference.
 *
 * The honest alternative at a slower cadence is to stop polling early and say
 * "we will email you when it is confirmed", which is true and calm, rather than
 * spinning for a minute and then looking broken.
 *
 * The counterpart comment lives on `GET /admin/sweep` in the admin repo.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function CheckoutComplete() {
  const params = useSearchParams();
  const reference = params.get("reference") ?? params.get("trxref");

  const [phase, setPhase] = React.useState<Phase>(() =>
    reference ? { kind: "loading" } : { kind: "no_reference" },
  );
  const attemptsRef = React.useRef(0);
  const [signedIn, setSignedIn] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    getShopCustomer().then((customer) => {
      if (!cancelled && customer) setSignedIn(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!reference) return;
    const intentId = referenceToIntentId(reference);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll(reconcile: boolean) {
      attemptsRef.current += 1;
      // Ask the provider directly (not just our own row) on the first pass,
      // AND on any pass that follows an errored attempt. `confirm` is the one
      // call that can resolve a status our own DB has not heard yet — a plain
      // `getPaymentIntent` after a transient failure would spend the rest of
      // the poll window re-reading a row the webhook has not touched, with
      // the sweep not due for up to a minute.
      const result = reconcile ? await confirmPaymentIntent(intentId) : await getPaymentIntent(intentId);

      if (cancelled) return;

      if (!result.ok) {
        if (result.error.code === "unknown" && result.error.status === 404) {
          setPhase({ kind: "not_found" });
          return;
        }
        // A transient network hiccup on the return trip is not evidence of
        // anything either — keep the pending state and retry, reconciling
        // again rather than reading our own possibly-stale row.
        if (attemptsRef.current < 12) {
          timer = setTimeout(() => void poll(true), 5000);
        } else {
          setPhase({ kind: "pending" });
        }
        return;
      }

      const intent = result.data;
      if (intent.status === "captured") {
        setPhase({ kind: "captured" });
        return;
      }
      if (intent.status === "requires_payment") {
        // Still waiting on Paystack itself — keep polling a while, then settle
        // on pending rather than declared-failed. Re-reading our own row is
        // enough here: `confirm` already ran this pass and found nothing new,
        // so the next few passes read cheaply until one does.
        if (attemptsRef.current < 12) {
          timer = setTimeout(() => void poll(false), 5000);
        } else {
          setPhase({ kind: "pending" });
        }
        return;
      }
      // failed / cancelled / anything else terminal-and-not-captured.
      setPhase({ kind: "declined", intent });
    }

    void poll(true);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [reference]);

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      {/* `EmptyState` renders an `h2` — the page needs its own top-level
          heading regardless of which phase is showing. Visually hidden: the
          icon-plus-title inside `EmptyState` already carries the page's
          purpose for a sighted visitor. */}
      <h1 className="sr-only">Payment confirmation</h1>
      {phase.kind === "loading" && (
        <EmptyState
          icon={<Clock aria-hidden="true" />}
          title="Checking your payment"
          body="This takes a moment — do not close this page."
        />
      )}

      {phase.kind === "no_reference" && (
        <EmptyState
          icon={<LinkIcon aria-hidden="true" />}
          title="Nothing to confirm here"
          body="This page confirms a payment coming back from checkout. If you were sent here directly, head to the store instead."
          action={
            <Button asChild className="focus-visible:ring-brand focus-visible:ring-offset-background">
              <Link href="/store">Go to the store</Link>
            </Button>
          }
        />
      )}

      {phase.kind === "captured" && (
        <EmptyState
          icon={<CheckCircle2 aria-hidden="true" className="text-brand" />}
          title="Payment received"
          body={
            signedIn
              ? "Your order is being created now — this usually finishes within a minute of paying. It will appear in your orders shortly; a receipt is also on its way to your email."
              : "Your order is being created now — this usually finishes within a minute of paying. A receipt is on its way to your email; there is nowhere to track it on the store yet, so hold onto that email."
          }
          action={
            signedIn ? (
              <Button asChild className="focus-visible:ring-brand focus-visible:ring-offset-background">
                <Link href="/account/orders">View your orders</Link>
              </Button>
            ) : (
              <Button asChild className="focus-visible:ring-brand focus-visible:ring-offset-background">
                <Link href="/store">Continue shopping</Link>
              </Button>
            )
          }
        />
      )}

      {phase.kind === "pending" && (
        <EmptyState
          icon={<Clock aria-hidden="true" />}
          title="Still confirming your payment"
          body="Paystack is taking longer than usual to tell us how this went. This is not a decline — refresh in a minute to check again, and keep the email you get from Paystack as your record either way."
          action={
            <Button
              type="button"
              onClick={() => window.location.reload()}
              className="focus-visible:ring-brand focus-visible:ring-offset-background"
            >
              Check again
            </Button>
          }
        />
      )}

      {phase.kind === "declined" && (
        <EmptyState
          /* `destructive-strong` even though an icon only owes 3:1 and the
             base token clears that. A glyph beside a failure line that is a
             different red from the line is a second decision to make at the
             worst moment; matching costs nothing here. */
          icon={<XCircle aria-hidden="true" className="text-destructive-strong" />}
          title="Payment not completed"
          body={
            phase.intent?.status === "cancelled"
              ? "This payment was cancelled before it finished. Your cart still has the items — go back and try again."
              : "This payment was not captured. Your cart still has the items — go back and try again."
          }
          action={
            <Button asChild className={cn(NEO_SURFACE, "border-2 border-foreground bg-background hover:bg-background")}>
              <Link href="/cart">
                <ShoppingCart aria-hidden="true" className="mr-2 h-4 w-4" />
                Back to cart
              </Link>
            </Button>
          }
        />
      )}

      {phase.kind === "not_found" && (
        <EmptyState
          icon={<XCircle aria-hidden="true" />}
          title="Couldn't find that payment"
          body="This reference doesn't match a payment we know about. If you were charged, the amount will show on your statement — contact support with that reference rather than retrying."
          action={
            <Button asChild className="focus-visible:ring-brand focus-visible:ring-offset-background">
              <Link href="/store">Go to the store</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
