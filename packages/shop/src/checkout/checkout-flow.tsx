"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { Button, Input, Label, NEO_SURFACE, Skeleton, SkeletonRegion, cn } from "@plaspool/ui";

import { EmptyState } from "../components/empty-state";
import { formatNaira } from "../data/money";
import { getShopCustomer } from "../data/auth-api";
import { majorUnits } from "../data/cart-api";
import { useCart } from "../cart/cart-context";
import {
  createPaymentIntent,
  currentCartRevision,
  freezeCheckout,
  setCheckoutAddress,
  setCheckoutShipping,
  startCheckout,
} from "../data/checkout-api";
import type {
  Address,
  CheckoutError,
  FrozenTotals,
  ShippingOption,
} from "../data/checkout-api";

/**
 * The checkout flow: cart → address → delivery → contact → review → hand-off.
 *
 * ONE CLIENT COMPONENT, FOUR STEPS OF LOCAL STATE, NO ROUTER NAVIGATION
 * BETWEEN THEM. A checkout step that is its own route is a checkout step a
 * back-button can reload into — and the cart, once frozen, does not tolerate
 * being asked to freeze it again for free. Keeping the steps as one page
 * means the sequence in the brief (`start` → `addresses` → `shipping` →
 * `freeze` → `payments/intents`) runs exactly once, forward, or not at all.
 *
 * EVERY WRITE READS THE CART'S REVISION FRESH, IMMEDIATELY BEFORE THE CALL —
 * see `checkout-api.ts`. This is the trap the brief measured three separate
 * ways; the fix here is one function, `currentCartRevision()`, called at the
 * top of every step that needs a `baseRevision`.
 */

type Step = "address" | "delivery" | "contact" | "review";

const STEP_ORDER: Step[] = ["address", "delivery", "contact", "review"];

function StepHeader({ step }: { step: Step }) {
  const labels: Record<Step, string> = {
    address: "Delivery address",
    delivery: "Delivery option",
    contact: "Contact",
    review: "Review and pay",
  };
  const index = STEP_ORDER.indexOf(step);
  return (
    <div className="mb-6">
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Step {index + 1} of {STEP_ORDER.length}
      </p>
      <h1 className="mt-1 font-sans text-2xl font-bold text-foreground">{labels[step]}</h1>
    </div>
  );
}

/** The register from `empty-state.tsx`: what happened, and what to do about
 *  it. Never "Sorry", never vague. */
function errorCopy(error: CheckoutError): { title: string; body: string } {
  switch (error.code) {
    case "empty_cart":
      return { title: "Your cart is empty", body: "Add something to the cart before checking out." };
    case "insufficient_stock":
      return {
        title: "Not enough in stock",
        body: `${error.shortfalls.length} item${error.shortfalls.length === 1 ? "" : "s"} in the cart no longer have enough stock. Go back to the cart and adjust the quantity.`,
      };
    case "no_shipping_address":
      return { title: "No delivery address on file", body: "Enter a delivery address before choosing a delivery option." };
    case "unresolved_lines":
      return { title: "An item in the cart is no longer available", body: "Go back to the cart and remove it, then try again." };
    case "currency_mismatch":
      return { title: "Currency mismatch", body: "The store currency changed mid-checkout. Start again from the cart." };
    case "gone":
      return {
        title: "This checkout has expired",
        body: "The stock held for this order was released. Your cart still has the items — start checkout again.",
      };
    case "bad_revision":
      return { title: "The cart changed elsewhere", body: "Reload and try again — something else updated this cart in the meantime." };
    case "field":
      return {
        title: `Check the ${error.field}`,
        body:
          error.field === "email"
            ? "That email address was refused. Use one the payment provider will accept."
            : `The ${error.field} field was refused. Check it and try again.`,
      };
    case "network":
      return { title: "Couldn't reach the store", body: "Check your connection and try again." };
    default:
      return { title: "That didn't go through", body: "Try again — if it keeps happening, come back later." };
  }
}

function ErrorBanner({
  error,
  action,
}: {
  error: CheckoutError;
  /** A control the customer can actually take, e.g. "gone" sending them back
   *  to the cart. Optional — most errors here are recoverable by trying the
   *  same step again, which the form's own submit already offers. */
  action?: React.ReactNode;
}) {
  const { title, body } = errorCopy(error);
  return (
    <div className="mb-4 flex gap-3 border-2 border-foreground bg-destructive/10 p-4">
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
      <div>
        <p className="font-sans text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 font-sans text-sm text-muted-foreground">{body}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </Label>
      {children}
    </div>
  );
}

const NIGERIA = "NG";

export function CheckoutFlow() {
  const cart = useCart();

  const [step, setStep] = React.useState<Step>("address");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<CheckoutError | null>(null);

  const [address, setAddress] = React.useState<Address>({
    name: "",
    line1: "",
    line2: "",
    city: "",
    region: "",
    postalCode: "",
    countryCode: NIGERIA,
    phone: "",
  });

  const [shippingOptions, setShippingOptions] = React.useState<ShippingOption[]>([]);
  const [selectedShippingId, setSelectedShippingId] = React.useState<string | null>(null);

  const [customerEmail, setCustomerEmail] = React.useState<string | null>(null);
  const [guestEmail, setGuestEmail] = React.useState("");
  const [checkingSession, setCheckingSession] = React.useState(true);

  const [totals, setTotals] = React.useState<FrozenTotals | null>(null);
  const [checkoutId, setCheckoutId] = React.useState<string | null>(null);
  const [redirecting, setRedirecting] = React.useState(false);

  /**
   * Minted ONCE, when the checkout freezes, and reused for every `payNow`
   * attempt after that — never `crypto.randomUUID()` per click.
   *
   * THE SERVER DEDUPES ON THIS KEY, AND DERIVES THE PAYSTACK REFERENCE FROM
   * THE RESULTING INTENT ID. A fresh key per click is not a retry — it is a
   * second live transaction: a new `payment_intents` row, a new provider
   * reference, a second authorization page a customer can genuinely pay on.
   * `checkout-api.ts`'s own header already promised "reusing one on a genuine
   * retry is what stops a double charge" — this is what makes that true.
   *
   * `ckout_<cartId>_<revision>`, NOT JUST `ckout_<cartId>`. The cart id alone
   * is stable for the cart's WHOLE LIFE, but the server's replay fingerprint
   * is `(checkoutId, amount, currency)` (admin `payments/intents.ts`) and a
   * mismatch is a 400, not a replay. A customer who freezes, abandons the
   * review step, comes back, changes the delivery option and re-freezes at a
   * different total would resend the OLD key against a NEW amount — a
   * fingerprint mismatch that leaves them unable to pay at all. The freeze's
   * own revision is what ties the key to the total it was minted for: within
   * one freeze a double-click or a Back-then-retry into a bfcache-restored
   * review step replays the same key and gets back the SAME intent (200,
   * same `authorizationUrl`); a genuinely different amount comes from a new
   * freeze, and therefore a new revision, and therefore a new key the server
   * accepts as a new intent. A stable key stops a double charge; a key that
   * outlives the amount it was minted for would stop a legitimate one.
   *
   * Email stays out of the key on purpose — the server's own fingerprint
   * excludes it, so correcting a refused email and retrying still reaches the
   * provider rather than replaying a request it already rejected.
   */
  const [idempotencyKey, setIdempotencyKey] = React.useState<string | null>(null);
  /** A `useState` guard is not enough on its own — two clicks inside one
   *  render/commit cycle can both read `busy === false` before either write
   *  lands. This ref is set synchronously, inside the click handler, before
   *  anything is awaited. */
  const payingRef = React.useRef(false);

  /**
   * Clears the guard on a bfcache restore, e.g. pressing Back from Paystack
   * onto this exact review step.
   *
   * THIS IS SAFE NOW, AND WAS NOT BEFORE. With the idempotency key stable for
   * this freeze (see `idempotencyKey` above), a Pay now click after a
   * bfcache restore replays the same intent rather than opening a second one
   * — which is the entire point of tying the key to the freeze instead of the
   * click. Leaving the guard permanently set after hand-off would trade a
   * fixed double-charge for a Pay now button that silently does nothing on
   * return, which is a worse failure for being quieter. `event.persisted` is
   * what distinguishes an actual bfcache restore from an ordinary re-render.
   */
  React.useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        payingRef.current = false;
        setRedirecting(false);
      }
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void getShopCustomer().then((customer) => {
      if (cancelled) return;
      setCustomerEmail(customer?.email ?? null);
      setCheckingSession(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const email = customerEmail ?? guestEmail;

  async function submitAddress(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const rev = await currentCartRevision();
      if (!rev) {
        setError({ code: "gone" });
        return;
      }
      /* `/checkout/start` reserves stock for the cart's current lines — it has
         to run before an address means anything, and it is safe to call more
         than once (a second reservation for the same lines simply extends
         nothing extra). */
      const started = await startCheckout();
      if (!started.ok) {
        setError(started.error);
        return;
      }
      const rev2 = await currentCartRevision();
      if (!rev2) {
        setError({ code: "gone" });
        return;
      }
      const result = await setCheckoutAddress(address, rev2.revision);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setShippingOptions(result.data.options);
      setSelectedShippingId(result.data.options[0]?.id ?? null);
      setStep("delivery");
    } finally {
      setBusy(false);
    }
  }

  async function submitDelivery(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedShippingId) return;
    setBusy(true);
    setError(null);
    try {
      const rev = await currentCartRevision();
      if (!rev) {
        setError({ code: "gone" });
        return;
      }
      const result = await setCheckoutShipping(selectedShippingId, rev.revision);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStep("contact");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Freezes the checkout and only then advances to the review step — not a
   * `useEffect` reacting to `step === "review"`, deliberately. Freezing is a
   * write with real consequences (it spends the reservation's one extension),
   * so it happens as a direct result of the contact step's submit rather than
   * as a side effect of a render the freeze itself also causes.
   */
  async function submitContact(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError({ code: "field", field: "email" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const rev = await currentCartRevision();
      if (!rev) {
        setError({ code: "gone" });
        return;
      }
      const result = await freezeCheckout(rev.revision);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTotals(result.data.totals);
      setCheckoutId(rev.cartId);
      /* Minted here, once, from the id that will not change for the rest of
         this checkout attempt — see the field's own doc comment. */
      /* `rev.revision` is the base revision this freeze was submitted
         against — the revision that produced THIS total. See the field's own
         doc comment for why the revision has to be part of the key. */
      setIdempotencyKey(`ckout_${rev.cartId}_${rev.revision}`);
      setStep("review");
    } finally {
      setBusy(false);
    }
  }

  async function payNow() {
    if (!checkoutId || !email || !idempotencyKey) return;
    /* Synchronous, before any `await` — closes the window a `busy` state
       (which only updates on the next render) leaves open between two clicks
       or a click racing a bfcache-restored click. */
    if (payingRef.current) return;
    payingRef.current = true;
    setBusy(true);
    setError(null);
    /* A local flag, not the `redirecting` state — a `finally` block closes
       over the render's stale value of any state variable it did not itself
       just read fresh, and `setRedirecting` does not mutate that closure. */
    let handingOff = false;
    try {
      const result = await createPaymentIntent(checkoutId, email, idempotencyKey);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!result.data.authorizationUrl) {
        setError({ code: "unknown", status: 0, detail: "no_authorization_url" });
        return;
      }
      handingOff = true;
      setRedirecting(true);
      /* The storefront never touches card data — this is a top-level redirect
         to Paystack's own hosted page, not a fetch. */
      window.location.href = result.data.authorizationUrl;
    } finally {
      setBusy(false);
      /* NOT reset here once the hand-off has started — `window.location.href`
         begins an unload, and anything that runs before the browser actually
         navigates away (a second click landing before the navigation commits)
         must still see `payingRef.current === true`. A genuine failure clears
         it immediately so the customer can retry; a bfcache restore clears it
         via the `pageshow` listener above, once the browser is actually back
         on this page rather than mid-navigation away from it. */
      if (!handingOff) payingRef.current = false;
    }
  }

  if (!cart.hydrated) return null;

  if (cart.hydrated && cart.resolved.length === 0 && step !== "review") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<ShieldAlert aria-hidden="true" />}
          title="Your cart is empty"
          body="There is nothing to check out yet. Browse PLA, PETG and TPU by the spool or by the box."
          action={
            <Button asChild className="focus-visible:ring-brand focus-visible:ring-offset-background">
              <Link href="/store">Browse the store</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px] lg:py-16">
      <div>
        <Link
          href="/cart"
          className="mb-6 inline-flex items-center gap-1.5 font-sans text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to cart
        </Link>

        <StepHeader step={step} />
        {error && (
          <ErrorBanner
            error={error}
            action={
              error.code === "gone" ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-2 border-foreground bg-background hover:bg-background"
                >
                  <Link href="/cart">Back to cart</Link>
                </Button>
              ) : undefined
            }
          />
        )}

        {step === "address" && (
          <form onSubmit={submitAddress} className="flex flex-col gap-4">
            <Field id="co-name" label="Full name" required>
              <Input
                id="co-name"
                required
                value={address.name}
                onChange={(e) => setAddress({ ...address, name: e.target.value })}
              />
            </Field>
            <Field id="co-phone" label="Phone">
              <Input
                id="co-phone"
                type="tel"
                value={address.phone ?? ""}
                onChange={(e) => setAddress({ ...address, phone: e.target.value })}
              />
            </Field>
            <Field id="co-line1" label="Address" required>
              <Input
                id="co-line1"
                required
                value={address.line1}
                onChange={(e) => setAddress({ ...address, line1: e.target.value })}
              />
            </Field>
            <Field id="co-line2" label="Apartment, suite, etc.">
              <Input
                id="co-line2"
                value={address.line2 ?? ""}
                onChange={(e) => setAddress({ ...address, line2: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field id="co-city" label="City" required>
                <Input
                  id="co-city"
                  required
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                />
              </Field>
              <Field id="co-region" label="State" required>
                <Input
                  id="co-region"
                  required
                  value={address.region ?? ""}
                  onChange={(e) => setAddress({ ...address, region: e.target.value })}
                />
              </Field>
            </div>
            <Field id="co-postal" label="Postal code">
              <Input
                id="co-postal"
                value={address.postalCode ?? ""}
                onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
              />
            </Field>

            <Button
              type="submit"
              disabled={busy}
              className={cn("mt-2 h-12 text-base", NEO_SURFACE)}
            >
              {busy && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
              Continue to delivery
            </Button>
          </form>
        )}

        {step === "delivery" && (
          <form onSubmit={submitDelivery} className="flex flex-col gap-3">
            {shippingOptions.length === 0 && (
              <p className="font-sans text-sm text-muted-foreground">
                No delivery options reach this address. Go back and check the region.
              </p>
            )}
            {shippingOptions.map((option) => (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer items-center justify-between border-2 border-foreground px-4 py-3",
                  selectedShippingId === option.id ? "bg-brand-soft" : "bg-background",
                )}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="shipping-option"
                    value={option.id}
                    checked={selectedShippingId === option.id}
                    onChange={() => setSelectedShippingId(option.id)}
                    className="h-4 w-4 accent-brand"
                  />
                  <span className="font-sans text-sm font-medium text-foreground">
                    {option.label}
                  </span>
                </span>
                <span className="font-mono text-sm tabular-nums text-foreground">
                  {formatNaira(majorUnits(option.amount))}
                </span>
              </label>
            ))}
            <Button
              type="submit"
              disabled={busy || !selectedShippingId}
              className={cn("mt-2 h-12 text-base", NEO_SURFACE)}
            >
              {busy && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
              Continue to contact
            </Button>
          </form>
        )}

        {step === "contact" && (
          <form onSubmit={submitContact} className="flex flex-col gap-4">
            {checkingSession ? (
              /* The signed-in box is what usually resolves here, so the wait is
                 drawn as that box rather than as a sentence — the field swaps in
                 at the same height when the session comes back a guest. See
                 `CLAUDE.md`, "Loading states — skeletons, never prose". */
              <SkeletonRegion label="Checking your account" className="border border-brand-line px-4 py-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-1.5 h-4 w-48" />
              </SkeletonRegion>
            ) : customerEmail ? (
              <div className="border-2 border-foreground bg-brand-soft px-4 py-3">
                <p className="font-sans text-xs text-muted-foreground">Signed in as</p>
                <p className="font-sans text-sm font-semibold text-foreground">{customerEmail}</p>
              </div>
            ) : (
              <Field id="co-email" label="Email" required>
                <Input
                  id="co-email"
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="you@example.com"
                />
                <p className="mt-1 font-sans text-xs text-muted-foreground">
                  Your receipt and order access go to this address.
                </p>
              </Field>
            )}
            <Button
              type="submit"
              disabled={busy || !email}
              className={cn("mt-2 h-12 text-base", NEO_SURFACE)}
            >
              Continue to review
            </Button>
          </form>
        )}

        {step === "review" && (
          <div className="flex flex-col gap-4">
            {busy && !totals && (
              <p className="flex items-center gap-2 font-sans text-sm text-muted-foreground">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Locking in your total…
              </p>
            )}
            {totals && (
              <>
                <div className="border-2 border-foreground p-4">
                  <p className="font-sans text-sm font-semibold text-foreground">Deliver to</p>
                  <p className="mt-1 font-sans text-sm text-muted-foreground">
                    {address.name}, {address.line1}
                    {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.region}{" "}
                    {address.postalCode}
                  </p>
                  <p className="mt-2 font-sans text-sm text-muted-foreground">{email}</p>
                </div>

                <div className="border-2 border-foreground p-4">
                  <div className="flex items-center justify-between py-1">
                    <span className="font-sans text-sm text-muted-foreground">Subtotal</span>
                    <span className="font-mono text-sm tabular-nums text-foreground">
                      {formatNaira(majorUnits(totals.subtotal))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="font-sans text-sm text-muted-foreground">Delivery</span>
                    <span className="font-mono text-sm tabular-nums text-foreground">
                      {formatNaira(majorUnits(totals.shippingTotal))}
                    </span>
                  </div>
                  {totals.taxTotal.amount > 0 && (
                    <div className="flex items-center justify-between py-1">
                      <span className="font-sans text-sm text-muted-foreground">Tax</span>
                      <span className="font-mono text-sm tabular-nums text-foreground">
                        {formatNaira(majorUnits(totals.taxTotal))}
                      </span>
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-between border-t border-brand-line pt-2">
                    <span className="font-sans text-base font-semibold text-foreground">
                      Total
                    </span>
                    <span className="font-mono text-base font-bold tabular-nums text-foreground">
                      {formatNaira(majorUnits(totals.grandTotal))}
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={payNow}
                  disabled={busy || redirecting || error?.code === "gone"}
                  className={cn("h-12 text-base", NEO_SURFACE)}
                >
                  {(busy || redirecting) && (
                    <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {redirecting ? "Taking you to payment…" : "Pay now"}
                </Button>
                <p className="text-center font-sans text-xs text-muted-foreground">
                  {"The store never sees your card. You'll pay on Paystack's own page."}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-24 border-2 border-foreground p-4">
          <p className="font-sans text-sm font-semibold text-foreground">In your cart</p>
          <ul className="mt-3 flex flex-col gap-3">
            {cart.resolved.map((line) => (
              <li key={line.key} className="flex justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-sans text-muted-foreground">
                  {line.product.name} × {line.qty}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-foreground">
                  {formatNaira(line.total)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-brand-line pt-3">
            <span className="font-sans text-sm text-muted-foreground">Subtotal</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {formatNaira(cart.subtotal)}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
