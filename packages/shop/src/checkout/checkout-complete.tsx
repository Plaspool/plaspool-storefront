"use client";

import * as React from "react";
import { Link } from "../components/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, Link as LinkIcon, ShoppingCart, XCircle } from "lucide-react";
import { Button } from "@plaspool/ui";

import { EmptyState } from "../components/empty-state";
import { confirmPaymentIntent, getPaymentIntent } from "../data/checkout-api";
import type { PaymentIntent } from "../data/checkout-api";
import { getShopCustomer } from "../data/auth-api";
import { useCart } from "../cart/cart-context";
import { basketIsSpent } from "./basket-spent";

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
 * ⚠️  THIS PAGE IS COUPLED TO THE ADMIN'S SWEEP CRON. Changing either one
 *     alone is the trap.
 *
 * THE CRON RUNS EVERY TEN MINUTES — the owner's cost decision, 2026-08-25: a
 * 1-minute cron kept Neon's free-tier compute awake 24/7 and exhausted its
 * monthly hours in about a week. This page took the decision's other half in
 * the same change, and deliberately did NOT stretch its poll to ten minutes:
 *
 * 12 attempts × 5s = SIXTY SECONDS of polling. The first attempt (and any
 * after an error) goes through `confirm`, which asks PAYSTACK directly and
 * applies the answer through the webhook path — so a captured payment still
 * resolves on screen in seconds, sweep or no sweep. What the sweep gates is
 * the ORDER row and its email, not this intent read. Past the window this
 * settles EARLY on the honest "we'll email you when it's confirmed" — true
 * and calm — rather than spinning out a ten-minute gap and looking broken.
 * The `pending` copy below is written for that cadence; if the cron moves
 * again, move the copy with it.
 *
 * The counterpart comment lives on `GET /admin/sweep` in the admin repo.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function CheckoutComplete() {
  const params = useSearchParams();
  const reference = params.get("reference") ?? params.get("trxref");

  /**
   * DESTRUCTURED, not `const cart = useCart()`.
   *
   * The context value is a fresh object on every cart change, so depending on
   * `cart` would restart the poll below — and each restart re-enters at attempt
   * one with a `confirm` call, turning a bounded sixty-second poll into an
   * unbounded one. `refresh` is a stable callback; that is the whole reason to
   * reach for only the piece this page uses.
   */
  const { refresh } = useCart();

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
      if (basketIsSpent(intent.status)) {
        /* ═══ THE BASKET IS SPENT, AND THIS TAB IS THE ONLY THING THAT KNOWS ═══
           The commerce API converted the cart to an order on its own side and
           has no way to tell a page that is already open. `confirm` above ran
           the same reconciliation the webhook does, so by the time a captured
           status is in hand the cart is retired server-side — but the badge in
           the nav still holds whatever the mount read found a second ago, back
           when the basket was open. Left alone it says "3 items" over an empty
           cart for the rest of the visit, and only a manual reload corrects it.

           Deliberately NOT cleared locally. This asks the server and applies
           whatever it says, so the one thing that decides what is in the cart
           stays the thing that takes the money. */
        void refresh();
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
  }, [reference, refresh]);

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
            <Button asChild>
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
              <Button asChild>
                <Link href="/account/orders">View your orders</Link>
              </Button>
            ) : (
              <Button asChild>
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
          body="This is not a decline — confirmation is just taking longer than usual. We'll email your order confirmation once it's through, usually within about ten minutes, so you don't need to keep this page open. Keep the email you get from Paystack as your record either way."
          action={
            <Button
              type="button"
              onClick={() => window.location.reload()}
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
            <Button asChild tone="default">
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
            <Button asChild>
              <Link href="/store">Go to the store</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
