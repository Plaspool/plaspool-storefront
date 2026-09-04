"use client";

import * as React from "react";
import { Link } from "../components/link";
import { AlertTriangle, ArrowLeft, LifeBuoy, Loader2, ShieldAlert } from "lucide-react";
import { Button, Input, Label, Skeleton, SkeletonRegion, cn } from "@plaspool/ui";

import { EmptyState } from "../components/empty-state";
import { formatNaira } from "../data/money";
import { readShopSession } from "../data/auth-api";
import { listSavedAddresses, type SavedAddress } from "../data/orders-api";
import { listServiceAreas, type ServiceArea } from "../data/returns-api";
import { BLANK_ADDRESS, NEW_ADDRESS, keyOfSaved, readSavedAddress } from "./saved-address";
import {
  DISTRICT_FALLBACK,
  readDeliveryConfig,
  type AddressMode,
  type DeliveryConfig,
  type DeliveryField,
  type FieldKey,
} from "../data/delivery-config";
import {
  districtChoicesFor,
  effectiveDistrict as districtToSubmit,
  fieldPatch,
  fieldRows,
  fieldValue,
  submittedAddress,
  wantsServiceAreas,
} from "./address-fields";
import { LocationCapture } from "./location-capture";
import { errorCopy } from "./checkout-error-copy";
import { saveReceiptSnapshot } from "./receipt-snapshot";
import { getPointsBalance } from "../data/points-api";
import type { PointsBalance } from "../data/points-api";
import { PointsOffer } from "./points-offer";
import { majorUnits } from "../data/cart-api";
import { useCart } from "../cart/cart-context";
import {
  createPaymentIntent,
  currentCartRevision,
  cancelCheckout,
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
      <h1 className="mt-1 text-2xl font-bold text-foreground">{labels[step]}</h1>
    </div>
  );
}



function ErrorBanner({
  error,
  action,
  mode,
}: {
  error: CheckoutError;
  mode?: AddressMode;
  /** A control the customer can actually take, e.g. "gone" sending them back
   *  to the cart. Optional — most errors here are recoverable by trying the
   *  same step again, which the form's own submit already offers. */
  action?: React.ReactNode;
}) {
  const { title, body } = errorCopy(error, mode);
  /* Only the two codes that carry one. `errorCopy` decides its wording from
     the same value, so the sentence and the line under it cannot disagree. */
  const reference = "requestId" in error ? error.requestId : null;
  return (
    /* `bg-destructive/10` stays on the BASE token — a tint is a fill, which is
       what that token is tuned for. Only the glyph moves: an icon owes 3:1 and
       passed either way, but it should not be a different red from the failure
       text everywhere else in the shop. */
    <div className="mb-4 flex gap-3 border-2 border-foreground bg-destructive/10 p-4">
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-destructive-strong" />
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
        {/* ═══ THE ONE THING THAT MAKES A REPORT ANSWERABLE ═══
            The API stamps every error with a `requestId` and logs the detail
            it will not put in a response — the stack, the SQLSTATE — beside
            the same string. Rendered, it is the difference between "checkout
            didn't work yesterday" and a line somebody can grep for. Selectable
            and monospaced because it exists to be copied, and `select-all` so
            one tap on a phone takes all of it and none of the words around it,
            which is where this failure was photographed. */}
        {reference && (
          <p className="mt-2 select-all font-mono text-xs text-muted-foreground">
            Reference: {reference}
          </p>
        )}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

/** Classed to match `Input` exactly — the same string `return-form.tsx` keeps
 *  for its native selects, for the same reason: the select sits among Inputs
 *  in one form and must read as family, not as a browser default beside them. */
/**
 * How long a delivery config is trusted before the address step re-reads it.
 *
 * MATCHES THE ENDPOINT'S OWN `s-maxage`. A shopper who reaches the delivery
 * step and comes back inside a minute is holding what the CDN would hand back
 * anyway, so the re-read is skipped; past it the mode may genuinely have
 * moved and the form has to catch up (§6.5).
 */
const CONFIG_REREAD_MS = 60_000;

/** One shared empty list, so "no areas" keeps a stable identity across
 *  renders and does not re-run everything memoised on it. */
const NO_AREAS: ServiceArea[] = [];

/**
 * The DOM ids this form has always used.
 *
 * A MAP RATHER THAN A TEMPLATE OVER THE KEY, because `postalCode` is
 * `co-postal` — the ids are what a browser's saved autofill and anything
 * already pointing at them keys on, and deriving them would silently rename
 * one.
 */
const FIELD_IDS: Record<FieldKey, string> = {
  name: "co-name",
  phone: "co-phone",
  line1: "co-line1",
  line2: "co-line2",
  city: "co-city",
  region: "co-region",
  district: "co-district",
  postalCode: "co-postal",
};

const NATIVE_SELECT_CLASSES =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

/**
 * The delivery country.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A CONTROL ONLY WHEN THE SERVER UNLOCKS ONE, AND THE LIST IS ALWAYS THE
 * SERVER'S.
 *
 * `country.locked` is true today, which is the shop as it is: it ships from
 * and within Nigeria, so the country is a fact rather than a question, and it
 * renders as fixed text. That is what the form has always shown — the field
 * did not exist as a control and this does not add one.
 *
 * When international selling is switched on the admin sets `locked: false` and
 * fills `country.allowed`. THE STOREFRONT NEVER SPELLS THAT LIST. A hardcoded
 * set of countries is a second, stale answer to a question the delivery config
 * already answers, and the first thing it does when it drifts is offer to ship
 * somewhere the shop has no zone for — which prices at the catch-all and
 * quotes a delivery fee nobody can honour.
 *
 * ═══ CHANGING IT CAN HIDE THE DISTRICT PICKER, AND THAT IS THE POINT ═══
 * Districts are Nigerian. `fieldRows` reads the address, so selecting anywhere
 * else removes the picker in the same render, and `submittedAddress` omits the
 * key from the body rather than sending an empty one. See `districtsApply`.
 * ═══════════════════════════════════════════════════════════════════════════
 */
function CountryField({
  config,
  value,
  onChange,
}: {
  config: DeliveryConfig;
  value: string;
  onChange: (countryCode: string) => void;
}) {
  const id = "checkout-country";
  const current = (value || config.country.default).toUpperCase();

  /* LOCKED IS NOT A DISABLED SELECT. A greyed-out control invites a shopper to
     try to change something they cannot, and a disabled form field is skipped
     by keyboard navigation while still taking up a tab stop's worth of
     attention. One country is a statement, so it is written as one. */
  if (config.country.locked || config.country.allowed.length < 2) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>Country</Label>
        <p id={id} className="text-sm text-muted-foreground">
          {countryName(current)}
        </p>
      </div>
    );
  }

  return (
    <Field id={id} label="Country" required>
      <select
        id={id}
        required
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className={NATIVE_SELECT_CLASSES}
      >
        {config.country.allowed.map((code) => (
          <option key={code} value={code}>
            {countryName(code)}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * An ISO-3166-1 alpha-2 code as a name.
 *
 * `Intl.DisplayNames` where the runtime has it, the CODE ITSELF where it does
 * not — never a hand-written table. A table would be one more list to drift
 * from `country.allowed`, and it would be wrong in a different way from the
 * server rather than merely terse. A bare "GB" beside a country selector is
 * understandable; "United Kingdom" spelled by a storefront that also thinks
 * "NG" is "Nigeria (FCT)" is not.
 *
 * WRAPPED, because `Intl.DisplayNames` is absent on some small-ICU builds and
 * throws for an unknown code on others. This runs in the browser, but the
 * component renders on the server first.
 */
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function Field({
  id,
  label,
  required,
  help,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  /** The config's own wording for what this field wants — "House number,
   *  street, and the nearest landmark." Wired to the input by
   *  `aria-describedby` rather than left as loose text near it. */
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </Label>
      {children}
      {help && (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
    </div>
  );
}


export function CheckoutFlow() {
  const cart = useCart();

  const [step, setStep] = React.useState<Step>("address");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<CheckoutError | null>(null);

  /**
   * Whether the API is currently refusing this cart for trying too often.
   *
   * ═══ THE BUTTON HAS TO STOP, NOT JUST THE SENTENCE ═══
   * The old banner's advice — "try again" — is what spends the ten attempts
   * `/checkout/start` allows per cart per fifteen minutes, and a shopper who
   * has just been told to wait is still looking at a live submit button. Copy
   * that says one thing while the control invites the opposite is copy nobody
   * believes; so the control agrees with it.
   *
   * ONE TIMEOUT, NOT A TICKING CLOCK. The banner names the wait in words, so
   * nothing on screen counts down and nothing needs to re-render every second
   * to stay true. The timer's only job is to hand the button back.
   */
  const [retryUntil, setRetryUntil] = React.useState<number | null>(null);
  const rateLimited = retryUntil !== null;
  /**
   * ═══ EVERY ERROR DECIDES THE HOLD, SO IT CANNOT BE LEFT STANDING ═══
   * Written first as "set a flag on rate_limited, clear it on a timer", which
   * had a dead-checkout bug in it: the timer lived in an effect keyed on
   * `error`, so an error arriving after a rate limit cancelled the pending
   * timeout and then declined to replace it, leaving every submit disabled
   * until a reload. Deciding it HERE — where all five error paths already
   * converge, one branch, no effect — removes the state that could go stale
   * rather than patching what clears it.
   *
   * `retryAfter` is seconds and can be absent; a minute is the smallest honest
   * guess when the API named nothing, and the shopper is never held longer
   * than the window they were actually told about.
   */
  const applyError = React.useCallback((next: CheckoutError) => {
    setError(next);
    setRetryUntil(
      next.code === "rate_limited" ? Date.now() + (next.retryAfter ?? 60) * 1000 : null,
    );
  }, []);
  /* The timer's only job is handing the button back; the banner names the wait
     in words, so nothing on screen counts down and nothing re-renders while it
     runs. */
  React.useEffect(() => {
    if (retryUntil === null) return;
    const timer = setTimeout(() => setRetryUntil(null), Math.max(0, retryUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [retryUntil]);

  const [address, setAddress] = React.useState<Address>(BLANK_ADDRESS);

  /**
   * ═══ THE SHOP'S OWN DESCRIPTION OF THIS FORM ═══
   * Whether the shop asks for a district at all is an admin setting, so the
   * fields, their order, their labels and their limits all come from
   * `GET /api/public/shop/delivery-config` rather than from JSX here.
   *
   * IT STARTS AT `DISTRICT_FALLBACK`, WHICH IS TODAY'S FORM. The first paint
   * is therefore the form the shop has always had, and it stays that way if
   * the config never arrives — failing toward the RICHER form is the safe
   * direction, because the district form asks for a superset of what simple
   * mode asks for. On `localhost` this is always what happens: the commerce
   * API sends no CORS header for that origin.
   */
  const [config, setConfig] = React.useState<DeliveryConfig>(DISTRICT_FALLBACK);
  const configReadAt = React.useRef(0);
  React.useEffect(() => {
    /* READ WHEN THE ADDRESS STEP MOUNTS, NOT ONCE AT BOOT — and read again if
       the shopper comes back to it later, because the mode may have moved
       while they were on the delivery step. The window matches the
       endpoint's own `s-maxage`, so a re-entry inside it costs nothing. */
    if (step !== "address") return;
    if (configReadAt.current && Date.now() - configReadAt.current < CONFIG_REREAD_MS) return;

    let cancelled = false;
    void readDeliveryConfig().then((next) => {
      if (cancelled) return;
      configReadAt.current = Date.now();
      setConfig(next);
    });
    return () => {
      cancelled = true;
    };
  }, [step]);

  /**
   * The served districts, for the district picker under the State field.
   * Districts are where per-district delivery pricing keys from: the picker
   * submits `ServiceArea.key`, the API prices delivery by it, and a
   * switched-off district is refused with `outside_delivery_area`.
   *
   * NOT FETCHED AT ALL UNDER `simple` (§6.1) — there is no picker to fill, so
   * the round trip buys nothing.
   *
   * PUBLIC AND COOKIELESS, fetched for guests and customers alike — and an
   * empty list (fetch failed, or nothing served) renders NO picker rather
   * than a dead control.
   */
  const [fetchedAreas, setFetchedAreas] = React.useState<ServiceArea[]>([]);
  React.useEffect(() => {
    if (!wantsServiceAreas(config)) return;
    let cancelled = false;
    void listServiceAreas().then((areas) => {
      /* Filtered HERE, at the fetch, so `serviceAreas.length` stays a
         trustworthy "have the areas loaded?" signal — which is what the stale
         district guard reads. */
      if (!cancelled && areas) setFetchedAreas(areas.filter((area) => area.key));
    });
    return () => {
      cancelled = true;
    };
  }, [config]);

  /**
   * Empty under `simple`, whatever was fetched before the flip.
   *
   * DERIVED DURING RENDER RATHER THAN CLEARED BY AN EFFECT — the same rule
   * `effectiveDistrict` below follows, and for the same reason. An effect
   * that cleared the list would leave a committed render in which the old
   * areas were still live, which is a render where a district picker the mode
   * no longer wants is still on screen and still pricing.
   */
  const serviceAreas = React.useMemo(
    () => (wantsServiceAreas(config) ? fetchedAreas : NO_AREAS),
    [config, fetchedAreas],
  );

  const [shippingOptions, setShippingOptions] = React.useState<ShippingOption[]>([]);
  const [selectedShippingId, setSelectedShippingId] = React.useState<string | null>(null);

  const [customerEmail, setCustomerEmail] = React.useState<string | null>(null);
  const [guestEmail, setGuestEmail] = React.useState("");
  const [checkingSession, setCheckingSession] = React.useState(true);

  /**
   * Addresses this customer has already had something delivered to.
   *
   * ═══ THE ADDRESS STEP USED TO OPEN ON AN EMPTY FORM, EVERY TIME ═══
   * `shop_addresses` is keyed on the cart and snapshotted onto the order, so
   * nothing survived a checkout that a later one could offer — a returning
   * shopper retyped name, phone, two lines, city and state on every order, even
   * signed in and shipping to the same place as last time.
   *
   * EMPTY FOR A GUEST, and the form below is unchanged for them. Guest checkout
   * is this shop's default path and must not turn into an account wall: an
   * empty list renders exactly what was there before.
   */
  /* PARSED, NOT RAW. The list was gated and preselected off the raw array but
     rendered off the readable subset, so the three disagreed: an unreadable
     most-recent entry preselected nothing while readable older ones sat listed
     below it, and a list where every entry was unreadable rendered a "Deliver
     to" group whose only member was "Somewhere else" — an alternative to
     nothing. One array, already filtered, decides all three. */
  const [savedAddresses, setSavedAddresses] = React.useState<Address[]>([]);
  /** Which saved address is selected, or `NEW_ADDRESS` for the blank form. */
  const [chosenAddress, setChosenAddress] = React.useState<string>(NEW_ADDRESS);
  /**
   * Whether the shopper has typed into the address form.
   *
   * ═══ THE PRESELECTION MUST NEVER OVERWRITE WHAT SOMEBODY IS TYPING ═══
   * The form is interactive on first paint; the saved list is two sequential
   * round trips behind it (`/customer/me`, then `/orders/addresses`). Filling
   * it unconditionally meant that on a slow connection the fields a shopper had
   * already filled in were silently replaced — and, if the response landed
   * during `submitAddress`'s awaits, the API received the TYPED address while
   * the review panel went on to display the SAVED one. The parcel and the page
   * would have disagreed about where it was going.
   */
  const [addressTouched, setAddressTouched] = React.useState(false);
  /* The fetch callback closes over its render's state, and the shopper types
     after that render — so the guard has to read a live value. */
  const touchedRef = React.useRef(false);
  const touchAddress = React.useCallback(() => {
    touchedRef.current = true;
    setAddressTouched(true);
  }, []);

  /** Every field edit goes through here: it merges the change, marks the form
   *  touched, and drops any claim that this is still a saved address. */
  const editAddress = React.useCallback((patch: Partial<Address>) => {
    touchAddress();
    setChosenAddress(NEW_ADDRESS);
    setAddress((current) => ({ ...current, ...patch }));
  }, [touchAddress]);

  /** The districts filed under the typed State — the picker's options. The
   *  State field is free text, so this is a loose match; a state that matches
   *  nothing simply renders no picker, and the address prices at the zone. */
  const districtChoices = React.useMemo(
    () => districtChoicesFor(serviceAreas, address.region),
    [serviceAreas, address.region],
  );

  /** The rows the form draws: the config's visible fields, in the config's
   *  order, with City and State paired as they are on screen today. */
  const rows = React.useMemo(
    /* `address` so the district row disappears the moment a shopper selects a
       country districts do not apply to — see `districtsApply`. */
    () => fieldRows(config, districtChoices, address),
    [config, districtChoices, address],
  );

  /**
   * ═══ WHAT IS SENT MUST BE WHAT IS SHOWN ═══
   * The district can arrive from outside the picker — a saved address's
   * snapshot, or a State edit that orphans the chosen key under a different
   * state. A key the picker no longer offers would render as "(none)" while
   * still riding the submit, so the parcel and the page would disagree about
   * the delivery price. Dropped silently instead: null is always safe — it
   * means the state's zone rate.
   *
   * ONLY once the areas have actually loaded: an empty list is the fetch
   * failing, not the district being wrong, and stripping a saved address's
   * district because the network hiccuped would quietly change its price.
   *
   * DERIVED DURING RENDER, not stored and then corrected by an effect. The
   * effect this replaces wrote the correction in a second pass, so there was
   * always a committed render in which the orphaned key was still live.
   * Deriving it means the picker, the review line and the submit all read ONE
   * expression and cannot disagree — and it is reversible, so undoing a
   * mistyped State brings the district back rather than making the shopper
   * choose it again.
   */
  const effectiveDistrict = districtToSubmit(address, config, serviceAreas, districtChoices);

  /** What the submit sends: the fields this config actually asked for, with
   *  the district that is actually on screen and never an orphaned key still
   *  sitting in state. */
  const effectiveAddress: Address = submittedAddress(address, config, serviceAreas);

  /** For the review step: the district's display name, never its key. */
  const districtName = effectiveDistrict
    ? serviceAreas.find((area) => area.key === effectiveDistrict)?.name ?? null
    : null;

  /**
   * The customer's points balance, and how many of them they have chosen to
   * spend. Both null/0 for a guest, for a shop with redemption switched off,
   * and for a points service having a bad day — `getPointsBalance()` answers
   * null for every one of those, and the widget simply does not appear.
   *
   * `redeemPoints` IS THE OPT-IN. It starts at 0 and only a deliberate act
   * moves it: the API reads an absent value as "spend as much as the rules
   * allow", so a widget that pre-filled the maximum would spend a balance the
   * customer never agreed to spend.
   */
  const [pointsBalance, setPointsBalance] = React.useState<PointsBalance | null>(null);
  const [redeemPoints, setRedeemPoints] = React.useState(0);

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
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * THAWING A CHECKOUT THE SHOPPER WALKED AWAY FROM.
   *
   * Freezing sends the cart to `converting`, and until the admin shipped
   * `POST /checkout/cancel` NOTHING could bring it back. A shopper who reached
   * Paystack and did not pay — declined card, closed the tab, changed their
   * mind about the address — got `409 precondition_failed` from every later
   * address or shipping edit, permanently, and the cart cookie kept resolving
   * to the same dead basket. The journey `idempotencyKey` above describes
   * ("abandons the review step, comes back, changes the delivery option and
   * re-freezes at a different total") was written against an API that could
   * not perform it. This is what makes it real.
   *
   * ═══ THE TOTALS GO WITH IT, AND THAT IS THE POINT, NOT A SIDE EFFECT ═══
   * A thaw CLEARS the frozen totals server-side: `/checkout/totals` and
   * `/payments/intents` both 404 until a fresh `freezeCheckout`. So the cached
   * `FrozenTotals` here are, from this moment, a number on screen that nothing
   * will honour — and a Pay button over a 404ing intent route is the worst
   * version of this bug, not a smaller one. They are dropped, and
   * `idempotencyKey` with them: the key is minted per freeze/revision, so the
   * next freeze must mint its own.
   *
   * ═══ `checkout_paid` IS NOT AN ERROR TO SWALLOW ═══
   * A capture whose inline completion failed leaves a genuinely PAID cart at
   * `converting`, indistinguishable from a stuck one. The API refuses to thaw
   * it and is right to. Surfaced through `applyError` like any other refusal —
   * its copy says the payment worked and sends the shopper to their orders —
   * and the totals are LEFT ON SCREEN in that one case, because they are the
   * totals that were actually charged. Only the ability to pay again is taken
   * away.
   * ═══════════════════════════════════════════════════════════════════════════
   */
  const thawCheckout = React.useCallback(async (): Promise<boolean> => {
    const result = await cancelCheckout();
    if (!result.ok && result.error.code === "checkout_paid") {
      applyError(result.error);
      /* The key, and only the key. Killing `payNow` is the whole remedy here;
         the total stays because it is the one that was charged. */
      setIdempotencyKey(null);
      return false;
    }
    /* ═══ FAIL CLOSED ON EVERY OTHER REFUSAL ═══
       A network failure or a 500 leaves the cart's state UNKNOWN, not known-
       frozen. Keeping the totals on the optimistic reading would leave a Pay
       button over an intent route that may already 404. Dropping them costs a
       re-freeze the shopper was about to do anyway; keeping them costs a dead
       button at the moment of payment. The refusal itself is deliberately not
       surfaced — the shopper did not ask for this call and has nothing to do
       about it, and the step they land on re-freezes on its own submit. */
    setTotals(null);
    setIdempotencyKey(null);
    return result.ok;
  }, [applyError]);

  /**
   * Whether there is a live freeze that an unload would strand.
   *
   * A REF, NOT A DEPENDENCY. The `pagehide` listener below must not be torn
   * down and rebuilt on every render, and it must not close over a `step` from
   * whichever render happened to bind it.
   */
  const frozenRef = React.useRef(false);
  React.useEffect(() => {
    frozenRef.current = step === "review" && totals !== null;
  }, [step, totals]);

  /**
   * Back from Paystack, onto this exact review step.
   *
   * CLEARING THE GUARD IS SAFE, AND WAS NOT ALWAYS. With the idempotency key
   * stable for this freeze (see `idempotencyKey` above), a Pay now click after
   * a bfcache restore replays the same intent rather than opening a second one.
   * Leaving the guard permanently set after hand-off would trade a fixed
   * double-charge for a Pay now button that silently does nothing on return,
   * which is a worse failure for being quieter. `event.persisted` is what
   * distinguishes an actual bfcache restore from an ordinary re-render.
   *
   * ═══ AND THIS IS THE HIGHEST-VALUE PLACE TO THAW ═══
   * The shopper is demonstrably back and demonstrably has not paid — the whole
   * ambiguity that makes the other call sites cautious is absent here. The
   * `pagehide` handler below deliberately skips the Paystack hand-off (see its
   * own comment), so this is the only thing that unfreezes that journey; the
   * two are complements, not belt-and-braces.
   *
   * LANDS ON THE CONTACT STEP, because that step's submit IS the re-freeze.
   * Staying on `review` with no totals renders a step with nothing in it, and
   * inventing a "get a new total" button here would be a second way to do what
   * `submitContact` already does. Everything the shopper typed is still in
   * state, so this is one click from a fresh total.
   */
  React.useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      payingRef.current = false;
      setRedirecting(false);
      if (!frozenRef.current) return;
      void thawCheckout().then((thawed) => {
        /* Only on a real thaw. A `checkout_paid` refusal must leave the
           shopper on the screen showing the banner that explains it, not walk
           them back into a flow that would re-charge them. */
        if (thawed) setStep("contact");
      });
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [thawCheckout]);

  /**
   * The tab closing, or any navigation off this page, with a total still
   * frozen.
   *
   * ═══ THE ONLY PATH THAT COVERS "CLOSED THE TAB" ═══
   * The API's implicit thaw — `PUT /checkout/addresses` and
   * `/checkout/shipping` now unfreeze before they write — cannot see this one,
   * because no request is ever made. Without this, closing the tab on the
   * review step is still a permanently dead cart.
   *
   * ═══ `pagehide`, NOT `visibilitychange` ═══
   * `visibilitychange` → hidden fires on every tab switch, so thawing there
   * would release the total of anyone who alt-tabs away to read their card
   * number and comes back — the exact shopper this feature is for.
   * `pagehide` fires on close and on navigation away, and not on a tab
   * switch. It is also the one that fires reliably on mobile, where
   * `beforeunload` frequently never runs at all.
   *
   * ═══ IT MUST NOT FIRE ON THE WAY TO PAYSTACK ═══
   * `payNow` ends in `window.location.href = authorizationUrl`, which is a
   * navigation, which is a `pagehide`. Cancelling there would thaw the cart in
   * the same breath as sending the shopper to pay for it — the worst bug this
   * change could introduce. `payingRef` is already set synchronously before
   * that redirect and deliberately NOT cleared once the hand-off starts, so it
   * is exactly the signal needed. Coming back from Paystack is then the
   * `pageshow` handler's job, above.
   *
   * `keepalive`, because the document is going away and an ordinary fetch is
   * cancelled with it. Not awaited and not error-checked: there is no one left
   * to tell, and `cancelCheckout` is idempotent, so the worst case is the next
   * address edit thawing it implicitly instead.
   */
  React.useEffect(() => {
    function onPageHide() {
      if (!frozenRef.current || payingRef.current) return;
      void cancelCheckout(undefined, { keepalive: true });
    }
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void readShopSession().then((result) => {
      if (cancelled) return;
      /* `readShopSession` rather than `getShopCustomer`: the latter collapses a
         transport failure into "guest", which here silently costs a signed-in
         shopper their saved addresses and their points balance and makes them
         retype an address the shop already holds. */
      const customer = result.kind === "customer" ? result.customer : null;
      setCustomerEmail(customer?.email ?? null);
      setCheckingSession(false);
      /*
       * ONLY FOR A SIGNED-IN CUSTOMER, and that is a constraint rather than a
       * choice. Balances are keyed by email address, and the API cannot look one
       * up for a guest at the moment the total is frozen — the cart's email is
       * not written until the payment step, which runs after the freeze. So a
       * guest has no balance to offer, and asking would be a guaranteed 401.
       */
      if (!customer?.email) return;
      void getPointsBalance().then((balance) => {
        if (!cancelled) setPointsBalance(balance);
      });
      void listSavedAddresses().then((saved) => {
        if (cancelled) return;
        const usable = saved
          .map(readSavedAddress)
          .filter((a): a is Address => a !== null);
        if (usable.length === 0) return;
        setSavedAddresses(usable);
        /* PRESELECTED, because the commonest thing a returning shopper wants is
           the address they used last — and a list where nothing is chosen makes
           them do the work of choosing before they can do the work of checking
           out. Selecting also fills the form, so "continue" is one click.

           ONLY INTO A FORM NOBODY HAS TOUCHED. `setAddressTouched` is the guard;
           a shopper who started typing before this landed keeps what they typed
           and the list stays available above it, unselected. */
        setAddress((current) => {
          if (touchedRef.current) return current;
          setChosenAddress(keyOfSaved(0));
          return usable[0];
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const email = customerEmail ?? guestEmail;

  /**
   * One configured field as a control.
   *
   * EVERY ATTRIBUTE COMES FROM THE CONFIG except the input's `type`, which is
   * a property of the KEY rather than of the shop's policy — a phone field is
   * `tel` wherever it appears.
   *
   * `maxLength` IS THE SERVER'S OWN LIMIT. It 400s past it, so the input stops
   * the shopper there rather than letting them type into a refusal.
   */
  const renderField = (field: DeliveryField) => {
    const id = FIELD_IDS[field.key];
    const describedBy = field.help ? `${id}-help` : undefined;

    if (field.key === "district") {
      /* "a district" / "an area" — the label is the shop's word, so the
         article has to agree with whatever that word turns out to be. */
      const article = /^[aeiou]/i.test(field.label) ? "an" : "a";
      const noun = field.label.toLowerCase();
      return (
        <Field
          key={field.key}
          id={id}
          label={field.label}
          required={field.required}
          help={field.help}
        >
          {/* ONLY WHERE IT MEANS SOMETHING: `fieldRows` drops this field
              entirely when the typed State has no served areas, whatever the
              config says about `required` — a picker with no options reads as
              a broken required field. Choosing one prices delivery for that
              district; leaving it is the state's standard rate. */}
          <select
            id={id}
            required={field.required}
            aria-describedby={describedBy}
            value={effectiveDistrict ?? ""}
            onChange={(e) => editAddress(fieldPatch("district", e.target.value))}
            className={NATIVE_SELECT_CLASSES}
          >
            <option value="">
              {field.required
                ? `Choose ${article} ${noun}`
                : `Choose ${article} ${noun} (optional)`}
            </option>
            {districtChoices.map((area) => (
              <option key={area.id} value={area.key}>
                {area.name}
              </option>
            ))}
          </select>
        </Field>
      );
    }

    return (
      <Field
        key={field.key}
        id={id}
        label={field.label}
        required={field.required}
        help={field.help}
      >
        <Input
          id={id}
          type={field.key === "phone" ? "tel" : "text"}
          required={field.required}
          maxLength={field.maxLength}
          autoComplete={field.autocomplete}
          aria-describedby={describedBy}
          value={fieldValue(address, field.key, effectiveDistrict)}
          onChange={(e) => editAddress(fieldPatch(field.key, e.target.value))}
        />
      </Field>
    );
  };

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
        applyError(started.error);
        return;
      }
      const rev2 = await currentCartRevision();
      if (!rev2) {
        setError({ code: "gone" });
        return;
      }
      const result = await setCheckoutAddress(effectiveAddress, rev2.revision);
      if (!result.ok) {
        applyError(result.error);
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
        applyError(result.error);
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
      const result = await freezeCheckout(rev.revision, redeemPoints);
      if (!result.ok) {
        applyError(result.error);
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
        applyError(result.error);
        return;
      }
      if (!result.data.authorizationUrl) {
        setError({ code: "unknown", status: 0, detail: "no_authorization_url", requestId: null });
        return;
      }
      /* ═══ THE RECEIPT, WRITTEN DOWN BEFORE WE LEAVE ═══
         `/checkout/complete` comes back with a `reference` and nothing else —
         no lines, no address, no breakdown — and there is no join from a
         payment intent to an order, so it cannot fetch any of that either.
         See `receipt-snapshot.ts`. This is the only moment the whole receipt
         is in one place, so it is the moment to record it.

         AFTER the intent exists, because the snapshot is keyed to its id: a
         second attempt in this tab must not read the first attempt's basket.
         Deliberately not awaited or error-checked — `saveReceiptSnapshot`
         swallows its own failures, and nothing here may stand between the
         shopper and the payment page. */
      saveReceiptSnapshot({
        v: 1,
        intentId: result.data.id,
        startedAt: Date.now(),
        email,
        currency: totals?.currency ?? result.data.currency,
        lines: cart.resolved.map((line) => ({
          variantId: line.product.variantIds[`${line.colour.id}:${line.size.id}`] ?? "",
          title: line.product.name,
          colour: line.colour.name,
          size: line.size.label,
          qty: line.qty,
          unitPrice: line.unitPrice,
          effectiveUnitPrice: line.effectiveUnitPrice,
          bulkPercentBps: line.bulkPercentBps,
          lineTotal: line.total,
        })),
        /* `effectiveAddress`, for the reason the review line above gives:
           the receipt must record the address the shop was actually given,
           not whatever is left in the form's state. */
        address: {
          name: effectiveAddress.name,
          line1: effectiveAddress.line1,
          line2: effectiveAddress.line2 ?? null,
          city: effectiveAddress.city,
          region: effectiveAddress.region ?? null,
          postalCode: effectiveAddress.postalCode ?? null,
          countryCode: effectiveAddress.countryCode,
          phone: effectiveAddress.phone ?? null,
        },
        totals: {
          subtotal: totals?.subtotal.amount ?? 0,
          shippingTotal: totals?.shippingTotal.amount ?? 0,
          taxTotal: totals?.taxTotal.amount ?? 0,
          adjustmentTotal: totals?.adjustmentTotal.amount ?? 0,
          grandTotal: totals?.grandTotal.amount ?? result.data.amount,
          shippingLabel: totals?.shipping?.label ?? null,
          /* The API's own wording, never a noun invented here — see
             `FrozenTotals["tax"]`. Absent means the shop was not registered
             when this total was frozen, and the line is simply not drawn. */
          taxLabel: totals?.tax?.label ?? null,
          taxRateBps: totals?.tax?.rateBps ?? null,
          adjustments: (totals?.adjustments ?? []).map((adjustment) => ({
            code: adjustment.code,
            label: adjustment.label,
            amount: adjustment.amount.amount,
          })),
        },
      });

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

  /* The same guard the drawer and /cart carry: an unreadable basket is not an
     empty one, and "there is nothing to check out" is the wrong thing to tell
     somebody whose basket is full. */
  if (cart.problem && cart.resolved.length === 0 && step !== "review") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<ShieldAlert aria-hidden="true" />}
          title="We couldn't load your cart"
          body={cart.problem}
          action={
            <Button
              type="button"
              onClick={() => window.location.reload()}
            >
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  if (cart.hydrated && cart.resolved.length === 0 && step !== "review") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<ShieldAlert aria-hidden="true" />}
          title="Your cart is empty"
          body="There is nothing to check out yet. Browse PLA, PETG and TPU by the spool or by the box."
          action={
            <Button asChild>
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
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to cart
        </Link>

        <StepHeader step={step} />
        {error && (
          <ErrorBanner
            error={error}
            mode={config.mode}
            action={
              /* A WAY OUT FOR EVERY REFUSAL THAT HAS ONE. Retrying the same
                 step is what the form's own submit already offers, so a button
                 goes here only when the next move is somewhere ELSE — the cart
                 for a checkout with nothing in it, and us for the two the
                 shopper cannot fix by trying harder. */
              /* ═══ THE ORDER, AND POINTEDLY NOT THE CART ═══
                 Checked FIRST, ahead of every branch that offers "Back to
                 cart". This shopper has paid; the cart is where a second
                 attempt starts, so it is the one destination that must not be
                 on this screen. Their order is the thing they actually want
                 and the thing that proves the money arrived. */
              error.code === "checkout_paid" ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/account/orders">See your order</Link>
                </Button>
              ) : error.code === "gone" || error.code === "empty_cart" ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                >
                  <Link href="/cart">Back to cart</Link>
                </Button>
              ) : error.code === "server" || error.code === "unknown" ? (
                /* Matching `PaymentHelpAction` on the order page: same
                   variant, same glyph, same destination. A shopper who has met
                   one of these should recognise the other. */
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <Link href="/contact">
                    <LifeBuoy aria-hidden="true" className="h-4 w-4" />
                    Ask us about this
                  </Link>
                </Button>
              ) : undefined
            }
          />
        )}

        {step === "address" && (
          <form onSubmit={submitAddress} className="flex flex-col gap-4">
            {savedAddresses.length > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-semibold text-foreground">
                  Deliver to
                </legend>
                {savedAddresses.map((parsed, i) => {
                  const key = keyOfSaved(i);
                  return (
                    <label
                      key={key}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 border px-3 py-2.5 transition-colors",
                        chosenAddress === key
                          ? "border-foreground bg-brand-soft/40"
                          : "border-brand-line hover:border-foreground",
                      )}
                    >
                      <input
                        type="radio"
                        name="saved-address"
                        className="mt-1 accent-brand"
                        checked={chosenAddress === key}
                        onChange={() => {
                          setChosenAddress(key);
                          setAddress(parsed);
                          /* Choosing from the list is a deliberate act, so the
                             async prefill must not overwrite it either. */
                          touchAddress();
                        }}
                      />
                      <span className="min-w-0 text-sm">
                        <span className="block font-medium text-foreground">{parsed.name}</span>
                        {/* EVERY FIELD THAT DISTINGUISHES ONE FROM ANOTHER.
                            The API dedupes on the whole snapshot, so two orders
                            to the same house differing only in phone or postcode
                            come back as two entries — and with those two fields
                            omitted they rendered as identical rows the shopper
                            had to choose between blind. */}
                        <span className="block text-muted-foreground">
                          {[parsed.line1, parsed.line2, parsed.city, parsed.region, parsed.postalCode]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                        {parsed.phone && (
                          <span className="block text-muted-foreground">{parsed.phone}</span>
                        )}
                      </span>
                    </label>
                  );
                })}

                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 border px-3 py-2.5 transition-colors",
                    chosenAddress === NEW_ADDRESS
                      ? "border-foreground bg-brand-soft/40"
                      : "border-brand-line hover:border-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name="saved-address"
                    className="accent-brand"
                    checked={chosenAddress === NEW_ADDRESS}
                    onChange={() => {
                      setChosenAddress(NEW_ADDRESS);
                      /* CLEARED, not left holding the last selection. Picking
                         "somewhere else" and finding the previous address still
                         in the fields is how a parcel goes to the wrong place. */
                      setAddress(BLANK_ADDRESS);
                      touchAddress();
                    }}
                  />
                  <span className="text-sm font-medium text-foreground">
                    Somewhere else
                  </span>
                </label>
              </fieldset>
            )}

            {/* ═══ EDITING A FIELD DETACHES THE SELECTION ═══
                The card renders the immutable snapshot while the fields edit
                state, so with the radio left checked the step displayed one
                address and submitted another — the highlighted card still
                reading "14 Bourdillon Road" over fields saying something else.
                Any edit means this is no longer that saved address, and the
                selection has to say so. */}
            {/* ═══ THE FORM IS THE CONFIG'S, NOT THIS FILE'S ═══
                Order, labels, which fields appear at all and what each one
                will accept are the shop's setting, read from
                `/api/public/shop/delivery-config`. With the switch off that
                config is `DISTRICT_FALLBACK`, which is field-for-field the
                form this block used to spell out.

                `rows` carries the one thing a flat `fields[]` cannot say:
                City and State share a line, as they do on screen today. */}
            {/* ═══ THE COUNTRY, WHICH IS A CONTROL ONLY WHEN THE SERVER SAYS
                SO ═══
                `country.locked` is true today, so this renders as fixed text —
                which is exactly what the form has always shown, since the
                shop only ships from and within Nigeria. When international
                selling is switched on the admin sets it false and sends the
                list in `country.allowed`, and this becomes a real selector.

                THE LIST IS NEVER SPELLED HERE. A hardcoded set of countries
                would be a second, stale answer to a question the delivery
                config already answers, and the shop would offer to ship
                somewhere it has no zone for. */}
            <CountryField
              config={config}
              value={address.countryCode}
              onChange={(countryCode) => editAddress({ countryCode })}
            />

            {rows.map((row) =>
              row.length === 2 ? (
                <div key={row[0].key} className="grid grid-cols-2 gap-4">
                  {row.map(renderField)}
                </div>
              ) : (
                renderField(row[0])
              ),
            )}

            {/* Only ever when the config offers it — which is also the gate on
                sending the field at all, because `AddressesBody` is `.strict()`
                and an older server 400s on it. */}
            {config.location.offer && (
              <LocationCapture
                config={config}
                value={address.location}
                onChange={(location) => editAddress({ location })}
              />
            )}

            <Button
              type="submit"
              disabled={busy || rateLimited}
              tone="primary"
              className="mt-2 h-12 text-base"
            >
              {busy && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
              Continue to delivery
            </Button>
          </form>
        )}

        {step === "delivery" && (
          <form onSubmit={submitDelivery} className="flex flex-col gap-3">
            {shippingOptions.length === 0 && (
              <p className="text-sm text-muted-foreground">
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
                  <span className="text-sm font-medium text-foreground">
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
              disabled={busy || rateLimited || !selectedShippingId}
              tone="primary"
              className="mt-2 h-12 text-base"
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
                <p className="text-xs text-muted-foreground">Signed in as</p>
                <p className="text-sm font-semibold text-foreground">{customerEmail}</p>
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Your receipt and order access go to this address.
                </p>
              </Field>
            )}
            <PointsOffer
              balance={pointsBalance}
              chosen={redeemPoints}
              onChange={setRedeemPoints}
              disabled={busy}
            />
            <Button
              type="submit"
              disabled={busy || rateLimited || !email}
              tone="primary"
              className="mt-2 h-12 text-base"
            >
              Continue to review
            </Button>
          </form>
        )}

        {step === "review" && (
          <div className="flex flex-col gap-4">
            {busy && !totals && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Locking in your total…
              </p>
            )}
            {totals && (
              <>
                <div className="border-2 border-foreground p-4">
                  {/* ═══ THE LAST PLACE A CORRECTION HAS TO BE ONE CLICK AWAY ═══
                      This panel showed the address with no way to change it, and
                      no step in the flow had a back control — `setStep` was only
                      ever called forward. A shopper who reached the payment step
                      and saw the wrong address had to leave for /cart and come
                      back, which remounts the flow and preselects the same
                      address again. This is the screen somebody is about to pay
                      from; it is the worst possible place to make "that's wrong"
                      a dead end. */}
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">Deliver to</p>
                    {/* ═══ THAWS ON THE WAY OUT, AND THAT IS WHAT MAKES THE
                        BUTTON HONEST ═══
                        This sent the shopper to the address step while the
                        cart stayed frozen at `converting`, so the address they
                        went back to fix was refused with a 409 the moment they
                        submitted it — a "Change" control that could not change
                        anything. `thawCheckout` drops the stale totals with
                        it, so the walk back through delivery and contact ends
                        at a freshly frozen total rather than the old one.

                        The step moves EITHER WAY. A refusal here leaves the
                        cart frozen, but the shopper asked to go and editing
                        the address is now itself a thaw (the API unfreezes on
                        `PUT /checkout/addresses`), so sending them is the
                        recovery. The one exception is a paid checkout, where
                        `thawCheckout` raises the banner and this must not walk
                        them into a flow that would charge them twice. */}
                    <button
                      type="button"
                      onClick={() => {
                        void thawCheckout().then((thawed) => {
                          if (thawed) setStep("address");
                        });
                      }}
                      className="shrink-0 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      Change
                    </button>
                  </div>
                  {/* ═══ WHAT WAS SENT, NOT WHAT IS IN THE FORM ═══
                      `effectiveAddress` carries only the fields this config
                      actually asked for. Reading raw form state here would
                      print a postcode under `simple` — never on screen, never
                      submitted, but still sitting in state from a saved
                      address — and the review would describe an address the
                      shop was not given. */}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[
                      effectiveAddress.name,
                      effectiveAddress.line1,
                      effectiveAddress.line2,
                      /* The district is part of where the parcel goes AND why
                         delivery costs what the line below says — its name
                         (not its key) belongs in the address the customer
                         confirms. */
                      districtName,
                      effectiveAddress.city,
                      effectiveAddress.region,
                      effectiveAddress.postalCode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{email}</p>
                </div>

                <div className="border-2 border-foreground p-4">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-muted-foreground">Subtotal</span>
                    <span className="font-mono text-sm tabular-nums text-foreground">
                      {formatNaira(majorUnits(totals.subtotal))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-muted-foreground">Delivery</span>
                    <span className="font-mono text-sm tabular-nums text-foreground">
                      {formatNaira(majorUnits(totals.shippingTotal))}
                    </span>
                  </div>
                  {totals.taxTotal.amount > 0 && (
                    <div className="flex items-center justify-between py-1">
                      {/* The API's own label ("VAT") — the customer is told
                          WHAT the line is, not the generic word for it. */}
                      <span className="text-sm text-muted-foreground">
                        {totals.tax?.label || "Tax"}
                      </span>
                      <span className="font-mono text-sm tabular-nums text-foreground">
                        {formatNaira(majorUnits(totals.taxTotal))}
                      </span>
                    </div>
                  )}
                  {/*
                    * THE API'S OWN LABEL, RENDERED VERBATIM, and no sign added.
                    * The amount is already negative — a discount is a negative
                    * adjustment — so prefixing a minus renders "-−₦500". The
                    * label is where the programme's nouns legitimately reach
                    * this package: the admin composed the string from the
                    * operator's configuration at the instant the total froze, so
                    * it still describes what the customer agreed to even if the
                    * programme is renamed tomorrow.
                    */}
                  {totals.adjustments.map((adjustment) => (
                    <div
                      key={adjustment.code}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm text-muted-foreground">
                        {adjustment.label}
                      </span>
                      <span className="font-mono text-sm tabular-nums text-foreground">
                        {formatNaira(majorUnits(adjustment.amount))}
                      </span>
                    </div>
                  ))}
                  <div className="mt-1 flex items-center justify-between border-t border-brand-line pt-2">
                    <span className="text-base font-semibold text-foreground">
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
                  /* `checkout_paid` DISABLES THIS, and that is the entire
                     remedy for it. The money is already taken and an order is
                     being built; a live Pay button under a banner saying so is
                     an invitation to be charged twice. `idempotencyKey` is
                     nulled at the same time, so even a click that got through
                     would return early — this is the visible half of that. */
                  disabled={
                    busy ||
                    redirecting ||
                    rateLimited ||
                    error?.code === "gone" ||
                    error?.code === "checkout_paid"
                  }
                  tone="primary"
                  className="h-12 text-base"
                >
                  {(busy || redirecting) && (
                    <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {redirecting ? "Taking you to payment…" : "Pay now"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {"The store never sees your card. You'll pay on Paystack's own page."}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-24 border-2 border-foreground p-4">
          <p className="text-sm font-semibold text-foreground">In your cart</p>
          <ul className="mt-3 flex flex-col gap-3">
            {cart.resolved.map((line) => (
              <li key={line.key} className="flex justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {line.product.name} × {line.qty}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-foreground">
                  {formatNaira(line.total)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-brand-line pt-3">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {formatNaira(cart.subtotal)}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
