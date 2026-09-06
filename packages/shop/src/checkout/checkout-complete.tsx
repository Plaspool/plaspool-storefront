"use client";

import * as React from "react";
import { Link } from "../components/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Link as LinkIcon,
  Printer,
  ShoppingCart,
  XCircle,
} from "lucide-react";
import { Button, Skeleton, SkeletonRegion, cn } from "@plaspool/ui";

import { LineThumb } from "../components/line-thumb";
import { confirmPaymentIntent, getPaymentIntent } from "../data/checkout-api";
import type { PaymentIntent } from "../data/checkout-api";
import { getShopCustomer } from "../data/auth-api";
import { listOrders } from "../data/orders-api";
import { getPointsBalance, getPointsLedger, pointsLabel } from "../data/points-api";
import type { PointsBalance } from "../data/points-api";
import type { LineImageIndex } from "../data/catalog";
import { majorUnits } from "../data/cart-api";
import { formatNaira } from "../data/money";
import { useCart } from "../cart/cart-context";
import { addOnRowsFor } from "./add-ons";
import { basketIsSpent } from "./basket-spent";
import {
  clearReceiptSnapshot,
  earnedSince,
  loadReceiptSnapshot,
  orderMatchesSnapshot,
} from "./receipt-snapshot";
import type { ReceiptLine, ReceiptSnapshot } from "./receipt-snapshot";

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
 * order it cannot find.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ═══ ONE RECEIPT, SIX STATUS HEADERS ═══
 * This page used to be six mutually exclusive `EmptyState`s — one sentence
 * each, because one sentence was all it could honestly say. It had no line
 * items, no breakdown and no order number, and could not fetch any of them:
 * the intent carries `{status, amount, currency}` and nothing more, and the
 * customer view of an order strips `paymentIntentId` and `checkoutId` so
 * there is no join back.
 *
 * The checkout flow now writes the receipt down before it hands off (see
 * `receipt-snapshot.ts`), so the shape inverted. The RECEIPT is the page, and
 * the header above it is what changes with the payment's status. The shopper
 * sees what they bought the instant they land, on every phase, rather than
 * watching a spinner and then being told a single sentence.
 *
 * ═══ WHAT THE SNAPSHOT MAY AND MAY NOT BE USED FOR ═══
 * It came out of the customer's own browser. It is a DISPLAY COPY: it draws
 * the item rows and the breakdown, and nothing is decided from it. Every
 * claim about money that was actually taken reads `intent.amount`, which came
 * from the API — see `paidTotal` below, and the `orderMatchesSnapshot` header.
 *
 * A shopper with no snapshot — bookmarked URL, a different browser, storage
 * cleared, private mode — gets exactly the page that shipped before this one:
 * the status header alone, with its original copy. Nothing here is load-
 * bearing for correctness; it is all detail on top of a page that already
 * worked.
 */

type Phase =
  | { kind: "loading" }
  | { kind: "no_reference" }
  | { kind: "captured"; intent: PaymentIntent }
  | { kind: "pending"; intent: PaymentIntent | null }
  | { kind: "declined"; intent: PaymentIntent | null }
  | { kind: "not_found" };

function referenceToIntentId(reference: string): string {
  return reference.replace(/-/g, "_");
}

/** How the order lookup below is going. `absent` is a real answer — a guest
 *  has no order number coming, ever, so the page must not leave a skeleton
 *  standing where nothing will land. */
type OrderLookup =
  | { kind: "absent" }
  | { kind: "searching" }
  | { kind: "found"; orderNumber: string }
  | { kind: "gave_up" };

/**
 * The receipt, read from `sessionStorage` through `useSyncExternalStore`.
 *
 * ═══ WHY NOT A `useState` INITIALISER, AND WHY NOT AN EFFECT ═══
 * `sessionStorage` does not exist on the server, so a lazy initialiser answers
 * null there and the receipt on the client — a hydration mismatch on the one
 * page a shopper reaches immediately after paying. An effect avoids that but
 * sets state synchronously on mount, which is the cascading render the hooks
 * lint rule names. `getServerSnapshot` is the built-in answer to exactly this
 * shape: React takes null for the server pass and the real value for the
 * client, and reconciles the two itself.
 *
 * ═══ THE MEMO IS LOAD-BEARING, NOT AN OPTIMISATION ═══
 * `getSnapshot` must return a REFERENTIALLY STABLE value or React re-renders
 * forever, and `loadReceiptSnapshot` parses fresh JSON into a new object every
 * call. Caching by intent id also gives the page a property it wants anyway:
 * `clearReceiptSnapshot()` runs once the order is found, and the receipt must
 * keep rendering after it — the shopper is still reading it. The memo holds
 * what was read, so emptying the store does not blank the page.
 */
const NEVER_CHANGES = () => () => {};
let memoisedFor: string | null = null;
let memoised: ReceiptSnapshot | null = null;

function useReceiptSnapshot(intentId: string | null): ReceiptSnapshot | null {
  const getSnapshot = React.useCallback(() => {
    if (!intentId) return null;
    if (memoisedFor !== intentId) {
      memoisedFor = intentId;
      memoised = loadReceiptSnapshot(intentId);
    }
    return memoised;
  }, [intentId]);

  return React.useSyncExternalStore(NEVER_CHANGES, getSnapshot, () => null);
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
export function CheckoutComplete({ lineImages }: { lineImages: LineImageIndex }) {
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
  const [signedIn, setSignedIn] = React.useState<boolean | null>(null);

  const snapshot = useReceiptSnapshot(reference ? referenceToIntentId(reference) : null);

  React.useEffect(() => {
    let cancelled = false;
    getShopCustomer().then((customer) => {
      if (!cancelled) setSignedIn(Boolean(customer));
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
          setPhase({ kind: "pending", intent: null });
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
        setPhase({ kind: "captured", intent });
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
          setPhase({ kind: "pending", intent });
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

  const captured = phase.kind === "captured" ? phase : null;
  const capturedAmount = captured?.intent.amount ?? null;

  /**
   * ═══ FINDING THE ORDER THIS PAYMENT BECAME, WITHOUT A JOIN TO FOLLOW ═══
   *
   * There isn't one — `customerView` strips `paymentIntentId` and
   * `checkoutId`. So this reads the customer's newest few orders and asks
   * `orderMatchesSnapshot` whether any of them looks like the basket that was
   * just paid for; see that function for the three tests and for why a false
   * positive is the failure that matters.
   *
   * SIGNED-IN ONLY, and that is the API's shape rather than a choice here:
   * `GET /orders` 401s for a guest, and a guest's order number only ever
   * reaches them by email. `signedIn === null` means "not asked yet" and must
   * not be read as "no" — starting the lookup on it would race the session
   * read and settle on `absent` for a customer who is signed in.
   *
   * FIVE ORDERS, NOT ONE. "Newest" is not reliably this order: a shopper can
   * have a second tab, and the sweep can land two orders in either order. The
   * predicate is strict enough that scanning a few costs nothing.
   */
  /* TWO FACTS STORED, THE STATE DERIVED FROM THEM.
     `absent` and `searching` are not things that happen — they are what is
     true when the session says "guest" and when neither of these has landed
     yet. Storing them as well would mean an effect writing state on mount to
     say something the render could already see. */
  const [foundNumber, setFoundNumber] = React.useState<string | null>(null);
  const [searchExhausted, setSearchExhausted] = React.useState(false);

  const lookup: OrderLookup = foundNumber
    ? { kind: "found", orderNumber: foundNumber }
    : signedIn === false
      ? { kind: "absent" }
      : searchExhausted
        ? { kind: "gave_up" }
        : { kind: "searching" };

  React.useEffect(() => {
    if (!captured || !snapshot || capturedAmount === null) return;
    /* `null` is "not asked yet" and must not be read as "no" — starting on it
       would race the session read and settle `absent` for a customer who is
       in fact signed in. */
    if (!signedIn) return;

    /* Bound here rather than read from the closure inside `find`: narrowing
       does not survive into a function that could be called later, and these
       two are what the predicate is built from. */
    const receipt = snapshot;
    const amount = capturedAmount;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    async function find() {
      attempts += 1;
      const result = await listOrders(undefined, 5);
      if (cancelled) return;

      if (result.ok) {
        const hit = result.items.find((item) =>
          orderMatchesSnapshot(item.order, item.lines, receipt, amount),
        );
        if (hit) {
          setFoundNumber(hit.order.orderNumber);
          return;
        }
      }

      /* Same sixty-second budget as the payment poll above, for the same
         reason: the order lands within about a minute of capture, and past
         that the honest thing is to stop and point at the orders list rather
         than leave a skeleton spinning at somebody who has already paid. */
      if (attempts < 12) {
        timer = setTimeout(() => void find(), 5000);
      } else {
        setSearchExhausted(true);
      }
    }

    void find();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [captured, snapshot, capturedAmount, signedIn]);

  /**
   * The points this order earned, and the operator's noun for them.
   *
   * Deferred until the order has been found, because that is the first moment
   * the earn is certainly written — the ledger entry and the order row are
   * made by the same sweep. Asking earlier would usually answer "nothing yet"
   * and this page would have to poll a second thing to correct it.
   *
   * BOTH HALVES ARE REQUIRED TO RENDER ANYTHING. A number with no noun is
   * meaningless, and the noun is the operator's to choose — `pointsLabel`
   * answers null rather than inventing one, and this follows it.
   */
  const [earned, setEarned] = React.useState<number | null>(null);
  const [balance, setBalance] = React.useState<PointsBalance | null>(null);
  const foundOrder = lookup.kind === "found";

  React.useEffect(() => {
    if (!foundOrder || !snapshot) return;
    let cancelled = false;
    void Promise.all([getPointsLedger(), getPointsBalance()]).then(([ledger, bal]) => {
      if (cancelled || !ledger) return;
      setEarned(earnedSince(ledger.items, snapshot.startedAt));
      setBalance(bal);
    });
    return () => {
      cancelled = true;
    };
  }, [foundOrder, snapshot]);

  /**
   * ═══ THE SNAPSHOT IS SPENT ONCE THE ORDER EXISTS ═══
   * From that moment `/account/orders/<n>` is the better copy of this receipt
   * — it is the server's, it stays true as the order moves, and it is not a
   * stale basket sitting in storage. Dropping it also means a shopper who
   * checks out a second time in the same tab cannot be shown the first
   * basket if anything about the intent keying ever slips.
   *
   * Only on `found`: while the lookup is still searching the snapshot is the
   * only thing drawing the page.
   */
  React.useEffect(() => {
    if (foundOrder) clearReceiptSnapshot();
  }, [foundOrder]);

  const status = statusFor(phase, signedIn);

  /* WHICH PHASES MAY DRAW A BASKET AT ALL.
     `not_found` may not: the reference matched no payment we know about, and
     printing an itemised receipt under that sentence asserts an order that
     may not exist. `no_reference` has no snapshot to draw by construction. */
  const showReceipt =
    snapshot !== null && phase.kind !== "not_found" && phase.kind !== "no_reference";

  /* A DECLINED PAYMENT BOUGHT NOTHING, so its basket is drawn as a basket:
     no address it is shipping to, no points earned, no "what happens next",
     and the bold figure is what the basket CAME TO rather than what was
     paid. The items are still worth showing — the copy beside them says the
     cart still holds them, and this is what "them" means. */
  const paid = phase.kind === "captured";

  /* THE ADDRESS OUTLIVES `captured`, unlike the points and the next steps.
     While confirmation is still in flight the shopper has just typed it and
     paid against it, so showing it back is information rather than a claim —
     and it is the last moment a typo is cheap to catch. A DECLINED payment
     ships nothing, so it gets no destination. */
  const willShip = phase.kind !== "declined";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14" data-receipt-page>
      {/* The status header renders an `h2`, so the page needs its own
          top-level heading regardless of which phase is showing. Visually
          hidden: the icon-plus-title below already carries the page's purpose
          for a sighted visitor. */}
      <h1 className="sr-only">Payment confirmation</h1>

      <StatusHeader
        status={status}
        orderSlot={
          phase.kind === "captured" ? (
            <OrderNumber lookup={lookup} signedIn={signedIn} />
          ) : null
        }
      />

      {showReceipt && snapshot && (
        <>
          <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-12">
            <div className="min-w-0">
              <ItemsSection
                lines={snapshot.lines}
                images={lineImages}
                heading={paid ? "What you ordered" : "What was in your basket"}
              />
              {willShip && snapshot.address && <AddressSection address={snapshot.address} />}
            </div>

            <div className="min-w-0">
              <SummarySection
                snapshot={snapshot}
                /* THE AUTHORITATIVE NUMBER, and the reason this prop exists:
                   the bold figure a shopper reads as "what I was charged"
                   must come from the API, never from the browser's own copy
                   of the total. Absent for any phase where nothing was
                   charged — the row then labels itself accordingly. */
                paidTotal={capturedAmount}
                paid={paid}
              />
              {paid && <PointsEarned earned={earned} balance={balance} />}
            </div>
          </div>

          {paid && <NextSteps city={snapshot.address?.city ?? null} signedIn={signedIn} />}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE STATUS HEADER — the one thing that changes with the payment's status.
   ═══════════════════════════════════════════════════════════════════════════ */

interface StatusCopy {
  icon: React.ReactNode;
  title: string;
  body: string;
  action: React.ReactNode;
  /** Draws the icon in the brand rather than the muted default. Success only —
   *  a green tick on a page that has not confirmed anything is a lie told in
   *  colour. */
  affirmative?: boolean;
}

function statusFor(phase: Phase, signedIn: boolean | null): StatusCopy {
  switch (phase.kind) {
    case "loading":
      return {
        icon: <Clock aria-hidden="true" />,
        title: "Confirming your payment",
        /* PROSE, NOT A SKELETON, and deliberately — the house rule carves out
           exactly this case: "a wait that is a process the shopper is
           watching rather than content arriving". The payment is the process.
           The ORDER NUMBER, which is content arriving, gets a skeleton. */
        body: "This takes a moment — do not close this page.",
        action: null,
      };

    case "no_reference":
      return {
        icon: <LinkIcon aria-hidden="true" />,
        title: "Nothing to confirm here",
        body: "This page confirms a payment coming back from checkout. If you were sent here directly, head to the store instead.",
        action: (
          <Button asChild>
            <Link href="/store">Go to the store</Link>
          </Button>
        ),
      };

    case "captured":
      return {
        icon: <CheckCircle2 aria-hidden="true" />,
        affirmative: true,
        title: "Payment received",
        body: signedIn
          ? "Your order is being created now — this usually finishes within a minute of paying. A receipt is also on its way to your email."
          : "Your order is being created now — this usually finishes within a minute of paying. A receipt is on its way to your email; there is nowhere to track it on the store yet, so hold onto that email.",
        action: (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {signedIn ? (
              <Button asChild>
                <Link href="/account/orders">View your orders</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/store">Continue shopping</Link>
              </Button>
            )}
            <PrintButton />
          </div>
        ),
      };

    case "pending":
      return {
        icon: <Clock aria-hidden="true" />,
        title: "Still confirming your payment",
        body: "This is not a decline — confirmation is just taking longer than usual. We'll email your order confirmation once it's through, usually within about ten minutes, so you don't need to keep this page open. Keep the email you get from Paystack as your record either way.",
        action: (
          <Button type="button" onClick={() => window.location.reload()}>
            Check again
          </Button>
        ),
      };

    case "declined":
      return {
        /* `destructive-strong` even though an icon only owes 3:1 and the
           base token clears that. A glyph beside a failure line that is a
           different red from the line is a second decision to make at the
           worst moment; matching costs nothing here. */
        icon: <XCircle aria-hidden="true" className="text-destructive-strong" />,
        title: "Payment not completed",
        body:
          phase.intent?.status === "cancelled"
            ? "This payment was cancelled before it finished. Your cart still has the items — go back and try again."
            : "This payment was not captured. Your cart still has the items — go back and try again.",
        action: (
          <Button asChild tone="default">
            <Link href="/cart">
              <ShoppingCart aria-hidden="true" className="mr-2 h-4 w-4" />
              Back to cart
            </Link>
          </Button>
        ),
      };

    case "not_found":
      return {
        icon: <XCircle aria-hidden="true" />,
        title: "Couldn't find that payment",
        body: "This reference doesn't match a payment we know about. If you were charged, the amount will show on your statement — contact support with that reference rather than retrying.",
        action: (
          <Button asChild>
            <Link href="/store">Go to the store</Link>
          </Button>
        ),
      };
  }
}

function StatusHeader({
  status,
  orderSlot,
}: {
  status: StatusCopy;
  orderSlot: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-2 text-center">
      <span
        aria-hidden="true"
        className={cn(
          "mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft",
          status.affirmative ? "text-brand" : "text-muted-foreground",
        )}
      >
        {status.icon}
      </span>
      <h2 className="text-xl font-semibold text-foreground sm:text-2xl">{status.title}</h2>
      {orderSlot}
      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{status.body}</p>
      {/* `print:hidden` throughout the actions: a printed receipt with a row
          of buttons across it wastes the ink and reads as a screenshot. */}
      {status.action && <div className="mt-6 print:hidden">{status.action}</div>}
    </div>
  );
}

/**
 * The order number, or an honest absence of one.
 *
 * FOUR STATES, AND THE ONE THAT MATTERS IS `absent`. A guest never gets a
 * number — `GET /orders` 401s for them and nothing else carries it — so they
 * must not be shown a skeleton implying something is on its way. They get
 * nothing here, and the header's own copy already tells them to keep the
 * email.
 */
function OrderNumber({ lookup, signedIn }: { lookup: OrderLookup; signedIn: boolean | null }) {
  if (lookup.kind === "found") {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        Order{" "}
        <span className="font-mono font-bold tracking-tight text-foreground">
          #{lookup.orderNumber}
        </span>
      </p>
    );
  }

  /* `gave_up` prints nothing rather than an apology. The order exists — the
     header already says it is being created and points at the list — and a
     line explaining that we could not find its number is noise about our own
     plumbing at a moment the shopper does not care about it. */
  if (lookup.kind === "gave_up" || lookup.kind === "absent" || signedIn === false) return null;

  return (
    <SkeletonRegion label="Finding your order number" className="mt-2">
      <Skeleton className="h-5 w-28" />
    </SkeletonRegion>
  );
}

function PrintButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer aria-hidden="true" className="mr-2 h-4 w-4" />
      Print receipt
    </Button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE RECEIPT
   ═══════════════════════════════════════════════════════════════════════════ */

/** The house section heading, matched to `/account/orders/[orderNumber]` so
 *  the two receipts read as one shop rather than two. */
function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="border-b border-brand-line pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
    >
      {children}
    </h2>
  );
}

/** The thumbnail's edge, matched to the order detail page's rows. */
const ROW_THUMB_PX = 56;

function ItemsSection({
  lines,
  images,
  heading,
}: {
  lines: ReceiptLine[];
  images: LineImageIndex;
  heading: string;
}) {
  return (
    <section aria-labelledby="receipt-items-heading">
      <SectionHeading id="receipt-items-heading">{heading}</SectionHeading>
      <ul className="divide-y divide-brand-line">
        {lines.map((line) => (
          <li
            key={`${line.variantId}:${line.colour}:${line.size}`}
            className="flex items-start justify-between gap-4 py-3"
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {/* DECORATIVE: the title, colour, size and quantity are printed
                  immediately to its right, so naming the picture as well is a
                  second reading of the same row. A line the catalogue cannot
                  describe still gets its box — `LineThumb` draws the dashed
                  square, so the column stays a column. */}
              <LineThumb
                line={{
                  variantId: line.variantId,
                  title: line.title,
                  optionValues: { Colour: line.colour, Size: line.size },
                }}
                images={images}
                size={ROW_THUMB_PX}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{line.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[line.colour, line.size].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {line.qty} × {formatNaira(line.effectiveUnitPrice)}
                  {/* THE STRUCK PRICE ONLY WHERE A RUNG ACTUALLY APPLIED.
                      `bulkPercentBps` is 0 for most lines and absent on
                      anything frozen before bulk pricing shipped, so this
                      tests the discount rather than comparing two numbers
                      that are equal by default. */}
                  {line.bulkPercentBps > 0 && (
                    <>
                      {" "}
                      <span className="line-through">{formatNaira(line.unitPrice)}</span>{" "}
                      <span className="text-brand">
                        −{Math.round(line.bulkPercentBps / 100)}%
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
              {formatNaira(line.lineTotal)}
            </span>
          </li>
        ))}
      </ul>
    </section>
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
    <div className="flex items-center justify-between gap-4 py-1">
      <dt className={cn("text-sm", emphasis ? "text-foreground" : "text-muted-foreground")}>
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

function SummarySection({
  snapshot,
  paidTotal,
  paid,
}: {
  snapshot: ReceiptSnapshot;
  paidTotal: number | null;
  paid: boolean;
}) {
  const { totals, currency } = snapshot;
  /** Minor units → naira, through the one function that owns the /100. */
  const naira = (amount: number) => formatNaira(majorUnits({ amount, currency }));

  return (
    <section aria-labelledby="receipt-summary-heading">
      <SectionHeading id="receipt-summary-heading">
        {paid ? "Order summary" : "Basket summary"}
      </SectionHeading>
      <dl className="mt-3">
        <TotalRow label="Subtotal" value={naira(totals.subtotal)} />

        {/* Each of the three below is drawn only when it has something to say.
            A free-delivery order does not need a ₦0 row, and a shop that is
            not VAT-registered has no tax line to label — `taxLabel` is null in
            that case and nothing here invents a word for it. */}
        {totals.shippingTotal > 0 && (
          <TotalRow label={totals.shippingLabel ?? "Delivery"} value={naira(totals.shippingTotal)} />
        )}
        {totals.shippingTotal === 0 && <TotalRow label="Delivery" value="Free" />}

        {/* THE ADD-ONS, AFTER DELIVERY AND BEFORE THE TAX — the review step's
            order, and its rule: the title verbatim beside what was charged,
            or `Included` for one the rules put on the order at no cost. A
            snapshot from before add-ons existed has no rows here at all. */}
        {addOnRowsFor(totals.addOns ?? [], currency).map((row) => (
          <TotalRow key={row.key} label={row.label} value={row.value} />
        ))}

        {totals.taxTotal > 0 && totals.taxLabel && (
          <TotalRow
            label={
              totals.taxRateBps
                ? `${totals.taxLabel} (${totals.taxRateBps / 100}%)`
                : totals.taxLabel
            }
            value={naira(totals.taxTotal)}
          />
        )}

        {/* THE LABEL IS THE API'S OWN WORDING, rendered verbatim — it is where
            the rewards programme's nouns legitimately reach the storefront.
            The amount is already negative, so it carries its own sign and
            nothing here adds a second one. */}
        {totals.adjustments.map((adjustment) => (
          <TotalRow
            key={adjustment.code}
            label={adjustment.label}
            value={naira(adjustment.amount)}
          />
        ))}

        <div className="mt-2 flex items-center justify-between gap-4 border-t-2 border-foreground pt-3">
          <dt className="text-base font-semibold text-foreground">
            {paid ? "Total paid" : "Total"}
          </dt>
          <dd className="font-mono text-base font-bold tabular-nums text-foreground">
            {/* `paidTotal` — the INTENT's amount — wins wherever it exists.
                The snapshot's own `grandTotal` came out of the browser and is
                a display copy; the number a shopper reads as what they were
                charged has to be the API's. They agree in every ordinary
                case, which is exactly why the disagreeing case must not be
                decided in the browser's favour. */}
            {naira(paidTotal ?? totals.grandTotal)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function AddressSection({
  address,
}: {
  address: NonNullable<ReceiptSnapshot["address"]>;
}) {
  return (
    <section aria-labelledby="receipt-address-heading" className="mt-8">
      <SectionHeading id="receipt-address-heading">Shipping to</SectionHeading>
      {/* `not-italic` because `<address>` is italic by default in every
          browser, and an italic postal address reads as a quotation. */}
      <address className="mt-3 text-sm not-italic leading-6 text-muted-foreground">
        <span className="block font-medium text-foreground">{address.name}</span>
        <span className="block">{address.line1}</span>
        {address.line2 && <span className="block">{address.line2}</span>}
        <span className="block">
          {[address.city, address.region, address.postalCode].filter(Boolean).join(", ")}
        </span>
        {address.phone && <span className="mt-1 block font-mono">{address.phone}</span>}
      </address>
    </section>
  );
}

/**
 * What this order earned, in the operator's own noun.
 *
 * RENDERS NOTHING UNTIL BOTH HALVES ARE KNOWN. `earnedSince` answers null for
 * "not found yet" rather than zero, and `pointsLabel` answers null rather than
 * inventing a word for the programme — so an unconfigured programme, a lagging
 * ledger and an order that genuinely earned nothing all correctly show no box
 * at all, instead of "You earned 0 points".
 */
function PointsEarned({
  earned,
  balance,
}: {
  earned: number | null;
  balance: PointsBalance | null;
}) {
  const label = pointsLabel(balance, earned ?? 0);
  if (earned === null || earned <= 0 || !label) return null;

  return (
    <p className="mt-6 border-2 border-brand-line bg-brand-soft px-4 py-3 text-sm text-foreground">
      You earned{" "}
      <span className="font-mono font-bold tabular-nums">{earned.toLocaleString()}</span>{" "}
      {label} on this order.
    </p>
  );
}

/**
 * The stops still to come.
 *
 * THE SAME THREE WORDS THE ORDER PAGE USES — `order-progress.tsx`'s stops are
 * Placed, Paid, Packed, Shipped, Delivered, and a shopper reading this page
 * has just cleared the first two. Naming the remaining three identically means
 * the track they meet on `/account/orders/<n>` is recognisably the one this
 * page promised, rather than a second vocabulary for the same journey.
 */
function NextSteps({ city, signedIn }: { city: string | null; signedIn: boolean | null }) {
  const steps = [
    { label: "Packed", body: "We pick your spools and pack them." },
    { label: "Shipped", body: city ? `It leaves us for ${city}.` : "It leaves us for your address." },
    {
      label: "Delivered",
      body: signedIn
        ? "Follow every stop from your orders page."
        : "We'll email you as it moves.",
    },
  ];

  return (
    <section aria-labelledby="receipt-next-heading" className="mt-12">
      <SectionHeading id="receipt-next-heading">What happens next</SectionHeading>
      <ol className="mt-4 grid gap-4 sm:grid-cols-3 sm:gap-6">
        {steps.map((step, index) => (
          <li key={step.label} className="flex gap-3 sm:flex-col sm:gap-2">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-foreground font-mono text-xs font-bold text-foreground"
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{step.label}</p>
              <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
