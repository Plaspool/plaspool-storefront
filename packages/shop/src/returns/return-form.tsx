"use client";

import * as React from "react";
import { Link } from "../components/link";
import { Check, Loader2 } from "lucide-react";
import { Button, Input, Label, NEO_SURFACE, Textarea, cn } from "@plaspool/ui";

import { ReturnRequestError, listMyReturns, requestReturn } from "../data/returns-api";
import type { MyReturn, ReturnConfirmation, ServiceArea } from "../data/returns-api";
import { pointsLabel, unitLabel } from "../data/marketing";
import type { RewardsProgram } from "../data/marketing";
import { listSavedAddresses } from "../data/orders-api";
import type { Address } from "../data/checkout-api";
import { readSavedAddress } from "../checkout/saved-address";

/**
 * Asking for a return.
 *
 * THE DIRECT SIBLING OF `product/review-form.tsx` — a client form posting
 * cross-origin, field-level errors first and a whole-form message only as the
 * fallback. Where the two differ, it is because the API differs, not because
 * this form invented its own idiom.
 *
 * ═══ STATE AND DISTRICT ARE BOTH NATIVE `<select>`S, NOT `@plaspool/ui`'s `Select` ═══
 * That `Select` is Radix: it portals its listbox and renders it only once
 * opened on the client, so under `renderToStaticMarkup` — this file's own test
 * harness — it emits zero options, and neither the state list nor the
 * districts this form's own test asserts on would have anything to assert
 * against. (NOT because it makes the form work without JavaScript — it does
 * not. There is no `name` attribute anywhere in this form and no `action`, so
 * a shopper with no script running cannot submit any of it regardless of what
 * these two fields are made of; that is not their problem to solve.) There is
 * no form-select precedent to violate either: the only Radix `Select` in this
 * package is `listing/sort-select.tsx`, a sort control where client-only is
 * fine, and the checkout's address form uses `<Input>` throughout, even for
 * "State". A native select is also the better mobile control, which is where
 * most of this shop's traffic is.
 *
 * ═══ STATE NARROWS DISTRICT; THE DISTRICT'S `id` IS STILL THE ONLY THING SENT ═══
 * `areas` carries `region` (the state) alongside `name` (the district) for
 * every row the API answers with. The state select's own value is never
 * submitted — it exists only to cut the district list down to one state's
 * worth, and changing it clears whatever district was chosen, since a
 * district from the old state is no longer a valid answer. `serviceAreaId`
 * is still the district's `id`, exactly as the API's `POST /me/returns`
 * expects; nothing about the wire format changes.
 *
 * ═══ ONE STATE SETTLES ITSELF RATHER THAN BEING OFFERED AS A CHOICE ═══
 * Production serves 28 districts today, all "Federal Capital Territory" —
 * see `return-form.test.tsx`. With exactly one distinct `region`, it is
 * preselected on mount and the state select is `disabled`: a control with
 * one legal answer is not a decision, and asking a shopper to make it is
 * friction with nothing behind it. It is not hidden, though — a shopper
 * should still see which state their pickup is in. `disabled` alone is what
 * "settled" looks like here; a second state appearing turns the select back
 * into a real, open choice automatically, with no branch of its own.
 *
 * ═══ NO EMAIL FIELD ═══
 * The pickup address belongs to the signed-in session, not to whatever a
 * shopper types. The API refuses an `email` key outright — see
 * `return-form.test.tsx`'s first assertion, pinned where a regression would
 * otherwise slip in unnoticed as a "helpful" extra field.
 *
 * ═══ EVERY WORD OF THE PROGRAMME COMES FROM `program`, NEVER FROM SOURCE ═══
 * `data/marketing.ts` sets the rule out at length and `house-rules.test.ts`
 * greps the real nouns out of this package. `pointsLabel`/`unitLabel` are how
 * a count agrees with a noun this file never spells.
 *
 * ═══ THE FORM NEVER EMPTIES ITSELF ═══
 * Every branch `placeError` can reach is recoverable — a paused programme, a
 * rate limit, a session that expired mid-type — and a form that clears on any
 * of them is one the shopper types twice. Nothing here calls a setter that
 * would reset a field the shopper filled in. The one branch that cannot avoid
 * losing what was typed is `sign-in`: recovering means leaving the page, and
 * the copy there says so rather than promising what a navigation cannot keep.
 *
 * ═══ `onDone` FIRES FROM THE CONFIRMATION, NOT AS PART OF SUCCESS ═══
 * Task 10 passes `onDone={() => onOpenChange(false)}`, closing its dialog the
 * instant it runs. Calling it alongside `setConfirmation(...)` would unmount
 * this form in the same tick React would otherwise paint the confirmation —
 * the one screen `requestId` is ever shown on would never be seen. `onDone`
 * fires only from the confirmation's own "Done" control; the standalone
 * `/returns` page passes no `onDone`, so its confirmation simply stays put.
 *
 * ═══ PREFILL: TWO SOURCES, ONE DELIBERATE PRECEDENCE, NEVER THE QUANTITY ═══
 * On mount this form reads `listMyReturns()` and `listSavedAddresses()` —
 * both cross-site, credentialed, and, like every other `/me/` read in this
 * package, INCAPABLE OF THROWING (`null`/`[]` on any failure, a guest
 * included). `resolveReturnPrefill` — exported for the same reason
 * `placeError` is, so the precedence is testable without a DOM — decides
 * between them: a previous return that actually carries the four contact
 * fields wins outright, because it is what THIS shopper last told the
 * returns desk; a saved delivery address (`checkout/saved-address.ts`,
 * already proven at the checkout) is only the fallback. The two sources
 * never mix field-by-field — one whole source wins, or the form stays blank
 * and asks. Quantity is never touched by either source; it stays at the
 * programme's own minimum, because a past return's count answers a
 * different pickup, not this one.
 *
 * NEITHER FETCH GATES FIRST PAINT. Same stance `checkout-flow.tsx:202`
 * documents for its own saved-address list: the form is interactive from the
 * first render, and the prefill lands a beat later, into whichever fields
 * are still blank.
 *
 * A REF, NOT ONLY THE FORM'S OWN STATE, GUARDS AGAINST CLOBBERING. A shopper
 * can start typing before the two reads land — `prefillTouchedRef` is set
 * synchronously by every prefillable field's own `onChange`, and the fetch's
 * `.then()` checks it before calling a single setter. This is the same class
 * of bug as the stale-session regression this project already fixed once: a
 * late async answer overwriting state a person has since moved past. Once
 * applied, every field stays a normal, editable control — nothing here is
 * read-only — and editing one never re-runs the fetch (it has no dependency
 * that changes on keystroke), so prefill fires at most once per mount.
 *
 * `prefillSource` IS WHY THE FORM SAYS SO. A form that fills itself in
 * silently is unsettling and easy to submit stale, so one line under the
 * quantity field names which source won — "your last return" or "your saved
 * address" — never a programme noun, because the sentence names the SOURCE,
 * not the scheme.
 *
 * NO SESSION BRANCH HERE ON PURPOSE. `ReturnFormGate`/`ReturnModal` already
 * decide whether this form mounts at all; inside it, `"unknown"` and a guest
 * both simply get two reads that answer nothing; there is nothing for this
 * file to branch on that the reads do not already collapse for it.
 */

/** The API's own floor for one request, mirrored so a quantity below it is
 *  reported beside the field before a request is ever made. The API still
 *  gets the last word — see `placeError`'s `below-minimum` case — because the
 *  programme this form was handed can go stale while it sits open in a tab. */
function belowMinimum(qty: number, program: RewardsProgram): boolean {
  return !Number.isFinite(qty) || !Number.isInteger(qty) || qty < program.minUnitsPerReturn;
}

/** Joins whichever message ids currently apply to one field into a single
 *  `aria-describedby`, dropping the falsy ones. A field can carry permanent
 *  help text, an error, both, or neither, and `aria-describedby` accepts a
 *  space-separated list for exactly this case. */
function describedBy(...parts: Array<string | false | null | undefined>): string | undefined {
  const ids = parts.filter((part): part is string => Boolean(part));
  return ids.length ? ids.join(" ") : undefined;
}

/** A non-empty string once trimmed — the same bar `readSavedAddress` holds
 *  a snapshot's fields to, applied here to a previous return's. */
function hasText(value: string | null): value is string {
  return value != null && value.trim() !== "";
}

/** Whether a previous return carries anything this form could prefill from.
 *  The four contact fields only started being recorded once this feature
 *  shipped (`plaspool-admin@a811cc9`) — an older row has all four `null` and
 *  teaches this form nothing, so it is skipped rather than offered blank. */
function hasPrefillDetails(item: MyReturn): boolean {
  return (
    hasText(item.customerName) ||
    hasText(item.customerPhone) ||
    hasText(item.pickupAddress) ||
    hasText(item.serviceAreaId)
  );
}

/**
 * A saved delivery address, folded into the single textarea the return form
 * offers for a pickup address.
 *
 * THE SAME SHAPE `settings-page.tsx` AND `checkout-flow.tsx` ALREADY RENDER
 * A SAVED ADDRESS AS —
 * `[line1, line2, city, region, postalCode].filter(Boolean).join(", ")` —
 * so a shopper reads the same address written the same way wherever this
 * shop shows it to them, rather than a third format invented for this one
 * field. `name` is excluded on purpose: this form has its own separate Name
 * field, so folding it in here would duplicate it inside the address text.
 *
 * Exported so it is testable on its own, the same reason `resolveReturnPrefill`
 * below is.
 */
export function composePickupAddress(address: Address): string {
  return [address.line1, address.line2, address.city, address.region, address.postalCode]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(", ");
}

/** What `resolveReturnPrefill` hands the form: which source won, and the
 *  four fields it fills — `region` preselects the state select,
 *  `serviceAreaId` the district. Quantity is deliberately absent; it is not
 *  a field either source is allowed to touch. */
export interface ReturnPrefill {
  source: "previous-return" | "saved-address";
  name: string;
  phone: string;
  pickupAddress: string;
  region: string;
  serviceAreaId: string;
}

/**
 * Which of the two prefill sources wins, and what it fills in.
 *
 * Exported so the precedence — the load-bearing part, exactly like
 * `placeError` above — is testable without a DOM. See the file header for
 * why a previous return outranks a saved address, why the two never mix
 * field-by-field, and why quantity is not here at all.
 */
export function resolveReturnPrefill(
  returns: MyReturn[] | null,
  savedAddress: Address | null,
  areas: ServiceArea[],
): ReturnPrefill | null {
  // `returns` is already newest-first (`listMyReturns()`'s own contract) —
  // the first match here is the most recent return that carries anything.
  const prior = (returns ?? []).find(hasPrefillDetails);
  if (prior) {
    const serviceAreaId = prior.serviceAreaId ?? "";
    // A stale id — the area was since renamed or withdrawn — resolves to no
    // area at all; the state select is left for the shopper to set, and the
    // district select simply shows nothing selected. Never a thrown error.
    const area = areas.find((a) => a.id === serviceAreaId);
    return {
      source: "previous-return",
      name: prior.customerName ?? "",
      phone: prior.customerPhone ?? "",
      pickupAddress: prior.pickupAddress ?? "",
      region: area?.region ?? "",
      serviceAreaId,
    };
  }

  if (savedAddress) {
    return {
      source: "saved-address",
      name: savedAddress.name,
      phone: savedAddress.phone ?? "",
      pickupAddress: composePickupAddress(savedAddress),
      // The checkout's own "State" field, the same concept as an area's
      // `region` — see the file header.
      region: savedAddress.region ?? "",
      // A saved address carries no district of its own to preselect.
      serviceAreaId: "",
    };
  }

  return null;
}

/*
 * A local, non-exported `Field` — deliberately duplicated from
 * `checkout/checkout-flow.tsx:137` rather than imported. The checkout's own
 * copy is a non-exported local too, so there is nothing to import; lifting it
 * into `@plaspool/ui` so two forms can share it is a refactor of its own, not
 * this task's business.
 */
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

/** Classed to match `Input` exactly, minus the classes a `<select>` has no use
 *  for (`file:…`, `placeholder:…`) — the two controls sit in the same form and
 *  must read as one family, not as a themed control beside a browser default. */
const NATIVE_SELECT_CLASSES =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

/** The API's own ceilings (`server/marketing/returns/customer.ts` in the
 *  admin repo — `phone`/`name` at 200, `pickupAddress` at 1000), mirrored so
 *  a paste from somewhere long fails quietly at the keyboard rather than
 *  loudly as a 400 after a round trip. */
const PHONE_MAX = 200;
const ADDRESS_MAX = 1000;
const NAME_MAX = 200;

/** Where a refusal belongs on screen. `null` means "above the submit". */
type Placement =
  | { field: "qtyDeclared" | "serviceAreaId"; message: string }
  | { field: null; message: string }
  | { kind: "already-open"; existingId: string }
  | { kind: "sign-in" };

/** Exported so the whole branch table is testable without a DOM — this
 *  suite has none, deliberately, and the brief calls this function "the
 *  load-bearing part". See `return-form.test.tsx`. */
export function placeError(err: ReturnRequestError, program: RewardsProgram): Placement {
  switch (err.reason) {
    case "below-minimum": {
      const min = err.min ?? program.minUnitsPerReturn;
      return {
        field: "qtyDeclared",
        message: `We collect from ${min} ${unitLabel(min, program)} upwards.`,
      };
    }
    case "outside-area": {
      const served = err.served ?? [];
      return {
        field: "serviceAreaId",
        message: served.length
          ? `We do not collect there yet. We do collect from ${served.join(", ")}.`
          : "We do not collect there yet.",
      };
    }
    /* NOT AN ERROR. The shopper's answer already exists; the useful thing is a
       way to it, not a red sentence about a rule they did not know. */
    case "already-open":
      return { kind: "already-open", existingId: err.existingId ?? "" };
    /* A session can expire with a form half-typed, so this is handled here and
       not only by the dialog's guest branch. */
    case "unauthenticated":
      return { kind: "sign-in" };
    case "programme-paused":
      return { field: null, message: "Returns are paused just now. Nothing you typed is lost — try again shortly." };
    case "rate-limited":
      return { field: null, message: "That is a few requests in a short time. Give it a few minutes and try again." };
    case "invalid":
      return { field: null, message: "Something in the form was not accepted. Check the fields and try again." };
    case "failed":
      return { field: null, message: "The request could not be sent. Check your connection and try again." };
  }
}

export interface ReturnFormProps {
  program: RewardsProgram;
  areas: ServiceArea[];
  /** Task 10's modal passes this to close itself. Fired only from the
   *  confirmation's own "Done" control, never automatically on success — see
   *  the file header. The page passes nothing, and its confirmation simply
   *  stays on screen. */
  onDone?: () => void;
  className?: string;
}

export function ReturnForm({ program, areas, onDone, className }: ReturnFormProps) {
  const [qty, setQty] = React.useState(String(program.minUnitsPerReturn));
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [pickupAddress, setPickupAddress] = React.useState("");
  const [serviceAreaId, setServiceAreaId] = React.useState("");
  /* Lazily initialised from `areas`, the same pattern `qty` above uses on
     `program` — both are props available at mount, never fetched inside this
     client component. See the file header: exactly one region settles itself
     here rather than waiting on an effect to catch up after first paint. */
  const [selectedRegion, setSelectedRegion] = React.useState(() => {
    const distinct = [...new Set(areas.map((area) => area.region))];
    return distinct.length === 1 ? distinct[0] : "";
  });

  const [sending, setSending] = React.useState(false);
  /* Client-side validation appears only after a submit attempt — reporting a
     blank required field before the shopper has reached it is the form
     arguing with them while they are still filling it in. */
  const [attempted, setAttempted] = React.useState(false);
  const [placement, setPlacement] = React.useState<Placement | null>(null);
  const [confirmation, setConfirmation] = React.useState<ReturnConfirmation | null>(null);

  /** Which prefill source won, once the two reads land and actually fill
   *  something in — `null` until then, and also `null` for good on a mount
   *  where neither source had anything. Drives the one-line "we filled this
   *  in from…" note; see the file header. */
  const [prefillSource, setPrefillSource] = React.useState<ReturnPrefill["source"] | null>(null);

  /* THE TWO BLOCK-LEVEL OUTCOMES — `already-open` AND `sign-in` — CAN LAND
     ENTIRELY OFF-SCREEN, SILENTLY. Both render at the TOP of the form; submit
     is at the BOTTOM. In the dialog (a scrolling `max-h` around a ~700px
     form) that is off-screen on any phone; on `/returns` it is a full-page
     scroll. This ref plus the effect below fixes the sighted and
     screen-reader cases at once: focusing an off-screen element scrolls it
     into view, and `role="alert"` on the block itself means a screen reader
     announces it the moment it is placed, without waiting on focus at all.
     Field-level errors and the plain message above the submit button are
     deliberately UNCHANGED — see the file header on why this form never
     empties itself, and `review-form.tsx` for the same silence being the
     pre-existing house shape there. */
  const blockAlertRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (placement && "kind" in placement) {
      blockAlertRef.current?.focus();
    }
  }, [placement]);

  /* SET SYNCHRONOUSLY, INSIDE EVERY PREFILLABLE FIELD'S OWN `onChange` —
     not `useState`, because a `useState` guard reads whatever the closure
     captured at the last render, and the fetch below can resolve between a
     keystroke and the render it causes. A ref is current the instant it is
     written, which is what lets the effect's `.then()` below ask "has the
     shopper started?" and get a live answer rather than a stale one. */
  const prefillTouchedRef = React.useRef(false);
  function touchPrefill() {
    prefillTouchedRef.current = true;
  }

  /* THE PREFILL READ ITSELF — see the file header for the precedence, the
     never-clobber guarantee and why there is no session branch here.
     Fired once per mount; `areas` is a prop handed down whole from a parent
     that fetches it once, so this does not refire on a keystroke. */
  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([listMyReturns(), listSavedAddresses()]).then(([returns, saved]) => {
      if (cancelled || prefillTouchedRef.current) return;
      const savedAddress = saved.map(readSavedAddress).find((a): a is Address => a !== null) ?? null;
      const prefill = resolveReturnPrefill(returns, savedAddress, areas);
      if (!prefill) return;
      setName(prefill.name);
      setPhone(prefill.phone);
      setPickupAddress(prefill.pickupAddress);
      setSelectedRegion(prefill.region);
      setServiceAreaId(prefill.serviceAreaId);
      setPrefillSource(prefill.source);
    });
    return () => {
      cancelled = true;
    };
  }, [areas]);

  const uid = React.useId();
  const id = (part: string) => `${uid}-${part}`;

  /** Every distinct state served, sorted — the state select's own options. */
  const regions = React.useMemo(
    () => [...new Set(areas.map((area) => area.region))].sort((a, b) => a.localeCompare(b)),
    [areas],
  );

  /** Only the districts in whichever state is currently chosen — the
   *  district select's options. Empty (so the select offers nothing beyond
   *  its own placeholder) until `selectedRegion` names one. */
  const districtsInRegion = React.useMemo(
    () => areas.filter((area) => area.region === selectedRegion),
    [areas, selectedRegion],
  );

  /** No district can be chosen at all. Task 9's brief calls for the select
   *  itself to render `disabled` here; a "choose a district" nag beside a
   *  control nobody can fill in is a dead end, so submit is disabled too
   *  rather than letting a shopper reach a guaranteed generic API refusal. */
  const noAreas = areas.length === 0;

  /** More than one state actually exists to choose between. Below this, the
   *  state select is `disabled` — either nothing is served at all, or one
   *  state is and choosing it is not a real decision. See the file header. */
  const regionIsAChoice = regions.length > 1;

  const qtyNumber = Number(qty);
  const problems = {
    qtyDeclared: belowMinimum(qtyNumber, program)
      ? `We collect from ${program.minUnitsPerReturn} ${unitLabel(program.minUnitsPerReturn, program)} upwards.`
      : null,
    phone: phone.trim() ? null : "Tell us a phone number to reach you on.",
    pickupAddress: pickupAddress.trim() ? null : "Tell us where to collect from.",
    serviceAreaId: !noAreas && !serviceAreaId ? "Choose a district." : null,
  };
  const valid = Object.values(problems).every((problem) => problem === null);

  /** The message beside one field: a client-side problem once a submit has
   *  been attempted, else a server placement naming that same field — which
   *  only arises when the client thought the value was fine and the API,
   *  reading a fresher programme or a fresher service-area list, disagreed. */
  function fieldMessage(field: "qtyDeclared" | "serviceAreaId"): string | null {
    if (attempted && problems[field]) return problems[field];
    if (placement && "field" in placement && placement.field === field) return placement.message;
    return null;
  }

  /** A server placement naming this field is only correct until the shopper
   *  changes the value it complained about — otherwise "we don't collect
   *  there" keeps pointing at a district they already changed away from. */
  function clearFieldPlacement(field: "qtyDeclared" | "serviceAreaId") {
    setPlacement((current) => (current && "field" in current && current.field === field ? null : current));
  }

  const pointsForQty = Number.isFinite(qtyNumber) && qtyNumber > 0 ? qtyNumber * program.pointsPerUnit : 0;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setAttempted(true);
    setPlacement(null);
    if (!valid || sending) return;

    setSending(true);
    try {
      const result = await requestReturn({
        qtyDeclared: qtyNumber,
        phone,
        pickupAddress,
        serviceAreaId,
        name: name.trim() ? name.trim() : undefined,
      });
      setConfirmation(result);
    } catch (err) {
      setPlacement(
        err instanceof ReturnRequestError
          ? placeError(err, program)
          : { field: null, message: "The request could not be sent. Check your connection and try again." },
      );
    } finally {
      setSending(false);
    }
  }

  if (confirmation) {
    const confirmedProgram = confirmation.program;
    const confirmedPoints = confirmation.qtyDeclared * confirmedProgram.pointsPerUnit;
    return (
      <div
        role="status"
        className={cn(
          "flex items-start gap-3 rounded-lg border border-brand-line bg-brand-soft p-4",
          className,
        )}
      >
        <Check aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <div className="text-sm leading-6">
          <p className="font-semibold text-foreground">
            Request sent — {confirmation.qtyDeclared} {unitLabel(confirmation.qtyDeclared, confirmedProgram)} for{" "}
            {confirmedPoints} {pointsLabel(confirmedPoints, confirmedProgram)}.
          </p>
          <p className="mt-1 text-muted-foreground">
            {confirmedProgram.name} will be in touch to arrange pickup. Reference {confirmation.requestId}.
          </p>
          {/* ═══ "VIEW YOUR RETURNS", ALWAYS — NOT ONLY BESIDE "DONE" ═══
              Spec §2's whole argument for requiring a session was "every
              submitter can see their own request" — a promise this screen
              made at every OTHER outcome (the `already-open` box above links
              here too) and never once at the moment it is actually kept.
              Unconditional because the standalone `/returns` page passes no
              `onDone` and still owes this shopper the same door.
              SAFE ON THE MODAL PATH ONLY BECAUSE OF `ReturnsCta`'s route-change
              close (Important 2) — without it, a plain `<Link>` here would
              navigate the page underneath while this dialog stayed open over
              it, exactly the failure the already-open box's identical link
              had. */}
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {/* The only dismissal this component offers of its own. The page
                passes no `onDone` and is happy to leave this on screen
                indefinitely. */}
            {onDone && (
              <Button type="button" variant="outline" onClick={onDone}>
                Done
              </Button>
            )}
            <Link
              href="/account/returns"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              View your returns
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={cn("flex flex-col gap-5", className)}>
      {placement && "kind" in placement && placement.kind === "already-open" && (
        <div
          ref={blockAlertRef}
          role="alert"
          tabIndex={-1}
          className="border-2 border-foreground bg-brand-soft px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-background"
        >
          <p className="text-sm font-semibold text-foreground">
            You already have an open return request.
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Nothing here was sent again — nothing you typed is lost either.
            {placement.existingId && ` Reference ${placement.existingId}.`}
          </p>
          <Link
            href="/account/returns"
            className="mt-1.5 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            View your returns
          </Link>
        </div>
      )}

      {placement && "kind" in placement && placement.kind === "sign-in" && (
        <div
          ref={blockAlertRef}
          role="alert"
          tabIndex={-1}
          className="border-2 border-foreground bg-brand-soft px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-background"
        >
          <p className="text-sm font-semibold text-foreground">Sign in to send this request.</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {/* Signing in is a full navigation away from this form, so it does
                NOT preserve what was typed. Say that, rather than promise a
                preservation this branch cannot actually deliver. */}
            Your session ended. Signing in will bring you back to this page, but you will need to fill it in again.
          </p>
          <Link
            href={`/sign-in?next=${encodeURIComponent("/returns")}`}
            className="mt-1.5 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Sign in
          </Link>
        </div>
      )}

      <Field id={id("qty")} label="How many are you returning?" required>
        <Input
          id={id("qty")}
          type="number"
          inputMode="numeric"
          min={program.minUnitsPerReturn}
          value={qty}
          aria-required="true"
          aria-invalid={fieldMessage("qtyDeclared") ? true : undefined}
          aria-describedby={describedBy(id("qty-help"), fieldMessage("qtyDeclared") && id("qty-error"))}
          onChange={(event) => {
            setQty(event.target.value);
            clearFieldPlacement("qtyDeclared");
          }}
        />
        <p id={id("qty-help")} className="mt-1.5 text-xs text-muted-foreground">
          {Math.max(qtyNumber || 0, 0)} {unitLabel(qtyNumber || 0, program)} × {program.pointsPerUnit} ={" "}
          {pointsForQty} {pointsLabel(pointsForQty, program)}
        </p>
        {fieldMessage("qtyDeclared") && (
          <p id={id("qty-error")} className="mt-1.5 text-sm text-destructive-strong">
            {fieldMessage("qtyDeclared")}
          </p>
        )}
      </Field>

      {/* ONE LINE, NAMING WHICHEVER SOURCE WON — see the file header. Sits
          between quantity (never prefilled) and the four fields that are, so
          it visibly brackets exactly the fields it is talking about. Stays
          on screen even after the shopper edits one of those fields — see
          the file header on why prefill is not read-only. */}
      {prefillSource && (
        <p className="text-sm text-muted-foreground">
          {prefillSource === "previous-return"
            ? "We filled this in from your last return."
            : "We filled this in from your saved address."}
        </p>
      )}

      <Field id={id("name")} label="Name">
        <Input
          id={id("name")}
          value={name}
          maxLength={NAME_MAX}
          onChange={(event) => {
            setName(event.target.value);
            touchPrefill();
          }}
        />
      </Field>

      <Field id={id("phone")} label="Phone" required>
        <Input
          id={id("phone")}
          type="tel"
          value={phone}
          maxLength={PHONE_MAX}
          aria-required="true"
          aria-invalid={attempted && problems.phone ? true : undefined}
          aria-describedby={describedBy(attempted && problems.phone && id("phone-error"))}
          onChange={(event) => {
            setPhone(event.target.value);
            touchPrefill();
          }}
        />
        {attempted && problems.phone && (
          <p id={id("phone-error")} className="mt-1.5 text-sm text-destructive-strong">
            {problems.phone}
          </p>
        )}
      </Field>

      <Field id={id("address")} label="Pickup address" required>
        <Textarea
          id={id("address")}
          rows={3}
          value={pickupAddress}
          maxLength={ADDRESS_MAX}
          aria-required="true"
          aria-invalid={attempted && problems.pickupAddress ? true : undefined}
          aria-describedby={describedBy(attempted && problems.pickupAddress && id("address-error"))}
          onChange={(event) => {
            setPickupAddress(event.target.value);
            touchPrefill();
          }}
        />
        {attempted && problems.pickupAddress && (
          <p id={id("address-error")} className="mt-1.5 text-sm text-destructive-strong">
            {problems.pickupAddress}
          </p>
        )}
      </Field>

      <Field id={id("region")} label="State" required>
        {/* NATIVE, ON PURPOSE — see the file header. Disabled once there is
            only one legal answer, so it reads as settled rather than as a
            choice; still shown, so the shopper still sees which state they
            are in. */}
        <select
          id={id("region")}
          value={selectedRegion}
          disabled={noAreas || !regionIsAChoice}
          aria-required="true"
          aria-describedby={describedBy(noAreas && id("area-empty"))}
          onChange={(event) => {
            setSelectedRegion(event.target.value);
            // The district just chosen belonged to the old state — it is not
            // a valid answer under the new one, so it does not survive the
            // change, and any server placement naming it no longer applies.
            setServiceAreaId("");
            clearFieldPlacement("serviceAreaId");
            touchPrefill();
          }}
          className={NATIVE_SELECT_CLASSES}
        >
          <option value="">Choose a state</option>
          {regions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
      </Field>

      <Field id={id("area")} label="District" required>
        {/* NATIVE, ON PURPOSE — see the file header. Options come from
            `districtsInRegion`, so they are always exactly one state's
            worth, server-rendered same as the state select above. */}
        <select
          id={id("area")}
          value={serviceAreaId}
          disabled={noAreas || !selectedRegion}
          aria-required="true"
          aria-invalid={fieldMessage("serviceAreaId") ? true : undefined}
          aria-describedby={describedBy(
            noAreas && id("area-empty"),
            fieldMessage("serviceAreaId") && id("area-error"),
          )}
          onChange={(event) => {
            setServiceAreaId(event.target.value);
            clearFieldPlacement("serviceAreaId");
            touchPrefill();
          }}
          className={NATIVE_SELECT_CLASSES}
        >
          <option value="">Choose a district</option>
          {districtsInRegion.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
        {noAreas && (
          <p id={id("area-empty")} className="mt-1.5 text-xs text-muted-foreground">
            We are not collecting anywhere yet.
          </p>
        )}
        {fieldMessage("serviceAreaId") && (
          <p id={id("area-error")} className="mt-1.5 text-sm text-destructive-strong">
            {fieldMessage("serviceAreaId")}
          </p>
        )}
      </Field>

      {placement && "field" in placement && placement.field === null && (
        <p role="alert" className="text-sm text-destructive-strong">
          {placement.message}
        </p>
      )}

      <Button type="submit" disabled={sending || noAreas} className={cn("h-12 text-base", NEO_SURFACE)}>
        {sending && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
        Send return request
      </Button>
    </form>
  );
}
