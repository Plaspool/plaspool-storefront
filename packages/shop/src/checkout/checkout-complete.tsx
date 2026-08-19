"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, Link as LinkIcon, ShoppingCart, XCircle } from "lucide-react";
import { Button, NEO_SURFACE, cn } from "@plaspool/ui";

import { EmptyState } from "../components/empty-state";
import { confirmPaymentIntent, getPaymentIntent } from "../data/checkout-api";
import type { PaymentIntent } from "../data/checkout-api";

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
 * order it cannot find. There is no order-lookup call here at all (order
 * history is out of scope for this change — see the report) so "pending" is
 * rendered from the intent's own status, not from a failed order fetch.
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

export function CheckoutComplete() {
  const params = useSearchParams();
  const reference = params.get("reference") ?? params.get("trxref");

  const [phase, setPhase] = React.useState<Phase>(() =>
    reference ? { kind: "loading" } : { kind: "no_reference" },
  );
  const attemptsRef = React.useRef(0);

  React.useEffect(() => {
    if (!reference) return;
    const intentId = referenceToIntentId(reference);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      attemptsRef.current += 1;
      // Ask the provider directly on the first pass — it is the fast path to
      // a genuine capture reaching `captured` without waiting on the webhook
      // or the sweep.
      const result =
        attemptsRef.current === 1
          ? await confirmPaymentIntent(intentId)
          : await getPaymentIntent(intentId);

      if (cancelled) return;

      if (!result.ok) {
        if (result.error.code === "unknown" && result.error.status === 404) {
          setPhase({ kind: "not_found" });
          return;
        }
        // A transient network hiccup on the return trip is not evidence of
        // anything either — keep the pending state and retry.
        if (attemptsRef.current < 12) {
          timer = setTimeout(() => void poll(), 5000);
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
        // on pending rather than declared-failed.
        if (attemptsRef.current < 12) {
          timer = setTimeout(() => void poll(), 5000);
        } else {
          setPhase({ kind: "pending" });
        }
        return;
      }
      // failed / cancelled / anything else terminal-and-not-captured.
      setPhase({ kind: "declined", intent });
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [reference]);

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
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
          body="Your order is being created now — this usually finishes within a minute of paying. A receipt is on its way to your email; there is nowhere to track it on the store yet, so hold onto that email."
          action={
            <Button asChild className="focus-visible:ring-brand focus-visible:ring-offset-background">
              <Link href="/store">Continue shopping</Link>
            </Button>
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
          icon={<XCircle aria-hidden="true" className="text-destructive" />}
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
