"use client";

import * as React from "react";
import { Link } from "../components/link";
import { AlertTriangle, ArrowLeft, LifeBuoy, Loader2, ShieldAlert } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
  SkeletonRegion,
  cn,
} from "@plaspool/ui";

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
import { Field, NATIVE_SELECT_CLASSES } from "./address-field";
import { CountryField, isCountryServed, type CountryHint } from "./country-field";
import {
  NO_PLACES,
  offeredStates,
  readDeliveryPlaces,
  type DeliveryPlaces,
} from "../data/delivery-places";
import {
  basketSignature,
  reconcileShippingSelection,
  shippingIsStale,
} from "./shipping-options";
import { RegionField } from "./region-field";
import { AddressAutofill } from "./address-autofill-button";
import { prefillFromGeoHint, suggestDistrict, type GeocodedAddress } from "./address-autofill";
import { readGeoHint, type GeoHint } from "../data/geo-hint";
import { NIGERIA } from "../data/nigerian-states";
import { errorCopy } from "./checkout-error-copy";
import { saveReceiptSnapshot } from "./receipt-snapshot";
import { getPointsBalance } from "../data/points-api";
import type { PointsBalance } from "../data/points-api";
import { PointsOffer } from "./points-offer";
import { STEP_LABELS, stepsFor, type Step } from "./checkout-steps";
import { DiscountCodeField } from "./discount-code-field";
import { AddOnOfferList, AddOnPendingSummary, type AddOnChoice } from "./add-on-offer-card";
import { AddOnReviewControl, AddOnTotalRows } from "./add-on-review-control";
import { addOnRowsFor, askedAddOns, pendingAddOns } from "./add-ons";
import { majorUnits } from "../data/cart-api";
import { useCart } from "../cart/cart-context";
import {
  REDEMPTION_ADJUSTMENT_CODE,
  addOnsOf,
  createPaymentIntent,
  currentCartRevision,
  cancelCheckout,
  applyDiscountCode,
  freezeCheckout,
  previewCheckout,
  removeDiscountCode,
  setAddOnChoice,
  readShippingOptions,
  setCheckoutAddress,
  setCheckoutShipping,
  startCheckout,
} from "../data/checkout-api";
import type {
  AddOnOffer,
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

function StepHeader({ step, steps }: { step: Step; steps: Step[] }) {
  const index = steps.indexOf(step);
  return (
    <div className="mb-6">
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Step {index + 1} of {steps.length}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">{STEP_LABELS[step]}</h1>
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

/**
 * Whether the extras step should open as a bottom sheet.
 *
 * ═══ READ AT EVENT TIME, NEVER AT RENDER ═══
 * `matchMedia` cannot answer during the server render, and a render that read
 * it would make the first client paint disagree with the server's —
 * `dialog.tsx`'s own header is the note on why the sheet is CSS below `sm`
 * rather than a JS switch. So the DRAWING is CSS: the cards sit on the page
 * above `sm` and `DialogContent mobile="sheet"` re-seats itself below it,
 * and nothing about either is decided by JavaScript. The one question CSS
 * cannot answer is whether to OPEN the dialog at all — a dialog open on a
 * desktop is a focus trap over a page that already shows the cards — and
 * that is asked here, only ever from the click that continues past the
 * previous step, in the browser. Matches Tailwind's `sm` (640px) exactly,
 * because the sheet re-seats itself below that same width.
 */
const NARROW_VIEWPORT = "(max-width: 639.98px)";

function narrowViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia(NARROW_VIEWPORT).matches;
}

/* The country and state controls, and the `Field` frame they share, live in
   `country-field.tsx`, `region-field.tsx` and `address-field.tsx` — split out
   so they render under Vitest without mounting this component. */

export function CheckoutFlow() {
  const cart = useCart();

  const [step, setStep] = React.useState<Step>("details");
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
    if (step !== "details") return;
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
   * The states the active courier accepts — the State select's option list.
   *
   * READ FROM THE SERVER because it is a courier setting, not geography: the
   * shop can be switched between couriers in the admin with no deploy, and a
   * list spelled in this repo could not follow. `offeredStates()` reconciles
   * the courier's spelling to this repo's canonical names, so what the select
   * STORES is unchanged by the switch — see `delivery-places.ts`, which is
   * where the reason that matters for the delivery price is written down.
   *
   * PER COUNTRY, and refetched when the shopper changes it. Every documented
   * failure — no cached list, unknown country, shipping by hand, and the
   * `localhost` CORS wall — answers `NO_PLACES`, which offers all 37 states.
   * An empty list is "no constraint", never an error.
   */
  const [places, setPlaces] = React.useState<DeliveryPlaces>(NO_PLACES);
  const placesCountry = (address.countryCode || config.country.default).toUpperCase();
  React.useEffect(() => {
    let cancelled = false;
    void readDeliveryPlaces(placesCountry).then((next) => {
      if (!cancelled) setPlaces(next);
    });
    return () => {
      cancelled = true;
    };
  }, [placesCountry]);

  const offered = React.useMemo(() => offeredStates(places), [places]);

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
  /**
   * The basket the options in `shippingOptions` were quoted against, or null
   * before anything has been quoted.
   *
   * DELIVERY PRICE MOVES WITH BASKET WEIGHT NOW — one spool to Wuse is ₦4,000
   * and five is ₦5,000 — so an option list outlives the basket it was priced
   * for. Under the old flat zone rates this could not happen and nothing
   * watched the cart. See `shipping-options.ts`.
   */
  const [quotedFor, setQuotedFor] = React.useState<string | null>(null);
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

  /* What a delivery quote is only true for. Derived from the resolved lines
     because weight is per unit, so a swapped variant moves the price exactly
     as an added spool does. */
  const basketSig = basketSignature(
    cart.resolved.map((line) => ({
      variantId: line.product.variantIds[`${line.colour.id}:${line.size.id}`] ?? "",
      qty: line.qty,
    })),
  );

  /* The estimate for the option the shopper is on, matched BY ID — the freeze
     stores no `eta` (an estimate is not a promise an invoice should carry), so
     the review step can only show one the delivery step is still holding. */
  const chosenEta = shippingOptions.find((option) => option.id === selectedShippingId)?.eta;

  /**
   * RE-READ THE DELIVERY OPTIONS WHEN THE BASKET MOVES.
   *
   * The price is a courier quote against the basket's weight, so the list
   * fetched by `PUT /checkout/addresses` is only true for the lines it was
   * quoted against. A shopper who adds two spools after the address step and
   * is still shown the one-spool price does not get charged it — the server
   * re-derives at freeze — they watch the total jump on the payment step
   * instead, which is the surprise the freeze exists to prevent.
   *
   * ONLY ONCE SOMETHING HAS BEEN QUOTED (`quotedFor !== null`). Before the
   * address is in there is nothing stale and nothing to ask for.
   *
   * RE-PUTTING THE ADDRESS IS HOW OPTIONS ARE RE-READ — there is no
   * options-only route, and the address is what the quote keys off along with
   * the weight. The revision is re-read immediately before the call, never
   * arithmetic on a held one.
   *
   * NOT WHILE `busy`. A submit in flight is already re-reading the options as
   * part of its own sequence, and a second write against the same revision
   * would lose the race and surface as a `baseRevision` refusal.
   */
  React.useEffect(() => {
    if (!shippingIsStale(quotedFor, basketSig)) return;
    if (busy) return;
    if (cart.resolved.length === 0) return;

    let cancelled = false;
    void (async () => {
      const result = await readShippingOptions();
      if (cancelled) return;
      if (!result.ok) {
        /* LEFT STALE ON PURPOSE rather than cleared. An empty list renders as
           "no delivery options reach this address", which is a refusal the
           shopper would read as final — and this is a failed re-read, not a
           refused address. The next submit re-reads it anyway, and the server
           is the one that decides the number at freeze. */
        return;
      }
      const options = result.data.options;
      const next = reconcileShippingSelection(options, selectedShippingId);
      setShippingOptions(options);
      setSelectedShippingId(next);
      setQuotedFor(basketSig);

      /* ═══ THE CART STORES THE CHOICE, SO A REQUOTE HAS TO RE-SEND IT ═══
         `PUT /checkout/shipping` is required before freezing even when there
         is one option: a freeze with none produces `shipping: null` and a
         total with no delivery in it. The id has changed under a weight band
         crossing (`fez:400000` becomes `fez:500000`), so the id the cart is
         holding is no longer one the new list offers. */
      if (next && next !== selectedShippingId) {
        const rev = await currentCartRevision();
        if (cancelled || !rev) return;
        await setCheckoutShipping(next, rev.revision);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `selectedShippingId` is read, not depended on: it changes as a RESULT of
    // this effect, and listing it would re-run the requote on its own write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotedFor, basketSig, busy, cart.resolved.length]);

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

  /**
   * The discount code currently on the checkout, or null.
   *
   * TRACKED LOCALLY BECAUSE THE FROZEN TOTALS DO NOT NAME IT. A code shows up
   * in `totals.adjustments` as a label and an amount — the operator's own
   * wording, rendered verbatim — and there is no field on it saying which code
   * produced it. So the field below would have no way to show what is applied,
   * or to offer to remove it, without remembering what it sent.
   *
   * The SERVER is still the authority on whether it applies: this is only what
   * was accepted, and every total on screen comes from a freeze that the server
   * computed with the code in hand.
   */
  const [appliedDiscount, setAppliedDiscount] = React.useState<string | null>(null);

  /**
   * The add-on offers as the server last described them for this cart.
   *
   * ═══ THE API DECIDES, THIS ONLY REMEMBERS ITS LAST ANSWER ═══
   * The operator's rules say, per cart, whether an add-on is ASKED about or
   * INCLUDED, and the checkout preview evaluates them against the address
   * and the delivery option as they stand. This is filled from that preview
   * at the moment the shopper continues past the step before
   * (`continueToTotal`), and from every answer's response. The extras step
   * draws `pendingAddOns(offers)`; the review step draws a control for
   * `askedAddOns(offers)`. Nothing here decides whether an add-on applies,
   * and nothing here prices one.
   */
  const [offers, setOffers] = React.useState<AddOnOffer[]>([]);
  /** Set once the cart's own offers have been read into `offers`, so the seed
   *  below cannot re-run over an answer the shopper has since given. */
  const [seededFromCart, setSeededFromCart] = React.useState(false);
  /**
   * How many add-ons the extras step is asking about, for "Step N of M".
   *
   * ZERO UNTIL THE STEP IS ENTERED, AND STICKY AFTER — the same shape as
   * `shippingOptions`, which is also unknown until the address is in. Not
   * re-derived from `offers` on every read: once every question is answered
   * nothing is pending, and a header that dropped from "3 of 3" to "2 of 2"
   * the moment the shopper changed a discount code on the review step would
   * be the count lying in the other direction. Reset only by a fresh pass
   * through the details step.
   */
  const [askCount, setAskCount] = React.useState(0);
  /**
   * Where the extras step goes when its last question is answered.
   *
   * THE STEP IS REACHED FROM TWO DIRECTIONS AND THEY END DIFFERENTLY. Entered
   * FIRST, from the cart's own offers, the shopper has typed nothing yet and
   * the next thing they owe is an address. Entered LATE, from
   * `continueToTotal`, the address is already in and the only thing left is
   * the total. One step, two exits — and a single `freezeAndReview()` at the
   * end of `chooseAddOn` would freeze a checkout with no address in it.
   */
  const [afterExtras, setAfterExtras] = React.useState<"details" | "review">("review");
  /** Whether the extras step is currently drawn as a bottom sheet. Only ever
   *  true below `sm` — see `narrowViewport`. */
  const [sheetOpen, setSheetOpen] = React.useState(false);

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
        /* BACK TO THE DETAILS STEP, whose submit re-freezes. It used to be
           `contact`, which no longer exists — that step was one email field
           and is now part of the details form. */
        if (thawed) setStep("details");
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
   * Where the preselected country came from, for the sentence under it —
   * null once the shopper has chosen one themselves. Shown only over the
   * blank form: a saved address's country is the shopper's own.
   */
  const [countryHint, setCountryHint] = React.useState<CountryHint | null>(null);

  /**
   * ═══ THE COUNTRY, PRESELECTED FROM THE CONNECTION ═══
   * `/api/geo` answers with where Cloudflare places this IP. Only the country
   * is acted on, and only if the shop delivers there — `prefillFromGeoHint`
   * holds both decisions and the reasons. The same guard as the saved-address
   * prefill: never into a form somebody has touched. Re-run when the config
   * lands, because the allowed list is the config's and the first pass may
   * have read the fallback's.
   */
  const [geoHint, setGeoHint] = React.useState<GeoHint | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    void readGeoHint().then((hint) => {
      if (!cancelled) setGeoHint(hint);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  React.useEffect(() => {
    if (!geoHint) return;
    const patch = prefillFromGeoHint(geoHint, config);
    if (!patch || touchedRef.current) return;
    setAddress((current) =>
      current.countryCode.toUpperCase() === patch.countryCode ? current : { ...current, ...patch },
    );
    setCountryHint("ip");
  }, [geoHint, config]);

  /** Whether the shop delivers to the country as it stands — the gate on the
   *  submit. `country-field.tsx` says why the list still offers the rest. */
  const countryServed = isCountryServed(config, address.countryCode);

  /* The steps this checkout actually has — two, unless the server offered a
     real delivery choice or is asking about an add-on. See `stepsFor`. */
  const steps = React.useMemo(
    () => stepsFor(shippingOptions.length, askCount),
    [shippingOptions.length, askCount],
  );

  /* What the extras step has to ask about right now. Derived, never stored:
     an answer's response replaces `offers` whole, and the step is finished
     the render this becomes empty. */
  const pendingOffers = pendingAddOns(offers);

  /**
   * ═══ THE CART'S OWN OFFERS OPEN THE CHECKOUT ═══
   *
   * `GET /cart` evaluates the add-on rules against the REAL cart on every
   * read — real item count, real address, real discount code, real session —
   * so by the time this component mounts the provider is already holding the
   * answer. If anything is unanswered, that is step one.
   *
   * ═══ WHAT MAKES A QUESTION "UNANSWERED" IS NOT WHAT IT LOOKS LIKE ═══
   * `pendingAddOns` gates on `mode !== "include" && choice === null`, and the
   * subtlety is entirely in `opt_out`: for it, `null` and `"accepted"` mean
   * the same thing — the box stays and costs nothing extra — so an answered
   * one is genuinely finished and MUST NOT be asked again. Answers are stored
   * on the cart precisely so the product page and this step cannot ask twice;
   * a shopper who ticked "leave out the packaging" in the buy box arrives here
   * with `choice: "declined"` already recorded and never sees this step.
   *
   * ═══ ONCE, AND ONLY ONCE ═══
   * `seededFromCart` latches on the first hydrated read. Without it every
   * answer's response — which flows back into the provider — would re-enter
   * the step the shopper just finished. `hydrated` rather than a length check
   * because an empty `addOns` is a real answer ("nothing applies here") and is
   * indistinguishable from "not read yet" until the provider says so.
   */
  /* ADJUSTED DURING RENDER, NOT IN AN EFFECT — the pattern
     `add-to-cart.tsx` documents, and for the same reason: React 19's
     `react-hooks/set-state-in-effect` rule refuses the effect version, and it
     is right to. An effect would paint the details step once and then replace
     it with the extras step, so the shopper would see the checkout start and
     then change its mind. A render-phase update re-renders before the browser
     paints, so the first thing drawn is already the right step.

     IT CANNOT RUN ON THE SERVER, which is what makes `narrowViewport()` safe
     here: `cart.hydrated` is false until the provider has read the cart in the
     browser, so this branch is unreachable during SSR. */
  if (!seededFromCart && cart.hydrated) {
    setSeededFromCart(true);
    const current = cart.addOns;
    if (current.length > 0) {
      setOffers(current);
      const pending = pendingAddOns(current);
      if (pending.length > 0) {
        setAfterExtras("details");
        setAskCount(pending.length);
        setStep("extras");
        setSheetOpen(narrowViewport());
      }
    }
  }

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

    if (field.key === "region") {
      return (
        <Field
          key={field.key}
          id={id}
          label={field.label}
          required={field.required}
          help={field.help}
        >
          {/* A SELECT OF THE STATES FOR A NIGERIAN ADDRESS, the free-text
              input for anywhere else — see `region-field.tsx`. Its value is
              the canonical state name, which is what the district picker
              under it and the server's zone both match. */}
          <RegionField
            id={id}
            field={field}
            countryCode={address.countryCode || config.country.default}
            value={fieldValue(address, field.key, effectiveDistrict)}
            servedRegions={config.servedRegions}
            offered={offered}
            describedBy={describedBy}
            onChange={(region) => editAddress(fieldPatch("region", region))}
          />
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

  /**
   * The one form: address AND email, submitted together.
   *
   * The email used to be its own step with a single field on it — and for a
   * signed-in customer not even that, just their own address read back with a
   * Continue button underneath. It is validated here now, before anything is
   * written server-side, so a missing one costs nothing.
   */
  /**
   * The device's fix, merged into the form.
   *
   * THE AREA IS RESET WITH THE STATE. A district chosen for the previous
   * address is no answer for the new one, and the one the fix names is taken
   * only when exactly one served area fits it — `suggestDistrict` holds the
   * rule. Through `editAddress`, so a fill detaches a saved address the way a
   * keystroke does, and the hint under the country says where it came from.
   */
  const fillFromDevice = React.useCallback(
    (result: GeocodedAddress) => {
      const patch: Partial<Address> = { ...result.patch };
      if (patch.region !== undefined) {
        const country = (patch.countryCode ?? address.countryCode ?? config.country.default).toUpperCase();
        patch.district =
          country === NIGERIA
            ? suggestDistrict(districtChoicesFor(serviceAreas, patch.region), result.localities)
            : null;
      }
      editAddress(patch);
      setCountryHint(patch.countryCode ? "gps" : null);
    },
    [address.countryCode, config, editAddress, serviceAreas],
  );

  async function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    /* The button is already disabled for this; a form can still be submitted
       by other means, and an unserved country must never reach the API, where
       it would price at the catch-all zone. */
    if (!countryServed) return;
    if (!email) {
      setError({ code: "field", field: "email" });
      return;
    }
    setBusy(true);
    setError(null);
    /* A fresh pass through the flow. Whether the extras step exists is
       decided again on the way to the total — see `askCount`. */
    setAskCount(0);
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
      const options = result.data.options;
      setShippingOptions(options);
      setSelectedShippingId(reconcileShippingSelection(options, null));
      setQuotedFor(basketSig);

      /* ═══ ONE OPTION IS NOT A CHOICE, SO IT IS NOT A SCREEN ═══
         The shop offers exactly one delivery option today, and the step that
         asked about it was a radio group with a single filled circle and a
         Continue button. Selected here instead, and the shopper goes straight
         to the total — which is the thing they were trying to reach. The step
         reappears on its own the day a second option exists, because
         `stepsFor` counts them. */
      if (options.length <= 1) {
        if (options[0]) {
          /* THE REVISION IS RE-READ, NEVER ARITHMETIC ON THE LAST ONE. Setting
             the address just moved it, and `rev2.revision + 1` is a guess that
             produces `400 {"detail":"baseRevision"}` the moment the server
             bumps it by anything other than one. The file header is explicit:
             read it back immediately before the call. */
          const rev3 = await currentCartRevision();
          if (!rev3) {
            setError({ code: "gone" });
            return;
          }
          const shipping = await setCheckoutShipping(options[0].id, rev3.revision);
          if (!shipping.ok) {
            applyError(shipping.error);
            return;
          }
        }
        await continueToTotal();
        return;
      }

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
      /* STRAIGHT TO THE TOTAL — by way of the extras step if the preview
         raises a question. This used to hand off to a contact step that
         asked for an email already collected on step one. */
      await continueToTotal();
    } finally {
      setBusy(false);
    }
  }

  /**
   * Freeze the checkout and advance to the review step.
   *
   * NOT A `useEffect` REACTING TO `step === "review"`, deliberately. Freezing
   * is a write with real consequences (it spends the reservation's one
   * extension), so it happens as a direct result of a submit rather than as a
   * side effect of a render the freeze itself also causes.
   *
   * `redeem` DEFAULTS TO THE CURRENT SELECTION but is passed explicitly by
   * `reprice`, because state set in the same tick is not readable here — a
   * shopper moving the points slider on the review step would otherwise
   * re-freeze against the PREVIOUS number and be quoted a total that does not
   * match the control they just moved.
   */
  async function freezeAndReview(redeem: number = redeemPoints) {
    const rev = await currentCartRevision();
    if (!rev) {
      setError({ code: "gone" });
      return;
    }
    const result = await freezeCheckout(rev.revision, redeem);
    if (!result.ok) {
      applyError(result.error);
      return;
    }
    {
      setTotals(result.data.totals);
      setCheckoutId(rev.cartId);
      /* Minted here, once, from the id that will not change for the rest of
         this checkout attempt — see the field's own doc comment. */
      /* `rev.revision` is the base revision this freeze was submitted
         against — the revision that produced THIS total. See the field's own
         doc comment for why the revision has to be part of the key. */
      setIdempotencyKey(`ckout_${rev.cartId}_${rev.revision}`);
      setStep("review");
    }
  }

  /**
   * From the last details/delivery step to the total — by way of the extras
   * step when there is a question to ask.
   *
   * ═══ THE OFFERS THAT DECIDE THE STEP COME FROM THE PREVIEW ═══
   * Some rules read the delivery address or the delivery option, so an offer
   * can appear only once those are written. `POST /checkout/preview`
   * evaluates the rules against the checkout as it stands — which is why it
   * is asked HERE, after the address and the option are in, and not off
   * `GET /cart`, whose offers are for the drawer. A pending `ask` add-on is a
   * question the shop said it would ask; the freeze would price it as
   * declined without a word, so the asking has to happen before it.
   *
   * A REFUSED PREVIEW IS SHOWN, NOT SWALLOWED. It refuses exactly what the
   * freeze would refuse, through the admin's same function — so a banner
   * here is the banner the freeze was about to raise, one round trip
   * earlier, and the submit that got here is the retry. What is NOT a
   * refusal is an older admin answering the preview without `addOns` at all:
   * that is an empty list, no question, and straight to the total — the
   * checkout exactly as it was before add-ons existed.
   */
  async function continueToTotal() {
    const preview = await previewCheckout();
    if (!preview.ok) {
      applyError(preview.error);
      return;
    }
    const current = addOnsOf(preview.data);
    setOffers(current);
    const pending = pendingAddOns(current);
    if (pending.length > 0) {
      askAboutAddOns(pending);
      return;
    }
    await freezeAndReview();
  }

  /**
   * Send the shopper to the extras step — as a page above `sm`, as a bottom
   * sheet below it. The step counts in "N of M" either way: the sheet is how
   * it is drawn on a phone, not a different flow.
   */
  function askAboutAddOns(pending: AddOnOffer[]) {
    /* THE LATE ENTRY. The address is in and the preview turned up a question
       the cart could not have known about — a rule that reads the delivery
       area, say. The only thing left after it is the total, so this exit is
       `review` rather than the `details` the mount-time seed sets. */
    setAfterExtras("review");
    setAskCount(pending.length);
    setStep("extras");
    setSheetOpen(narrowViewport());
  }

  /**
   * Record one answer on the extras step, and move on when nothing is left
   * to ask.
   *
   * ═══ THE CART IS OPEN HERE, SO THERE IS NOTHING TO THAW ═══
   * The step sits before the freeze, and the last answer given here is what
   * reaches it. The review step's control is the one that has to thaw first,
   * and it goes through `reprice`.
   *
   * ═══ `add_on_not_offered` IS A RE-READ, NOT A BANNER ═══
   * The cart changed, or the rules did, between the offer and the click. The
   * shopper did nothing wrong and has nothing to retry, so the offers are
   * previewed again and the step redraws from them — and if that leaves
   * nothing pending, the flow carries on to the total exactly as if the
   * question had never been asked.
   */
  async function chooseAddOn(addOnId: string, choice: AddOnChoice) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const rev = await currentCartRevision();
      if (!rev) {
        setError({ code: "gone" });
        setSheetOpen(false);
        return;
      }
      const result = await setAddOnChoice(addOnId, choice, rev.revision);
      let next: AddOnOffer[];
      if (result.ok) {
        next = result.data.addOns;
      } else if (result.error.code === "add_on_not_offered") {
        const again = await previewCheckout();
        next = again.ok ? addOnsOf(again.data) : [];
      } else {
        applyError(result.error);
        /* On a phone the banner is on the page UNDER the sheet, so the sheet
           closes to show it; the page's Continue re-opens the question. */
        setSheetOpen(false);
        return;
      }
      setOffers(next);
      if (pendingAddOns(next).length === 0) {
        setSheetOpen(false);
        /* ═══ WHERE THE LAST ANSWER LEADS ═══
           Asked first, the shopper has typed nothing and owes an address;
           freezing here would freeze a checkout with no address in it. Asked
           late, the address is already in and the total is all that is left.
           See `afterExtras`. */
        if (afterExtras === "details") {
          setStep("details");
        } else {
          await freezeAndReview();
        }
      }
    } finally {
      setBusy(false);
    }
  }

  /**
   * Re-price the frozen checkout after the shopper changes something on the
   * review step.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * THAW, MUTATE, RE-FREEZE — AND ONLY THE CANCEL ROUTE MAKES THIS POSSIBLE.
   *
   * Points and discount codes both move the total, and the total on the review
   * step is FROZEN: the cart is at `converting`, `/checkout/discount` will not
   * touch it, and a freeze over a freeze is not a repricing. So the sequence is
   * `cancelCheckout()` to thaw, then the mutation, then a fresh
   * `freezeCheckout` — which is exactly the journey the cancel route was added
   * for. Before it existed, a shopper who wanted to spend points had to be
   * asked BEFORE they could see what the points were worth against, which is
   * why the widget was buried on a contact step.
   *
   * ═══ THE OLD TOTAL IS DROPPED THE INSTANT THE THAW SUCCEEDS ═══
   * A thaw clears the frozen totals server-side, so what is on screen is
   * already void. `thawCheckout` nulls them, and this only re-populates them
   * from a NEW freeze — the review step shows its "working out your total"
   * state in between rather than a stale figure with a live Pay button over it.
   *
   * A `checkout_paid` refusal stops everything: `thawCheckout` raises the
   * banner and returns false, and re-pricing an order that has been paid for is
   * the one thing that must never happen here.
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async function reprice(change: { redeem?: number; mutate?: () => Promise<unknown> }) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const thawed = await thawCheckout();
      if (!thawed) return;
      /* ═══ RE-FROZEN WHETHER OR NOT THE MUTATION LANDED ═══
         The thaw has already voided the total on screen. This used to return
         here when the mutation was refused — a code the shop will not take —
         which left the review step with a banner and NOTHING under it: no
         total, no Pay button, and no control that re-freezes. The banner's
         own copy says "carry on without it — your order is otherwise ready",
         so the order has to be on screen to carry on with. The mutation
         reports its refusal through `applyError`; the freeze below puts the
         total back, and `freezeAndReview` does not clear the banner on its
         way. */
      if (change.mutate) await change.mutate();
      await freezeAndReview(change.redeem ?? redeemPoints);
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
          /* The freeze's own record of what went on the order — `chosen` by
             the shopper or `included` by the rules — with what was CHARGED
             for each. Absent from a total frozen before add-ons existed, and
             then nothing is drawn. */
          addOns: (totals?.addOns ?? []).map((addOn) => ({
            title: addOn.title,
            mode: addOn.mode,
            amount: addOn.amount.amount,
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
      {/* ═══ `min-w-0`, OR A LONG WORD WIDENS THE WHOLE PAGE ═══
          A grid item's min-width is `auto`, so this column refuses to shrink
          below its longest unbreakable string — an email with no spaces, a
          mono discount label — and the 1fr track grows past the viewport
          instead of wrapping. The row's own rules below (`min-w-0` labels,
          `shrink-0` amounts) only hold once this one does. */}
      <div className="min-w-0">
        <Link
          href="/cart"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to cart
        </Link>

        <StepHeader step={step} steps={steps} />
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

        {step === "details" && (
          <form onSubmit={submitDetails} className="flex flex-col gap-4">
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
            {/* ═══ ONE TAP TO FILL THE ADDRESS FROM THE DEVICE ═══
                What the fix fills, and what it never touches, is decided in
                `address-autofill.ts`; the button's copy tells the shopper to
                check every line, because the area sets the delivery price. */}
            <AddressAutofill onFill={fillFromDevice} disabled={busy} />

            {/* ═══ THE COUNTRY: A SELECT OF EVERY COUNTRY, A SUBMIT ONLY TO
                THE SERVER'S ═══
                Preselected from the connection (`/api/geo`) or the device (the
                button above), and the sentence under it says which.
                `config.country.allowed` is still the only list a parcel may go
                to: anywhere else takes the Continue button away — see
                `country-field.tsx` and `countryServed` on the submit. */}
            <CountryField
              config={config}
              value={address.countryCode}
              hint={chosenAddress === NEW_ADDRESS ? countryHint : null}
              onChange={(countryCode) => {
                setCountryHint(null);
                editAddress({ countryCode });
              }}
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

            {/* ═══ THE CONTACT STEP, FOLDED IN ═══
                This was step three of four, carrying one field — and for a
                signed-in customer not even that, just their own address read
                back to them above a Continue button. It belongs with the rest
                of "who you are and where this is going". */}
            <div className="border-t border-brand-line pt-4">
              {checkingSession ? (
                /* The signed-in box is what usually resolves here, so the wait
                   is drawn as that box rather than as a sentence — the field
                   swaps in at the same height when the session comes back a
                   guest. See `CLAUDE.md`, "Loading states — skeletons, never
                   prose". */
                <SkeletonRegion
                  label="Checking your account"
                  className="border border-brand-line px-4 py-3"
                >
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
            </div>

            <Button
              type="submit"
              disabled={busy || rateLimited || !email || !countryServed}
              tone="primary"
              className="mt-2 h-12 text-base"
            >
              {busy && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
              {/* NAMES WHERE IT GOES, and where it goes depends on whether
                  there is a delivery choice to make. A button promising
                  "Continue to delivery" on a shop with one option was the
                  clearest possible signal that the step existed for its own
                  sake. */}
              {shippingOptions.length > 1 ? "Continue to delivery" : "Continue to payment"}
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
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {option.label}
                    </span>
                    {/* CONDITIONAL, AND NO RESERVED SPACE. Live Fez sends no
                        `eta` and the sandbox does, so production must look
                        right with this absent — which is why it is a sibling
                        line rather than a slot held open for it. */}
                    {option.eta && (
                      <span className="block text-xs text-muted-foreground">{option.eta}</span>
                    )}
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
              Continue to payment
            </Button>
          </form>
        )}

        {step === "extras" && (
          <div className="flex flex-col gap-4">
            {/* ═══ ONE STEP, TWO DRAWINGS, DECIDED BY CSS ═══
                Above `sm` the cards are the page. Below it the page shows the
                offers named with their prices and one Continue, and the cards
                live in the sheet — which `askAboutAddOns` opened on the way
                in, and which Continue re-opens if it was closed without an
                answer. Both blocks are always in the tree; the viewport picks
                one, so the server render and the first paint agree, which is
                the rule `dialog.tsx` sets out. The step counts in "N of M"
                either way. */}
            <div className="max-sm:hidden">
              <AddOnOfferList
                offers={pendingOffers}
                disabled={busy || rateLimited}
                onChoose={chooseAddOn}
              />
            </div>
            <AddOnPendingSummary
              className="sm:hidden"
              offers={pendingOffers}
              disabled={busy || rateLimited}
              onContinue={() => setSheetOpen(true)}
            />
            <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
              <DialogContent mobile="sheet">
                <DialogHeader>
                  <DialogTitle>{STEP_LABELS.extras}</DialogTitle>
                  <DialogDescription className="sr-only">
                    Choose whether to add these to your order.
                  </DialogDescription>
                </DialogHeader>
                <AddOnOfferList
                  offers={pendingOffers}
                  disabled={busy || rateLimited}
                  onChoose={chooseAddOn}
                />
              </DialogContent>
            </Dialog>
          </div>
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
                          if (thawed) setStep("details");
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
                  <p className="mt-1 break-words text-sm text-muted-foreground">
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
                  <p className="mt-2 break-all text-sm text-muted-foreground">{email}</p>
                </div>

                <div className="border-2 border-foreground p-4">
                  <div className="flex items-start justify-between gap-3 py-1">
                    <span className="min-w-0 text-sm text-muted-foreground">Subtotal</span>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                      {formatNaira(majorUnits(totals.subtotal))}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 py-1">
                    {/* ═══ THE COURIER'S OWN NAME, NOT THE WORD "DELIVERY" ═══
                        The freeze carries the option it charged, so the line
                        says "Fez Delivery" where a courier quoted it and falls
                        back to "Delivery" for a frozen total that predates the
                        courier or for the flat zone rate, which has no name
                        worth showing. `checkout-complete.tsx` already read the
                        label this way; this step was the one screen still
                        hardcoding it. */}
                    <span className="min-w-0 text-sm text-muted-foreground">
                      {totals.shipping?.label ?? "Delivery"}
                      {/* The estimate the shopper was quoted, carried from the
                          delivery step — a freeze deliberately does not store
                          one, so this comes from the option they chose. */}
                      {chosenEta && (
                        <span className="block text-xs text-muted-foreground">{chosenEta}</span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                      {formatNaira(majorUnits(totals.shippingTotal))}
                    </span>
                  </div>
                  {/* THE ADD-ONS, AFTER DELIVERY AND BEFORE THE TAX. The
                      title is the operator's; the value is what the freeze
                      CHARGED, or `Included` for one the rules put on the
                      order for free — `addOnRowsFor` owns that rule. Absent
                      from every total frozen before add-ons existed. */}
                  <AddOnTotalRows
                    rows={addOnRowsFor(
                      (totals.addOns ?? []).map((addOn) => ({
                        id: addOn.id,
                        title: addOn.title,
                        mode: addOn.mode,
                        amount: addOn.amount.amount,
                      })),
                      totals.currency,
                    )}
                  />
                  {totals.taxTotal.amount > 0 && (
                    <div className="flex items-start justify-between gap-3 py-1">
                      {/* The API's own label ("VAT") — the customer is told
                          WHAT the line is, not the generic word for it. */}
                      <span className="min-w-0 break-words text-sm text-muted-foreground">
                        {totals.tax?.label || "Tax"}
                      </span>
                      <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
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
                      className="flex items-start justify-between gap-3 py-1"
                    >
                      <span className="min-w-0 break-words text-sm text-muted-foreground">
                        {adjustment.label}
                      </span>
                      <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                        {formatNaira(majorUnits(adjustment.amount))}
                      </span>
                    </div>
                  ))}
                  <div className="mt-1 flex items-start justify-between gap-3 border-t border-brand-line pt-2">
                    <span className="min-w-0 text-base font-semibold text-foreground">
                      Total
                    </span>
                    <span className="shrink-0 font-mono text-base font-bold tabular-nums text-foreground">
                      {formatNaira(majorUnits(totals.grandTotal))}
                    </span>
                  </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════
                    THE TWO THINGS THAT CHANGE THE TOTAL, BESIDE THE TOTAL.

                    Points used to be asked for on a step BEFORE the total
                    existed — a shopper was invited to spend a balance without
                    being shown what it came off. Discount codes had nowhere to
                    go at all. Both belong here, next to the number they move,
                    and both work the same way: thaw, apply, re-freeze (see
                    `reprice`). That round trip is only possible because the
                    cancel route exists.

                    DISABLED WHILE ANYTHING IS IN FLIGHT. Two repricings racing
                    would resolve in whichever order the network chose and leave
                    the shopper looking at a total that matches neither control.
                    ═══════════════════════════════════════════════════════════ */}
                <div className="flex flex-col gap-4 border-2 border-foreground p-4">
                  <PointsOffer
                    balance={pointsBalance}
                    chosen={redeemPoints}
                    /* WHAT THE FREEZE GRANTED, not what was asked for. The
                       quote is re-decided server-side and can come back empty
                       on a 200 — the panel's own header lists the ways — so
                       the widget is handed the answer rather than assuming
                       its request succeeded. */
                    granted={
                      totals.adjustments.find(
                        (a) => a.code === REDEMPTION_ADJUSTMENT_CODE,
                      ) ?? null
                    }
                    onChange={(next) => {
                      setRedeemPoints(next);
                      void reprice({ redeem: next });
                    }}
                    disabled={busy || redirecting}
                  />
                  <DiscountCodeField
                    applied={appliedDiscount}
                    disabled={busy || redirecting}
                    onApply={(code) =>
                      reprice({
                        mutate: async () => {
                          const result = await applyDiscountCode(code);
                          if (!result.ok) {
                            applyError(result.error);
                            return;
                          }
                          setAppliedDiscount(code);
                        },
                      })
                    }
                    onRemove={() =>
                      reprice({
                        mutate: async () => {
                          const result = await removeDiscountCode();
                          if (!result.ok) {
                            applyError(result.error);
                            return;
                          }
                          setAppliedDiscount(null);
                        },
                      })
                    }
                  />
                  {/* ═══ EVERY ADD-ON THE SHOP ASKED ABOUT, CHANGEABLE HERE ═══
                      An answer given on the extras step is a line in the
                      frozen total, and this is the last place a correction
                      has to be one click away — including an `ask` offer the
                      rules raised only once the address was in, which arrives
                      here unanswered and off the order. Same journey as a
                      code: thaw, record the answer, re-freeze.
                      `add_on_not_offered` is a silent re-read of the offers
                      — the cart is thawed by then, so the preview answers —
                      and never a banner. */}
                  {askedAddOns(offers).map((offer) => (
                    <AddOnReviewControl
                      key={offer.id}
                      offer={offer}
                      disabled={busy || redirecting}
                      onChange={(choice) =>
                        reprice({
                          mutate: async () => {
                            const rev = await currentCartRevision();
                            if (!rev) {
                              setError({ code: "gone" });
                              return;
                            }
                            const result = await setAddOnChoice(offer.id, choice, rev.revision);
                            if (result.ok) {
                              setOffers(result.data.addOns);
                              return;
                            }
                            if (result.error.code === "add_on_not_offered") {
                              const again = await previewCheckout();
                              if (again.ok) setOffers(addOnsOf(again.data));
                              return;
                            }
                            applyError(result.error);
                          },
                        })
                      }
                    />
                  ))}
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
